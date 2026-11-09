#!/usr/bin/env bash
# Fail-fast prije `docker compose --profile umami up`: odbij prazne/slabe Umami tajne.
# Vidi docs/07-operacije/runbook-umami.md
set -Eeuo pipefail

greska=0

provjeri() {
  local ime="$1"
  local vrijednost="${2:-}"
  local min="$3"
  local zabranjeno="$4"
  if [[ -z "$vrijednost" ]]; then
    echo "Nedostaje $ime" >&2
    greska=1
    return
  fi
  if [[ "$vrijednost" == "$zabranjeno" ]]; then
    echo "$ime ne smije biti placeholder (${zabranjeno})" >&2
    greska=1
    return
  fi
  if [[ ${#vrijednost} -lt "$min" ]]; then
    echo "$ime mora imati barem $min znakova" >&2
    greska=1
  fi
}

provjeri UMAMI_BAZA_LOZINKA "${UMAMI_BAZA_LOZINKA:-}" 16 umami
provjeri UMAMI_APP_SECRET "${UMAMI_APP_SECRET:-}" 32 promijeni-umami-app-secret

exit "$greska"
