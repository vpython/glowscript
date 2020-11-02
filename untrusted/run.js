// IDE functionality
// This file has to handle ALL versions of GlowScript.
var localport = '8080' // normally 8080
var website = 'glowscript' // normally glowscript
var runloc = (document.domain == "localhost") ? "http" : "https"
var weblocs = ["https://"+website+".org", "https://www."+website+".org", runloc+"://localhost:"+localport]

window.glowscript_libraries = { // used for unpackaged (X.Ydev) version
    run: [
        "../lib/jquery/2.1/jquery.mousewheel.js",
        "../lib/flot/jquery.flot.js",
        "../lib/flot/jquery.flot.crosshair_GS.js",
        "../lib/plotly.js",
//        "../lib/micromarkdown.min.js", // markdown, not ready to use yet
        "../lib/opentype/poly2tri.js",
        "../lib/opentype/opentype.js",
        "../lib/glMatrix.js",
        "../lib/webgl-utils.js",
//        "../lib/glow/glow.css", // not ready to use yet
        "../lib/glow/property.js",
        "../lib/glow/vectors.js",
        "../lib/glow/mesh.js",
        "../lib/glow/canvas.js",
        "../lib/glow/orbital_camera.js",
        "../lib/glow/autoscale.js",
        "../lib/glow/api_misc.js",
        "../lib/glow/WebGLRenderer.js",
        "../lib/glow/graph.js",
        "../lib/glow/color.js",
        "../lib/glow/shapespaths.js",
        "../lib/glow/primitives.js",
        "../lib/glow/extrude.js",
        "../lib/glow/shaders.gen.js"
        ],
    compile: [
        "../lib/compiling/GScompiler.js", 
        "../lib/compiling/acorn.js",
        "../lib/compiling/papercomp.js"
        ],
    RScompile: [
        "../lib/compiling/GScompiler.js",
        "../lib/rapydscript/compiler.js", // includes runtime library
        "../lib/compiling/acorn.js",
        "../lib/compiling/papercomp.js"
        ],
    //RSrun: [ // needed only for an exported program (runtime functions are included in the rapydscript compiler)
    //    "../lib/rapydscript/runtime.js", // minified by using jscompress.com; Uglify failed for some reason
    //    ],
    ide: []
} 

var trusted_origin = "*"
    
function send(msg) {
    msg = JSON.stringify(msg)
    // trusted_origin is "*" the first time send is used; "https://www."+website+".org" thereafter
    // The first send operation is just to make the link with ide.js, which may be glowscript.org or www.glowscript.org
    window.parent.postMessage(msg, trusted_origin)
}

function reportScriptError(err) { // This machinery only gives trace information on Chrome
    // The trace information provided by browsers other than Chrome does not include the line number
    // of the user's program, only the line numbers of the GlowScript libraries. For that reason
    // none of the following cross browser stack trace reporters are useful for GlowScript:
    // Single-page multibrowser stack trace: https://gist.github.com/samshull/1088402
    // stacktrase.js https://github.com/stacktracejs/stacktrace.js    https://www.stacktracejs.com/#!/docs/stacktrace-js
    // tracekit.js; https://github.com/csnover/TraceKit
    var program = window.__program
    var feedback = err.toString()+'\n'
    var compile_error = (feedback.slice(0,7) === 'Error: ')
    var prog = program.split('\n')
    var unpack = /[ ]*at[ ]([^ ]*)[^>]*>:(\d*):(\d*)/
    var traceback = []
    if (err.cursor) {
        //console.log('err.cursor',err.cursor)
        // This is a syntax error from narcissus; extract the source
        var c = err.cursor
        while (c > 0 && err.source[c - 1] != '\n') c--;
        traceback.push(err.source.substr(c).split("\n")[0])
        //traceback.push(new Array((err.cursor - c) + 1).join(" ") + "^") // not working properly
    } else {
        // This is a runtime exception; extract the call stack if possible
        // Strange behavior: sometimes err.stack is an array of end-of-line-terminated strings,
        // and at other times it is one long string; in the latter case we have to create rawStack
        // as an array of strings. Also, sometimes must access err.stack and sometimes must access
        // err.__proto__.stack; Chrome seems to flip between these two schemes.
        var usestack = false
        try {
            var a = err.stack
            usestack = true
        } catch (ignore) {
        }
        try {
            var rawStack
            if (usestack) {
                rawStack = err.stack
                if (typeof err.stack == 'string') rawStack = rawStack.split('\n')
            } else {
                var rawStack = err.__proto__.stack
                if (typeof rawStack == 'string') rawStack = rawStack.split('\n')
                else rawStack = rawStack.toString()
            }

            // TODO: Selection and highlighting in the dialog
            var first = true
            var i, m, caller, jsline, jschar
            for (i=1; i<rawStack.length; i++) {
                m = rawStack[i].match(unpack)
                if (m === null) continue
                caller = m[1]
                jsline = m[2]
                jschar = m[3]
                if (caller.slice(0,3) == 'RS_') continue
                if (caller == 'compileAndRun') break
                if (caller == 'main') break

                var line = prog[jsline-1]
                if (window.__GSlang == 'javascript') { // Currently unable to embed line numbers in JavaScript programs
                    traceback.push(line)
                    traceback.push("")
                    break
                }
                var L = undefined
                var end = undefined
                for (var c=jschar; c>=0; c--) {  // look for preceding "linenumber";
                    if (line[c] == ';') {
                        if (c > 0 && line[c-1] == '"') {
                            var end = c-1 // rightmost digit in "23";
                            c--
                        }
                    } else if (line[c] == '"' && end !== undefined) {
                        L = line.slice(c+1,end)
                        break
                    } else if (c === 0) {
                        jsline--
                        line = prog[jsline-1]
                        c = line.length
                    }
                }
                if (L === undefined) continue
                var N = Number(L)
                if (isNaN(N)) break // Sometimes necessary.....
                if (first) traceback.push('At or near line '+N+': '+window.__original.text[N-1])
                else traceback.push('Called from line '+N+': '+window.__original.text[N-1])
                first = false
                traceback.push("")
                if (caller == '__$main') break
            }
        } catch (ignore) {
        }
    } 

    var out = ''
    if (compile_error) {
        for (var i= 0; i<traceback.length; i++) out += traceback[i] + '\n'
        send({ error: feedback, traceback: out })
    } else {
        for (var i= 0; i<traceback.length; i++) out += traceback[i] + '\n'
        send({ error: feedback, traceback: out})
    }

} // end of reportScriptError

function ideRun() {
    "use strict";
    
    function eval_script(x) {
        return eval(x)
    }

    if (document.domain === "localhost") {
        // We are being loaded from a development server; we don't know if the parent is also running on
        // a development server or is the actual web site
    	trusted_origin = "http://localhost:"+localport // this eliminates some irrelevant error messages when testing
    }

    function waitScript() {
        $(window).bind("message", receiveMessage)
        send({ready:true})
        function receiveMessage(event) {
            event = event.originalEvent // originalEvent is a jquery entity
            trusted_origin = event.origin
            if (weblocs.indexOf(trusted_origin) < 0) { // ensure that message is from glowscript
                return;
            }
            var message = JSON.parse(event.data)
            if (message.program !== undefined) {
                // Determine the set of libraries to load
                var progver = message.version.substr(0,3) // 'unp' if unpackaged
                var packages = []
                var choose = progver
                var ver = Number(progver)
                if (ver < 1.1) choose = "bef1.1"
                else if (ver <= 2.1) choose = progver // currently 1.1, 2.0, or 2.1
                else choose = 2.1 // 2.2, 2.3dev
                		
                packages.push("../css/redmond/" + choose + "/jquery-ui.custom.css",
                              "../lib/jquery/"  + choose + "/jquery.min.js",
                              "../lib/jquery/"  + choose + "/jquery-ui.custom.min.js")
                              
                // Look for mention of MathJax in program; don't import it if it's not used
                try {
	                if (message.program.indexOf('MathJax') >= 0)
	                	packages.push("https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js?config=TeX-MML-AM_CHTML")
                }
	            catch(err) {
	            	;
	            }
                
                if (ver >= 1.1 && ver < 2.1) packages.push("../lib/jquery/"  + choose + "/jquery.ui.touch-punch.min.js")
                if (message.unpackaged) {
                    packages.push.apply(packages, glowscript_libraries.run)
                    if (message.lang == 'rapydscript' || message.lang == 'vpython') {
                    	packages.push.apply(packages, glowscript_libraries.RScompile)
                    } else packages.push.apply(packages, glowscript_libraries.compile)
                } else {
                    packages.push("../package/glow." + message.version + ".min.js")
                    if (ver >= 1.1 && (message.lang == 'rapydscript' || message.lang == 'vpython')) {
                        packages.push("../package/RScompiler." + message.version + ".min.js")
                        // After version 2.2, the RS runtime library was included in the RS compiler:
                        if (ver < 2.3) packages.push("../package/RSrun." + message.version + ".min.js")
                    } else
                 	    packages.push("../package/compiler." + message.version + ".min.js")
                }
                
                head.load(packages, function() {
                    if (message.version === "0.3") window.glowscript = { version: "0.3" }
                    //if (glowscript.version !== message.version && !message.unpackaged) // can't work; at this point glowscript.version is undefined
                    //    alert("Library version mismatch: package is '" + message.version + "' but glowscript.version is '" + glowscript.version + "'")

                    var container = $("#glowscript")
                    if (message.version !== "0.3") container.removeAttr("id")
                    
                    compileAndRun(message.program, container, message.lang, progver)
                    if (message.autoscreenshot)
                        setTimeout(function () {
                            if (!window.lasterr)
                                screenshot(true)
                        }, 2000)
                });
            }
            if (message.event !== undefined) {
                message.event.fromParentFrame = true
                $(document).trigger(message.event)
            }
            if (message.screenshot !== undefined) {
                screenshot(false)
            }
        }
    }  

    var ver

    async function compileAndRun(program, container, lang, version) {
        if (program[0] == '\n') program = program.substr(1) // There can be a spurious '\n' at the start of the program source
        var options = {lang: lang, version: version, run: true}
        try { // compile the user program:
            program = glowscript_compile(program, options)
            //program = program.replace(/await/g, '')
            //program = program.replace(/async/g, '')
            //program = program.replace(/__module__ : {value: "__main__"}/g, '    ')
            if (lang == 'javascript' && (options.version >= 2.9 || options.version == 'unp') ) {
                program = program+'if (!__main__.__module__) Object.defineProperties(__main__, {\n__module__ : {value: null}\n});'
            }
        } catch(err) {
            send({ error: err.toString(), traceback: ''})
            return
        }
        $("#loading").remove() // remove the 'Loading program...' message, establish the window context
        window.__context = { glowscript_container: container }
        window.__program = program
        window.__reportScriptError = reportScriptError // This enables calling it from canvas.js on an error in a bound function

        // See https://itnext.io/error-handling-with-async-await-in-js-26c3f20bc06a for catching error in async function
        // Function() doc: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function

        if (options.version == 'unp') ver = 'unp' // version is first 3 characters of 'unpublished" (e.g. 3.0dev)
        else ver = parseFloat(options.version)

        try {
            window.userMain = eval(program)
            // At this point the user program has not been executed.
            // Rather, the user program has been prepared to be run.

            await window.userMain(function (err) {
                if (err) {
                    window.lasterr = err
                    reportScriptError(err)
                }
            })
        } catch (err) {
            window.lasterr = err
            reportScriptError(err)
        }
    }

    function screenshot(isAuto) {
    	var scene
        for (var c = 0; c < canvas.activated.length; c++) {
        	var ca = canvas.activated[c]
            if (ca !== null) {
                scene = ca
                break
            }
        }
        if (!scene) return
        if (ver >= 2.9 || ver == 'unp') screenshot_new(isAuto, scene) // GlowScript 2.9 or later
        else screenshot_old(isAuto, scene)
    }

    async function screenshot_new(isAuto, scene) { // GlowScript 2.9 and later
        var img = await scene.__renderer.screenshot()
        // Rescale the image to 128px max dimension and save it as a screenshot
        var targetSize = 128
        var aspect = img.width / img.height
        var w = aspect >= 1 ? targetSize : targetSize * aspect
        var h = aspect >= 1 ? targetSize / aspect : targetSize
        var cvs = document.createElement("canvas")
        cvs.width = w
        cvs.height = h
        var cx = cvs.getContext('2d')
        cx.drawImage(img, 0, 0, w, h)
        var thumbnail = cvs.toDataURL()
        send({ screenshot: thumbnail, autoscreenshot: isAuto })
    }

    function screenshot_old(isAuto, scene) { // GlowScript earlier than 2.9
        (scene.__renderer || scene.renderer).screenshot(function (err, img) {
            if (!err) {
                $(img).load(function () {
                    // Rescale the image to 128px max dimension and save it as a screenshot
                    var targetSize = 128
                    var aspect = img.width / img.height
                    var w = aspect >= 1 ? targetSize : targetSize * aspect
                    var h = aspect >= 1 ? targetSize / aspect : targetSize

                    var canvas = document.createElement("canvas")
                    canvas.width = w
                    canvas.height = h
                    var cx = canvas.getContext('2d')
                    cx.drawImage(img, 0, 0, w, h)
                    var thumbnail = canvas.toDataURL()
                    send({ screenshot: thumbnail, autoscreenshot: isAuto })
                })
            }
        })
    }

    waitScript()
}
