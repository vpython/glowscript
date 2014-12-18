from __future__ import division , print_function

## Convert all .py files in this folder to run in GlowScript VPython
## Bruce Sherwood, begun June 2011; major rewrite November 2014

import os
import re

allfiles = os.listdir(os.curdir)
#allfiles = ['aaa.py'] # for testing purposes, convert just this one file

# VPython objects:
prims = ['arrow', 'box', 'cone', 'curve', 'cylinder',
            'ellipsoid', 'extrusion', 'faces', 'helix',
            'label', 'pyramid', 'ring', 'sphere', 'frame',
            'text', 'local_light', 'distant_light']

# Objects for which obj.x should be obj.pos.x:
posobjects = ['arrow', 'box', 'cone', 'curve', 'cylinder', 'ellipsoid', 'label',
              'helix', 'pyramid', 'ring', 'sphere', 'local_light', 'frame']

# Basic categories with respect to radius, length, etc. are arrow, box, cylinder, ring, sphere, curve:
primtypes = {'arrow':'rect', 'box':'rect', 'cone':'radial', 'curve':'curve', 'cylinder':'radial',
            'ellipsoid':'rect', 'extrusion':'not_implemented', 'faces':'not_implemented', 'helix':'radial',
            'label':'label', 'pyramid':'rect', 'ring':'radial', 'sphere':'radial', 'frame':'not_implemented',
            'text':'not_implemented', 'local_light':'light', 'distant_light':'light'}

symbols = {} # variables which refer to VPython objects, in form var:prim

def firstpass(pname):
    
    print('--------------------')
    print('Processing '+pname)
    output = []
    symbols = {}
    lines = open(pname+'.py', 'r').readlines()

    def add(s):
        output.append(s)

    rerange = re.compile('\.range\s*=\s*\((\s*\w*\s*,\s*\w*\s*,\s*\w*\s*)\)')

    def replacements(line):
        line = line.replace('mouse.getclick()','waitfor("click")')
        line = line.replace('arcsin', 'asin')
        line = line.replace('arccos', 'acos')
        line = line.replace('arctan', 'atan')
        m = rerange.search(line)
        if m:
            line = line.replace('('+m.group(1),m.group(1)+'  # range was ('+m.group(1))
        #line = line.replace('vector', 'vec') # don't do this until/unless class VPython accepts vec
        return line

    nlines = len(lines)
    linenumber = 0
    reblank = re.compile(r'^[\s]*$')
    recomment = re.compile(r'^[\s]*#')
    add('# Converted from the VPython program '+pname)

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

        # Simple replacements such as display -> canvas
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
        else:
            for prim in prims:
                p = re.compile('[^\w]*'+prim+'\s*(\()')
                m = p.search(line)
                if m:
                    begin = m.start(1)+1 # location of '(' after primitive name
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
            add('## The '+prim+' object is not yet implemented in GlowScript')
            add('## '+line)
            continue
            
        if len(comments) > 0: add(comments[:-1]) # delete final carriage return, which add will attach

        # replace '(x,y,z)' with 'vector(x,y,z)'
        parenlist = [] # where we encountered a left paren or bracket: [loc, previous_alphanum]
        lastc = ':' # previous non-space character
        commas = 0  # count commas in (x,y,z) tuples
        commalevel = 0 # length of the parenlist at the time a comma is encountered
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
            elif c == '(':
                parenlist.append([i-1, lastc.isalnum() or lastc == '_'])
            elif c == ')':
                if commas == 2:
                    if len(parenlist) > commalevel: # z component contains parens
                        parenlist = parenlist[:-1]
                        continue
                    if not parenlist[-1][1]: # if char preceding (x,y,z) is not alphnumeric, it's a tuple
                        startvec = parenlist[-1][0]
                        line = line[:startvec]+'vector'+line[startvec:] # (x,y,z) -> vector(x,y,z)
                        i += len('vector')
                    parenlist = []
                    commas = 0
                else:
                    parenlist = parenlist[:-1]
                    if len(parenlist) == 0: commas = 0
            elif c == ',':
                if len(parenlist) > 0:
                    commas += 1
                    commalevel = len(parenlist)
            lastc = c
        add(line)

    return output

# Replace obj.x with obj.pos.x, and convert obj.attr += vector with ob.jattr = obj.attr + vector
out = ''
def secondpass(lines):
    global out
    out = ''
    attrs = {'x':'pos.x', 'y':'pos.y',  'z':'pos.z'}
    objattrs = ['pos', 'axis', 'up']
    patt = re.compile('(\w+)\.(\w+)')
    findeq = re.compile('\s+=')
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
                    if attr in attrs:
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
                if m.group(1) in symbols and m.group(2) == objattr:
                    if (m.group(3)[0] == '+'):
                        line = line[:m.start(3)-1]+' = '+m.group(1)+'.'+m.group(2)+'+'+line[m.end(3):]
                    else:
                        line = line[:m.start(3)-1]+' = '+m.group(1)+'.'+m.group(2)+m.group(3)[0]+'('+line[m.end(3):]+')'
        add(line)

    return out


for filename in allfiles:
    pname = filename.split('.')
    if pname[-1] != 'py': continue
    pname = filename[:-3]
    # How does one get the name of this converter file? __file__ gives an error
    if pname == 'VPtoGS': continue
    
    lines = firstpass(pname)
    final = secondpass(lines)

    fd = open(pname+'.gs', 'w')
    fd.write(final)
    fd.close()

if len(allfiles) == 1:
    print('---------------------')
    print(final)
else: print('Done')
