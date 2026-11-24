#!/bin/bash
# Smoke tests against a deployed server, with only Docker installed.
#
#   ./run_smoke.sh https://VERSION-dot-glowscript.appspot.com [extra pytest args]
#   ./run_smoke.sh https://glowscript.org          # right after a traffic switch
#
# Runs tests/e2e/test_smoke.py (anonymous, read-only) and tests/test_e2e.py in Chromium
# and WebKit, in the Playwright image. Failure screenshots land in the printed dir.
# A project whose Datastore lacks a demo fails naming it; skip it with -k "not NAME".
set -eo pipefail
url=${1:?usage: ./run_smoke.sh BASE_URL [extra pytest args]}; shift
here=$(cd "$(dirname "$0")" && pwd)
runner=glowscript-smoke-$$; out=$(mktemp -d)
cleanup() { docker rm -f "$runner" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT TERM

# Waited on as a background job so Ctrl-C stops it at once (see run_e2e.sh).
docker run --rm --init --name "$runner" --platform linux/amd64 -v "$here":/src:ro -v "$out":/out \
    -v glowscript-e2e-pip:/root/.cache/pip \
    mcr.microsoft.com/playwright/python:v1.55.0-noble bash -c '
set -e
cp -r /src /w && cd /w
pip install -q -r requirements-test.txt playwright==1.55.0 pytest-playwright==0.7.1 >/dev/null
python -m pytest -p no:cacheprovider tests/e2e/test_smoke.py tests/test_e2e.py --base-url "$0" \
    --browser chromium --browser webkit --screenshot only-on-failure --output /out/artifacts "$@"
' "$url" "$@" &
wait $! || { s=$?; echo "failed; screenshots in $out"; exit $s; }
echo "passed"
