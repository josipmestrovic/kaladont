#!/usr/bin/env bash
# Ugovor: exit 0 samo kad je potvrđen svježi off-server dump prije migracija.
# Pokreće NOVI dump s --razlog=pre-migracija (sinoćnji dnevni nije dovoljan).
set -Eeuo pipefail

BACKUP_BIN="${KALADONT_BACKUP_BIN:-/usr/local/lib/kaladont/kaladont-backup.sh}"

if [[ ! -x "$BACKUP_BIN" ]]; then
  echo "zahtijevaj-svjez-offserver-backup: backup tooling nije instaliran (${BACKUP_BIN})." >&2
  echo 'Produkcijski deploy staje prije migracija (fail-closed).' >&2
  echo 'Na VPS-u pokreni: sudo bash skripte/backup/instaliraj-backup-jedinice.sh' >&2
  exit 1
fi

if [[ "${KALADONT_BACKUP_SKIP_SYSTEMCTL:-}" != '1' ]]; then
  if ! systemctl cat kaladont-backup.service >/dev/null 2>&1; then
    echo 'zahtijevaj-svjez-offserver-backup: kaladont-backup.service nije instaliran.' >&2
    exit 1
  fi
fi

echo 'zahtijevaj-svjez-offserver-backup: pokrećem novi pre-migracija off-server dump…' >&2

izlaz=''
kod=0
if [[ "$(id -u)" -eq 0 ]]; then
  izlaz="$("$BACKUP_BIN" --razlog=pre-migracija)" || kod=$?
else
  izlaz="$(sudo -n "$BACKUP_BIN" --razlog=pre-migracija)" || kod=$?
fi

if [[ "$kod" -ne 0 ]]; then
  echo 'zahtijevaj-svjez-offserver-backup: backup nije potvrdio uspjeh — odbijam migracije.' >&2
  exit "$kod"
fi

echo "zahtijevaj-svjez-offserver-backup: potvrđen svježi dump: ${izlaz}" >&2
exit 0
