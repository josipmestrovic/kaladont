#!/usr/bin/env bash
# Dnevni / pre-migracijski šifrirani pg_dump → Storage Box.
# Ugovor: exit 0 samo nakon udaljene veličine + SHA-256 sidecar provjere.
set -Eeuo pipefail
umask 077

SKRIPTA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/zajednicko.sh
source "${SKRIPTA_DIR}/lib/zajednicko.sh"

BACKUP_ENV="${KALADONT_BACKUP_ENV:-/etc/kaladont/backup.env}"
RAZLOG='dnevni'
HC_POSLAN_FAIL=0
RADNI_DIR=''
LOKALNA_AGE=''
LOKALNI_SHA=''
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
bazno_ime="kaladont_${BAZA_IME}_${utc_ts}${sufiks}.dump"
LOKALNA_AGE="${RADNI_DIR}/${bazno_ime}.age"
LOKALNI_SHA="${RADNI_DIR}/${bazno_ime}.age.sha256"
privremena="${LOKALNA_AGE}.part"

kaladont_log "Backup počinje (razlog=${RAZLOG}, baza=${BAZA_IME}, artefakt=${bazno_ime}.age)"

(
  cd "$COMPOSE_PROJECT_DIR"
  docker compose -f "$COMPOSE_DATOTEKA" exec -T "$BAZA_SERVIS" \
    pg_dump -U "$BAZA_KORISNIK" -d "$BAZA_IME" -Fc
) | age -r "$AGE_RECIPIENT" -o "$privremena"

[[ -s "$privremena" ]] || kaladont_umri 'pg_dump|age nije proizveo datoteku'
mv -- "$privremena" "$LOKALNA_AGE"

hash_lokalni="$(sha256sum -- "$LOKALNA_AGE" | awk '{ print $1 }')"
[[ "$hash_lokalni" =~ ^[0-9a-f]{64}$ ]] || kaladont_umri 'Neispravan lokalni SHA-256'
printf '%s  %s\n' "$hash_lokalni" "${bazno_ime}.age" >"$LOKALNI_SHA"
velicina_lokalna="$(wc -c <"$LOKALNA_AGE" | tr -d ' ')"

udaljeni_age="${STORAGEBOX_DIR%/}/${bazno_ime}.age"
udaljeni_sha="${STORAGEBOX_DIR%/}/${bazno_ime}.age.sha256"
udaljeni_part="${udaljeni_age}.part"

batch_upload="$(mktemp "${RADNI_DIR}/sftp-upload.XXXXXX")"
cat >"$batch_upload" <<EOF
mkdir ${STORAGEBOX_DIR}
put ${LOKALNA_AGE} ${udaljeni_part}
rename ${udaljeni_part} ${udaljeni_age}
put ${LOKALNI_SHA} ${udaljeni_sha}
bye
EOF

# mkdir smije pasti ako direktorij već postoji — zato ne -b strogo na cijeli batch
# u jednom pokušaju; prvo osiguraj dir, zatim upload.
batch_mkdir="$(mktemp "${RADNI_DIR}/sftp-mkdir.XXXXXX")"
cat >"$batch_mkdir" <<EOF
mkdir ${STORAGEBOX_DIR}
bye
EOF
kaladont_sftp_batch "$batch_mkdir" >/dev/null 2>&1 || true

kaladont_sftp_batch "$batch_upload" >/dev/null

# Udaljena veličina: preuzmi u privremeni dir i usporedi.
provjera_dir="$(mktemp -d "${RADNI_DIR}/verify.XXXXXXXX")"
batch_get="$(mktemp "${RADNI_DIR}/sftp-get.XXXXXX")"
cat >"$batch_get" <<EOF
get ${udaljeni_age} ${provjera_dir}/${bazno_ime}.age
get ${udaljeni_sha} ${provjera_dir}/${bazno_ime}.age.sha256
bye
EOF
kaladont_sftp_batch "$batch_get" >/dev/null

[[ -f "${provjera_dir}/${bazno_ime}.age" ]] || kaladont_umri 'Udaljena .age datoteka nije dohvatljiva'
[[ -f "${provjera_dir}/${bazno_ime}.age.sha256" ]] || kaladont_umri 'Udaljeni SHA sidecar nije dohvatljiv'

velicina_udaljena="$(wc -c <"${provjera_dir}/${bazno_ime}.age" | tr -d ' ')"
[[ "$velicina_udaljena" == "$velicina_lokalna" ]] \
  || kaladont_umri "Udaljena veličina ($velicina_udaljena) != lokalna ($velicina_lokalna)"

hash_udaljeni="$(awk '{ print $1; exit }' "${provjera_dir}/${bazno_ime}.age.sha256")"
[[ "$hash_udaljeni" == "$hash_lokalni" ]] \
  || kaladont_umri 'Udaljeni SHA-256 sidecar ne odgovara lokalnom hashu'

hash_ponovno="$(sha256sum -- "${provjera_dir}/${bazno_ime}.age" | awk '{ print $1 }')"
[[ "$hash_ponovno" == "$hash_lokalni" ]] \
  || kaladont_umri 'Ponovno izračunati SHA-256 udaljene .age ne odgovara'

# Retencija (samo nakon uspješne verifikacije).
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
  local ts dan
  ts="${f#kaladont_${BAZA_IME}_}"
  ts="${ts%_pre-migracija.dump.age}"
  ts="${ts%.dump.age}"
  dan="${ts:0:8}"
  [[ "${#dan}" -eq 8 ]] || return 1
  date -u -d "${dan:0:4}-${dan:4:2}-${dan:6:2}" +%w 2>/dev/null | grep -qx 0
}

# Tjedni sidri (nedjeljni dnevni dumpovi): zadrži RETENCIJA_TJEDNIH najnovijih.
mapfile -t svi_dnevni < <(grep -E "^kaladont_${BAZA_IME}_[0-9T]+Z\\.dump\\.age$" "$popis_datoteka" | sort -r || true)
mapfile -t tjedni_sidri < <(
  for f in "${svi_dnevni[@]+"${svi_dnevni[@]}"}"; do
    [[ -n "$f" ]] || continue
    if je_nedjelja "$f"; then
      printf '%s\n' "$f"
    fi
  done
)
declare -A zadrzi_tjedni=()
for ((i = 0; i < ${#tjedni_sidri[@]} && i < RETENCIJA_TJEDNIH; i++)); do
  zadrzi_tjedni["${tjedni_sidri[$i]}"]=1
done

# Dnevni: zadrži RETENCIJA_DNEVNIH najnovijih + zaštićene tjedne sidre.
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

# Tjedni sidri stariji od RETENCIJA_TJEDNIH (i izvan dnevnog prozora) — već obrađeni gore
# jer nisu u zadrzi_tjedni i nisu u top RETENCIJA_DNEVNIH.

# pre-migracija: zadrži one mlađe od 7 dana; starije obriši.
mapfile -t pre_mig < <(grep -E '_pre-migracija\.dump\.age$' "$popis_datoteka" | sort -r || true)
granica_epoch="$(date -u -d '7 days ago' +%s 2>/dev/null || echo 0)"
for f in "${pre_mig[@]+"${pre_mig[@]}"}"; do
  [[ -n "$f" ]] || continue
  ts="${f#kaladont_${BAZA_IME}_}"
  ts="${ts%_pre-migracija.dump.age}"
  dan="${ts:0:8}"
  sat="${ts:9:6}"
  file_epoch="$(date -u -d "${dan:0:4}-${dan:4:2}-${dan:6:2} ${sat:0:2}:${sat:2:2}:${sat:4:2}" +%s 2>/dev/null || echo 0)"
  if (( granica_epoch > 0 && file_epoch > 0 && file_epoch < granica_epoch )); then
    obrisi_udaljeno "$f"
  fi
done

USPJEH=1
kaladont_hc_ping "$HEALTHCHECK_BACKUP_URL"
kaladont_log "Backup OK: ${bazno_ime}.age sha256=${hash_lokalni} bytes=${velicina_lokalna} razlog=${RAZLOG}"
printf '%s\n' "${bazno_ime}.age ${hash_lokalni}"
