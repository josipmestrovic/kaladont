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

cd "$direktorij"

privremeni_env=$(mktemp .env.XXXXXX)
trap 'rm -f "$privremeni_env"' EXIT
grep -v -E '^(KALADONT_IMAGE|DIGEST|VERZIJA)=' .env > "$privremeni_env" || true
printf 'KALADONT_IMAGE=%s\nDIGEST=%s\nVERZIJA=%s\n' "$slika" "$digest" "$verzija" >> "$privremeni_env"
chmod 600 "$privremeni_env"
mv "$privremeni_env" .env
trap - EXIT

docker compose -f docker-compose.staging.yml config >/dev/null
docker compose -f docker-compose.staging.yml pull aplikacija
docker compose -f docker-compose.staging.yml run --rm --no-deps aplikacija pnpm migracije
docker compose -f docker-compose.staging.yml stop aplikacija
docker compose -f docker-compose.staging.yml rm -f aplikacija
docker compose -f docker-compose.staging.yml up -d --wait --wait-timeout 180 --force-recreate aplikacija

aktivna_slika=$(docker inspect kaladont-aplikacija-1 --format '{{.Config.Image}}')
test "$aktivna_slika" = "$slika"
docker compose -f docker-compose.staging.yml exec -T aplikacija node -e "fetch('http://127.0.0.1:3000/zdravlje').then((odgovor) => process.exit(odgovor.ok ? 0 : 1)).catch(() => process.exit(1))"
docker compose -f docker-compose.staging.yml exec -T caddy caddy validate --config /etc/caddy/Caddyfile
docker compose -f docker-compose.staging.yml exec -T caddy caddy reload --config /etc/caddy/Caddyfile

echo "Staging aplikacija koristi $aktivna_slika"