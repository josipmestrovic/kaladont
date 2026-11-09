#!/usr/bin/env bash
# Dnevni / pre-migracijski šifrirani pg_dump → Storage Box.
# Ugovor: exit 0 samo nakon udaljene veličine + SHA-256 sidecar provjere.
# Opcionalno: UMAMI_BAZA_IME (npr. umami) — drugi dump iste Postgres instance.
set -Eeuo pipefail
umask 077

SKRIPTA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/zajednicko.sh
source "${SKRIPTA_DIR}/lib/zajednicko.sh"

BACKUP_ENV="${KALADONT_BACKUP_ENV:-/etc/kaladont/backup.env}"
RAZLOG='dnevni'
HC_POSLAN_FAIL=0
RADNI_DIR=''
USPJEH=0

upotreba() {
  cat >&2 <<'EOF'
Upotreba: kaladont-backup.sh [--razlog=dnevni|pre-migracija]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --razlog=*)
      RAZLOG="${1#--razlog=}"
      shift
      ;;
    -h|--help)
      upotreba
      exit 0
      ;;
    *)
      upotreba
      kaladont_umri "Nepoznat argument: $1"
      ;;
  esac
done

[[ "$RAZLOG" == 'dnevni' || "$RAZLOG" == 'pre-migracija' ]] \
  || kaladont_umri "Razlog mora biti dnevni ili pre-migracija (dobio: $RAZLOG)"

na_izlazu() {
  local kod=$?
  if [[ "$USPJEH" -eq 0 && "$HC_POSLAN_FAIL" -eq 0 ]]; then
    kaladont_hc_ping "${HEALTHCHECK_BACKUP_URL-}" fail
    HC_POSLAN_FAIL=1
  fi
  if [[ -n "$RADNI_DIR" && -d "$RADNI_DIR" ]]; then
    rm -rf -- "$RADNI_DIR"
  fi
  exit "$kod"
}
trap na_izlazu EXIT

kaladont_ucitaj_env "$BACKUP_ENV"

for var in \
  COMPOSE_PROJECT_DIR COMPOSE_DATOTEKA BAZA_SERVIS BAZA_IME BAZA_KORISNIK \
  AGE_RECIPIENT STORAGEBOX_HOST STORAGEBOX_USER STORAGEBOX_PORT STORAGEBOX_DIR \
  STORAGEBOX_SSH_KEY STORAGEBOX_KNOWN_HOSTS HEALTHCHECK_BACKUP_URL \
  DISK_PRAG_POSTOTAK RETENCIJA_DNEVNIH RETENCIJA_TJEDNIH LOKALNI_RADNI_DIR
do
  kaladont_zahtijevaj_var "$var"
done

DISK_MOUNT="${DISK_MOUNT:-/}"
UMAMI_BAZA_IME="${UMAMI_BAZA_IME:-}"

[[ "$AGE_RECIPIENT" == age1* ]] || kaladont_umri 'AGE_RECIPIENT mora počinjati s age1'
[[ -f "$COMPOSE_DATOTEKA" ]] || kaladont_umri "Compose datoteka ne postoji: $COMPOSE_DATOTEKA"
[[ -f "$STORAGEBOX_SSH_KEY" ]] || kaladont_umri "Nedostaje Storage Box SSH ključ"
[[ -f "$STORAGEBOX_KNOWN_HOSTS" ]] || kaladont_umri "Nedostaje Storage Box known_hosts"
[[ -d "$COMPOSE_PROJECT_DIR" ]] || kaladont_umri "Compose project dir ne postoji: $COMPOSE_PROJECT_DIR"

kaladont_zahtijevaj_naredbu age
kaladont_zahtijevaj_naredbu curl
kaladont_zahtijevaj_naredbu docker
kaladont_zahtijevaj_naredbu sftp
kaladont_zahtijevaj_naredbu sha256sum
kaladont_zahtijevaj_naredbu mktemp

kaladont_hc_ping "$HEALTHCHECK_BACKUP_URL" start

zauzece="$(kaladont_disk_zauzece_postotak "$DISK_MOUNT")"
if [[ -z "$zauzece" || ! "$zauzece" =~ ^[0-9]+$ ]]; then
  kaladont_umri "Ne mogu očitati zauzeće diska za $DISK_MOUNT"
fi
if (( zauzece > DISK_PRAG_POSTOTAK )); then
  kaladont_umri "Disk ${DISK_MOUNT} zauzet ${zauzece}% (prag ${DISK_PRAG_POSTOTAK}%)"
fi

(
  cd "$COMPOSE_PROJECT_DIR"
  docker compose -f "$COMPOSE_DATOTEKA" exec -T "$BAZA_SERVIS" \
    pg_isready -U "$BAZA_KORISNIK" -d "$BAZA_IME"
) >/dev/null

mkdir -p -- "$LOKALNI_RADNI_DIR"
RADNI_DIR="$(mktemp -d "${LOKALNI_RADNI_DIR}/run.XXXXXXXX")"

utc_ts="$(kaladont_utc_ts)"
sufiks=''
if [[ "$RAZLOG" == 'pre-migracija' ]]; then
  sufiks='_pre-migracija'
fi

# mkdir u zasebnom batchu: sftp -b prekida cijeli batch na grešci, a postojeći
# direktorij bi inače spriječio put/rename. Upload batch zato NE smije sadržavati mkdir.
batch_mkdir="$(mktemp "${RADNI_DIR}/sftp-mkdir.XXXXXX")"
cat >"$batch_mkdir" <<EOF
mkdir ${STORAGEBOX_DIR}
bye
EOF
kaladont_sftp_batch "$batch_mkdir" >/dev/null 2>&1 || true

# Dump + age + upload + udaljena SHA/veličina provjera. Ispisuje "ime.age hash".
napravi_dump() {
  local ime_baze="$1"
  local bazno_ime="kaladont_${ime_baze}_${utc_ts}${sufiks}.dump"
  local lokalna_age="${RADNI_DIR}/${bazno_ime}.age"
  local lokalni_sha="${RADNI_DIR}/${bazno_ime}.age.sha256"
  local privremena="${lokalna_age}.part"
  local hash_lokalni velicina_lokalna
  local udaljeni_age udaljeni_sha udaljeni_part
  local provjera_dir batch_upload batch_get
  local velicina_udaljena hash_udaljeni hash_ponovno

  kaladont_log "Backup počinje (razlog=${RAZLOG}, baza=${ime_baze}, artefakt=${bazno_ime}.age)"

  (
    cd "$COMPOSE_PROJECT_DIR"
    docker compose -f "$COMPOSE_DATOTEKA" exec -T "$BAZA_SERVIS" \
      pg_dump -U "$BAZA_KORISNIK" -d "$ime_baze" -Fc
  ) | age -r "$AGE_RECIPIENT" -o "$privremena"

  [[ -s "$privremena" ]] || kaladont_umri "pg_dump|age nije proizveo datoteku (${ime_baze})"
  mv -- "$privremena" "$lokalna_age"

  hash_lokalni="$(sha256sum -- "$lokalna_age" | awk '{ print $1 }')"
  [[ "$hash_lokalni" =~ ^[0-9a-f]{64}$ ]] || kaladont_umri "Neispravan lokalni SHA-256 (${ime_baze})"
  printf '%s  %s\n' "$hash_lokalni" "${bazno_ime}.age" >"$lokalni_sha"
  velicina_lokalna="$(wc -c <"$lokalna_age" | tr -d ' ')"

  udaljeni_age="${STORAGEBOX_DIR%/}/${bazno_ime}.age"
  udaljeni_sha="${STORAGEBOX_DIR%/}/${bazno_ime}.age.sha256"
  udaljeni_part="${udaljeni_age}.part"

  batch_upload="$(mktemp "${RADNI_DIR}/sftp-upload.XXXXXX")"
  cat >"$batch_upload" <<EOF
put ${lokalna_age} ${udaljeni_part}
rename ${udaljeni_part} ${udaljeni_age}
put ${lokalni_sha} ${udaljeni_sha}
bye
EOF
  kaladont_sftp_batch "$batch_upload" >/dev/null

  provjera_dir="$(mktemp -d "${RADNI_DIR}/verify.XXXXXXXX")"
  batch_get="$(mktemp "${RADNI_DIR}/sftp-get.XXXXXX")"
  cat >"$batch_get" <<EOF
get ${udaljeni_age} ${provjera_dir}/${bazno_ime}.age
get ${udaljeni_sha} ${provjera_dir}/${bazno_ime}.age.sha256
bye
EOF
  kaladont_sftp_batch "$batch_get" >/dev/null

  [[ -f "${provjera_dir}/${bazno_ime}.age" ]] || kaladont_umri "Udaljena .age datoteka nije dohvatljiva (${ime_baze})"
  [[ -f "${provjera_dir}/${bazno_ime}.age.sha256" ]] || kaladont_umri "Udaljeni SHA sidecar nije dohvatljiv (${ime_baze})"

  velicina_udaljena="$(wc -c <"${provjera_dir}/${bazno_ime}.age" | tr -d ' ')"
  [[ "$velicina_udaljena" == "$velicina_lokalna" ]] \
    || kaladont_umri "Udaljena veličina ($velicina_udaljena) != lokalna ($velicina_lokalna) (${ime_baze})"

  hash_udaljeni="$(awk '{ print $1; exit }' "${provjera_dir}/${bazno_ime}.age.sha256")"
  [[ "$hash_udaljeni" == "$hash_lokalni" ]] \
    || kaladont_umri "Udaljeni SHA-256 sidecar ne odgovara lokalnom hashu (${ime_baze})"

  hash_ponovno="$(sha256sum -- "${provjera_dir}/${bazno_ime}.age" | awk '{ print $1 }')"
  [[ "$hash_ponovno" == "$hash_lokalni" ]] \
    || kaladont_umri "Ponovno izračunati SHA-256 udaljene .age ne odgovara (${ime_baze})"

  kaladont_log "Dump OK: ${bazno_ime}.age sha256=${hash_lokalni} bytes=${velicina_lokalna}"
  printf '%s %s\n' "${bazno_ime}.age" "$hash_lokalni"
}

rezultat_igre="$(napravi_dump "$BAZA_IME")"
rezultat_umami=''
if [[ -n "$UMAMI_BAZA_IME" ]]; then
  # Samo siguran identifikator baze (slova/brojevi/_), bez SQL interpolacije.
  if [[ ! "$UMAMI_BAZA_IME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    kaladont_umri "UMAMI_BAZA_IME nije valjan identifikator: ${UMAMI_BAZA_IME}"
  fi
  # Ako baza još nije bootstrapana, ne ruši dnevni/pre-migracijski backup igre.
  if (
    cd "$COMPOSE_PROJECT_DIR"
    docker compose -f "$COMPOSE_DATOTEKA" exec -T "$BAZA_SERVIS" \
      psql -U "$BAZA_KORISNIK" -d postgres -Atc \
      "SELECT 1 FROM pg_database WHERE datname = '${UMAMI_BAZA_IME}'"
  ) 2>/dev/null | grep -qx 1; then
    if (
      cd "$COMPOSE_PROJECT_DIR"
      docker compose -f "$COMPOSE_DATOTEKA" exec -T "$BAZA_SERVIS" \
        pg_isready -U "$BAZA_KORISNIK" -d "$UMAMI_BAZA_IME"
    ) >/dev/null; then
      rezultat_umami="$(napravi_dump "$UMAMI_BAZA_IME")"
    else
      kaladont_log "Upozorenje: UMAMI_BAZA_IME=${UMAMI_BAZA_IME} postoji, ali nije spremna — preskačem Umami dump"
    fi
  else
    kaladont_log "Upozorenje: baza ${UMAMI_BAZA_IME} ne postoji — preskačem Umami dump (bootstrap još nije napravljen)"
  fi
fi

# Retencija (samo nakon uspješne verifikacije svih dumpova).
batch_ls="$(mktemp "${RADNI_DIR}/sftp-ls.XXXXXX")"
cat >"$batch_ls" <<EOF
ls -1 ${STORAGEBOX_DIR}
bye
EOF
popis_datoteka="$(mktemp "${RADNI_DIR}/remote-list.XXXXXX")"
kaladont_sftp_batch "$batch_ls" 2>/dev/null | awk '/\.dump\.age$/ { print $NF }' >"$popis_datoteka" || true

obrisi_udaljeno() {
  local ime="$1"
  local batch_rm
  batch_rm="$(mktemp "${RADNI_DIR}/sftp-rm.XXXXXX")"
  cat >"$batch_rm" <<EOF
rm ${STORAGEBOX_DIR%/}/${ime}
rm ${STORAGEBOX_DIR%/}/${ime}.sha256
bye
EOF
  kaladont_sftp_batch "$batch_rm" >/dev/null 2>&1 || true
  kaladont_log "Retencija: uklonjen ${ime}"
}

je_nedjelja() {
  local f="$1"
  local ime_baze="$2"
  local ts dan
  ts="${f#kaladont_${ime_baze}_}"
  ts="${ts%_pre-migracija.dump.age}"
  ts="${ts%.dump.age}"
  dan="${ts:0:8}"
  [[ "${#dan}" -eq 8 ]] || return 1
  date -u -d "${dan:0:4}-${dan:4:2}-${dan:6:2}" +%w 2>/dev/null | grep -qx 0
}

primijeni_retenciju() {
  local ime_baze="$1"
  local f i ts dan sat granica_epoch file_epoch
  local -a svi_dnevni=()
  local -a tjedni_sidri=()
  local -a pre_mig=()
  local -A zadrzi_tjedni=()

  mapfile -t svi_dnevni < <(grep -E "^kaladont_${ime_baze}_[0-9T]+Z\\.dump\\.age$" "$popis_datoteka" | sort -r || true)
  mapfile -t tjedni_sidri < <(
    for f in "${svi_dnevni[@]+"${svi_dnevni[@]}"}"; do
      [[ -n "$f" ]] || continue
      if je_nedjelja "$f" "$ime_baze"; then
        printf '%s\n' "$f"
      fi
    done
  )
  for ((i = 0; i < ${#tjedni_sidri[@]} && i < RETENCIJA_TJEDNIH; i++)); do
    zadrzi_tjedni["${tjedni_sidri[$i]}"]=1
  done

  for ((i = 0; i < ${#svi_dnevni[@]}; i++)); do
    f="${svi_dnevni[$i]}"
    if (( i < RETENCIJA_DNEVNIH )); then
      continue
    fi
    if [[ -n "${zadrzi_tjedni[$f]-}" ]]; then
      continue
    fi
    obrisi_udaljeno "$f"
  done

  mapfile -t pre_mig < <(grep -E "^kaladont_${ime_baze}_.*_pre-migracija\\.dump\\.age$" "$popis_datoteka" | sort -r || true)
  granica_epoch="$(date -u -d '7 days ago' +%s 2>/dev/null || echo 0)"
  for f in "${pre_mig[@]+"${pre_mig[@]}"}"; do
    [[ -n "$f" ]] || continue
    ts="${f#kaladont_${ime_baze}_}"
    ts="${ts%_pre-migracija.dump.age}"
    dan="${ts:0:8}"
    sat="${ts:9:6}"
    file_epoch="$(date -u -d "${dan:0:4}-${dan:4:2}-${dan:6:2} ${sat:0:2}:${sat:2:2}:${sat:4:2}" +%s 2>/dev/null || echo 0)"
    if (( granica_epoch > 0 && file_epoch > 0 && file_epoch < granica_epoch )); then
      obrisi_udaljeno "$f"
    fi
  done
}

primijeni_retenciju "$BAZA_IME"
if [[ -n "$UMAMI_BAZA_IME" ]]; then
  primijeni_retenciju "$UMAMI_BAZA_IME"
fi

USPJEH=1
kaladont_hc_ping "$HEALTHCHECK_BACKUP_URL"
kaladont_log "Backup OK: ${rezultat_igre}${rezultat_umami:+; ${rezultat_umami}} razlog=${RAZLOG}"
printf '%s\n' "$rezultat_igre"
if [[ -n "$rezultat_umami" ]]; then
  printf '%s\n' "$rezultat_umami"
fi
