#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -ne 3 ]; then
  echo "Upotreba: $0 <image-ref> <digest> <commit-sha>" >&2
  exit 64
fi

slika="$1"
digest="$2"
verzija="$3"
direktorij='/opt/kaladont'
compose_datoteka='docker-compose.staging.yml'
faza='provjera'
prethodni_release=''
snapshot_datoteka=''
privremeni_env=''
kandidat_env=''
env_stvarni_promijenjen='ne'
migracije_pokrenute='ne'

cd "$direktorij"

vrijeme_pocetka=$(date -u +%Y%m%dT%H%M%SZ)
prethodni_release=$(grep -E '^(KALADONT_IMAGE|DIGEST|VERZIJA)=' .env || true)
prethodna_slika=$(docker inspect kaladont-aplikacija-1 --format '{{.Config.Image}}' 2>/dev/null || true)
snapshot_datoteka=".deploy-snapshot-${vrijeme_pocetka}"

zapisi_env() {
  local release_zapis="$1"

  privremeni_env=$(mktemp .env.XXXXXX)
  grep -v -E '^(KALADONT_IMAGE|DIGEST|VERZIJA)=' .env > "$privremeni_env" || true
  if [ -n "$release_zapis" ]; then
    printf '%s\n' "$release_zapis" >> "$privremeni_env"
  fi
  chmod 600 "$privremeni_env"
  mv "$privremeni_env" .env
  privremeni_env=''
}

release_zapis_nove_verzije() {
  printf 'KALADONT_IMAGE=%s\nDIGEST=%s\nVERZIJA=%s' "$slika" "$digest" "$verzija"
}

pripremi_kandidat_env() {
  local release_zapis="$1"

  kandidat_env=$(mktemp .env.kandidat.XXXXXX)
  grep -v -E '^(KALADONT_IMAGE|DIGEST|VERZIJA)=' .env > "$kandidat_env" || true
  if [ -n "$release_zapis" ]; then
    printf '%s\n' "$release_zapis" >> "$kandidat_env"
  fi
  chmod 600 "$kandidat_env"
}

dopisi_stanje_snapshota() {
  if [ -n "$snapshot_datoteka" ] && [ -f "$snapshot_datoteka" ]; then
    {
      printf 'FAZA_GRESKE=%s\n' "$faza"
      printf 'ENV_STVARNI_PROMIJENJEN=%s\n' "$env_stvarni_promijenjen"
      printf 'MIGRACIJE_POKRENUTE=%s\n' "$migracije_pokrenute"
    } >> "$snapshot_datoteka"
  fi
}

vrati_prethodni_env() {
  zapisi_env "$prethodni_release"
  echo "Vracen je prethodni release zapis u .env jer migracije nisu pokrenute."
}

ispisi_dijagnostiku() {
  local izlazni_kod="$1"

  echo '--- Dijagnostika neuspjelog staging deploya ---' >&2
  echo "Faza: $faza" >&2
  echo "Izlazni kod: $izlazni_kod" >&2
  echo "Snapshot: ${snapshot_datoteka:-nije-zapisan}" >&2
  echo "Stvarni .env promijenjen: $env_stvarni_promijenjen" >&2
  echo "Migracije pokrenute: $migracije_pokrenute" >&2
  echo 'Prethodni release zapis:' >&2
  printf '%s\n' "${prethodni_release:-nije-pronaden}" >&2
  echo "Prethodna aktivna slika: ${prethodna_slika:-nije-pronadena}" >&2
  echo 'Trazena nova verzija:' >&2
  printf 'KALADONT_IMAGE=%s\nDIGEST=%s\nVERZIJA=%s\n' "$slika" "$digest" "$verzija" >&2
  echo 'Trenutni release zapis u .env:' >&2
  grep -E '^(KALADONT_IMAGE|DIGEST|VERZIJA)=' .env >&2 || true
  echo 'Trenutna aktivna slika:' >&2
  docker inspect kaladont-aplikacija-1 --format '{{.Config.Image}}' >&2 2>/dev/null || true
  echo 'Docker Compose stanje:' >&2
  docker compose -f "$compose_datoteka" ps >&2 || true
  echo 'Zadnji aplikacijski logovi:' >&2
  docker compose -f "$compose_datoteka" logs --since 10m --tail 200 aplikacija >&2 || true
  echo 'Lokalni health odgovor:' >&2
  docker compose -f "$compose_datoteka" exec -T aplikacija node -e "fetch('http://127.0.0.1:3000/zdravlje').then(async (odgovor) => { console.log(odgovor.status, await odgovor.text()); process.exit(odgovor.ok ? 0 : 1); }).catch((greska) => { console.error(greska.message); process.exit(1); })" >&2 || true
  echo '--- Kraj dijagnostike ---' >&2
}

na_gresku() {
  local izlazni_kod="$1"

  trap - ERR
  rm -f "$privremeni_env" "$kandidat_env"
  dopisi_stanje_snapshota
  ispisi_dijagnostiku "$izlazni_kod"

  case "$faza" in
    provjera|kandidat_env_spreman|slika_povucena)
      vrati_prethodni_env
      ;;
    *)
      echo 'Migracije su pokrenute ili je aplikacija vec mijenjana; automatski rollback slike nije siguran.' >&2
      echo 'Sacuvaj dijagnostiku i odluci o rucnom rollbacku samo ako je nova shema kompatibilna sa starom aplikacijom.' >&2
      ;;
  esac

  exit "$izlazni_kod"
}

trap 'na_gresku $?' ERR
trap 'rm -f "$privremeni_env" "$kandidat_env"' EXIT

{
  printf 'VRIJEME=%s\n' "$vrijeme_pocetka"
  printf 'PRETHODNA_AKTIVNA_SLIKA=%s\n' "${prethodna_slika:-nije-pronadena}"
  printf 'TRAZENA_SLIKA=%s\nTRAZENI_DIGEST=%s\nTRAZENA_VERZIJA=%s\n' "$slika" "$digest" "$verzija"
  printf 'ENV_STVARNI_PROMIJENJEN=%s\n' "$env_stvarni_promijenjen"
  printf 'MIGRACIJE_POKRENUTE=%s\n' "$migracije_pokrenute"
  printf 'PRETHODNI_RELEASE_ZAPIS<<EOF\n%s\nEOF\n' "${prethodni_release:-}"
} > "$snapshot_datoteka"
chmod 600 "$snapshot_datoteka"

novi_release_zapis=$(release_zapis_nove_verzije)
pripremi_kandidat_env "$novi_release_zapis"
faza='kandidat_env_spreman'

docker compose --env-file "$kandidat_env" -f "$compose_datoteka" config >/dev/null
docker compose --env-file "$kandidat_env" -f "$compose_datoteka" pull aplikacija
faza='slika_povucena'
migracije_pokrenute='da'
faza='migracije_pokrenute'
docker compose --env-file "$kandidat_env" -f "$compose_datoteka" run --rm --no-deps aplikacija pnpm migracije
faza='migracije_zavrsene'
zapisi_env "$novi_release_zapis"
env_stvarni_promijenjen='da'
faza='env_azuriran'
docker compose -f "$compose_datoteka" stop aplikacija
docker compose -f "$compose_datoteka" rm -f aplikacija
docker compose -f "$compose_datoteka" up -d --wait --wait-timeout 180 --force-recreate aplikacija
faza='aplikacija_rekreirana'

aktivna_slika=$(docker inspect kaladont-aplikacija-1 --format '{{.Config.Image}}')
test "$aktivna_slika" = "$slika"
docker compose -f "$compose_datoteka" exec -T aplikacija node -e "fetch('http://127.0.0.1:3000/zdravlje').then((odgovor) => process.exit(odgovor.ok ? 0 : 1)).catch(() => process.exit(1))"
faza='health_provjeren'
docker compose -f "$compose_datoteka" exec -T caddy caddy validate --config /etc/caddy/Caddyfile
docker compose -f "$compose_datoteka" exec -T caddy caddy reload --config /etc/caddy/Caddyfile

echo "Staging aplikacija koristi $aktivna_slika"