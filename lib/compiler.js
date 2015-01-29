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
	    				throw new Error('Line '+(lineno+2)+': Currently only "from visual.graph import *" is supported.' )
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
	    		                VPython_names.push(w[j])
	    		            }
	    		        }
	    		    }
	    		    continue
	    		} else if (w[0] == 'import' && w.length == 2) { // import X
	    			if (w[1] == 'visual.graph') throw new Error('Line '+(lineno+2)+': Currently only "from visual.graph import *" is supported.' )
	    			if (!(w[1] == 'visual' || w[1] == 'vis' || w[1])) {
	    				throw new Error("Line "+(lineno+2)+": cannot import from "+w[1])
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
	    	var brackets = false, braces = false
	    	var previouscontinuedline = continuedline
	    	var triplequote = false // true if in the midst of """......"""
	    	var tline = ""
	    	for (var i=0; i<line.length; i++) {
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
	    				i += 2
	    			} else if (!triplequote && !singlequote) doublequote = !doublequote; console.log('double', doublequote)
	    			break
	    		case "'":
	    			if (lang != "coffeescript" && i <= line.length-3 && line[i+1] == "'" && line[i+2] == "'") {
	    				if (triplequote && i <= line.length-4 && line[i+3] == "'") break
	    				triplequote = !triplequote
	    				i += 2
	    			} else if (!triplequote && !doublequote) singlequote = !singlequote; console.log('single', singlequote)
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
	    			console.log('left parens')
	    			parens++
	    			break
	    		case ')':
	    			console.log('right parens')
	    			parens--
	    			if (lang != 'coffeescript' && indef && parens == 0) indef = false
	    			break
	    		case '[':
	    			brackets++
	    			break
	    		case ']':
	    			brackets--
	    			break
	    		case '{':
	    			braces++
	    			break
	    		case '}':
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

		    if (lang == 'vpython') {
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
		    	line = line.replace(/global/,'nonlocal')
		    	line = line.replace(/\.mouse\.camera/g,'.camera.pos')
		    	// The following two lines are due to what seems to be an error in using $1 and $2.
		    	var newline = line.replace(/\.title\s*=\s*/, ".title.text(")
		    	if (newline != line) line = newline+')'
		    	if (line.search(defpatt) >= 0 || line.search(classpatt) >= 0) {
		    		defindents.push([newprogram.length, indent.length]) // remember where this line is; it may need 'wait'
		    	} else {
			    	// Look for rate, sleep, get_library, .waitfor, .pause, read_local_file, and 
					// insert 'wait' argument (and if inside a function, insert earlier 'wait')

		    		var L = line.length
		    		line = waits(line)
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
		    
		    // When outdent line starts with ')', the "N" must be indented.
		    // When outdent line starts with 'else' or 'elif', at the same level as prevous line,
		    //   don't insert a line number; it's this case:
		    //     if a: b
		    //     elif c: d
		    //     else e: f
		    
		    c = ''
		    if (indent.length < lastindent.length && ( line.charAt(0) == ')' || 
		    		line.substr(0,4) == 'else' ||
		    		((lang == 'rapydscript' || lang == 'vpython') && line.substr(0,4) == 'elif' ) )) {
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
		    		} else newprogram += '  '+c+'  '+indent+line+'\n'
		    	}
		    } else {
		    	newprogram += c+lines[lineno]+'\n'
		    }

		    lastindent = indent
		}
    	
	    if (parens > 0) return "ERROR: Missing right parentheses."
	    else if (parens < 0) return "ERROR: Too many right parentheses."
	    else if (brackets > 0) return "ERROR: Missing right brackets."
	    else if (brackets < 0) return "ERROR: Too many right brackets."
	    else if (braces > 0) return "ERROR: Missing right braces."
		else if (braces < 0) return "ERROR: Too many right braces."
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
    
    function lineNumbers(prog, lang) {
		
		if (lang == 'coffeescript') {
	    	var patt = /\/\*[ ]*(\d*)[ ]\*\//
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
		} else if (lang == 'rapydscript' || lang == 'vpython') {
			patt = /"(\d*)"/
	    	var lines = prog.split('\n')
			for (var n=0; n<lines.length; n++) {
			    var getline = lines[n].match(patt)
			    if (getline !== null) break
			}
			var linenum = 0
	    	var prog2 = lines.slice(0,n)
	    	var ntrue = n
	    	for (; n<lines.length; n++) {
	    		var getline = lines[n].match(patt)
	    		if (getline !== null) {
	    			linenum = getline[1]
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
			document.write(rs_input)
    	} else {
	        var output = OutputStream(OUTPUT_OPTS)
	        rs_input += '\n'; //just to be safe
	        try {
	            var TOPLEVEL = parse(rs_input, RS_OPTIONS);
	            TOPLEVEL.print(output);
				return output.toString();
	        } catch(err) {
	        	if (err.line === undefined) {
        			document.write(err.message)
        			console.log(err.message)
        			throw new Error(err.message)
	        	} else {
		        	var prog = rs_input.split('\n')
		        	for (var i=err.line-1; i>0; i--) {
		        		var m = prog[i].match(/[ ]*"(\d*)"/)
		        		if (m) {
		        			document.write(err.message, ' near line ',m[1],': ',window.__original.text[m[1]-2])
		        			console.log(err.message, ' near line ',m[1],': ',window.__original.text[m[1]-2])
		        			throw new Error(err.message, ' near line ',m[1],': ',window.__original.text[m[1]-2])
		        		}
		        	}
	        	}
	        }
    	}
    }
    
    var vp_primitives = ["box", "sphere", "cylinder", "pyramid", "cone", "helix", "ellipsoid", "ring", "arrow"]
    
    var vp_other = ["vec", "rate", "sleep", "update", "compound", "color",
                    "vertex", "triangle", "quad", "label", "distant_light", "local_light", "attach_trail", "attach_arrow",
                    "sqrt", "pi", "abs", "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "exp", "log", "pow",
                    "radians", "degrees", "gcurve", "gdots", "gvbars", "ghbars", "gdisplay", "ghistogram",
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
        
        if (options.lang == "coffeescript") {
        	program = insertLineNumbers(program, options.lang)
            program = "main = (" + wait + ")->\n scene = canvas()\n " + program.replace(/\n/g, "\n ") + "\n return\nreturn main"
            program = CoffeeScript.compile(program) // Removes blank lines and comments
            CSlineNumbers(program)
            
        } else if (options.lang == "rapydscript" || options.lang == 'vpython') {
        	program = insertLineNumbers(program, options.lang)
        	if (program.slice(0,7) == 'ERROR: ') {
        		compile_rapydscript(program)
        	} else {
	        	var prog
	        	if (options.lang == 'rapydscript') prog = "def main(" + wait + "):\n  scene = canvas()\n  _$rapyd$_Temp = 0\n  _$rapyd$_print = print\n" + program + "main"
	        	else { // 'vpython'
	        		prog = "def main(" + wait + "):\n"
	        		if ( VPython_import === null) {
	        			prog += "  window.__GSlang = 'vpython'\n" // WebGLRenderer needs to know at run time what models to create
		        		for (var i = 0; i<vp_primitives.length; i++) prog += "  "+vp_primitives[i]+"=vp_"+vp_primitives[i]+"\n"
		        		prog += "  scene = canvas()\n  display=canvas\n  vector=vec\n  _$rapyd$_Temp=0\n  _$rapyd$_print=print\n  arange=range\n"
	        		} else if ((VPython_import == 'visual' || VPython_import == 'vis') && VPython_names.length > 0) { // e.g from visual or vis import box, cylinder
	        			var vars = "  window.__GSlang = 'vpython'\n" // WebGLRenderer needs to know at run time what models to create
	        			for (var i=0; i<vp_primitives.length; i++) {
	        				var n = VPython_names.indexOf(vp_primitives[i])
	        				if (n >= 0) vars += "  "+vp_primitives[i]+"=vp_"+vp_primitives[i]+"\n"
	        				else vars += "  "+vp_primitives[i]+"=undefined\n"
	        			}
	        			for (var i=0; i<vp_other.length; i++) {
	        				var n = VPython_names.indexOf(vp_other[i])
	        				if (n < 0) vars += "  "+vp_other[i]+"=undefined\n"
	        			}
	        			prog += vars
	        			prog += "  scene = canvas()\n"
		        		prog += "  vector=vec\n  _$rapyd$_Temp=0\n  _$rapyd$_print=print\n  arange=range\n"
	        		} else if ((VPython_import == 'visual' || VPython_import == 'vis') && VPython_names.length == 0) { // import visual or vis
	        			// Cannot purge vec etc. because that effectively removes even visual.vec or vis.vec
	        			//var purge = ''
	        			var vars = "  window.__GSlang = 'vpython'\n" // WebGLRenderer needs to know at run time what models to create
		        		vars += '  '+VPython_import+'={'
	        			for (var i=0; i<vp_primitives.length; i++) {
	        				vars += vp_primitives[i]+':vp_'+vp_primitives[i]+','
	        				//purge += '  '+vp_primitives[i]+"=undefined\n"
	        			}
	        			for (var i=0; i<vp_other.length; i++) {
	        				vars += vp_other[i]+':'+vp_other[i]+','
	        				//purge += '  '+vp_other[i]+"=undefined\n"
	        			}
	        			vars = vars.slice(0,-1)+'}\n'
	        			//purge = purge.slice(0,-1)+'\n'
	        			prog += vars
	        			//prog += purge
	        			prog += "  "+VPython_import+".vector="+VPython_import+".vec\n"
	        			prog += "  "+VPython_import+".display=canvas\n"
	        			prog += "  scene = canvas()\n"
	        			prog += "  _$rapyd$_Temp=0\n  _$rapyd$_print=print\n  arange=range\n"
	        		}
	        		prog += program + "main"
	        	}
	        	console.log('final [\n'+prog+'\n]')
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
            program = "function main(" + wait + ") {var scene = canvas();\n" + program + "\n};\nmain"
        }
        //var p = program.split('\n')
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
        //console.log(window.__linenumbers)
        //var p = prog.split('\n')
    	//for (var i=0; i<p.length; i++) console.log(i, p[i])
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