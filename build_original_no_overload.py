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

version = "2.9"
# TODO: Extract this information from run.js

glowscript_libraries = {
    "run": [
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/jquery/"+"2.1"+"/jquery.mousewheel.js", # use 2.1 lib with later versions
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/flot/jquery.flot.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/flot/jquery.flot.crosshair_GS.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/opentype/poly2tri.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/opentype/opentype.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glMatrix.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/webgl-utils.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/property.js",
##        "../lib/glow/vectors.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/vectors_no_overload.js", # glowcomm doesn't need or want overloading
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/mesh.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/canvas.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/orbital_camera.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/autoscale.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/WebGLRenderer.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/graph.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/color.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/shapespaths.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/primitives.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/api_misc.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/extrude.js",
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/glow/shaders.gen.js"
        ],
    "plotly": [
        "/Users/atitus/Developer/glowscript-fork/glowscript/lib/plotly.js"
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
env["NODE_PATH"] = "/Users/atitus/Developer/glowscript-fork/glowscript/build-tools"

def minify(inlibs, inlibs_nomin, outlib):
    all = combine(inlibs)
    outf = open(outlib, "wb")
    
    if True: # minify if True
#        uglify = subprocess.Popen( "build-tools/node.exe build-tools/Uglify-ES/uglify-es/bin/uglifyjs",
        uglify = subprocess.Popen( "/Users/atitus/Developer/glowscript-fork/glowscript/build-tools/node /Users/atitus/Developer/glowscript-fork/glowscript/build-tools/Uglify-ES/uglify-es/bin/uglifyjs",
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

minify( glowscript_libraries["run"], [], "/Users/atitus/Developer/glowscript-fork/glowscript/ForInstalledPython/glow.min.js" )
print('Finished glow run-time package\n')
minify( glowscript_libraries["plotly"], [], "/Users/atitus/Developer/glowscript-fork/glowscript/ForInstalledPython/plotly.min.js" )
print('Finished glow run-time package\n')

