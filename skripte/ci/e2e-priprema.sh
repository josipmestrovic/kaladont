#!/usr/bin/env bash
# CI-only: minimalna priprema za izolirani E2E shard (nakon pnpm install).
# Ne radi lint/Vitest/puni workspace build — to ostaje u jobu `kod`.
set -euo pipefail

pnpm --filter zajednicko build
pnpm --filter posluzitelj migracije
pnpm --filter posluzitelj ci-fixture
