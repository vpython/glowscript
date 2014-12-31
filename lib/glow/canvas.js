;(function () {
    "use strict";
    
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

    function canvas(options) {
        if (!(this instanceof canvas)) return new canvas(options)
        if (!options) options = {}

        canvas.all.push(this)
        canvas.selected = this

        for(var id in options) this[id] = options[id]

        // Lots of canvas's members are mutable objects, so they can't just be defined on canvas.prototype.
        this.events = $("<div/>")
        this.wrapper = $("<div/>")
        this.title = $("<div/>")
        this.menu = $("<div/>")
        this.caption = $("<div/>")
        this.__canvas_element = document.createElement('canvas')
        this.__overlay_element = document.createElement('canvas')
        this.elements = $([this.__canvas_element, this.__overlay_element])
        this.__overlay_objects = { objects: [], __changed: false }
        this.__visiblePrimitives = {}
        this.lights = [
            { direction: vec(0.21821789, 0.4364357, 0.8728715), color: vec(.8, .8, .8) },
            { direction: vec(-0.872872, -0.218218, -0.436436), color: vec(.3, .3, .3) },
        ]
        this.trails = [] // from attach_trail
        this.arrows = [] // from attach_arrow
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
            index: new Uint16Array(N), // not actually used
            model_transparent: false, // not actually used
            object_info:{} // vertex_object:[list of triangles/quads using this vertex]
        }
        // Sort triangles/quads into renderable categories. For example, an entry in opaque:textures
        // has the form texture_name:[indices of all the opaque triangles that share this texture].
        // In the case of plain, there's only one entry -- all:[indices...].
        // In lists of indices, quads are represented as 6 indices, already reduced to two triangles.
        this.__sort_objects = { 
            opaque: { plain:{}, textures:{}, bumpmaps:{}, textures_and_bumpmaps:{} },
            transparent: { plain:{}, textures:{}, bumpmaps:{}, textures_and_bumpmaps:{} }
        }
        this.camera = orbital_camera(this)
        this.mouse = new Mouse(this)
        this.__range = 10
        this.__autoscale = true
        this.textures = {} // index loaded textures by file name; data is image
        this.textures_requested = {} // index requested textures by file name; data is list of requesting objects
        this.__changed = {}
        this.__vertex_changed = {}
        this.visible = true
        this.waitfor_textures = false
        this.__lastcenter = vec(0,0,0)
        this.__delayed_event = 'dog'
    }
    property.declare( canvas.prototype, {
        __activate: function () {
            this.__activated = true
            this.__activate = function(){}

            var container = canvas.container
            this.title.css("white-space","pre").appendTo( container )
            this.menu.css("white-space","pre").appendTo( container )
            this.wrapper.addClass("glowscript-canvas-wrapper").appendTo( container )
            this.caption.css("white-space","pre").appendTo( container )
            this.wrapper.css("position", "relative")  // flows with page, but can have absolute positioning inside
            // this.wrapper.css("display", "inline-block")

            // TODO: Use jquery for this, too?
            var cv = this.__canvas_element
            cv.style.position = "absolute"  // removed from flow inside wrapper, so overlay will be positioned at the same spot
            
            var overlay = this.__overlay_element
            overlay.style.position = "relative"  // not removed from flow, so wrapper will be the right size
            overlay.style.backgroundColor = "transparent"

            this.__canvas_element.setAttribute('width', this.width)
            this.__overlay_element.setAttribute('width', this.width)
            this.__canvas_element.setAttribute('height', this.height)
            this.__overlay_element.setAttribute('height', this.height)
            this.wrapper.append(cv)
            this.wrapper.append(overlay)

            $(this.wrapper).resizable()
            $(this.wrapper).on("resize", {this: this},
                function( event, ui ) {
                    event.data.this.width=ui.size.width
                    event.data.this.height=ui.size.height
                }
            )
            if (!this.resizable) $(this.wrapper).resizable("disable")
                        
            this.__renderer = new WebGLRenderer( this, cv, overlay )
            if (this.camera.__activate) this.camera.__activate()
            this.__handleEvents()
        },

        __change_size: function() {
            if (this.__activated) {
                this.__canvas_element.style.width = Math.floor(this.width).toString()+"px"
                this.__overlay_element.style.width = Math.floor(this.width).toString()+"px"
                this.__canvas_element.style.height = Math.floor(this.height).toString()+"px"
                this.__overlay_element.style.height = Math.floor(this.height).toString()+"px"
            }
        },

        __handleEvents: function() {
            // Clean up and forward various events for the use of scripts
            // The camera does its own event handling elsewhere, but we test if it
            //   has locked the mouse so that camera control gestures are invisible to scripts.
            var canvas = this
            var elements = canvas.elements
            var scriptMouseDown = false
            elements.bind("click", function(ev) {
                canvas.mouse.__update(ev)
                ev.event = ev.type
                ev.pos = canvas.mouse.pos
                ev.pick = canvas.mouse.pick
                ev.press = null
                ev.release = 'left'
                if (ev.which == 1 && !canvas.camera.mouse_locked) canvas.trigger("click", ev)
            })
            elements.bind("mousedown", function (ev) {
                if (ev.which == 1 && !canvas.camera.mouse_locked) {
                    scriptMouseDown = true
                    canvas.__lastpixelx = ev.pageX
                    canvas.__lastpixely = ev.pageY
                    canvas.mouse.__update(ev)
                    ev.event = ev.type
                    ev.pos = canvas.mouse.pos
                    ev.pick = canvas.mouse.pick
                    ev.press = 'left'
                    ev.release = null
                    canvas.trigger("mousedown", ev)
                }
                ev.preventDefault()
                ev.stopPropagation()
                return false;
            })
            elements.bind("mouseenter mouseleave", function(ev) {
            	canvas.mouse.__update(ev)
                ev.event = ev.type
                ev.pos = canvas.mouse.pos
                ev.pick = canvas.mouse.pick
                ev.press = null
                ev.release = null
            	canvas.trigger(ev.type, ev) 
            })
            $(document).bind("mousemove",function (ev) {
                canvas.mouse.__update(ev)
                ev.event = ev.type
                ev.pos = canvas.mouse.pos
                ev.pick = canvas.mouse.pick
                ev.press = null
                ev.release = null
                canvas.trigger("mousemove", ev)
            })
            $(document).bind("mouseup", function (ev) {
                canvas.mouse.__update(ev)
                ev.event = ev.type
                ev.pos = canvas.mouse.pos
                ev.pick = canvas.mouse.pick
                ev.press = null
                ev.release = 'left'
                if (ev.which == 1 && scriptMouseDown) {
                    scriptMouseDown = false
                    canvas.trigger("mouseup", ev)
                }
            })
            var keys = { shift:16, ctrl:17, alt:18 }
            // Mac cmd key is 91 on MacBook Pro but apparently may be different on other Macs.
            $(document).bind("keydown keyup keypress", function (ev) {
            	ev.event = ev.type
                for (var k in keys) {
                    if (keys[k] == ev.which) {
                        canvas.mouse[k] = (ev.type == "keydown")
                        break
                    }
                }
            	if (ev.which == 20 && ev.type == "keydown") shiftlock = !shiftlock
            	ev.key = _unshifted[ev.which]
            	if (k.length == 1 && (canvas.mouse.shift || (shiftlock && (65 <= ev.which && ev.which <= 90)))) ev.key = _shifted[ev.which]
            	ev.shift = (canvas.mouse.shift || shiftlock)
            	ev.alt = canvas.mouse.alt
            	ev.ctrl = canvas.mouse.ctrl
            	if (!canvas.mouse.ctrl && (ev.which != 20)) canvas.trigger(ev.type, ev) // permit copying from page
            })
        },

        __change: function() {  // Called when attributeVectors are changed
            if (!this.__lastcenter.equals(this.__center) && this.mouse.pos) {
                // This update corrects for a change in canvas.center, which affects canvas.mouse.pos and ray.
                this.mouse.pos = this.mouse.pos.sub(this.__lastcenter).add(this.__center)
                this.mouse.ray = this.mouse.pos.sub(this.camera.pos).norm()
                this.__lastcenter = this.__center
            }
        },
        
        // Event handling functions, which just forward to this.events
        waitfor: function( eventTypes, callback ) {
            if (eventTypes == 'textures') this.waitfor_textures = true
            return this.events.waitfor(eventTypes, callback) 
        },
        pause: function( prompt_phrase, callback ) {
            if (arguments.length > 1) {
                if (this.__prompt == undefined) {
                    this.__prompt = label({
                        align:'right', pixel_pos:true, height:14, 
                        color:color.black, background:color.white, opacity:1, box:false
                    })
                }
                this.__prompt.pos = vec(this.__width,this.__height-12,0)
                this.__prompt.text = prompt_phrase
                this.__prompt.visible = true
                this.events.pause(this.__prompt, callback)
            } else {
                if (this.__draw == undefined) this.__draw = draw()
                var x = this.width-5, y = this.height-20
                this.__draw.points = [vec(x,y,0), vec(x-30,y-13,0), vec(x-30,y+15,0), vec(x,y,0)]
                this.__draw.opacity = 1
                this.__draw.color = color.black
                this.__draw.fillcolor = color.white
                this.__draw.visible = true
                this.events.pause(this.__draw, prompt_phrase) // only one argument passed to pause
            }
        },
        bind: function( eventTypes, callback ) { return this.events.bind( eventTypes, callback ) },
        unbind: function( eventTypes, callback ) { return this.events.unbind( eventTypes, callback ) },
        one: function( eventTypes, callback ) { return this.events.one( eventTypes, callback ) },
        trigger: function( type, data ) {
            var ev = new $.Event( type, data )
            this.events.trigger(ev)
            ev.stopPropagation()
            ev.preventDefault()
        },

        // Using attributeVector here ensures that there is an error if a program tries to modify e.g. scene.center.x
        // (rather than changing the prototype).  immutableVector would be better, or just copying these in the constructor
        background: new attributeVector(null,0,0,0),
        ambient: new attributeVector(null,0.2, 0.2, 0.2),
        center: new attributeVector(null,0,0,0),
        forward: new attributeVector(null,0,0,-1),
        up: new attributeVector(null,0,1,0),

        __last_forward: null,
        __activated: false,
        userzoom: true,
        userspin: true,
        fov: 60*Math.PI/180,
        
        width: { value: 640, onchanged: function() { this.__change_size() } },
        height: { value: 400, onchanged: function() { this.__change_size() } },
        resizable: {
            value: false,
            onchanged: function() {
                if (this.__activated) {
                    $(this.wrapper).resizable((this.resizable?"en":"dis")+"able")
                    
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
                for(var id in this.__visiblePrimitives)
                  all.push(this.__visiblePrimitives[id])
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
            if (args.normal === undefined) throw new Error("scene.mouse.project() must specify a normal in {normal:..}")
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
            var canvas = this.canvas, factor
            if (canvas.__width > canvas.__height) factor = 2 * canvas.__range / canvas.__height // real coord per pixel
            else  factor = 2 * canvas.__range / canvas.__width
            // mx,my in plane perpendicular to canvas.forward:
            var o = $(canvas.__canvas_element).offset()
            this.__pickx = ev.pageX - o.left
            this.__picky = canvas.__height - (ev.pageY - o.top)
            var mx = (this.__pickx - canvas.__width / 2) * factor
            var my = (this.__picky - canvas.__height / 2) * factor
            var xaxis = canvas.__forward.norm().cross(canvas.__up).norm()
            var yaxis = xaxis.cross(canvas.__forward.norm()) // this is normalized by construction
            this.pos = canvas.__center.add(xaxis.multiply(mx).add(yaxis.multiply(my)))
            this.ray = this.pos.sub(canvas.camera.pos).norm()
        }
    })

    var exports = { canvas: canvas }
    Export(exports)
})()