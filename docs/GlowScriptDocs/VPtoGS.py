from __future__ import division , print_function

## Convert all .py files in this folder to run in GlowScript VPython
## Bruce Sherwood, begun June 2011; major rewrite November 2014

import os
import re

allfiles = os.listdir(os.curdir)
#allfiles = ['aaa.py'] # for testing purposes, convert just this one file

# VPython objects:
prims = ['arrow', 'box', 'cone', 'curve', 'cylinder', 'display',
            'ellipsoid', 'extrusion', 'faces', 'helix',
            'label', 'pyramid', 'ring', 'sphere', 'frame',
            'text', 'local_light', 'distant_light']

# Objects for which obj.x should be obj.pos.x:
posobjects = ['arrow', 'box', 'cone', 'curve', 'cylinder', 'ellipsoid', 'label',
              'helix', 'pyramid', 'ring', 'sphere', 'local_light', 'frame']

# Basic categories with respect to radius, length, etc. are arrow, box, cylinder, ring, sphere, curve:
primtypes = {'arrow':'rect', 'box':'rect', 'cone':'radial', 'curve':'curve', 'cylinder':'radial',
            'ellipsoid':'rect', 'extrusion':'rect', 'faces':'not_implemented', 'helix':'radial',
            'label':'label', 'pyramid':'rect', 'ring':'radial', 'sphere':'radial', 'frame':'not_implemented',
            'text':'not_implemented', 'local_light':'light', 'distant_light':'light', 'display':'display'}

symbols = {} # variables which refer to VPython objects, in form var:prim

# A left paren was found at location i in the string line;
# convert (x,y,z) -> vector(x,y,z) and (x,y) -> vector(x,y,0) and return new line and advanced i
# But don't convert xxx.plot(pos=(x,y)).
def insert_vector(line, i):
    start = i
    commas = 0
    parens = 1
    while i < len(line):
        c = line[i]
        i += 1
        if c == ' ': continue
        elif c == ',': commas += 1
        elif c == '(': parens += 1
        elif c == ')':
            parens -= 1
            if parens == 0:
                if commas == 1: # (x,y) -> vector(x,y,0)
                    line = line[:start-1]+'vector'+line[start-1:i-1] + ',0' + line[i-1:]
                    i += 8
                elif commas == 2: # (x,y,z) -> vector(x,y,z)
                    line = line[:start-1]+'vector'+line[start-1:]
                    i += 6
                break
    return [line, i]

def firstpass(pname):
    global symbols
    print('--------------------')
    print('Processing '+pname)
    output = []
    symbols = {'scene':'display'} # predefined name of a primitive
    lines = open(pname+'.py', 'r').readlines()

    def add(s):
        output.append(s)

    rerange = re.compile('\.range\s*=\s*\((\s*\w*\s*,\s*\w*\s*,\s*\w*\s*)\)')

    def replacements(line):
        line = line.replace('vector()', 'vector(0,0,0)')
        line = line.replace('mouse.getclick()',"waitfor('click')")
        line = line.replace('arcsin', 'asin')
        line = line.replace('arccos', 'acos')
        line = line.replace('arctan', 'atan')
        line = line.replace('gdisplay', 'graph')
        line = line.replace('display', 'canvas')
        m = rerange.search(line)
        if m:
            line = line.replace('('+m.group(1),m.group(1)+'  # range was ('+m.group(1))
        #line = line.replace('vector', 'vec') # don't do this until/unless class VPython accepts vec
        return line

    nlines = len(lines)
    linenumber = 0
    reblank = re.compile(r'^[\s]*$')
    recomment = re.compile(r'^[\s]*#')

    while linenumber < nlines:
        line = lines[linenumber][:-1] # remove final carriage return
        linenumber += 1
        m = reblank.match(line)
        if m is None:
            m = recomment.match(line)
            if m is not None:
                add(lines[linenumber-1][:-1])
                continue
        else:
            add(lines[linenumber-1][:-1])
            continue

        # Simple replacements such as arcsin -> asin
        line = replacements(line)

        # Build dictionary of names that reference VPython primitives
        foundprim = False
        for prim in prims:
            p = re.compile('\s*(\w+)\s*=\s*'+prim+'\s*(\()')
            m = p.search(line)
            if m:
                symbols[m.group(1)] = prim
                begin = m.start(2)+1 # location of '(' after primitive name
                foundprim = True
                break
        
        # Concatenate any continuation lines and move end-of-line comment to previous line
        reindent = re.compile('^\s*')
        parens = 0
        comments = ''
        i = 0
        while i < len(line):
            c = line[i]
            if c == "'":
                i += 1
                while i < len(line):
                    c = line[i]
                    i += 1
                    if c == "'": break
                continue
            if c == '"':
                i += 1
                while i < len(line):
                    c = line[i]
                    i += 1
                    if c == '"': break
                continue
            if c == '(': parens += 1
            elif c == ')': parens -= 1
            elif c == '\\':
                line = line[:i]+line[i+1:]
                i -= 1
            elif c == '#':
                comments += line[i:]+'\n'
                line = line[:i]
                if parens > 0:
                    i -= 1
            if i == len(line)-1:
                if parens > 0:
                    nextline = lines[linenumber]
                    if len(nextline) > 0: nextline = nextline[:-1]
                    linenumber += 1
                    indent = reindent.match(nextline)
                    if indent != None:
                        nextline = nextline[indent.span()[1]:]
                    if line[i] != ' ': nextline = ' '+nextline
                    line += nextline
                else:
                    break
            i += 1
        
        if foundprim and (primtypes[prim] == 'not_implemented'):
            print('The '+prim+' object is not yet implemented in GlowScript')
            add(line)
            continue
            
        if len(comments) > 0: add(comments[:-1]) # delete final carriage return, which add will attach

        # Replace ' = (x,y,z)' in a constructor with ' = vector(x,y,z)'
        # If it is ' = (x,y)', replace with ' = vector(x,y,0)'
        p = re.compile('\.plot\s*\(')
        m = p.search(line) # look for xxx.plot(pos=(x,y)) and don't insert 'vector'
        if not m:
            # Could use regex to find '= (' instead of marching through the line one character at a time.
            lastc = ''
            i = 0
            while i < len(line):
                c = line[i]
                i += 1
                if c == ' ': continue
                if c == "'":
                    while i < len(line):
                        c = line[i]
                        i += 1
                        if c == "'": break
                    continue
                if c == '"':
                    while i < len(line):
                        c = line[i]
                        i += 1
                        if c == '"': break
                    continue
                elif c == '(' and lastc == '=': # need to test for =(x,y,z) or =(x,y)
                    line, i = insert_vector(line, i)
                lastc = c
                
        add(line)

    return output

# Replace obj.x with obj.pos.x, and convert obj.attr += vector to ob.jattr = obj.attr + vector
out = ''
def secondpass(lines):
    global out
    out = ''
    attrs = {'x':'pos.x', 'y':'pos.y', 'z':'pos.z'}
    objattrs = ['pos', 'axis', 'up', 'size', 'color']
    patt = re.compile('(\w+)\.(\w+)')
    pluseq = re.compile('(\w+)\.(\w+)\s*([\+\-\*\/]=\s*)')

    def add(s):
        global out
        out += s+'\n'

    for line in lines:
        start = 0
        while True:
            m = patt.search(line[start:])
            if m:
                name = m.group(1)
                attr = m.group(2)
                if name in symbols:
                    prim = symbols[name]
                    # Replace obj.x with obj.pos.x
                    if (attr in attrs) and (prim != 'curve') and (prim != 'display'): # curve.x and scene.x are legal
                        newattr = attrs[attr]
                        line = line[:m.start(1)+start]+name+'.'+newattr+line[m.end(2)+start:]
                        start += m.end(2) + len(newattr) - len(attr)
                    else:
                        start += m.end(2)
                else:
                    start += m.end(2)
            else: break
        for objattr in objattrs:
            m = pluseq.search(line)
            if m:
                # Replace obj.attr += vector with ob.jattr = obj.attr + vector
                if m.group(1) in symbols and m.group(2) == objattr:
                    if (m.group(3)[0] == '+'):
                        line = line[:m.start(3)-1]+' = '+m.group(1)+'.'+m.group(2)+'+'+line[m.end(3):]
                    else:
                        line = line[:m.start(3)-1]+' = '+m.group(1)+'.'+m.group(2)+m.group(3)[0]+'('+line[m.end(3):]+')'
        add(line)

    return out

outputdir = 'Converted'
if not os.path.exists(outputdir):
    os.makedirs(outputdir)

for filename in allfiles:
    pname = filename.split('.')
    if pname[-1] != 'py': continue
    pname = filename[:-3]
    # How does one get the name of this converter file? __file__ gives an error
    if pname[:6] == 'VPtoGS': continue

    lines = firstpass(pname)
    final = secondpass(lines)

    fd = open(outputdir+'/'+pname+'.py', 'w')
    fd.write(final)
    fd.close()

if len(allfiles) == 1:
    print('---------------------')
    print(final)
else: print('Done')
