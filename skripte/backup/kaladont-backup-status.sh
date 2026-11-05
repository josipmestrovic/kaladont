#!/usr/bin/env bash
# Sažetak backup timera/servisa bez ispisa tajni.
set -Eeuo pipefail

SKRIPTA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/zajednicko.sh
source "${SKRIPTA_DIR}/lib/zajednicko.sh"

BACKUP_ENV="${KALADONT_BACKUP_ENV:-/etc/kaladont/backup.env}"

printf '=== Kaladont backup status ===\n'

if [[ -f "$BACKUP_ENV" ]]; then
  printf 'Konfiguracija: postoji (%s)\n' "$BACKUP_ENV"
else
  printf 'Konfiguracija: NEDOSTAJE (%s)\n' "$BACKUP_ENV"
fi

if [[ -x /usr/local/lib/kaladont/kaladont-backup.sh ]]; then
  printf 'Backup skripta: instalirana\n'
else
  printf 'Backup skripta: nije na /usr/local/lib/kaladont/kaladont-backup.sh\n'
fi

if command -v systemctl >/dev/null 2>&1; then
  printf '\n--- Timers ---\n'
  systemctl list-timers --all 'kaladont-*' --no-pager 2>/dev/null || printf '(nema kaladont-* timera)\n'

  for jedinica in kaladont-backup.service kaladont-disk-provjera.service; do
    printf '\n--- %s ---\n' "$jedinica"
    if systemctl cat "$jedinica" >/dev/null 2>&1; then
      systemctl show "$jedinica" -p Result -p ExecMainStatus -p ActiveState -p SubState --no-pager 2>/dev/null || true
    else
      printf 'Jedinica nije instalirana.\n'
    fi
  done

  printf '\n--- Zadnji journal (backup, 30 min) ---\n'
  journalctl -u kaladont-backup.service --since '30 minutes ago' --no-pager -n 40 2>/dev/null \
    | sed -E 's#(age1[A-Za-z0-9]+|https://[^ ]+|/etc/kaladont/[^ ]+)#<redacted>#g' \
    || printf '(nema zapisa)\n'
else
  printf 'systemctl nije dostupan na ovom stroju.\n'
fi
