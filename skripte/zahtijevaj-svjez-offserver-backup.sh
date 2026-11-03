#!/usr/bin/env bash
# Ugovor: exit 0 samo kad je potvrđen svježi off-server dump prije migracija.
# Ova verzija je fail-closed stub dok backup tooling (systemd/age/Storage Box)
# ne stigne zasebnim PR-om. Ime skripte i exit-kod ugovor ostaju isti.
set -Eeuo pipefail

echo 'zahtijevaj-svjez-offserver-backup: backup tooling nije instaliran ili nije potvrdio uspjeh.' >&2
echo 'Produkcijski deploy staje prije migracija (fail-closed).' >&2
echo 'Kad stigne backup PR, zamijeni tijelo ove skripte pravom provjerom; zadrži ime i exit 0 samo na potvrđen svježi off-server dump.' >&2

if systemctl cat kaladont-backup.service >/dev/null 2>&1; then
  echo 'Pronađen je kaladont-backup.service, ali ova skripta još nema pravu verifikaciju — odbijam deploy.' >&2
fi

exit 1
