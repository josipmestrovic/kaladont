#!/usr/bin/env bash
# Lokalni / CI testovi backup skripti (bez pravog Storage Boxa).
set -Eeuo pipefail

KORIJEN="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BACKUP_DIR="${KORIJEN}/skripte/backup"
GATE="${KORIJEN}/skripte/zahtijevaj-svjez-offserver-backup.sh"
PAD=0

prolaz() {
  printf 'OK  %s\n' "$*"
}

pad() {
  printf 'FAIL %s\n' "$*" >&2
  PAD=1
}

echo '=== bash -n ==='
skripte=(
  "${BACKUP_DIR}/lib/zajednicko.sh"
  "${BACKUP_DIR}/kaladont-backup.sh"
  "${BACKUP_DIR}/kaladont-disk-provjera.sh"
  "${BACKUP_DIR}/kaladont-restore-drill.sh"
  "${BACKUP_DIR}/kaladont-backup-status.sh"
  "${BACKUP_DIR}/instaliraj-backup-jedinice.sh"
  "$GATE"
  "${KORIJEN}/skripte/testovi/backup/pokreni.sh"
)
for f in "${skripte[@]}"; do
  if bash -n "$f"; then
    prolaz "bash -n $(basename "$f")"
  else
    pad "bash -n $f"
  fi
done

echo '=== gate: bez instalacije → exit 1 ==='
set +e
KALADONT_BACKUP_BIN=/tmp/kaladont-backup-nepostoji-$$ \
  KALADONT_BACKUP_SKIP_SYSTEMCTL=1 \
  bash "$GATE" >/tmp/gate-out-$$.txt 2>/tmp/gate-err-$$.txt
gate_kod=$?
set -e
if [[ "$gate_kod" -eq 1 ]] && grep -q 'nije instaliran' /tmp/gate-err-$$.txt; then
  prolaz 'gate fail-closed bez binarnog puta'
else
  pad "gate očekivao exit 1 (dobio $gate_kod)"
  cat /tmp/gate-err-$$.txt >&2 || true
fi
rm -f /tmp/gate-out-$$.txt /tmp/gate-err-$$.txt

echo '=== restore: odbija kaladont_prod ==='
SHA64='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
set +e
bash "${BACKUP_DIR}/kaladont-restore-drill.sh" \
  --age=/tmp/nepostoji.age \
  --sha256="$SHA64" \
  --identity=/tmp/nepostoji.id \
  --cilj-ime=kaladont_prod >/tmp/restore-out-$$.txt 2>/tmp/restore-err-$$.txt
restore_kod=$?
set -e
if [[ "$restore_kod" -ne 0 ]] && grep -qi 'zabranjen' /tmp/restore-err-$$.txt; then
  prolaz 'restore odbija kaladont_prod'
else
  pad "restore nije odbio kaladont_prod (kod=$restore_kod)"
  cat /tmp/restore-err-$$.txt >&2 || true
fi
rm -f /tmp/restore-out-$$.txt /tmp/restore-err-$$.txt

echo '=== restore: odbija cilj bez kaladont_drill_ prefiksa ==='
set +e
bash "${BACKUP_DIR}/kaladont-restore-drill.sh" \
  --age=/tmp/nepostoji.age \
  --sha256="$SHA64" \
  --identity=/tmp/nepostoji.id \
  --cilj-ime=moja_baza >/tmp/restore2-out-$$.txt 2>/tmp/restore2-err-$$.txt
restore2_kod=$?
set -e
if [[ "$restore2_kod" -ne 0 ]] && grep -qi 'zabranjen' /tmp/restore2-err-$$.txt; then
  prolaz 'restore odbija ne-drill ime'
else
  pad "restore nije odbio moja_baza (kod=$restore2_kod)"
  cat /tmp/restore2-err-$$.txt >&2 || true
fi
rm -f /tmp/restore2-out-$$.txt /tmp/restore2-err-$$.txt

echo '=== mock: pad pg_dump → exit != 0, bez plaintext dumpa ==='
MOCK_DIR="$(mktemp -d /tmp/kaladont-backup-mock.XXXXXX)"
mkdir -p "$MOCK_DIR/bin" "$MOCK_DIR/etc" "$MOCK_DIR/compose" "$MOCK_DIR/work"
: >"$MOCK_DIR/compose/docker-compose.prod.yml"
: >"$MOCK_DIR/etc/key"
: >"$MOCK_DIR/etc/known_hosts"

cat >"$MOCK_DIR/etc/backup.env" <<EOF
COMPOSE_PROJECT_DIR=${MOCK_DIR}/compose
COMPOSE_DATOTEKA=${MOCK_DIR}/compose/docker-compose.prod.yml
BAZA_SERVIS=baza
BAZA_IME=kaladont_prod
BAZA_KORISNIK=kaladont
AGE_RECIPIENT=age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq
STORAGEBOX_HOST=example.invalid
STORAGEBOX_USER=u
STORAGEBOX_PORT=23
STORAGEBOX_DIR=/backup
STORAGEBOX_SSH_KEY=${MOCK_DIR}/etc/key
STORAGEBOX_KNOWN_HOSTS=${MOCK_DIR}/etc/known_hosts
HEALTHCHECK_BACKUP_URL=http://127.0.0.1:9/hc-backup
HEALTHCHECK_DISK_URL=http://127.0.0.1:9/hc-disk
DISK_PRAG_POSTOTAK=95
DISK_MOUNT=/
RETENCIJA_DNEVNIH=7
RETENCIJA_TJEDNIH=4
LOKALNI_RADNI_DIR=${MOCK_DIR}/work
EOF

cat >"$MOCK_DIR/bin/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$MOCK_DIR/bin/curl"

cat >"$MOCK_DIR/bin/docker" <<'EOF'
#!/usr/bin/env bash
if [[ "$*" == *pg_isready* ]]; then
  exit 0
fi
if [[ "$*" == *pg_dump* ]]; then
  echo 'simulated pg_dump failure' >&2
  exit 1
fi
exit 0
EOF
chmod +x "$MOCK_DIR/bin/docker"

cat >"$MOCK_DIR/bin/age" <<'EOF'
#!/usr/bin/env bash
# Proguta stdin; ne stvara izlaz (pg_dump ionako pada uz pipefail).
cat >/dev/null || true
exit 0
EOF
chmod +x "$MOCK_DIR/bin/age"

cat >"$MOCK_DIR/bin/sftp" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$MOCK_DIR/bin/sftp"

cat >"$MOCK_DIR/bin/df" <<'EOF'
#!/usr/bin/env bash
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
printf '/dev/sda1 100 10 90 10%% /\n'
EOF
chmod +x "$MOCK_DIR/bin/df"

set +e
PATH="${MOCK_DIR}/bin:/usr/bin:/bin" \
  KALADONT_BACKUP_ENV="$MOCK_DIR/etc/backup.env" \
  bash "${BACKUP_DIR}/kaladont-backup.sh" --razlog=dnevni \
  >"$MOCK_DIR/out.txt" 2>"$MOCK_DIR/err.txt"
mock_kod=$?
set -e

if [[ "$mock_kod" -ne 0 ]]; then
  prolaz 'backup pada kad pg_dump ne uspije'
else
  pad 'backup je neočekivano uspio uz pad pg_dumpa'
  cat "$MOCK_DIR/err.txt" >&2 || true
fi

if find "$MOCK_DIR/work" -type f \( -name '*.dump' -o -name '*.sql' \) 2>/dev/null | grep -q .; then
  pad 'pronađen plaintext dump nakon greške'
else
  prolaz 'nema plaintext dumpa nakon greške'
fi

rm -rf "$MOCK_DIR"

if [[ "$PAD" -ne 0 ]]; then
  echo 'Backup testovi: IMA PADOVA' >&2
  exit 1
fi
echo 'Backup testovi: SVI PROŠLI'
