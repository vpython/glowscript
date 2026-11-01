"use strict";
var GlowScriptMonaco = (function () {
    var FUNCTIONS = [
        ['vec', 'Create a 3D vector. Same as `vector`.', ['x:number', 'y:number', 'z:number'], 'vector'],
        ['vector', 'Create a 3D vector <x, y, z>.', ['x:number', 'y:number', 'z:number'], 'vector'],
        ['mag', 'Magnitude (length) of a vector.', ['v:vector'], 'number'],
        ['mag2', 'Square of the magnitude of a vector.', ['v:vector'], 'number'],
        ['norm', 'Unit vector in the direction of a vector. Same as `hat`.', ['v:vector'], 'vector'],
        ['hat', 'Unit vector in the direction of a vector. Same as `norm`.', ['v:vector'], 'vector'],
        ['dot', 'Dot (scalar) product of two vectors.', ['a:vector', 'b:vector'], 'number'],
        ['cross', 'Cross (vector) product of two vectors.', ['a:vector', 'b:vector'], 'vector'],
        ['proj', 'Vector projection of `a` onto `b`.', ['a:vector', 'b:vector'], 'vector'],
        ['comp', 'Scalar projection of `a` along `b`.', ['a:vector', 'b:vector'], 'number'],
        ['diff_angle', 'Angle between two vectors, in radians.', ['a:vector', 'b:vector'], 'number'],
        ['rotate', 'Rotate a vector by an angle (radians) about an axis.', ['v:vector', 'angle:number', 'axis?:vector'], 'vector'],
        ['rate', 'Halt computations, if necessary, long enough that a loop runs at most `frequency` times per second, and let the display update. Essential in an animation loop.', ['frequency:number'], 'void'],
        ['sleep', 'Pause for the given number of seconds.', ['seconds:number'], 'void'],
        ['print', 'Display values in the output area below the canvas.', ['...args:any[]'], 'void'],
        ['sqrt', 'Square root.', ['x:number'], 'number'],
        ['abs', 'Absolute value.', ['x:number'], 'number'],
        ['sin', 'Sine of an angle in radians.', ['x:number'], 'number'],
        ['cos', 'Cosine of an angle in radians.', ['x:number'], 'number'],
        ['tan', 'Tangent of an angle in radians.', ['x:number'], 'number'],
        ['asin', 'Arc sine, in radians.', ['x:number'], 'number'],
        ['acos', 'Arc cosine, in radians.', ['x:number'], 'number'],
        ['atan', 'Arc tangent, in radians, from -pi/2 to pi/2.', ['x:number'], 'number'],
        ['atan2', 'Angle in radians, from -pi to pi, whose tangent is y/x.', ['y:number', 'x:number'], 'number'],
        ['exp', 'e to the power x.', ['x:number'], 'number'],
        ['log', 'Natural logarithm (base e).', ['x:number'], 'number'],
        ['log10', 'Logarithm base 10.', ['x:number'], 'number'],
        ['pow', 'x to the power y; an alternative to x**y.', ['x:number', 'y:number'], 'number'],
        ['ceil', 'Round up to the nearest integer.', ['x:number'], 'number'],
        ['floor', 'Round down to the nearest integer.', ['x:number'], 'number'],
        ['sign', '+1 if x > 0, -1 if x < 0, 0 if x == 0.', ['x:number'], 'number'],
        ['round', 'Round to the nearest integer, or to `n` decimal places.', ['x:number', 'n?:number'], 'number'],
        ['max', 'The largest of the arguments.', ['...values:number[]'], 'number'],
        ['min', 'The smallest of the arguments.', ['...values:number[]'], 'number'],
        ['random', 'Pseudorandom number from 0 up to 1.', [], 'number'],
        ['factorial', 'x! = x*(x-1)*(x-2)...1', ['x:number'], 'number'],
        ['combin', 'x!/(y!*(x-y)!)', ['x:number', 'y:number'], 'number'],
        ['radians', 'Convert degrees to radians.', ['theta:number'], 'number'],
        ['degrees', 'Convert radians to degrees.', ['phi:number'], 'number'],
        ['clock', 'Time in seconds.', [], 'number'],
        ['msclock', 'Time in milliseconds.', [], 'number'],
        ['keysdown', 'List of the keys that are currently pressed.', [], 'string[]'],
        ['attach_trail', 'Make an object leave a trail (or a trail of arrows) as it moves.', ['object:any', 'options?:any'], 'void'],
        ['arange', 'Evenly spaced values, as in numpy.arange.', ['start:number', 'stop?:number', 'step?:number'], 'number[]']
    ]

    // constructors the docs don't describe with :param: fields
    var EXTRA_API = {
        wtext: {
            doc: 'Text in the web page that can be changed while the program runs.', params: [
                { name: 'text', type: 'string', doc: 'The text to display.' },
                { name: 'pos', type: 'vector', doc: 'Where to display it: a canvas position, or omit it to place it below the canvas.' },
                { name: 'canvas', type: 'object', doc: 'Default is scene.' }
            ]
        }
    }

    var CONSTANTS = [['pi', 'The ratio of the circumference of a circle to its diameter, 3.14159...', 'number']]

    var COLORS = {
        white: 'vec(1,1,1)', black: 'vec(0,0,0)', red: 'vec(1,0,0)', green: 'vec(0,1,0)', blue: 'vec(0,0,1)',
        cyan: 'vec(0,1,1)', magenta: 'vec(1,0,1)', yellow: 'vec(1,1,0)', orange: 'vec(1,0.6,0)', purple: 'vec(0.4,0.2,0.6)'
    }
    var COLOR_FUNCTIONS = [
        ['gray', 'A shade of gray, from 0 (black) to 1 (white).', ['g:number'], 'vector'],
        ['hsv_to_rgb', 'Convert a color given as vec(hue, saturation, value) to RGB.', ['c:vector'], 'vector'],
        ['rgb_to_hsv', 'Convert an RGB color to vec(hue, saturation, value).', ['c:vector'], 'vector']
    ]
    var TEXTURES = ['flower', 'granite', 'gravel', 'earth', 'metal', 'rock', 'rough', 'rug', 'stones', 'stucco', 'wood', 'wood_old']
    var BUMPMAPS = ['gravel', 'rock', 'stones', 'stucco']

    var VECTOR_MEMBERS = [
        ['x', 'x component.', 'number'], ['y', 'y component.', 'number'], ['z', 'z component.', 'number'],
        ['mag', 'Magnitude (length) of the vector.', 'number'], ['mag2', 'Square of the magnitude.', 'number'],
        ['hat', 'Unit vector in the same direction (also `norm`).', 'vector'], ['norm', 'Unit vector in the same direction (also `hat`).', 'vector'],
        ['dot', 'Dot product with another vector.', ['b:vector'], 'number'],
        ['cross', 'Cross product with another vector.', ['b:vector'], 'vector'],
        ['proj', 'Projection onto another vector.', ['b:vector'], 'vector'],
        ['comp', 'Scalar projection along another vector.', ['b:vector'], 'number'],
        ['diff_angle', 'Angle to another vector, in radians.', ['b:vector'], 'number'],
        ['rotate', 'Rotate the vector.', ['angle:number', 'axis?:vector'], 'vector']
    ]

    var CANVAS_MEMBERS = [ // of scene and any other canvas
        ['width', 'Width of the canvas in pixels.'], ['height', 'Height of the canvas in pixels.'],
        ['background', 'Background color.'], ['center', 'Location toward which the camera continually looks.'],
        ['forward', 'Vector pointing in the direction in which the camera points.'], ['up', 'A vector perpendicular to scene.forward.'],
        ['range', 'Distance from scene.center to the edge of the canvas.'], ['fov', 'Field of view of the camera, in radians.'],
        ['autoscale', 'If True, the camera zooms out automatically to keep all objects in view.'],
        ['userzoom', 'If True, the user can zoom in and out.'], ['userspin', 'If True, the user can rotate the camera.'],
        ['userpan', 'If True, the user can pan across the scene.'], ['title', 'Text above the canvas.'], ['caption', 'Text below the canvas.'],
        ['ambient', 'Color of the ambient light.'], ['lights', 'List of the lights in the scene.'], ['objects', 'List of the objects in the scene.'],
        ['camera', 'The camera of the canvas (pos, axis, rotate(), follow()).'], ['mouse', 'Current state of the mouse (pos, pick, ray, project(), ...).'],
        ['bind', 'Bind an event (such as "click" or "keydown") to a function: scene.bind("click", myfunction).'],
        ['unbind', 'Remove a binding made with bind.'], ['waitfor', 'Wait for an event: scene.waitfor("click").'],
        ['append_to_title', 'Add text to the title.'], ['append_to_caption', 'Add text to the caption.'],
        ['capture', 'Save an image of the canvas.'], ['delete', 'Remove the canvas and its objects.'], ['select', 'Make this the current canvas.']
    ]

    var SHAPES = ['arc', 'circle', 'cross', 'ellipse', 'gear', 'hexagon', 'line', 'ngon', 'octagon', 'pentagon', 'points', 'rectangle', 'star', 'trapezoid', 'triangle']

    var OBJECT_METHODS = [ // of every graphical object
        ['rotate', 'Rotate the object: obj.rotate(angle=radians, axis=vec, origin=vec).'],
        ['clone', 'Make a copy of the object, optionally changing attributes: obj.clone(pos=vec(1,0,0)).']
    ]
    var SEQUENCE_METHODS = { // curve, points, ...
        append: 'Add a point.', clear: 'Remove all points.', modify: 'Change a point.', slice: 'Return part of the sequence of points.'
    }

    var PY_KEYWORDS = ['and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
        'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
        'True', 'False', 'None']
    var PY_BUILTINS = ['range', 'len', 'int', 'float', 'str', 'list', 'dict', 'enumerate', 'zip', 'sorted', 'isinstance']

    var PY_SNIPPETS = [
        ['while True', 'Animation loop', 'while True:\n    rate(${1:100})\n    $0'],
        ['while', 'while loop', 'while ${1:condition}:\n    $0'],
        ['for', 'for loop over a range', 'for ${1:i} in range(${2:10}):\n    $0'],
        ['forin', 'for loop over a list', 'for ${1:item} in ${2:items}:\n    $0'],
        ['if', 'if statement', 'if ${1:condition}:\n    $0'],
        ['ifelse', 'if / else statement', 'if ${1:condition}:\n    $2\nelse:\n    $0'],
        ['def', 'Function definition', 'def ${1:name}(${2}):\n    $0'],
        ['class', 'Class definition', 'class ${1:Name}:\n    def __init__(self${2}):\n        $0'],
        ['try', 'try / except', 'try:\n    $1\nexcept ${2:Exception}:\n    $0']
    ]

    /********** State *********/

    var monaco = null
    var api = {}          // from glowscript-api.json: name -> {doc, params: [{name, type, doc}]}
    var functions = {}    // from FUNCTIONS
    var attrDocs = {}     // attribute name -> {doc, type}
    var libraryNames = {} // names offered by autocomplete
    var highlighted = {}  // names that get the library color (the whole symbols list)

    function parseParam(spec) { // "n?:number" -> {name:'n', type:'number', optional:true}
        var m = /^(\.\.\.)?(\w+)(\?)?:(.*)$/.exec(spec)
        return { name: m[2], type: m[4], optional: !!m[3], rest: !!m[1] }
    }

    function indexData(apiData, names) {
        api = apiData
        for (var name in EXTRA_API) if (!api[name]) api[name] = EXTRA_API[name]
        FUNCTIONS.forEach(function (f) { functions[f[0]] = { doc: f[1], params: f[2].map(parseParam), returns: f[3] } })
        for (var name in api) {
            api[name].params.forEach(function (p) {
                if (!attrDocs[p.name] || (!attrDocs[p.name].doc && p.doc)) attrDocs[p.name] = { doc: p.doc, type: p.type }
            })
        }
        if (names) names.forEach(function (n) { highlighted[n] = true })
        for (var n in api) libraryNames[n.split('.')[0]] = true
        for (var n in functions) libraryNames[n] = true
            ;['scene', 'color', 'shapes', 'paths', 'textures', 'bumpmaps', 'pi', 'canvas'].forEach(function (n) { libraryNames[n] = true })
        for (var n in libraryNames) highlighted[n] = true
        highlighted.wait = true
    }

    var ATTRIBUTE_WORDS = ['pos', 'axis', 'up', 'x', 'y', 'z', 'size', 'visible', 'forward', 'length', 'width', 'radius']

    /********** Documentation *********/

    function signatureOf(name, entry) {
        return name + '(' + entry.params.map(function (p) { return p.name }).join(', ') + ')'
    }

    function markdownForCall(name) {
        var entry = api[name], fn = functions[name]
        if (entry) {
            var text = '```python\n' + signatureOf(name, entry) + '\n```\n'
            if (entry.doc) text += entry.doc + '\n\n'
            return text + entry.params.slice(0, 12).map(function (p) {
                return '* `' + p.name + '` (' + (p.type || 'any') + ') ' + p.doc
            }).join('\n')
        }
        if (fn) {
            return '```python\n' + name + '(' + fn.params.map(function (p) { return p.name }).join(', ') + ')\n```\n' + fn.doc
        }
        return null
    }

    // attribute names are only documented after a ".", so a variable called "size" is left alone
    function markdownForWord(word, isMember) {
        var md = markdownForCall(word)
        if (md) return md
        for (var i = 0; i < CONSTANTS.length; i++) if (CONSTANTS[i][0] == word) return '`' + word + '`\n\n' + CONSTANTS[i][1]
        if (word == 'scene') return '`scene`\n\nThe default canvas, in which objects are displayed.'
        if (word == 'color') return '`color`\n\nNamed colors such as `color.red`, plus `color.gray()`, `color.hsv_to_rgb()` and `color.rgb_to_hsv()`.'
        if (!isMember) return null
        if (attrDocs[word] && attrDocs[word].doc) return '`' + word + '` (' + (attrDocs[word].type || 'attribute') + ')\n\n' + attrDocs[word].doc
        for (var i = 0; i < CANVAS_MEMBERS.length; i++) if (CANVAS_MEMBERS[i][0] == word) return '`scene.' + word + '`\n\n' + CANVAS_MEMBERS[i][1]
        for (var i = 0; i < VECTOR_MEMBERS.length; i++) if (VECTOR_MEMBERS[i][0] == word) return '`' + word + '`\n\n' + VECTOR_MEMBERS[i][1]
        return null
    }

    /********** Reading the program *********/

    // the call the cursor is inside: {name, argIndex, keyword}
    function enclosingCall(model, position) {
        var firstLine = Math.max(1, position.lineNumber - 40)
        var text = model.getValueInRange({ startLineNumber: firstLine, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column })
        var depth = 0, commas = 0, quote = null
        for (var i = text.length - 1; i >= 0; i--) {
            var c = text[i]
            if (quote) { if (c == quote && text[i - 1] != '\\') quote = null; continue }
            if (c == '"' || c == "'") { quote = c; continue }
            if (c == ')' || c == ']' || c == '}') depth++
            else if (c == '(' || c == '[' || c == '{') {
                if (depth > 0) { depth--; continue }
                if (c != '(') return null
                var m = /([A-Za-z_][\w.]*)\s*$/.exec(text.slice(0, i))
                if (!m) return null
                var args = text.slice(i + 1)
                var keyword = /(?:^|,)\s*(\w+)\s*=[^=,]*$/.exec(args)
                return { name: m[1], argIndex: commas, keyword: keyword ? keyword[1] : null, inKeywordValue: !!keyword }
            } else if (c == ',' && depth == 0) commas++
        }
        return null
    }

    // ball = sphere(...) -> {ball: 'sphere'}
    function variableTypes(model) {
        var types = {}
        var re = /^\s*(\w+)\s*=\s*([A-Za-z_][\w.]*)\s*\(/gm
        var m, text = model.getValue()
        while ((m = re.exec(text))) {
            if (api[m[2]]) types[m[1]] = m[2]
            else if (m[2] == 'vec' || m[2] == 'vector') types[m[1]] = 'vector'
        }
        return types
    }

    // ball.v = vec(1,0,0) -> {ball: {v: {type: 'vector', line: 12}}}
    function userAttributes(model) {
        var attrs = {}
        var re = /(?:^|[^\w.])([A-Za-z_]\w*)\.([A-Za-z_]\w*)[ \t]*=(?!=)[ \t]*([^\n]*)/gm
        var m, text = model.getValue()
        while ((m = re.exec(text))) {
            var rhs = m[3], type = ''
            if (/^(?:vec|vector)\s*\(/.test(rhs)) type = 'vector'
            var mine = attrs[m[1]] || (attrs[m[1]] = {})
            if (!mine[m[2]]) mine[m[2]] = { type: type, line: model.getPositionAt(m.index + m[0].indexOf(m[2])).lineNumber }
            else if (type && !mine[m[2]].type) mine[m[2]].type = type
        }
        return attrs
    }

    function userAttributeItems(attrs, range, skip) {
        var items = []
        for (var name in attrs) {
            if (skip[name]) continue
            items.push(item(name, 'Field', {
                detail: attrs[name].type || 'attribute assigned in this program',
                documentation: 'Assigned on line ' + attrs[name].line, range: range, sortText: '00' + name
            }))
        }
        return items
    }

    // type of the expression before a ".", or null
    function typeOfChain(chain, types, attrs) {
        var parts = chain.split('.').filter(Boolean)
        var t = parts[0]
        if (t == 'scene') t = 'canvas'
        else if (types[t]) t = types[t]
        else if (['color', 'shapes', 'textures', 'bumpmaps'].indexOf(t) < 0) return null
        for (var i = 1; i < parts.length; i++) {
            if (t == 'canvas' && parts[i] == 'camera') { t = 'camera'; continue }
            var entry = api[t]
            var p = entry && entry.params.filter(function (q) { return q.name == parts[i] })[0]
            if (p && p.type == 'vector') t = 'vector'
            else if (t == 'canvas' && parts[i] == 'mouse') t = 'scene.mouse'
            else if (i == 1 && attrs && attrs[parts[0]] && attrs[parts[0]][parts[1]] && attrs[parts[0]][parts[1]].type) t = attrs[parts[0]][parts[1]].type
            else return null
        }
        return t
    }

    function item(label, kind, extra) {
        var CK = monaco.languages.CompletionItemKind
        var result = { label: label, kind: CK[kind] }
        for (var k in extra) result[k] = extra[k]
        return result
    }

    function methodItem(name, doc, args) {
        return item(name, 'Method', {
            documentation: doc, insertText: name + '(${1})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            command: { id: 'editor.action.triggerParameterHints', title: '' }
        })
    }

    function membersOf(type, range) {
        var items = [], i
        function prop(name, doc, detail) { items.push(item(name, 'Field', { documentation: doc, detail: detail, range: range })) }
        function method(name, doc) { var it = methodItem(name, doc); it.range = range; items.push(it) }
        if (type == 'color') {
            for (var c in COLORS) items.push(item(c, 'Color', { detail: COLORS[c], range: range }))
            COLOR_FUNCTIONS.forEach(function (f) { method(f[0], f[1]) })
        } else if (type == 'shapes') {
            SHAPES.forEach(function (s) { method(s, 'shapes.' + s + '(...) makes a 2D shape for extrusions.') })
        } else if (type == 'textures') {
            TEXTURES.forEach(function (t) { items.push(item(t, 'Constant', { range: range })) })
        } else if (type == 'bumpmaps') {
            BUMPMAPS.forEach(function (t) { items.push(item(t, 'Constant', { range: range })) })
        } else if (type == 'vector') {
            VECTOR_MEMBERS.forEach(function (m) {
                if (m.length == 3) prop(m[0], m[1], m[2])
                else method(m[0], m[1])
            })
        } else if (type == 'canvas') {
            CANVAS_MEMBERS.forEach(function (m) { (/^(bind|unbind|waitfor|append_to_title|append_to_caption|capture|delete|select)$/.test(m[0]) ? method : prop)(m[0], m[1]) })
        } else if (type == 'camera') {
            prop('pos', 'The position of the camera.'); prop('axis', 'The direction in which the camera is pointing.')
            method('rotate', 'Rotate the camera.'); method('follow', 'Reset the center of the scene to follow an object; follow(None) stops.')
        } else if (type == 'scene.mouse') {
            ['pos', 'pick', 'ray', 'alt', 'ctrl', 'shift'].forEach(function (n) { prop(n, (attrDocs[n] || {}).doc) })
            method('project', 'Project the mouse position onto a plane: project(normal=vec, point=vec).')
        } else if (api[type]) {
            api[type].params.forEach(function (p) { prop(p.name, p.doc, p.type) })
            OBJECT_METHODS.forEach(function (m) { method(m[0], m[1]) })
            if (/^(curve|points|extrusion|compound|gcurve|gdots)$/.test(type))
                for (var s in SEQUENCE_METHODS) method(s, SEQUENCE_METHODS[s])
        } else {
            // unknown owner
            for (var name in attrDocs) prop(name, attrDocs[name].doc, attrDocs[name].type)
            VECTOR_MEMBERS.forEach(function (m) { if (m.length == 4) method(m[0], m[1]) })
            OBJECT_METHODS.forEach(function (m) { method(m[0], m[1]) })
        }
        // rank ahead of Monaco's word suggestions
        items.forEach(function (it) { if (!it.sortText) it.sortText = '0' + it.label })
        return items
    }

    /********** Python providers *********/

    var pythonCompletions = {
        triggerCharacters: ['.'],
        provideCompletionItems: function (model, position) {
            var word = model.getWordUntilPosition(position)
            var range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }
            var before = model.getLineContent(position.lineNumber).slice(0, word.startColumn - 1)
            var dotted = /([A-Za-z_][\w.]*)\.$/.exec(before)
            if (dotted) {
                var attrs = userAttributes(model)
                var owner = dotted[1].split('.')
                var items = membersOf(typeOfChain(dotted[1], variableTypes(model), attrs), range)
                if (owner.length == 1 && attrs[owner[0]]) {
                    var have = {}
                    items.forEach(function (it) { have[it.label] = true })
                    items = userAttributeItems(attrs[owner[0]], range, have).concat(items)
                }
                return { suggestions: items }
            }
            if (/^\s*#/.test(before) || (before.match(/["']/g) || []).length % 2 == 1) return { suggestions: [] } // comment or string

            var CK = monaco.languages.CompletionItemKind
            var Snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            var suggestions = []
            var call = enclosingCall(model, position)
            if (call && api[call.name] && !call.inKeywordValue) {
                api[call.name].params.forEach(function (p) {
                    suggestions.push(item(p.name + '=', 'Property', {
                        detail: p.type, documentation: p.doc, insertText: p.name + '=', range: range, sortText: '0' + p.name,
                        filterText: p.name
                    }))
                })
            }
            PY_KEYWORDS.forEach(function (k) { suggestions.push(item(k, 'Keyword', { insertText: k, range: range, sortText: '3' + k })) })
            PY_BUILTINS.forEach(function (k) { suggestions.push(item(k, 'Function', { insertText: k + '(${1})', insertTextRules: Snippet, range: range, sortText: '2' + k })) })
            PY_SNIPPETS.forEach(function (s) {
                suggestions.push(item(s[0], 'Snippet', { detail: s[1], insertText: s[2], insertTextRules: Snippet, range: range, sortText: '1' + s[0] }))
            })
            for (var name in libraryNames) {
                if (name == 'scene' || name == 'color' || name == 'shapes' || name == 'paths' || name == 'textures' || name == 'bumpmaps') {
                    suggestions.push(item(name, 'Module', { insertText: name, range: range, sortText: '1' + name, documentation: { value: markdownForWord(name) || '' } }))
                } else if (name == 'pi') {
                    suggestions.push(item(name, 'Constant', { insertText: name, range: range, sortText: '1' + name, documentation: CONSTANTS[0][1] }))
                } else if (api[name] || functions[name]) {
                    var md = markdownForCall(name)
                    suggestions.push(item(name, api[name] ? 'Class' : 'Function', {
                        insertText: name + '(${1})', insertTextRules: Snippet, range: range, sortText: '1' + name,
                        documentation: md ? { value: md } : undefined,
                        command: { id: 'editor.action.triggerParameterHints', title: '' }
                    }))
                }
            }
            return { suggestions: suggestions }
        }
    }

    // the TypeScript service doesn't see attributes added by assignment
    var javascriptUserAttributes = {
        triggerCharacters: ['.'],
        provideCompletionItems: function (model, position) {
            var word = model.getWordUntilPosition(position)
            var range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }
            var dotted = /([A-Za-z_$][\w$.]*)\.$/.exec(model.getLineContent(position.lineNumber).slice(0, word.startColumn - 1))
            if (!dotted) return { suggestions: [] }
            var owner = dotted[1].split('.'), attrs = userAttributes(model)
            if (owner.length == 1 && attrs[owner[0]]) return { suggestions: userAttributeItems(attrs[owner[0]], range, {}) }
            if (owner.length == 2 && attrs[owner[0]] && attrs[owner[0]][owner[1]] && attrs[owner[0]][owner[1]].type == 'vector')
                return { suggestions: membersOf('vector', range) }
            return { suggestions: [] }
        }
    }

    var pythonHover = {
        provideHover: function (model, position) {
            var word = model.getWordAtPosition(position)
            if (!word) return null
            var line = model.getLineContent(position.lineNumber)
            if (/^\s*#/.test(line.slice(0, word.startColumn))) return null
            var md = null
            var isMember = /\.$/.test(line.slice(0, word.startColumn - 1))
            // a keyword argument documents that argument
            var call = enclosingCall(model, { lineNumber: position.lineNumber, column: word.endColumn })
            if (call && api[call.name] && /^\s*=[^=]/.test(line.slice(word.endColumn - 1))) {
                var p = api[call.name].params.filter(function (q) { return q.name == word.word })[0]
                if (p) md = '`' + p.name + '` (' + (p.type || 'any') + ') of `' + call.name + '`\n\n' + p.doc
            }
            if (!md && isMember) {
                var owner = /([A-Za-z_]\w*)\.$/.exec(line.slice(0, word.startColumn - 1))
                var mine = owner && userAttributes(model)[owner[1]]
                if (mine && mine[word.word] && !(api[variableTypes(model)[owner[1]]] || { params: [] }).params.some(function (q) { return q.name == word.word }))
                    md = '`' + owner[1] + '.' + word.word + '`' + (mine[word.word].type ? ' (' + mine[word.word].type + ')' : '') +
                        '\n\nAttribute assigned in this program (first on line ' + mine[word.word].line + ').'
            }
            if (!md) md = markdownForWord(word.word, isMember)
            if (!md) return null
            return { range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn), contents: [{ value: md }] }
        }
    }

    var pythonSignatures = {
        signatureHelpTriggerCharacters: ['(', ','],
        signatureHelpRetriggerCharacters: [')'],
        provideSignatureHelp: function (model, position) {
            var call = enclosingCall(model, position)
            if (!call) return null
            var entry = api[call.name], fn = functions[call.name]
            var params
            if (entry) params = entry.params.map(function (p) { return { name: p.name, doc: p.doc, type: p.type } })
            else if (fn) params = fn.params.map(function (p) { return { name: p.name, doc: '', type: p.type } })
            else return null
            var label = call.name + '(' + params.map(function (p) { return p.name }).join(', ') + ')'
            var active = call.keyword ? params.map(function (p) { return p.name }).indexOf(call.keyword) : call.argIndex
            if (active < 0 || active >= params.length) active = entry ? -1 : Math.min(call.argIndex, params.length - 1)
            return {
                value: {
                    signatures: [{
                        label: label,
                        documentation: entry ? (entry.doc || '') : (fn.doc || ''),
                        parameters: params.map(function (p) {
                            return { label: p.name, documentation: { value: (p.type ? '*' + p.type + '* ' : '') + p.doc } }
                        })
                    }],
                    activeSignature: 0, activeParameter: Math.max(active, 0)
                },
                dispose: function () { }
            }
        }
    }

    /********** Highlighting *********/

    var TOKEN_TYPES = ['glowlib', 'glowattr', 'glowwait', 'glowheader']

    function semanticTokens(languageId) {
        var comment = languageId == 'python' ? '#.*' : '\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/'
        var skip = new RegExp(comment + '|"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`|([A-Za-z_$][\\w$]*)', 'g')
        var header = /^(?:GlowScript|Web\s+VPython)\s+[\d.]*[dev]*(?:\s+[A-Za-z]+)?/
        return {
            getLegend: function () { return { tokenTypes: TOKEN_TYPES, tokenModifiers: [] } },
            provideDocumentSemanticTokens: function (model) {
                var data = [], prevLine = 0, prevChar = 0
                function push(offset, length, type) {
                    var pos = model.getPositionAt(offset)
                    var line = pos.lineNumber - 1, ch = pos.column - 1
                    data.push(line - prevLine, line == prevLine ? ch - prevChar : ch, length, type, 0)
                    prevLine = line; prevChar = ch
                }
                var text = model.getValue()
                var h = header.exec(text.split('\n', 1)[0])
                if (h) push(0, h[0].length, 3)
                var m
                skip.lastIndex = h ? h[0].length : 0
                while ((m = skip.exec(text))) {
                    var w = m[1]
                    if (!w || !highlighted[w]) continue
                    if (w == 'wait') push(m.index, w.length, 2)
                    else if (ATTRIBUTE_WORDS.indexOf(w) >= 0) push(m.index, w.length, 1)
                    else push(m.index, w.length, 0)
                }
                return { data: new Uint32Array(data) }
            },
            releaseDocumentSemanticTokens: function () { }
        }
    }

    /********** JavaScript declarations *********/

    function tsType(t) {
        t = (t || '').toLowerCase()
        if (t == 'vector') return 'vector'
        if (t == 'scalar' || t == 'number' || /^(integer|int|float)/.test(t)) return 'number'
        if (t == 'boolean') return 'boolean'
        if (t == 'string') return 'string'
        return 'any'
    }

    function jsdoc(text) { return text ? '/** ' + text.replace(/\*\//g, '* /') + ' */\n' : '' }

    function declarations() {
        var d = []
        d.push('interface vector { x: number; y: number; z: number;')
        VECTOR_MEMBERS.forEach(function (m) {
            if (m.length == 3) { if (!/^[xyz]$/.test(m[0])) d.push(jsdoc(m[1]) + 'readonly ' + m[0] + ': ' + m[2] + ';') }
            else d.push(jsdoc(m[1]) + m[0] + '(' + m[2].map(tsParam).join(', ') + '): ' + m[3] + ';')
        })
        d.push('}')
        FUNCTIONS.forEach(function (f) {
            d.push(jsdoc(f[1]) + 'declare function ' + f[0] + '(' + f[2].map(tsParam).join(', ') + '): ' + f[3] + ';')
        })
        CONSTANTS.forEach(function (c) { d.push(jsdoc(c[1]) + 'declare const ' + c[0] + ': ' + c[2] + ';') })
        d.push('declare const color: {' + Object.keys(COLORS).map(function (c) { return c + ': vector;' }).join(' ') + ' ' +
            COLOR_FUNCTIONS.map(function (f) { return f[0] + '(' + f[2].map(tsParam).join(', ') + '): ' + f[3] + ';' }).join(' ') + '};')
        d.push('declare const shapes: {' + SHAPES.map(function (s) { return s + '(options?: any): any;' }).join(' ') + '};')
        d.push('declare const textures: {' + TEXTURES.map(function (t) { return t + ': any;' }).join(' ') + '};')
        d.push('declare const bumpmaps: {' + BUMPMAPS.map(function (t) { return t + ': any;' }).join(' ') + '};')
        d.push('declare const paths: any;')

        var canvasMembers = CANVAS_MEMBERS.map(function (m) {
            var isMethod = /^(bind|unbind|waitfor|append_to_title|append_to_caption|capture|delete|select)$/.test(m[0])
            return jsdoc(m[1]) + m[0] + (isMethod ? '(...args: any[]): any;' : ': any;')
        })
        d.push('interface GlowScriptCanvas {\n' + canvasMembers.join('\n') + '\n}')
        d.push('declare const scene: GlowScriptCanvas;')

        for (var name in api) {
            if (name.indexOf('.') >= 0 || !/^\w+$/.test(name) || functions[name]) continue
            var opts = name + 'Options'
            var props = api[name].params.map(function (p) { return jsdoc(p.doc) + p.name + '?: ' + tsType(p.type) + ';' })
            d.push('interface ' + opts + ' {\n' + props.join('\n') + '\n}')
            if (name == 'canvas') {
                d.push(jsdoc(api[name].doc) + 'declare function canvas(options?: canvasOptions): GlowScriptCanvas;')
                continue
            }
            var members = OBJECT_METHODS.map(function (m) { return jsdoc(m[1]) + m[0] + '(...args: any[]): any;' })
            d.push('interface ' + name + 'Object extends Required<' + opts + '> {\n' + members.join('\n') + '\n[key: string]: any;\n}')
            d.push(jsdoc(api[name].doc) + 'declare function ' + name + '(options?: ' + opts + '): ' + name + 'Object;')
        }
        return d.join('\n')
    }

    function tsParam(spec) {
        var p = parseParam(spec)
        return (p.rest ? '...' : '') + p.name + (p.optional ? '?' : '') + ': ' + p.type
    }

    var ready = null

    // names is window.GlowscriptLibraryNames; returns a promise
    function setup(monacoApi, names) {
        if (ready) return ready
        monaco = monacoApi
        ready = fetch('lib/glowscript-api.json').then(function (r) { return r.json() }).catch(function () { return {} }).then(function (data) {
            indexData(data, names)

            monaco.languages.registerCompletionItemProvider('python', pythonCompletions)
            monaco.languages.registerHoverProvider('python', pythonHover)
            monaco.languages.registerCompletionItemProvider('javascript', javascriptUserAttributes)
            monaco.languages.registerSignatureHelpProvider('python', pythonSignatures)
            monaco.languages.registerDocumentSemanticTokensProvider('python', semanticTokens('python'))
            monaco.languages.registerDocumentSemanticTokensProvider('javascript', semanticTokens('javascript'))

            var js = monaco.languages.typescript.javascriptDefaults
            js.setCompilerOptions({ target: monaco.languages.typescript.ScriptTarget.ES2020, allowNonTsExtensions: true, allowJs: true, checkJs: false })
            // no squiggles: GlowScript JavaScript uses vector operators and implicit globals
            js.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true })
            js.addExtraLib(declarations(), 'glowscript-library.d.ts')

            monaco.editor.defineTheme('glowscript', {
                base: 'vs',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: 'AA0D91' },
                    { token: 'glowwait', foreground: 'FF0000' },
                    { token: 'glowlib', foreground: '0000FF' },
                    { token: 'glowattr', foreground: '0000FF' },
                    { token: 'glowheader', foreground: 'AA0D91' },
                    { token: 'comment', foreground: 'A0A0A0' },
                    { token: 'string', foreground: '0F8246' },
                    { token: 'number', foreground: '0F8246' },
                    { token: 'regexp', foreground: '0F8246' }
                ],
                colors: {
                    'editor.background': '#FFFFFF',
                    'editorGutter.background': '#E8E8E8',
                    'editorLineNumber.foreground': '#333333',
                    'editorLineNumber.activeForeground': '#000000'
                }
            })
        })
        return ready
    }

    return { setup: setup }
})()
