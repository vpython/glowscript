"""Python arithmetic through the bundled RapydScript compiler.

Runs lib/rapydscript/compiler.js under node, compiles each expression,
executes the JavaScript, and compares with CPython's answer.
"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

COMPILER = Path(__file__).resolve().parent.parent / "lib" / "rapydscript" / "compiler.js"

RUNNER = r"""
const m = require(process.argv[1]);
const ec = (m.RapydScript || m).create_embedded_compiler();
const out = {};
for (const expr of JSON.parse(process.argv[2])) {
  try {
    const js = ec.compile('x = 5\nr = ' + expr + '\n', {keep_baselib: false});
    out[expr] = new Function(js + '\nreturn [r, x];')();
  } catch (e) {
    out[expr] = String(e);
  }
}
console.log(JSON.stringify(out));
"""


def compile_and_run(exprs):
    proc = subprocess.run(
        ["node", "-e", RUNNER, str(COMPILER), json.dumps(exprs)],
        capture_output=True, text=True, timeout=60, check=True,
    )
    return json.loads(proc.stdout)


# Repeated sign operators: before the fix, RapydScript printed "- -x" as
# "--x", which is a pre-decrement in JavaScript (a wrong answer that also
# changes x) or, for a literal, a syntax error.
SIGNS = ["- -3", "- -x", "- - -x", "+ +x", "- +x", "+ -x", "-(-x)", "x - -x", "x + +x", "-(- -x)"]


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_repeated_sign_operators_match_python():
    x = 5
    expected = {e: [eval(e), x] for e in SIGNS}
    assert compile_and_run(SIGNS) == expected
