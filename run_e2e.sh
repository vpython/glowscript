#!/bin/bash
# Browser tests against a throwaway local stack, with only Docker installed.
#
#   ./run_e2e.sh [extra pytest args]
#
# Starts an empty Datastore emulator and, in the Playwright image, Flask on
# http://localhost:8080 (it must be "localhost": see tests/e2e/e2e_helpers.is_local).
# Runs tests/e2e (local B1 tests + smoke tests on seeded demos) and tests/test_e2e.py in
# Chromium and WebKit, then removes everything. Failure screenshots land in the printed dir.
set -eo pipefail
here=$(cd "$(dirname "$0")" && pwd)
net=glowscript-e2e-$$; ds=$net-datastore; out=$(mktemp -d)
cleanup() { docker rm -f "$ds" >/dev/null 2>&1 || true; docker network rm "$net" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker network create "$net" >/dev/null
docker run -d --name "$ds" --network "$net" --platform linux/amd64 google/cloud-sdk:emulators \
    gcloud beta emulators datastore start --host-port=0.0.0.0:8081 --project=glowscript-dev --no-store-on-disk >/dev/null

docker run --rm --network "$net" --platform linux/amd64 -v "$here":/src:ro -v "$out":/out \
    -v glowscript-e2e-pip:/root/.cache/pip \
    -e GLOWSCRIPT_RUNNING_LOCALLY=true -e DATASTORE_EMULATOR_HOST="$ds:8081" -e GOOGLE_CLOUD_PROJECT=glowscript-dev \
    mcr.microsoft.com/playwright/python:v1.55.0-noble bash -c '
set -e
cp -r /src /w && cd /w
pip install -q -r requirements.txt -r requirements-test.txt playwright==1.55.0 pytest-playwright==0.7.1 >/dev/null
up() { python -c "import sys,urllib.request; urllib.request.urlopen(sys.argv[1], timeout=2)" "$1" 2>/dev/null; }
for i in $(seq 60); do up "http://$DATASTORE_EMULATOR_HOST" && break; sleep 1; done
flask run --host localhost --port 8080 >/out/flask.log 2>&1 &
for i in $(seq 60); do up http://localhost:8080/ && break; sleep 1; done
python -m pytest -p no:cacheprovider tests/e2e tests/test_e2e.py --base-url http://localhost:8080 \
    --browser chromium --browser webkit --screenshot only-on-failure --output /out/artifacts "$@"
' bash "$@" || { s=$?; echo "failed; logs and screenshots in $out"; tail -30 "$out/flask.log"; exit $s; }
echo "passed; logs in $out"
