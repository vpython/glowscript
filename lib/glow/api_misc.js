;(function () {
    "use strict";
    // Miscellaneous API stuff that doesn't belong in any other module, and doesn't deserve its own

    // Extend jquery-ui with a menubar functionality ... currently only has non-collapsable vertical menu.
    // Might need to be placed in a controls.js eventually, but for now this will do.
    $.fn.extend({
      gsmenubar: function(cmd) {
          if (!this.is("ul")) {
              alert("MenuBar top level must be unordered list, i.e. <ul>.")
              return
          }
          this.addClass("gsmenubar");
          this.children("li").children("ul").each(function() { $(this).menu() })
      }
    });
    
    // Extend jquery with waitfor, useful for event handling with streamline.js
    $.fn.waitfor = function( eventTypes, callback ) {
        var self = this
        function cb(ev) {
            self.unbind( eventTypes, cb )
            callback(null, ev)
        }
        this.bind( eventTypes, cb )
    }
    
    $.fn.pause = function( prompt, callback ) {
        var self = this
        function cb(ev) {
            prompt.visible = false
            self.unbind( "click", cb )
            callback(null, ev)
        }
        this.bind( "click", cb )
    }

    function get_library(URL, cb) { // import a JavaScript library file, by URL
        var tries = 0
        if (cb === undefined)
            throw new Error("get_display(URL, wait) called without wait")
        var done = false
        var t1 = window.performance.now()

        $.getScript(URL)
          .done(function(script, textStatus) {
              done = true
          })

          .fail(function(jqxhr, settings, exception) {
              alert('Could not access the library\n  '+URL)
              cb()
              return
          })

        function require_wait() {
            if (done) {
              cb()
              return
            }
            var t2 = window.performance.now()
            if (t2-t1 > 6000) {
                var yes = confirm('Timed out trying to access the library\n  '+URL+'\nTry again?')
                if (yes) {
                    t1 = window.performance.now()
                } else {
                    cb()
                    return
                }
            }
            sleep(0.05, require_wait)
        }
        require_wait()
    }
    
    // From David Scherer:
    // The convention for callbacks in node.js, which is adopted by streamline, is that
    // an asynchronous function foo(param,callback) on success "returns" a result by 
    // calling callback(null, result) and on failure "throws" an error by calling callback(error).
    // When you pass wait as the callback to such a function,  streamline converts the first call
    // into a return value and the second call into an exception in the calling code.  When you 
    // implement an asynchronous function *using* streamline (declaring the function foo(param,wait) 
    // streamline also takes care of calling the callback when your function returns or throws.
    // If you write the function in plain javascript,  you need to follow the callback convention
    // (and shouldn't normally return or throw).

    // There are actually some examples in glowscript - look at event handling code.

    // http://bjouhier.wordpress.com/2011/04/04/currying-the-callback-or-the-essence-of-futures/
    
    function read_local_file(place, cb) {
        var info
        if (arguments.length === 0) {
            throw new Error("read_local_file(place, wait) called with no arguments")
        } else if (arguments.length == 1) {
            cb = place
            if (toType(cb) !== 'function')
              throw new Error("Should be 'read_local_file(wait)'")
            place = $('body')
        } else {
            if (arguments.length > 2 || toType(cb) !== 'function')
              throw new Error("Should be 'read_local_file(place, wait)'")
        }
        place.append('<input type="file" id="read_local_file"/>')
        var contents = null
        
        function readSingleFile(evt) {
            var f, reader;
            f = evt.target.files[0];
            if (f) {
                // Also available: f.name, f.size, f.type, and 
                // if f.lastModifiedDate, f.lastModifiedDate.toLocaleDateString()
        
                reader = new FileReader();
                reader.onload = function(e) {
                    contents = e.target.result
                    var moddate = (f.lastModifiedDate) ? f.lastModifiedDate.toLocaleDateString() : ''
                    info = {name:f.name, text:contents, size:f.size, type:f.type, date:moddate}
                    $('#read_local_file').remove()
                }
                return reader.readAsText(f)
            } else {
                alert("Failed to load file")
                return
            }
        }
        
        document.getElementById('read_local_file').addEventListener('change', readSingleFile, false);
        
        function read_file_wait() {
            if (contents !== null) {
                cb(null, info)
                return
            }
            sleep(0.05, read_file_wait)
        }
        read_file_wait()
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
    
    function update(cb) {
        // TODO: Be fast when called in a tight loop (only sleep every x ms)
        sleep(0,cb)
    }

    function sleep(dt, cb) { // sleep for dt seconds; minimum working sleep is about 5 ms with Chrome, 4 ms with Firefox
        dt = 1000*dt // convert to milliseconds
        function wrapCB() {
            cb() 
        } // In Firefox, setTimeout callback is invoked with a random integer argument, which streamline will interpret as an error!
        if (dt > 5) setTimeout(wrapCB, dt-5)
        else setTimeout(wrapCB, 0)
    }
/*
    var fps = 30 // desired renders per second
    var N = 0    // number of iterations to do between renders
    var enditers
    
    function rate(iters, cb) {
        if (cb === undefined)
            throw new Error("rate(iterations_per_second, wait) called without wait")
        if (N > 0) {
        	N--
        	if (window.performance.now() > enditers) N = 0 // truncate the iterations to permit renders to occur
        	if (N > 0) cb()
        } else {
        	if (iters <= 120) {
        		setTimeout(cb, Math.ceil(1000/iters))
        	} else {
        		N = Math.ceil(iters/fps)-1 // number of iterations to do between renders
        		enditers = window.performance.now() + Math.ceil(1000/fps)
        		setTimeout(cb, Math.ceil(1000/fps)) // trigger doing more iterations after next render
        		cb() // do one iteration to get the process started
        	}
        }
    }
*/    
    // Angus Croll: http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
    // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
    // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"

    var toType = function(obj) { 
        return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
    }
    
    function convert(arg) {
        if (arg instanceof vec) { arg = arg.toString()
        } else if (arg === null) { arg = "null"
        } else if (arg === undefined) { arg = "undefined"
        } else if (toType(arg) == "object") { arg = "<Object>"
        } else if (toType(arg) == "number") {
            arg = arg.toPrecision(6)
            if (arg.match(/e/)) {
                arg = arg.replace(/0*e/, 'e')
                arg = arg.replace(/\.e/, 'e')
            } else if (arg.match(/\./)) arg = arg.replace(/0*$/, '')
            arg = arg.replace(/\.$/,'')
        } else arg = arg.toString()
        return arg
    }
    
    var printarea = null // don't create a textarea until a print statement is executed
    var poptions = {width:640, height:100, readonly:true, pos:"bottom"}
    
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
    
    var print_container = $("<div/>")
    
    function print(args) { // similar to Python print()
        // print(x, y, z, {sep:' ', end:'\n'}) // specifying different sep and/or end is optional
        if (printarea === null) {
            var container = print_container
            //container.css({float:"left"})
            container.appendTo($('body'))
            window.__context.print_container = container
            printarea = $('<textarea id=print/>').appendTo(container)
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
        for (var i=0; i<L; i++) { // TODO: array handling needs to be recursive for [1, [2,3], 4]
            var arg = arguments[i]
            if (toType(arg) == "array") {
                var a = "["
                for (var i=0; i<arg.length; i++) {
                    a += convert(arg[i])
                    if (i < arg.length-1) a += ", "
                }
                a += "]"
                arg = a
            } else if (arg === null) {
            	arg = 'null'
            } else {
                arg = convert(arg)
            }
            if (s.length === 0) s += arg
            else s += sep+arg
        }
        s += end
        printarea.val(printarea.val()+s)
    }
    
    function print_options(args) {
        var contents = ''
        for (var a in args) {
            poptions[a] = args[a]
        }
        //if (args.clear !== undefined && printarea !== null) printarea.val('')   //Duplicate?
        if (printarea !== null) {
            if (args.clear !== undefined && args.clear) printarea.val('')
            modify_printarea()
            if (args.contents !== undefined && args.contents) contents = printarea.val()
            if (args.delete !== undefined && args.delete) {
                printarea.remove()
                printarea = null
            }
        }
        return contents
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
        max: Math.max,
        min: Math.min,
        random: Math.random,
        round: Math.round,
        radians: function radians(deg) { return (deg * Math.PI / 180) },
        degrees: function degrees(rad) { return (rad * 180 / Math.PI) },

        sleep: sleep,
        //rate: rate,
        update: update,
        print: print,
        print_options: print_options,
        print_container: print_container,
        get_library: get_library,
        read_local_file: read_local_file
    }
    Export(exports)
})()