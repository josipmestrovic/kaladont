#!/usr/bin/env bash
# Periodična provjera zauzeća diska; pada iznad praga (zadano 80 %).
set -Eeuo pipefail
umask 077

SKRIPTA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/zajednicko.sh
source "${SKRIPTA_DIR}/lib/zajednicko.sh"

BACKUP_ENV="${KALADONT_BACKUP_ENV:-/etc/kaladont/backup.env}"
USPJEH=0
HC_POSLAN_FAIL=0

na_izlazu() {
  local kod=$?
  if [[ "$USPJEH" -eq 0 && "$HC_POSLAN_FAIL" -eq 0 ]]; then
    kaladont_hc_ping "${HEALTHCHECK_DISK_URL-}" fail
    HC_POSLAN_FAIL=1
  fi
  exit "$kod"
}
trap na_izlazu EXIT

kaladont_ucitaj_env "$BACKUP_ENV"
kaladont_zahtijevaj_var HEALTHCHECK_DISK_URL
kaladont_zahtijevaj_var DISK_PRAG_POSTOTAK
DISK_MOUNT="${DISK_MOUNT:-/}"

kaladont_zahtijevaj_naredbu curl
kaladont_zahtijevaj_naredbu df

kaladont_hc_ping "$HEALTHCHECK_DISK_URL" start

zauzece="$(kaladont_disk_zauzece_postotak "$DISK_MOUNT")"
if [[ -z "$zauzece" || ! "$zauzece" =~ ^[0-9]+$ ]]; then
  kaladont_umri "Ne mogu očitati zauzeće diska za $DISK_MOUNT"
fi

kaladont_log "Disk ${DISK_MOUNT}: ${zauzece}% (prag ${DISK_PRAG_POSTOTAK}%)"

if (( zauzece > DISK_PRAG_POSTOTAK )); then
  kaladont_umri "Disk ${DISK_MOUNT} zauzet ${zauzece}% — iznad praga ${DISK_PRAG_POSTOTAK}%"
fi

USPJEH=1
kaladont_hc_ping "$HEALTHCHECK_DISK_URL"
kaladont_log "Disk provjera OK"
