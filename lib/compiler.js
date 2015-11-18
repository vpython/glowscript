(function () {
    "use strict";
    
	var VPython_import = null // can be visual or vis
	var VPython_names = []    // e.g. [box, cylinder] or [] if none specified (e.g. import visual)
    var waitlist = [new RegExp('^rate\\s*\\('), new RegExp('sleep\\s*\\('), 
                    new RegExp('^get_library\\s*\\('),  new RegExp('\\.waitfor\\s*\\('), 
                    new RegExp('\\.pause\\s*\\('), new RegExp('=\\s*read_local_file\\s*\\(') ]
    
	function waits(line) {
		for (var i=0; i<waitlist.length; i++) {
            var patt = waitlist[i]
            if (line.search(patt) >= 0) {
                var end = line.lastIndexOf(')')
                var lastparen = end
                var parencnt = 1
                var spaces = ''
                var name = ''
                while (end >= 0) {
					end--
					if (end < 0) break
                    switch (line[end]) {
                    case (')'):
                        parencnt++
                        break
                    case ('('):
                        parencnt--
                        if (parencnt === 0) {
                            if (name.length === 0) return line.slice(0,end)+'(wait'+spaces+')'
                            else {
                                if (name == 'wait') return line.slice(0,lastparen)+spaces+' )' // signal "wait" by lengthening line
                                return line.slice(0,lastparen)+','+spaces+'wait)'
                            }
                        }
                        break
                    case (','):
                        if (parencnt === 1) {
                            if (name == 'wait') return line.slice(0,end)+','+spaces+' wait)' // signal "wait" by lengthening line
                            return line
                        }
                        break
                    case (' '):
                        spaces = ' '+spaces
                        break
                    default:
                        name = line[end]+name
                    }
				}
            }
        }
        return line
    }
		
    function insertLineNumbers(program, lang) {
    	// insert ###N###\n before each CoffeeScript line, where N is original line number (starting with 2)
    	// After conversion to JavaScript, these insertions have the form "N";\n
    	// The CoffeeScript switch statement requires special handling, because placing anything just before
    	//    a when or else statement will not compile.
    	// Insert "N"\n before each RapydScript line, where N is original line number (starting with 2)
    	var c, lineno, lines, line, m, start
    	var parens = 0, brackets = 0, braces = 0
    	var lastleftparens = null, lastleftbracket = null, lastleftbrace = null
	    var indent = ''
    	var getline = /(^\s*)(.*)/
    	var newprogram = '', comment = false, lastindent = ''
    	var firstquote = 0 // 0: no string; 1: string starts with '; 2: string starts with " (or """)
    	var continuedline = false
    	var indef = false // true if processing an anonymous def in RapydScript
    	var delim
    	var defindents = []  // stack of [def or class character location, length of def or class indent]
    	var whenpatt = /when[ ]/
	    var magpatt = /(\.mag)\s*(.)/g
    	var mag2patt = /(\.mag2)\s*(.)/g
        var pickpatt = /(\.pick)\s*(.)/
    	var defpatt = /def[^:]*:/
	    var classpatt = /class[^:]*:/
	    if (lang == 'coffeescript') {delim = '###'} 
	    else {delim = '"'}
    	var decoration
	    lines = program.split('\n')
    	// If blank line or comments, do not insert "N"\n and do not add to newprogram
		for (lineno=0; lineno<lines.length; lineno++) {
			decoration = ''
			if (lines[lineno].length >= 3) {
				start = lines[lineno].slice(0,3)
			    if (lang == 'coffeescript' && start == '###') {
				    comment = !comment
				    continue
			    }
			}
		    if (comment) continue
		    m = lines[lineno].match(getline)
		    indent = m[1]
		    line = m[2]
		    if (line[0] == '#') continue

	    	if (lang != 'coffeescript' && line[0] == '@') { // such as @kwargs
	    		var nextline = lines[lineno+1]
	    		m = nextline.match(getline)
	    		if (m[2].slice(0,3) == 'def' || m[2].slice(0,6) == 'module') {
	    			decoration = line
	    			indent = m[1]
	    			line = m[2]
	    			lineno++
	    		} else {
	    			continue
	    		}
	    	}
		    
		    if (line.length === 0) continue
		    
			if (lang == 'vpython') {
		    	if (defindents.length > 0 && indent.length <= defindents[defindents.length-1][1]) defindents.pop()
		    	
		    	// 'from visual import *'  // this is the default
		    	// 'from visual import box, vec  '  // selective version of visual import
	    		// 'import visual' // create visual = {box:vp_box, sphere:vp_sphere, etc.}
	    		// 'from vis import box, vec' // create vis = {box:vp_box, vec:vec}
	    		// 'import vis' // create vis = {box:vp_box, sphere:vp_sphere, etc.}

				if (VPython_import === null) VPython_names = []
				var w = line.split(' ')
				if (w[1] == '__future__') continue
				if (w[1] == 'visual.factorial') continue
	    		if (w[0] == 'from' && w[2] == 'import' && w.length >= 4) { // from X import a, b, c (or *)
	    			if (w[1] == 'visual.graph') {
	    				if (w[3] == '*') continue // from visual.graph import * is the only graph import supported at the moment
	    				return 'ERROR: Currently only "from visual.graph import *" is supported, line '+(lineno+2)+": "+lines[lineno]
	    			}
	    			if (!(w[1] == 'visual' || w[1] == 'vis')) {
	    				throw new Error("Line "+(lineno+2)+": cannot import from "+w[1])
	    			}
	    		    if (VPython_import === null) {
	    		    	if (w[3] == '*') continue // from visual import * is the default
	    		    	VPython_import = w[1]
	    		        for (var j=3; j<w.length; j++) {
	    		            if (w[j].length > 0 && w[j] != ',') {
	    		                if (w[j].slice(-1) == ',') w[j] = w[j].slice(0,-1)
	    		                if (w[j] == ' ' || w[j] == '(' || w[j] == ')' || w[j][0] == '(' || w[j][-1] == ')') continue
	    		                VPython_names.push(w[j])
	    		            }
	    		        }
	    		    }
	    		    continue
	    		} else if (w[0] == 'import' && w.length == 2) { // import X
	    			if (w[1] == 'visual.graph') return 'ERROR: Currently only "from visual.graph import *" is supported, line '+(lineno+2)+": "+lines[lineno]
	    			if (!(w[1] == 'visual' || w[1] == 'vis')) {
	    				return "ERROR: Cannot import from "+w[1]+", line "+(lineno+2)+": "+lines[lineno]
	    			}
	    		    if (VPython_import === null) {
	    		    	VPython_import = w[1]
	    		    }
	    		    continue
	    		}
			}
		    
		    if (lang == 'coffeescript') {
		    	var when = line.match(whenpatt)
		    	if (when !== null) {
		    		newprogram += lines[lineno]+'\n'
		    		continue
		    	}
		    }
	    	var doublequote = false, singlequote = false, backslash = false
	    	var previouscontinuedline = continuedline
	    	var triplequote = false // true if in the midst of """......"""
	    	var processedtriplequote = false
	    	var tline = ""
	    	for (var i=0; i<line.length; i++) {
	    		var previousquote = singlequote || doublequote || triplequote
	    		// If there are quotes we stay in this loop to collect the entire string
	    		var char = line[i]
	    		if (char == '\\' && i < line.length-1 && line[i+1] !== ' ') { // handle e.g. \"
	    			i++
	    			continue
	    		}
	    		switch (char) {
	    		case '#':
	    			if (!singlequote && !doublequote && !triplequote) { // remove trailing comments
			    			line = line.slice(0,i)
	    			}
	    			break
	    		case '"':
	    			if (lang != "coffeescript" && i <= line.length-3 && line[i+1] == '"' && line[i+2] == '"') {
	    				if (triplequote && i <= line.length-4 && line[i+3] == '"') break
	    				triplequote = !triplequote
	    				processedtriplequote = true
	    				i += 2
	    			} else if (!triplequote && !singlequote) doublequote = !doublequote
	    			break
	    		case "'":
	    			if (lang != "coffeescript" && i <= line.length-3 && line[i+1] == "'" && line[i+2] == "'") {
	    				if (triplequote && i <= line.length-4 && line[i+3] == "'") break
	    				triplequote = !triplequote
	    				processedtriplequote = true
	    				i += 2
	    			} else if (!triplequote && !doublequote) singlequote = !singlequote
	    			break
	    		}
	    		if (triplequote && i == line.length-1) {
	    			lineno++
	    			line += '\n' + lines[lineno]
	    		}
	    		if (singlequote || doublequote || triplequote) continue
	    		
	    		switch (char) {
	    		case ':':
	    			if (lang != 'coffeescript' && parens == 1) { // anonymous function
	    				indef = true
	    			}
	    			break
	    		case '(':
	    			if (i > 0 && line[i-1] == '\\') break // check for \( in a regular expression
	    			if (parens === 0) lastleftparens = lineno
	    			parens++
	    			break
	    		case ')':
	    			if (i > 0 && line[i-1] == '\\') break // check for \) in a regular expression
	    			parens--
	    			if (lang != 'coffeescript' && indef && parens == 0) indef = false
	    			break
	    		case '[':
	    			if (i > 0 && line[i-1] == '\\') break // check for \[ in a regular expression
	    			if (brackets === 0) lastleftbracket = lineno
	    			brackets++
	    			break
	    		case ']':
	    			if (i > 0 && line[i-1] == '\\') break // check for \] in a regular expression
	    			brackets--
	    			break
	    		case '{':
	    			if (i > 0 && line[i-1] == '\\') break // check for \{ in a regular expression
	    			if (braces === 0) lastleftbrace = lineno
	    			braces++
	    			break
	    		case '}':
	    			if (i > 0 && line[i-1] == '\\') break // check for \} in a regular expression
	    			braces--
	    			break
	    		}
	    		if (char == '\\') {
	    			if (i == line.length-1 || line[i+1] == ' ' || line[i+1] == '#')
		    			line = line.slice(0,i)
		    			backslash = true
		    			break
	    		}
	    	}
    		continuedline =  ( !indef && (backslash || (parens > 0) || (brackets > 0) || (braces > 0)) )

		    if (lang == 'vpython' && !previousquote) {
		    	var m
		    	while ((m = magpatt.exec(line+' ')) !== null) { // convert v.mag -> v.mag()
		    		if (m[2] != '(' && m[2] != '2' && (m[2].search(/\w/) != 0)) {
			    		var i = m.index
		    			line = line.slice(0,i) + '.mag()' + line.slice(i+4)
		    		}
		    	}
		    	while ((m = mag2patt.exec(line+' ')) !== null) { // convert v.mag2 -> v.mag2()
		    		if (m[2] != '(' && (m[2].search(/\w/) != 0)) {
			    		var i = m.index
		    			line = line.slice(0,i) + '.mag2()' + line.slice(i+5)
		    		}
		    	}
		    	m = pickpatt.exec(line+' ') // convert v.pick -> v.pick()
		    	if (m) {
		    		if (m[2] != '(' && (m[2].search(/\w/) != 0)) {
		    			var i = m.index
		    			line = line.slice(0,i)+'.pick()'+line.slice(i+5)
		    		}
		    	}
			    
			    if (!processedtriplequote) { // don't make adjustments inside a triplequote comment
			    	line = line.replace(/global/,'nonlocal')
			    	line = line.replace(/\.mouse\.camera/g,'.camera.pos')
			    	if (line.search(defpatt) >= 0 || line.search(classpatt) >= 0) {
			    		defindents.push([newprogram.length, indent.length]) // remember where this line is; it may need 'wait'
			    	} else {
				    	// Look for rate, sleep, get_library, .waitfor, .pause, read_local_file, and 
						// insert 'wait' argument (and if inside a function, insert earlier 'wait')
			    		var L = line.length
			    		line = waits(line) // THIS IS THE PROBLEM
			    		if (line.length > L) {
			    			while (true) {
				    			var definfo = defindents.pop() // [location of def or class in newprogram, indent level]
				    			if (definfo == undefined) break
				    			var end = newprogram.slice(definfo[0]).search(/:/) + definfo[0]
				    			while (newprogram[end] !== ')') end--
				    			var i = end-1
				    			while (newprogram[i] == ' ') i--
				    			var insert
				    			if (newprogram[i] == '(') insert = 'wait'
				    			else insert = ',wait'
				    			newprogram = newprogram.slice(0,end)+insert+newprogram.slice(end)
			    			}
			    		}
			    	}
			    }
		    }
		    
		    // When outdent line starts with ')', the "N" must be indented.
		    // When outdent line starts with 'else' or 'elif', at the same level as prevous line,
		    //   don't insert a line number; it's this case:
		    //     if a: b
		    //     elif c: d
		    //     else e: f
	    	// Similarly, if outdent line starts with except or finally, don't insert a line number
		    
		    c = ''
		    if (indent.length < lastindent.length && ( line.charAt(0) == ')' || 
		    		line.substr(0,4) == 'else' ||
		    		((lang == 'rapydscript' || lang == 'vpython') && (line.substr(0,4) == 'elif'
		    			|| line.substr(0,6) == 'except' || line.substr(0,7) == 'finally') ) )) {
		    	c = lastindent+delim+(lineno+2)+delim+'\n'
		    } else c = indent+delim+(lineno+2)+delim+'\n'
		    
		    if ( (lang == 'rapydscript' || lang == 'vpython') ) {
		    	if (indent.length == lastindent.length && (line.substr(0,4) == 'elif' || line.substr(0,4) == 'else')) {
		    		c = ''
		    	} else if (line.substr(0,3) == '"""' || line.substr(0,3) == "'''" || line[0] == ')') {
		    		c = ''
		    	}
		    }
		    
		    if (lang == 'rapydscript' || lang == 'vpython') { // need to indent the entire program two spaces
		    	if (previouscontinuedline) {
		    		newprogram = newprogram.slice(0,-1)+indent+line+'\n'
		    		indent = lastindent // keep the indent of the starting line of this continued sequence
		    	} else if (c == '') {
		    		newprogram += '  '+indent+line+'\n'
		    	} else {
		    		if (decoration.length > 0) {
		    			newprogram += '  '+c+'  '+indent+decoration+'\n'
		    			newprogram += '  '+indent+line+'\n'
		    		} else {
		    			newprogram += '  '+c+'  '+indent+line+'\n'
		    		}
		    	}
		    } else {
		    	newprogram += c+lines[lineno]+'\n'
		    }

		    lastindent = indent
		    if (parens < 0) return "ERROR: Too many right parentheses, line "+(lineno+2)+": "+lines[lineno]
		    if (brackets < 0) return "ERROR: Too many right brackets, line "+(lineno+2)+": "+lines[lineno]
		    if (braces < 0) return "ERROR: Too many right braces, line "+(lineno+2)+": "+lines[lineno]		    
		}
	    if (parens > 0) return "ERROR: Missing right parenthesis, see line "+(lastleftparens+2)+": "+lines[lastleftparens]
	    else if (brackets > 0) return "ERROR: Missing right bracket, see line "+(lastleftbracket+2)+": "+lines[lastleftbracket]
	    else if (braces > 0) return "ERROR: Missing right brace, see line "+(lastleftbrace+2)+": "+lines[lastleftbrace]
	    else return newprogram
    }
    
    var CSdict = {}
    
    function CSlineNumbers(prog) {
    	var patt = /\/\*(\d*)[ ]*\*\//
    	var linenum
    	var lines = prog.split('\n')
    	for (var n=0; n<lines.length; n++) {
    		var getline = lines[n].match(patt)
    		if (getline !== null) break
        }
    	for (; n<lines.length; n++) {
    		var getline = lines[n].match(patt)
    		if (getline !== null) {
    			linenum = getline[1]
    			CSdict[n] = linenum
    		} else {
    			CSdict[n] = linenum
    		}
    	}
    }

	var endvars = '  _$GS_$END=0' // marks the end of the insertions before the start of the user JavaScript
    
    function lineNumbers(prog, lang) {
		
		if (lang == 'coffeescript') {
		    var patt = /\/\*\s*(\d*)\s\*\//
	    	var linenum
	    	var lines = prog.split('\n')
			for (var n=0; n<lines.length; n++) {
			    var getline = lines[n].match(patt)
			    if (getline !== null) {
			    	linenum = getline[1]
			    	window.__linenumbers[n] = CSdict[linenum]
			    }
			}
	    	return prog
		} else if (lang == 'rapydscript' || lang == 'vpython') { // find the beginning of the user's code
			var base
			// /*    20 */     _$GS_$END = 0;
			var findbase = /\/\*\s*\d*\s\*\/\s*\_\$GS\_\$END = 0;/
	    	var lines = prog.split('\n')
			for (var n=0; n<lines.length; n++) {
			    var m = lines[n].match(findbase) // look for this: /*   N */     _$GS_$END=0;
			    if (m !== null) {
			    	base = n+1
			    	break
			    }
			}
			
			var linenum
			var prog2 = []
			var ntrue = 0
			var patt = /\/\*\s*\d*\s\*\/\s*"(\d*)";/
			for (var n=0; n<lines.length; n++) {
			    var m = lines[n].match(patt)
			    if (m !== null) {
			    	linenum = m[1]
			    } else {
                    prog2.push(lines[n])
	    			window.__linenumbers[ntrue] = linenum
	    			ntrue++
			    }
			}
			return prog2.join('\n')

		} else { // JavaScript
	    	var patt = /\/\*[ ]*(\d*)[ ]\*\//
	    	var lines = prog.split('\n')
	    	var L, lastL, getline
			for (var n=0; n<lines.length; n++) {
			    getline = lines[n].match(patt)
			    if (getline !== null) {
			    	L = Number(getline[1])
			    	if (L > 1) break
			    }
			}
			lastL = L
	    	for (; n<lines.length; n++) {
				var getline = lines[n].match(patt)
				if (getline !== null) {
					L = Number(getline[1])
					if (L == 1) { // Streamline sometimes goofs
						L = lastL+1
					}
				}
			    window.__linenumbers[n] = L
			    lastL = L
			}
			return prog
		}
    }
    
    // This code for compiling RapydScript -> JavaScript in the browser is thanks to Charles Law:
    
    var linenopatt = /"(\d*)"/


	// Old (January 2015) RapydScript compiler
    var RS_OPTIONS = {
            "filename":"demo",
            "toplevel":null,
            "basedir": null,
            "libdir": null
        };
    var OUTPUT_OPTS = {
            "beautify":true,
            "private_scope":false
        };

    function compile_rapydscript(rs_input) {
	    if (rs_input.slice(0,7) == 'ERROR: ') {
	    	throw new Error(rs_input.slice(7))
    	} else {
	        var output = OutputStream(OUTPUT_OPTS)
	        rs_input += '\n'; //just to be safe
	        try {
	            var TOPLEVEL = parse(rs_input, RS_OPTIONS);
	            TOPLEVEL.print(output);
				return output.toString();
	        } catch(err) {
		        if (err.line === undefined) {
		        	throw new Error(err.message)
		        } else {
		    	    var lines = rs_input.split('\n')
		    	    var L = lines[err.line] // the text of the error line
		    	    var m = L.match(linenopatt) // may be '  "23"', inserted by insertLineNumbers()
		    	    if (m !== null) {
		    	    	throw new Error(err.message + "; line " + m[1] + ": "+lines[err.line+1])
		    	    } else {
		    	    	throw new Error(err.message +': '+lines[err.line])
		    	    }
		        }
	      	}
    	}
    }
    
    // New (November 2015) RapydScript compiler
    /* RapydScript is normally run in node to convert Python-like web programming to JavaScript.
       Its use in GlowScript however involves running the compiler in the browser, for which
       Charles Law <charles.law@gmail.com> maintains a browser version at
                 https://github.com/charleslaw/RapydScript_web
       The code seen below is a slightly modified version of code supplied by Charles Law.
       In order to work in the GlowScript environment, it was necessary to search and replace all
       instances in RapydScript of rs_ (where rs are non-ascii characters) to the older form _$rapyd$_.
     */
    	

    /*
    var rs_options = {
	    toplevel: undefined,
        basedir: '.',
        auto_bind: false,
        es6: false
    };
    
    function compile_rapydscript(rs_input) {
	     if (rs_input.slice(0,7) == 'ERROR: ') { // This is a message from the GlowScript preprocessing of rs_input
	    	 throw new Error(rs_input.slice(7))
	     } else {
			  var BASELIB = {}
			  var INDEX_COUNTER = 0
			  var output_opts = {
				beautify: true,
				private_scope: false,
				baselib: parse_baselib(),
				auto_bind: false,
				omit_baselib: true // don't add functions to user compile; the whole library is imported
			  };
		      var output = OutputStream(output_opts)
		      rs_input += '\n'; //just to be safe
		      try {
		        var TOPLEVEL = parse(rs_input, rs_options);
		        TOPLEVEL.print(output);
		        return output.toString()
		      } catch(err) {
			        if (err.line === undefined) {
			        	throw new Error(err.message)
			        } else {
			    	    var lines = rs_input.split('\n')
			    	    var L = lines[err.line] // the text of the error line
			    	    var m = L.match(linenopatt) // may be '  "23"', inserted by insertLineNumbers()
			    	    if (m !== null) {
			    	    	throw new Error(err.message + "; line " + m[1] + ": "+lines[err.line+1])
			    	    } else {
			    	    	throw new Error(err.message +': '+lines[err.line])
			    	    }
			        }
		      	}
	     }
    }
*/
     
    var vp_primitives = ["box", "sphere", "cylinder", "pyramid", "cone", "helix", "ellipsoid", "ring", "arrow", "graph"]
    
    var vp_other = ["display", "vec", "vector", "rate", "sleep", "update", "compound", "color",
                    "vertex", "triangle", "quad", "label", "distant_light", "local_light", "attach_trail", "attach_arrow",
                    "sqrt", "pi", "abs", "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "exp", "log", "pow",
                    "factorial", "combin",
                    "radians", "degrees", "gcurve", "gdots", "gvbars", "ghbars", "gdisplay",
                    "get_library", "read_local_file"]
    
    function compile(program, options) {
    	// options include lang ('javascript' or 'coffeescript' or 'rapydscript' or 'vpython')
    	//     and translations (the program text, not including the GlowScript header)
    	options = options || {}
    	//WHY? var translations = (options[translations] === undefined) ? false : true
        var wait = options.wait || "wait"  // currently options.wait is not set, so the wait symbol is wait
        window.__original = {text: program.split("\n")}
        window.__linenumbers = {compiled: false}
        window.__GSlang = options.lang
        var version = '["'+options.version+'", "glowscript"]' // e.g. ['1.1', 'glowscript']
        
        // Work around the problem that .delete is not allowed in JavaScript; for API need d = display() .... d.delete() to delete display:
        program = program.replace(/\.delete/g, ".remove") 
        
        if (options.lang == "coffeescript") {
        	program = insertLineNumbers(program, options.lang)
            program = "main = (" + wait + ")->\n version = "+version+"\n scene = canvas()\n " + program.replace(/\n/g, "\n ") + "\n return\nreturn main"
            program = CoffeeScript.compile(program) // Removes blank lines and comments
            CSlineNumbers(program)
            
        } else if (options.lang == "rapydscript" || options.lang == 'vpython') {
        	program = insertLineNumbers(program, options.lang)
        	if (program.slice(0,7) == 'ERROR: ') {
        		compile_rapydscript(program)
        	} else {
	        	var prog
	        	if (options.lang == 'rapydscript') prog = "def main(" + wait + "):\n  version = "+version+"\n  scene = canvas()\n  arange=range\n  _$rapyd$_Temp = 0\n  _$rapyd$_print = GSprint\n"+endvars+"\n" + program + "main"
	        	else { // 'vpython'
	        		prog = "def main(" + wait + "):\n  version = "+version+"\n"
	        		if ( VPython_import === null) {
	        			prog += "  window.__GSlang = 'vpython'\n" // WebGLRenderer needs to know at run time what models to create
		        		for (var i = 0; i<vp_primitives.length; i++) prog += "  "+vp_primitives[i]+"=vp_"+vp_primitives[i]+"\n"
		        		prog += "  display=canvas\n  vector=vec\n"+endvars+"\n"
	        		} else if ((VPython_import == 'visual' || VPython_import == 'vis') && VPython_names.length > 0) { // e.g from visual or vis import box, cylinder
	        			var vars = "  window.__GSlang = 'vpython'\n" // WebGLRenderer needs to know at run time what models to create
		        		vars += "  vector=vec\n"
		        		for (var i=0; i<vp_primitives.length; i++) {
	        				var name = vp_primitives[i]
	        				var n = VPython_names.indexOf(name)
	        				if (n >= 0) vars += "  "+name+"=vp_"+name+"\n"
	        				else vars += "  "+name+"=undefined\n"
	        			}
	        			var hasvector = (VPython_names.indexOf('vector') >= 0)
	        			for (var i=0; i<vp_other.length; i++) {
	        				var name = vp_other[i]
	        				if (name == 'vec' && hasvector) continue
	        				var n = VPython_names.indexOf(name)
	        				if (n >= 0) {
	        					if (name == 'display') vars += "  display=canvas\n"
	        				} else vars += "  "+name+"=undefined\n"  // just undefine those entities not listed in the import; those listed need no mention
	        			}
	        			prog += vars
	        		} else if ((VPython_import == 'visual' || VPython_import == 'vis') && VPython_names.length == 0) { // import visual or vis
	        			var importpatt // find all instances of vis.attr or visual.attr
	        			if (VPython_import == 'visual') importpatt = /visual\.(\w+)/g
	        			else importpatt = /vis\.(\w+)/g
	        			var m = program.match(importpatt) // has the form [vis.vector, vis.rate, vis.vector, .....]
	        			if (VPython_import == 'visual') importpatt = /visual\.(\w+)/
	        			else importpatt = /vis\.(\w+)/
	        			var attrs = {} // a dictionary containing all the vis or visual objects referenced in the program
	        			for (var i=0; i<m.length; i++) {
	        				var a = importpatt.exec(m[i])[1] // extract "rate" from "vis.rate" or "visual.rate"
	        				if (!(a in attrs)) attrs[a] = a
	        			} 
	        			var vars = "  window.__GSlang = 'vpython'\n" // WebGLRenderer needs to know at run time what models to create
	        			var purge = '' // set variables unqualified by vis. or visual. to "undefined"
		        		vars += '  '+VPython_import+'={'
	        			for (var i=0; i<vp_primitives.length; i++) {
	        				var name = vp_primitives[i]
	        				if (name in attrs) vars += name+':vp_'+name+', '
	        				else purge += "  "+name+'=undefined\n'
	        			}
	        			for (var i=0; i<vp_other.length; i++) {
	        				var name = vp_other[i]
	        				if (name in attrs) {
	        					if (name == 'display' && name in attrs) vars += "display:canvas, "
	        					else if (name == 'vector') vars += 'vector:vec, '
	        					else vars += name+':'+name+', '
	        				} else {
	        					if (name == 'vec' && ('vector' in attrs)) continue
	        					purge += "  "+name+'=undefined\n'
	        				}
	        			}
	        			vars = vars.slice(0,-2)+'}\n'
	        			prog += vars
	        			prog += purge
	        		}
	        		prog += "  scene = canvas()\n"
	        		prog += "  _$rapyd$_Temp=0\n  _$rapyd$_print=GSprint\n  arange=range\n"
	        		prog += program + "main"
	        	}
	        	//console.log(prog)
	        	program = compile_rapydscript(prog)
	        	
	        	if (program !== undefined) {
		        	// Look for "no overloading" and move it to start of function
		            var p = program.split('\n')
		        	//for (var i=1; i<p.length; i++) console.log(i, p[i])
		            var overload = 0
		            for (var i=3; i<p.length; i++) {
		            	if (p[i].search('function') > 0) overload = i
		            	if (p[i].search('"no overloading"') > 0 && overload > 0) {
		            		p = p.slice(0,overload+1).concat(p[i]).concat(p.slice(overload+1,i-1)).concat(p.slice(i+1))
		            	}
		            }
		        	if (overload > 0) program = p.join('\n')
	        	}
        	}
        	
        } else {
            program = "function main(" + wait + ") {var version = "+version+";var scene = canvas();\n" + program + "\n};\nmain"
        }
        var p = program.split('\n')
    	//for (var i=0; i<p.length; i++) console.log(i, p[i])
        //WHY? if (translations) translations.push(program)

        var parsed = Narcissus.parser.parse(program, "~", 1) 
        // Buried in the generated parse tree are 'lineno' values used by Narcissus.parser.parse
        // For example, parsed.children.body.children.children.children.initializer.children.lineno: 1
        // In error messages we need to display the correct line number and original line
        // despite CS -> JS, operator overloading, and Streamline.
        parsed = implementOperatorOverloading(parsed)
        //WHY? if (translations) translations.push(Narcissus.decompiler.pp(parsed))
        
        // Streamline (among much else) uses the lineno attributes generated by Narcissus.parser.parse
        // to prepend "/*  lineno */" to program lines, for error reporting:
        //WHY? if (translations) translations.push(program)
        var m = program.match(/(\s*)scene = canvas()/)
        window.__linenumbers.indent = m[1]
        var prog = Streamline.transform(parsed, { alreadyParsed: true, callback: wait })
        prog = lineNumbers(prog, options.lang) // create window.__linenumbers
        window.__linenumbers.compiled = true
        var p = prog.split('\n')
    	//for (var i=0; i<p.length; i++) console.log(i, p[i])
        //for (var prop in window.__linenumbers) console.log(prop, window.__linenumbers[prop])
		return prog
    }
    window.glowscript_compile = compile

    function implementOperatorOverloading(parsed) {
        // FIXME: Relies on the guts of the Streamline compiler in a way that could easily break as that is upgraded
        // Use "burrito"?  uglifyjs parser instead of Narcissus?
    	// Note that Salvatore di Dio in his RapydGlow experiment (http://salvatore.diodev.fr/RapydGlow/default/editor)
    	//   used Acorn (https://github.com/marijnh/acorn) instead of narcissus, and he
    	//   used PaperScript to handle operator overloading: http://paperjs.org/reference/paperscript/
        var propagate = Streamline.propagate
        var Template = Streamline.Template
        var definitions = eval("var definitions = {" + Narcissus.definitions.consts.replace(/const |;/g, "").replace(/=/g, ":") + "}; definitions");

        var ops = {}
        ops[definitions.PLUS] = "+"
        ops[definitions.MINUS] = "-"
        ops[definitions.MUL] = "*"
        ops[definitions.DIV] = "/"

        var opTemplate = new Template("binary", 'return ($lhs)["$op"]($rhs)', true)
        var unaryTemplate = new Template("unary", 'return ($value)["$op"]()', true)

        function overload(node) {
            if (node.children[0] && node.children[0].value === "no overloading")
                return node;
            node = propagate(node, overload)
            if (node.type == definitions.UNARY_MINUS) {
                node._scope = {}
                node = unaryTemplate.generate(node, { $op: "-u", $value: node.children[0] });
            } else {
                var op = ops[node.type]
                if (op !== undefined) {
                    node._scope = {}
                    node = opTemplate.generate(node, { $op: op, $lhs: node.children[0], $rhs: node.children[1] })
                }
            }
            return node;
        }
        return overload(parsed)
    }
		
})();