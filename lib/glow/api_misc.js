;(function () {
    "use strict";
    // Miscellaneous API stuff that doesn't belong in any other module, and doesn't deserve its own

    async function get_library(URL) { // import a JavaScript library file, by URL
        var done = false
        var t1 = msclock()

        $.getScript(URL)
          .done(function(script, textStatus) {
              done = true
          })

          .fail(function(jqxhr, settings, exception) {
              alert('Could not access the library\n  '+URL)
              return
          })

        while (true) {
            await rate(60)
            if (done) return
            var t2 = msclock()
            if (t2-t1 > 6000) {
                var yes = confirm('Timed out trying to access the library\n  '+URL+'\nTry again?')
                if (yes) {
                    t1 = msclock()
                } else {
                    return
                }
            }
        }
    }
    
    async function read_local_file(place) {
        var info = null
        if (arguments.length === 0) place = $('body')
        place.append('<input type="file" id="read_local_file"/>')
        
        function readSingleFile(evt) {
            var f, reader;
            f = evt.target.files[0];
            if (f) {
                // Also available: f.name, f.size, f.type, and 
                // if f.lastModifiedDate, f.lastModifiedDate.toLocaleDateString()
        
                reader = new FileReader();
                reader.onload = function(e) {
                    var moddate = (f.lastModifiedDate) ? f.lastModifiedDate.toLocaleDateString() : ''
                    info = {name:f.name, text:e.target.result, size:f.size, type:f.type, date:moddate}
                    $('#read_local_file').remove()
                }
                return reader.readAsText(f)
            } else {
                alert("Failed to load file")
                return
            }
        }
        
        document.getElementById('read_local_file').addEventListener('change', readSingleFile, false)

        while (info === null) await rate(60)
        return info
    }
    
    function download(filename, data){ // send data file to Download directory
        if (filename.constructor !== String) throw new Error('A download file name must be a string.')
        if (data.constructor !== String) throw new Error('The download data must be a string.')
        let a = document.createElement("a")
        a.setAttribute('href', 'data:text/text;charset=utf-8,' + encodeURI(data));
        a.setAttribute('download', filename);
        a.click()
        a.remove()
    }
    
    // http://my.opera.com/edvakf/blog/how-to-overcome-a-minimum-time-interval-in-javascript
    // This function is supposed to return almost instantly if there is nothing pending to do
    /*
    function async(cb) {
        function wrapCB() {
            cb()
        }
        var img = new Image;
        img.addEventListener('error', wrapCB, false);
        img.src = 'data:,';
    }
    */
    
    async function update() {
        // TODO: Be fast when called in a tight loop (only sleep every few ms)
        await sleep(0)
    }

    async function sleep(dt) { // sleep for dt seconds; minimum working sleep is about 5 ms with Chrome, 4 ms with Firefox
        return new Promise( resolve => { setTimeout(() => { resolve() }, 1000*dt) } )
    }

    async function waitforfonts() { // wait for sans and serif font files to be delivered to opentype.js
        while (true) {
            await rate(60)
            if ((window.__font_sans !== undefined) && (window.__font_serif !== undefined))
                return new Promise( (resolve) => { resolve() } )
        }
    }
    
    function fontloading() { // trigger loading of fonts for 3D text
    	// called from compiler and from exported programs
    	//console.trace() // display caller stack
    	if (window.__font_sans === undefined) {
	    	var fsans
	    	if (navigator.onLine) fsans =  'https://s3.amazonaws.com/glowscript/fonts/Roboto-Medium.ttf' // a sans serif font
	    	else fsans =  '../lib/FilesInAWS/Roboto-Medium.ttf' // a sans serif font
			opentype_load(fsans, function(err, fontrefsans) {
	            if (err) throw new Error('Font ' + fsans + ' could not be loaded: ' + err)
	        	window.__font_sans = fontrefsans // an opentype.js Font object
	        })
    	}
        if (window.__font_serif === undefined) {
	    	var fserif
	    	if (navigator.onLine) fserif = 'https://s3.amazonaws.com/glowscript/fonts/NimbusRomNo9L-Med.otf' // a serif font
	    	else fserif = '../lib/FilesInAWS/NimbusRomNo9L-Med.otf' // a serif font
	        opentype_load(fserif, function(err, fontrefserif) {
	            if (err) throw new Error('Font ' + fserif + ' could not be loaded: ' + err)
	        	window.__font_serif = fontrefserif // an opentype.js Font object
	        })
    	}
    }
   
    // Angus Croll: http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
    // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
    // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"

    var toType = function(obj) { 
        return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
    }
    
    function convert(arg) {
        let s
        if (arg instanceof vec) { arg = arg.toString()
        } else if (arg === null) { arg = "null"
        } else if (arg === undefined) { arg = "undefined"
        } else if (toType(arg) == "object") { // object literal; should use recursion. like array.toString() in this file
            let zerojsmap = false
        	if (arg.jsmap !== undefined) { // dictionary
                zerojsmap = (arg.jsmap.size == 0)
    			let temp = {}
    			for (var [key,value] of arg.jsmap) temp[key] = value
    			arg = temp
                if (zerojsmap) arg = "{}"
                else {
                    s = "{"
                    for (let a in arg) s += a + ":" + arg[a] + ", "
                    arg = s.slice(0,-2) + "}"
                }
            }
        } else if (toType(arg) == 'map') {
            s = 'dict_keys([' // or dict_items or dict_values
            for (const k of arg) s += "'"+k + "', "
            arg = s.slice(0,-2)+'])'
        } else if (toType(arg) == "number") { // poptions.digits default value is 6
            let period, char, end
            if (arg === 0) return 0
            let d = poptions.digits
            let output = []
            let val = Math.abs(arg)
            if (val < 1e-2) arg = arg.toExponential(d-1)
            else if (val < 1) arg = arg.toPrecision(d)
            else if (val >= 1e4) arg = arg.toExponential(d-1)
            else { // range from 1 to 10000
            	let f = 0
            	if (d == 2 && val < 10) {
            		f = 1
            	} else if (d == 3) {
            		if (val < 10) f = 2
            		else if (val < 100) f = 1
            	} else if (d == 4) {
            		if (val < 1000) f = 1
            		if (val < 100) f += 1
            		if (val < 10) f += 1
            	} else if (d >= 5) {
	        		if (val < 10000) f = d-4
	        		if (val < 1000) f += 1
	        		if (val < 100) f += 1
	        		if (val < 10) f += 1
            	}
            	arg = arg.toFixed(f)
            }
            period = arg.indexOf('.')
            if (period >= 0) {
                end = arg.indexOf('e')
                if (end < 0) end = arg.length
                char = end
                while (true) {
                    char--
                    if (arg.charAt(char) == '0') continue
                    if (char == period) {
                        output.push(arg.slice(0, period).concat(arg.slice(end, arg.length)))
                        break
                    }
                    if (end == arg.length) output.push(arg.slice(0, char + 1))
                    else output.push(arg.slice(0, char + 1).concat(arg.slice(end, arg.length)))
                    break
                }
            if (arg.match(/e/)) {
                arg = arg.replace(/0*e/, 'e')
                arg = arg.replace(/\.e/, 'e')
            } else if (arg.match(/\./)) arg = arg.replace(/0*$/, '')
            arg = arg.replace(/\.$/,'')
            }
        } else arg = arg.toString()
        return arg
    }
    
    var printarea = null // don't create a textarea until a print statement is executed
    var poptions = {place:$('body'), width:640, height:100, readonly:true, pos:"bottom", digits:6}
    
    function modify_printarea() {
        var w = (poptions.width === undefined) ? 640 : poptions.width
        var h = (poptions.height === undefined) ? 100 : poptions.height
        var readonly = (poptions.readonly === undefined) ? true : poptions.readonly
        if (poptions.pos == "right") canvas.container.css({float:"left"})
        else if (poptions.pos == "bottom") canvas.container.css({clear:"both"})
        printarea.css('width', w).css('height', h)
        if (readonly) printarea.attr('readonly', 'readonly')
        else printarea.attr('readonly', null)
    }
        
    function print_to_string(args) {
        var s = ''
        var L = arguments.length
        for (var i=0; i<L; i++) {
            var arg = arguments[i]
            if (toType(arg) == "array") {
            	arg = parsearray(arg)
            } else if (window.__GSlang == 'vpython') { 
            	if (arg === null) arg = 'None'
            	else if (toType(arg) == "boolean") arg = (arg) ? 'True' : 'False'
            	else arg = convert(arg)
            } else {
                arg = convert(arg)
            }
            if (s.length === 0) s += arg
            else s += ' '+arg
        }
        return s
    }
    
    var print_container = $("<div/>")

    function print(args) { // similar to Python print()
        // print(x, y, z, {sep:' ', end:'\n'}) // specifying different sep and/or end is optional
    	if (printarea === null) { // need to make a new printarea
            var container = print_container
            //container.css({float:"left"})
            container.appendTo(poptions.place)    // default is $('body'), below canvas (2.7)
            window.__context.print_container = container
            printarea = $('<textarea id=print spellcheck="false"/>').appendTo(container).css('font-family', 'Verdana', 'Sans-Serif').css('font-size', '100%')
            modify_printarea()
    	}
      
        var sep = ' '
        var end = '\n'
        var L = arguments.length
        var arg = arguments[L-1]
        if (arg != null && arg !== undefined) {
            var isobject = false
            if (arg.sep !== undefined) {
                sep = arg.sep
                isobject = true
            }
            if (arg.end !== undefined) {
                end = arg.end
                isobject = true
            }
            if (isobject) L--
        }
        
        var s = ''
        for (var i=0; i<L; i++) {
            var arg = arguments[i]
            arg = print_to_string(arg)
            if (s.length === 0) s += arg
            else s += sep+arg
        }
        s += end
        printarea.val(printarea.val()+s)
        // Make the latest addition visible. Does not scroll if entire text is visible,
        // and does not move the scroll bar more than is necessary.
        printarea.scrollTop(printarea.scrollTop() + 10000)
    }
    
    function print_options(args) {
        var contents = ''
        for (var a in args) {
            poptions[a] = args[a]
        }
        if (args.digits !== undefined) {
        	var d = args.digits
        	poptions.digits = Math.floor(d+.5) // ensure that digits is an integer
        	if (poptions.digits < 1 || poptions.digits > 15) throw new Error('print_options digits must in the range of 1 to 15.')
        }
        if (printarea !== null) {
            if (args.clear !== undefined && args.clear) printarea.val('')
            modify_printarea()
            if (args.contents !== undefined && args.contents) contents = printarea.val()
            if (args.remove !== undefined && args.remove) {
                printarea.remove()
                printarea = null
            }
        }
        return contents
    }
    
	window.performance = window.performance || {};
    
    function msclock() {
    	if (performance.now) return performance.now()
    	else return new Date().getTime()
    }
    
    function clock() {
    	return 0.001*msclock()
    }
    
    function factorial(x) {
        if (x <= 0) {
            if (x === 0) return 1
            else throw new Error('Cannot take factorial of negative number ' + x)
        }
        var fact = 1
        var nn = 2
        while (nn <= x) {
            fact *= nn
            nn++
        }
        if (nn != x+1) throw new Error('Argument of factorial must be an integer, not ' + x)
        return fact
    }

    function combin(x, y) {
        // combin(x,y) = factorial(x)/[factorial(y)*factorial(x-y)]
        // combin gives the combination of x things taken y at a time without repetition. 
        var z = x-y
        var num = 1
        if (y > z) {
            var temp = y
            y = z
            z = temp
        }
        var nn = z+1
        var ny = 1
        while (nn <= x) {
            num *= nn/ny
            nn++
            ny++
        }
        if (nn != x+1) throw new Error('Illegal arguments ('+x+','+y+') for combin function')
        return num
    }

    //console.log('factorial(6) = 6! =', factorial(6)) // should be 720
    //console.log('combin(6,2) = 6!/(2!(6-2)!) =', combin(6,2)) // should be 15
    //console.log('combin(1000,500) = 1000!/(500!(1000-500)!) =', combin(1000,500)) // should be 2.70288240945e+299
    
    function pa(L) {
        var s = '['
        for (var i=0; i<L.length; i++) {
            var a = L[i]
            if (a === undefined) s += 'undefined, '
            else if (a === null) s += (window.__GSlang == 'vpython') ? 'None ' : 'null '
            else if (toType(a) == 'number') s += convert(a)+', '
            else if (toType(a) == "array") s += pa(a)
            else if (toType(a) == 'string') s += "'"+a+"'"+', ' // avoid infinite recursion; display quote marks inside arrays/lists
            else s += a.toString()+', '
        }
        if (s.slice(-2) == ', ') s = s.slice(0,-2)
        return s+'], '
    }

    function parsearray(L) {
        if (L === undefined) return 'undefined'
        if (L === null) return (window.__GSlang == 'vpython') ? 'None' : 'null'
        return pa(L).slice(0,-2) // delete final ', '
    }

    String.prototype.format = function(args) {
		 // Inspired by the formatting function presented at www.npmjs.com/package/python-format by
		 // x.fix@o2.pl (@glitchmr on npm), which included the very useful list of Python format codes.
		
		 function format_item(arg, op, first, second) {
		     // in ':2.1f", first is 2, second is 1, op is f
		     
		     function pad(s, first) {
		         var p = ''
		         for (var i=0; i<first-s.length; i++) p += ' '
		         return p + s
		     }
		     
		     var formats = {
		         b: function () {
		             return pad(arg.toString(2), first)
		         },
		         c: function () {
		             return pad(String.fromCharCode(arg), first)
		         },
		         d: function () {
		             return pad(Math.floor(Math.round(arg)).toString(), first)
		         },
		         e: function () {
		             var v = pad(arg.toExponential(second || 6), first)
		             var eloc = v.search('e')
		             var exponent = v.slice(eloc)
		             v = v.slice(0,eloc)
		             if (exponent.length == 3) exponent = exponent.slice(0,2)+'0'+exponent.slice(-1)
		             return v + exponent
		         },
		         E: function () {
		             return formats.e()
		         },
		         f: function () {
		             if (second == 0) second = 6
		             else if (second == -1) second = 0
		             return pad(arg.toFixed(second), first)
		         },
		         F: function () {
		             return formats.f()
		         },
		         g: function () {
		             if (arg == 0) return '0'
		             if (second == 0) second = 6
		             var a = Math.abs(arg)
		             var v
		             if (1e-4 <= a && a < Math.pow(10, second)) {
		                 if (a < 0.1) { // between 1e-4 and 1e-2 Python writes e.g. 0.00123
		                     var etype = arg.toExponential(second)
		                     etype = etype.replace('.', '')
		                     var eloc = etype.search('e')
		                     var exponent = etype.slice(eloc+2)
		                     var val = etype.slice(0,eloc)
		                     var length = val.length
		                     if (arg < 0) {
		                        length++
		                        second++
		                     }
		                     if (length > second) val = val.slice(0,second)
		                     var sign = ''
		                     if (val.slice(0,1) == '-') {
		                         sign = '-'
		                         val = val.slice(1)
		                     }
		                     v = val.slice(0,second)
		                     while (v.slice(-1) == '0') v = v.slice(0,-1)
		                     if (exponent == 2) return sign+'0.0'+v
		                     else if (exponent == 3) return sign+'0.00'+v
		                     else return sign+'0.000'+v // exponent must be 4
		                 } else {
		                 	 if (a >= 1) second--
		                     v = formats.e()
		                 	 var eloc = v.search('e')
		                 	 var exponent = Number(v.slice(eloc+1))
		                 	 var val = Number(v.slice(0,eloc))
		                 	 arg = val*pow(10,exponent)
		                 	 v = formats.f()
		                     while (v.slice(-1) == '0') v = v.slice(0,-1)
		                     if (v.slice(-1) == '.') v = v.slice(0,-1)
		                     return v
		                 }
		             }
		             else {
		                 second--
		                 v = formats.e()
		                 var eloc = v.search('e')
		                 var exponent = v.slice(eloc)
		                 v = v.slice(0,eloc)
		                 while (v.slice(-1) == '0') v = v.slice(0,-1)
		                 if (v.slice(-1) == '.') v = v.slice(0,-1)
		                 return v + exponent
		             }
		         },
		         G: function () {
		             return formats.g().toUpperCase()
		         },
		         n: function () {
		             return formats.g()
		         },
		         o: function () {
		             return pad(arg.toString(8), first)
		         },
		         s: function () {
		             var t = arg.slice(0,second)
		             for (var i=0; i<first-second; i++) t += ' '
		             return(t)
		         },
		         x: function () {
		             return pad(arg.toString(16),  first)
		         },
		         X: function () {
		             return formats.x().toUpperCase()
		         },
		         '%': function () {
		             arg *= 100
		             return formats.f() + '%'
		         }
		     }
		     return formats[op]()
		    }
		     
		 var s = this
		 var values = Array.prototype.slice.call(arguments)
		 var substrings = []  // accumulate a list of strings between {...}
		 var formats = []     // and a list of formats when found between braces, e.g. {:2.3f}
		 var braces = /(\{[^\}]*\})/g
		 var start = 0
		 while (true) {
		     var m = braces.exec(s) // look for {...}
		     if (m === null) {
		         substrings.push(s.slice(start))
		         break
		     }
		     var format = s.slice(m.index+1,braces.lastIndex-1)
		     formats.push(format.replace(/\s*/g, ''))
		     substrings.push(s.slice(start,m.index))
		     start = braces.lastIndex
		 }
		
		 // Now assemble the substrings and formatted values
		 var t = ''
		 for (var i=0; i<substrings.length; i++) {
		     t += substrings[i]
		     if (i >= formats.length) break
		     var f = formats[i]
		     var findex = i // default position in argument list
			 var colon = f.search(':')
			 if (colon < 0) {
			 	if (f.length > 0 && f.slice(-1).match(/[a-z]/) !== null) // check for missing colon
			 		throw new Error('Format error: missing ":" in "{'+f+'}"')
			 	if (f.match(/\./) !== null)
			 		throw new Error('Format error: should not have "." in "{'+f+'}"')
			 	if (f.length > 0) findex = Number(f) // case of {3}
			 	t += values[findex].toString()
			 } else { // ":" indicates format such as {3:5.2f}
		        var op = f.slice(-1)
			 	if (op.match(/[a-z]/) === null)
			 		throw new Error('Format error: final character in "{'+f+'}" must be a letter.')
			 	if (colon > 0) findex = Number(f.slice(0,colon)) // extract index 3 from "3:5.2f"
			 	f = f.slice(colon+1)
		        var period = f.search(/\./)
		        var first, second // in ':5.2f", first is 5, second is 2, op is f
		        if (period >= 0) {
		            first = f.slice(0,period)
		            if (first == '') first = 0
		            else first = Number(first)
		            second = Number(f.slice(period+1,-1))
		            if (second === 0) second = -1 // represents that the 0 was explicit
		        } else {
		            first = (f.length >= 2) ? Number(f.slice(0,-1)) : 0
		            second = 0 // represents an implicit 0
		        }
		        t += format_item(values[findex], op, first, second)
		     }
		 }
		 return t
	}
    
    /*
    function markdown(s) { // use the marked library to process markdown
    	return micromarkdown.parse(s) // or return marked(s)
    }
    */

    function parse_html(args) {
    	var ctx, s, x0, y0, align, font, fontsize, angle, col
    	// 2d canvas context, string, pos.x, pos.y, left/right/center, font, font height, angle
        // Convert html code to a series of individual strings, each displayable by fillText().
    	if (args.ctx === undefined) throw new Error('parse_html requires a 2D canvas context.')
    	else ctx = args.ctx
    	if (args.text === undefined) throw new Error('parse_html requires a text to display.')
    	else s = args.text
    	x0 = (args.x === undefined) ? 0 : args.x
    	y0 = (args.y === undefined) ? 0 : args.y
    	align = (args.align === undefined) ? 'left' : args.align
    	font = (args.font === undefined) ? 'Arial' : args.font
    	fontsize = (args.fontsize === undefined) ? 14 : args.fontsize
    	if (font == 'Verdana') {
        	fontsize *= 13/15 // Had been using Verdana default, which is unusually large
    	}
    	angle = (args.angle === undefined) ? 0 : args.angle
    	col = (args.color === undefined) ? color.black : args.color
        font = 'px '+font
        var lines = []
        var line = [0]
        var part = '' // the text element preceding a '<'
        var cmd = ''
        var bold = false
        var italic = false
        var sup = false
        var sub = false
        var x = 0, y = 0
        var dx, start
        var legal = ['b', 'strong', 'i', 'em', 'sup', 'sub']
        
        function add_part() {
            var style = ''
            var fs = fontsize
            if (bold) style += 'bold '
            if (italic) style += 'italic '
            if (sup || sub) {
                fs = 0.8*fontsize
                if (sup) y -= 0.3*fontsize // y increases downward in 2D canvas
                else y += 0.3*fontsize
            }
            ctx.font = style+fs+font
            dx = ctx.measureText(part).width
            line.push([x, y, ctx.font, part])
            part = ''
            x += dx
        }
        
        function end_line() {
            if (part !== '') add_part()
            line[0] = x
            lines.push(line)
            line = [0]
            x = y = 0
        }
        
        for (var i=0; i<s.length; i++) {
            var c = s[i]
            if (c == '\n') {
                end_line()
            } else if (c != '<') {
                part += c // a part of the text
            } else { // encountered '<'
                //if (part !== '') add_part()
                if (s.slice(i+1).indexOf('>') < 0) { // '<' did not start a command
                    part += c
                    continue
                }
                start = i+1
                i++
                cmd = s[i]
                var end = false
                if (cmd == '/') {
                    cmd = ''
                    end = true
                }
                var ok = true
                for (i=i+1; i<s.length; i++) {
                    if (s[i] == '<') { // This means that the initial '<' did not start a command
                        i = i-1 // back up
                        part += c+cmd
                        add_part()
                        ok = false // signal that we encountered '<'
                        break
                    }
                    if (s[i] == '>') break
                    cmd += s[i]
                }
                if (!ok) continue
                if (cmd == 'br' || cmd == 'br/') {
                    end_line()
                } else {
                    if (legal.indexOf(cmd) >= 0 && part !== '') add_part()
                    switch (cmd) {
                        case 'b':
                        case 'strong':
                            bold = !end
                            break
                        case 'i':
                        case 'em':
                            italic = !end
                            break
                        case 'sup':
                            sup = !end
                            if (end) y = 0
                            break
                        case 'sub':
                            sub = !end
                            if (end) y = 0
                            break
                        default:
                            part += '<'+cmd+'>'
                    }
                }
            }
        }
        
        if (part.length > 0) line.push([x, y, fontsize+font, part])
        ctx.font = fontsize+font
        line[0] = x + ctx.measureText(part).width
        lines.push(line)
        
        var maxwidth = -1
        for (var L=0; L<lines.length; L++) {
            if (lines[L][0] > maxwidth) maxwidth = lines[L][0]
        }
        // This info will be returned to display_2D:
        return {ctx: ctx, x: x0, y: y0, align: align, lines: lines, maxwidth: maxwidth, font: font, fontsize: fontsize, angle: angle, color: col}
    }
        
    function display_2D(args) {
    	var ctx, x0, y0, align, lines, maxwidth, fontsize, col, angle
    	ctx = args.ctx
    	x0 = args.x
    	y0 = args.y
    	align = args.align
    	lines = args.lines
    	maxwidth = args.maxwidth
    	// font = args.font // not needed in display_2D; font is embedded in lines
    	fontsize = args.fontsize
    	angle = args.angle
        var width, L, x, y
        ctx.fillStyle = color.to_html(args.color)
        // Each line in lines starts with the total width of the line, followed by
        // elements of the form {x, y, font, text}, where x and y start at zero.
        for (L=0; L<lines.length; L++) {
            for (var p=0; p<lines[L].length; p++) {
                var k = lines[L][p]
                if (k[1] === undefined) {
                    width = k
                    continue
                }
                ctx.font = k[2]
                switch (align) {
                    case 'left':
                        x = k[0]
                        y = k[1]
                        break
                    case 'center':
                        x = k[0] - width/2
                        y = k[1]
                        break
                    case 'right':
                        x = k[0] - width
                        y = k[1]
                        break
                    default:
                        throw new Error(align+' is not a possible alignment option.')
                }
                ctx.translate(x0,y0)
                ctx.rotate(angle)
                ctx.fillText(k[3], x, y)
                ctx.setTransform(1, 0, 0, 1, 0, 0)
            }
            y0 += 1.3*fontsize
        }
    }

    function pytype(o) { // override RapydScript type() function to match what type() gives in VPython 7
        var name = o.constructor.name
        if (name == 'vec') return "<class 'cyvector.vector'>"
        if (name.slice(0,3) == 'vp_') {
            name = name.slice(3)
            return "<class 'vpython.vpython." + name + "'>"
        }
        if (name == 'canvas' || name == 'graph') return "<class 'vpython.vpython." + name + "'>"
        if (name == 'Function') return "<class 'builtin_function_or_method'>" 
        if (name == 'Number') {
            if (Math.floor(o) === o) return "<class 'int'>"
            return "<class 'float'>"
        }
        var t = toType(o)
        if (t == 'array') return "<class 'list'>"
        if (t == 'object') return "<class 'dict'>"
        if (t == 'boolean') return "<class 'bool'>"
        if (t == 'string') return "<class 'str'>"
        return "<class '"+t+"'>"
    }
      
    var exports = {
        // Top-level math functions
        sqrt: Math.sqrt,
        pi: Math.PI,
        abs: Math.abs,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
        atan2: Math.atan2,
        exp: Math.exp,
        log: Math.log,
        pow: Math.pow,
        ceil: Math.ceil,
        floor: Math.floor,
        sign: Math.sign,
        max: Math.max,
        min: Math.min,
        random: Math.random,
        round: Math.round,
        factorial: factorial,
        combin: combin,
        radians: function radians(deg) { return (deg * Math.PI / 180) },
        degrees: function degrees(rad) { return (rad * 180 / Math.PI) },

        sleep: sleep,
        waitforfonts: waitforfonts,
        fontloading: fontloading,
        update: update,
        print: print,
        __convert: convert,
        __parsearray: parsearray,
        GSprint: print, // avoid a conflict with RapydScript print function by inserting _$rapyd$_print = GSprint
        print_to_string: print_to_string,
        print_options: print_options,
        clock: clock,
        msclock: msclock,
        get_library: get_library,
        read_local_file: read_local_file,
        download: download,
        parse_html,
        display_2D,
        pytype
    }
    Export(exports)
})()