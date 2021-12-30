;(function () {
    "use strict";

    var keysdownlist = [] // private copy of list of keys currently depressed, maintained in this file

    function keysdown() { // return a copy of keysdownlist
        var k = []
        for (var i=0; i<keysdownlist.length; i++) k.push(keysdownlist[i])
        return k
    }
    
    // keycode to character tables
    var _unshifted = ['', '', '', '', '', '', '', '', 'backspace', 'tab', // 0-9
                      '', '', '', '\n', '', '', 'shift', 'ctrl', 'alt', '', // 10-19
                      'caps lock', '', '', '', '', '', '', 'esc', '', '', // 20-29
                      '', '', ' ', 'pageup', 'pagedown', 'end', 'home', 'left', 'up', 'right', // 30-39
                      'down', '', '', '', ',', 'insert', 'delete', '/', '0', '1', // 40-49
                      '2', '3', '4', '5', '6', '7', '8', '9', '', ';', // 50-59
                      '', '=', '', '', '', 'a', 'b', 'c', 'd', 'e', // 60-69
                      'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', // 70-79
                      'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', // 80-89
                      'z', '[', '\\', ']', '', '', '`', '', '', '', // 90-99
                      '', '', '', '', '', '', '', '', '', '', // 100-109
                      '', '', '', '', '', '', '', '', '', '', // 110-119
                      '', '', '', '', '', '', '', 'delete'] //120-127
   _unshifted[187] = '='
   _unshifted[189] = '-'
   _unshifted[192] = "`"
   _unshifted[219] = '['
   _unshifted[220] = '\\'
   _unshifted[221] = ']'
   _unshifted[186] = ';'
   _unshifted[222] = "'"
   _unshifted[188] = ','
   _unshifted[190] = '.'
   _unshifted[191] = '/'
      
   var _shifted = ['', '', '', '', '', '', '', '', 'backspace', 'tab', // 0-9
      '', '', '', '\n', '', '', 'shift', 'ctrl', 'alt', 'break', // 10-19
      'caps lock', '', '', '', '', '', '', 'esc', '', '', //20-29
      '', '', '', '!', '"', '//', '$', '%', '&', '"', // 30-39
      '(', ')', '*', '+', '<', '_', '>', '?', ')', '!', // 40-49
      '@', '#', '$', '%', '^', '&', '*', '(', ':', ':', // 50-59
      '<', '=', '>', '?', '@', 'A', 'B', 'C', 'D', 'E', // 60-69
      'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', // 70-79
      'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', // 80-89
      'Z', '{', '|', '}', '^', '_', '~', '', '', '', // 90-99
      '', '', '', '', '', '', '*', '+', '', '', // 100-109
      '', '', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', // 110-119
      'f9', 'f10', '', '{', '|', '}', '~', 'delete'] //120-127
   _shifted[187] = '+'
   _shifted[189] = '_'
   _shifted[192] = "~"
   _shifted[219] = '{'
   _shifted[220] = '|'
   _shifted[221] = '}'
   _shifted[186] = ':'
   _shifted[222] = '"'
   _shifted[188] = '<'
   _shifted[190] = '>'
   _shifted[191] = '?'
    
    var shiftlock = false
	
	var __waitfor // event types in current waitfor()
	var __waitfor_canvas // which canvas is associated with this waitfor
	var __waitfor__expecting_key // the state of this.__expecting_key at the time of the waitfor

    // Extend jquery-ui with a menubar functionality ... currently only has non-collapsable vertical menu.
    // Might need to be placed in a controls.js eventually, but for now this will do.
    // $.fn.extend({
    //   gsmenubar: function(cmd) {
    //       if (!this.is("ul")) {
    //           alert("MenuBar top level must be unordered list, i.e. <ul>.")
    //           return
    //       }
    //       this.addClass("gsmenubar");
    //       this.children("li").children("ul").each(function() { $(this).menu() })
    //   }
    // });

    window.print_anchor = $("<div/>").css("white-space","pre").appendTo($('body')) // anchor point below caption
    window.print_anchor.css({float:"left"})
    
    var __id = 0

    function canvas(options) {
        if (!(this instanceof canvas)) return new canvas(options)
        if (!options) options = {}

        canvas.activated = [] // among other uses, run.js/screenshot() looks here for a canvas
        canvas.selected = this
        canvas.hasmouse = null
        
        this.__title_anchor = $("<div/>") // title anchor point
        this.__caption_anchor = $("<div/>") // caption anchor point
        this.__titletext = ''
        this.__captiontext = ''
        
        if ('title' in options) {
        	this.__titletext = options.title
        	delete options.title
        }
        if ('caption' in options) {
        	this.__captiontext = options.caption
        	delete options.caption
        }
        this.__align = 'none'
        if ('align' in options) {
        	this.__align = options.align
        	delete options.align
        }

        this.__lastevent = null // used to update mouse data if there are changes to range/axis/center/up
        
        this.__autoscale = true
        if ('autoscale' in options) { // must set autoscale before setting range
        	this.__autoscale = options.autoscale
        	delete options.autoscale
        }

        this.__range = 10
        
        if ('width' in options) { 
            this.__width = options.width;
            delete options.width;
        }
        
        if ('height' in options) { 
            this.__height = options.height;
            delete options.height;
        }
        
        for(var id in options) this[id] = options[id]
        this.hasmouse = false
        
        // If the mouse is held stationary while range/axis/center/up is changed,
        // there is no mouse event, yet scene.mouse.pos etc. should change.
        // So if range/axis/center/up does get changed, set this.__needs_update = true,
        // and call this.mouse.__update at the end of a render.
        this.__needs_update = false

        // Lots of canvas's members are mutable objects, so they can't just be defined on canvas.prototype.
        this.events = [] // each element looks like ['mousedown, mouseup etc.', function]
        this.wrapper = $("<div/>")
        this.menu = $("<div/>")
        //this.__drag_handle = $("<div/>");
        this.__canvas_element = document.createElement("canvas")
        this.__overlay_element = document.createElement("canvas")
        this.elements = $([this.__canvas_element, this.__overlay_element])
        this.__overlay_objects = { objects: [], __changed: false }
        this.__mouse_move = null // set in orbital_camera.js; rendering triggers it
        this.__visiblePrimitives = {}
        this.lights = []
        distant_light({ canvas: this, direction: vec( 0.22,   0.44,  0.88), color: vec(.8, .8, .8) })
        distant_light({ canvas: this, direction: vec(-0.88,  -0.22, -0.44), color: vec(.3, .3, .3) })
        this.trails = [] // from attach_trail
        this.arrows = [] // from attach_arrow
        this.attached_lights = [] // from attach_light
        this.billboards = [] // from 3D text
        this. update_billboards = false // set to True when a new billboarded 3D text object is created, to inform WebGLRenderer.js
        this.__points_objects = [] // list of points objects
        this.__opaque_objects = {}
        this.__transparent_objects = {}

        this.vertex_id = 1
        var N = 100 // the number of additional vertices to allocate each time we need more storage
        this.__vertices = {
            Nalloc:N, pos:new Float32Array(3*N), normal:new Float32Array(3*N), 
            color:new Float32Array(3*N), opacity:new Float32Array(N), 
            shininess:new Float32Array(N), emissive:new Float32Array(N),
            texpos:new Float32Array(2*N), bumpaxis:new Float32Array(3*N), 
            //index: new Uint32Array(N), // not currently used
            //model_transparent: false, // not currently used
            object_info:{}, // vertex_object:[list of triangles/quads using this vertex]
        	available:[]   // push no longer used id onto available stack; pop to get an available vertex id
        }
        this.__vertices.normal[2] = 1 // to avoid possible problems with the unused 0th vertex at render time

        // Sort triangles/quads into renderable categories. For example, an entry in opaque:textures
        // has the form texture_name:[indices of all the opaque triangles that share this texture].
        // In the case of plain, there's only one entry -- all:[indices...].
        // In lists of indices, quads are represented as 6 indices, already reduced to two triangles.
        this.__sort_objects = { 
            opaque: { plain:{}, textures:{}, bumpmaps:{}, textures_and_bumpmaps:{} },
            transparent: { plain:{}, textures:{}, bumpmaps:{}, textures_and_bumpmaps:{} }
        }
        this.camera = orbital_camera(this) // bind events first to the camera, for spin and zoom
        this.mouse = new Mouse(this)
        this.mouse.pos = vec(0,0,0) // otherwise pos and ray are null
        this.mouse.ray = vec(0,0,1)
        this.textures = {} // index loaded textures by file name; data is image
        this.textures_requested = {} // index requested textures by file name; data is list of requesting objects
        this.__changed = {}
        this.__vertex_changed = {}
        this.visible = true
        this.waitfor_textures = false
        __waitfor = '' // if waitfor('keydown keyup'), __waitfor is 'keydown keyup'
        this.__expecting_key = false // true if binding for keydown or keyup
        this.center = this.center    // set up attribute vector
        this.axis = this.axis  // set up attribute vector
        this.up = this.up            // set up attribute vector
        this.__triggered = undefined // set to event by trigger (or null, if waitfor textures)
        this.__waitfor_bound = undefined // associated with waitfor and pause
        this.__id = __id
        __id++
    }
    property.declare( canvas.prototype, {
        __activate: function () {
            this.__activated = true
            this.__activate = function(){} // block further activations

            var container = canvas.container
            this.__title_anchor.css("white-space","pre").appendTo( container )
            this.menu.css("white-space","pre").appendTo( container )
            this.wrapper.addClass("glowscript-canvas-wrapper").css("display","inline-block").appendTo( container )
            //this.wrapper.addClass("glowscript-canvas-wrapper").css("display","inline-block").css("border","1px solid #777777").appendTo( container )
            this.__caption_anchor.css("white-space","pre").appendTo( container )
            this.wrapper.css("position", "relative")  // flows with page, but can have absolute positioning inside

            //this.__drag_handle.css("display","inline-block").width(0).height(this.height).css("backgroundImage","url('css/images/drag_handle.png')").appendTo(this.wrapper);
            
            // TODO: Use jquery for this, too?
            var cv = this.__canvas_element
            cv.style.position = "absolute"  // removed from flow inside wrapper, so overlay will be positioned at the same spot
            
            var overlay = this.__overlay_element
            overlay.style.position = "relative"  // not removed from flow, so wrapper will be the right size
            overlay.style.backgroundColor = "transparent"
            
            this.width = this.__width;      // Necessary to initiate width of canvas.
            this.height = this.__height;    // Necessary to initiate height of canvas.
            
            this.wrapper.append(this.__canvas_element)
            this.wrapper.append(this.__overlay_element)

            /*
            this.wrapper.draggable({ containment: "window", handle: this.__drag_handle })
            if (this.draggable) {
                this.wrapper.draggable("enable")
                this.__drag_handle.width(10)
				//this.width=this.__width
            }
            */
            
            this.wrapper.resizable({
                alsoResize: [this.__canvas_element, this.__overlay_element],
                resize: function(ev, ui) {
                	this.__canvas_element.width = this.__canvas_element.style.width = this.__overlay_element.width = this.__overlay_element.style.width = this.__width = ui.size.width /* - this.__drag_handle.width()*/
                	this.__canvas_element.height = this.__canvas_element.style.height = this.__overlay_element.height = this.__overlay_element.style.height /*= this._drag_handle[0].style.height*/ = this.__height = ui.size.height
                    this.trigger('resize', {event:'resize'})
                	//this.__canvas_element.width = this.__canvas_element.style.width = this.__overlay_element.width = this.__overlay_element.style.width = this.__width = ui.size.width - this.__drag_handle.width()
                    //this.__canvas_element.height = this.__canvas_element.style.height = this.__overlay_element.height = this.__overlay_element.style.height = this.__drag_handle[0].style.height = this.__height = ui.size.height
                }.bind(this)
            });
            if (!this.resizable) this.wrapper.resizable("disable")
            this.wrapper.css("float", this.__align)
            
            if (this.camera.__activate) this.camera.__activate()
            this.__handleEvents()
            
            if (this.__titletext) this.title = this.__titletext
            if (this.__captiontext) this.caption = this.__captiontext
                        
            this.__renderer = new WebGLRenderer( this, cv, overlay )
            canvas.activated.push(this) // list of activated canvases
        },
        
        remove: function() { // JavaScript forbids scene.delete(), so in preprocessing we change .delete to .remove
            for(var id in this.__visiblePrimitives) this.__visiblePrimitives[id].visible = false
            for(var id in this.__overlay_objects.objects) this.__overlay_objects.objects[id].visible = false
            if (this.__activated) canvas.activated[this.__id] = null
            this.wrapper.remove()
        },

        __handleEvents: function() {
            var canvas = this
            var elements = canvas.elements
            
            // Mouse and touch events other than mouseenter and mouseleave
            // are handled in orbital_camera.js which does all the logic
            // for calling (or not calling) canvas.trigger. For example,
            // a move of zero distance does not trigger a user event, and
            // a click event is triggered by an up event if the mouse has
            // moved no more than 5 pixels in x or y.
            elements.bind("mouseenter mouseleave", function(ev) {
            	canvas.trigger("mouse", ev) // trigger whether ev.which is 0 (button up) or 1 (button down)
            })
            
            var keys = { shift:16, ctrl:17, alt:18 }
            // Mac cmd key is 91 on MacBook Pro but apparently may be different on other Macs.
            $(document).bind("keydown keyup", function (ev) {
                for (var k in keys) {
                    if (keys[k] == ev.which) {
                        canvas.mouse[k] = (ev.type == "keydown")
                        break
                    }
                }
            	ev.shift = (canvas.mouse.shift || shiftlock)
            	ev.key = _unshifted[ev.which]
            	if (shiftlock && (65 <= ev.which && ev.which <= 90)) ev.key = _shifted[ev.which]
            	else if (canvas.mouse.shift) ev.key = _shifted[ev.which]
                var n = keysdownlist.indexOf(ev.key)
                if (ev.type == "keydown") {
                    if (n < 0) keysdownlist.push(ev.key) // add to list
                } else if (n >= 0) { // keyup
                    keysdownlist.splice(n, 1)              // remove from list
                }
            	if (!canvas.__expecting_key) return
            	ev.event = ev.type
            	if (ev.which == 20 && ev.type == "keydown") shiftlock = !shiftlock
            	ev.alt = canvas.mouse.alt
                ev.ctrl = canvas.mouse.ctrl
            	canvas.trigger(ev.type, ev)
            })
        },
	    
        screenshot: async function(include_overlay){ // return screenshot as data url
            // Code due to "eltos" to capture label text, May 2021
            var img = await this.__renderer.screenshot();
            if (include_overlay) {
                // combine WebGL image with overlay canvas
                var overlay = this.__overlay_element
                var c = document.createElement('canvas')
                c.width = overlay.width
                c.height = overlay.height
                await img.decode() // wait for image to be loaded
                c.getContext("2d").drawImage(img, 0, 0)
                c.getContext("2d").drawImage(overlay, 0, 0)
                var data = c.toDataURL()
                c.remove()
                return data;
            } else {
                return img.src;
            }
        },

        capture: async function(filename, include_overlay){ // send image of canvas to Download directory
        	if (include_overlay === undefined) include_overlay = true
            if (filename.constructor !== String) throw new Error('A capture file name must be a string.')
        	if (filename.slice(-4) != '.png') filename += '.png'
            var screenshot = await this.screenshot(include_overlay);
            var a = document.createElement("a")
            a.href = screenshot
            a.download = filename
            a.click()
            a.remove()
        },

        waitfor: async function( eventTypes ) {
            // Save information to be restored at the end of the wait
        	var cvs = this
            var __waitfor__expecting_key = this.__expecting_key
            var __waitfor = eventTypes
            cvs.__waitfor_bound = undefined
            cvs.__expecting_key = (__waitfor.search('key') >= 0)
            // The 3D renderer in WebGLREnderer.js checks for waitfor_textures,
            // and if true doesn't render if not all textures are ready.
            if (__waitfor == 'textures') cvs.waitfor_textures = true

            function __waiting(ev) {
                cvs.__waitfor_bound = ev
            }

            cvs.bind(__waitfor, __waiting)
            var w
            while (true) {
                await rate(60)
                w = cvs.__waitfor_bound
                if (w !== undefined) {
                    if (__waitfor == 'textures' && w === null) break
                    else if (__waitfor.search(w.type) >= 0) break
                }
            }
            cvs.__waitfor_bound = undefined
            cvs.unbind(__waitfor, __waiting)
            __waitfor = ''
            cvs.__expecting_key = __waitfor__expecting_key
            return new Promise( (resolve) => { resolve(w) } )
        },
        pause: async function( args ) {
        	var cvs = this
        	__waitfor__expecting_key = this.__expecting_key
            cvs.__waitfor_bound = undefined
            var w
        	var prompt = ''
        	if (args !== undefined) prompt = args.toString()

            function __waiting(ev) {
                cvs.__waitfor_bound = ev
            }
            
            if (prompt.length > 0) {
                if (cvs.__prompt == undefined) {
                    cvs.__prompt = label({
                    	canvas: cvs,
                        align:'right', pixel_pos:true, height:14, 
                        color:color.black, background:color.white, opacity:1, box:false
                    })
                }
                cvs.__prompt.pos = vec(cvs.__width,cvs.__height-12,0)
                cvs.__prompt.text = prompt
                cvs.__prompt.visible = true
                cvs.bind('click', __waiting)
                while (true) {
                    await rate(60)
                    w = cvs.__waitfor_bound
                    if (w !== undefined) {
                        cvs.__prompt.visible = false
                        break
                    }
                }
            } else {
                if (cvs.__draw == undefined) cvs.__draw = draw({canvas:cvs})
                var x = cvs.width-5, y = cvs.height-20
                cvs.__draw.points = [vec(x,y,0), vec(x-30,y-13,0), vec(x-30,y+15,0), vec(x,y,0)]
                cvs.__draw.opacity = 1
                cvs.__draw.color = color.black
                cvs.__draw.fillcolor = color.white
                cvs.__draw.visible = true
                cvs.bind('click', __waiting)
                while (true) {
                    await rate(60)
                    w = cvs.__waitfor_bound
                    if (w !== undefined) {
                        cvs.__draw.visible = false
                        break
                    }
                }
            }
            cvs.__waitfor_bound = undefined
            cvs.unbind(__waitfor, __waiting)
            cvs.__expecting_key = __waitfor__expecting_key
            return new Promise( (resolve) => { resolve(w) } )
        },
        
        select: function() { window.__context.canvas_selected = this }, // used by classic VPython
        
        // Was unable to use title_anchor before activating the canvas, even if the canvas.container
        // manipulations were moved from the __activate function into the canvas constructor,
        // despite the fact that earlier use of seemingly the same structure (with scene.title
        // and scene.caption instead of scene.title_anchor and scene.caption_anchor).
        title_anchor: {
        	get: function() {
        		if (!this.__activated) this.__activate() // program can fail if title_anchor referenced before canvas activated
        		return this.__title_anchor
        	},
        	set: function(value) {
        		throw new Error("Cannot change title_anchor")
        	}
        },
        
        caption_anchor: {
        	get: function() {
        		if (!this.__activated) this.__activate() // program can fail if caption_anchor referenced before canvas activated
        		return this.__caption_anchor
        	},
        	set: function(value) {
        		throw new Error("Cannot change caption_anchor")
        	}
        },
        
        title: {
            get: function() { return this.__titletext },
            set: function(value) {
            	this.__titletext = value
                this.__title_anchor.html(value) // display the title
            }
        },
        
        caption: {
            get: function() { return this.__captiontext },
            set: function(value) {
            	this.__captiontext = value
                this.__caption_anchor.html(value) // display the title
            }
        },
        
        append_to_title: function(args) {
        	var s = ''
        	var L = arguments.length
        	for (var i=0; i<L; i++) s += print_to_string(arguments[i])+' '
        	s = s.slice(0,-1)
    		this.__titletext += s
        	this.__title_anchor.append(s)
        },
        
        append_to_caption: function(args) {
        	var s = ''
        	var L = arguments.length
        	for (var i=0; i<L; i++) s += print_to_string(arguments[i])+' '
        	s = s.slice(0,-1)
    		this.__captiontext += s
    		this.__caption_anchor.append(s)
        },
        
        bind: function( eventTypes, callback ) {
            // Documentation claims that with D = scene.bind(...) you can say D.stop() and D.start()
            // but this was not true in GlowScript 2.8.
        	if (eventTypes.search('key') >= 0) this.__expecting_key = true
            for (var i=0; i<this.events.length; i++) {
                if (this.events[i][1] === callback) {
                    this.events[i][0] += ' '+eventTypes
                    return
                }
            }
            this.events.push([eventTypes, callback])
        },
        
        unbind: function( eventTypes, callback ) {
        	if (eventTypes.search('key') >= 0) this.__expecting_key = false
            var etypes = eventTypes.split(' ')
            for (var i=0; i<this.events.length; i++) {
                var bound = this.events[i][1]
                if (bound === callback) {
                    var types = this.events[i][0]
                    for (var j=0; j<etypes.length; j++) {
                        var t = etypes[j]
                        if (t == ' ') continue // handle eventTypes = '  mousedown     mouseup '
                        var s = types.search(t)
                        if (s >= 0) types = types.replace(t, '')
                    }
                    this.events[i][0] = types
                    return
                }
            }
        },
        
        // "one" event needs some thought to deal with keyboard input properly, the problem being
        //    that with "bind" this.__expecting_key stays valid until "unbind", and
        //    with "waitfor" the processing of a keypress can set this.__expecting_key = false,
        //    but with "one" there's no obvious place to set this.__expecting_key = false.
        //one: function( eventTypes, callback ) { return this.events.one( eventTypes, callback ) },
        
        trigger: async function( type, evarg ) {
            var ev = {type:type, event:evarg} // ev may be undefined for custom events
        	if (type == "mouse") {
        		// Send to user program minimal event data; may be expanded in the future
        		var ev = {type:evarg.type, pageX:evarg.pageX, pageY:evarg.pageY, which:1}
        		this.mouse.__update(ev)
	            ev.event = ev.type
	            ev.pos = this.mouse.pos
	            if (ev.type == 'mousedown') {
	                ev.press = 'left'
	                ev.release = null
	            } else if (ev.type == "mousemove") {
		            ev.press = null
		            ev.release = null
	            } else if (ev.type == "mouseup") {
	                ev.press = null
	                ev.release = 'left'
	            } else if (ev.type == "mouseenter" || ev.type == "mouseleave") {
	                ev.press = null
	                ev.release = null
	            } else if (ev.type == "click") {
	                ev.press = null
	                ev.release = 'left'
                }
            } else if (type.slice(0,3) == 'key') {
                ev = {type:type, event:type, which:evarg.which}
                ev.key = evarg.key
                ev.alt = evarg.alt
                ev.ctrl = evarg.ctrl
                ev.shift = evarg.shift
            }
            if (evarg !== null) {
                this.__triggered = ev
                ev.canvas = this // evarg is null for scene.waitfor('textures')
                if (ev.type === undefined) return
            }
            for (var i=0; i<this.events.length; i++) {
                // this.events element is ['mousedown mouseup etc.', bound function]
                // if event is 'textures', ev.type is null
                if (ev.type === null || this.events[i][0].indexOf(ev.type) >= 0) {
                    let bf = this.events[i][1]
                    try {
                        await bf(ev) // call the bound function
                    } catch(err) {
                        window.__reportScriptError(err) // give detailed feedback on the error in the bound function
                    }
                }
            }
            if (ev.type == "mousemove") this.__mouse_move = null
        },

        // The following note seems obsolete:
        //    Using attributeVector here ensures that there is an error if a program tries to modify e.g. scene.center.x
        //    (rather than changing the prototype).  immutableVector would be better, or just copying these in the constructor
        background: new vec(0,0,0),
        opacity: 1,
        ambient: new vec(0.2,0.2,0.2),

        __change: function() {  // Called when attributeVectors are changed, axis/center/up
            if (this.__lastevent !== null && this.hasmouse) this.mouse.__update(this.__lastevent)
            if (this.__overlay_objects) this.__overlay_objects.__changed = true
        },
        
        // Changes to center/axis/up call this.__change():
        center: new attributeVector(null,0,0,0),
        axis: new attributeVector(null,0,0,-1), // could be attributeVectorAxis; see "forward"
        up: new attributeVector(null,0,1,0),    // could be attributeVectorUp; see "forward"

        forward: { // For backward compatibility, forward is now a synonym for axis.
            // As of May 2019, the fundamental underlying entity is canvas.axis,
            //   with canvas.forward a synonym of canvas.axis. The intent was to
            //   force scene.axis and scene.up always to be perpendicular to each
            //   other, as is the case with the 3D primitives, by making them be
            //   attributeVectorAxis and attributeVectorUp. However, this forcing
            //   made some 2.7 programs display differently, thereby requiring
            //   an upgrade to version 2.8 to preserve the behavior of existing 2.7
            //   programs. The different nature of the camera machinery implied that
            //   the possible minor gain from forcing perpendicularity seemed outweighed
            //   by the annoyance of moving to 2.8. Lack of perpendicularity had been
            //   a problem with the 3D primitives but not with the camera issues.
            get: function() {return this.__axis},
            set: function(value) {
                this.axis = value
            }
        },

        __last_axis: null,  // referenced by render()
        __last_center: null,
        __activated: false,
        userzoom: true,
        userspin: true,
        userpan: true,
        fov: 60*Math.PI/180,
        
        width: { value: 640, onchanged: function() { 
            this.__canvas_element.width = this.__canvas_element.style.width = 
            	this.__overlay_element.width = this.__overlay_element.style.width = this.__width
            //this.wrapper.width(this.__width + this.__drag_handle.width())
        } },
        height: { value: 400, onchanged: function() { 
        	this.__canvas_element.height = this.__canvas_element.style.height = this.__overlay_element.height = 
        		this.__overlay_element.style.height = this.wrapper[0].style.height = this.__height
            //this.__canvas_element.height = this.__canvas_element.style.height = this.__overlay_element.height = this.__overlay_element.style.height = this.__drag_handle[0].style.height = this.wrapper[0].style.height = this.__height
        } },
        align: {
        	get: function() { return this.__align },
        	set: function(value) {
        		if (value == 'left' || value == 'right' || value == 'none') {
        			this.__align = value
        			//$(this.wrapper).css("float", value)
        			//window.print_anchor.css({float:value})
        	        //this.__title_anchor = $("<div/>") // title anchor point
        	        //this.__caption_anchor = $("<div/>") // caption anchor point
        			//this.__title_anchor.css("float", value)
        			//this.__caption_anchor.css("float", value)
        		} else throw new Error("align must be 'left', 'right', or 'none' (the default).")
        	}
        },
        /*
        draggable: {
            value: false,
            onchanged: function() {
                if (this.__activated) {
                    $(this.wrapper).draggable((this.draggable?"en":"dis")+"able");
                    this.__drag_handle.width(this.draggable?10:0);
                    this.width = this.__width;
                }
            }
        },
        */
        resizable: {
            value: true,
            onchanged: function() {
                if (this.__activated) {
                    this.wrapper.resizable((this.resizable?"en":"dis")+"able")
                }
            }
        },

        //autocenter: { value: false, onchanged: function(oldVal) { if (oldVal && !this.autocenter) Autoscale.compute_autocenter(this) } },

        autoscale: {
            get: function() { return this.__autoscale },
            set: function(value) {
                // If turning off autoscaling, update range to reflect the current size of the scene
                if (this.__autoscale && !value) Autoscale.compute_autoscale(this)
                this.__autoscale = value
            }
        },

        range: {
            get: function() {
                if (this.__autoscale) { // need to perform autoscale to update range
                    Autoscale.compute_autoscale(this)
                }
                return this.__range 
            },
            set: function(value) {
                this.__autoscale = false // no autoscaling if range set explicitly
                this.__range = value
                if (this.__lastevent !== null) this.mouse.__update(this.__lastevent)
            }
        },

        pixel_to_world: {
            get: function() {
                // Convert number of pixels into distance in real-world coordinates
                var w = this.__width
                var h = this.__height
                var d = 2*this.range
                if (w >= h) {
                    return d/h
                } else {
                    return d/w
                }
            },
            set: function(value) {
                throw new Error("Cannot assign a value to pixel_to_world.")
            }
        },
        
        objects: {
            get: function() {
                var all = []
                for(var id in this.__visiblePrimitives) {
                  var v = this.__visiblePrimitives[id]
                  if (v.__obj) { // arrow has 2 components; return the parent for just one, if parent visible
                	  if (v == v.__obj.__components[0] && v.__obj.visible) all.push(v.__obj)
                  } else all.push(v)
                }
                for(var id in this.__overlay_objects.objects) {
                    var obj = this.__overlay_objects.objects[id]
                    if (obj instanceof label) all.push(obj)
                }
                return all
            }
        }
    })

    // Static properties (canvas.*, rather than canvas().*)
    property.declare( canvas, {
        selected: { 
            get: function() { return window.__context.canvas_selected || null },
            set: function(value) { window.__context.canvas_selected = value }
        },
        get_selected: function() { return window.__context.canvas_selected || null }, // used in classic VPython
        
        all: {
            get: function() { 
                var v = window.__context.canvas_all
                if (v === undefined) v = window.__context.canvas_all = []
                return v
            }
        },
        container: { 
            get: function() { return window.__context.glowscript_container || null },
            set: function(value) { window.__context.glowscript_container = $(value) }
        },
    })

    // TODO: All the dependencies on camera and canvas internals
    function Mouse(canvas) {
        this.canvas = canvas
    }
    

    property.declare(Mouse.prototype, {
        canvas: null,
        pos: null,
        ray: null,
        __pickx: null,
        __picky: null,
        pick: function () {
            return this.canvas.__renderer.render(1) // render in hidden canvas to do GPU picking
        },
        project: function (args) {
            if (args.normal === undefined) throw new Error("scene.mouse.project() must specify a normal")
            var normal = args.normal
            var dist
            if (args.d === undefined && args.point === undefined) dist = normal.dot(this.canvas.__center)
            else if (args.d !== undefined) {
                dist = args.d
            } else if (args.point !== undefined) {
                dist = normal.dot(args.point)
            }
            var ndc = normal.dot(this.canvas.camera.pos) - dist
            var ndr = normal.dot(this.ray)
            if (ndr == 0) return null
            var t = -ndc / ndr
            return this.canvas.camera.pos.add(this.ray.multiply(t))
        },
        alt: false,
        ctrl: false,
        shift: false,
        __update: function (ev) {
            var cv = this.canvas, factor
            if (cv.__width > cv.__height) factor = 2 * cv.__range / cv.__height // real coord per pixel
            else  factor = 2 * cv.__range / cv.__width
            // mx,my in plane perpendicular to canvas.axis:
            var o = $(cv.__canvas_element).offset()
            this.__pickx = ev.pageX - o.left
            this.__picky = cv.__height - (ev.pageY - o.top)
            var mx = (this.__pickx - cv.__width / 2) * factor
            var my = (this.__picky - cv.__height / 2) * factor
            var xaxis = cv.__axis.norm().cross(cv.__up).norm()
            var yaxis = xaxis.cross(cv.__axis.norm()) // this is normalized by construction
            this.pos = cv.__center.add(xaxis.multiply(mx).add(yaxis.multiply(my)))
            this.ray = this.pos.sub(cv.camera.pos).norm()
            canvas.hasmouse = cv
            cv.__lastevent = ev // for use in case of changes to range/axis/center/up
        }
    })

    var exports = { canvas: canvas, keysdown: keysdown }
    Export(exports)
})()
