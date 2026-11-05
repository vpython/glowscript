"""Python arithmetic through the bundled RapydScript compiler.

Runs the compiler under node, compiles each expression, executes the
JavaScript, and compares with CPython's answer. Both copies are checked:
lib/rapydscript/compiler.js (the source) and package/RScompiler.3.2.min.js,
which is what a "GlowScript 3.2 VPython" program actually loads. The package
is built from lib by build_original_py3.py; a fix to lib alone does not reach
users until the package is rebuilt and committed.
"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
COMPILERS = {
    "lib": ROOT / "lib" / "rapydscript" / "compiler.js",
    "package-3.2": ROOT / "package" / "RScompiler.3.2.min.js",
}

RUNNER = r"""
// The package is a browser bundle: load it into a vm context, take the
// RapydScript it defines, and run the compiled code in that same context so it
// sees the bundle's built-ins (abs, ...). The lib source is a node module.
function load(path) {
  const body = (js) => '(function(){' + js + '\nreturn [r, x];})()';
  if (!path.endsWith('.min.js')) {
    const m = require(path);
    return { m, run: (js) => new Function('return ' + body(js))() };
  }
  const vm = require('vm');
  const ctx = { console, navigator: { userAgent: 'node' }, document: {}, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  vm.runInContext(require('fs').readFileSync(path, 'utf8'), ctx);
  return { m: ctx, run: (js) => vm.runInContext(body(js), ctx) };
}
const { m, run } = load(process.argv[1]);
const ec = (m.RapydScript || m).create_embedded_compiler();
const out = {};
for (const expr of JSON.parse(process.argv[2])) {
  try {
    const js = ec.compile('x = 5\nr = ' + expr + '\n', {keep_baselib: false});
    out[expr] = Array.from(run(js));
  } catch (e) {
    out[expr] = String(e);
  }
}
console.log(JSON.stringify(out));
"""


def compile_and_run(compiler, exprs):
    proc = subprocess.run(
        ["node", "-e", RUNNER, str(COMPILERS[compiler]), json.dumps(exprs)],
        capture_output=True, text=True, timeout=60, check=True,
    )
    return json.loads(proc.stdout)


# Repeated sign operators: before the fix, RapydScript printed "- -x" as
# "--x", which is a pre-decrement in JavaScript (a wrong answer that also
# changes x) or, for a literal, a syntax error.
SIGNS = ["- -3", "- -x", "- - -x", "+ +x", "- +x", "+ -x", "-(-x)", "x - -x", "x + +x", "-(- -x)"]


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
@pytest.mark.parametrize("compiler", COMPILERS)
def test_repeated_sign_operators_match_python(compiler):
    x = 5
    expected = {e: [eval(e), x] for e in SIGNS}
    assert compile_and_run(compiler, SIGNS) == expected


# Python's ** binds tighter than a unary operator on its left and groups right
# to left. RapydScript parsed unary minus first and repaired only a bare
# "-x**2" on output, so "-(x+1)**2" came out positive (#170 had hidden this).
POWERS = [
    "-x**2", "-(x)**2", "-(x+1)**2", "-(-x)**2", "- -x**2", "- - -x**2", "-(2)**2",
    "(-x)**2", "-2**2", "(-2)**2", "-x**-2", "2*-x**2", "1 - -x**2", "-x**2**0.5",
    "2**3**2", "2**-1**2", "2**-x", "+x**2", "-(x-3)**2/8", "-x**2 + 1", "-abs(-3)**2",
]


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
@pytest.mark.parametrize("compiler", COMPILERS)
def test_unary_operators_and_power_match_python(compiler):
    x = 5
    got = compile_and_run(compiler, POWERS)
    wrong = {e: got[e] for e in POWERS
             if not (isinstance(got[e], list) and got[e][1] == x
                     and got[e][0] == pytest.approx(eval(e), rel=1e-12))}
    assert wrong == {}
