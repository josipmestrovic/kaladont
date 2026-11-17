#!/usr/bin/env bash
# Određuje je li produkcijska objava izdanje ili tiho ažuriranje (ADR-018).
#
# Upotreba:
#   odredi-izdanje.sh --izdanja <putanja.json> [--oznake <datoteka>] [--danas YYYY-MM-DD] [--samo-izvjestaj]
#
#   --izdanja          izdanja.json s commita koji se promovira
#   --oznake           postojeće Git oznake, jedna po retku; bez nje se smatra da oznaka nema
#   --danas            današnji datum; zadano se računa u zoni Europe/Zagreb
#   --samo-izvjestaj   ništa ne blokira: umjesto izlaza 3 popuni polje „upozorenje”
#
# Stdout: retci kljuc=vrijednost spremni za $GITHUB_OUTPUT. Poruke za čovjeka idu na stderr.
# Izlazni kodovi: 0 = odluka donesena, 2 = neispravni podaci, 3 = promocija nije dopuštena,
# 64 = kriva upotreba.
set -Eeuo pipefail

upotreba() {
  echo "Upotreba: $0 --izdanja <putanja.json> [--oznake <datoteka>] [--danas YYYY-MM-DD] [--samo-izvjestaj]" >&2
  exit 64
}

danasnji_datum() {
  if [ -e /usr/share/zoneinfo/Europe/Zagreb ]; then
    TZ=Europe/Zagreb date +%F
  else
    # Bez baze vremenskih zona (npr. Git Bash na Windowsu) vrijedi isto pravilo u POSIX obliku,
    # da se datum nikad ne računa po UTC-u.
    TZ='CET-1CEST,M3.5.0,M10.5.0/3' date +%F
  fi
}

izdanja=''
oznake=''
danas=''
samo_izvjestaj='ne'

while [ "$#" -gt 0 ]; do
  case "$1" in
    --izdanja)
      [ "$#" -ge 2 ] || upotreba
      izdanja="$2"
      shift 2
      ;;
    --oznake)
      [ "$#" -ge 2 ] || upotreba
      oznake="$2"
      shift 2
      ;;
    --danas)
      [ "$#" -ge 2 ] || upotreba
      danas="$2"
      shift 2
      ;;
    --samo-izvjestaj)
      samo_izvjestaj='da'
      shift
      ;;
    *)
      upotreba
      ;;
  esac
done

[ -n "$izdanja" ] || upotreba

if [ -z "$danas" ]; then
  danas="$(danasnji_datum)"
fi
if ! [[ "$danas" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Neispravan današnji datum „${danas}”: očekivan je oblik YYYY-MM-DD." >&2
  exit 64
fi

if [ ! -f "$izdanja" ]; then
  printf '%s\n' \
    'vrsta=tiho' \
    'oznaka=' \
    'datum=' \
    'sidro=' \
    'naslov_releasea=' \
    'nacrta=0' \
    'razlog=Datoteka izdanja ne postoji na ovom commitu (slika je starija od sustava izdanja).' \
    'upozorenje='
  exit 0
fi

if [ -n "$oznake" ] && [ ! -f "$oznake" ]; then
  echo "Datoteka s oznakama ne postoji: ${oznake}" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo 'Nedostaje alat jq.' >&2
  exit 2
fi

biblioteka="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -n "$oznake" ]; then
  argumenti_oznaka=(--rawfile oznake "$oznake")
else
  argumenti_oznaka=(--arg oznake '')
fi

# tr uklanja CR koji jq.exe dodaje na Windowsu; na Linuxu ne mijenja ništa.
if ! rezultat="$(
  jq -r -L "$biblioteka" \
    --arg danas "$danas" \
    --arg samo_izvjestaj "$samo_izvjestaj" \
    "${argumenti_oznaka[@]}" \
    'include "izdanja"; odluci($danas; $oznake; $samo_izvjestaj)' \
    "$izdanja" | tr -d '\r'
)"; then
  echo "Podaci izdanja nisu ispravni: ${izdanja}" >&2
  exit 2
fi

kod=''
while IFS= read -r redak; do
  case "$redak" in
    izlaz:*) printf '%s\n' "${redak#izlaz:}" ;;
    poruka:*) printf '%s\n' "${redak#poruka:}" >&2 ;;
    kod:*) kod="${redak#kod:}" ;;
  esac
done <<<"$rezultat"

if ! [[ "$kod" =~ ^[0-9]+$ ]]; then
  echo 'Odluka o izdanju nije donesena: neočekivan izlaz jq programa.' >&2
  exit 2
fi

exit "$kod"
