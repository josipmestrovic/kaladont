#!/usr/bin/env bash
# Izolirani restore drill u privremenu Postgres instancu (nije živa produkcija).
set -Eeuo pipefail
umask 077

SKRIPTA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/zajednicko.sh
source "${SKRIPTA_DIR}/lib/zajednicko.sh"

AGE_DATOTEKA=''
OCEKIVANI_SHA=''
IDENTITY=''
CILJ_IME=''
PG_SLIKA="${KALADONT_RESTORE_PG_SLIKA:-postgres:16.15-alpine}"
cid=''
ram_dir=''

upotreba() {
  cat >&2 <<'EOF'
Upotreba:
  kaladont-restore-drill.sh \
    --age=/putanja/kopija.dump.age \
    --sha256=<64 hex> \
    --identity=/dev/shm/.../identity \
    --cilj-ime=kaladont_drill_<oznaka>

Odbija žive nazive (kaladont_prod, kaladont_staging kao cilj, postgres_prod_podaci, …).
EOF
}

zabranjen_cilj() {
  local ime="$1"
  case "$ime" in
    kaladont_prod|kaladont_staging|postgres|kaladont)
      return 0
      ;;
  esac
  if [[ "$ime" == *prod* && "$ime" != kaladont_drill_* ]]; then
    return 0
  fi
  if [[ "$ime" != kaladont_drill_* ]]; then
    return 0
  fi
  return 1
}

# Izvoz radi testova (source + poziv).
kaladont_restore_zabranjen_cilj() {
  zabranjen_cilj "$1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --age=*)
      AGE_DATOTEKA="${1#--age=}"
      shift
      ;;
    --sha256=*)
      OCEKIVANI_SHA="${1#--sha256=}"
      shift
      ;;
    --identity=*)
      IDENTITY="${1#--identity=}"
      shift
      ;;
    --cilj-ime=*)
      CILJ_IME="${1#--cilj-ime=}"
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

[[ -n "$AGE_DATOTEKA" && -n "$OCEKIVANI_SHA" && -n "$IDENTITY" && -n "$CILJ_IME" ]] \
  || { upotreba; kaladont_umri 'Svi argumenti --age --sha256 --identity --cilj-ime su obvezni'; }

if zabranjen_cilj "$CILJ_IME"; then
  kaladont_umri "Cilj '$CILJ_IME' je zabranjen. Koristi eksplicitno kaladont_drill_…"
fi

[[ -f "$AGE_DATOTEKA" ]] || kaladont_umri "AGE datoteka ne postoji: $AGE_DATOTEKA"
[[ -f "$IDENTITY" ]] || kaladont_umri "Identity datoteka ne postoji: $IDENTITY"
[[ "$OCEKIVANI_SHA" =~ ^[0-9a-fA-F]{64}$ ]] || kaladont_umri 'Očekivani SHA mora biti 64 hex znaka'

kaladont_zahtijevaj_naredbu age
kaladont_zahtijevaj_naredbu docker
kaladont_zahtijevaj_naredbu sha256sum
kaladont_zahtijevaj_naredbu openssl

printf '%s  %s\n' "$OCEKIVANI_SHA" "$AGE_DATOTEKA" | sha256sum --check --status \
  || kaladont_umri 'SHA-256 datoteke ne odgovara očekivanom'

pocisti() {
  if [[ -n "$cid" ]]; then
    docker stop "$cid" >/dev/null 2>&1 || true
  fi
  if [[ -n "$ram_dir" && -d "$ram_dir" ]]; then
    rm -f -- "${ram_dir}/identity" "${ram_dir}/identity~" 2>/dev/null || true
    rmdir -- "$ram_dir" 2>/dev/null || true
  fi
}
trap pocisti EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

POSTGRES_PASSWORD="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD

cid="$(docker run -d --rm --network none \
  -e POSTGRES_PASSWORD \
  -e "POSTGRES_DB=${CILJ_IME}" \
  "$PG_SLIKA")"

for _ in $(seq 1 60); do
  if docker exec "$cid" pg_isready -h 127.0.0.1 -U postgres -d "$CILJ_IME" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "$cid" pg_isready -h 127.0.0.1 -U postgres -d "$CILJ_IME" >/dev/null

age -d -i "$IDENTITY" "$AGE_DATOTEKA" | docker exec -i "$cid" \
  pg_restore --exit-on-error --no-owner --no-acl -U postgres -d "$CILJ_IME"

docker exec "$cid" psql -v ON_ERROR_STOP=1 -U postgres -d "$CILJ_IME" -c \
  "SELECT
     (SELECT count(*) FROM rijeci) AS rijeci,
     (SELECT count(*) FROM igraci) AS igraci,
     (SELECT count(*) FROM partije) AS partije,
     (SELECT count(*) FROM potezi) AS potezi;"

kaladont_log "Restore drill OK za cilj=${CILJ_IME}"
