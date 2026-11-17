#!/usr/bin/env bash
# Ispisuje Markdown tijelo GitHub Releasea za zadanu oznaku izdanja (ADR-018).
#
# Upotreba:
#   biljeske-izdanja.sh --izdanja <putanja.json> --oznaka <vYYYY.MM.DD[.N]>
#
# Izlazni kodovi: 0 = bilješke ispisane, 2 = neispravni podaci ili nepoznata oznaka,
# 64 = kriva upotreba.
set -Eeuo pipefail

JAVNA_ADRESA='https://kaladont.hr'

upotreba() {
  echo "Upotreba: $0 --izdanja <putanja.json> --oznaka <vYYYY.MM.DD[.N]>" >&2
  exit 64
}

izdanja=''
oznaka=''

while [ "$#" -gt 0 ]; do
  case "$1" in
    --izdanja)
      [ "$#" -ge 2 ] || upotreba
      izdanja="$2"
      shift 2
      ;;
    --oznaka)
      [ "$#" -ge 2 ] || upotreba
      oznaka="$2"
      shift 2
      ;;
    *)
      upotreba
      ;;
  esac
done

[ -n "$izdanja" ] || upotreba
[ -n "$oznaka" ] || upotreba

if [ ! -f "$izdanja" ]; then
  echo "Datoteka izdanja ne postoji: ${izdanja}" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo 'Nedostaje alat jq.' >&2
  exit 2
fi

biblioteka="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# tr uklanja CR koji jq.exe dodaje na Windowsu; na Linuxu ne mijenja ništa.
if ! biljeske="$(
  jq -r -L "$biblioteka" \
    --arg oznaka "$oznaka" \
    --arg adresa "$JAVNA_ADRESA" \
    'include "izdanja"; biljeske($oznaka; $adresa)' \
    "$izdanja" | tr -d '\r'
)"; then
  echo "Bilješke za oznaku ${oznaka} nisu sastavljene." >&2
  exit 2
fi

printf '%s\n' "$biljeske"
