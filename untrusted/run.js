// IDE functionality
var localport = '8080' // normally 8080
var website = 'glowscript' // normally glowscript
var runloc = (document.domain == "localhost") ? "http" : "https"
var weblocs = ["http://"+website+".org", "http://www."+website+".org",
               "https://"+website+".org", "https://www."+website+".org", 
               runloc+"://localhost:"+localport]

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
        "../lib/glow/shaders.gen.js",
        "../lib/compiling/transform.js" // Streamline transform.js needed for running programs embedded in other web sites
        //"../lib/compiling/transform-es6.min.js" // Streamline transform.js needed for running programs embedded in other web sites
        ],
    compile: [
        "../lib/compiling/GScompiler.js", 
        "../lib/compiling/acorn.es.js",
        "../lib/compiling/papercomp.js",
        
        // Streamline files used until Fall 2016:
        //"../lib/narcissus/lib/jsdefs.js",
        //"../lib/narcissus/lib/jslex.js",
        //"../lib/narcissus/lib/jsparse.js",
        //"../lib/narcissus/lib/jsdecomp.js",
        //"../lib/streamline/compiler/format.js",
        //"../lib/streamline/compiler/transform.js",
        
        //"../lib/compiling/transform.js", // needed only for exporting a program
        "../lib/coffee-script.js"
        ],
    RScompile: [
        "../lib/compiling/GScompiler.js",
        "../lib/rapydscript/compiler.js", // includes runtime library
        "../lib/compiling/acorn.es.js",
        "../lib/compiling/papercomp.js",
        
        // Streamline files used until Fall 2016:
        //"../lib/narcissus/lib/jsdefs.js",
        //"../lib/narcissus/lib/jslex.js",
        //"../lib/narcissus/lib/jsparse.js",
        //"../lib/narcissus/lib/jsdecomp.js",
        //"../lib/streamline/compiler/format.js",
        //"../lib/streamline/compiler/transform.js",
        
        //"../lib/compiling/transform.js", // needed only for exporting a program
        ],
    //RSrun: [ // needed only for an exported program (runtime functions are included in the rapydscript compiler)
    //    "../lib/rapydscript/runtime.js", // minified by using jscompress.com; Uglify failed for some reason
    //    ],
    ide: []
}

function ideRun() {
    "use strict";
    
    function eval_script(x) {
        return eval(x)
    }

    var trusted_origin = "*"
    //var also_trusted = undefined;
    if (document.domain === "localhost") {
        // We are being loaded from a development server; we don't know if the parent is also running on
        // a development server or is the actual web site
        //also_trusted = "https://localhost:"+localport
    	trusted_origin = "http://localhost:"+localport // this eliminates some irrelevant error messages when testing
    }

    function send(msg) {
        msg = JSON.stringify(msg)
        // trusted_origin is "*" the first time send is used; "https://www."+website+".org" thereafter
        // The first send operation is just to make the link with ide.js, which may be glowscript.org or www.glowscript.org
        window.parent.postMessage(msg, trusted_origin)
        //if (also_trusted) window.parent.postMessage(msg, also_trusted)
    }
    
    /*
    function msclock() {
    	if (performance.now) return performance.now()
    	else return new Date().getTime()
    }
    */

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
                var progver = message.version.substr(0,3)
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
            if (message.screenshot !== undefined)
                screenshot(false)
        }
    }    

    function compileAndRun(program, container, lang, version) {
        try {
            if (program.charAt(0) == '\n') program = program.substr(1) // There can be a spurious '\n' at the start of the program source
            var options = {lang: lang, version: version, run: true}
            var program = glowscript_compile(program, options)
            //var p = program.split('\n')
        	//for (var i=0; i<p.length; i++) console.log(i, p[i])
        	var usermain = eval_script(program)
            // At this point the user program has not been executed.
            // Rather, eval_script has prepared the user program to be run.
            window.userMain = usermain

            $("#loading").remove()
            window.__context = {
                glowscript_container: container
            }
            window.userMain(function (err) {
                if (err) {
                    window.lasterr = err
                    reportScriptError(program, err)
                }
            })
        } catch (err) {
            window.lasterr = err
            reportScriptError(program, err);
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

    function reportScriptError(program, err) { // This machinery only gives trace information on Chrome
        // The trace information provided by browsers other than Chrome does not include the line number
        // of the user's program, only the line numbers of the GlowScript libraries. For that reason
        // none of the following cross browser stack trace reporters are useful for GlowScript:
        // Single-page multibrowser stack trace: https://gist.github.com/samshull/1088402
        // stacktrase.js https://github.com/stacktracejs/stacktrace.js    https://www.stacktracejs.com/#!/docs/stacktrace-js
        // tracekit.js; https://github.com/csnover/TraceKit
        var feedback = err.toString()+'\n'
        var prog = program.split('\n')
        //for(var i=0; i<prog.length; i++) console.log(i, prog[i])
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
            try {
            	// Strange behavior: sometimes err.stack is an array of end-of-line-terminated strings,
            	// and at other times it is one long string; in the latter case we have to create rawStack
            	// as an array of strings.
                var rawStack
                if (typeof err.stack == 'string') rawStack = err.stack.split('\n')
                else rawStack = err.stack
                //for (var i=0; i<rawStack.length; i++) console.log(i, rawStack[i])

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
	                if (first) traceback.push('At or near line '+N+': '+window.__original.text[N-2])
	                else traceback.push('Called from line '+N+': '+window.__original.text[N-2])
	                first = false
                    traceback.push("")
                    if (caller == '__$main') break
                }
            } catch (ignore) {
            }
        } 
    for (var i= 0; i<traceback.length; i++) feedback += '\n'+traceback[i]
        send({ error: "" + err, 
               traceback: traceback.length ? feedback : ''})
    }

    waitScript()
}
