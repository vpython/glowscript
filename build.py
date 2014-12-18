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

version = "1.2dev"
# TODO: Extract this information from run.js

glowscript_libraries = {
    "run": [
        "../lib/jquery/jquery.mousewheel.js",
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
        "../lib/glow/primitives.js",
        "../lib/glow/api_misc.js",
        "../lib/glow/shaders.gen.js"
        ],
    "compile": [
        "../lib/narcissus/lib/jsdefs.js",
        "../lib/narcissus/lib/jslex.js",
        "../lib/narcissus/lib/jsparse.js",
        "../lib/narcissus/lib/jsdecomp.js",
        "../lib/streamline/compiler/format.js",
        "../lib/streamline/compiler/transform.js",
        "../lib/compiler.js",
        "../lib/coffee-script.js"],
    "RSrun": [
        "../lib/rapydscript/stdlib.js"
        ],
    "RScompile": [
        "../lib/narcissus/lib/jsdefs.js",
        "../lib/narcissus/lib/jslex.js",
        "../lib/narcissus/lib/jsparse.js",
        "../lib/narcissus/lib/jsdecomp.js",
        "../lib/streamline/compiler/format.js",
        "../lib/streamline/compiler/transform.js",
        "../lib/compiler.js",
        "../lib/rapydscript/utils.js",
        "../lib/rapydscript/ast.js",
        "../lib/rapydscript/output.js",
        "../lib/rapydscript/parse.js",
        "../lib/rapydscript/baselib.js",
        "../lib/rapydscript/stdlib.js"
        ],
    "ide": []
    }

def combine(inlibs):
    all = [
        "/*This is a combined, compressed file.  Look at https://bitbucket.org/davidscherer/glowscript for source code and copyright information.*/",
        ";(function(){})();"
        ]
    for fn in inlibs:
        if fn.startswith("../"): fn = fn[3:]
        all.append( open(fn, "rt").read() )
    return "\n".join(all)

def minify(inlibs, inlibs_nomin, outlib):
    all = combine(inlibs)
    outf = open(outlib, "wb")
    
    if True:
        env = os.environ.copy()
        env["NODE_PATH"] = "build-tools/UglifyJS"
        uglify = subprocess.Popen( "build-tools/node.exe build-tools/UglifyJS/bin/uglifyjs",
            stdin=subprocess.PIPE,
            stdout=outf,
            env=env
            )
        uglify.communicate( all )
        rc = uglify.wait()
        print "uglify " + outlib + ":", rc
        if rc != 0:
            print("Something went wrong")
    else:
        outf.write(all)
    outf.write( combine(inlibs_nomin) )
    outf.close()
    
minify( glowscript_libraries["run"], [], "package/glow." + version + ".min.js" )
print('Finished glow run-time package')
minify( glowscript_libraries["compile"], [], "package/compiler." + version + ".min.js" )
print('Finished compiler package')
minify( glowscript_libraries["RSrun"], [], "package/RSrun." + version + ".min.js" )
print('Finished RapydScript run-time package')
minify( glowscript_libraries["RScompile"], [], "package/RScompiler." + version + ".min.js" )
print('Finished GlowScript package')
