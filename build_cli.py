# -*- coding: utf-8 -*-

"""This python program converts various parts of glowscript from the most
convenient format for modification into the most convenient format for
deployment.

* Take shaders from shaders/*.shader and combine them into lib/glow/shaders.gen.js
* Extract glowscript libraries list from ``untrusted/run.js``.
  In the implementation, we need ``slimit`` as our dependency::

      $ pip install slimit

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
from pprint import pprint

from slimit import ast
from slimit.parser import Parser as JSParser
from slimit.visitors import nodevisitor


version = "2.2dev"
src_dir = os.path.dirname(__file__)


def extract_glow_lib():
    runjs = norm_path('untrusted/run.js')
    parser = JSParser()

    with open(runjs) as f:
        tree = parser.parse(f.read())

    for node in nodevisitor.visit(tree):
        if (isinstance(node, ast.Assign) and
            isinstance(node.left, ast.DotAccessor) and
            node.left.identifier.value == 'glowscript_libraries' and
            isinstance(node.right, ast.Object)):
                break
    else:
        print('Parsing {} failed'.format(runjs))
        exit(-1)

    return preproc_lib_path({
        prop.left.value:
            [
                eval(lib.value)
                for lib in prop.right.items
                if isinstance(lib, ast.String)
            ]
            for prop in node.right.properties
    })


def preproc_lib_path(libs):
    pjoin = partial(os.path.join, src_dir, 'untrusted')
    return {pkg: map(os.path.normpath, (map(pjoin, paths)))
                 for pkg, paths in libs.items()}


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
    'path/to/src/dir/lib/glow/graph.js'
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
            with open(fn, 'r') as f:
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

    with open(outlib, 'w') as outf:
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


def build_package(libs, no_min=False):
    '''
    :param libs: the dictionary contain all glowscript libraries::

        {
            "package_1": [
                'lib 1'
                ...
            ],
            "package_2": [
                ...
            ],
            ...
        }

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
        minify(libs[pkg.inlibs],
               pkg.inlibs_nomin,
               norm_path('package/{}'.format(pkg.outlib)),
               no_min=no_min)
        print('Finished {}'.format(pkg.comment))


def cmd_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('-s', '--shader', action='store_true', default=False,
                        help="Build shader file 'lib/glow/shaders.gen.js' only")
    parser.add_argument('--no-min', dest='no_min', action='store_true',
                        default=False, help="Build non-minified libraries only")
    parser.add_argument('-l', '--libs', action='store_true', default=False,
                        help='Show glowscript libraries and exit')

    return parser.parse_args()


if __name__ == '__main__':
    glowscript_libraries = extract_glow_lib()
    args = cmd_args()

    if args.libs:
        pprint(glowscript_libraries)
    elif args.shader:
        build_shader(glowscript_libraries)
    else:  # default: build all
        build_shader()
        build_package(glowscript_libraries, no_min=args.no_min)
