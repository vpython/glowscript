(function () {
    "use strict";

/*
Salvatore di Dio demonstrated in his RapydGlow experiment (http://salvatore.pythonanywhere.com/RapydGlow)
how he was able to use the RapydScript Python-to-JavaScript compiler with GlowScript graphics.
This inspired the implementation of the VPython (vpython.org) API at glowscript.org.
He provided the file papercomp.js for operator overloading, based on the work of
    Juerg Lehni (PaperScript: http://scratchdisk.com/posts/operator-overloading).
                 https://github.com/paperjs/paper.js
He also assembled support for operator overloading and the ability to write synchronous code
in the file transform-all.js, based on the work of
    Bruno Jouhier (Streamline: https://github.com/Sage/streamlinejs), and
    Marijn Haverbeke (Acorn.js: https://github.com/marijnh; https://github.com/ternjs/acorn).
Supporting the VPython API in a browser is possible thanks to the work of
    Alexander Tsepkov (RapydScript: https://bitbucket.org/pyjeon/rapydscript) and
    Charles Law (browser-based RapydScript: http://pyjeon.pythonanywhere.com/static/rapydscript_online/index.html).

When the GlowScript project was launched in 2011 by David Scherer and Bruce Sherwood,
Scherer implemented operator overloading and synchronous code using libraries existing at that time.
In 2015 it became necessary to upgrade to newer libraries because compilation failed on some browsers.
*/
    
	// Salvatore di Dio in his RapydGlow experiment (http://salvatore.diodev.fr/RapydGlow/default/editor)
	// used PaperScript to handle operator overloading: http://paperjs.org/reference/paperscript/ and
    // a substitute for Narcissus in the file transform-all.js. For operator overloading he
	// references this PaperScript article: http://scratchdisk.com/posts/operator-overloading, and he
    // created a file to handle vector operations, papercomp.js. This compilation machinery uses the files
    // papercomp.js (slightly modified by Bruce Sherwood) and transform-all.js.
    // Thank you, Salvatore!
    
    // A possible problem with Streamline is an error message that says this:
    // Error: no callback given (argumen #1). If you're a Streamline user, more info:
    // https://github.com/Sage/streamlinejs/blob/master/FAQ.md#no-callback-given-error
    // This error started showing up when the Streamline and operator overloading elements
    // had to be updated in Dec. 2015 when GlowScript stopped working on Firefox.
    
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
	                    case ("'"):
	                    case ('"'):
	                        return line.slice(0,end+1)+',wait'+spaces+')'
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
	
    function preprocess(program, lang) { // manipulate the program source
    	// After conversion to JavaScript, these insertions used to have the form "N";\n, but now are gone.
    	// Insert "N"\n before each RapydScript or VPython line, where N is original line number (starting with 2)
    	var c, lineno, lines, line, m, start
    	var parens = 0, brackets = 0, braces = 0
    	var lastleftparens = null, lastleftbracket = null, lastleftbrace = null
	    var indent = ''
    	var getline = /(^\s*)(.*)/
    	var newprogram = '', lastindent = ''
    	var firstquote = 0 // 0: no string; 1: string starts with '; 2: string starts with " (or """)
    	var continuedline = false
    	var indef = false // true if processing an anonymous def in RapydScript
    	var delim = '"'
    	var defindents = []  // stack of [def or class character location, length of def or class indent]
    	var whenpatt = /when[ ]/
        var pickpatt = /(\.pick)\s*(.)/
    	var defpatt = /def[^:]*:/
	    var classpatt = /class[^:]*:/
    	var decoration
	    lines = program.split('\n')
    	// If blank line or comments, do not insert "N"\n and do not add to newprogram
		for (lineno=0; lineno<lines.length; lineno++) {
			decoration = ''
		    m = lines[lineno].match(getline)
		    indent = m[1]
		    line = m[2]
		    if (line[0] == '#') continue

	    	if (line[0] == '@') { // such as @kwargs
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
	    			if (i <= line.length-3 && line[i+1] == '"' && line[i+2] == '"') {
	    				if (triplequote && i <= line.length-4 && line[i+3] == '"') break
	    				triplequote = !triplequote
	    				processedtriplequote = true
	    				i += 2
	    			} else if (!triplequote && !singlequote) doublequote = !doublequote
	    			break
	    		case "'":
	    			if (i <= line.length-3 && line[i+1] == "'" && line[i+2] == "'") {
	    				if (triplequote && i <= line.length-4 && line[i+3] == "'") break
	    				triplequote = !triplequote
	    				processedtriplequote = true
	    				i += 2
	    			} else if (!triplequote && !doublequote) singlequote = !singlequote
	    			break
	    		}
	    		if (triplequote && i == line.length-1 && lineno < lines.length-1) {
	    			lineno++
	    			line += '\n' + lines[lineno]
	    		}
	    		if (singlequote || doublequote || triplequote) {
	    			if (i < line.length-1) continue
	    			if (lineno === lines.length-1) {
	    				var q = "single"
	    				if (doublequote) q = "double"
	    				else q = "triple"
	    				return "ERROR: Unbalanced "+q+" quotes"
	    			}
	    		}
	    		
	    		switch (char) {
	    		case ':':
	    			if (parens == 1) { // anonymous function
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
	    			if (indef && parens == 0) indef = false
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
		    	var m = pickpatt.exec(line+' ') // convert v.pick -> v.pick()
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
       At the moment (2016 Jan. 22) the newer RapydScript isn't quite ready to be used in GlowScript.
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
    
    function fontloading() { // trigger loading of fonts for 3D text; there is a copy in api_misc.js
    	// called from compiler and from exported programs
    	var fsans
    	if (navigator.onLine) fsans =  'https://s3.amazonaws.com/glowscript/fonts/Roboto-Medium.ttf' // a sans serif font
    	else fsans =  '../lib/FilesInAWS/Roboto-Medium.ttf' // a sans serif font
		opentype.load(fsans, function(err, fontrefsans) {
            if (err) throw new Error('Font ' + fsans + ' could not be loaded: ' + err)
        	window.__font_sans = fontrefsans // an opentype.js Font object
        })
    	var fserif
    	if (navigator.onLine) fserif = 'https://s3.amazonaws.com/glowscript/fonts/NimbusRomNo9L-Med.otf' // a serif font
    	else fserif = '../lib/FilesInAWS/NimbusRomNo9L-Med.otf' // a serif font
        opentype.load(fserif, function(err, fontrefserif) {
            if (err) throw new Error('Font ' + fserif + ' could not be loaded: ' + err)
        	window.__font_serif = fontrefserif // an opentype.js Font object
        })
    }
    
    function compile(program, options) {
    	// options include lang ('javascript' or 'rapydscript' or 'vpython')
    	options = options || {}
    	var wait = options.wait || "wait"  // currently options.wait is not set, so the wait symbol is wait
    	window.__original = {text: program.split("\n")}
        window.__GSlang = options.lang
        var version = '["'+options.version+'", "glowscript"]' // e.g. ['1.1', 'glowscript']
        
        // Look for text object in program
    	// findtext finds "...text  (....." and findstart finds "text  (...." at start of program
        var findtext = /[^\.\w]text[\ ]*\(/
        var findstart = /^text[\ ]*\(/
    	var loadfonts = findtext.exec(program)
        if (!loadfonts) loadfonts = findstart.exec(program)
        if (loadfonts) fontloading() // in api_misc.js, trigger loading of font files for 3D text
        
        // Work around the problem that .delete is not allowed in JavaScript; for API need d = display() .... d.delete() to delete display:
        program = program.replace(/\.delete/g, ".remove") 
        
        if (options.lang == "rapydscript" || options.lang == 'vpython') {
        	program = preprocess(program, options.lang)
        	if (program.slice(0,7) == 'ERROR: ') {
        		compile_rapydscript(program)
        	} else {
	        	var prog
	        	if (options.lang == 'rapydscript') {
	        		prog = "def main(" + wait + "):\n  version = "+version+"\n  window.__GSlang = 'rapydscript'\n  scene = canvas()\n  arange=range\n  _$rapyd$_Temp = 0\n  _$rapyd$_print = GSprint\n" + program + "main"
	        	} else { // 'vpython'
	        		prog = "def main(" + wait + "):\n  version = "+version+"\n"
	        		if ( VPython_import === null) {
	        			prog += "  window.__GSlang = 'vpython'\n" // WebGLRenderer needs to know at run time what models to create
		        		for (var i = 0; i<vp_primitives.length; i++) prog += "  "+vp_primitives[i]+"=vp_"+vp_primitives[i]+"\n"
		        		prog += "  display=canvas\n  vector=vec\n"
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
	        		prog += "  _$rapyd$_Temp=0\n  _$rapyd$_print=GSprint\n  arange=range\n"
	        		prog += "  scene = canvas()\n"
	        		prog += program + "main"
	        	}
	        	
	        	program = compile_rapydscript(prog)
	        	 //   Array.prototype['+']=function(r) {return this.concat(r)}\n
	        	if (options.lang == 'rapydscript' || options.lang == 'vpython') { // enable Python list+list
	        		var start = program.indexOf('window.__GSlang')
	        		var arr = "Array.prototype['+']=function(r) {return this.concat(r)};\n"
	        		// Was unable to make Array.prototype['*'] work here; gives stack overflow:
	        		//arr +=    "    Array.prototype['*']=function(r) "
	        		//arr +=    "{var _$_temp=this; for (var _$_i=1; _$_i<r; _$_i++) {_$_temp.push.apply(_$_temp,this)};return _$_temp};\n"
		        	//arr +=     "    Number.prototype['*'] = function (r) {" // check whether right operand is Number or vec or Array
			        //arr +=    "if (r instanceof vec) {return r.multiply(this)} else if (r instanceof Array) "
			        //arr +=    "{var _$_temp=r; for (var _$_i=1; _$_i<this; _$_i++) {_$_temp.push.apply(_$_temp,r)};return _$_temp} "
				    // +=    "else {return r*this}};\n"
	        		program = program.slice(0,start) + arr + program.slice(start-4)
	        	}
        	}
        	
        } else { // JavaScript
        	/* This scheme doesn't work because it gives for example this intrusion between if and else:
        	     "3";
        	     if (a) b = 5;
        	     "4";
        	     else b = 6;
        	
        	// JavaScript: prepend "linenumber"; to every program line
        	// Nor does it work to prepend a comment, which gets eliminated by Streamline
        	var prog = program.split('\n')
        	var p = ''
        	for (var i=0; i<prog.length; i++) {
        		p += '"'+(i+2)+'";\n' + prog[i]+ '\n'
        	}
        	var prog = program.split('\n')
        	var p = ''
        	for (var i=0; i<prog.length; i++) {
        		p += '/'+'*'+(i+2)+'*'+'/' + prog[i]+ '\n'
        	}
        	*/
        	
            var prog = "function main(" + wait + ") {\n"
            prog += "var version = "+version+";\n"
            prog += "var scene = canvas();\n"
            // Placing this here instead of in vectors.js gives stack overflow:
    		//prog += "Number.prototype['*'] = function (r) {" // check whether right operand is Number or vec
        	//prog +=    "return (r instanceof vec) ? r.multiply(this) : r*this};\n"
            program = prog + program + "\n};\nmain"
        }
    	
        if (loadfonts) {
        	var s = "scene = canvas();\n"
            var sc = program.indexOf(s) + s.length
        	s = "    waitforfonts(wait)\n"  // wait for font files
            program = program.slice(0,sc)+s+program.slice(sc,program.length)
        }

    	var parsed = papercompile(program) // handle operator overloading
        
    	var prog = Streamline.transform(parsed, { callback: "wait" }) // permit synhronous code; discards comments
    	
    	// preamble is what the older use of Streamline produced; the new libraries (Dec. 2015)
    	// invoke a function "require" inside the streamline machinery. 
    	// You can see that this code is similar to that at line 5358 in transform-all.js.
    	/*
    	var preamble = ''
    	preamble += "var __g=typeof global!=='undefined'?global:window; __g=(__g.__streamline||(__g.__streamline={}));__g.setEF=__g.setEF||function(e,f){e.__frame = e.__frame||f};var __srcName='undefined_.js'; "
    	preamble += "function __func(_,__this,__arguments,fn,index,frame,body){if(!_){return __future.call(__this,fn,__arguments,index)}frame.file=__srcName;frame.prev=__g.frame;__g.frame=frame;try{body()}catch(e){__g.setEF(e,frame.prev);__propagate(_,e)}finally{__g.frame=frame.prev}} "
    	preamble += "function __cb(_,frame,offset,col,fn){frame.offset=offset;frame.col=col;var ctx=__g.context;return function ___(err,result) "
    	preamble += "{var oldFrame=__g.frame;__g.frame=frame;__g.context=ctx;try{if(err){__g.setEF(err,frame);return _(err)}return fn(null,result)}catch(ex){__g.setEF(ex,frame);return __propagate(_,ex)}finally{__g.frame=oldFrame}}} "
    	preamble += "function __future(fn,args,i){var done,err,result;var cb=function(e,r){done=true;err=e,result=r};args=Array.prototype.slice.call(args);args[i]=function ___(e,r){cb(e,r)};fn.apply(this,args);return function ___(_){if(done)_.call(this,err,result);else cb=_.bind(this)}.bind(this)} "
    	preamble += "function __propagate(_,err){try{_(err)}catch(ex){__trap(ex)}} "
    	preamble += "function __trap(err){if(err){if(__g.context&&__g.context.errorHandler)__g.context.errorHandler(err);else console.error('UNCAUGHT EXCEPTION: '+err.message+' : '+err.stack)}}"
		var start = prog.indexOf('function main')
		prog = preamble+' '+prog.slice(start)
		*/
    	
		program = prog.replace(/\n\n\n\n/g, '') // eliminate lots of white space
		
		if (loadfonts) {
			program = "fontloading();\n" + program
			// Removing the final wait() eliminates an irrelevant error message:
			var s = 'wait()' // associated with the Streamline waitforfonts function
			var sc = program.lastIndexOf(s)
			if (sc > -1) {
				program = program.slice(0,sc) + program.slice(sc+s.length,program.length)
			}
		}
		
        //var p = program.split('\n')
    	//for (var i=0; i<p.length; i++) .log(i, p[i])
		return program
    }
    window.glowscript_compile = compile

		
})();