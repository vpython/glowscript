#!/bin/bash
# Rebuild package/*.min.js inside Docker, without installing node or npm on your machine.
#
#   ./build_docker.sh [repo] [outdir]
#
# repo   a glowscript checkout (default: this one), or an rsWVPRunner checkout, which
#        builds with its build_package.py and borrows build-tools/Uglify-ES from here.
# outdir where the scratch copy goes (default: a new temp dir). The packages land in
#        <outdir>/src/package/; the checkout itself is never changed.
#
# It builds from the checkout's tracked files, uncommitted edits included, and prints
# "same" or "CHANGED" for each rebuilt package. Copy only the CHANGED ones into package/.
#
# Check the toolchain first: run this on an unmodified master. Every package should come
# out "same"; if one doesn't, a diff against your build is not just your change.
#
# Why not just "python build_original_py3.py": on anything but macOS that runs
# build-tools/node.exe, the Windows binary, and the build fails while leaving an EMPTY
# package/glow.X.min.js. Here the macOS branch, plain "node", is used instead.
set -eo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "${1:-$here}" && pwd)
out=${2:-$(mktemp -d)}

if [ -f "$repo/build_original_py3.py" ]; then build=build_original_py3.py
elif [ -f "$repo/build_package.py" ]; then build=build_package.py
else echo "$repo: no build_original_py3.py or build_package.py" >&2; exit 1; fi

rm -rf "$out/src"; mkdir -p "$out/src"
(cd "$repo" && git ls-files -z | xargs -0 tar -cf -) | tar -xf - -C "$out/src"
if [ ! -f "$out/src/build-tools/Uglify-ES/uglify-es/bin/uglifyjs" ]; then
    (cd "$here" && git ls-files -z build-tools/Uglify-ES | xargs -0 tar -cf -) | tar -xf - -C "$out/src"
fi

docker run --rm --platform linux/amd64 -v "$out/src":/b -w /b node:20-bullseye bash -c "
set -e
(cd build-tools/Uglify-ES/uglify-es && npm install --omit=dev --ignore-scripts --no-audit --no-fund --silent)
touch /tmp/stamp; sleep 1
python3 -c 'import platform; platform.system = lambda: \"Darwin\"; exec(open(\"$build\").read())' \
    2>&1 | grep -i 'wrong\|error\|traceback' || true
rm -rf build-tools/Uglify-ES/uglify-es/node_modules build-tools/Uglify-ES/uglify-es/package-lock.json
find package -newer /tmp/stamp -name '*.min.js' -size +0 | sort > .rebuilt"

echo "built in $out/src/package"
[ -s "$out/src/.rebuilt" ] || { echo "nothing was rebuilt: the build failed" >&2; exit 1; }
while read -r f; do
    if cmp -s "$out/src/$f" "$repo/$f"; then echo "  same     $f"; else echo "  CHANGED  $f"; fi
done < "$out/src/.rebuilt"
