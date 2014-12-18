"""This python program takes shaders from shaders/*.shader and
combines them into lib/glow/shaders.gen.js

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
print("done")

