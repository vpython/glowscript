from __future__ import print_function, division

# This is the original Python 2.7 build file, used in building GlowScript
# according to the scheme described in docs/MakingNewVersion.txt.
# A more sophisticated build program is build_cli.py contributed by Iblis Lin.

# The main runtime library glow.X.Y.min.js apparently is too large to use
# in Jupyter VPython, so this program in addition to producing glow.X.Y.min.js
# also produces the two pieces glow.X.Ya.min.js and glow.X.Yb.min.js used in
# Jupyter VPython.

"""This python program converts various parts of glowscript from the most
convenient format for modification into the most convenient format for
deployment.

* Take shaders from shaders/*.shader and combine them into lib/glow/shaders.gen.js

TODO

* Come up with a less painful model for development than running this after every change
* Combine and minify lib/*.js into ide.min.js, run.min.js, and embed.min.js
"""

from glob import glob
import re, os, subprocess

shader_file = ["Export({ shaders: {"]
for fn in glob("shaders/*.shader"):
    name = re.match(r"^shaders[/\\]([^.]+).shader$", fn).group(1)
    f = open(fn, "rt").read()
    shader_file.append( '"' + name + '":' + repr(f) + "," )
shader_file.append("}});")
shader_file = "\n".join(shader_file)
open("lib/glow/shaders.gen.js", "wb").write(shader_file)

version = "2.1"
# TODO: Extract this information from run.js

glowscript_libraries = {
    "runa": [
        "../lib/jquery/"+version+"/jquery.mousewheel.js",
        "../lib/flot/jquery.flot.min.js",
        "../lib/flot/jquery.flot.crosshair_GS.js",
        "../lib/glMatrix.js",
        "../lib/webgl-utils.js",
        "../lib/glow/property.js",
        "../lib/glow/vectors.js",
        "../lib/glow/mesh.js",
        "../lib/glow/canvas.js",
        "../lib/glow/orbital_camera.js",
        "../lib/glow/autoscale.js",
        "../lib/glow/WebGLRenderer.js",
        "../lib/glow/graph.js",
        "../lib/glow/color.js",
        "../lib/glow/shapespaths.js",
        "../lib/glow/primitives.js",
        "../lib/glow/api_misc.js"
        ],
    "runb": [
        "../lib/glow/poly2tri.js",
        "../lib/glow/opentype.js",
        "../lib/glow/extrude.js",
        "../lib/glow/shaders.gen.js",
        "../lib/transform-all.js" # needed for running programs embedded in other web sites
        ],
    "compile": [
        "../lib/glow/opentype.js",
        "../lib/compiler.js",
        "../lib/papercomp.js",
        "../lib/transform-all.js",
        "../lib/coffee-script.js"
        ],
    "RSrun": [
        "../lib/rapydscript/baselib.js",
        "../lib/rapydscript/stdlib.js"
        ],
    "RScompile": [
        "../lib/glow/opentype.js",
        "../lib/compiler.js",
        "../lib/papercomp.js",
        "../lib/transform-all.js",
        "../lib/rapydscript/utils.js",
        "../lib/rapydscript/ast.js",
        "../lib/rapydscript/output.js",
        "../lib/rapydscript/parse.js",
        "../lib/rapydscript/baselib.js"
        ],
    "ide": []
    }

glowscript_libraries["run"] = []
for a in glowscript_libraries["runa"]:
    glowscript_libraries["run"].append(a)
for b in glowscript_libraries["runb"]:
    glowscript_libraries["run"].append(b)

def combine(inlibs):
    all = [
        "/*This is a combined, compressed file.  Look at https://github.com/BruceSherwood/glowscript for source code and copyright information.*/",
        ";(function(){})();"
        ]
    for fn in inlibs:
        if fn.startswith("../"): fn = fn[3:]
        all.append( open(fn, "rt").read() )
    return "\n".join(all)

def minify(inlibs, inlibs_nomin, outlib):
    all = combine(inlibs)
    outf = open(outlib, "wb")
    
    if True: # minify if True
        env = os.environ.copy()
        env["NODE_PATH"] = "build-tools/UglifyJS"
        uglify = subprocess.Popen( "build-tools/node.exe build-tools/UglifyJS/bin/uglifyjs",
            stdin=subprocess.PIPE,
            stdout=outf,
            env=env
            )
        uglify.communicate( all )
        rc = uglify.wait()
        print("uglify " + outlib + ":", rc)
        if rc != 0:
            print("Something went wrong")
    else:
        outf.write(all)
    outf.write( combine(inlibs_nomin) )
    outf.close()

minify( glowscript_libraries["runa"], [], "package/glow." + version + "a.min.js" )
print('Finished glow-a run-time package')
minify( glowscript_libraries["runb"], [], "package/glow." + version + "b.min.js" )
print('Finished glow-b run-time package')
minify( glowscript_libraries["run"], [], "package/glow." + version + ".min.js" )
print('Finished glow-b run-time package')
minify( glowscript_libraries["compile"], [], "package/compiler." + version + ".min.js" )
print('Finished compiler package')
minify( glowscript_libraries["RSrun"], [], "package/RSrun." + version + ".min.js" )
print('Finished RapydScript run-time package')
minify( glowscript_libraries["RScompile"], [], "package/RScompiler." + version + ".min.js" )
print('Finished GlowScript package')
