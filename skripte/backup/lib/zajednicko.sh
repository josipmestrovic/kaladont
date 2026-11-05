#!/usr/bin/env bash
# Zajedničke pomoćne funkcije za Kaladont backup/restore (bez tajni u logu).
# shellcheck shell=bash

kaladont_log() {
  printf '%s\n' "$*" >&2
}

kaladont_umri() {
  kaladont_log "GREŠKA: $*"
  exit 1
}

# Healthchecks.io: /start, success (gol URL), /fail.
# Ne šalje stdout/stderr ni sadržaj dumpa.
kaladont_hc_ping() {
  local url="$1"
  local putanja="${2:-}"
  if [[ -z "$url" ]]; then
    return 0
  fi
  local cilj="$url"
  if [[ -n "$putanja" ]]; then
    cilj="${url%/}/${putanja#/}"
  fi
  curl -fsS -m 10 --retry 5 -o /dev/null "$cilj" || true
}

kaladont_zahtijevaj_naredbu() {
  local naredba="$1"
  command -v "$naredba" >/dev/null 2>&1 || kaladont_umri "Nedostaje naredba: $naredba"
}

kaladont_ucitaj_env() {
  local datoteka="$1"
  [[ -f "$datoteka" ]] || kaladont_umri "Nedostaje konfiguracija: $datoteka"
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "$datoteka"
  set +a
}

kaladont_zahtijevaj_var() {
  local ime="$1"
  local vrijednost="${!ime-}"
  [[ -n "$vrijednost" ]] || kaladont_umri "Obvezna varijabla nije postavljena: $ime"
}

kaladont_disk_zauzece_postotak() {
  local mount_tocka="${1:-/}"
  df -P "$mount_tocka" | awk 'NR==2 { gsub(/%/,"",$5); print $5 }'
}

kaladont_utc_ts() {
  date -u +'%Y%m%dT%H%M%SZ'
}

kaladont_sftp_batch() {
  local batch_datoteka="$1"
  sftp -b "$batch_datoteka" \
    -P "${STORAGEBOX_PORT}" \
    -o StrictHostKeyChecking=yes \
    -o "UserKnownHostsFile=${STORAGEBOX_KNOWN_HOSTS}" \
    -i "${STORAGEBOX_SSH_KEY}" \
    "${STORAGEBOX_USER}@${STORAGEBOX_HOST}"
}
