#!/usr/bin/env bash
# Jednokratni bootstrap Postgres uloge i baze za Umami na produkcijskom Compose Postgresu.
# Pokrenuti na prod VPS-u PRIJE prvog `docker compose up` Umami servisa (ili dok baza već radi).
# Staging nema Umami. Ne mijenja igračku bazu. Ponovno pokretanje je idempotentno.
# Vodič: docs/07-operacije/runbook-umami.md
set -Eeuo pipefail

upotreba() {
  cat >&2 <<'EOF'
Upotreba: bootstrap-umami-bazu.sh --compose-dir=DIR --compose-datoteka=FILE --baza-servis=baza

Čita UMAMI_BAZA_LOZINKA iz okoline (ili /etc/kaladont/*.env koji si već sourceao).
Koristi superkorisnika Postgresa iz Composea (kaladont) za CREATE ROLE/DATABASE.
EOF
}

COMPOSE_DIR=''
COMPOSE_DATOTEKA=''
BAZA_SERVIS='baza'

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compose-dir=*)
      COMPOSE_DIR="${1#--compose-dir=}"
      shift
      ;;
    --compose-datoteka=*)
      COMPOSE_DATOTEKA="${1#--compose-datoteka=}"
      shift
      ;;
    --baza-servis=*)
      BAZA_SERVIS="${1#--baza-servis=}"
      shift
      ;;
    -h|--help)
      upotreba
      exit 0
      ;;
    *)
      upotreba
      echo "Nepoznat argument: $1" >&2
      exit 2
      ;;
  esac
done

[[ -n "$COMPOSE_DIR" ]] || { echo 'Nedostaje --compose-dir' >&2; exit 2; }
[[ -n "$COMPOSE_DATOTEKA" ]] || { echo 'Nedostaje --compose-datoteka' >&2; exit 2; }
[[ -n "${UMAMI_BAZA_LOZINKA:-}" ]] || { echo 'Postavi UMAMI_BAZA_LOZINKA u okolini' >&2; exit 2; }
[[ -f "$COMPOSE_DATOTEKA" ]] || { echo "Compose datoteka ne postoji: $COMPOSE_DATOTEKA" >&2; exit 2; }

# Escapiranje jednog navodnika za SQL literal.
lozinka_sql="${UMAMI_BAZA_LOZINKA//\'/\'\'}"

cd "$COMPOSE_DIR"
docker compose -f "$COMPOSE_DATOTEKA" exec -T "$BAZA_SERVIS" \
  psql -v ON_ERROR_STOP=1 -U kaladont -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'umami') THEN
    CREATE ROLE umami LOGIN PASSWORD '${lozinka_sql}';
  ELSE
    ALTER ROLE umami WITH LOGIN PASSWORD '${lozinka_sql}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE umami OWNER umami'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')\gexec

GRANT ALL PRIVILEGES ON DATABASE umami TO umami;
SQL

echo 'bootstrap-umami-bazu: uloga i baza umami su spremne.' >&2
