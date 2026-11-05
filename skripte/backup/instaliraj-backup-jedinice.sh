#!/usr/bin/env bash
# Instalira verzionirane backup skripte, systemd jedinice i sudoers fragment.
# Ne prepisuje postojeći /etc/kaladont/backup.env.
set -Eeuo pipefail

[[ "$(id -u)" -eq 0 ]] || { echo 'Pokreni kao root (sudo).' >&2; exit 1; }

SKRIPTA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_CILJ=/usr/local/lib/kaladont
ETC_CILJ=/etc/kaladont
SYSTEMD_CILJ=/etc/systemd/system
SUDOERS_CILJ=/etc/sudoers.d/kaladont-backup

install -d -m 755 "$LIB_CILJ"
install -d -m 700 "$ETC_CILJ"

for f in \
  kaladont-backup.sh \
  kaladont-disk-provjera.sh \
  kaladont-restore-drill.sh \
  kaladont-backup-status.sh
do
  install -m 755 "${SKRIPTA_DIR}/${f}" "${LIB_CILJ}/${f}"
done

install -d -m 755 "${LIB_CILJ}/lib"
install -m 644 "${SKRIPTA_DIR}/lib/zajednicko.sh" "${LIB_CILJ}/lib/zajednicko.sh"

for f in \
  kaladont-backup.service \
  kaladont-backup.timer \
  kaladont-disk-provjera.service \
  kaladont-disk-provjera.timer
do
  install -m 644 "${SKRIPTA_DIR}/systemd/${f}" "${SYSTEMD_CILJ}/${f}"
done

if [[ ! -f "${ETC_CILJ}/backup.env" ]]; then
  install -m 600 "${SKRIPTA_DIR}/predlosci/backup.env.primjer" "${ETC_CILJ}/backup.env"
  echo "Stvoren ${ETC_CILJ}/backup.env iz primjera — popuni tajne prije pokretanja." >&2
else
  echo "Zadržan postojeći ${ETC_CILJ}/backup.env (nije prepisán)." >&2
fi

install -m 440 "${SKRIPTA_DIR}/predlosci/sudoers-deploy-backup" "$SUDOERS_CILJ"
if command -v visudo >/dev/null 2>&1; then
  visudo -cf "$SUDOERS_CILJ"
fi

systemctl daemon-reload
systemctl enable --now kaladont-backup.timer
systemctl enable --now kaladont-disk-provjera.timer

echo 'Instalacija gotova.'
echo "Provjera: systemctl list-timers --all 'kaladont-*'"
echo "Ručni backup: systemctl start kaladont-backup.service"
echo "Status: ${LIB_CILJ}/kaladont-backup-status.sh"
