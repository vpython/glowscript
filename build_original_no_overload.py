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

##shader_file = ["Export({ shaders: {"]
##for fn in glob("shaders/*.shader"):
##    name = re.match(r"^shaders[/\\]([^.]+).shader$", fn).group(1)
##    f = open(fn, "rt").read()
##    shader_file.append( '"' + name + '":' + repr(f) + "," )
##shader_file.append("}});")
##shader_file = "\n".join(shader_file)
##open("lib/glow/shaders.gen.js", "wb").write(shader_file)

version = "2.7"
# TODO: Extract this information from run.js

glowscript_libraries = {
    "run": [
        "../lib/jquery/"+"2.1"+"/jquery.mousewheel.js", # use 2.1 lib with later versions
        "../lib/flot/jquery.flot.js",
        "../lib/flot/jquery.flot.crosshair_GS.js",
        "../lib/opentype/poly2tri.js",
        "../lib/opentype/opentype.js",
        "../lib/glMatrix.js",
        "../lib/webgl-utils.js",
        "../lib/glow/property.js",
##        "../lib/glow/vectors.js",
        "../lib/glow/vectors_no_overload.js", # glowcomm doesn't need or want overloading
        "../lib/glow/mesh.js",
        "../lib/glow/canvas.js",
        "../lib/glow/orbital_camera.js",
        "../lib/glow/autoscale.js",
        "../lib/glow/WebGLRenderer.js",
        "../lib/glow/graph.js",
        "../lib/glow/color.js",
        "../lib/glow/shapespaths.js",
        "../lib/glow/primitives.js",
        "../lib/glow/api_misc.js",
        "../lib/glow/extrude.js",
        "../lib/glow/shaders.gen.js",
        # Unfortunately, uglify currently cannot handle function*, an ES6 feature in the es6 version of transform.js.
        # Tried using babel to make an ES5 version of transform.js, to be able to uglify, but uglify failed again.
        # Later: uglify-es does seem to handle ES6 but fails on RSrun; see below.
        # So let's use the older version of Streamline:
        "../lib/compiling/transform.js" # needed at run time as well as during compiling
        ],
    "plotly": [
        "../lib/plotly.js"
        ]
    }

def combine(inlibs):
    # Apparently uglify moves the following string to the end of the package.
    # "(function(){x})();" appears at the both the start and the end of the package.
    all = [
        "/*This is a combined, compressed file.  Look at https://github.com/BruceSherwood/glowscript for source code and copyright information.*/",
        ";(function(){})();"
        ]
    for fn in inlibs:
        if fn.startswith("../"): fn = fn[3:]
        all.append( open(fn, "r").read() )
    return "\n".join(all)

env = os.environ.copy()
env["NODE_PATH"] = "build-tools/UglifyJS"

def minify(inlibs, inlibs_nomin, outlib):
    all = combine(inlibs)
    outf = open(outlib, "wb")
    
    if True: # minify if True
        uglify = subprocess.Popen( "build-tools/node.exe build-tools/Uglify-ES/uglify-es/bin/uglifyjs",
            stdin=subprocess.PIPE,
            stdout=outf,
            stderr=outf, # write uglify errors into output file
            env=env
            )
        uglify.communicate( all )
        rc = uglify.wait()
        if rc != 0:
            print("Something went wrong")
    else:
        outf.write(all)
    outf.write( combine(inlibs_nomin) )
    outf.close()

minify( glowscript_libraries["run"], [], "ForInstalledPython/glow.min.js" )
print('Finished glow run-time package\n')
minify( glowscript_libraries["plotly"], [], "ForInstalledPython/plotly.min.js" )
print('Finished glow run-time package\n')

