(function () {
    "use strict";

/*
Salvatore di Dio demonstrated in his RapydGlow experiment (http://salvatore.pythonanywhere.com/RapydGlow)
how he was able to use the RapydScript Python-to-JavaScript compiler with GlowScript graphics.
This inspired the implementation of the VPython (vpython.org) API at glowscript.org.
Salvatore provided the file papercomp.js for operator overloading, based on the work of
    Juerg Lehni (PaperScript: http://scratchdisk.com/posts/operator-overloading).
                 https://github.com/paperjs/paper.js
He also assembled support for the ability to write synchronous code in the file transform-all.js,
based on the work of
    Bruno Jouhier (Streamline: https://github.com/Sage/streamlinejs), and
    Marijn Haverbeke (Acorn.js: https://github.com/marijnh; https://github.com/ternjs/acorn).
Supporting the VPython API in a browser was initially possible thanks to the work of
    Alexander Tsepkov (RapydScript: https://bitbucket.org/pyjeon/rapydscript) and
    Charles Law (browser-based RapydScript: http://pyjeon.pythonanywhere.com/static/rapydscript_online/index.html).

When the GlowScript project was launched in 2011 by David Scherer and Bruce Sherwood,
Scherer implemented operator overloading and synchronous code using libraries existing at that time.
In 2015 it became necessary to upgrade to newer libraries because compilation failed on some browsers.

In Jan. 2017 Bruce Sherwood updated the operator overloading (papercomp.js) machinery to use
the latest versions of the acorn and streamline libraries. He also changed from using the rapydscript of
Tsepkov to the rapydscript-ng of Kovid Goyal, which is closer to true Python and therefore better for the
purposes to which GlowScript is put. An attempt was made to update Streamline (permit synchronous code)
but failed because the new large ES6-based library could not be minified by uglify. When and if uglify
can perform the minification, a new attempt will be made to use the Streamline file lib/compiling/transform-es6.js.
In the meantime transform.js is used (formerly named transform-all.js), the file obtained from Salvatore di Dio in 2015.

-----------------------------------------------------------------------------------------
HOW TO OBTAIN BROWSER VERSIONS OF THE RAPYDSCRIPT-NG, PAPERCOMP, STREAMLINE LIBRARIES, and PLOTLY
There are probably more efficient ways to obtain these libraries, but the following methods work.

For the rapydscript-ng in-browser Python-to-JavaScript transpiler, go to https://github.com/kovidgoyal/rapydscript-ng.
Search for "Embedding the RapydScript compiler in your webpage". There you will find a link to the transpiler file,
with instructions for how to use it. Store the file in lib/rapydscript/compiler.js.

The in-browser transpiler includes a minimized copy of the run-time function. However, for a program exported
to the user's own web page, the transpiler is not present and a run-time file is need. Here is how to build
the rapydscript-ng runtime library (but see below for an alternative procedure):
1) Make sure node is installed.
2) In a new folder, execute "npm install rapydscript-ng".
3) Create a file named "input.py" in this folder that contains "a=1".
4) Execute this (modify if not on Windows): node.exe .\node_modules\rapydscript-ng\bin\rapydscript --bare input.py > runtime.js
5) At the end of the file "runtime.js", delete these lines:
	var __name__ = "__main__";
	
	var a;
	a = 1;
6) Copy the file to lib/rapydscript/runtime.js.
For GlowScript 2.6 this resulted in runtime.js having the encoding "UCS-2 LE BOM" which the Uglify
machinery invoked by running build_original.py could not handle. Using (on Windows) notepad++
the encoding was changed to "UTF-8" which solved the problem.

The instructions above for building the two RapydScript files are adequate if it is not necessary to
get the very latest version from the rapydscript-ng repository. If there have been commits to the
repository that you want, but the key files haven't been updated, replace the instructions with the
following. I was unable to do this on Windows and did this on a Mac.

Build rapydscript-ng from source (from "Installation" section at rapydscript-ng):
1) Make sure node and git are installed.
2) In a new folder, execute the following (taken from Installation instructions in the rapydscript-ng repository):
	git clone git://github.com/kovidgoyal/rapydscript-ng.git
	cd rapydscript-ng
	sudo npm link .
	sudo npm install  # This will automatically install the dependencies for RapydScript
3) Execute "sudo bin/rapydscript self --complete --test". This will build files in the "dev" folder.

Build embedded compiler: (from "Embedding the RapydScript compiler in your webpage" section at rapydscript-ng)
4) Execute "sudo bin/web-repl-export embedded". This builds the "embedded" (in-browser) compiler.

Move new files to glowscript source:
5) Copy the file dev/baselib-plain-pretty.js to lib/rapydscript and change the name to runtime.js.
6) Copy the file embedded/rapydscript.js to lib/rapydscript and change the name to compiler.js.
7) Insert these statements at the start of runtime.js (this is a kludge; don't know how to invoke the new compiler):
	var RS_iterator_symbol = (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") ? Symbol.iterator : "iterator-Symbol-5d0927e5554349048cf0e3762a228256";
	var RS_kwargs_symbol = (typeof Symbol === "function") ? Symbol("kwargs-object") : "kwargs-object-Symbol-5d0927e5554349048cf0e3762a228256";
	var RS_cond_temp, RS_expr_temp, RS_last_exception;
	var RS_object_counter = 0;

The two rapydscript-ng files, compiler.js and runtime.js, have XY_ at the start of library entities,
where XY are non-ascii characters. This caused errors in the old streamline file (transform.js), 
so it was necessary to replace all XY characters with RS in both compiler.js and runtime.js. 
This may not be necessary in the future, if XY is acceptable to transform-es6.js.

For operator overloading, the source for lib/compiling/papercomp.js is at https://github.com/paperjs/paper.js,
at src/core/PaperScript.js; compare with papercomp.js, which was modified by Bruce Sherwood for greater speed.
Also needed is a current copy of acorn (acorn.es.js), a parser of JavaScript used by papercomp.js.
1) Make sure node has been installed.
2) In a new folder, execute "npm install acorn".
3) The file you want is node_modules/acorn/dist/acorn.es.js.
4) Copy the file to lib/compiling/acorn.es.js
5) Modify the end of the file to look like this:

	//export { version, parse, parseExpressionAt, tokenizer, parse_dammit, LooseParser, pluginsLoose, addLooseExports, Parser, plugins, defaultOptions, Position, SourceLocation, getLineInfo, Node, TokenType, tt as tokTypes, TokContext, types as tokContexts, isIdentifierChar, isIdentifierStart, Token, isNewLine, lineBreak, lineBreakG };
	
	//var exports = {
	//		acorn_parse: parse
	//	}

	//Export(exports)
	
	window.call_acorn_parse = parse // Bruce Sherwood; makes acorn accessible to GlowScript compiler

There is no current source outside GlowScript for lib/compiling/transform.js (formerly transform-all.js),
originally provided by Salvatore di Dio. The new but as yet unused file transform-es6.js was prepared thus:
1) Make sure node has been installed.
2) In a new folder, execute "npm install streamline". 
3) The file you want is node_modules/streamline/lib/browser/transform.js.
4) Copy the file to /lib/compiling/transform-es6.js

See ForInstalledPython/README.txt for how to obtain the plotly graphing library
*/

	var VPython_import = null // can be vpython or visual or vis
	var VPython_names = []    // e.g. [box, cylinder] or [] if none specified (e.g. import vpython)
    var waitlist = [new RegExp('^rate\\s*\\('), new RegExp('sleep\\s*\\('), 
                    new RegExp('^get_library\\s*\\('),  new RegExp('\\.waitfor\\s*\\('), 
                    new RegExp('\\.pause\\s*\\('), new RegExp('\\s*read_local_file\\s*\\(') ]
	// In a previous version of Streamline it was possible to specify the callback tag as "wait",
	// but that option is not available in current Streamline; it must be "_"
	var GS_wait = '_'
    
	function waits(line, lang) {
		// Look for "wait" in certain statements and change to GS_wait or, if missing, supply GS_wait (which is _)
		// return line with "_" inserted, true if line was changed, name of wait type (rate, sleep, get_library, waitfor, pause, read_local_file)
		for (var i=0; i<waitlist.length; i++) {
            var patt = waitlist[i]
            if (line.search(patt) >= 0) {
                var m = line.match(patt)
                var wname = m[0].slice(0,-1)
                var end = line.lastIndexOf(')')
                var ending = line.slice(end)
                var parencnt = 1
                var name = ''
                while (end >= 0) {
					end--
					if (end < 0) break
                    switch (line[end]) {
	                    case ("'"):
	                    case ('"'):
	                        return [line.slice(0,end+1)+','+GS_wait+ending, true, wname]
	                    case (')'):
	                        parencnt++
	                        break
	                    case ('('):
	                        parencnt--
	                        if (parencnt === 0) {
                            	if (name == 'wait' || name == '_') return [line.slice(0,end+1)+GS_wait+ending, true, wname]
	                            if (name.length === 0) return [line.slice(0,end+1)+GS_wait+ending, true, wname]
	                            return [line.slice(0,end+1)+name+','+GS_wait+ending, true, wname]
	                        }
	                        break
	                    case (','):
	                        if (parencnt === 1) {
                                if (name == 'wait') return [line.slice(0,end+1)+GS_wait+ending, true, wname]
                                else return [line, false, '']
	                        }
	                        break
	                    case (' '):
	                        break
	                    default:
	                        name = line[end]+name
                    }
				}
            }
        }
        return [line, false, '']
    }

	var lineno_string = 'RS_ls = ' // prepended to quoted line number; used in error return
	
    function preprocess(program, lang) { // manipulate the program source


		// The preprocessing includes inserting RS_ls = line number to enable error reporting of original source line
    	var c, lineno, lines, line, m, start
    	var waitfcts = {} // each element is 'name of function containing Streamline elements such as rate': name of element such as 'rate'
    	var parens = 0, brackets = 0, braces = 0
    	var prebraces // the braces at the start of processing a line
    	var infunction = false // true while reading through a function
    	var lastleftparens = null, lastleftbracket = null, lastleftbrace = null
	    var indent = ''
    	var getline = /(^\s*)(.*)/
    	var newprogram = '', lastindent = ''
    	var firstquote = 0 // 0: no string; 1: string starts with '; 2: string starts with " (or """)
    	var continuedline = false
    	var indef = false // true if processing an anonymous def in RapydScript
    	var classindent = -1 // class indent if processing a class, else -1
    	var delim = '"'
    	var defindents = []  // stack of [def or function character location, length of indent, function name, braces]
    	var pickpatt = /(\.pick)\s*(.)/
    	var classpatt = new RegExp('^class\s*[^:]:')
    	var defpatt = new RegExp('def\\W*(\\w*)\\s*\\(')
	    var fctpatt = new RegExp('(\\w*)\\W*(\\w*)\\s*\\(')
	    var print_optionspatt = /^print_options/
    	var decoration
    	
	    lines = program.split('\n')
		for (lineno=0; lineno<lines.length; lineno++) { // process individual lines of code
			decoration = ''
		    m = lines[lineno].match(getline)
		    indent = m[1]
		    line = m[2]
		    if (lang != 'javascript') {
		    	if (line[0] == '#') continue
		    	var c = line.replace(/\s+$/g, '') // delete trailing spaces; later check for 'a = ', which shouldn't compile to 'a = "21";' due to line number insertions
		    }
		    
		    m = line.match(print_optionspatt)
		    if (m) line = line.replace(/delete/, "remove") // RapydScript-NG chokes on "delete"; print_options accepts delete or remove

	    	if (lang != 'javascript' && line[0] == '@') { // such as @kwargs
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
		    prebraces = braces
		    
		    // Check for this line indicating the end of a function.
		    // defindents.push([newprogram.length, indent.length, function name, braces)
		   if (lang != 'javascript') {
			    if (classindent === indent.length) classindent = -1
				if (defindents.length > 0 && indent.length <= defindents[defindents.length-1][1]) {
					ret = defindents.pop()
					infunction = false
				}
		    } else {
		    	if (defindents.length > 0 && braces === defindents[defindents.length-1][3])  {
		    		ret = defindents.pop()
					infunction = false
		    	}
		    }
		    if (lang != 'javascript' && line.match(classpatt)) classindent = indent.length


			var w = line.split(' ')
			if (lang == 'vpython' && w.indexOf('import') > -1) { // handle VPython import statements
		    	// 'from vpython import *'  // this is the default (or 'from visual import *')
	    		// 'from vpython import canvas, box, vec': VPython_names = [canvas, box, vec], MUST include canvas
	    		// 'import vpython' // create vpython = {box:vp_box, sphere:vp_sphere, etc.}
				// 'import vpython as vp'
				
				if (w.indexOf('random') > -1) { // let RapydScript-NG deal with importing random
					newprogram += '  '+indent+line+'\n'
					continue
				}

				if (VPython_import === null) VPython_names = []
				if (w[1] == '__future__') continue
				if (w[1] == 'visual.factorial') continue
	    		if (w[0] == 'from' && w[2] == 'import' && w.length >= 4) { // from X import a, b, c (or *)
	    			if (w[1] == 'visual.graph') {
	    				if (w[3] == '*') continue // from visual.graph import * is the only graph import supported at the moment
	    				return 'ERROR: Currently only "from visual.graph import *" is supported, line '+(lineno+2)+": "+lines[lineno]
	    			}
	    			if (!(w[1] == 'vpython' || w[1] == 'visual' || w[1] == 'vis')) {
	    				throw new Error("Line "+(lineno+2)+": cannot import from "+w[1])
	    			}
	    		    if (VPython_import === null) {
	    		    	if (w[3] == '*') continue // from vpython import * is the default
	    		    	VPython_import = w[1]
	    		        for (var j=3; j<w.length; j++) {
	    		            if (w[j].length > 0 && w[j] != ',') {
	    		                if (w[j].slice(-1) == ',') w[j] = w[j].slice(0,-1)
	    		                if (w[j] == ' ' || w[j] == '(' || w[j] == ')' || w[j][0] == '(' || w[j][-1] == ')') continue
	    		                VPython_names.push(w[j])
	    		            }
	    		        }
	    		    	if (VPython_names.indexOf('canvas') == -1) VPython_names.push('canvas')
	    		    }
	    		    continue
	    		} else if (w[0] == 'import' && w.length == 2) { // import X
	    			if (w[1] == 'visual.graph') return 'ERROR: Currently only "from visual.graph import *" is supported, line '+(lineno+2)+": "+lines[lineno]
	    			if (!(w[1] == 'vpython' || w[1] == 'visual' || w[1] == 'vis')) 
	    				return "ERROR: Cannot import from "+w[1]+", line "+(lineno+2)+": "+lines[lineno]
	    		    if (VPython_import === null) {
	    		    	VPython_import = w[1]
	    		    }
	    		    continue
	    		} else if (w[0] == 'import') { // import vpython (or visual or vis), or import vpython as vp
	    			if (w[1] == 'vpython' || w[1] == 'visual' || w[1] == 'vis') {
	    				if (w.length == 4 && w[2] == 'as') {
	    					VPython_import = w[3] // import vpython as vp
	    					continue
	    				} else return "ERROR: improper import statement, line "+(lineno+2)+": "+lines[lineno]
	    			} else {
	    				return "ERROR: Cannot import from "+w[1]+", line "+(lineno+2)+": "+lines[lineno]
	    			}
	    		}
			}
		    
		    // Handle single ('), double ("), and triple (''' or """) quotes; also count parens, brackets, and braces
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
		    			if (lang == 'javascript') break
		    			if (!singlequote && !doublequote && !triplequote) { // remove trailing comments
				    			line = line.slice(0,i)
		    			}
		    			break
		    		case "'":
		    		case '"':
		    			if (lang == 'javascript') break	    			
		    			if (i <= line.length-3 && line[i+1] == char && line[i+2] == char) { // ''' or """
		    				triplequote = !triplequote
		    				processedtriplequote = true
		    				i += 2
		    			} else {
		    				if (char == "'") {
		    					if (!doublequote && !triplequote) singlequote = !singlequote
		    				} else { // "
		    					if (!singlequote && !triplequote) doublequote = !doublequote
		    				}
		    			}
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
	    				return "ERROR: Unbalanced "+q+" quotes, line "+(lineno+2)+": "+lines[lineno]
	    			}
	    		}
	    		
	    		switch (char) {
		    		case ':':
		    			if (parens == 1 && braces === 0 && brackets === 0) { // anonymous function (':' not found in a dictionary)
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
    		 // End of handling single, double, and triple quotes, and counting parens, brackets, and braces
    		

		    if (!previousquote) {
		    	if (lang == 'vpython') {
			    	var m = pickpatt.exec(line+' ') // convert v.pick -> v.pick()
			    	if (m) {
			    		if (m[2] != '(' && (m[2].search(/\w/) != 0)) {
			    			var i = m.index
			    			line = line.slice(0,i)+'.pick()'+line.slice(i+5)
			    		}
			    	}
		    	}
			    

			    if (!processedtriplequote) { // don't make adjustments inside a triplequote comment
			    	// In this section we deal with inserting as needed Streamline tokens ('_'), which make it
			    	// possible to write synchronous code that Streamline reorganizes into asynchronous code.
			    	// The token must appear as an extra argument in statements such as rate or pause,
			    	// in the header of functions in which such statements are found, and in the calling
			    	// sequence for calling such functions.
			    	// Minor note: the version of Streamline currently in use in GlowScrpt has an option to
			    	// choose the token, which was 'wait', but current versions of Streamline require the
			    	// use of '_'. Given the possibility of updating to later versions of Streamline, we
			    	// use '_' and change a use of 'wait' to '_'.
			    	var more = true
			    	if (lang != 'javascript') {
			    		// Look for "def f(....)'
			    		var m = defpatt.exec(line)
			    		if (m !== null) {
			    			var fname = m[1]
			    			if (classindent >= 0) fname = '.'+fname
			    			defindents.push([newprogram.length, indent.length, fname, prebraces]) // remember where this def or class is; it may need 'wait'
			    			more = false
			    		}
			    	} else {
						// Look for "function f(...)" or "f = function (...)"
						var m = fctpatt.exec(line)
						if (m !== null && (m[1] == 'function' || m[2] == 'function')) {
							var fname
						    if (m[1] == 'function') fname = m[2]
							else if (m[2] == 'function') fname = m[1]
			    			defindents.push([newprogram.length, indent.length, fname, prebraces]) // remember where this function is; it may need 'wait'
			    			more = false
						}
			    	}
					if (more) {
				    	// Look for rate, sleep, get_library, .waitfor, .pause, read_local_file, and 
						// insert 'wait' argument (and if inside a function, insert earlier 'wait')
			    		var L = line.length
			    		var ret = waits(line, lang) // returns line, true if line modified, name of Streamline item (rate, pause, etc.)
			    		line = ret[0]
			    		
			    		if (ret[1] && defindents.length > 0) { // need to ensure def or function has wait argument
			    			var definfo = defindents[defindents.length-1] // [location of def or function in newprogram, indent level, function name]
			    			if (!infunction) {
			    				infunction = true // prevent multiple updating of def or function
			    				if (waitfcts[definfo[2]] === undefined)
			    						waitfcts[definfo[2]] = ret[2] // add to dictionary of functions that contain Streamline items
			    				var end
			    				var start = definfo[0]
				    			// Find ending ')' of the function:
				    			if (lang != 'javascript') {
				    				end = newprogram.slice(start).search(/:/) + start
					    			while (newprogram[end] !== ')') end--
				    			} else {
				    				end = newprogram.slice(start).search(/\(/)
				    				var parencnt = 1
				    				while (parencnt > 0) {
				    					end++
				    					switch (newprogram[start+end]) {
					    					case ('('):
					    						parencnt++
					    						break
					    					case (')'):
					    						parencnt--
					    						break
				    					}
				    				}
				    				end += start
				    			}
				    			var i = end-1
				    			while (newprogram[i] == ' ') i--
				    			var insert
				    			if (newprogram[i] == '(') newprogram = newprogram.slice(0,end)+GS_wait+newprogram.slice(end)
				    			else { // check to see whether wait is already present
				    				var iend = i
				    				while (true) {
				    					i--
				    					var c = newprogram[i]
				    					if (c == ',' || c == ' ' || c == '(') break
				    				}
				    				insert = newprogram.slice(i+1,iend+1)
				    				if (insert != GS_wait) {
				    					if (insert == 'wait') newprogram = newprogram.slice(0,i+1)+GS_wait+newprogram.slice(end)
				    					else newprogram = newprogram.slice(0,end)+','+GS_wait+newprogram.slice(end)
				    				}
				    			}
				    			
			    			}
			    		}
					}
			    }
		    }
    		
    		if (lang == 'vpython' || lang == 'rapydscript') {
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
			    		line.substr(0,4) == 'elif' ||
			    	    line.substr(0,6) == 'except' || 
			    	    line.substr(0,7) == 'finally') ) {
			    	c = lastindent+lineno_string+delim+(lineno+2)+delim+'\n'
			    } else c = indent+lineno_string+delim+(lineno+2)+delim+'\n'
			    
		    	if (indent.length == lastindent.length && (line.substr(0,4) == 'elif' || line.substr(0,4) == 'else')) {
		    		c = ''
		    	} else if (line.substr(0,3) == '"""' || line.substr(0,3) == "'''" || line[0] == ')') {
		    		c = ''
		    	}
			    
		    	if (line[line.length-1] == '=') return 'ERROR: Line '+(lineno+2)+" ends with equal sign: "+lines[lineno]
	
			    // need to indent the entire program two spaces
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
    		} else { // javascript
    			newprogram += indent+line+'\n'
    		}

		    lastindent = indent
		    if (parens < 0) return "ERROR: Too many right parentheses, line "+(lineno+2)+": "+lines[lineno]
		    if (brackets < 0) return "ERROR: Too many right brackets, line "+(lineno+2)+": "+lines[lineno]
		    if (braces < 0) return "ERROR: Too many right braces, line "+(lineno+2)+": "+lines[lineno]		    
		} // end of processing individual lines of code

    	// Find all calls to functions that require the Streamline token ('_')
    	// If such a function g is in canvas.bind(...., f) or in widget(... bind=f), throw an error,
    	//      as Streamline can't deal with f instead of f().
    	for (var i in waitfcts) {
    		var fname = i
    		var wname = waitfcts[i]
    		var reduced_wname = wname[0] == '.' ? wname.slice(1) : wname
    		var p = new RegExp('\\.bind[^,]*,\\s*'+fname+'\\s*\\)')
    		var n = newprogram.search(p)
    		if (n >= 0) throw new Error("Cannot bind function '"+fname+"' to an event because it contains a "+reduced_wname+" statement.")
    		p = new RegExp('\\s*bind\\s*=\\s*'+fname+'\\s*\\)')
    		n = newprogram.search(p)
    		if (n >= 0) throw new Error("Cannot bind function '"+fname+"' to a widget because it contains a "+reduced_wname+" statement.")
    		p = new RegExp('(\\w*)\\W*'+fname+'\\s*\\(', 'g')
    		while (true) {
    			var m = p.exec(newprogram) // find a call to a function that contains rate/pause etc.
    			if (m === null) break
    			if (m[1] == 'def' || m[1] == 'function') continue // skip that function itself
    			var parencnt = 1
    			var n = p.lastIndex-1
    			var startarg = n+1
    			var lastcomma = 0
    			var arg = ''
    			var q1 = false
    			var q2 = false
    			while (parencnt > 0) {
    				n++
    				switch (newprogram[n]) {
	                    case ("'"):
	                    	q1 = !q1
	                    	break
	                    case ('"'):
	                        q2 = !q2
	                        break
	    				case (' '):
	    					break
	    				case ('('):
	    					if (!(q1 || q2)) parencnt++
	    					break
	    				case (','):
	    					if (parencnt == 1) {
	    						lastcomma = n
	    						startarg = n+1
	    						arg = ''
	    					}
	    					break
	    				case (')'):
	    					if (!(q1 || q2)) parencnt--
	    					if (parencnt === 0) {
	    						if (arg.length > 0) {
	    							if (arg == 'wait' || arg == '_') {
	    								if (lastcomma > 0) newprogram = newprogram.slice(0,lastcomma+1)+GS_wait+newprogram.slice(n)
	    								else newprogram = newprogram.slice(0,startarg)+GS_wait+newprogram.slice(startarg+4)
	    							} else if (arg == GS_wait) ;
	    							else newprogram = newprogram.slice(0,n)+','+GS_wait+newprogram.slice(n)
	    						} else {
	    							newprogram = newprogram.slice(0,startarg)+GS_wait+newprogram.slice(n)
	    						}
	    					}
	    					break
	    				default:
	    					arg += newprogram[n]
    				}
    			}
    		}
    	}
    	
    	if (parens > 0) return "ERROR: Missing right parenthesis, see line "+(lastleftparens+2)+": "+lines[lastleftparens]
	    else if (brackets > 0) return "ERROR: Missing right bracket, see line "+(lastleftbracket+2)+": "+lines[lastleftbracket]
	    else if (braces > 0) return "ERROR: Missing right brace, see line "+(lastleftbrace+2)+": "+lines[lastleftbrace]
	    else return newprogram
    }

    var linenopatt = /"(\d*)"/

    var RS_compiler

    function compile_rapydscript(rs_input) {
	    if (rs_input.slice(0,7) == 'ERROR: ') {
	    	throw new Error(rs_input.slice(7))
    	} else {
    	    if (RS_compiler === undefined) RS_compiler = RapydScript.create_embedded_compiler();
	        rs_input += '\n'; //just to be safe
	        try {
	        	var output = RS_compiler.compile(rs_input, {js_version:5}) // default is ES6; use ES5 until can update Stramline
	        	//var output = RS_compiler.compile(rs_input)
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

    // vp_primitives come in two flavors: "box" for JavaScript/RapydScript and "vp_box" for VPython
    var vp_primitives = ["box", "sphere", "cylinder", "pyramid", "cone", "helix", "ellipsoid", "ring", "arrow", "compound"]
    
    var vp_other = ["canvas", "vec", "vector", "rate", "sleep", "update", "color", "extrusion", "paths", "shapes",
                    "vertex", "triangle", "quad", "label", "distant_light", "local_light", "attach_trail", "attach_arrow",
                    "sqrt", "pi", "abs", "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "exp", "log", "pow",
                    "factorial", "combin", "button", "radio", "checkbox", "slider", "checkbox", "text",
                    "radians", "degrees",
                    "get_library", "read_local_file"]
    
    function compile(program, options) {
    	// options include lang ('javascript' or 'rapydscript' or 'vpython'), version,
    	//     run (true if will run the code, false if compiling for sharing, in which case don't call fontloading)
    	options = options || {}
    	window.__original = {text: program.split("\n")}
        window.__GSlang = options.lang
        var version = '["'+options.version+'", "glowscript"]' // e.g. ['1.1', 'glowscript']
        
        // Look for text object in program
    	// findtext finds "...text  (....." and findstart finds "text  (...." at start of program
        var findtext = /[^\.\w]text[\ ]*\(/
        var findstart = /^text[\ ]*\(/
    	var loadfonts = findtext.exec(program)
        if (!loadfonts) loadfonts = findstart.exec(program)
        // Not clear the following helped, because both this call to fontloading and the call inserted 
        // at the start of the compiled program led to accessing the font files twice.
        //if (options.run && loadfonts) fontloading() // trigger loading of font files for 3D text, in parallel with compilation (unless compiling for sharing)
        
        // Work around the problem that .delete is not allowed in JavaScript; for API need d = canvas() .... d.delete() to delete canvas:
        program = program.replace(/\.delete/g, ".remove")
        
        function pop_replace(m, p1, p2) {
        	if (p2.length === 0) return m
        	else return '.py'+m.slice(1)
        }
        
        if (options.lang == "rapydscript" || options.lang == 'vpython') {
        	program = preprocess(program, options.lang)
    		var vars = ''
        	if (program.slice(0,7) == 'ERROR: ') {
        		compile_rapydscript(program)
        	} else {
	        	var prog
	        	if (options.lang == 'rapydscript') {
	        		prog = "def main(" + GS_wait + "):\n  version = "+version+"\n  window.__GSlang = 'rapydscript'\n  scene = canvas()\n  print = GSprint\n" + program + "main"
	        	} else { // 'vpython'
	                program = program.replace(/arange\s*\(/g, 'range(')   // Make arange equivalent to range
	                // if pop(), leave as is to work ok with both lists and sets, but if pop(N), which is only found with lists, use pypop(N)
	                program = program.replace(/(\.pop\s*\(\s*)([^)]*)/g, pop_replace)
	                program = program.replace(/\.sort\s*\(/g, '.pysort(')  // Make sort equivalent to pysort (RapydScript python-like sort)
	        		prog = "def main(" + GS_wait + "):\n  version = "+version+"\n"
        			prog += "  window.__GSlang = 'vpython'\n" // WebGLRenderer needs to know at run time what models to create
        			// The following turned out to slow all calculations down by about a factor of 5 and so was abandoned:
        			//prog += "  from __python__ import dict_literals, overload_getitem\n" // so that dictionaries behave like Python dictionaries
	        		if ( VPython_import === null) {
		        		for (var i = 0; i<vp_primitives.length; i++) prog += "  "+vp_primitives[i]+"=vp_"+vp_primitives[i]+"\n"
		        		prog += "  display=canvas\n  vector=vec\n"
	        		} else if (VPython_names.length > 0) { // e.g from vpython import box, cylinder
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
	        				if (n < 0) vars += "  "+name+"=undefined\n"  // just undefine those entities not listed in the import; those listed need no mention
	        			}
	        			prog += vars
	        		} else { // import vpython or visual or vis, or import vpython or visual or vis as (VPython_import)
	        			var importpatt = new RegExp(VPython_import+'\\.(\\w+)', 'g')
	        			var m = program.match(importpatt) // has the form [vis.vector, vis.rate, vis.vector, .....]
	        			importpatt = new RegExp(VPython_import+'\\.(\\w+)')
	        			var attrs = {} // a dictionary containing all the objects referenced in the program
	        			for (var i=0; i<m.length; i++) {
	        				var a = importpatt.exec(m[i])[1] // extract "rate" from "vis.rate" or "visual.rate"
	        				if (!(a in attrs)) attrs[a] = a
	        			}
	        			var purge = '' // set variables unqualified by vis. or visual. to "undefined"
		        		vars += '    var '+VPython_import+'={'
	        			for (var i=0; i<vp_primitives.length; i++) {
	        				var name = vp_primitives[i]
	        				if (name in attrs) vars += name+':vp_'+name+', '
	        				else purge += "  "+name+'=undefined\n'
	        			}
	        			vars += 'canvas:canvas, '
	        			for (var i=0; i<vp_other.length; i++) {
	        				var name = vp_other[i]
	        				if (name == 'canvas') continue
	        				if (name in attrs) {
	        					if (name == 'vector') vars += 'vector:vec, '
	        					else vars += name+':'+name+', '
	        				} else {
	        					if (name == 'vec' && ('vector' in attrs)) continue
	        					purge += "  "+name+'=undefined\n'
	        				}
	        			}
	        			vars = vars.slice(0,-2)+'}\n'
	        			prog += purge
	        		}
	        		prog += "  print=GSprint\n"
	        		if (VPython_import === null || VPython_names.length > 0) prog += "  scene = canvas()\n"
	        		else prog += "  scene = "+VPython_import+".canvas()\n"
	        		
	        		prog += "  from pythonize import strings\n"
	        		prog += "  strings()\n"
	        		prog += program
	        	}
	        	
	        	program = compile_rapydscript(prog)
	        	var start = program.indexOf('window.__GSlang')
	        	var arr = "Array.prototype['+']=function(r) {return this.concat(r)}\n" // adding Python lists
        		arr += "    Array.prototype['*']=function(r) {return __array_times_number(this, r)}\n" // multiplying Python list times number
	        	arr += "    var __name__ = '__main__'\n"
	        	
        		if (VPython_names.length <= 0) arr += vars
	        	program = program.slice(0,start) + arr + program.slice(start-4)
        	}
        	
        } else { // JavaScript
        	program = preprocess(program, options.lang)
            var prog = "function main(" + GS_wait + ") {\n"
            prog += "var version = "+version+";\n"
            prog += "var scene = canvas();\n"
            	
            // This string formatting machinery was originally used by both Python and JavaScript,
            // but with the change to rapydscript-ng, which has its own format method, Python uses
            // the rapydscript-ng method, and the following is used only by JavaScript programs.
            prog += "Array.prototype.toString = function() { return __parsearray(this) };\n"
            	
            // Placing this here instead of in vectors.js gives stack overflow:
    		//prog += "Number.prototype['*'] = function (r) {" // check whether right operand is Number or vec
        	//prog +=    "return (r instanceof vec) ? r.multiply(this) : r*this};\n"
            program = prog + program + "\n};\nmain"
        }
    	
        if (loadfonts) {
        	var s = "scene = canvas();\n"
            var sc = program.indexOf(s) + s.length
        	s = "    waitforfonts("+GS_wait+")\n"  // wait for font files
            program = program.slice(0,sc)+s+program.slice(sc,program.length)
        }
        
        // handle operator overloading
        var parsed = papercompile(program)
        /* 
        if (options.lang == 'vpython') { // process only that portion of program that's relevant (VPython-specific)
        	var s = 'strings();\n'
            var start = program.indexOf(s) + s.length
            s = '};\nif (!main'
            var end = program.indexOf(s)
            parsed = papercompile(program.slice(start,end)) // handle operator overloading
            parsed = program.slice(0,start)+parsed+program.slice(end)
        } else parsed = papercompile(program)
        */
        
    	// Still using an old version of Streamline (lib/compiling/transform.js) because 
    	// uglify cannot minimize the new version (lib/compiling/transform-es6.js), which uses ES6.
    	// transform-es6.js is 1.8 MB, so it's important to minimize it.
        var prog = window.Streamline.transform(parsed, { alreadyParsed: true }) // permit synhronous code
    	//var prog = window.Streamline.transform(parsed, { alreadyParsed: true, runtime: "callbacks" }) // permit synhronous code
    	//var prog = Streamline.transform(parsed, { alreadyParsed: true, callback: wait }) // older version
    	
		program = prog.replace(/\n\n\n\n/g, '') // eliminate lots of white space
		// Reduce RS_ls = "4" to "4" (specifying original line number in output for error return purposes)
		if (options.lang != 'javascript') program = program.replace(new RegExp(' '+lineno_string, 'g'), ' ')
		program = program.replace(/Math.pow/g, 'GS_power') // enable checking for trying to take a vec to a power
		
		if (loadfonts) program = "fontloading();\n" + program
		
		// Removing a final _() eliminates an irrelevant error message associated with Streamline:
		var s = GS_wait+'()'
		var sc = program.lastIndexOf(s)
		if (sc > -1) program = program.slice(0,sc) + program.slice(sc+s.length,program.length)
		
//        var p = program.split('\n')
//    	for (var i=0; i<p.length; i++) console.log(i, p[i])
		return program
    }
    window.glowscript_compile = compile

		
})();