// vector operator overloading, extracted by Salvatore di Dio from the
// PaperScript project of Juerg Lehni. Modified by Bruce Sherwood for greater speed.
// The GlowScript vector class is in file vectors.js.

/*
Salvatore di Dio demonstrated in his RapydGlow experiment (http://salvatore.pythonanywhere.com/RapydGlow)
how he was able to use the RapydScript Python-to-JavaScript compiler with GlowScript graphics.
This inspired the implementation of the VPython (vpython.org) API at glowscript.org.
He provided this file for operator overloading, based on the work of
    Juerg Lehni (PaperScript: http://scratchdisk.com/posts/operator-overloading).
He also assembled support for operator overloading and the ability to write synchronous code
in the file transform-all.js, based on the work of
    Bruno Jouhier (Streamline: https://github.com/Sage/streamlinejs), and
    Marijn Haverbeke (Acorn.js: https://github.com/marijnh).
Supporting the VPython API in a browser is possible thanks to the work of
    Alexander Tsepkov (RapydScript: https://bitbucket.org/pyjeon/rapydscript) and
    Charles Law (browser-based RapydScript: http://pyjeon.pythonanywhere.com/static/rapydscript_online/index.html).

When the GlowScript project was launched in 2011 by David Scherer and Bruce Sherwood,
Scherer implemented operator overloading and synchronous code using libraries existing at that time.
In 2015 it became necessary to upgrade to newer libraries because compilation failed on some browsers.

In December 2016 Bruce Sherwood deleted an old embedded version of acorn and invoked up-to-date acorn.es.js
*/

/* The following code is in GlowScript vectors.js:
    String.prototype['+'] = function (r) { return this + r }
    Number.prototype['+'] = function (r) { return this + r }
    Number.prototype['-'] = function (r) { return this - r }
    Number.prototype['*'] = function (r) { // check whether right operand is Number or vec
    	return (r instanceof vec) ? r.multiply(this) : r*this
    	}
    Number.prototype['/'] = function (r) { return this / r }
    Number.prototype["-u"] = function () { return -this }
    vec.prototype['+'] = vec.prototype.add
    vec.prototype['-'] = vec.prototype.sub
    vec.prototype['*'] = vec.prototype.multiply
    vec.prototype['/'] = function (r) { return this.divide(r) }
    vec.prototype["-u"] = function () { return new vec(-this.x, -this.y, -this.z) }
*/

function isNumeric(num ) {
    return ((num >= 0) || (num < 0) && (parseInt(num) === num));
}
		
var binaryOperators = { // These are functions in the vector class, in vector.js
    '+': 'add',
    '-': 'sub',
    '*': 'multiply',
    '/': 'divide',
    '%': 'modulo'
}; // removed "==" and "!=" because they are used not only for vector/Number comparisons

var unaryOperators = {
    '-': 'negate',
    '+': 'plus'
};

function papercompile(code) {

    var insertions = [];

    function getOffset(offset) {
        for (var i = 0, l = insertions.length; i < l; i++) {
            var insertion = insertions[i];
            if (insertion[0] >= offset)
                break;
            offset += insertion[1];
        }
        return offset;
    }

    function getCode(node) {
        return code.substring(getOffset(node.range[0]),
            getOffset(node.range[1]));
    }

    function replaceCode(node, str) {
        var start = getOffset(node.range[0]),
            end = getOffset(node.range[1]);
        var insert = 0;
        for (var i = insertions.length - 1; i >= 0; i--) {
            if (start > insertions[i][0]) {
                insert = i + 1;
                break;
            }
        }
        insertions.splice(insert, 0, [start, str.length - end + start]);
        code = code.substring(0, start) + str + code.substring(end);
    }

    function walkAST(node, parent) {
        if (!node)
            return;
        for (var key in node) {
            if (key === 'range')
                continue;
            var value = node[key];
            if (Array.isArray(value)) {
                for (var i = 0, l = value.length; i < l; i++)
                    walkAST(value[i], node);
            } else if (value && typeof value === 'object') {
                walkAST(value, node);
            }
        }
        var left;
        var right;
        var arg;
        switch (node && node.type) {
        case 'BinaryExpression': // This converts a+b => a["+"](b)
            if (node.operator in binaryOperators) {
                left = getCode(node.left);
                right = getCode(node.right);
                arg = binaryOperators[node.operator]
                replaceCode(node, left+'["'+node.operator+'"]('+right+')');
            }
            break;
        /*
        // += doesn't work in the main interesting case v += vec(1,2,3); would need to reprocess v+vec(1,2,3)
        case 'AssignmentExpression':
            if (/^.=$/.test(node.operator)) {
                left = getCode(node.left);
                right = getCode(node.right);
                replaceCode(node, left + ' = _$_(' + left + ', "' + node.operator[0] + '", ' + right + ')');
            }
            break;
        case 'UpdateExpression': // never seem to encounter this case; don't know what it is
            if (!node.prefix && !(parent && (
                parent.type === 'BinaryExpression'
                    && /^[=!<>]/.test(parent.operator)
                    || parent.type === 'MemberExpression'
                        && parent.computed))) {
                arg = getCode(node.argument);
                replaceCode(node, arg + ' = _$_(' + arg + ', "' + node.operator[0] + '", 1)');
            }
            break;
        */
        case 'UnaryExpression': // This converts -a => a["-a]() and +a => a
            if (node.operator in unaryOperators) {
                arg = getCode(node.argument);
                if (node.operator == "-") replaceCode(node, arg+'["-u"]()');
                else replaceCode(node, arg);
            }
            break;
        }
    }
    walkAST(window.call_acorn_parse(code, { ranges: true })); 
    return code;
}
