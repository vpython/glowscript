;(function () {
    "use strict";
    
    // mode values:
    var RENDER = 0, PICK = 1, EXTENT = 2, RENDER_TEXTURE = 3
    // minor mode values for depth peeling:
    var PEEL_C0 = 4  // color map for opaque objects
    var PEEL_D0 = 5  // create depth buffer D0 for opaque objects
    var PEEL_C1 = 6  // 1st transparency color map
    var PEEL_D1 = 7  // create depth buffer D1 for 1st transparent peel based on D0
    var PEEL_C2 = 8  // 2nd transparency color map
    var PEEL_D2 = 9  // create depth buffer D2 for 2nd transparent peel based on D0 and D1 
    var PEEL_C3 = 10 // 3rd transparency color map
    var PEEL_D3 = 11 // create depth buffer D3 for 3rd transparent peel based on D0 and D2
    var PEEL_C4 = 12 // 4th transparency color maps
    var MERGE   = 13 // merge C0, C1, C2, C3, C4 onto a quad

    var fps = 0                // measured average frames per second
    var renderMS = 0           // measured average milliseconds per render
    var lastStartRedraw = 0    // time in milliseconds of most recent start of render
    var lastEndRedraw = 0      // time in milliseconds of most recent end of render

    function WebGLRenderer(cvs, canvasElement, overlay) {
    	
        var renderer = this
        // var gl = WebGLUtils.setupWebGL(canvasElement) // main canvas
		var gl = canvasElement.getContext("webgl2");
        if (!gl) throw new Error("Can't create canvas: WebGL not supported")
        var points_pixel_first = true // set to false after world-to-pixel conversion established
        
        // The hidden canvas for pick evaluation must have antialias turned off.
        // Otherwise on a seam between two objects the pixel may be averaged between the two object values.
        // TODO: maybe pick label objects?
        
        cvs.overlay_context = overlay.getContext("2d") // for label and pause displays
        
        // Place these statements here rather than inside the render function,
        // to avoid repeated garbage collection. However, seemed to make little difference.
        var MAX_LIGHTS = 32
        var light_pos = new Float32Array( MAX_LIGHTS*4 )
        var light_color = new Float32Array( MAX_LIGHTS*3 )
		var light_ambient = new Float32Array( 3 )
		var canvas_size = new Float32Array( 2 )
		var save = new Array(4)
		var pixels = new Uint8Array(4)
        
        // A non-power-of-two texture has restrictions; see
        //    http://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences
        // So we render to a power-of-two texture, and in the shaders in
        // RENDER_TEXTURE mode we display a quad with the texture to fit the cvs.
        // Important note: This destroys antialiasing, so render to texture is
        // fully useful only for doing some computations, unless we do our own antialiasing.
        // We could render to a large offscreen texture, say twice the width and height.
        
        // Texture usage: TEXTURE0/TECTURE1 are user textures/bumpmaps to apply to an object
        //  TEXTURE2/TEXTURE3 are the color and depth maps for the opaque objects
        //  TEXTURE4/TEXTURE5/TEXTURE6 are depth maps for depth-peeling
        //  TEXTURE7/TEXTURE8/TEXTURE9/TEXTURE10 are the color maps for depth-peeled transparency renders
    
	    // It seems to be the case that shader compilation times are long in the presence of ifs.
	    // For that reason the various rendering situations are split into separate shaders.
        // Shaders are compiled as needed. For example, if there are no transparent objects,
        // the depth peeling shaders are not compiled.
	    var standard_program = null, curve_program = null, triangle_program = null // mode == RENDER || minormode == PEEL_C0
	    var ring_program = null
	    
	    var peel_depth_programD0 = null // PEEL_D0
	    var peel_color_programC1 = null // PEEL_C1
	    var peel_depth_programD1 = null // PEEL_D1
	    var peel_color_programC2 = null // PEEL_C2
	    var peel_depth_programD2 = null // PEEL_D2
	    var peel_color_programC3 = null // PEEL_C3
	    var peel_depth_programD3 = null // PEEL_D3
	    var peel_color_programC4 = null // PEEL_C4

	    var ring_peel_depth_programD0 = null // PEEL_D0
	    var ring_peel_color_programC1 = null // PEEL_C1
	    var ring_peel_depth_programD1 = null // PEEL_D1
	    var ring_peel_color_programC2 = null // PEEL_C2
	    var ring_peel_depth_programD2 = null // PEEL_D2
	    var ring_peel_color_programC3 = null // PEEL_C3
	    var ring_peel_depth_programD3 = null // PEEL_D3
	    var ring_peel_color_programC4 = null // PEEL_C4

	    var tri_peel_depth_programD0 = null // PEEL_D0
	    var tri_peel_color_programC1 = null // PEEL_C1
	    var tri_peel_depth_programD1 = null // PEEL_D1
	    var tri_peel_color_programC2 = null // PEEL_C2
	    var tri_peel_depth_programD2 = null // PEEL_D2
	    var tri_peel_color_programC3 = null // PEEL_C3
	    var tri_peel_depth_programD3 = null // PEEL_D3
	    var tri_peel_color_programC4 = null // PEEL_C4
	    
	    var curve_peel_depth_programD0 = null // PEEL_D0; curves currently cannot be transparent
	    
	    var pick_program = null, curve_pick_program = null, tri_pick_program = null, ring_pick_program = null // mode == PICK
	    var extent_program = null, curve_extent_program = null // mode == EXTENT, which doesn't work yet
	    var merge_program = null // mode == RENDER_TEXTURE
	    var merge_program2 = null // mode == RENDER_TEXTURE for mobile devices with few texture units
        
        /*
        alert(fullpeels+', '+gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)+', '+
        	gl.getParameter(gl.MAX_TEXTURE_SIZE)+', '+
        	gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)+', '+
        	gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)+', '+
        	gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)+', '+
        	gl.getParameter(gl.MAX_VERTEX_ATTRIBS)+', '+
        	gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)+', '+
        	gl.getParameter(gl.MAX_VARYING_VECTORS)+', '+
        	gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS))
        */
        
        // In shaders, gl_MaxDrawBuffers (minimum 1), the size of the gl_FragData array.
        // Four different Windows machines with GT 240, 8500 GT, and GTX 590 all have
        // MAX_TEXTURE_SIZE, MAX_COMBINED_TEXTURE_IMAGE_UNITS, MAX_VERTEX_ATTRIBS, MAX_VERTEX_UNIFORM_VECTORS.
        // MAX_VERTEX_TEXTURE_IMAGE_UNITS, MAX_VARYING_VECTORS, MAX_FRAGMENT_UNIFORM_VECTORS:
        //	  8192, 8192, 20, 16, 254, 4, 10, 221
        // Dual-boot Windows/Ubuntu machine with GeForce 8500 GT claims on Ubuntu to have
        //    8192, 8192, 96, 16, 1024, 32, 15, 512
        //    This is strange, because running Windows on this dual-boot machine I get the numbers shown above.
        //    It is quite possible the wrong driver is present on Ubuntu and is reporting wrong data.
        // MacBook Pro with GeForce 8600M GT has 
        //    8192, 8192, 16, 16, 1024, 16, 15, 1024
        
        // "shaders" is an object exported by shaders.gen.js (when running a new version)
        // or by glow.X.Y.min.js for an official version. The Python program build.py,
        // or its reduced version build_only_shaders.py, creates shaders.gen.js.
        function shaderProgram(fragSrc, vertSrc, gls) {
            function makeShader(text, type, glx) {
                var shader = glx.createShader(type)
                glx.shaderSource(shader, text)
                glx.compileShader(shader)
                if (!glx.getShaderParameter(shader, glx.COMPILE_STATUS)) {
                    alert( glx.getShaderInfoLog(shader) )
                    throw new Error("Shader compile error")
                }
                return shader
            }
            var vertexShader = makeShader(vertSrc, gls.VERTEX_SHADER, gls)
            var fragmentShader = makeShader(fragSrc, gls.FRAGMENT_SHADER, gls)
            var P = gls.createProgram()
            gls.attachShader(P, vertexShader)
            gls.attachShader(P, fragmentShader)
            gls.linkProgram(P)
            if (!gls.getProgramParameter(P, gls.LINK_STATUS)) {
                alert(gls.getProgramInfoLog(P))
                throw new Error("Shader link error")
            }
            var uniforms = gls.getProgramParameter(P, gls.ACTIVE_UNIFORMS)
            P.uniforms = {}
            for (var i = 0; i < uniforms; i++) {
                var t = gls.getActiveUniform(P, i)
                var name = t.name
                if (name.substring(name.length-3)=="[0]") name = name.substring(0, name.length-3)
                P.uniforms[name] = gls.getUniformLocation(P, name)
            }
            var attributes = gls.getProgramParameter(P, gls.ACTIVE_ATTRIBUTES)
            P.attributes = {}
            for (var i = 0; i < attributes; i++) {
                var t = gls.getActiveAttrib(P, i)
                P.attributes[t.name] = gls.getAttribLocation(P, t.name)
            }
            return P
        }
    	  
        var Model = function(mesh, dynamism) {
        	if (dynamism) this.dynamism = gl.DYNAMIC_DRAW
        	else this.dynamism = gl.STATIC_DRAW // cannot change the built-in models
        	this.elementType = gl.TRIANGLES
        	//this.elementType = gl.LINE_LOOP   // wireframe for debugging
			this.mesh = mesh
        	this.model_transparent = mesh.model_transparent
            this.pos = new Float32Array(mesh.pos)
            this.normal = new Float32Array(mesh.normal)
        	this.color = new Float32Array(mesh.color)
        	this.opacity = new Float32Array(mesh.opacity)
        	this.shininess = new Float32Array(mesh.shininess)
        	this.emissive = new Float32Array(mesh.emissive)
        	this.texpos = new Float32Array(mesh.texpos)
        	this.bumpaxis = new Float32Array(mesh.bumpaxis)
            this.index = new Uint32Array(mesh.index)

            this.posBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, this.pos, this.dynamism)

            this.normalBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, this.normal, this.dynamism)
            
            this.colorBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, this.color, this.dynamism)
			
            this.opacityBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.opacityBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, this.opacity, this.dynamism)
			
            this.shininessBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.shininessBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, this.shininess, this.dynamism)
			
            this.emissiveBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.emissiveBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, this.emissive, this.dynamism)
            
            this.texposBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texposBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, this.texpos, this.dynamism)

            this.bumpaxisBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bumpaxisBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, this.bumpaxis, this.dynamism)
			
            this.indexBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.index, this.dynamism)
        }
        
        var mbox = new Model( Mesh.makeCube(), false )
        var mcylinder = new Model( Mesh.makeCylinder(.5), false )
        var msphere = new Model( Mesh.makeSphere(0.5,30,false), false )
    	var msimple_sphere = new Model( Mesh.makeSphere(0.5,8,false), false) // a low-vertex-count sphere, used among other things for the points object
        var mpyramid = new Model( Mesh.makePyramid(), false )
        var mcone = new Model( Mesh.makeCone(0.5), false )
        var mring = new Model( Mesh.makeRing(0.5-0.05, 0.05), false )
        
        var object_models = { // models that are the same for VPython/RapydScript/JavaScript
            triangle: new Model( cvs.__vertices, true),			 	 // triangles and quads
            quad: new Model( Mesh.makeQuad(), false ),		 			 // used just to merge; the user quad object generates triangles
       		curve: new Model( Mesh.makeCurveSegment(1), false ),         // default curve_segment size is (1,1,1)
        }
        
        // Only create the models that will be used, because the renderer loops over models
		object_models.box = mbox
		object_models.pyramid = mpyramid
		object_models.cylinder = mcylinder
		object_models.cone = mcone
		object_models.sphere = msphere
		object_models.simple_sphere = msimple_sphere
		object_models.ellipsoid = msphere
		object_models.ring = mring
        
        var models = this.models = {}
        for(var id in object_models) models[id] = object_models[id]
        
        this.add_model = function(mesh, dynamism) {
    	   var i = mesh.__mesh_id
    	   models[i] = object_models[i] = new Model(mesh, dynamism)
    	   models[i].id_object = {}
        }
        
        this.remove_model = function(mesh, dynamism) {
    	   var i = mesh.__mesh_id
    	   delete models[i]
    	   delete object_models[i]
		}
        
        this.screenshot = async function screenshot() {
			cvs.__waitfor_image = true
			await cvs.waitfor("draw_complete")
			return cvs.__image
		}

        this.reset = function () {
            for (var t in object_models)
                object_models[t].id_object = {}
        }

        var camera = { target: vec3.create([0,0,0]), up: vec3.create([0,1,0]), fovy: 60, angleX: 0, angleY: 0, distance: 1 }
        
        this.reset()
        
        function isPowerOfTwo(x) {
            return (x & (x - 1)) === 0
        }
         
        function nextHighestPowerOfTwo(x) {
            --x;
            for (var i = 1; i < 32; i <<= 1) {
                x = x | x >> i
            }
            return x + 1
        }
        
        function handleLoadedTexture(image, obj, bump) {
            var name, t0, ref
        	if (bump) {
        		name = obj.__tex.bumpmap
        		ref = obj.__tex.bumpmap_ref
        		t0 = obj.__tex.bumpmap_t0
        	} else {
        		name = obj.__tex.file
        		ref = obj.__tex.texture_ref
        		t0 = obj.__tex.texture_t0
        	}
			var tf = msclock()
			tf = tf-t0
			if (name in cvs.textures) {
            	ref.reference = cvs.textures[name]
            } else {
            	cvs.textures[name] = ref.reference = gl.createTexture()
	            gl.bindTexture(gl.TEXTURE_2D, ref.reference)
	            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
			    if (!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height)) {
			        // Scale up the texture width and height to the next higher power of 2.
			        var c = document.createElement("canvas")
			        c.width = nextHighestPowerOfTwo(image.width)
			        c.height = nextHighestPowerOfTwo(image.height)
			        var ctx = c.getContext("2d")
			        ctx.drawImage(image, 0, 0, c.width, c.height)
			        image = c;
			    }
	            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
	    		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
	    		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST)
	            gl.generateMipmap(gl.TEXTURE_2D)
	            gl.bindTexture(gl.TEXTURE_2D, null)
            }
        	if (name in cvs.textures_requested) {
        		var done = cvs.textures_requested[name]
        		while (done.length > 0) {
        			var data = done.pop()
        			if (data[1]) {
        				data[0].__tex.bumpmap_ref.reference = ref.reference
        			} else {
        				data[0].__tex.texture_ref.reference = ref.reference
        			}
        			data[0].__change()
        		}
        	}
        }
        
        this.initTexture = function (name, obj, bump) { // bump is true if it's a bump map
		    if (bump) obj.__tex.bumpmap = name
        	else obj.__tex.file = name
        	if (name in cvs.textures) {
	        	if (bump) obj.__tex.bumpmap_ref.reference = cvs.textures[name]
	        	else obj.__tex.texture_ref.reference = cvs.textures[name]
	        	return
	        }
        	if (name in cvs.textures_requested) {
        		cvs.textures_requested[name].push([obj,bump])
        		return
        	} else cvs.textures_requested[name] = [[obj,bump]]
        	var t0 = msclock()
        	if (bump) obj.__tex.bumpmap_t0 = t0
        	else obj.__tex.texture_t0 = t0
        	// http://hacks.mozilla.org/2011/11/using-cors-to-load-webgl-textures-from-cross-domain-images/
        	var image = new Image()
			image.crossOrigin = "anonymous"
            image.src = name
            image.onload = function() { handleLoadedTexture(image, obj, bump) }
        }

        var update_vertices = 0 // signal to render_triangles to update vertex information
        cvs.__last_width = -1
        cvs.__last_height = -1
        cvs.__last_axis = cvs.__axis
		cvs.__last_up = cvs.__up
		cvs.__waitfor_image = false
        
        // Might render to extra-large texture to reduce aliasing:
        var ktexture = 1
        
        var peels = {C0:null, D0:null, C1:null, D1:null, C2:null, D2:null, C3:null, D3:null, C4:null, EXTENT_TEXTURE:null}
        var fullpeels = (gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) >= 16) // iPad Mini 2 has only 8
        
        var textureN = {C0:gl.TEXTURE2, D0:gl.TEXTURE3, C1:gl.TEXTURE4, D1:gl.TEXTURE5, 
        		        C2:gl.TEXTURE6, D2:gl.TEXTURE7, C3:gl.TEXTURE8, D3:gl.TEXTURE9, C4:gl.TEXTURE10,
        				EXTENT_TEXTURE:gl.TEXTURE11}
        
        function makeTexture(T) {
	        gl.activeTexture(textureN[T])
    		gl.bindTexture(gl.TEXTURE_2D, peels[T])
	        
	        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
	        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	        // EXTENT_TEXTURE not working yet
	        if (false && T == 'EXTENT_TEXTURE') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 3, 3, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
	        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ktexture*cvs.__width, ktexture*cvs.__height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
	        gl.bindTexture(gl.TEXTURE_2D, null)
	    }
        
        for (var T in peels) {
        	peels[T] = gl.createTexture()
        	makeTexture(T) 
        }
        
        var peelFramebuffer = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, peelFramebuffer)
        
        var peelRenderbuffer = gl.createRenderbuffer() // create depth buffer
        gl.bindRenderbuffer(gl.RENDERBUFFER, peelRenderbuffer)
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, ktexture*cvs.__width, ktexture*cvs.__height) // <<<<<<
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, peelRenderbuffer)
        
        gl.bindRenderbuffer(gl.RENDERBUFFER, null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        
        // TEXTURE0 and TEXTURE1 are used for object textures and bumpmaps
    	// This code deals with April 2016 Chrome error messages "there is no texture bound to the unit 0" (and unit 1)
    	// The Chrome change required making these initial TEXTURE0 and TEXTURE1 textures in the GlowScript environment.
    	// Wierdly, it's essential to make the TEXTURE1 texture before making the TEXTURE0 texture!
		var data = new Uint8Array( 3 )
		
		var tex1 = gl.createTexture()
		gl.activeTexture(gl.TEXTURE1)
		gl.bindTexture( gl.TEXTURE_2D, tex1 )
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, data )
        
		var tex0 = gl.createTexture()
		gl.activeTexture(gl.TEXTURE0)
		gl.bindTexture( gl.TEXTURE_2D, tex0 )
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, data )
        
//--------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------
            
        // mode: RENDER = 0, PICK = 1, EXTENT = 2, RENDER_TEXTURE = 3
        this.render = function(mode) {
        	
            if (mode == RENDER) {            	
	    		if (cvs.waitfor_textures) {
		            var check_objects = cvs.objects
	        		for (var o in check_objects) {
	        			var obj = check_objects[o]
	        			if (obj.__tex === undefined) continue
	        			if (!obj.ready) return
	        		}
	        		cvs.waitfor_textures = false
	        		cvs.trigger("textures", null)
	        	}
            }
            
            if (!cvs.visible) {
            	if (mode == RENDER) return
            	return null
            }
            
            if (cvs.__width != cvs.__last_width || cvs.__height != cvs.__last_height) {
                for (var T in peels) {
                	makeTexture(T) 
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, peelFramebuffer)
				gl.bindRenderbuffer(gl.RENDERBUFFER, peelRenderbuffer)
				gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, ktexture*cvs.__width, ktexture*cvs.__height)
				gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, peelRenderbuffer)
				gl.bindRenderbuffer(gl.RENDERBUFFER, null)
				gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            }
            
            //if (cvs.autocenter) Autoscale.compute_autocenter(canvas) // scene.autocenter has been abolished
            
            // autoscale of 10x10x10 cubes takes about 10 ms.
            // Since minimum readPixels is about 7 ms, if autoscaling is done
            // by the GPUs we should not read back the computed camera distance
            // unless the program requests that value, as we do with pick.
            // The computed camera distance should just stay in GPU memory.
            
            // An attempt to do the autoscale computation in the GPUs (mode = EXTENT)
            // took about 60 ms for 10x10x10 cubes, and didn't work. However, if it
            // could be made to work fully, without having to use readPixels to
            // get the camera distance to the CPU, it might be advantageous; hard to say.
            // The attempted EXTENT algorithm was to render off-screen (using the PICK
            // mechanism) with POINTS instead of __triangles and with the depth criterion
            // set to GREATER instead of LEQUAL, with the depth set to the extent of
            // a point. Setting gl_Position to a single location failed, as did setting
            // it to a position based on false-color ID: readPixels always gets zero.
            // Code is left in place for a possible later try.
            
			if (mode == RENDER) {
				for (let a of cvs.arrows) { // attach_arrow
					let pos
					if (!a.__run) continue
					if (a.__object !== undefined) {
						if (a.__object.pos !== undefined) pos = a.__object.pos
						else continue // trailed object no longer exists
					}
					a.pos = pos
					if (a.__object[a.__attr] !== undefined) {
						let axis = a.__object[a.__attr]
						if (axis.mag > 0)  {
							if (!a.visible) a.visible = true
							a.axis = axis.multiply(a.scale)
						} else a.visible = false
					}
					/*
					// TODO: The following needs revision after further discussion of the API:
					if (typeof a.attr !== "function") { // a string representing an attribute
						a.axis = a.__obj[a.__attr].multiply(a.__scale)
					} else { // a function to be called
						a.axis = a.__attr().multiply(a.__scale)
					}
					*/
				}

                for (var i in cvs.trails) { // attach_trail
                    var pos
                    var a = cvs.trails[i]
                    if (!a.__run) continue
                    var obj = a.__obj
                    if (obj === undefined) continue
                    if (typeof obj === 'string') { // Jupyter VPython evaluates a local function and sends to front end as a value
                    	pos = a[obj]
                    	if (pos === undefined) continue
                    } else if (typeof obj !== "function") {
                        if (obj !== undefined && obj.visible) {
                            if (!obj._pos_set) continue // pos has not yet been set explicitly
                        	if (obj.__interval > 0) continue // if interval is set, obj.__update_trail adds the points
                            if (obj.__pos !== undefined) pos = obj.__pos
                            else continue // trailed object no longer exists
                        } else continue
                    } else pos = obj()
                    if (a.__last_pos !== null && pos.equals(a.__last_pos)) continue
                    if (a.pps > 0) {
                        var tnow = msclock()
                        if (a.__last_time === null) a.last_time = tnow
                        if (tnow-a.__last_time > 1000/a.pps) a.__last_time = tnow
                        else if (tnow != a.__last_time) continue
                    }
                    a.__trail.push({pos:pos, color:a.color, radius:a.radius, retain:a.retain})
                    a.__last_pos = vec(pos) // save a copy of pos
                }

				for (let a of cvs.attached_lights) { // attach_light
					a.pos = a.__obj.light_in_world(a.offset)
				}
                
                if (cvs.update_billboards || !cvs.__axis.equals(cvs.__last_axis) || !cvs.__up.equals(cvs.__last_up)) {
                	cvs.update_billboards = false // set true when a new billboarded 3D text object is created
                	for (var i=0; i<cvs.billboards.length; i++) { // billboarded 3D text
                		var T = cvs.billboards[i]
                		if (T.billboard) {
	                    	var x = cross(cvs.__axis, cvs.__up)
	                    	var y = cross(x, cvs.__axis)
	                    	T.axis = norm(x).multiply(mag(T.axis))
	                    	T.up = y
                		}
                	}
            	}
            }

            var changed = {}
            for (var i=0; i<2; i++) { // Call updates on all objects
                // Do this twice, to catch cases of objects created by objects in the first loop,
                // such as for example a helix that creates a curve, or a text object that creates/modifies a compound.
            	// There is special handling of arrow with its components (box and pyramid).
            	var arrow_updates = []
            	for (var id in cvs.__changed) {
	            	var c = cvs.__changed[id]
	            	if (c.__obj) { // indicates that this is a component of arrow
	            		if (!c.__obj.visible) continue // nothing to do here if the arrow is not visible
	            		if (arrow_updates.indexOf(c.__obj) < 0) { // update arrow just once (which updates box and pyramid)
	            			c.__obj.__update()
	            			arrow_updates.push(c.__obj)
	            		}
	            		changed[c.__id] = c
            			delete cvs.__changed[c.__id]
            			if (!c.__obj.visible) delete c.__model.id_object[c.__id]
	            	} else {
	            		c.__update()
	            		if (c.constructor != text) changed[id] = c // no need to autoscale the text object
		            	delete cvs.__changed[id]
	            	}
	            }
            }
            cvs.__changed = changed // actual changed objects needed by Autoscale.comput_autoscale
            
            if (cvs.autoscale) Autoscale.compute_autoscale(cvs)
            
            cvs.__changed = {} // make sure this is empty
            
            if (cvs.camera.follower !== null) {
            	// Setting cvs.center will adjust cvs.mouse.pos if necessary
                cvs.center = (typeof cvs.camera.follower !== "function") ? cvs.camera.follower.pos :
                    cvs.camera.follower()
            }
        
            camera.target = vec3.create([cvs.__center.x, cvs.__center.y, cvs.__center.z])
            camera.up = vec3.create([cvs.__up.x, cvs.__up.y, cvs.__up.z])
            camera.fovy = cvs.__fov*180/Math.PI
            var xz_unit_vector = vec(cvs.__axis.x,0,cvs.__axis.z).norm()
            camera.angleX = Math.atan2(xz_unit_vector.x,-xz_unit_vector.z)
            camera.angleY = Math.PI/2 - Math.acos(-cvs.__axis.norm().y)
            if (canvasElement.clientWidth >= canvasElement.clientHeight) camera.distance = cvs.__range/Math.tan(cvs.__fov/2)
            else camera.distance = cvs.__range*(canvasElement.clientHeight / canvasElement.clientWidth)/Math.tan(cvs.__fov/2)
            
            camera.pos = mat4.multiplyVec3(
                mat4.rotateX(mat4.rotateY(mat4.identity(mat4.create()), -camera.angleX), -camera.angleY),
                vec3.create([0,0,camera.distance]))
            camera.pos = vec3.create([cvs.__center.x+camera.pos[0],
                                      cvs.__center.y+camera.pos[1],
                                      cvs.__center.z+camera.pos[2]])
            
            // For picking, we only need to render the pixel under the mouse, but scissoring makes no difference in pick time (why?).
            // With or without scissoring, pick in 1000-rotating-boxes takes about 12 ms in 100x100 canvas, about 20 ms in 1000x1000 cvs.
            // Compare with normal render of about 8 ms in 100x100 canvas, about 10 ms in 1000x1000 cvs.
            /*
            if (mode == PICK) {
                gl.scissor(cvs.mouse.__pickx, cvs.mouse.__picky, 1, 1)
                gl.enable(gl.SCISSOR_TEST)
            } else gl.disable(gl.SCISSOR_TEST)
            */

	        // Compute a view and projection matrix from camera, z range, and the canvas aspect ratio
	        camera.zNear = camera.distance / 100
	        camera.zFar = camera.distance * 10
	        var projMatrix = mat4.perspective( camera.fovy, canvasElement.clientWidth / canvasElement.clientHeight, camera.zNear, camera.zFar)
	        var viewMatrix = mat4.lookAt(camera.pos, camera.target, camera.up)
	        //mat4.multiply(projMatrix, viewMatrix, viewMatrix)
	
            // Transform lights into eye space
	        for (var i=0; i<light_color.length; i++) light_color[i] = 0 // initialize lights to black
            var light_count = cvs.lights.length
            for(var i=0; i<light_count; i++) {
                var light = cvs.lights[i]
                if (!light.visible) continue
                if (light.direction === undefined) // means this is a local light
                    var lightVec4 = [ light.pos.x, light.pos.y, light.pos.z, 1 ]
                else
                    var lightVec4 = [ light.direction.x, light.direction.y, light.direction.z, 0 ]
                mat4.multiplyVec4(viewMatrix, lightVec4)
                for(var c=0; c<4; c++)
                    light_pos[i*4+c] = lightVec4[c]
                light_color[i*3] = light.color.x
                light_color[i*3+1] = light.color.y
                light_color[i*3+2] = light.color.z
            }
            
            light_ambient[0] = cvs.ambient.x
            light_ambient[1] = cvs.ambient.y
            light_ambient[2] = cvs.ambient.z
            
            // Make simple_spheres used in points object have constant size in z=0 plane, independent of zoom, if points.__pixels is true
            var ptsobj = cvs.__points_objects // list of points objects that have points.__pixels == true
            if (ptsobj.length > 0) {
	        	var scale = 2*cvs.__range/cvs.__width
	            for (var i=0; i<ptsobj.length; i++) {
	            	var p = ptsobj[i]
	            	if (p === undefined) continue
	            	//p.__last_range = cvs.__range
	            	var D0 = (p.__radius === 0) ? 20*scale : 2*scale*p.radius
	    	        for (var s=0; s<p.__points.length; s++) {
	    	        	var q = p.__points[s]
	    	        	var D = (q.__points_radius === 0) ? D0 : 2*scale*q.__points_radius
	    	        	q.__size.x = q.__size.y = q.__size.z = D
	    	        	q.__data[12] = q.__data[13] = q.__data[14] = D // update size
	    	        	if (!q.__own_color) {
	    	        		q.__color = p.__color
	    	        		q.__data[16] = q.__color.x // update color
	    	        		q.__data[17] = q.__color.y
	    	        		q.__data[18] = q.__color.z
	    	        	}
	    	        }
	            }
            }
            
            if (mode == RENDER) { // for PICK and EXTENT, ignore labels and other objects on overlay for now
                if (cvs.__overlay_objects.objects.length > 0 && (cvs.__overlay_objects.__changed ||
                        !(cvs.__axis.equals(cvs.__last_axis) &&
                          cvs.__center.equals(cvs.__last_center) &&
                          cvs.__up.equals(cvs.__last_up) &&
                          cvs.__width == cvs.__last_width &&
                          cvs.__height == cvs.__last_height &&
                          cvs.__range == cvs.__last_range))) {
                    cvs.__overlay_objects.__changed = false
                    var ctx = cvs.overlay_context
                    ctx.clearRect(0, 0, cvs.__width, cvs.__height)
                    for (var i=0; i<cvs.__overlay_objects.objects.length; i++) {
						var obj = cvs.__overlay_objects.objects[i]
                        if (!obj.visible) continue
                        obj.__update(ctx, camera)
                    }
                }
            }
            
            // Update Float arrays containing vertex data, to be sent to the GPU
            var lengths = {pos:3, normal:3, color:3, opacity:1, shininess:1, emissive:1, texpos:2, bumpaxis:3}
            var c = cvs.__vertices
            //var vertex_changed = new Uint8Array(cvs.vertex_id+1) // initialized to zeros
            //var start = cvs.vertex_id, end = 0
            for (var id in cvs.__vertex_changed) {
            	var vert = cvs.__vertex_changed[id]
            	var Nvert = vert.__id
            	update_vertices++
            	//if (Nvert < start) start = Nvert
            	//if (Nvert > end) end = Nvert
            	//vertex_changed[Nvert] = 1
    			
    			for (var t in lengths) {
    				var g = vert['__'+t]
    				if (lengths[t] == 1) {
    					c[t][Nvert]   = g
    				} else if (lengths[t] == 2) {
    					c[t][2*Nvert]   = g.x
    					c[t][2*Nvert+1] = g.y
    				} else {
    					c[t][3*Nvert]   = g.x
    					c[t][3*Nvert+1] = g.y
    					c[t][3*Nvert+2] = g.z
    				}
    			}
            }
            cvs.__vertex_changed = {}
            
            // It is considerably slower to update even contiguous vertices with gl.bufferSubData
            // than simply to update the entire data on every render using gl.bufferData, so at
            // least for now we'll abandon using gl.bufferSubData and rather use gl.bufferData.
            // gl.bufferSubData was slower whether one updated contiguous runs of changed vertices
            // or updated from the first changed vertex to the last (the version shown here).
            // Perhaps one could get some benefit if update_vertices is a relatively small
            // fraction of the total number of vertices, given by cvs.vertex_id. My tests
            // were in a situation where nearly half the vertices were changing.
            /*
            if (update_vertices) {
	            var start = null, end
	            for (var i=0; i<cvs.vertex_id+1; i++) {
	            	if (vertex_changed[i]) {
	            		if (start === null) start = i
	            		else end = i
	            	}
	            }
    			// modified vertices run from start to end inclusive
    			gl.bindBuffer(gl.ARRAY_BUFFER, models.triangle.paramsBuffer)
				gl.bufferSubData(gl.ARRAY_BUFFER, 4*2*start, c.params.subarray(2*start, 2*(end+1)))
				for (var t in lengths) {
					gl.bindBuffer(gl.ARRAY_BUFFER, models.triangle[t+"Buffer"])
	                gl.bufferSubData(gl.ARRAY_BUFFER, 4*start*lengths[t], c[t].subarray(start*lengths[t], (end+1)*lengths[t]))
				}
    			update_vertices = 0
        	}
        	*/
            
            /*
            // Another attempt at using gl.bufferSubData, which doesn't help
            if (update_vertices) {
    			// modified vertices run from start to end inclusive
    			gl.bindBuffer(gl.ARRAY_BUFFER, models.triangle.paramsBuffer)
				gl.bufferSubData(gl.ARRAY_BUFFER, 4*2*start, c.params.subarray(2*start, 2*(end+1)))
				for (var t in lengths) {
					gl.bindBuffer(gl.ARRAY_BUFFER, models.triangle[t+"Buffer"])
	                gl.bufferSubData(gl.ARRAY_BUFFER, 4*start*lengths[t], c[t].subarray(start*lengths[t], (end+1)*lengths[t]))
				}
    			update_vertices = 0
            }
            */
            
            for (var m in object_models) {
            	cvs.__opaque_objects[m] = {}
            	cvs.__transparent_objects[m] = {}
            }
            
            var need_RENDER_TEXTURE = false
            for (var m in object_models) {
                if (m == 'triangle' || m == 'quad' || m == 'point') continue
            	var model = object_models[m]
                var objs = model.id_object
                for (var id in objs) {
					var obj = objs[id]
					if (m == 'curve') {
						cvs.__opaque_objects[m][id] = obj
						continue
					}
                    if (mode == RENDER && (obj.__data[19] < 1.0 || model.model_transparent)) {
                    	cvs.__transparent_objects[m][id] = obj
                    	need_RENDER_TEXTURE = true
					} else {
						cvs.__opaque_objects[m][id] = obj
					}
                }
            }
            
            /*
            // The following code was an attempt to categorize non-triangles/quads into
            // opaque and transparent categories. It needs more work because it needs to
            // be consistent with the visible attribute. Currently this code will retain
            // in cvs.__opaque or cvs.__transparent an object that has been made
            // invisible.
            function categorize(obj) {
	    		var m = obj.constructor.name
	        	var model = object_models[m]
	        	var transparent = (obj.__opacity < 1)
	        	if (obj.__prev_opacity === null) { // this object has not been previously categorized
	        		obj.__prev_opacity = obj.__opacity
	        		if (transparent) {
	        			if (cvs.__transparent_objects[m] === undefined) {
	        				cvs.__transparent_objects[m] = {}
	        			}
	        			cvs.__transparent_objects[m][id] = obj
	        		} else {
	        			if (cvs.__opaque_objects[m] === undefined) {
	        				cvs.__opaque_objects[m] = {}
	        			}
	        			cvs.__opaque_objects[m][id] = obj
	        		}
	        	} else if ( !obj.__opacity_change ) {
	        		return
	        	} else {
	            	// The opaque/transparent category has changed since the last render.
	                // Remove id from previous category, add to other category.
	                obj.__prev_opacity = obj.__opacity
	                if (transparent) {
	                	delete cvs.__opaque_objects[m][id]
	                	cvs.__transparent_objects[m][id] = obj
	                } else {
	                	delete cvs.__transparent_objects[m][id]
	                	cvs.__opaque_objects[m][id] = obj
	                }
	        	}
            }
            
            // Categorize non-triangle/quad objects as opaque or transparent:
            for (var id in cvs.__changed) {
            	var obj = cvs.__changed[id]
            	obj.__update()
            	if (obj instanceof triangle || obj instanceof quad) continue
                if (obj.__components) {
                	for (var i = 0; i < obj.__components.length; i++) 
                		categorize(obj.__components[i], obj.__components[i].__id)
                } else {
                	categorize(obj, id)
                }
            	obj.__opacity_change = false
            }
            
            // Determine whether there are any transparent elements in the scene:
            var need_RENDER_TEXTURE = false
            var c = cvs.__transparent_objects
            if (c !== undefined) {
	            for (var m in c) {
	            	if (object_models[m].model_transparent) {
	        			need_RENDER_TEXTURE = true
	        			break
	            	}
	            	if (c[m] !== undefined) {
	            		for (var id in c[m]) {
	            			need_RENDER_TEXTURE = true
	            			break
	            		}
	            	}
	            }
            }
            if (!need_RENDER_TEXTURE) {
                var c = cvs.__opaque_objects
                if (c !== undefined) {
	                for (var m in c) {
	                	if (object_models[m].model_transparent) {
	            			need_RENDER_TEXTURE = true
	            			break
	                	}
	                }
                }
            }
            */
            
            // We should incrementally categorize triangles into opaque/transparent, plain/texture/bumpmap/texture and bumpmap
            // In a dynamic rug with 1000 vertices, about half of them changing, 20 ms of the 30 ms render time is spent
            // doing this categorization, running through all triangles/quads at the start of each render. But after making some
            // preliminary stabs at this (in the case of the non-triangle/quad objects) I'm setting this issue aside for now.
            // Both the other objects as well as triangle/quads should be categorized incrementally,
            // which requires some significant reworking.
            var sort = cvs.__sort_objects
            for (var op in sort) { // reset the sorting of triangle objects; op is opaque, transparent
            	for (var a in sort[op]) // a is plain, textures, bumpmaps, textures_and_bumpmaps
            		sort[op][a] = {}
            }
            
            var Nvert
            var vnames = ['v0', 'v1', 'v2', 'v3']
        	
        	function add_indices(A, T, obj) {
            	if (obj.__owner !== undefined && !obj.__owner.__vis) return
        		var c = A[T]
        		if (c === undefined) c = A[T] = [obj] // representative object is given as first element of list
        		if (Nvert == 3) c.push(obj.v0.__id, obj.v1.__id, obj.v2.__id)
        		else c.push(obj.v0.__id, obj.v1.__id, obj.v2.__id, obj.v0.__id, obj.v2.__id, obj.v3.__id)
        		
            	/*
            	var s = ''
            	var t = cvs.__sort_objects.opaque.plain.all
            	for (var n=1; n<c.length; n++) {
            		var j = c[n]
            		s += j+': '
            		s += '  '+t.pos[3*j]+', '+t.pos[3*j+1]+', '+t.pos[3*j+2]+'\n'
            		s += '     '+t.normal[3*j]+', '+t.normal[3*j+1]+', '+t.normal[3*j+2]+'\n'
            	}
            	cvs.caption.text(s)
            	*/
        	}
            
            var pickdata = {pos:[], color:[], index:[]}

        	// Set up triangles (or triangles from quads)
        	var triangles_exist = false, model
        	for (var m=0; m<2; m++) {
            	if (m === 0) {
            		Nvert = 3
            		model = object_models['triangle']
            	} else {
            		Nvert = 4
            		model = object_models['quad']
            	}
	            var objs = model.id_object
	            for (var id in objs) {
	            	triangles_exist = true
	            	var obj = objs[id] 
	            	if (mode == PICK) {
	            		var color = obj.__falsecolor
	            		var p
        				for (var i=0; i<3; i++) {
        					p = obj[vnames[i]].pos
        					pickdata.pos.push(p.x, p.y, p.z)
	        				pickdata.color.push(color[0], color[1], color[2], color[3])
	        				pickdata.index.push(pickdata.index.length)
        				}
	        			if (Nvert == 4) { // convert quad into two triangles
	        				var indices = [0,2,3]
	        				for (var ind=0; ind<3; ind++) {
	        					var i = indices[ind]
	        					p = obj[vnames[i]].pos
	        					pickdata.pos.push(p.x, p.y, p.z)
		        				pickdata.color.push(color[0], color[1], color[2], color[3])
		        				pickdata.index.push(pickdata.index.length)
	        				}
	        			}
	            	} else if (mode == RENDER) {
		            	var opaque = true
		            	for (var i=0; i<Nvert; i++) {
			            	if (obj[vnames[i]].opacity < 1) {
			            		opaque = false
			            		break
			            	}
			            }
		        		var t = obj.__tex.file
		        		var b = obj.__tex.bumpmap
		            	if (opaque) {
		            		if (t !== null) {
		            			add_indices(sort.opaque.textures, t, obj)
		            			if (b != null) {
		            				add_indices(sort.opaque.textures_and_bumpmaps, b, obj)
		            			}
		            		} else if (b != null) {
		            			add_indices(sort.opaque.bumpmaps, b, obj)
		            		} else add_indices(sort.opaque.plain, 'all', obj)
		            	} else {
		            		need_RENDER_TEXTURE = true
		            		if (t !== null) {
		            			add_indices(sort.transparent.textures, t, obj)
		            			if (b != null) {
		            				add_indices(sort.transparent.textures_and_bumpmaps, b, obj)
		            			}
		            		} else if (b != null) {
		            			add_indices(sort.transparent.bumpmaps, b, obj)
		            		} else add_indices(sort.transparent.plain, 'all', obj)
		            	}
	            	}
	            }
            }
            if (need_RENDER_TEXTURE) mode = RENDER_TEXTURE
            
            var program
            
            canvas_size[0] = ktexture*cvs.__width
            canvas_size[1] = ktexture*cvs.__height
            
            function useProgram(prog, minormode) {
                // This needs to happen once per program, before rendering objects with that program
                program = prog
                gl.useProgram(prog)
                gl.enableVertexAttribArray(prog.attributes.pos)
                if (mode == MERGE || minormode > PEEL_D0)
                	gl.uniform2fv(prog.uniforms.canvas_size, canvas_size)
                
                if (minormode != MERGE) {
	                
	                if (mode == RENDER || minormode == PEEL_C0 || minormode == PEEL_C1 ||
	                		              minormode == PEEL_C2 || minormode == PEEL_C3 || 
	                		              minormode == PEEL_C4) {
		                gl.uniform1i(prog.uniforms.light_count, light_count)
		                gl.uniform4fv(prog.uniforms.light_pos, light_pos)
		                gl.uniform3fv(prog.uniforms.light_color, light_color)
		                gl.uniform3fv(prog.uniforms.light_ambient, light_ambient)
	                	gl.enableVertexAttribArray(prog.attributes.normal)
		                if (prog != curve_program) {
			                gl.enableVertexAttribArray(prog.attributes.color) 
			                gl.enableVertexAttribArray(prog.attributes.opacity) 
			                gl.enableVertexAttribArray(prog.attributes.shininess) 
			                gl.enableVertexAttribArray(prog.attributes.emissive)
			                gl.enableVertexAttribArray(prog.attributes.texpos)
			                gl.enableVertexAttribArray(prog.attributes.bumpaxis)
			                gl.uniform1i(prog.uniforms.texmap, 0)  // TEXTURE0 - user texture
			                gl.uniform1i(prog.uniforms.bumpmap, 1) // TEXTURE1 - user bumpmap
		                }
	                }
	                
	                gl.uniformMatrix4fv(prog.uniforms.viewMatrix, false, viewMatrix)
	                gl.uniformMatrix4fv(prog.uniforms.projMatrix, false, projMatrix)
	                //if (mode == EXTENT) gl.uniform3fv(prog.uniforms.center, camera.target) // doesn't work yet
		                
                } 
                if (minormode == MERGE) {
                	gl.uniform1i(prog.uniforms.C0, 2) // TEXTURE2   - opaque color map
                    gl.uniform1i(prog.uniforms.C1, 4) // TEXTURE4   - color map for transparency render 1
                    if (fullpeels) { // plenty of texture units available
                        gl.uniform1i(prog.uniforms.C2, 6) // TEXTURE6   - color map for transparency render 2
	                    gl.uniform1i(prog.uniforms.C3, 8) // TEXTURE8   - color map for transparency render 3
	                	gl.uniform1i(prog.uniforms.C4,10) // TEXTURE10  - color map for transparency render 4
                    }
                } else if (minormode > PEEL_D0) {
	                gl.uniform1i(prog.uniforms.D0, 3)     // TEXTURE3 - opaque depth map
	                if (minormode == PEEL_C2 || minormode == PEEL_D2)
	                	gl.uniform1i(prog.uniforms.D1, 5) // TEXTURE5 - 1st depth map
	                else if (minormode == PEEL_C3 || minormode == PEEL_D3)
	                	gl.uniform1i(prog.uniforms.D2, 7) // TEXTURE7 - 2nd depth map
	                else if (minormode == PEEL_C4)
	                	gl.uniform1i(prog.uniforms.D3, 9) // TEXTURE9 - 3rd depth map
                }
                
            }
            
            //console.log(light_count, light_pos, light_color, program.uniforms.light_count, program.uniforms.light_pos, program.uniforms.light_color, program.uniforms.light_ambient)
            
            // If culling is enabled, triangles are one-sided, and when you go inside a box you don't see the inner walls.
            //gl.enable(gl.CULL_FACE)

        	function subrender(minormode, T, Trefs) {
                if (mode == RENDER_TEXTURE && Trefs.length > 0) {
            		for (var i=0; i<Trefs.length; i++) {
	            		var a = Trefs[i]
	            		if (a == T) continue
	            		gl.activeTexture( textureN[a] )
	            		gl.bindTexture(gl.TEXTURE_2D, peels[a])
	            	}
	            }
            	
            	if (T === null) {
	            	gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            	} else {
            		gl.bindFramebuffer(gl.FRAMEBUFFER, peelFramebuffer)
            		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, peels[T], 0)
            	}
	            
	            gl.viewport(0, 0, canvas_size[0], canvas_size[1])
	            gl.enable(gl.DEPTH_TEST)
	            if (mode == PICK || minormode > PEEL_C0) gl.clearColor(0, 0, 0, 0)
	            else if (mode == EXTENT) gl.clearColor(0, 0, 0, 1)
	            else gl.clearColor(cvs.__background.x, cvs.__background.y, cvs.__background.z, cvs.__opacity)
	            if (mode == EXTENT) {
	            	gl.depthFunc(gl.GREATER)
	                gl.clearDepth(0) // set to 0 if using gl.GREATER
	            } else {
	            	gl.depthFunc(gl.LEQUAL)
	            	gl.clearDepth(1) // set to 1 if using gl.LEQUAL
	            }
	            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
	
	            function render_curves() {
		            var model = object_models.curve
		            var objs = model.id_object
		            var elements = model.elementType
	                var model_length = model.index.length
		            var setup = true
		            for(var id in objs) {
		            	if (!objs[id].visible) break // if the entire curve is invisible
		                
		            	if (minormode > PEEL_D0) break  // currently curves are opaque, with no texture
						if (setup) {
				            // Render all curve segments, using a special program
				            // Needs more work to build C0 and D0 textures to include the opaque curves.
				            if (minormode == RENDER || minormode == PEEL_C0) {
				            	if (curve_program == null) curve_program = shaderProgram( shaders.opaque_render_fragment, shaders.curve_render_vertex, gl )
				            	useProgram(curve_program, minormode)
				            } else if (minormode == PEEL_D0) {
				            	if (curve_peel_depth_programD0 == null) curve_peel_depth_programD0 = shaderProgram( shaders.peel_depth_fragmentD0, shaders.curve_peel_depth_vertex, gl )
				            	useProgram(curve_peel_depth_programD0, minormode)
			            	} else if (minormode == PICK) {
				            	if (curve_pick_program == null) curve_pick_program = shaderProgram( shaders.pick_fragment, shaders.curve_pick_vertex, gl )
				            	useProgram(curve_pick_program, minormode)
				            } //else if (mode == EXTENT) useProgram(curve_extent_program, 0, 0)
				            
				            gl.bindBuffer(gl.ARRAY_BUFFER, model.posBuffer)
							gl.vertexAttribPointer(program.attributes.pos, 4, gl.FLOAT, false, 0, 0)
							if (minormode != PICK && minormode < PEEL_D0) {
								gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer)
								gl.vertexAttribPointer(program.attributes.normal, 3, gl.FLOAT, false, 0, 0)
							}
							gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer)
							if (mode == EXTENT) elements = gl.POINTS // no need to process interiors of triangles
							setup = false
						}

						var obj = objs[id]
						var p = obj.__points
						var length = p.length
						var save_radius = obj.__data[15]
						if (save_radius === 0) { // overall radius
							 obj.__data[15] = 4*cvs.__range/cvs.__width
						}
						gl.uniform4fv(program.uniforms.objectData, obj.__data) // overall curve data
						for (var t=1; t<length; t++) {
							var pnt = p[t]	
			                if (!pnt.visible) continue					
			                var data = pnt.__prevsegment
			                if (mode == PICK) {
			                    var falsecolor = pnt.__falsecolor
			                    for (var i=0; i<4; i++) {
			                        save[i] = data[8+i]
			                        save[i+4] = data[12+i]
			                        data[12+i] = data[8+i] = falsecolor[i]
			                    }
			                }
			                gl.uniform4fv(program.uniforms.segmentData, data) // point data for this curve
			                gl.drawElements(elements, model_length, gl.UNSIGNED_INT, 0)
			                if (mode == PICK) {
			                    for (var i=0; i<8; i++) data[8+i] = save[i]
			                }
			                
						}
						obj.__data[15] = save_radius
		            }
	            }
	            
	            function render_triangles() {
	            	var model = object_models.triangle
	            	var elements = model.elementType
	                var model_arrays = cvs.__vertices
	                if (mode == PICK) {
		            	if (tri_pick_program == null) tri_pick_program = shaderProgram( shaders.pick_fragment, shaders.tri_pick_vertex, gl )
		            	useProgram(tri_pick_program, minormode)
                		model_arrays = {}
	                	model_arrays.pos = new Float32Array(pickdata.pos)
                		model_arrays.color = new Float32Array(pickdata.color)
                		model_index = new Uint32Array(pickdata.index)
                		model_length = model_index.length
                		
			            gl.bindBuffer(gl.ARRAY_BUFFER, model.posBuffer)
		                gl.bufferData(gl.ARRAY_BUFFER, model_arrays.pos, gl.DYNAMIC_DRAW)
						gl.vertexAttribPointer(program.attributes.pos, 3, gl.FLOAT, false, 0, 0)
						
						gl.bindBuffer(gl.ARRAY_BUFFER, model.colorBuffer)
		                gl.bufferData(gl.ARRAY_BUFFER, model_arrays.color, gl.DYNAMIC_DRAW)
						gl.vertexAttribPointer(program.attributes.color, 3, gl.FLOAT, false, 0, 0)
						
						gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer)
		                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model_index, gl.DYNAMIC_DRAW)
						gl.vertexAttribPointer(program.attributes.color, 4, gl.FLOAT, false, 0, 0)
						
	                	gl.drawElements(elements, model_length, gl.UNSIGNED_INT, 0)
	                	
	                	// Restore standard pos and color data:
	                	gl.bindBuffer(gl.ARRAY_BUFFER, model.posBuffer)
		                gl.bufferData(gl.ARRAY_BUFFER, cvs.__vertices.pos, gl.DYNAMIC_DRAW)
		                
						gl.bindBuffer(gl.ARRAY_BUFFER, model.colorBuffer)
		                gl.bufferData(gl.ARRAY_BUFFER, cvs.__vertices.color, gl.DYNAMIC_DRAW)
						return
					}
					
	                var sort = cvs.__sort_objects
	                
	                for (var op in sort) { // opaque and transparent
	                  if (minormode > PEEL_D0) {
	                	  if (op == 'opaque') continue
	                  } else {
	                	  if (op == 'transparent') continue
	                  }
	                  var first = true
		              for (var sort_type in sort[op]) { // plain, textures, bumpmaps, textures_and_bumpmaps
		                for (var sort_list in sort[op][sort_type]) { // lists of index values
			            	if (first) {
			            		first = false
			            		
			                    switch(minormode) {
									case RENDER:
									case PEEL_C0:
						            	if (triangle_program === null) triangle_program = shaderProgram( shaders.opaque_render_fragment, shaders.tri_render_vertex, gl )
						            	useProgram(triangle_program, minormode)
										break
									case EXTENT: // The EXTENT machinery doesn't actually work
					            		if (extent_program === null) extent_program = shaderProgram( shaders.pick_fragment, shaders.extent_vertex, gl )
				            			useProgram(extent_program, minormode)
				            			break
									case PEEL_D0:
						            	if (tri_peel_depth_programD0 === null) tri_peel_depth_programD0 = shaderProgram( shaders.peel_depth_fragmentD0, shaders.tri_peel_depth_vertex, gl )
						            	useProgram(tri_peel_depth_programD0, minormode)
						            	break
									case PEEL_D1:
						            	if (tri_peel_depth_programD1 === null) tri_peel_depth_programD1 = shaderProgram( shaders.peel_depth_fragmentD1, shaders.tri_peel_depth_vertex, gl )
						            	useProgram(tri_peel_depth_programD1, minormode)
						            	break
									case PEEL_D2:
						            	if (tri_peel_depth_programD2 === null) tri_peel_depth_programD2 = shaderProgram( shaders.peel_depth_fragmentD2, shaders.tri_peel_depth_vertex, gl )
						            	useProgram(tri_peel_depth_programD2, minormode)
						            	break
									case PEEL_D3:
						            	if (tri_peel_depth_programD3 === null) tri_peel_depth_programD3 = shaderProgram( shaders.peel_depth_fragmentD3, shaders.tri_peel_depth_vertex, gl )
						            	useProgram(tri_peel_depth_programD3, minormode)
						            	break
									case PEEL_C1:
						            	if (tri_peel_color_programC1 === null) tri_peel_color_programC1 = shaderProgram( shaders.peel_color_fragmentC1, shaders.tri_render_vertex, gl )
						            	useProgram(tri_peel_color_programC1, minormode)
						            	break
									case PEEL_C2:
						            	if (tri_peel_color_programC2 === null) tri_peel_color_programC2 = shaderProgram( shaders.peel_color_fragmentC2, shaders.tri_render_vertex, gl )
						            	useProgram(tri_peel_color_programC2, minormode)
						            	break
									case PEEL_C3:
						            	if (tri_peel_color_programC3 === null) tri_peel_color_programC3 = shaderProgram( shaders.peel_color_fragmentC3, shaders.tri_render_vertex, gl )
						            	useProgram(tri_peel_color_programC3, minormode)
						            	break
									case PEEL_C4:
						            	if (tri_peel_color_programC4 === null) tri_peel_color_programC4 = shaderProgram( shaders.peel_color_fragmentC4, shaders.tri_render_vertex, gl )
						            	useProgram(tri_peel_color_programC4, minormode)
						            	break
								}
					            

								gl.bindBuffer(gl.ARRAY_BUFFER, model.posBuffer)
				                if (update_vertices) gl.bufferData(gl.ARRAY_BUFFER, model_arrays.pos, gl.DYNAMIC_DRAW)
								gl.vertexAttribPointer(program.attributes.pos, 3, gl.FLOAT, false, 0, 0)
								
								if (mode == RENDER || minormode == PEEL_C0 || minormode == PEEL_C1 ||
	                		              minormode == PEEL_C2 || minormode == PEEL_C3 || 
	                		              minormode == PEEL_C4) {
									
				                
									gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer)
					                if (update_vertices) gl.bufferData(gl.ARRAY_BUFFER, model_arrays.normal, gl.DYNAMIC_DRAW)
									gl.vertexAttribPointer(program.attributes.normal, 3, gl.FLOAT, false, 0, 0)
									
									gl.bindBuffer(gl.ARRAY_BUFFER, model.colorBuffer)
					                if (update_vertices) gl.bufferData(gl.ARRAY_BUFFER, model_arrays.color, gl.DYNAMIC_DRAW)
									gl.vertexAttribPointer(program.attributes.color, 3, gl.FLOAT, false, 0, 0)
						            
									gl.bindBuffer(gl.ARRAY_BUFFER, model.opacityBuffer)
					                if (update_vertices) gl.bufferData(gl.ARRAY_BUFFER, model_arrays.opacity, gl.DYNAMIC_DRAW)
									gl.vertexAttribPointer(program.attributes.opacity, 1, gl.FLOAT, false, 0, 0)
									
									gl.bindBuffer(gl.ARRAY_BUFFER, model.shininessBuffer)
					                if (update_vertices) gl.bufferData(gl.ARRAY_BUFFER, model_arrays.shininess, gl.DYNAMIC_DRAW)
									gl.vertexAttribPointer(program.attributes.shininess, 1, gl.FLOAT, false, 0, 0)
									
									gl.bindBuffer(gl.ARRAY_BUFFER, model.emissiveBuffer)
					                if (update_vertices) gl.bufferData(gl.ARRAY_BUFFER, model_arrays.emissive, gl.DYNAMIC_DRAW)
									gl.vertexAttribPointer(program.attributes.emissive, 1, gl.FLOAT, false, 0, 0)
									
									gl.bindBuffer(gl.ARRAY_BUFFER, model.texposBuffer)
					                if (update_vertices) gl.bufferData(gl.ARRAY_BUFFER, model_arrays.texpos, gl.DYNAMIC_DRAW)
									gl.vertexAttribPointer(program.attributes.texpos, 2, gl.FLOAT, false, 0, 0)
									
									gl.bindBuffer(gl.ARRAY_BUFFER, model.bumpaxisBuffer)
					                if (update_vertices) gl.bufferData(gl.ARRAY_BUFFER, model_arrays.bumpaxis, gl.DYNAMIC_DRAW)
									gl.vertexAttribPointer(program.attributes.bumpaxis, 3, gl.FLOAT, false, 0, 0)
									
						            update_vertices = 0 // clear this counter only after making sure the vertex info has been sent to the GPUs
								}
			            	}
		                	
		                	var indices = sort[op][sort_type][sort_list]
		                			                	
		                	var tbobj = indices[0] // representative object is given as first element of list
		                	var model_index = new Uint32Array(indices.slice(1))
		                	var model_length = model_index.length
							
							gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer)
			                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model_index, gl.DYNAMIC_DRAW)
							
							if (mode == EXTENT) elements = gl.POINTS // no need to process interiors of triangles
							
							var Tdata = 0, Bdata = 0
							
							if (sort_type == 'textures') {
			                    if ((mode == RENDER || mode == RENDER_TEXTURE) && tbobj.__tex.file !== null) { // true if texture requested
			                    	if (tbobj.__tex.texture_ref.reference !== null) {
			                    		gl.activeTexture( gl.TEXTURE0 )
			                    		gl.bindTexture(gl.TEXTURE_2D, tbobj.__tex.texture_ref.reference)
			                    		Tdata = 1
			                    	} else continue // don't show until the texture is ready
			                    }
							} else if (sort_type == 'bumpmaps') {
			                    if ((mode == RENDER || mode == RENDER_TEXTURE) && tbobj.__tex.bumpmap !== null) { // true if bump map requested
			                    	if (tbobj.__tex.bumpmap_ref.reference !== null) {
			                    		gl.activeTexture( gl.TEXTURE1 )
			                    		gl.bindTexture(gl.TEXTURE_2D, tbobj.__tex.bumpmap_ref.reference)
			                    		Bdata = 1
			                    	} else continue // don't show until the bumpmap is ready
			                    }
							} else if (sort_type == 'textures_and_bumpmaps') {
			                    if ((mode == RENDER || mode == RENDER_TEXTURE) && tbobj.__tex.file !== null) { // true if texture requested
			                    	if (tbobj.__tex.texture_ref.reference !== null) {
			                    		gl.activeTexture( gl.TEXTURE0 )
			                    		gl.bindTexture(gl.TEXTURE_2D, tbobj.__tex.texture_ref.reference)
			                    		Tdata = 1
			                    	} else continue // don't show until the texture is ready
			                    }
			                    if ((mode == RENDER || mode == RENDER_TEXTURE) && tbobj.__tex.bumpmap !== null) { // true if bump map requested
			                    	if (tbobj.__tex.bumpmap_ref.reference !== null) {
			                    		gl.activeTexture( gl.TEXTURE1 )
			                    		gl.bindTexture(gl.TEXTURE_2D, tbobj.__tex.bumpmap_ref.reference)
			                    		Bdata = 1
			                    	} else continue // don't show until the bumpmap is ready
			                    }
							}
		                	
		                	gl.uniform1f(program.uniforms.T, Tdata)
		                    gl.uniform1f(program.uniforms.B, Bdata)
		                    gl.drawElements(elements, model_length, gl.UNSIGNED_INT, 0)
			            }
		              }
	                }
	            } // end of render_triangles
	            
	            function render_merge() {
	            	var model = object_models.quad
	                var elements = model.elementType
	                var model_length = model.index.length
	                if (fullpeels) { // device has plenty of texture units
	                	if (merge_program == null) merge_program = shaderProgram( shaders.merge_fragment, shaders.merge_vertex, gl )
			            useProgram(merge_program, minormode)
	                } else { // typically a mobile device
	                	if (merge_program2 == null) merge_program2 = shaderProgram( shaders.merge_fragment2, shaders.merge_vertex, gl )
			            useProgram(merge_program2, minormode)
	                }
		            
					gl.bindBuffer(gl.ARRAY_BUFFER, model.posBuffer)
					gl.vertexAttribPointer(program.attributes.pos, 3, gl.FLOAT, false, 0, 0)
					gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer)
					gl.drawElements(elements, model_length, gl.UNSIGNED_INT, 0)
	            	
	            }

	            for(var m in object_models) {
		        	
                	// We display a quad in merge mode only in the case of transparents, 
                	// in which case a quad is actually driven by the first transparent.
                	// The merge shaders know the vertex structure of the quad.
                	if (minormode >= MERGE) {
                		render_merge()
                		break
                	}
                	if (m == 'quad' || m == 'triangle') {
                		if (triangles_exist) render_triangles()
                		continue
                	} else if (m == 'curve') {
                		render_curves()
                		continue
                	}
                	
	                var model = object_models[m]
	                var elements = model.elementType
	                var model_length = model.index.length
	                var objs
	                if (minormode > PEEL_D0) {
	                	if (cvs.__transparent_objects[m] === undefined) continue
	                	objs = cvs.__transparent_objects[m]
	                } else {
	                	if (cvs.__opaque_objects[m] === undefined) continue
	                	objs = cvs.__opaque_objects[m]
	                }
	                
	                var gotobjects = false
	                for (var id in objs) {
	                	gotobjects = true
	                	break
	                }
	                if (!gotobjects) continue // don't bother doing lots of setup if there's nothing to do
    	            
                    // This needs to happen once per model, before rendering objects with that model.
	                var ringobject = ( m == 'ring' || m == 'vp_ring')
					switch(minormode) {
						case RENDER:
						case PEEL_C0:
							if (ringobject) {
								if (ring_program === null) ring_program = shaderProgram( shaders.opaque_render_fragment, shaders.ring_render_vertex, gl )
								useProgram(ring_program, minormode)
							} else {
								if (standard_program === null) standard_program = shaderProgram( shaders.opaque_render_fragment, shaders.render_vertex, gl )
								useProgram(standard_program, minormode)
							}
							break
						case PICK:
							if (ringobject) {
				            	if (ring_pick_program === null) ring_pick_program = shaderProgram( shaders.pick_fragment, shaders.ring_pick_vertex, gl )
				            	useProgram(ring_pick_program, minormode)
							} else {
				            	if (pick_program === null) pick_program = shaderProgram( shaders.pick_fragment, shaders.pick_vertex, gl )
				            	useProgram(pick_program, minormode)
							}
			            	break
						case EXTENT: // The EXTENT machinery doesn't actually work
		            		if (extent_program === null) extent_program = shaderProgram( shaders.pick_fragment, shaders.extent_vertex, gl )
	            			useProgram(extent_program, minormode)
	            			break
						case PEEL_D0:
							if (ringobject) {
				            	if (ring_peel_depth_programD0 === null) ring_peel_depth_programD0 = shaderProgram( shaders.peel_depth_fragmentD0, shaders.ring_peel_depth_vertex, gl )
				            	useProgram(ring_peel_depth_programD0, minormode)
							} else {
				            	if (peel_depth_programD0 === null) peel_depth_programD0 = shaderProgram( shaders.peel_depth_fragmentD0, shaders.peel_depth_vertex, gl )
				            	useProgram(peel_depth_programD0, minormode)
							}
			            	break
						case PEEL_D1:
							if (ringobject) {
				            	if (ring_peel_depth_programD1 === null) ring_peel_depth_programD1 = shaderProgram( shaders.peel_depth_fragmentD1, shaders.ring_peel_depth_vertex, gl )
				            	useProgram(ring_peel_depth_programD1, minormode)
							} else {
				            	if (peel_depth_programD1 === null) peel_depth_programD1 = shaderProgram( shaders.peel_depth_fragmentD1, shaders.peel_depth_vertex, gl )
				            	useProgram(peel_depth_programD1, minormode)
							}
			            	break
						case PEEL_D2:
							if (ringobject) {
				            	if (ring_peel_depth_programD2 === null) ring_peel_depth_programD2 = shaderProgram( shaders.peel_depth_fragmentD2, shaders.ring_peel_depth_vertex, gl )
				            	useProgram(ring_peel_depth_programD2, minormode)
							} else {
				            	if (peel_depth_programD2 === null) peel_depth_programD2 = shaderProgram( shaders.peel_depth_fragmentD2, shaders.peel_depth_vertex, gl )
				            	useProgram(peel_depth_programD2, minormode)
							}
			            	break
						case PEEL_D3:
							if (ringobject) {
				            	if (ring_peel_depth_programD3 === null) ring_peel_depth_programD3 = shaderProgram( shaders.peel_depth_fragmentD3, shaders.ring_peel_depth_vertex, gl )
				            	useProgram(ring_peel_depth_programD3, minormode)
							} else {
				            	if (peel_depth_programD3 === null) peel_depth_programD3 = shaderProgram( shaders.peel_depth_fragmentD3, shaders.peel_depth_vertex, gl )
				            	useProgram(peel_depth_programD3, minormode)
							}
			            	break    	
						case PEEL_C1:
							if (ringobject) {
				            	if (ring_peel_color_programC1 === null) ring_peel_color_programC1 = shaderProgram( shaders.peel_color_fragmentC1, shaders.ring_render_vertex, gl )
				            	useProgram(ring_peel_color_programC1, minormode)
							} else {
				            	if (peel_color_programC1 === null) peel_color_programC1 = shaderProgram( shaders.peel_color_fragmentC1, shaders.render_vertex, gl )
				            	useProgram(peel_color_programC1, minormode)
							}
			            	break
						case PEEL_C2:
							if (ringobject) {
				            	if (ring_peel_color_programC2 === null) ring_peel_color_programC2 = shaderProgram( shaders.peel_color_fragmentC2, shaders.ring_render_vertex, gl )
				            	useProgram(ring_peel_color_programC2, minormode)
							} else {
				            	if (peel_color_programC2 === null) peel_color_programC2 = shaderProgram( shaders.peel_color_fragmentC2, shaders.render_vertex, gl )
				            	useProgram(peel_color_programC2, minormode)
							}
			            	break
						case PEEL_C3:
							if (ringobject) {
				            	if (ring_peel_color_programC3 === null) ring_peel_color_programC3 = shaderProgram( shaders.peel_color_fragmentC3, shaders.ring_render_vertex, gl )
				            	useProgram(ring_peel_color_programC3, minormode)
							} else {
				            	if (peel_color_programC3 === null) peel_color_programC3 = shaderProgram( shaders.peel_color_fragmentC3, shaders.render_vertex, gl )
				            	useProgram(peel_color_programC3, minormode)
							}
			            	break
						case PEEL_C4:
							if (ringobject) {
				            	if (ring_peel_color_programC4 === null) ring_peel_color_programC4 = shaderProgram( shaders.peel_color_fragmentC4, shaders.ring_render_vertex, gl )
				            	useProgram(ring_peel_color_programC4, minormode)
							} else {
				            	if (peel_color_programC4 === null) peel_color_programC4 = shaderProgram( shaders.peel_color_fragmentC4, shaders.render_vertex, gl )
				            	useProgram(peel_color_programC4, minormode)
							}
			            	break
					}
		            
					gl.bindBuffer(gl.ARRAY_BUFFER, model.posBuffer)
					gl.vertexAttribPointer(program.attributes.pos, 3, gl.FLOAT, false, 0, 0)
					if (mode != PICK && (mode == RENDER || minormode == PEEL_C0 || minormode == PEEL_C1 ||
      		              minormode == PEEL_C2 || minormode == PEEL_C3 || minormode == PEEL_C4)) {
						gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer)
						gl.vertexAttribPointer(program.attributes.normal, 3, gl.FLOAT, false, 0, 0)
						gl.bindBuffer(gl.ARRAY_BUFFER, model.colorBuffer)
						gl.vertexAttribPointer(program.attributes.color, 3, gl.FLOAT, false, 0, 0)
						gl.bindBuffer(gl.ARRAY_BUFFER, model.opacityBuffer)
						gl.vertexAttribPointer(program.attributes.opacity, 1, gl.FLOAT, false, 0, 0)
						gl.bindBuffer(gl.ARRAY_BUFFER, model.shininessBuffer)
						gl.vertexAttribPointer(program.attributes.shininess, 1, gl.FLOAT, false, 0, 0)
						gl.bindBuffer(gl.ARRAY_BUFFER, model.emissiveBuffer)
						gl.vertexAttribPointer(program.attributes.emissive, 1, gl.FLOAT, false, 0, 0)
						gl.bindBuffer(gl.ARRAY_BUFFER, model.texposBuffer)
						gl.vertexAttribPointer(program.attributes.texpos, 2, gl.FLOAT, false, 0, 0)
						gl.bindBuffer(gl.ARRAY_BUFFER, model.bumpaxisBuffer)
						gl.vertexAttribPointer(program.attributes.bumpaxis, 3, gl.FLOAT, false, 0, 0)
					} else if (ringobject) { // rings use normal to carry position information
						gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer)
						gl.vertexAttribPointer(program.attributes.normal, 3, gl.FLOAT, false, 0, 0)
					}
					gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer)
	                
					if (mode == EXTENT) elements = gl.POINTS // no need to process interiors of triangles
	                
	                for (var id in objs) {
						var obj = objs[id]
	                    var data = obj.__data
						
						if (minormode < MERGE && mode != PICK) {
		                    if ((mode == RENDER || mode == RENDER_TEXTURE) && obj.__tex.file !== null) { // true if texture requested
		                    	if (obj.__tex.texture_ref.reference !== null) {
		                    		gl.activeTexture( gl.TEXTURE0 )
		                    		gl.bindTexture(gl.TEXTURE_2D, obj.__tex.texture_ref.reference)
		                    	} else continue // don't show until the texture is ready
		                    }
		                    if ((mode == RENDER || mode == RENDER_TEXTURE) && obj.__tex.bumpmap !== null) { // true if bump map requested
		                    	if (obj.__tex.bumpmap_ref.reference !== null) {
		                    		gl.activeTexture( gl.TEXTURE1 )
		                    		gl.bindTexture(gl.TEXTURE_2D, obj.__tex.bumpmap_ref.reference)
		                    	} else continue // don't show until the bumpmap is ready
		                    }
						}

	                    if (mode == PICK) {
	                        var falsecolor = obj.__falsecolor
	                        for (var i=0; i<4; i++) {
	                            save[i] = data[16+i]
	                            data[16+i] = falsecolor[i]
	                        }
	                    }
	                    
	                    // This stuff needs to happen for each individual object
	                    gl.uniform4fv(program.uniforms.objectData, data)
	                    gl.drawElements(elements, model_length, gl.UNSIGNED_INT, 0)
	                    
	                    if (mode == PICK) {
	                        for (var i=0; i<4; i++) data[16+i] = save[i]
	                    }

	                }
	            } // end of "for(var m in object_models)"
            	
            	if (mode != PICK) {
	                gl.bindRenderbuffer(gl.RENDERBUFFER, null)
	                gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            	}
            	
            } // end of "function subrender(minormode, T, Trefs) {"
            
        	
            if (mode == RENDER) {
            	subrender(mode, null, [])
            } else if (mode == PICK) {
            	subrender(mode, 'C0', [''])
            	//subrender(PEEL_D0, 'D0', []) // for testing purposes
            } else if (mode == EXTENT) { // The EXTENT machinery doesn't actually work
            	subrender(mode, 'EXTENT_TEXTURE', [])
            } else if (mode == RENDER_TEXTURE) {

            	subrender(PEEL_C0, 'C0', [])          //  4 - opaque color
            	subrender(PEEL_D0, 'D0', [])          //  5 - opaque depth; no max depth map involved

            	//subrender(PEEL_D0, 'C0', [])    // comment out the two previous subrender calls, use these to see D0
            	//subrender(MERGE, null, ['C0'])  // Comment out the statements below; change merge shader to display C0
            	
            	subrender(PEEL_C1, 'C1', ['D0'])      //  6 - 1st transparency color, based on D0
            	
            	if (fullpeels) { // plenty of texture units available
                	subrender(PEEL_D1, 'D1', ['D0'])      //  7 - 1st transparency depth; based on D0 
                	
                	subrender(PEEL_C2, 'C2', ['D0','D1']) //  8 - 2nd transparency color, based on D0 and D1
                	
	            	subrender(PEEL_D2, 'D2', ['D0','D1']) //  9 - 2nd transparency depth; based on D0 and D1
	            	
	            	subrender(PEEL_C3, 'C3', ['D0','D2']) // 10 - 3rd transparency color, based on D0 and D2
	            	
	            	subrender(PEEL_D3, 'D3', ['D0','D2']) // 11 - 3rd transparency depth; based on D0 and D2
	            	
	            	subrender(PEEL_C4, 'C4', ['D0','D3']) // 12 - 4th transparency color, based on D0 and D3
	            	
	            	// Render directly to the screen, merging colors onto a quad:
	            	subrender(MERGE, null, ['C0', 'C1', 'C2', 'C3', 'C4'])   // 13 - merge C0, C1, C2, C3, C4
	            	
            	} else subrender(MERGE, null, ['C0', 'C1'])
				
            	/*
            	// Render to a texture, then apply to a quad:
        		subrender(MERGE, 'FINAL', 0, dependencies)   // 12 - merge C0, C1, C2, C3, C4 into FINAL
        		gl.bindTexture(gl.TEXTURE_2D, peels.FINAL)
        		gl.generateMipmap(gl.TEXTURE_2D)
        		gl.bindTexture(gl.TEXTURE_2D, null)
            	subrender(FINAL, null, 0, [])   // 13 - place FINAL onto a quad
            	*/
            }
        	
            if (mode == EXTENT) { // The EXTENT machinery doesn't actually work; the intent was to do autoscaling in GPUs
            	// The idea was to store into a render into location 0,0 of a small texture (3x3, say) the extent of each
            	// object vertex, using gl.depthFunc(gl.GREATER) instead of gl.depthFunc(gl.LEQUAL) to get largest value
            	// of the distance from the center of the scene.
            	// See comment at start of this file about reading the buffer.
            	gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
                var mantissa = (256*pixels[1] + pixels[2])/65536;
                var exponent = pixels[0]
                if (exponent > 128) {
                	exponent = -(exponent - 128)
                	mantissa = -mantissa
                }
            	var extent
            	if (mantissa == 0 && exponent == 0) extent = 0
                else extent = Math.exp(mantissa + exponent)
            	//cvs.title.text(pixels[0]+" "+pixels[1]+" "+pixels[2]+" "+pixels[3]+' : '+cvs.mouse.__pickx+' '+cvs.mouse.__picky)
            	//cvs.caption.text('extent='+extent.toExponential(3))
            	return null
            } else if (mode == PICK) { // pick
            	// readPixels returns RGBA values in range 0-255, 
                // starting at lower left corner, left to right, bottom to top
                // Chrome: The readPixels operation takes about [ 7 + 8e-5*(cvs.width*cvs.height) ] ms.
            	// The fact that only one pixel is being read is irrelevant; what matters is the canvas size.
            	// Example: If the canvas is 1000*1000, reading one pixel takes about 90 ms. Yuck.
            	// From http://www.khronos.org/message_boards/viewtopic.php?f=4&t=711:
            	//   Generally glReadPixels() is slow and should really only be used 
            	//   when doing screencapture at which point performance is non critical. 
            	//   The main cause for this loss of performance is due to synchronisation: 
            	//   the glReadPixels() call forces synchronisation between the CPU and 
            	//   the Graphics Core thus serialising them and resulting in lost CPU and 
            	//   Graphics Core performance. At which point it does not matter that much 
            	//   if you access only a single pixel or copy the whole buffer, 
            	//   you lost most of the performance with the synchronisation.
            	// TODO: Would it help to render to a one-pixel renderbuffer, located where the mouse is?
            	gl.readPixels(cvs.mouse.__pickx, cvs.mouse.__picky, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
            	var id = 16777216*pixels[0] + 65536*pixels[1] + 256*pixels[2] + pixels[3]
            	var obj = cvs.__visiblePrimitives[id]
            	
            	// Debugging:
            	//var z = (pixels[0] + pixels[1]/256.0)/256.0
            	//console.log(z, pixels[0], pixels[1], pixels[2], pixels[3])
            	//var w = 256*pixels[2] + pixels[3]
			    //var exponent = pixels[0]-100;
			    //var m = (pixels[1] + pixels[2]/256)/250;
			    //var m = (pixels[1] + pixels[2]/256 + pixels[3]/65536)/250;
			    //var z = exp(exponent, m)
            	//console.log('z', z, exponent, m)
            	
            	//cvs.caption.text(id.toExponential(3))
                //cvs.caption.text(cvs.mouse.__pickx+' '+cvs.mouse.__picky+': '+(pixels[0]/255).toFixed(3)+" "+(pixels[1]/255).toFixed(3)+" "+
                //		(pixels[2]/255).toFixed(3)+" "+(pixels[3]/255).toFixed(3)+": "+id+" "+obj)
            	//var k = 100
            	//cvs.caption.text(cvs.mouse.__pickx+' '+cvs.mouse.__picky+': '+k*(pixels[0]/255).toFixed(2)+" "+
            	//		k*(pixels[1]/255).toFixed(2)+" "+(pixels[2]).toFixed(2)+" "+(pixels[3]).toFixed(2)+": "+id)
                //cvs.title.text(cvs.mouse.__pickx+' '+cvs.mouse.__picky+': '+pixels[0]+" "+pixels[1]+" "+pixels[2]+" "+pixels[3]+": "+id)
                if (!obj) return null
                else if (obj.__obj && obj.__obj.pickable) return obj.__obj // currently, only the arrow object (which has 2 components)
                else if (obj.constructor.name == 'point') { // picked an individual point on a curve
                	if (!obj.__curve.pickable || !obj.pickable) return null
                    var pts = obj.__curve.__points
                    var L = pts.length
                    for (var i=0; i<L; i++) {
                        if (pts[i] === obj) {
                            obj = obj.__curve
                            obj.pick = i    // for backward compatibiity in JavaScript
                            obj.segment = i // for VPython or JavaScript (preprocessing of VPython converts pick -> pick()
                            return obj
                            }
                    }
                    return null // could not find this point along this curve
                }
                if (!obj.pickable) return null
                else return obj
            }
        } // end of this.render
    
    /* At top of this file
    var fps = 0                // measured average frames per second
    var renderMS = 0           // measured average milliseconds per render
    var lastStartRedraw = 0    // time in milliseconds of most recent start of render
    var lastEndRedraw = 0      // time in milliseconds of most recent end of render
    */
    	
    function trigger_render() {
		//window.requestAnimationFrame(trigger_render) // this led to erratic behavior
		setTimeout(trigger_render, 17)
        var doAverage = (lastStartRedraw > 0) // true if this is not the first redraw event
        var t = msclock()
        var elapsed = 0
        if (doAverage) elapsed = t - lastStartRedraw
		lastStartRedraw = t
        cvs.trigger("redraw", { dt: elapsed })
        
		renderer.render(RENDER) // send data to GPU
        
        t = msclock()
        elapsed = 0
        if (doAverage) elapsed = t - lastEndRedraw
        lastEndRedraw = t
        
        if (doAverage) {
        	renderMS = renderMS * .95 + (t - lastStartRedraw) * .05
        	fps = fps * .95 + (1000 / elapsed) * .05
    	} else {
    		renderMS = (t - lastStartRedraw)
    		fps = 0
		}
        
    	var total = fps * renderMS
        $("#fps").text(fps.toFixed(1) + " renders/s * " + renderMS.toFixed(1) + 
        		" ms/render = " + total.toFixed(1) + " ms rendering/s")
        cvs.__last_center = cvs.__center
        cvs.__last_axis = cvs.__axis
        cvs.__last_range = cvs.__range
        cvs.__last_up = cvs.__up
        cvs.__last_width = cvs.__width
		cvs.__last_height = cvs.__height
		cvs.trigger("draw_complete", { dt: elapsed })
		if (cvs.__waitfor_image) {
			cvs.__image = new Image()
			cvs.__image.src = canvasElement.toDataURL()
			cvs.__waitfor_image = false
		}
		if (cvs.__mouse_move !== null) cvs.trigger("mouse", cvs.__mouse_move)
    }
    
    this.reset()
    trigger_render() // initial call, to get the rendering started
    } // end of WebGLRenderer

    var desired_fps = 60 // desired renders per second
    var N = 0    // number of iterations to do between renders
	var enditers
    
    async function rate(iters, callback) { // rate(100) or rate(100, somefunction)
		var dt, timer
		if (N > 0) {
			N--
			timer = msclock()
			if (timer > enditers) N = 1 // truncate the iterations to permit renders to occur
			if (N > 1) {
				if (callback === undefined) return // return immediately
				else callback()
			} else { // One iteration remains to do:
				N = 0
				var dt = enditers - Math.ceil(timer)
				if (dt < 5) dt = 0
				// Execute the callback function one last time, allowing rendering to occur:
				if (callback === undefined) await sleep(dt/1000) // sleep expects seconds
				else setTimeout(callback,dt)
			}
		} else {
			if (iters <= 120) {
				dt = Math.ceil(1000/iters)
				// Return after waiting dt:
				if (callback === undefined) await sleep(dt/1000) // sleep expects seconds
				else setTimeout(callback,dt)
			} else { // Do multiple iterations within 1/60th of a second:
				timer = msclock()
				N = Math.ceil(iters/desired_fps) // number of iterations to perform before pausing for rendering
				enditers = msclock() + Math.ceil(1000/desired_fps)
				// First execution of the 1/60th sec time interval:
				if (callback === undefined) return // return immediately
				else callback()
			}
		}
	}
    
    var exports = { WebGLRenderer: WebGLRenderer, rate: rate }
    Export(exports)
})()
