# -*- coding: utf-8 -*-

"""This python program converts various parts of glowscript from the most
convenient format for modification into the most convenient format for
deployment.

* Take shaders from shaders/*.shader and combine them into lib/glow/shaders.gen.js

TODO

* Come up with a less painful model for development than running this after every change
* Combine and minify lib/*.js into ide.min.js, run.min.js, and embed.min.js
"""

from __future__ import division
from __future__ import print_function

import argparse
import os
import subprocess

from functools import partial
from collections import namedtuple


version = "2.2dev"
src_dir = os.path.dirname(__file__)

# TODO: Extract this information from run.js
glowscript_libraries = {
    "run": [
        "../lib/jquery/{}/jquery.mousewheel.js".format(version),
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
        "../lib/glow/shaders.gen.js",
        "../lib/transform-all.js" # needed for running programs embedded in other web sites
        ],
    "compile": [
        "../lib/compiler.js",
        "../lib/papercomp.js",
        "../lib/transform-all.js",
        "../lib/coffee-script.js"],
    "RSrun": [
        "../lib/rapydscript/baselib.js",
        "../lib/rapydscript/stdlib.js"
        ],
    "RScompile": [
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


def preproc_lib_path(libs):
    pjoin = partial(os.path.join, src_dir, 'untrusted')
    return {pkg: map(pjoin, paths) for pkg, paths in libs.items()}


def build_shader():
    shader_file = ["Export({shaders: {"]
    shaders_dir = os.path.join(src_dir, 'shaders')
    output_js = os.path.join(src_dir, 'lib', 'glow', 'shaders.gen.js')

    for fn in os.listdir(shaders_dir):
        if not fn.endswith('.shader'):
            continue
        name = fn.rpartition('.shader')[0]
        with open(os.path.join(shaders_dir, fn), 'rt') as f:
            shader_file.append('"{name}":{src!r},'.format(
                               name=name, src=f.read()))
    shader_file.append('}});')
    with open(output_js, 'w') as f:
        f.writelines('\n'.join(shader_file))
    print("Shader {!r} built successfully.".format(output_js))


def norm_path(p):
    '''
    :param p: path related to source dir

    >>> norm_path('lib/glow/graph.js')
    '/path/to/src/dir/lib/glow/graph.js'
    '''
    return os.path.normpath(os.path.join(src_dir, p))


def combine(inlibs):
    def gen():
        yield (
            "/*This is a combined, compressed file. "
            "Look at https://github.com/BruceSherwood/glowscript "
            "for source code and copyright information.*/"
            )

        yield ";(function(){})();"

        for fn in inlibs:
            with open(norm_path(fn), 'r') as f:
                yield f.read()

    return "\n".join(gen())


def minify(inlibs, inlibs_nomin, outlib, no_min=False):
    '''
    Do unglify for ``inlibs``

    :param inlibs: a list of paths which want to be minify
    :param inlibs_nomin: a list of paths which do *not* want to be minify
    :param no_min: if True, we build no minified libraries only.

    Available environment variable:

        :NODE_PATH: the path of nodejs exetuable
    '''
    node_cmd = os.environ.get('NODE_PATH', 'node')
    uglifyjs = norm_path('build-tools/UglifyJS/bin/uglifyjs')

    with open(norm_path(outlib), 'w') as outf:
        if not no_min:
            uglify = subprocess.Popen(
                [node_cmd, uglifyjs],
                stdin=subprocess.PIPE,
                stdout=outf,
                )
            uglify.communicate(combine(inlibs))
            rc = uglify.wait()

            if rc != 0:
                print("Something went wrong on {}".format(outlib))
            else:
                print("Uglify {} successfully".format(outlib))

        if inlibs_nomin:
            outf.write(combine(inlibs_nomin))


def build_package(no_min=False):
    '''
    :param no_min: if True, we build no minified libraries only.
    '''
    Package = namedtuple('Package',
                         ('inlibs', 'inlibs_nomin', 'outlib', 'comment'))

    pkgs = (
        Package(inlibs='run',
                inlibs_nomin=[],
                outlib='glow.{}.min.js'.format(version),
                comment='glow run-time package'),
        Package(inlibs='compile',
                inlibs_nomin=[],
                outlib='compiler.{}.min.js'.format(version),
                comment='compiler package'),
        Package(inlibs='RSrun',
                inlibs_nomin=[],
                outlib='RSrun.{}.min.js'.format(version),
                comment='RapydScript run-time package'),
        Package(inlibs='RScompile',
                inlibs_nomin=[],
                outlib='RScompiler.{}.min.js'.format(version),
                comment='GlowScript package'),
    )

    for pkg in pkgs:
        minify(glowscript_libraries[pkg.inlibs],
               pkg.inlibs_nomin, 'package/{}'.format(pkg.outlib),
               no_min=no_min)
        print('Finished {}'.format(pkg.comment))


if __name__ == '__main__':
    glowscript_libraries = preproc_lib_path(glowscript_libraries)
    parser = argparse.ArgumentParser()
    parser.add_argument('-s', '--shader', action='store_true', default=False,
                        help="Build shader file 'lib/glow/shaders.gen.js' only")
    parser.add_argument('--no-min', dest='no_min', action='store_true',
                        default=False, help="Build non-minified libraries only")

    args = parser.parse_args()

    if args.shader:
        build_shader()
    else:  # default: build all
        build_shader()
        build_package(no_min=args.no_min)
