"""
Generate lib/glowscript-api.json (used for autocomplete, hover and signature help in the editor, see
lib/glowscript-monaco.js) from the ".. py:function::" blocks in the VPython docs sources.
Run from anywhere: python build-tools/gen_monaco_api.py
"""
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DOCS = os.path.join(ROOT, 'docs', 'VPythonDocs', '_sources')
OUT = os.path.join(ROOT, 'lib', 'glowscript-api.json')

FUNCTION = re.compile(r'^\s*\.\.\s+py:function::\s*(.*)$')
PARAM = re.compile(r'^\s+:param\s+(\w+):\s*(.*)$')
TYPE = re.compile(r'^\s+:type\s+(\w+):\s*(.*)$')


def clean(text):
    text = re.sub(r':py:\w+:`([^`]*)`', r'\1', text)  # :py:attr:`scene` -> scene
    text = re.sub(r'\*\*?([^*]+)\*\*?', r'\1', text)  # *emphasis* -> emphasis
    return re.sub(r'\s+', ' ', text).strip()


def callee(signature):
    # 'ball = sphere(pos=...)' -> 'sphere'
    head = signature.split('(')[0]
    return head.split('=')[-1].strip()


def parse(path, api):
    current = None  # entry whose indented body we are reading
    param = None    # :param: continued over several lines
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            m = FUNCTION.match(line)
            if m:
                signature = m.group(1).strip()
                name = callee(signature)
                if not re.match(r'^[A-Za-z_][\w.]*$', name):
                    current = None
                    continue
                current = api.setdefault(name, {'signature': '', 'doc': '', 'params': {}, 'file': os.path.basename(path).split('.')[0]})
                if '(' in signature and not current['signature']:
                    current['signature'] = name + '(' + signature.split('(', 1)[1]
                param = None
                continue
            if current is None:
                continue
            if line.strip() and not line.startswith((' ', '\t')):
                current = param = None
                continue
            m = PARAM.match(line)
            if m:
                param = current['params'].setdefault(m.group(1), {'type': '', 'doc': ''})
                if not param['doc']:
                    param['doc'] = clean(m.group(2))
                continue
            m = TYPE.match(line)
            if m:
                current['params'].setdefault(m.group(1), {'type': '', 'doc': ''})['type'] = clean(m.group(2))
                param = None
                continue
            text = line.strip()
            if not text or text.startswith(':') or text.startswith('..'):
                param = None
                continue
            if param is not None and not param['doc'].endswith(clean(text)):
                param['doc'] = (param['doc'] + ' ' + clean(text)).strip()
            elif param is None and not current['doc']:
                current['doc'] = clean(text)


def main():
    api = {}
    for filename in sorted(os.listdir(DOCS)):
        if filename.endswith('.rst.txt'):
            parse(os.path.join(DOCS, filename), api)
    # skip variables used in doc examples (myobject.clone, gc.plot, ...)
    api = {name: entry for name, entry in api.items() if entry['params'] and not name.startswith(('myobject.', 'gc.'))}
    for entry in api.values():
        entry['params'] = [dict(name=n, **p) for n, p in entry['params'].items()]
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(api, f, indent=1, sort_keys=True)
        f.write('\n')
    print('wrote %d entries to %s' % (len(api), os.path.relpath(OUT, ROOT)))


if __name__ == '__main__':
    main()
