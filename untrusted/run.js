// IDE functionality

window.glowscript_libraries = { // used for unpackaged (X.Ydev) version
    run: [
        "../lib/jquery/1.1/jquery.mousewheel.js",
        "../lib/flot/jquery.flot.min.js",
        "../lib/flot/jquery.flot.crosshair_GS.js",
        "../lib/glMatrix.js",
        "../lib/webgl-utils.js",
//        "../lib/glow/glow.css", // not ready to use yet
        "../lib/glow/property.js",
        "../lib/glow/vectors.js",
        "../lib/glow/mesh.js",
        "../lib/glow/canvas.js",
        "../lib/glow/orbital_camera.js",
        "../lib/glow/autoscale.js",
        "../lib/glow/WebGLRenderer.js",
        "../lib/glow/graph.js",
        "../lib/glow/color.js",
        "../lib/glow/primitives.js",
        "../lib/glow/api_misc.js",
        "../lib/glow/shaders.gen.js"
        ],
    compile: [
        "../lib/narcissus/lib/jsdefs.js",
        "../lib/narcissus/lib/jslex.js",
        "../lib/narcissus/lib/jsparse.js",
        "../lib/narcissus/lib/jsdecomp.js",
        "../lib/streamline/compiler/format.js",
        "../lib/streamline/compiler/transform.js",
        "../lib/compiler.js",
        "../lib/coffee-script.js"],
    RSrun: [
        "../lib/rapydscript/stdlib.js"],
    RScompile: [
        "../lib/narcissus/lib/jsdefs.js",
        "../lib/narcissus/lib/jslex.js",
        "../lib/narcissus/lib/jsparse.js",
        "../lib/narcissus/lib/jsdecomp.js",
        "../lib/streamline/compiler/format.js",
        "../lib/streamline/compiler/transform.js",
        "../lib/compiler.js",
        "../lib/rapydscript/baselib.js",
        "../lib/rapydscript/utils.js",
        "../lib/rapydscript/ast.js",
        "../lib/rapydscript/output.js",
        "../lib/rapydscript/parse.js"
        ],
    ide: []
}

function ideRun() {
    "use strict";
    function eval_script(x) {
        return eval(x)
    }

    var trusted_origin = "http://www.glowscript.org"
    var also_trusted = undefined;
    if (document.domain === "localhost") {
        // We are being loaded from a development server; we don't know if the parent is also running on
        // a development server or is the actual web site
        //also_trusted = "http://localhost:8080"
    	trusted_origin = "http://localhost:8080" // this eliminates some irrelevant error messages when testing
    }

    function send(msg) {
        msg = JSON.stringify(msg)
        window.parent.postMessage(msg, trusted_origin)
        if (also_trusted) window.parent.postMessage(msg, also_trusted)
    }

    function waitScript() {
        $(window).bind("message", receiveMessage)
        send({ ready: 1 })
        function receiveMessage(event) {
            event = event.originalEvent
            if (event.origin !== trusted_origin && event.origin !== also_trusted) {
                return;
            }
            var message = JSON.parse(event.data)
            if (message.program !== undefined) {
                // Determine the set of libraries to load
                var progver = message.version.substr(0,3)
                var packages = []
                var choose = progver
                if (Number(progver)<1.1) {choose = "bef1.1"}
                else if (Number(progver)<=1.2) {choose = "1.1"}
                packages.push("../css/redmond/" + choose + "/jquery-ui.custom.css",
                              "../lib/jquery/"  + choose + "/jquery.min.js",
                              "../lib/jquery/"  + choose + "/jquery-ui.custom.min.js")
                if (choose == "1.1") packages.push("../lib/jquery/"  + choose + "/jquery.ui.touch-punch.min.js")
                if (message.unpackaged) {
                    packages.push.apply(packages, glowscript_libraries.run)
                    if (message.lang == 'rapydscript' || message.lang == 'vpython') {
                    	packages.push.apply(packages, glowscript_libraries.RSrun)
                    	packages.push.apply(packages, glowscript_libraries.RScompile)
                    } else packages.push.apply(packages, glowscript_libraries.compile)
                } else {
                    packages.push("../package/glow." + message.version + ".min.js")
                    if (choose == "1.1" && (message.lang == 'rapydscript' || message.lang == 'vpython')) {
                        packages.push("../package/RScompiler." + message.version + ".min.js")
                        packages.push("../package/RSrun." + message.version + ".min.js")
                    } else
                 	    packages.push("../package/compiler." + message.version + ".min.js")
                }
                
                head.load(packages, function() {
                    // All the libraries are ready; run the program
                    if (message.version === "0.3") window.glowscript = { version: "0.3" }
                    if (glowscript.version !== message.version && !message.unpackaged)
                        alert("Library version mismatch: package is '" + message.version + "' but glowscript.version is '" + glowscript.version + "'")

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
            var options = {lang: lang, version: version}
            //WHY? window.translations = options.translations = [program]
            options.translations = [program]
            var program = glowscript_compile(program, options)
            //var p = program.split('\n')
        	//for (var i=0; i<p.length; i++) console.log(i, p[i])
        	var main = eval_script(program)
            window.userMain = main

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
        var scene = window.scene
        if (!scene)
            for (var c = 0; c < canvas.all.length; c++) {
                if (canvas.all[c] && canvas.all[c].__activated) {
                    scene = canvas.all[c]
                    break;
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

    function reportScriptError(program, err) { // This machinery only works on Chrome
        // err.stack: https://code.google.com/p/v8-wiki/wiki/JavaScriptStackTraceApi
    	// TraceKit - Cross browser stack traces: https://github.com/occ/TraceKit
    	var referror = (err.__proto__.name === 'ReferenceError')
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
                // FIXME: This works only for the Chrome V8 JavaScript compiler
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
                	if (caller == 'new') {
                		m = rawStack[i].match(/[ ]*at[ ]new[ ]*([^ ]*)/)
                		caller = m[1]
                	}
                    if (caller == 'compileAndRun') break
                	if (!referror && 
                			(caller[0] == '_' || caller == 'main' || caller.slice(0,4) == 'http')) continue
                    var L = window.__linenumbers[jsline-1]
	                if (L === undefined) continue
	                var N = Number(L)+1
	                // Index original text with L-2; 1 for the header line (GlowScript X.Y) and 1 for counting from 0 in the text array:
	                if (first) traceback.push('Line '+N+': '+window.__original.text[L-2])
	                else traceback.push('Called from line '+N+': '+window.__original.text[L-2])
	                first = false
                    traceback.push("")
	                if (referror) break
                }
            } catch (ignore) {
            }
        } 
        send({ error: "" + err, 
               traceback: traceback.length ? traceback.join("\n") : null})
    }

    waitScript()
}