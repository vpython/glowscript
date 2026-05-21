#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

pip install -r requirements.txt -r requirements-test.txt --quiet --ignore-installed

echo 'export DATASTORE_EMULATOR_HOST=localhost:8081' >> "$CLAUDE_ENV_FILE"
