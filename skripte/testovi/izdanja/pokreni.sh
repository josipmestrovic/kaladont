#!/usr/bin/env bash
# Lokalni / CI testovi skripti izdanja (bez mreže i bez GitHuba).
set -Eeuo pipefail

KORIJEN="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ODREDI="${KORIJEN}/skripte/izdanja/odredi-izdanje.sh"
BILJESKE="${KORIJEN}/skripte/izdanja/biljeske-izdanja.sh"
STVARNA_IZDANJA="${KORIJEN}/aplikacije/web/src/lib/izdanja.json"
POSIX_ZONA='CET-1CEST,M3.5.0,M10.5.0/3'
PAD=0
KOD=0

prolaz() {
  printf 'OK   %s\n' "$*"
}

pad() {
  printf 'FAIL %s\n' "$*" >&2
  PAD=1
}

preskoceno() {
  printf 'SKIP %s\n' "$*"
}

if ! command -v jq >/dev/null 2>&1; then
  echo 'Testovi skripti izdanja traže alat jq.' >&2
  exit 1
fi

RADNI="$(mktemp -d)"
trap 'rm -rf "$RADNI"' EXIT

# Pokreće odredi-izdanje.sh: stdout ide u $RADNI/izlaz, stderr u $RADNI/greske, izlazni kod u KOD.
odredi() {
  set +e
  bash "$ODREDI" "$@" >"$RADNI/izlaz" 2>"$RADNI/greske"
  KOD=$?
  set -e
}

biljeske() {
  set +e
  bash "$BILJESKE" "$@" >"$RADNI/izlaz" 2>"$RADNI/greske"
  KOD=$?
  set -e
}

vrijednost() {
  sed -n "s/^$1=//p" "$RADNI/izlaz"
}

# provjeri <opis> <očekivani izlazni kod> [kljuc=vrijednost ...]
provjeri() {
  local opis="$1" ocekivani_kod="$2" par kljuc ocekivano stvarno uspjeh=da
  shift 2
  if [ "$KOD" -ne "$ocekivani_kod" ]; then
    uspjeh=ne
    printf '     izlazni kod: očekivan %s, dobiven %s\n' "$ocekivani_kod" "$KOD" >&2
  fi
  for par in "$@"; do
    kljuc="${par%%=*}"
    ocekivano="${par#*=}"
    stvarno="$(vrijednost "$kljuc")"
    if [ "$stvarno" != "$ocekivano" ]; then
      uspjeh=ne
      printf '     %s: očekivano „%s”, dobiveno „%s”\n' "$kljuc" "$ocekivano" "$stvarno" >&2
    fi
  done
  if [ "$uspjeh" = da ]; then
    prolaz "$opis"
  else
    pad "$opis"
    sed 's/^/     stderr: /' "$RADNI/greske" >&2 || true
  fi
}

# poruka_sadrzi <opis> <tekst koji stderr mora sadržavati>
poruka_sadrzi() {
  if grep -F -q -- "$2" "$RADNI/greske"; then
    prolaz "$1"
  else
    pad "$1 (stderr ne sadrži „$2”)"
    sed 's/^/     stderr: /' "$RADNI/greske" >&2 || true
  fi
}

echo '=== bash -n ==='
for skripta in "$ODREDI" "$BILJESKE" "${KORIJEN}/skripte/testovi/izdanja/pokreni.sh"; do
  if bash -n "$skripta"; then
    prolaz "bash -n $(basename "$skripta")"
  else
    pad "bash -n $skripta"
  fi
done

# --- podaci za testove ---

cat >"$RADNI/nacrti.json" <<'JSON'
[
  {"objavljeno": null, "naslov": "Prvi nacrt", "stavke": ["A"]},
  {"objavljeno": null, "naslov": "Drugi nacrt", "stavke": ["B"]}
]
JSON

# Namjerno stariji zapis prvi: redoslijed u datoteci ne smije utjecati na odluku.
cat >"$RADNI/dva.json" <<'JSON'
[
  {"objavljeno": "2026-11-14", "naslov": "Prvo izdanje", "stavke": ["B"]},
  {"objavljeno": "2026-11-23", "naslov": "Novo izdanje", "stavke": ["A"]}
]
JSON

cat >"$RADNI/s-nacrtom.json" <<'JSON'
[
  {"objavljeno": null, "naslov": "Nacrt", "stavke": ["A"]},
  {"objavljeno": "2026-11-14", "naslov": "Prvo izdanje", "stavke": ["B"]}
]
JSON

cat >"$RADNI/isti-dan.json" <<'JSON'
[
  {"objavljeno": "2026-11-23", "nastavak": 1, "naslov": "Popodnevno izdanje", "stavke": ["Šesta „stavka” — s navodnicima", "Sedma stavka"]},
  {"objavljeno": "2026-11-23", "naslov": "Jutarnje izdanje", "stavke": ["A"]},
  {"objavljeno": "2026-11-14", "naslov": "Prvo izdanje", "stavke": ["B"]}
]
JSON

cat >"$RADNI/jedno.json" <<'JSON'
[{"objavljeno": "2026-11-23", "naslov": "Novo izdanje", "stavke": ["A"]}]
JSON

cat >"$RADNI/prosinac.json" <<'JSON'
[{"objavljeno": "2026-12-05", "naslov": "Zimsko izdanje", "stavke": ["A"]}]
JSON

printf 'v2026.11.14\nv2026.11.23\n' >"$RADNI/oznake-sve"
printf 'v0.1.0-closed-alpha.1\nv2026.11.14\n' >"$RADNI/oznake-starije"
printf 'v2026.11.14\nv2026.11.23\n' >"$RADNI/oznake-jutro"
printf 'v2026.11.23.1\nxv2026.11.23\nv2026.11.2\n' >"$RADNI/oznake-slicne"
printf 'v2026.11.23\r\n' >"$RADNI/oznake-crlf"

echo '=== tiho ažuriranje ==='
odredi --izdanja "$RADNI/nema-datoteke.json" --danas 2026-11-23
provjeri 'slika bez izdanja.json' 0 vrsta=tiho oznaka= datum= sidro= naslov_releasea= nacrta=0 upozorenje=

odredi --izdanja "$RADNI/nacrti.json" --danas 2026-11-23
provjeri 'samo nacrti' 0 vrsta=tiho oznaka= datum= sidro= nacrta=2 upozorenje=

odredi --izdanja "$RADNI/dva.json" --oznake "$RADNI/oznake-sve" --danas 2026-12-01
provjeri 'najnovije izdanje već ima oznaku' 0 vrsta=tiho oznaka=v2026.11.23 datum=2026-11-23 nacrta=0 upozorenje=

odredi --izdanja "$RADNI/s-nacrtom.json" --oznake "$RADNI/oznake-starije" --danas 2026-11-20
provjeri 'tiho ažuriranje uz postojeći nacrt' 0 vrsta=tiho oznaka=v2026.11.14 nacrta=1 upozorenje=

odredi --izdanja "$RADNI/jedno.json" --oznake "$RADNI/oznake-crlf" --danas 2026-12-01
provjeri 'oznake s CRLF završecima' 0 vrsta=tiho oznaka=v2026.11.23

echo '=== izdanje ==='
odredi --izdanja "$RADNI/dva.json" --oznake "$RADNI/oznake-starije" --danas 2026-11-23
provjeri 'novo izdanje s današnjim datumom' 0 \
  vrsta=izdanje oznaka=v2026.11.23 datum=2026-11-23 sidro=izdanje-2026-11-23 \
  'naslov_releasea=Kaladont | 23. 11. 2026.' nacrta=0 upozorenje=

odredi --izdanja "$RADNI/isti-dan.json" --oznake "$RADNI/oznake-jutro" --danas 2026-11-23
provjeri 'drugo izdanje istoga dana' 0 \
  vrsta=izdanje oznaka=v2026.11.23.1 datum=2026-11-23 sidro=izdanje-2026-11-23-1 \
  'naslov_releasea=Kaladont | 23. 11. 2026. (2)' upozorenje=

odredi --izdanja "$RADNI/prosinac.json" --danas 2026-12-05
provjeri 'bez --oznake nema oznaka; datum u naslovu bez vodećih nula' 0 \
  vrsta=izdanje oznaka=v2026.12.05 sidro=izdanje-2026-12-05 'naslov_releasea=Kaladont | 5. 12. 2026.'

odredi --izdanja "$RADNI/jedno.json" --oznake "$RADNI/oznake-slicne" --danas 2026-11-23
provjeri 'oznaka se uspoređuje kao cijeli redak' 0 vrsta=izdanje oznaka=v2026.11.23 upozorenje=

echo '=== čuvar datuma ==='
odredi --izdanja "$RADNI/dva.json" --oznake "$RADNI/oznake-starije" --danas 2026-11-24
provjeri 'jučerašnji datum blokira promociju' 3 vrsta=izdanje oznaka=v2026.11.23 \
  'upozorenje=Izdanje 2026-11-23 nema oznaku v2026.11.23, a danas je 2026-11-24.'
poruka_sadrzi 'poruka objašnjava popravak datuma' 'upiši današnji datum'

odredi --izdanja "$RADNI/dva.json" --oznake "$RADNI/oznake-starije" --danas 2026-11-22
provjeri 'budući datum blokira promociju' 3 vrsta=izdanje oznaka=v2026.11.23

odredi --izdanja "$RADNI/dva.json" --danas 2026-11-23
provjeri 'starije izdanje bez oznake blokira novije' 3 vrsta=izdanje oznaka=v2026.11.23
poruka_sadrzi 'poruka imenuje oznaku koja nedostaje' 'v2026.11.14'

odredi --izdanja "$RADNI/prosinac.json" --danas 2026-12-06
provjeri 'bez --oznake datum koji nije današnji blokira' 3 vrsta=izdanje oznaka=v2026.12.05

echo '=== samo izvještaj ==='
odredi --izdanja "$RADNI/dva.json" --oznake "$RADNI/oznake-starije" --danas 2026-11-24 --samo-izvjestaj
provjeri 'krivi datum u izvještaju ne blokira' 0 vrsta=izdanje oznaka=v2026.11.23 \
  'upozorenje=Izdanje 2026-11-23 nema oznaku v2026.11.23, a danas je 2026-11-24.'

odredi --izdanja "$RADNI/dva.json" --danas 2026-11-23 --samo-izvjestaj
provjeri 'starije izdanje bez oznake u izvještaju ne blokira' 0 vrsta=izdanje \
  'upozorenje=Starije izdanje nema oznaku (v2026.11.14), a izdanje 2026-11-23 čeka objavu.'

echo '=== neispravni podaci ==='
neispravno() {
  local opis="$1" sadrzaj="$2"
  printf '%s\n' "$sadrzaj" >"$RADNI/neispravno.json"
  odredi --izdanja "$RADNI/neispravno.json" --danas 2026-11-23
  provjeri "$opis" 2
  if [ -s "$RADNI/izlaz" ]; then
    pad "$opis: stdout mora ostati prazan"
  fi
}
neispravno 'nedovršen JSON' '[{'
neispravno 'vrh nije polje' '{"objavljeno": "2026-11-23"}'
neispravno 'zapis nije objekt' '["2026-11-23"]'
neispravno 'nepostojeći datum' '[{"objavljeno": "2026-02-30", "naslov": "N", "stavke": ["A"]}]'
neispravno 'krivi oblik datuma' '[{"objavljeno": "23. 11. 2026.", "naslov": "N", "stavke": ["A"]}]'
neispravno 'datum kao broj' '[{"objavljeno": 20261123, "naslov": "N", "stavke": ["A"]}]'
neispravno 'nastavak nula' '[{"objavljeno": "2026-11-23", "nastavak": 0, "naslov": "N", "stavke": ["A"]}]'
neispravno 'nastavak kao tekst' '[{"objavljeno": "2026-11-23", "nastavak": "1", "naslov": "N", "stavke": ["A"]}]'
neispravno 'dvostruki datum' '[{"objavljeno": "2026-11-23", "naslov": "N", "stavke": ["A"]}, {"objavljeno": "2026-11-23", "naslov": "M", "stavke": ["B"]}]'

echo '=== upotreba ==='
odredi --nepoznato
provjeri 'nepoznata opcija' 64
odredi --danas 2026-11-23
provjeri 'bez --izdanja' 64
odredi --izdanja "$RADNI/jedno.json" --danas 23.11.2026
provjeri 'krivi oblik --danas' 64
odredi --izdanja "$RADNI/jedno.json" --oznake "$RADNI/nema-oznaka.txt" --danas 2026-11-23
provjeri 'nepostojeća datoteka s oznakama' 2

echo '=== zadani datum ==='
prije="$(TZ="$POSIX_ZONA" date +%F)"
printf '[{"objavljeno": "%s", "naslov": "Danas", "stavke": ["A"]}]\n' "$prije" >"$RADNI/danas.json"
odredi --izdanja "$RADNI/danas.json"
poslije="$(TZ="$POSIX_ZONA" date +%F)"
if [ "$prije" != "$poslije" ]; then
  preskoceno 'zadani datum (ponoć tijekom testa)'
else
  provjeri 'bez --danas vrijedi današnji datum u zoni Europe/Zagreb' 0 vrsta=izdanje "datum=${prije}" upozorenje=
fi

if [ -e /usr/share/zoneinfo/Europe/Zagreb ]; then
  if [ "$(TZ=Europe/Zagreb date +%z)" = "$(TZ="$POSIX_ZONA" date +%z)" ]; then
    prolaz 'pričuvno POSIX pravilo odgovara zoni Europe/Zagreb'
  else
    pad 'pričuvno POSIX pravilo u odredi-izdanje.sh više ne odgovara zoni Europe/Zagreb'
  fi
else
  preskoceno 'usporedba s bazom vremenskih zona (baza nije dostupna)'
fi

echo '=== bilješke ==='
biljeske --izdanja "$RADNI/isti-dan.json" --oznaka v2026.11.23.1
cat >"$RADNI/ocekivane-biljeske" <<'TEKST'
**Popodnevno izdanje**

- Šesta „stavka” — s navodnicima
- Sedma stavka

Javni zapis: https://kaladont.hr/novosti#izdanje-2026-11-23-1
TEKST
if [ "$KOD" -eq 0 ] && cmp -s "$RADNI/izlaz" "$RADNI/ocekivane-biljeske"; then
  prolaz 'bilješke sadrže naslov, sve stavke i poveznicu'
else
  pad "bilješke nisu očekivane (kod=${KOD})"
  sed 's/^/     stdout: /' "$RADNI/izlaz" >&2 || true
  sed 's/^/     stderr: /' "$RADNI/greske" >&2 || true
fi

biljeske --izdanja "$RADNI/isti-dan.json" --oznaka v2026.11.24
provjeri 'bilješke za nepoznatu oznaku' 2
biljeske --izdanja "$RADNI/s-nacrtom.json" --oznaka v
provjeri 'nacrt nema bilješke' 2
biljeske --izdanja "$RADNI/nema-datoteke.json" --oznaka v2026.11.23
provjeri 'bilješke bez datoteke izdanja' 2
biljeske --izdanja "$RADNI/isti-dan.json"
provjeri 'bilješke bez --oznaka' 64

echo '=== stvarni izdanja.json ==='
odredi --izdanja "$STVARNA_IZDANJA" --samo-izvjestaj
provjeri 'stvarni podaci su čitljivi' 0
stvarna_oznaka="$(vrijednost oznaka)"
if [ -n "$stvarna_oznaka" ]; then
  biljeske --izdanja "$STVARNA_IZDANJA" --oznaka "$stvarna_oznaka"
  if [ "$KOD" -eq 0 ] && grep -F -q 'Javni zapis: https://kaladont.hr/novosti#izdanje-' "$RADNI/izlaz"; then
    prolaz "bilješke najnovijeg stvarnog izdanja (${stvarna_oznaka})"
  else
    pad "bilješke najnovijeg stvarnog izdanja (${stvarna_oznaka}, kod=${KOD})"
    sed 's/^/     stderr: /' "$RADNI/greske" >&2 || true
  fi
else
  preskoceno 'bilješke stvarnog izdanja (nema datiranih zapisa)'
fi

if [ "$PAD" -ne 0 ]; then
  echo 'Testovi skripti izdanja: IMA PADOVA' >&2
  exit 1
fi
echo 'Testovi skripti izdanja: SVI PROŠLI'
