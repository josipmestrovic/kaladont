#!/usr/bin/env bash
# CI-only: pokreni Playwright preglednike iz službenog Docker imagea (remote server).
# Lokalni Windows ostaje na `pnpm test:e2e:install` — ova skripta nije za lokalni razvoj.
set -euo pipefail

NAREDBA="${1:-}"
shift || true

PROVJERI_WEBKIT=0
for arg in "$@"; do
  case "$arg" in
    --webkit) PROVJERI_WEBKIT=1 ;;
    *)
      echo "Nepoznat argument: $arg" >&2
      exit 2
      ;;
  esac
done

WS_PORT="${PW_BROWSER_RUNTIME_PORT:-9323}"
WS_ENDPOINT="ws://127.0.0.1:${WS_PORT}/"
STANJE_DIR="${RUNNER_TEMP:-/tmp}"
STANJE_DATOTEKA="${STANJE_DIR}/kaladont-pw-browser-runtime.env"
LOG_DATOTEKA="${STANJE_DIR}/kaladont-pw-browser-runtime.log"
# Budžet mora stati u CI step timeout (8 min): 2×pull + sleep 10s + readiness + docker overhead.
PULL_TIMEOUT_SEC="${PW_BROWSER_PULL_TIMEOUT_SEC:-150}"
READINESS_TIMEOUT_SEC="${PW_BROWSER_READINESS_TIMEOUT_SEC:-60}"

ime_kontejnera() {
  local run_id job shard sanitarno
  run_id="${GITHUB_RUN_ID:-local}"
  job="${GITHUB_JOB:-job}"
  # Matrix E2E: GITHUB_JOB je isti ("e2e") na svim shardovima — dodaj E2E_SHARD.
  shard="${E2E_SHARD:-}"
  sanitarno="$(printf '%s' "$job" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-')"
  if [[ -n "$shard" ]]; then
    printf 'pw-browsers-%s-%s-s%s' "$run_id" "$sanitarno" "$shard"
  else
    printf 'pw-browsers-%s-%s' "$run_id" "$sanitarno"
  fi
}

zapisi_sazetak() {
  local tekst="$1"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$tekst" >> "$GITHUB_STEP_SUMMARY"
  fi
  printf '%s\n' "$tekst"
}

provjeri_spremnost() {
  local endpoint="$1"
  local ukljuci_webkit="$2"
  node --input-type=module - "$endpoint" "$ukljuci_webkit" <<'NODE'
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// pnpm ne diže `playwright` na root — razriješi ga kroz @playwright/test.
const requireRoot = createRequire(pathToFileURL(path.join(process.cwd(), 'package.json')).href);
const requirePw = createRequire(requireRoot.resolve('@playwright/test/package.json'));
const { chromium, webkit } = requirePw('playwright');

const endpoint = process.argv[2];
const ukljuciWebkit = process.argv[3] === '1';

async function provjeri(browserType, naziv) {
  const browser = await browserType.connect(endpoint);
  try {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('about:blank');
      await page.close();
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`Playwright readiness OK: ${naziv}`);
}

await provjeri(chromium, 'chromium');
if (ukljuciWebkit) {
  await provjeri(webkit, 'webkit');
}
NODE
}

pokreni_start() {
  local korijen pw_version pw_image kontejner pull_start pull_end ready_start ready_end digest
  korijen="$(pwd)"
  if [[ ! -f "${korijen}/node_modules/@playwright/test/cli.js" ]]; then
    echo "Nedostaje node_modules/@playwright/test/cli.js — prvo pnpm install." >&2
    exit 1
  fi

  pw_version="$(node -p 'require("@playwright/test/package.json").version')"
  pw_image="mcr.microsoft.com/playwright:v${pw_version}-noble"
  kontejner="$(ime_kontejnera)"

  zapisi_sazetak "## Playwright browser runtime"
  zapisi_sazetak "- Node: \`$(node -v)\`"
  zapisi_sazetak "- Playwright paket: \`${pw_version}\`"
  zapisi_sazetak "- Image: \`${pw_image}\`"
  zapisi_sazetak "- Kontejner: \`${kontejner}\`"
  zapisi_sazetak "- Endpoint: \`${WS_ENDPOINT}\`"

  # Bez --rm: zadrži kontejner radi logova nakon pada; stop uvijek radi rm -f.
  docker rm -f "$kontejner" >/dev/null 2>&1 || true

  pull_start="$(date +%s)"
  if ! timeout "${PULL_TIMEOUT_SEC}" docker pull "$pw_image"; then
    echo "Prvi docker pull nije uspio — ponovni pokušaj…" >&2
    sleep 10
    timeout "${PULL_TIMEOUT_SEC}" docker pull "$pw_image"
  fi
  pull_end="$(date +%s)"
  digest="$(docker image inspect --format '{{index .RepoDigests 0}}' "$pw_image" 2>/dev/null || true)"
  if [[ -z "$digest" ]]; then
    digest="$(docker image inspect --format '{{.Id}}' "$pw_image")"
  fi
  zapisi_sazetak "- Image digest/id: \`${digest}\`"
  zapisi_sazetak "- Pull: $((pull_end - pull_start)) s"

  docker run --detach \
    --name "$kontejner" \
    --init --ipc=host --network host \
    --volume "${korijen}:${korijen}:ro" \
    --workdir "$korijen" \
    "$pw_image" \
    node node_modules/@playwright/test/cli.js run-server \
    --host 127.0.0.1 --port "$WS_PORT"

  {
    echo "PW_BROWSER_RUNTIME_CONTAINER=${kontejner}"
    echo "PW_BROWSER_RUNTIME_IMAGE=${pw_image}"
    echo "PW_BROWSER_RUNTIME_DIGEST=${digest}"
    echo "PW_TEST_CONNECT_WS_ENDPOINT=${WS_ENDPOINT}"
  } > "$STANJE_DATOTEKA"

  ready_start="$(date +%s)"
  local kraj=$((ready_start + READINESS_TIMEOUT_SEC))
  local spreman=0
  local sada
  while true; do
    sada="$(date +%s)"
    if (( sada >= kraj )); then
      break
    fi
    if ! docker container inspect "$kontejner" >/dev/null 2>&1; then
      echo "Playwright browser kontejner je nestao prije readinessa." >&2
      docker logs "$kontejner" >&2 || true
      exit 1
    fi
    # set -e: neuspjeh unutar if ne prekida petlju.
    if provjeri_spremnost "$WS_ENDPOINT" "$PROVJERI_WEBKIT" >/dev/null 2>&1; then
      spreman=1
      break
    fi
    sleep 2
  done
  ready_end="$(date +%s)"
  zapisi_sazetak "- Readiness: $((ready_end - ready_start)) s"

  if [[ "$spreman" -ne 1 ]]; then
    echo "Playwright browser runtime nije spreman u ${READINESS_TIMEOUT_SEC}s." >&2
    docker logs "$kontejner" >"$LOG_DATOTEKA" 2>&1 || true
    cat "$LOG_DATOTEKA" >&2 || true
    docker rm -f "$kontejner" >/dev/null 2>&1 || true
    rm -f "$STANJE_DATOTEKA"
    exit 1
  fi

  # Jednom ispiši uspješan readiness (chromium / webkit).
  provjeri_spremnost "$WS_ENDPOINT" "$PROVJERI_WEBKIT"

  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "PW_TEST_CONNECT_WS_ENDPOINT=${WS_ENDPOINT}" >> "$GITHUB_ENV"
    echo "PW_BROWSER_RUNTIME_CONTAINER=${kontejner}" >> "$GITHUB_ENV"
  fi

  zapisi_sazetak "- Status: spreman"
}

pokreni_stop() {
  local kontejner=""
  if [[ -f "$STANJE_DATOTEKA" ]]; then
    # shellcheck disable=SC1090
    source "$STANJE_DATOTEKA"
    kontejner="${PW_BROWSER_RUNTIME_CONTAINER:-}"
  fi
  if [[ -z "$kontejner" ]]; then
    kontejner="${PW_BROWSER_RUNTIME_CONTAINER:-}"
  fi
  if [[ -z "$kontejner" ]]; then
    kontejner="$(ime_kontejnera)"
  fi

  if docker container inspect "$kontejner" >/dev/null 2>&1; then
    docker logs "$kontejner" >"$LOG_DATOTEKA" 2>&1 || true
    if [[ -n "${GITHUB_STEP_SUMMARY:-}" && -f "$LOG_DATOTEKA" ]]; then
      {
        echo ""
        echo "<details><summary>Playwright browser runtime log (zadnjih 80 linija)</summary>"
        echo ""
        echo '```'
        tail -n 80 "$LOG_DATOTEKA" || true
        echo '```'
        echo "</details>"
      } >> "$GITHUB_STEP_SUMMARY"
    fi
    docker rm -f "$kontejner" >/dev/null 2>&1 || true
  fi
  rm -f "$STANJE_DATOTEKA"
}

case "$NAREDBA" in
  start) pokreni_start ;;
  stop) pokreni_stop ;;
  *)
    echo "Upotreba: $0 start [--webkit] | stop" >&2
    exit 2
    ;;
esac
