; (function () {
	
	window.__adjustupaxis = true // default is for changes to up/axis to adjust axis/up, except in object.rotate

    function subclass(sub, base) {
        sub.prototype = new base({ visible: false, canvas: null })
        sub.prototype.constructor = sub
    }
    
    function id_to_falsecolor(N) { // convert integer object id to floating RGBA for pick operations
        var R=0, G=0, B=0
        if (N >= 16777216) {
            R = Math.floor(N/16777216)
            N -= R*16777216
        }
        if (N >= 65536) {
            G = Math.floor(N/65536)
            N -= G*65536
        }
        if (N >= 256) {
            B = Math.floor(N/256)
            N -= B*256
        }
        return [R/255, G/255, B/255, N/255]
    }
    
    /*
    function RSdict_to_JSobjectliteral(args) { // create from a VPython dictionary a JavaScript object literal
		if (args.jsmap !== undefined) {
			var temp = {}
			for (var [key,value] of args.jsmap) temp[key] = value
			return temp
		} else return args
    }
    */
    
    function RSdict_to_JSobjectliteral(args) { // found that VPython dictionaries cause huge slowdown in all array or object literal calculations
    	return args
    }

    // Factored because there are way too many things that add themselves to canvas in different ways
    // TODO: Make them all subclasses of VisualObject or something and give them a uniform way of tracking themselves!
    // TODO: Prohibit or handle changing primitive.canvas (need to update model even if it is invisible)
    function init(obj, args) {
    	if (obj.constructor == text) return
        if (window.__GSlang == 'vpython' && args.display !== undefined) {
    		args.canvas = args.display
    		delete args.display
    	}
        if (args.canvas !== undefined) {
            obj.canvas = args.canvas
            delete args.canvas
        } else {
            obj.canvas = canvas.selected
        }
        if (obj.canvas) {
        	if (!(obj.constructor == distant_light || obj.constructor == local_light)) obj.canvas.__activate()
            obj.__model = obj.__get_model()
        }
        if (args.__obj) { // indicates an object that is a component, such as arrow
        	obj.__obj = args.__obj
        	delete args.__obj
        }
        if (args.radius !== undefined) {
        	obj.radius = args.radius
        	delete args.radius
        }
        if (args.size_units !== undefined) {
        	obj.size_units = args.size_units
        	delete args.size_units
        }
        // treat axis before size or length or height or width to match classic
		// VPython constructor API
        if (args.axis !== undefined) {
        	// Ensure that if axis is <0,0,0> in constructor, we'll recover eventually
        	if (args.axis.mag2 === 0) obj.__oldaxis = vec(1,0,0)
        	obj.axis = args.axis
        	delete args.axis
        }
        if (args.size !== undefined) {
        	obj.size = args.size // text object has no size attribute and will give an error
        	delete args.size
        }
        // When cloning, args.up is undefined, to avoid possible improper altering of axis
        if (args.up !== undefined) {
        	// Ensure that if up is <0,0,0> in constructor, we'll recover eventually
        	if (args.up.mag2 === 0) obj.__oldup = vec(0,1,0)
        	obj.up = args.up
        	delete args.up
        }
        if (args.color !== undefined) {
        	obj.color = args.color
        	delete args.color
        }

        // Mimic classic VPython (though GlowScript attach_trail is more powerful)
        obj.__interval = -1 // indicate no interval setting; add point every render (or determined by pps)
        if (obj.constructor != curve && obj.constructor != points && args.make_trail !== undefined) {
        	obj.__make_trail = args.make_trail
        	delete args.make_trail
	    	obj.__trail_type = 'curve'
        	if (args.trail_type !== undefined) {
        		if (args.trail_type != 'curve' && args.trail_type != 'points' && args.trail_type != 'spheres')
        			throw new Error ("trail_type = "+args.trail_type+" but must be 'curve' or 'points' (or 'spheres').")	        		
        		obj.__trail_type = args.trail_type
        		delete args.trail_type
        	}
        	if (args.interval !== undefined) {
        		obj.__interval = args.interval
        		delete args.interval
        	} else if (obj.__trail_type != 'curve') {
        		obj.__interval = 1 // a points object MUST have interval set, to display evenly, not just at every render
        	}
        	if (args.retain !== undefined) {
        		obj.__retain = args.retain
        		delete args.retain
        	} else obj.__retain = -1 // signal retain not set
        	obj.__trail_color = color.white
        	if (obj.color !== undefined) obj.__trail_color = obj.color
        	if (args.trail_color !== undefined) {
        		obj.__trail_color = args.trail_color
        		delete args.trail_color
        	}
        	obj.__trail_radius = 0 //0.1*obj.__size.y // the default for attach_trail
        	if (args.trail_radius !== undefined) {
        		obj.__trail_radius = args.trail_radius
        		delete args.trail_radius
        	} else {
        		if (obj.__trail_type == 'points') obj.__trail_radius = 0.1*obj.__size.y
        	}
        	obj.__pps = 0
        	if (args.pps !== undefined) {
        		if (obj.__interval > 0) {
        			if (obj.__trail_type != 'curve')
        				throw new Error('pps cannot be used with a '+obj.__trail_type+'-type trail')
        			else
        				throw new Error('pps cannot be used with interval > 0')
        		}
        		obj.__pps = args.pps
        		delete args.pps
        	}

        	obj.__trail_object = attach_trail(obj, {type:obj.__trail_type, color:obj.__trail_color, 
				radius:obj.__trail_radius, pps:obj.__pps, retain:obj.__retain})
	    	if (args.pos !== undefined && obj.__make_trail) obj.__trail_object.__trail.push(args.pos) // Make sure the trail starts from initial position
	    	if (!obj.__make_trail) obj.__trail_object.stop()
	    	obj.__ninterval = 0
        }

        // if _pos_set false, attach_trail will not add an existing pos value; _pos_set is set when explicitly setting pos
		obj._pos_set = (args.pos !== undefined)

        for (var id in args) obj[id] = args[id]

        // We have to set visible unless args has visible set, or canvas is null (initial subclass setup)
        if (args.visible === undefined && obj.canvas !== null) obj.visible = true
    }

    function initObject(obj, constructor, args) {
        if (!(obj instanceof constructor)) return new constructor(args)  // so box() is like new box()
        args = args || {}  // so box() is like box({})
        obj.__tex = {file: null, bumpmap: null, texture_ref: {reference: null}, bumpmap_ref: {reference: null}, 
				  left: false, right: false, sides: false, flipx: false, flipy: false, turn: 0, flags: 0 }

    	// We have to initialize ALL vector attributes here, because they need pointers back to "this"
        // which are constructed by vectors.js setting this.__parent
        if (constructor == curve) obj.origin = obj.origin
        if (constructor != curve && constructor != points && constructor != text) { obj.pos = obj.pos }
        if (constructor != points && constructor != text) { // text does its own initializations of attribute vectors
        	if (constructor == arrow) {
        		if (args.axis !== undefined) throw new Error("arrow does not have axis; replace with axis_and_length")
        		else obj.axis_and_length = obj.axis_and_length
        	} else if (constructor == vp_arrow && args.axis_and_length !== undefined) {
        		throw new Error("VPython arrow does not have axis_and_length; replace with axis")
        	} else obj.axis = obj.axis
	        obj.up = obj.up
	        obj.size = obj.size
	        obj.color = obj.color
        }
        obj.__sizing = false // if true, setting axis affects size, and vice versa
        // text uses compound, and obj.__sizing should be false for text
        if ((window.__GSlang == 'vpython') && 
        		!(constructor == vp_sphere || constructor == vp_ring || constructor == text || 
        				constructor == vp_compound || constructor == compound)) obj.__sizing = true
        if (args.opacity === undefined) obj.__opacity = 1
        if (args.make_trail === undefined) obj.__make_trail = false
        
        obj.__opacity_change = true
    	init(obj, args)
    }

    // For now, ids are ever-increasing. Perhaps change this to keep a compact list
    // of indices, or lists of different primitive types if that is convenient to the renderer
    var nextVisibleId = 1
    
    // ":" is illegal in a filename on Windows and Mac, though it is legal on Linux
    var textures = { flower: ":flower_texture.jpg", granite: ":granite_texture.jpg", gravel: ":gravel_texture.jpg",
    				 earth: ":earth_texture.jpg",
    			     metal: ":metal_texture.jpg", rock: ":rock_texture.jpg", rough: ":rough_texture.jpg", 
    			     rug: ":rug_texture.jpg", stones: ":stones_texture.jpg", stucco: ":stucco_texture.jpg", 
    			     wood: ":wood_texture.jpg", wood_old: ":wood_old_texture.jpg"}
    var bumpmaps = { gravel: ":gravel_bumpmap.jpg", rock: ":rock_bumpmap.jpg", stones: ":stones_bumpmap.jpg", 
    				 stucco: ":stucco_bumpmap.jpg", wood_old: ":wood_old_bumpmap.jpg"}
    
    function setup_texture(name, obj, isbump) {
    	if (name.slice(0,1) == ':') {
    		var jv = window.Jupyter_VPython
    		if (jv !== undefined) { // location in Jupyter VPython of texture files: "/nbextensions/vpython_data/"
    			name = jv+name.slice(1)
    		} else {
    		if (navigator.onLine) name = "https://s3.amazonaws.com/glowscript/textures/"+name.slice(1)
    		else name = "../lib/FilesInAWS/"+name.slice(1)
    		}
    	}
    	obj.canvas.__renderer.initTexture(name, obj, isbump)
    }
    
    function Primitive() {}
    // The declare function in file property.js creates attributes such as pos as __pos
    property.declare( Primitive.prototype, {
        __id: null,
        __hasPosAtCenter: false,
        __deleted: false,

        __zx_camera: null, __zy_camera: null, 
        __xmin:null, __ymin: null, __zmin: null,
        __xmax: null, __ymax: null, __zmax: null, 

        pos:   new attributeVectorPos(null, 0,0,0),
        size:  new attributeVector(null, 1,1,1),     // for JavaScript and RapydScript, no connection to size
        axis:  new attributeVectorAxis(null, 1,0,0), // for VPython, size and axis are linked
        up:    new attributeVectorUp(null, 0,1,0),   // for all languages, axis and up linked (maintained orthogonal)
        color: new attributeVector(null, 1,1,1),
        opacity: {
        	get: function() { return this.__opacity },
        	set: function(value) {
        		if (value == this.__opacity) return
        		if ( (this.__opacity < 1 && value  == 1) || (this.__opacity == 1 && value  < 1) ) {
            		this.__opacity_change = true
                }
        		this.__opacity = value
        		this.__change()
        	}
        },
        x: {
        	get: function() {      throw new Error('"object.x" is not supported; perhaps you meant "object.pos.x"') },
        	set: function(value) { throw new Error('"object.x" is not supported; perhaps you meant "object.pos.x"') }
        },
        y: {
        	get: function() {      throw new Error('"object.y" is not supported; perhaps you meant "object.pos.y"') },
        	set: function(value) { throw new Error('"object.y" is not supported; perhaps you meant "object.pos.y"') }
        },
        z: {
        	get: function() {      throw new Error('"object.z" is not supported; perhaps you meant "object.pos.z"') },
        	set: function(value) { throw new Error('"object.z" is not supported; perhaps you meant "object.pos.z"') }
        },
    	__opacity_change: false, // not really used yet: intended to help categorize into opaque/transparent objects
    	__prev_opacity: null,
        shininess: { value: 0.6, onchanged: function() { this.__change() } },
        emissive: { value: false, onchanged: function() { this.__change() } },
        pickable: { value: true, onchanged: function() { this.__change() } },
        ready: { get: function() { return (this.__tex.file === null || this.__tex.texture_ref.reference !== null &&
        		                        this.__tex.bumpmap === null || this.__tex.bumpmap_ref.reference !== null) } },
        		                        
	    make_trail: {
	    	get: function() { return this.__make_trail },
	    	set: function(value) {
	    		if (this.__make_trail !== value) {
	    			if (value) {
	    				this.__trail_object.start()
	    				this.__trail_object.__trail.push(this.__pos) // make sure the newly started trail starts here
	    			} else this.__trail_object.stop()
	    			this.__make_trail = value
	    		}
	    	}
	    },
	    retain: { // -1 means don't retain
	    	get: function() { return this.__retain },
	    	set: function(value) { 
	    		this.__retain = value
	    		if (this.__trail_object !== undefined) this.__trail_object.retain = value
	    	}
	    },
	    trail_type: {
	    	get: function() {
	    		if (this.__trail_type == 'curve') return 'curve'
	    		else if (this.__trail_type == 'spheres') return 'points'
	    		else return this.__trail_type
	    		},
	    	set: function(value) {throw new Error('"trail_type" cannot be changed.') }
	    },
	    trail_color: {
	    	get: function() { return this.__color },
	    	set: function(value)  {
	    		this.__trail_color = value
	    		if (this.__trail_object !== undefined) this.__trail_object.color = value
	    	}
	    },
	    trail_radius: {
	    	get: function() { return this.__radius },
	    	set: function(value)  {
	    		this.__trail_radius = value
	    		if (this.__trail_object !== undefined) this.__trail_object.radius = value
	    	}
	    },
	    pps: {
	    	get: function() { return this.__pps },
	    	set: function(value) {
	    		this.__pps = value
	    		if (this.__trail_object !== undefined) this.__trail_object.pps = value
	    	}
	    },
	    clear_trail: function() {
	    	if (this.__trail_object !== undefined) this.__trail_object.clear()
	    },
	    __update_trail: function(v) { // This is called by the change of a pos vector in the vector class (vectors.js)
	    	if (!this.__trail_object.__run || !this.visible) return // don't add points if attach_trail has been stopped, or object invisible
	    	if (this.__interval === -1) return
	    	this.__ninterval++
	    	var update = false
	    	if (this.__ninterval >= this.__interval) {
	    		this.__ninterval = 0
	    		update = true
	    	} else if (this.__ninterval == 1 && this.__trail_object.__trail.__points.length === 0) update = true // always add the first point
	    	if (update) {
				if (this.__retain == -1) this.__trail_object.__trail.push({pos:v, color:this.__trail_color, radius:this.__trail_radius})
				else this.__trail_object.__trail.push({pos:v, color:this.__trail_color, radius:this.__trail_radius, retain:this.__retain})
	    	}
	    },
	    
        texture: {
            get: function() {
                return {file: this.__tex.file, bumpmap: this.__tex.bumpmap, 
                	left: this.__tex.left, right: this.__tex.right, sides: this.__tex.sides, 
  				    flipx: this.__tex.flipx, flipy: this.__tex.flipy, turn: this.__tex.turn }
            },
            set: function(args) { // file name, or { file: f, place: option or [option1, option2], bumpmap: f }
            	this.__tex = {file: null, bumpmap: null, texture_ref: {reference: null}, bumpmap_ref: {reference: null}, 
            				  left: false, right: false, sides: false, flipx: false, flipy: false, turn: 0, flags: 0 }
            	if (args === null) {
            		;
            	} else if (typeof args === 'string') {
            		this.__tex.left = this.__tex.right = this.__tex.sides = true
            		setup_texture(args, this, false)
            	} else {
            		args = RSdict_to_JSobjectliteral(args)
            		if (args.file !== undefined && typeof args.file === 'string') {
            			setup_texture(args.file, this, false)
            		} else throw new Error("You must specify a file name for a texture.")
            		if (args.bumpmap !== undefined) {
            			if (args.bumpmap !== null) {
            				if (typeof args.bumpmap !== 'string') throw new Error("You must specify a file name for a bumpmap.")
            				setup_texture(args.bumpmap, this, true)
            			}
            		}
            		if (args.flipx !== undefined) this.__tex.flipx = args.flipx
            		if (args.flipy !== undefined) this.__tex.flipy = args.flipy
            		if (args.turn !== undefined) this.__tex.turn = Math.round(args.turn)
            		if (args.place !== undefined) {
            			if (typeof args.place === 'string') args.place = [args.place]
            			for (var i=0; i<args.place.length; i++) {
            				switch (args.place[i]) {
            					case 'left': 
	            					this.__tex.left = true
	            					break
            					case 'right': 
	            					this.__tex.right = true
	            					break
            					case 'sides': 
	            					this.__tex.sides = true
	            					break
            					case 'ends': 
	            					this.__tex.left = this.__tex.right = true
	            					break
            					case 'all': 
            						this.__tex.left = this.__tex.right = this.__tex.sides = true
	            					break
            				}
            			}
            		} else this.__tex.left = this.__tex.right = this.__tex.sides = true
            	}
            	this.__tex.flags = 0
            	if (this.__tex.file !== null) this.__tex.flags += 1
            	if (this.__tex.bumpmap !== null) this.__tex.flags += 2
            	if (this.__tex.left) this.__tex.flags += 4
            	if (this.__tex.right) this.__tex.flags += 8
            	if (this.__tex.sides) this.__tex.flags += 16
            	if (this.__tex.flipx) this.__tex.flags += 32
            	if (this.__tex.flipy) this.__tex.flags += 64
            	var turns = this.__tex.turn % 4
            	if (turns < 0) turns += 4
            	this.__tex.flags += 128*turns
            	this.__change()
            }
        },
        visible: {
            get: function() {
            	//if (this.constructor == text) return this.__comp.__id != null
            	if (this.__obj) return this.__obj.__id != null // component objects are handled by their parent
            	else return this.__id != null 
            },
            set: function(value) {
            	if (this.__obj) return // component objects are handled by their parent
            	var obj = this
            	/*
                var textobj = null
                if (obj.constructor == text) {
                	textobj = obj.__id
                	obj = obj.__comp
                }
                */
                if (value == (obj.__id != null)) return // no change in visible status
                if (obj.__deleted) return // do not make visible a deleted object
                if (obj.__curve) obj.__curve.visible = value
                if (value) {
                    if (obj.constructor == vp_arrow || obj.constructor == arrow) {
                    	if (!obj.__components) obj.__update() // need to create the components (box and pyramid)
	                    obj.__id = nextVisibleId
                    	var fc
                    	nextVisibleId++
                        for (var i = 0; i < obj.__components.length; i++) {
                        	var c = obj.__components[i]
                        	c.__id = nextVisibleId
                        	if (i === 0) fc = id_to_falsecolor(nextVisibleId)
                        	c.__falsecolor = fc
                        	obj.canvas.__visiblePrimitives[nextVisibleId] = c
                        	obj.canvas.__changed[nextVisibleId] = c
    	                    nextVisibleId++
                        }
                    } else {
                    	obj.__id = nextVisibleId
                    	obj.__falsecolor = id_to_falsecolor(nextVisibleId)
	                    obj.canvas.__visiblePrimitives[nextVisibleId] = obj
	                    obj.canvas.__changed[nextVisibleId] = obj
	                    nextVisibleId++
	                    //if (textobj !== null) obj.canvas.__visiblePrimitives[textobj].__comp = obj
                    }
                    if (obj instanceof extrusion) {
                    	obj.__vis = value
                    }
                    /*
                    else if (this instanceof triangle || this instanceof quad) {
                    	var N = 3
                    	if (this instanceof quad) N = 4
                    	// mark vertices used by this triangle/quad, to support autoscaling when the vertex changes
                        for (var i=0; i<N; i++) {
                        	this.canvas.__vertices.object_info[ this.vs[i].__id ][this.__id] = this
                        }
                    }
                    */
                } else {
                    if (obj.constructor == vp_arrow || obj.constructor == arrow) {
                        for (var i = 0; i < obj.__components.length; i++) {
                        	var c = obj.__components[i]
                        	delete obj.canvas.__visiblePrimitives[c.__id]
                        	delete obj.canvas.__changed[c.__id]
                            if (c.__model) delete c.__model.id_object[c.__id]
                        }
                    } else {
                        delete obj.canvas.__visiblePrimitives[obj.__id]
                        delete obj.canvas.__changed[obj.__id]
                    	if (obj.__model) delete obj.__model.id_object[obj.__id]
                    }
                    if (obj instanceof extrusion) {
                    	obj.__vis = value
                    } 
                    /*
                    else if (this instanceof triangle || this instanceof quad) {
                    	var N = 3
                    	if (this instanceof quad) N = 4
                    	// mark vertices as not currently used by this triangle/quad
                        for (var i=0; i<N; i++) {
                        	delete this.canvas.__vertices.object_info[ this.vs[i].__id ][this.__id]
                        }
                    }
                    */
                    obj.__id = null
                }
            }},
        clone: function(args) { // cloning a primitive; cloning a compound is different
        	if (this instanceof triangle || this instanceof quad) throw new Error('Cannot clone a '+this.constructor.name+' object.')
        	args = args || {}
        	var ret
            var special = {up:vec(this.__up), color:vec(this.__color)}
        	if (!(this instanceof curve)) special.pos = vec(this.__pos)
        	if (!(this instanceof text)) special.size = vec(this.__size)
        	if (this.axis_and_length !== undefined) special.__axis_and_length = vec(this.__axis_and_length) // JavaScript arrow
            else special.__axis = vec(this.__axis)
    		if (this instanceof text) { // the text object is a wrapper around an extrusion, which is a compound
    			var comp = this.__comp.clone()
    		    var oldargs = {canvas:this.canvas, __text:this.text, __align:this.align,
    		    	    __height:this.height, __depth:this.depth, __comp:comp, __offset:this.__offset,
    		    	    __font:this.font, __billboard: this.billboard, __color:this.color,
    		    	    shininess:this.shininess, emissive:this.emissive, opacity:this.opacity,
    		        	__show_start_face:this.show_start_face, __show_end_face:this.show_end_face, 
    		        	__start_face_color:this.start_face_color, __end_face_color:this.end_face_color,
    		    	    __descender:this.descender, __lines:this.lines,
	        			visible:true, __pickable:this.__pickable}
        		ret = new text(oldargs)
        	} else if (this instanceof curve) {
        		special.__origin = vec(this.__origin)
    			var pos = []
    			for (var i=0; i<this.npoints; i++) pos.push(this.point(i).pos)
        		var oldargs = {pos:pos, __radius:this.__radius,
        				__shininess:this.__shininess, __emissive:this.__emissive, 
                		visible:true, __pickable:this.__pickable}
        		ret = new curve(oldargs)
        	} else if (this instanceof helix || this instanceof vp_helix) {
        		var oldargs = {__thickness:this.__thickness, __coils:this.__coils,
        				__shininess:this.__shininess, __emissive:this.__emissive, 
                		visible:true, __pickable:this.__pickable}
        		ret = new this.constructor(oldargs)
        	} else {
                var oldargs = {__opacity:this.__opacity, __tex:this.__tex,
                               __shininess:this.__shininess, __emissive:this.__emissive,
                               visible:true, __pickable:this.__pickable}
	        	if (this instanceof arrow || this instanceof vp_arrow) {
	        		oldargs.shaftwidth = this.__shaftwidth
	        		oldargs.headwidth = this.__headwidth
	        		oldargs.headlength = this.__headlength
	        	}
                ret = new this.constructor(oldargs)
        	}
        	// special and oldargs are in terms of __attr to avoid axis/up/size interconnections
            for (var attr in special) { // simply assigning a vec to ret{attr] kills its attribute vector status
            	ret[attr].__x = special[attr].x
            	ret[attr].__y = special[attr].y
            	ret[attr].__z = special[attr].z
            }
            for (var attr in args) ret[attr] = args[attr] // apply the args attributes to the clone
            ret.__update()
        	return ret
        },
        __change: function() { if (this.__id) this.canvas.__changed[this.__id] = this },
        __get_extent: function(ext) { Autoscale.find_extent(this, ext) },
        __get_model: function() { return this.canvas.__renderer.models[this.constructor.name] },
        __update: function() {
        	if (this.__id === null) return // This is the case of the arrow object; only its components use this update
        	var pos = this.__pos
            var size = this.__size
            var color = this.__color
            var axis = this.__axis
            var up = this.__up

            var data = this.__data
            if (!data) this.__data = data = new Float32Array(20)
            this.__model.id_object[this.__id] = this

        	data[0] = pos.__x; data[1] = pos.__y; data[2] = pos.__z
            data[3] = this.__shininess
            data[4] = axis.__x; data[5] = axis.__y; data[6] = axis.__z, data[7] = this.__emissive ? 1 : 0
            data[8] = up.__x; data[9] = up.__y; data[10] = up.__z
            data[11] = this.__tex.flags
            data[12] = size.__x; data[13] = size.__y; data[14] = size.__z
            data[16] = color.__x; data[17] = color.__y; data[18] = color.__z
            data[19] = this.__opacity
        },
        rotate: function (args) {
        	var obj = this
            var iscurve = (obj.constructor == curve)
        	var isarrow = (obj.constructor == arrow)
    		var origin = (iscurve) ? obj.origin : obj.pos
            if (args.origin !== undefined) origin = args.origin
            if (args === undefined || args.angle === undefined) { throw new Error("object.rotate() requires an angle.") }
            var angle = args.angle
            if (angle === 0) return
            var rotaxis
            if (args.axis === undefined) rotaxis = obj.__axis
            else rotaxis = args.axis
           
            if (iscurve) obj.origin = origin.add(obj.__origin.sub(origin).rotate({angle:angle, axis:rotaxis}))
            else if (!origin.equals(obj.pos)) obj.pos = origin.add(obj.__pos.sub(origin).rotate({angle:angle, axis:rotaxis}))
            
            // Normally it's important for axis to adjust up and up to adjust axis, to keep them orthogonal.
            // But when rotating an object, we must break this linkage and rotate both axis and up in the same way.
            // The global variable window.__adjustupaxis is normally true, but here we set it temporarilty to false.
            // The object axis and up attributes in vectors.js check this global variable.
            // (Another way to deal with this would be to set __axis and __up, and then call __update.)
            window.__adjustupaxis = false // unlink axis and up temporarily
            if (diff_angle(obj.__axis,rotaxis) > 1e-6) {
            	// change axis, which will also change up
	            if (isarrow) obj.axis_and_length = obj.axis_and_length.rotate({angle:angle, axis:rotaxis})
	            else obj.axis = obj.__axis.rotate({angle:angle, axis:rotaxis}) // maintain special character of VPython axis
            	obj.up = obj.__up.rotate({angle:angle, axis:rotaxis})
            } else {
            	obj.up = obj.__up.rotate({angle:angle, axis:rotaxis})
            }
            window.__adjustupaxis = true
        },
        getTransformedMesh: function() {
            var X = this.__axis.norm()
            var Y = this.__up.norm()
            var Z = X.cross(Y)
            var T = this.__pos
            if (this instanceof ring || this instanceof vp_ring) {
            	// Because a ring involves R1 and R2, we make a custom mesh and do our own scaling:
            	var m = Mesh.makeRing_compound(this.__size)
                var matrix = [X.x, X.y, X.z, 0, Y.x, Y.y, Y.z, 0, Z.x, Z.y, Z.z, 0, T.x, T.y, T.z, 1]
            	return m.transformed(matrix)
            } else {
                X = X.multiply(this.__size.x)
                Y = Y.multiply(this.__size.y)
                Z = Z.multiply(this.__size.z)
                var matrix = [X.x, X.y, X.z, 0, Y.x, Y.y, Y.z, 0, Z.x, Z.y, Z.z, 0, T.x, T.y, T.z, 1]
            	return this.__model.mesh.transformed(matrix);
            }
        }
    })

    function box(args) { return initObject(this, box, args) }
    subclass(box, Primitive)
    box.prototype.__hasPosAtCenter = true

    function cylinder(args) { return initObject(this, cylinder, args) }
    subclass(cylinder, Primitive)

    function cone(args) { return initObject(this, cone, args) }
    subclass(cone, cylinder)

    function pyramid(args) { return initObject(this, pyramid, args) }
    subclass(pyramid, box)

    function sphere(args) { return initObject(this, sphere, args) }
    subclass(sphere, Primitive)
    sphere.prototype.__hasPosAtCenter = true
    
    function simple_sphere(args) { return initObject(this, simple_sphere, args) }
	subclass(simple_sphere, Primitive)
	simple_sphere.prototype.__hasPosAtCenter = true
	property.declare( simple_sphere.prototype, {
		radius: {
			get: function() { return this.__radius },
			set: function(value) {
				this.__radius = value
				this.size = vec(2*value, 2*value, 2*value)
			}
		},
        __get_extent: function(ext) {
        	var save = this.__size
        	if (this.__parent && this.__parent.__pixels) { // this simple_sphere is part of a points object, which may be a trail
        		this.__size = vec(0,0,0) // approximation for autoscaling; assumes point size in pixels is small; actual size adjusted by renderer
        	}
        	Autoscale.find_extent(this, ext) 
        	this.__size = save // restore possibly altered size
        },
	})
    
    function vp_box(args) { return initObject(this, vp_box, args) }
    subclass(vp_box, box)
    property.declare( vp_box.prototype, {
        size: new attributeVectorSize(null, 1,1,1),
        length: {
        	get: function() { return this.__size.__x },
        	set: function(value) {
	    		this.axis = this.__axis.norm().multiply(value) // this will set length
        		this.__change()
        	}
        },
	    height: {
	    	get: function() { return this.__size.__y },
	    	set: function(value) {
	    		this.__size.__y = value
	    		this.__change()
	    	}
	    },
        width: {
        	get: function() { return this.__size.__z },
        	set: function(value) {
        		this.__size.__z = value
        		this.__change()
        	}
        },
    	red: {
    		get: function() { return this.__color.__x },
	    	set: function(value) {
	    		this.__color.__x = value
	    		this.__change()
	    	}
    	},
	    green: {
	    	get: function() { return this.__color.__y },
	    	set: function(value) {
	    		this.__color.__y = value
	    		this.__change()
	    	}
	    },
	    blue: {
	    	get: function() { return this.__color.__z },
	    	set: function(value) {
	    		this.__color.__z = value
	    		this.__change()
	    	}
	    }
    })
    
    function vp_pyramid(args) { return initObject(this, vp_pyramid, args) }
    subclass(vp_pyramid, vp_box)
    
    function vp_sphere(args) { return initObject(this, vp_sphere, args) }
    subclass(vp_sphere, vp_box)
    property.declare( vp_sphere.prototype, {
    	axis: new attributeVectorAxis(null, 1,0,0),
        size: new attributeVector(null, 2,2,2),
        radius: {
        	get: function() { return this.__size.__y/2 },
        	set: function(value) {
        		this.size = vec(2*value,2*value,2*value)
        		this.__change()
        	}
        }
    })
    
    function vp_ellipsoid(args) { return initObject(this, vp_ellipsoid, args) }
    subclass(vp_ellipsoid, vp_box)
    property.declare( vp_ellipsoid.prototype, {
        radius: {
        	get: function() { throw new Error('An ellipsoid does not have a radius attribute.') },
        	set: function(value) { throw new Error('An ellipsoid does not have a radius attribute.') }
        }
    })
    
    function vp_cylinder(args) { return initObject(this, vp_cylinder, args) }
    subclass(vp_cylinder, vp_box)
    property.declare( vp_cylinder.prototype, {
        size: new attributeVectorSize(null, 1,2,2),
        radius: {
        	get: function() { return this.__size.__y/2 },
        	set: function(value) {
        		this.__size.__y = this.__size.__z = 2*value
        		this.__change()
        	}
        }
    })
    
    function vp_cone(args) { return initObject(this, vp_cone, args) }
    subclass(vp_cone, vp_cylinder)
    
    function arrow_update(obj, vp) { // arrow or vp_arrow (in which case vp is true)
    	var pos = obj.__pos
        var color = obj.__color
        var axis
        if (vp) axis = obj.__axis
        else axis = obj.__axis_and_length
        var L = mag(axis)
        var A = axis.norm()
        var sw = obj.__shaftwidth || L * .1
        var hw = obj.__headwidth || sw * 2
        var hl = obj.__headlength || sw * 3

        if (sw < L * .02) {
            var scale = L * .02 / sw
            if (!obj.__shaftwidth) sw *= scale
            if (!obj.__headwidth) hw *= scale
            if (!obj.__headlength) hl *= scale
        }
        if (hl > L * .5) {
            var scale = L * .5 / hl
            if (!obj.__shaftwidth) sw *= scale
            if (!obj.__headwidth) hw *= scale
            if (!obj.__headlength) hl *= scale
        }

        var components = obj.__components
        if (!components) {
        	if (vp) components = obj.__components = [vp_box({ canvas:obj.canvas, __obj:obj }), 
        	                                         vp_pyramid({ canvas:obj.canvas, __obj:obj })]
        	else components = obj.__components = [box({ canvas:obj.canvas, __obj:obj }), 
                                                  pyramid({ canvas:obj.canvas, __obj:obj })]
        }
        var shaft = components[0]
        var tip = components[1]

        shaft.pos = pos.add(A.multiply(.5 * (L - hl)))
        tip.pos = pos.add(A.multiply(L - hl))
        shaft.axis = tip.axis = axis // this updates the shaft and tip up vectors
        shaft.size = vec(L - hl, sw, sw)
        tip.size = vec(hl, hw, hw)
        shaft.color = tip.color = obj.color
        shaft.opacity = tip.opacity = obj.opacity
        shaft.pickable = tip.pickable = obj.pickable

        obj.size = vec(L, hw, hw)

        shaft.__update()
        tip.__update()
    }
    
    /*
	 * The handling of the arrow object is special. The arrow (or vp_arrow)
	 * object itself does not get inserted into the to-be-rendered list. Rather,
	 * only its components (box and pyramid) are handled in the usual way. The
	 * box and pyramid objects have a special attribute, __obj, which points to
	 * the parent arrow object. In the setter for arrow.visible, "if (this.__org)"
	 * indicates that this is a box or pyramid object, handled by
	 * the parent. Other functions that check for components are canvas.objects,
	 * which returns the arrow object, not its components, and in the render
	 * function (in WebGLRenderer.js), the loop that updates those objects found
	 * in canvas.__changed and special treatment of mouse picking of an arrow
	 * (clicking on either shaft or head returns the parent arrow object).
	 */

    function arrow(args) {
	    if (!(this instanceof arrow)) return new arrow(args)  // so arrow() is like new arrow()
		this.__shaftwidth = 0
		this.__headwidth = 0
		this.__headlength = 0
		return initObject(this, arrow, args)
	}
    subclass(arrow, box)
    property.declare( arrow.prototype, {
        __primitiveCount: 2,
        shaftwidth: {
        	get: function() { return this.__shaftwidth },
        	set: function(value) {
        		this.__shaftwidth = value
        		this.__change()
        	}
        },
        headwidth: {
        	get: function() { return this.__headwidth },
        	set: function(value) {
        		this.__headwidth = value
        		this.__change()
        	}
        },
        headlength: {
        	get: function() { return this.__headlength },
        	set: function(value) {
        		this.__headlength = value
        		this.__change()
        	}
        },
        axis_and_length: new attributeVectorAxis(null, 1,0,0),
    	axis: {
    		get: function() { new Error("arrow has an axis_and_length attribute but no axis attribute") },
    		set: function(value) { new Error("arrow has an axis_and_length attribute but no axis attribute") }
    	},
        __change: function() {
        	if (this.__components) { // make sure the components have been set up
	        	this.__components[0].__change()
	        	this.__components[1].__change()
        	}
        },
        __update: function () { arrow_update(this, false) },
        __get_extent: function(ext) {
        	if (!this.__components) this.__update()
	        Autoscale.find_extent(this.__components[0], ext)
	        Autoscale.find_extent(this.__components[1], ext)
        }
    })
    
    function vp_arrow(args) {
	    if (!(this instanceof vp_arrow)) return new vp_arrow(args)  // so vp_arrow() is like new vp_arrow()
		this.__shaftwidth = 0
		this.__headwidth = 0
		this.__headlength = 0
		return initObject(this, vp_arrow, args)
	}
    subclass(vp_arrow, arrow)
    property.declare( vp_arrow.prototype, {
    	axis: new attributeVectorAxis(null, 1,0,0),
    	axis_and_length: {
    		get: function() { new Error("arrow has an axis attribute but no axis_and_length attribute") },
    		set: function(value) { new Error("arrow has an axis attribute but no axis_and_length attribute") }
    	},
        length: {
        	get: function() { return mag(this.__axis)  },
        	set: function(val) {
        		this.axis = this.__axis.norm().multiply(val)
        	}
        },
    	__update: function () { arrow_update(this, true) }
    })
    
    function text(args) { // 3D text object
    	if (!(this instanceof text)) return new text(args) // so text() is like new text()
		// The 3D text object is a wrapper with many specialized attributes around a compound object.
    	// In this unusual structure, updates to size, axis, up, or color are handled by 
    	//   explicit attributes here that change the compound object.
		args = args || {}
    	if (args.canvas === null) return
    	if (args.text === undefined || args.text.length === 0) throw new Error('A text object needs non-empty text.')
    	if (args.length !== undefined) throw new Error('The length cannot be specified when constructing 3D text.')
    	if (args.size !== undefined) throw new Error('A text object does not have a size attribute.')
    	// Need to initialize attribute vectors here, for reasons that aren't clear (there is no size attribute)
    	args.text = print_to_string(args.text)
    	this.pos = this.pos
    	this.axis = this.axis
    	this.up = this.up
    	this.color = this.color
    	var cloning = (args.__comp !== undefined)
		if (!cloning) {
			var ret = text3D(args) // create a compound object representing the 3D text, as though text.pos is <0,0,0>
			this.__id = nextVisibleId // if the compound has id 37, this text object has id 38
            nextVisibleId++
			this.__comp = ret[0]			
			args = ret[1]
		} else { // When cloning a text object, the corresponding compound was also cloned
			this.__id = nextVisibleId // if the compound has id 37, this text object has id 38
            nextVisibleId++
		}
    	for (var attr in args) this[attr] = args[attr]
    	if (cloning) this.__comp.__pos = this.__pos.add(this.__offset)
    	this.__pseudosize = vec(this.__comp.size)
	    this.__height_fraction = this.__height/this.__comp.size.y
	    this.__descender_fraction = this.__descender/this.__comp.size.y
		args = {}
	    initObject(this, text, {})
	    if (this.__billboard) {
	    	this.canvas.update_billboards = true // signal a need for WebGLRenderer to update billboarding
	    	this.canvas.billboards.push(this)
	    }
		if (!cloning) {
			this.__offset = this.__comp.__pos // the extrusion pos will be relative to this.__pos
			this.__offset.x /= this.length
			this.__offset.y /= this.height
			this.__offset.z /= this.depth
		}
	}
    subclass(text, Primitive)
    
    property.declare( text.prototype, {
    	size: {
    		get: function() { throw new Error('A text object does not have a size attribute.') },
			set: function(value) { throw new Error('A text object does not have a size attribute.') }
    	},
        visible: {
    		get: function() { return this.__comp.visible },
			set: function(value) { this.__comp.visible = value }
    	},
    	__update: function() { // will trigger update to this.__comp compound object
    		window.__adjustupaxis = false // just copy axis and up to compound without adjustments
    		this.__comp.axis = this.axis
    		this.__comp.up = this.up
    		window.__adjustupaxis = true
    		var yheight = this.__pseudosize.y
    		this.__comp.size = vec(this.length, yheight, Math.abs(this.depth))
    		this.__comp.color = this.color
    		var dz = cross(this.__axis,this.__up).norm()
			this.__comp.pos = this.__pos.add(this.__axis.norm().multiply(this.__offset.x*this.length)).add(
					this.__up.norm().multiply(this.__offset.y*this.height)).add(dz.multiply(this.__offset.z*this.depth))
    	},
        length: {
        	get: function() { return this.__pseudosize.x },
        	set: function(value) {
        		if (value === this.__pseudosize.x) return
        		this.__pseudosize.x = value
	    		this.__change()
        	}
        },
	    height: {
	    	get: function() { return this.__height_fraction*this.__pseudosize.y },
	    	set: function(value) {
	    		this.__pseudosize.y = value/this.__height_fraction
	    		this.__change()
	    	}
	    },
    	depth: { // 3D text object; depth > 0 means extrude in +z direction
    		get: function() {
    			if (this.__depth >= 0) return this.__pseudosize.z
    			else return -this.__pseudosize.z
    		},
    		set: function(value) {
    			var d = this.__depth
    			if (Math.abs(value) < 0.01*d) {
    				if (value < 0) value = -0.01*d
    				else value = 0.01*d
    			}
				this.__depth = value
				this.__size.z = Math.abs(value)
	    		this.__change()
    		}
    	},
    	descender: {
    		get: function() { return this.__descender_fraction*this.__pseudosize.y },
    		set: function(value) { throw new Error('descender is read-only') }
    	},
    	opacity: {
    		get: function() { return this.__opacity },
    		set: function(value) {
    			this.__comp.opacity = this.__opacity = value
    			this.__change()
    		}
    	},
    	shininess: {
    		get: function() { return this.__shininess },
    		set: function(value) {
    			this.__shininess = this.__comp.shininess = value
    			this.__change()
    		}
    	},
    	emissive: {
    		get: function() { return this.__emissive },
    		set: function(value) {
    			this.__comp.emissive = this.__emissive = value
    			this.__change()
    		}
    	},
    	texture: {
    		get: function() { throw new Error('Cannot currently apply a texture to a text object') },
    		set: function(value) { throw new Error('Cannot currently apply a texture to a text object') }
    	},
    	text: {
    		get: function() { return this.__text },
    		set: function(value) { throw new Error('text is read-only') }
    	},
    	font: {
    		get: function() { return this.__font },
    		set: function(value) { throw new Error('font is read-only') }
    	},
    	align: {
    		get: function() { return this.__align },
    		set: function(value) { throw new Error('align is read-only') }
    	},
    	billboard: {
    		get: function() { return this.__billboard },
    		set: function(value) { throw new Error('billboard is read-only') }
    	},
    	show_start_face: {
    		get: function() { return this.__show_start_face },
    		set: function(value) { throw new Error('show_start_face is read-only') }
    	},
    	show_end_face: {
    		get: function() { return this.__show_end_face },
    		set: function(value) { throw new Error('show_end_face is read-only') }
    	},
    	start_face_color: {
    		get: function() { return this.__start_face_color },
    		set: function(value) { throw new Error('start_face_color is read-only') }
    	},
    	end_face_color: {
    		get: function() { return this.__end_face_color },
    		set: function(value) { throw new Error('end_face_color is read-only') }
    	},
    	start: {
    		get: function() { return this.upper_left.sub(this.up.norm().multiply(this.height)) },
    		set: function(value) { throw new Error('start is read-only') }
    	},
    	end: {
    		get: function() { return this.upper_right.sub(this.up.norm().multiply(this.height)) },
    		set: function(value) { throw new Error('end is read-only') }
    	},
    	vertical_spacing: {
    		get: function() { return 1.5*this.height },
    		set: function(value) { throw new Error('vertical_spacing is read-only') }
    	},
    	upper_left: {
    		get: function() { 
    			var dx = 0
    			if (this.__align == 'right') dx = -this.length
    			else if (this.__align == 'center') dx = -this.length/2
    			return this.pos.add(this.up.norm().multiply(this.height)).add(this.axis.norm().multiply(dx))
    		},
    		set: function(value) { throw new Error('upper_left is read-only') }
    	},
    	upper_right: {
    		get: function() { return this.upper_left.add(this.axis.norm().multiply(this.length)) },
    		set: function(value) { throw new Error('upper_right is read-only') }
    	},
    	lower_left: {
    		get: function() { return this.upper_left.add(this.up.norm().multiply(-this.height-this.descender-1.5*this.height*(this.__lines-1))) },
    		set: function(value) { throw new Error('lower_left is read-only') }
    	},
    	lower_right: {
    		get: function() { return this.lower_left.add(this.axis.norm().multiply(this.length)) },
    		set: function(value) { throw new Error('lower_right is read-only') }
    	},
    	lines: {
    		get: function() { return this.__lines },
    		set: function(value) { throw new Error('lines is read-only') }
    	} 
    })

    function vertex(args)  {
    	// Comment by David Scherer: In WebGL indices are required to be Uint16Array, so less than 65536.
    	// To handle more than this many index values, we need more lists.
		// Moreover, a triangle or quad might use vertex objects from more than one list, which requires some
		// duplication. As a temporary measure to get going, just give an error if one tries to create more
		// than 65536 vertex objects.
    	// We keep info on what triangles or quads use a vertex, and if the
    	// count goes to zero, the slot can be reused.
    	if (!(this instanceof vertex)) { return new vertex(args) } // so vertex() is like new vertex()
    	args = args || {}
        if (args.canvas !== undefined) {
            this.canvas = args.canvas
        } else if (args.display !== undefined) {
        	this.canvas = args.display
        } else {
        	this.canvas = canvas.selected
        }
    	for (var attr in args) { // make a copy so that caller doesn't have its args deleted
    		if (attr == 'canvas' || attr == 'display') continue
    		this[attr] = args[attr]
    	}
    	if (this.opacity === undefined) this.opacity = 1
    	if (this.__texpos.z !== 0) throw new Error('In a vertex the z component of texpos must be zero.')
    	if (this.canvas.vertex_id >= 65536) throw new Error('Currently the number of vertices is limited to 65536.')
    	var lengths = {pos:3, normal:3, color:3, opacity:1, shininess:1, emissive:1, texpos:2, bumpaxis:3}
    	this.__id = this.canvas.__vertices.available.pop() // try to use a no-longer-used vertex slot
    	if (this.__id === undefined) {
    		this.__id = this.canvas.vertex_id
	    	var c = this.canvas.__vertices
	    	if (this.canvas.vertex_id % c.Nalloc === 0) { // need to extend arrays
	    		var temp
	    		var L = this.canvas.vertex_id + c.Nalloc
	    		for (var t in lengths) {
					temp = new Float32Array(lengths[t]*L)
					temp.set(c[t], 0)
					c[t] = temp
				}
			}
	    	this.canvas.vertex_id++
    	}
    	this.canvas.__vertices.object_info[this.__id] = {} // initialize dictionary of triangles/quads that use this vertex
    	this.__change()
    }
    property.declare( vertex.prototype, {
        __id: null,
        __hasPosAtCenter: true,
        pos: new attributeVector(null, 0,0,0),
        normal: new attributeVector(null, 0,0,1),
        color: new attributeVector(null, 1,1,1),
        opacity: {
        	get: function() { return this.__opacity },
        	set: function(value) {
        		if (value == this.__opacity) return
        		if ( (this.__opacity < 1 && value  == 1) || (this.__opacity == 1 && value  < 1) ) {
            		var users = this.canvas.__vertices.object_info[this.__id]
                	for (var u in users) {
                		users[u].__change()
                		users[u].__opacity_change = true
                	}
        		}
        		this.__opacity = value
        		this.canvas.__vertex_changed[this.__id] = this
        	}
        },
        texpos: new attributeVector(null, 0,0,0),
        bumpaxis: new attributeVector(null, 1,0,0),
        shininess: { value: 0.6, onchanged: function() { this.__change() } },
        emissive: { value: false, onchanged: function() { this.__change() } },
        __change: function() { 
        	if (this.__id) {
        		this.canvas.__vertex_changed[this.__id] = this
        		if (this.canvas.__autoscale) { // alert triangles/quads that use this vertex, to support autoscaling
	        		var users = this.canvas.__vertices.object_info[this.__id]
	            	for (var u in users) users[u].__change()
        		}
        	}
        },
        rotate: function (args) {
            if (args.angle === undefined) { throw new Error("vertex.rotate() requires angle:...") }
            var angle = args.angle
            if (args.axis === undefined) { throw new Error("vertex.rotate() requires axis:...") }
            var axis = args.axis.norm()
            var origin
            if (args.origin === undefined) { origin = vec(0,0,0) }
            else origin = args.origin
            this.pos = origin.add(this.__pos.sub(origin).rotate({angle:angle, axis:axis})) 
        	this.__change()           
        },
    })
    
    function tri_quad_error(object_type, attribute) {
    	throw new Error('A '+object_type+' has no '+attribute+' attribute.')
    }
    
    function triangle(args)  {
    	// e.g. triangle( { v0:..., v1:..., v2:..., texture:textures.flower, myid:'left side' }
    	// 1000000 Float32Array(array) or Uint16Array(array) costs about 15 ms.
    	// Conclusion: keep data arrays in Float32Array format except for index
		// array, which should be an ordinary array
	    if (!(this instanceof triangle)) return new triangle(args)  // so triangle() is like new triangle()
	    args = args || {}
	    var vnames = ['v0', 'v1', 'v2']
	    if (args.vs === undefined) {
		    for (var i=0; i<3; i++)
		    	if (args[vnames[i]] === undefined) throw new Error('A triangle must have a vertex '+vnames[i]+'.')
	    }
//        this.__tex = {file: null, bumpmap: null, texture_ref: {reference: null}, bumpmap_ref: {reference: null}, 
//				  left: false, right: false, sides: false, flipx: false, flipy: false, turn: 0, flags: 0 }
	    init(this, args)
	    var vtemp = this.vs
	    // Tell each vertex object that it is used by this triangle object
	    for (var i=0; i<3; i++) this.canvas.__vertices.object_info[ vtemp[i].__id ][this.__id] = this
	}
    subclass(triangle, box)
    property.declare( triangle.prototype, {
    	v0: {
    		get: function() { return this.__v0 },
    		set: function(value) {
    			if (!(value instanceof vertex)) throw new Error('v0 must be a vertex object.')
    			this.__v0 = value
    			this.__change()
    			}
    	},
    	v1: {
    		get: function() { return this.__v1 },
    		set: function(value) {
    			if (!(value instanceof vertex)) throw new Error('v1 must be a vertex object.')
    			this.__v1 = value
    			this.__change()
    			}
    	},
    	v2: {
    		get: function() { return this.__v2 },
    		set: function(value) {
    			if (!(value instanceof vertex)) throw new Error('v2 must be a vertex object.')
    			this.__v2 = value
    			this.__change()
    			}
    	},
    	vs: {
    		get: function() { return [this.__v0, this.__v1, this.__v2] },
    		set: function(value) {
    			if (toType(value) != 'array' || value.length != 3) throw new Error('triangle.vs must be a list of 3 vertex objects.')
    			for (var i=0; i<3; i++) if (!(value[i] instanceof vertex)) throw new Error('triangle.vs must contain vertex objects.')
    			this.__v0 = value[0]
        		this.__v1 = value[1]
    			this.__v2 = value[2]
    			this.__change()
    			}
    	},
    	pos: {
    		get: function() { tri_quad_error('triangle', 'pos') },
    		set: function(value) { tri_quad_error('triangle', 'pos') }
    	},
    	color: {
    		get: function() { tri_quad_error('triangle', 'color') },
    		set: function(value) { tri_quad_error('triangle', 'color') }
    	},
    	size: {
    		get: function() { tri_quad_error('triangle', 'size') },
    		set: function(value) { tri_quad_error('triangle', 'size') }
    	},
    	axis: {
    		get: function() { tri_quad_error('triangle', 'axis') },
    		set: function(value) { tri_quad_error('triangle', 'axis') }
    	},
    	up: {
    		get: function() { tri_quad_error('triangle', 'up') },
    		set: function(value) { tri_quad_error('triangle', 'up') }
    	},
    	opacity: {
    		get: function() { tri_quad_error('triangle', 'opacity') },
    		set: function(value) { tri_quad_error('triangle', 'opacity') }
    	},
    	shininess: {
    		get: function() { tri_quad_error('triangle', 'shininess') },
    		set: function(value) { tri_quad_error('triangle', 'shininess') }
    	},
    	emissive: {
    		get: function() { tri_quad_error('triangle', 'emissive') },
    		set: function(value) { tri_quad_error('triangle', 'emissive') }
    	},
    	__prev_texture: null,
    	__prev_bumpmap: null,
        __update: function () { this.__model.id_object[this.__id] = this },
        __get_extent: function (ext) {
    	    var vnames = ['__v0', '__v1', '__v2']
            for (var i=0; i<3; i++) ext.point_extent(this, this[vnames[i]].pos) // this triangle uses these vertices
        },
        rotate: function (args) { throw new Error('A triangle has no rotate method; rotate the vertices instead.')
        }
    })
    
    function quad(args)  { // quads are actually rendered as triangles; their indices are added to the triangle indices
	    if (!(this instanceof quad)) return new quad(args)  // so quad() is like new quad()
	    args = args || {}
	    var vnames = ['v0', 'v1', 'v2', 'v3']
	    if (args.vs === undefined) {
		    for (var i=0; i<4; i++)
		    	if (args[vnames[i]] === undefined) throw new Error('A quad must have a vertex '+vnames[i]+'.')
	    }
        this.__tex = {file: null, bumpmap: null, texture_ref: {reference: null}, bumpmap_ref: {reference: null}, 
				  left: false, right: false, sides: false, flipx: false, flipy: false, turn: 0, flags: 0 }
	    init(this, args)
	    var vtemp = this.vs
	    // Tell each vertex object that it is used by this quad object
	    for (var i=0; i<4; i++) this.canvas.__vertices.object_info[ vtemp[i].__id ][this.__id] = this
	}
    subclass(quad, box)
    property.declare( quad.prototype, {
    	v0: {
    		get: function() { return this.__v0 },
    		set: function(value) {
    			if (!(value instanceof vertex)) throw new Error('v0 must be a vertex object.')
    			this.__v0 = value
    			this.__change()
    			}
    	},
    	v1: {
    		get: function() { return this.__v1 },
    		set: function(value) {
    			if (!(value instanceof vertex)) throw new Error('v1 must be a vertex object.')
    			this.__v1 = value
    			this.__change()
    			}
    	},
    	v2: {
    		get: function() { return this.__v2 },
    		set: function(value) {
    			if (!(value instanceof vertex)) throw new Error('v2 must be a vertex object.')
    			this.__v2 = value
    			this.__change()
    			}
    	},
    	v3: {
    		get: function() { return this.__v3 },
    		set: function(value) {
    			if (!(value instanceof vertex)) throw new Error('v3 must be a vertex object.')
    			this.__v3 = value
    			this.__change()
    			}
    	},
    	vs: {
    		get: function() { return [this.__v0, this.__v1, this.__v2, this.__v3] },
    		set: function(value) {
    			if (toType(value) != 'array' || value.length != 4) throw new Error('quad.vs must be a list of 4 vertex objects.')
    			for (var i=0; i<4; i++) if (!(value[i] instanceof vertex)) throw new Error('quad.vs must contain vertex objects.')
    			this.__v0 = value[0]
        		this.__v1 = value[1]
    			this.__v2 = value[2]
        		this.__v3 = value[3]
    			this.__change()
    			}
    	},
    	pos: {
    		get: function() { tri_quad_error('quad', 'pos') },
    		set: function(value) { tri_quad_error('quad', 'pos') }
    	},
    	color: {
    		get: function() { tri_quad_error('quad', 'color') },
    		set: function(value) { tri_quad_error('quad', 'color') }
    	},
    	size: {
    		get: function() { tri_quad_error('quad', 'size') },
    		set: function(value) { tri_quad_error('quad', 'size') }
    	},
    	axis: {
    		get: function() { tri_quad_error('quad', 'axis') },
    		set: function(value) { tri_quad_error('quad', 'axis') }
    	},
    	up: {
    		get: function() { tri_quad_error('quad', 'up') },
    		set: function(value) { tri_quad_error('quad', 'up') }
    	},
    	opacity: {
    		get: function() { tri_quad_error('quad', 'opacity') },
    		set: function(value) { tri_quad_error('quad', 'opacity') }
    	},
    	shininess: {
    		get: function() { tri_quad_error('quad', 'shininess') },
    		set: function(value) { tri_quad_error('quad', 'shininess') }
    	},
    	__prev_texture: null,
    	__prev_bumpmap: null,
        __update: function () { this.__model.id_object[this.__id] = this },
        __get_extent: function (ext) {
    	    var vnames = ['__v0', '__v1', '__v2', '__v3']
            for (var i=0; i<4; i++) ext.point_extent(this, this[vnames[i]].pos) // this quad uses these vertices
        },
        rotate: function (args) { throw new Error('A quad has no rotate method; rotate the vertices instead.')
        }
    })

    var compound_id = 0
    
    function make_compound(objects, parameters) {
    	
        function update_extent(c, extent) {
        	if (extent.__xmin === null) return // sometimes mesh extent returns nulls
	        for (var ext in extent) {
	        	var value = extent[ext]
	        	if (ext.slice(-3) == 'min') { if (c[ext] === null || value < c[ext]) c[ext] = value }
	        	else { if (c[ext] === null || value > c[ext]) c[ext] = value }
	        }
        }
        
        function compound_error(n) {
        	if (n > 0) throw new Error('Compounding objects 0 through '+n+' in the list exceeds the vertex limit.')
        	else throw new Error('The first object in the list exceeds the vertex limit')
        }

        var self = parameters.self
        delete parameters.self
        var mesh = new Mesh()
        var release = [] // list of vertex objects that can be released
    	var temp
        for (var i = 0; i < objects.length; i++) {
            var o = objects[i]

	        if (o instanceof curve)
            	throw new Error('Currently cannot include a curve in a compound.')
            else if (o instanceof helix)
            	throw new Error('Currently cannot include a helix in a compound.')
            else if (o instanceof label)
            	throw new Error('Currently cannot include a label in a compound.')
            if (o.__tex.file !== null)
            	throw new Error('Currently objects in a compound cannot have their own texture.')
            if (o.__tex.bumpmap !== null)
            	throw new Error('Currently objects in a compound cannot have their own bumpmap.')
            if (o instanceof triangle || o instanceof quad) {
            	// For each vertex in o.vs, extract the mesh information, and free up no longer used vertex slots
            	var q = o.vs
            	var N = 3
            	if (o instanceof quad) N = 4
            	for (var k=0; k<N; k++) {
            		if (k == 3) {
	            		// Bias the index to point to already existing data:
            			temp = mesh.merge(o.v0, o.v0, -3)
            			if (temp === null) compound_error(i)
	            		update_extent( self, temp )
	            		temp = mesh.merge(o.v2, o.v2, -1)
            			if (temp === null) compound_error(i)
	            		update_extent( self, temp )
	            		temp = mesh.merge(o.v3, o.v3, 0)
            			if (temp === null) compound_error(i)
	            		update_extent( self, temp )
            		} else {
            			temp = mesh.merge(q[k], q[k], 0)
            			if (temp === null) compound_error(i)
	            		update_extent( self, temp )
            		}
            		
            		if (self.canvas.__vertices.object_info[ q[k].__id ][o.__id] !== undefined) { 
            			delete self.canvas.__vertices.object_info[ q[k].__id ][o.__id]
            		}
            		if (Object.keys(self.canvas.__vertices.object_info[ q[k].__id ]).length === 0) { // this vertex object is no longer used if {..} empty
            			if (release.indexOf(q[k].__id) < 0) release.push(q[k].__id) // avoid duplicate entries into list of vertex objects to release
            		}
            	}
            } else if (o instanceof text) {
            	var comp = o.__comp
            	temp = mesh.merge(comp.getTransformedMesh(), comp, 0)
    			if (temp === null) compound_error(i)
            	update_extent( self, temp )
            } else if (o.__components !== undefined) { // currently, only arrow and vp_arrow have components
            	var c = o.__components
            	for (var ci=0; ci<c.length; ci++) {
            		var comp = c[ci]
            		temp = mesh.merge(comp.getTransformedMesh(), comp, 0)
        			if (temp === null) compound_error(i)
	            	update_extent( self, temp )
            	}
            } else {
            	temp = mesh.merge(o.getTransformedMesh(), o, 0)
    			if (temp === null) compound_error(i)
            	update_extent( self, temp )
            }
            o.visible = false
            o.__deleted = true // do not allow this object to be made visible any more
        }
        for (var k=0; k<release.length; k++) self.canvas.__vertices.available.push(release[k]) // release no longer needed vertex objects
        self.pos = vec( (self.__xmin + self.__xmax)/2, (self.__ymin + self.__ymax)/2, (self.__zmin + self.__zmax)/2 )
        var size = self.size = vec( (self.__xmax-self.__xmin), (self.__ymax-self.__ymin), (self.__zmax-self.__zmin) )
        if (window.__GSlang == 'vpython') self.axis = norm(self.axis).multiply(size.x)
        if (Math.min(size.x, size.y, size.z) === 0) { // one of the size values is 0; change it to 0.001 of the largest size component
        	var max = Math.max(size.x, size.y, size.z)
        	if (size.x === 0) self.size.__x = 0.001*max
        	if (size.y === 0) self.size.__y = 0.001*max
        	if (size.z === 0) self.size.__z = 0.001*max
        }
        if (mag(self.axis) === 0) self.axis.__x = self.size.__x // must not permit axis to be a zero vector (e.g. due to compound of a triangle)
        mesh.adjust(self.pos, self.size) // adjust mesh size to be vec(1,1,1)
        compound_id++
        mesh.__mesh_id = 'compound'+compound_id
        self.canvas.__renderer.add_model(mesh, false)
        self.__mesh = mesh
		self.__model = self.canvas.__renderer.models[mesh.__mesh_id]
    	
    	// Apply parameters to the compound:
        var attrs = ['axis', 'size', 'up'] // apply these parameters in this order
        for (var attr in attrs) {
        	var a = attrs[attr]
	        if (parameters[a] !== undefined) {
	        	self[a] = parameters[a]
	        	delete parameters[a]
	        }
        }
        for (var attr in parameters) self[attr] = parameters[attr]
    }
    
    function compound(objects, parameters) {
        if (!(this instanceof compound)) return new compound(objects, parameters)
    	if (objects.length === undefined && objects.canvas === null) return // it's null if first setting up objects; see subclass function
        parameters = parameters || {}
        if (objects.length === undefined) throw new Error("compound takes a list of objects")
        initObject(this, compound, {})
        var cloning = false
        if (parameters.__cloning) {
        	cloning = true
        	var mesh = parameters.__cloning
        	delete parameters.__cloning
        }
        var visible = true
        if (parameters.visible !== undefined) {
        	visible = parameters.visible
            delete parameters.visible
        }
        if (!cloning) { // !cloning means that we're compounding
        	parameters.self = this
            make_compound(objects, parameters)
        } else {
			this.__mesh = mesh
	        this.__model = this.canvas.__renderer.models[mesh.__mesh_id]
			for (var attr in parameters) this[attr] = parameters[attr]
        }
        this.visible = visible
    }
    subclass(compound, box)
    property.declare( compound.prototype, {    	
        clone: function(args) { // cloning a compound object
        	args = args || {}
            var special = {__pos:vec(this.__pos), __axis:vec(this.__axis), __size:vec(this.__size),
        		__up:vec(this.__up), __color:vec(this.__color)}
        	var oldargs = {__opacity:this.__opacity, 
        			__shininess:this.__shininess, __emissive:this.__emissive,
            		visible:true, __pickable:this.__pickable,
            		__center:this.__center, __pseudosize:this.__pseudosize}
        	if (this.texture.file !== null) oldargs.texture = this.texture
        	// The oldargs are in terms of __attr to avoid axis/up/size interconnections
        	oldargs.__cloning = this.__mesh
        	var ret = new this.constructor([], oldargs)
            for (var attr in special) { // simply assigning a vec to ret{attr] kills its attribute vector status
            	ret[attr].__x = special[attr].x
            	ret[attr].__y = special[attr].y
            	ret[attr].__z = special[attr].z
            }
        	for (var attr in args) ret[attr] = args[attr] // apply the args attributes to the clone
        	ret.__update()
        	return ret
        },
        _world_zaxis: function() {
	        return this.__axis.cross(this.__up).norm()
        },
	    world_to_compound: function(v) {
	        var axis = this.__axis
	        var z_axis = this._world_zaxis()
	        var y_axis = this.__up
	        var x_axis = axis.norm()
	        var v = v.sub(this.__pos)
	        return vec(v.dot(x_axis), v.dot(y_axis), v.dot(z_axis))
	    },	
	    compound_to_world: function(v) {
	    	var axis = this.__axis        
	    	var z_axis = this._world_zaxis()
	    	var y_axis = this.__up
	        var x_axis = axis.norm()
	        return this.__pos.add(x_axis.multiply(v.x)).add(y_axis.multiply(v.y)).add(z_axis.multiply(v.z))
	    },
        __get_model: function() { return this.__model }
    })
    
    function vp_compound(objects, parameters) {
        if (!(this instanceof vp_compound)) return new vp_compound(objects, parameters)
    	if (objects.length === undefined && objects.canvas === null) return // it's null if first setting up objects; see subclass function
        parameters = parameters || {}
        if (objects.length === undefined) throw new Error("compound takes a list of objects")
        initObject(this, compound, {})
        var cloning = false
        if (parameters.__cloning) {
        	cloning = true
        	var mesh = parameters.__cloning
        	delete parameters.__cloning
        }
        var visible = true
        if (parameters.visible !== undefined) {
        	visible = parameters.visible
            delete parameters.visible
        }
        if (!cloning) { // !cloning means that we're compounding
            parameters.self = this
            make_compound(objects, parameters)
        } else {
			this.__mesh = mesh
	        this.__model = this.canvas.__renderer.models[mesh.__mesh_id]
			for (var attr in parameters) this[attr] = parameters[attr]
        }
        this.visible = visible
    }
    subclass(vp_compound, compound)
    property.declare( vp_compound.prototype, {
        size: new attributeVectorSize(null, 1,1,1),
        length: {
        	get: function() { return this.__size.__x },
        	set: function(value) {
	    		this.axis = this.__axis.norm().multiply(value) // this will set length
        		this.__change()
        	}
        },
	    height: {
	    	get: function() { return this.__size.__y },
	    	set: function(value) {
	    		this.__size.__y = value
	    		this.__change()
	    	}
	    },
        width: {
        	get: function() { return this.__size.__z },
        	set: function(value) {
        		this.__size.__z = value
        		this.__change()
        	}
        },
    	red: {
    		get: function() { return this.__color.__x },
	    	set: function(value) {
	    		this.__color.__x = value
	    		this.__change()
	    	}
    	},
	    green: {
	    	get: function() { return this.__color.__y },
	    	set: function(value) {
	    		this.__color.__y = value
	    		this.__change()
	    	}
	    },
	    blue: {
	    	get: function() { return this.__color.__z },
	    	set: function(value) {
	    		this.__color.__z = value
	    		this.__change()
	    	}
	    }
    })
    
    // Angus Croll:
	// http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
    // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
    // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"

    var toType = function(obj) { 
        return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
    }
    
    function curve(args) { // TODO: shrinking a curve's extent doesn't trigger moving the camera inward; dunno why.
    	if (!(this instanceof curve)) {
    		var a = []
    		for (var i=0; i<arguments.length; i++) a.push(arguments[i])
    		return new curve(a)  // so curve() is like new curve()
    	}
    	if (args.canvas !== null) { // it's null if first setting up objects; see subclass function
    		if (args.canvas !== undefined) initObject(this, curve, {canvas:args.canvas}) // e.g. called from helix
    		else initObject(this, curve, {})
    		this.__points = [] // list of point objects
	        this.__radius = 0 // means width of a few pixels
	    	this.__retain = -1 // signal that all points should be retained
	    	this.pickable = true
	    	if (args.length == 1 && toType(args[0]) == 'object') {
	    		var obj = args[0]
	            for (var a in obj) { // include user variables
	            	if (a === 'pos') continue
    				this[a] = obj[a]
    				delete obj[a]
	            }
	    	}
            var temp = this.__setup(args) // returns [pos, specs]; specs irrelevant in constructor
            pos = temp[0]
        	if (pos.length > 0) this.__push_and_append(pos, {})
    	}
    }
    subclass(curve, Primitive)
    property.declare( curve.prototype, {
    	origin: new attributeVectorPos(null, 0,0,0),
        pos: {
        	get: function() { throw new Error('Use methods to read curve or points pos attribute.') },
        	set: function(value) { throw new Error('Use methods to change curve or points pos attribute.') }
        },
        radius: {
        	get: function() { return this.__radius },
        	set: function(value) {
        		this.__radius = value
    			this.__change()
    		}
        },
        retain: {
        	get: function() { return this.__retain },
        	set: function(value) {
        		this.__retain = value
    			this.__change()
        	}
        },
        npoints: {
        	get: function() { return this.__points.length },
        	set: function(value) { throw new Error('Cannot change curve or points npoints.') }
        },
        __no_autoscale: false,
        __get_extent: function (ext) {
        	if (this.__no_autoscale) return
        	var xmin=null, ymin=null, zmin=null, xmax=null, ymax=null, zmax=null
        	var length = this.__points.length
        	var pnt = this.__points
        	var org = this.__origin
        	var p
            for (var i = 0; i < length; i++) {
            	p = pnt[i].__pos
            	if (xmin === null || p.x+org.x < xmin) xmin = p.x+org.x
            	if (ymin === null || p.y+org.y < ymin) ymin = p.y+org.y
            	if (zmin === null || p.z+org.z < zmin) zmin = p.z+org.z
            	if (xmax === null || p.x+org.x > xmax) xmax = p.x+org.x
            	if (ymax === null || p.y+org.y > ymax) ymax = p.y+org.y
            	if (zmax === null || p.z+org.z > zmax) zmax = p.z+org.z
            }
        	// Mock up appropriate data structures for Autoscale.find_extent
	        var center = vec( (xmin + xmax)/2, (ymin + ymax)/2, (zmin + zmax)/2 )
	        var pseudosize = vec( (xmax-xmin),(ymax-ymin), (zmax-zmin) )
    		var savepos = this.__pos, savesize = this.__size
    		this.__pos = center
    		this.__size = pseudosize
    		this.__hasPosAtCenter = true
    		ext.xmin = xmin
    		ext.xmax = xmax
    		ext.ymin = ymin
    		ext.ymax = ymax
    		ext.zmin = zmin
    		ext.zmax = zmax
    		Autoscale.find_extent(this, ext)
    		this.__pos = savepos
    		this.__size = savesize
        },
        __setup: function(iargs) {
	    	var pos = []
    		var specs = {}
            var haspos = false
            if (iargs instanceof vec) {
            	haspos = true
            	pos = [iargs]
            } else if (iargs.length > 1) { // curve(v1,v2,v3) or curve(p1,p2,p3)
            	haspos = true
            	for (var i=0; i<iargs.length; i++) pos.push( RSdict_to_JSobjectliteral(iargs[i]) )
            } else if (toType(iargs[0]) == 'array') { // curve([v1,v2]) or curve([p1,p2])
            	haspos = true
            	var obj = iargs[0]
            	for (var i=0; i<obj.length; i++) pos.push(RSdict_to_JSobjectliteral(obj[i]))
            } else if (iargs.length == 1 && toType(iargs[0]) == 'object') { // curve(pos=..., color=....) or (color=...) or curve(v) or curve(p)
                var obj = iargs[0]
            	if (obj instanceof vec) { // v
            		haspos = true
            		pos = [obj]
            	} else {
            		obj = RSdict_to_JSobjectliteral(obj)
            		if (obj['texture'] !== undefined) throw new Error("Textures are not available for curve or points objects.")
			    	if (obj['opacity'] !== undefined && this.constructor == curve) throw new Error("Opacity is not available for curve objects.")
	        		var attrs = ['color', 'radius', 'retain', 'visible', 'emissive', 'opacity', 'pickable']
		    		for (var attr in attrs) {
		    			var a = attrs[attr]
		    			if (obj[a] !== undefined) {
		    				specs[a] = obj[a]
		    				delete obj[a]
		    			}
		    		}
	                if (obj.pos !== undefined) { // curve(pos=p....) or curve(pos=[p1,p2]......)
	                	haspos = true
	                	pos = []
	                	if (toType(obj.pos) == 'array') {
	                		for (var i=0; i<obj.pos.length; i++) pos.push( RSdict_to_JSobjectliteral(obj.pos[i]) )
	                	} else pos = [RSdict_to_JSobjectliteral(obj.pos)]
	                }
            	}
        	}
	    	return [pos, specs]
        },
        __push_and_append: function(args, specs) { // args is a list of positions; specs is an object of attributes
        	var start = this.__points.length
            var retain = this.__retain // global retain
            if (specs.retain !== undefined) { // retain for this particular point
            	retain = specs.retain
            	delete specs.retain
            }
        	for (var i=0; i<args.length; i++) {
    			if (this.constructor == curve) { // curve, else points object
    				var pt
                	var attrs = {}
                	var obj = args[i]
                	if (toType(obj) == 'object' && !(obj instanceof vec)) {
                		if (obj.pos === undefined) throw new Error("A curve object point must include a pos.")
                		obj.pos = vec(obj.pos) // make sure that we use a copy of the object's pos
                		for (var a in obj) attrs[a] = obj[a]
                	} else {
                		if (!(obj instanceof vec)) throw new Error("A pos of a curve object must be a vector.")
                		attrs['pos'] = vec(obj) // make sure that we use a copy of the object's pos
                    	for (var a in specs) attrs[a] = specs[a]
                	}
    				if (retain > -1 && this.__points.length >= retain) {
				    	// If retaining, re-use one of the point objects rather than creating a new one
				    	var N = this.__points.length-retain
				    	for (var d=0; d<N; d++) {
				    		var first = this.__points.shift()
				    		first.visible = false
				    	}
				        var prev = this.__points[this.__points.length - 1]
				    	pt = this.__points.shift()
				    	for (var a in attrs) pt[a] = attrs[a]
				    	this.__points.push(pt)
				    	var s = pt.__prevsegment = prev.__nextsegment = new Float32Array(16)
				        s[11] = s[15] = 1;  // opacities
				        prev.__change()
				        pt.__change()
				    } else {
	            		pt = point(attrs)
	                    pt.__curve = this
	                    pt.__id = nextVisibleId++
	                    this.canvas.__visiblePrimitives[pt.__id] = pt // needs to be in visiblePrimitives for mouse picking
	                    pt.__falsecolor = id_to_falsecolor(pt.__id)
	                    if (this.__points.length) {
	                        var prev = this.__points[this.__points.length - 1]
	                        var s = pt.__prevsegment = prev.__nextsegment = new Float32Array(16)
	                        s[11] = s[15] = 1;  // opacities
	                        prev.__change()
	                    } // TODO: Do something clever to cap the beginning of the curve
	                    this.__points.push(pt)
				        pt.__change()
				    }
    			} else { // points object
    				var pt
                	var attrs = {}
                	attrs.color = this.__color
                	attrs.visible = this.visible
                	attrs.radius = this.radius
                	attrs.emissive = this.emissive
                	attrs.opacity = this.opacity
                	var obj = args[i]
                	if (toType(obj) == 'object' && !(obj instanceof vec)) {
                		if (obj.pos === undefined) throw new Error("A points object point must include a pos.")
                		obj.pos = vec(obj.pos) // make sure that we use a copy of the object's pos
                		for (var a in obj) attrs[a] = obj[a]
                	} else {
                		if (!(obj instanceof vec)) throw new Error("A pos of a points object must be a vector.")
                		attrs['pos'] = vec(obj) // make sure that we use a copy of the object's pos
                    	for (var a in specs) attrs[a] = specs[a]
                	}
                	attrs.__own_color = (attrs.color !== undefined)
                	var D = 2*attrs.radius
                	if (D === 0 && !this.__pixels) D = 1
                	attrs.size = vec(D,D,D)
                	attrs.__parent = this
                    if (retain > -1 && this.__points.length >= retain) {
                    	// If retaining, re-use one of the spheres rather than creating a new one
                    	var N = this.__points.length-retain
                    	for (var d=0; d<N; d++) {
                    		var first = this.__points.shift()
                    		first.visible = false
                    	}
                    	pt = this.__points.shift()
                    	for (var a in attrs) pt[a] = attrs[a]
                    } else {
                    	attrs.canvas = this.canvas
                    	pt = simple_sphere(attrs)
                    }
                    this.__points.push(pt)
    			}
        	}
        	this.__change()
        },
        push: function(args) { // synonym for push, for better match to Python]
        	//var temp = this.__setup(args)
        	var a = []
        	for (var i=0; i<arguments.length; i++) a.push(arguments[i])
        	var temp = this.__setup(a)
        	this.__push_and_append(temp[0], temp[1])
        },
        append: function(args) { // synonym for push, for better match to Python]
        	var a = []
        	for (var i=0; i<arguments.length; i++) a.push(arguments[i])
        	var temp = this.__setup(a)
        	this.__push_and_append(temp[0], temp[1])
        },
        pop: function(n) {
            return this.pypop(n)
        },
        pypop: function(n) { // VPython pop
        	var p
        	var noriginal = n
        	if (n === undefined) n = this.__points.length-1
        	else if (n < 0) n += this.__points.length
        	if (n >= 0 && n < this.__points.length) {
        		p = this.__points[n]
            	if (n > 0) {
            		this.__points[n-1].__nextsegment = p.__nextsegment
            		this.__points[n-1].__change()
            	}
        		if (n < this.__points.length-1) {
            		this.__points[n+1].__prevsegment = p.__prevsegment
            		this.__points[n+1].__change()
        		}
        		var start = this.__points.slice(0,n)
        		var end = this.__points.slice(n+1)
        		this.__points = start.concat(end)
        	} else throw new Error('Cannot execute pop('+noriginal+'); curve has only '+this.__points.length+' points.')
            p.visible = false
            this.__change()
            return {pos:p.pos, color:p.color, radius:p.radius, visible:p.visible}
        },
        point: function (N) {
        	var p = this.__points.slice(N,N+1)[0]
        	return {pos:p.pos, color:p.color, radius:p.radius, visible:p.visible}
        },
        clear: function() {
            this.splice(0,this.__points.length)
            this.__points = []
            this.__change()
        },
        shift: function() {
            return this.pypop(0)
        },
        unshift: function(args) {
            var pts = []
            if (args.length !== undefined) pts = args
            else for (var i=0; i<arguments.length; i++) pts.push(arguments[i]) 
            this.splice(0,0,pts)
            this.__change()
        },
        splice: function(args) {
            var index = arguments[0]
            var howmany = arguments[1]
            var pts = []
            for (var i=2; i<arguments.length; i++) {
            	var arg = RSdict_to_JSobjectliteral(arguments[i])
            	pts.push(arg)
            }
            if (pts.length == 1 && pts[0].length !== undefined) pts = pts[0]
            var s = this.__points.slice(index+howmany) // points to be saved
            var t = []
            for (var i=0; i<s.length; i++) 
                t.push({pos:s[i].pos, color:s[i].color, radius:s[i].radius, visible:s[i].visible})
            for (var i=index; i<this.__points.length; i++) this.__points[i].visible = false // "delete" howmany points
            this.__points.splice(index) // remove deleted points from this.__points
            this.push(pts) // push the new points
            this.push(t) // add back the saved points
            this.__change()
        },
        modify: function(N, args) {
        	if (N < 0) N += this.__points.length
            if (args instanceof vec) args = {pos:args}
            for (var attr in args) {
                if (attr == 'x') this.__points[N].pos.x = args[attr]
                else if (attr == 'y') this.__points[N].pos.y = args[attr]
                else if (attr == 'z') this.__points[N].pos.z = args[attr]
                else this.__points[N][attr] = args[attr]
            }
            this.__points[N].__change()
            this.__change()
        },
        slice: function(start, end) {
        	if (start < 0) start += this.__points.length
        	if (end < 0) end += this.__points.length
            var s = this.__points.slice(start,end)
            var t = []
            for (var i=0; i<s.length; i++) 
                t.push({pos:s[i].pos, color:s[i].color, radius:s[i].radius, visible:s[i].visible})
            return t
        },
        __update: function() {
            var origin = this.__origin
            var size = this.__size
            var color = this.__color
            var axis = this.__axis
            var up = this.__up

            var data = this.__data
            if (!data) this.__data = data = new Float32Array(20)
            this.__model.id_object[this.__id] = this

        	data[0] = origin.__x; data[1] = origin.__y; data[2] = origin.__z
            data[3] = this.__shininess
            data[4] = axis.__x; data[5] = axis.__y; data[6] = axis.__z, data[7] = this.__emissive ? 1 : 0
            data[8] = up.__x; data[9] = up.__y; data[10] = up.__z
            data[12] = size.__x; data[13] = size.__y; data[14] = size.__z
        	data[15] = this.__radius
            data[16] = color.__x; data[17] = color.__y; data[18] = color.__z
            data[19] = this.__opacity
        }
    })

    // point is solely a curve element and is not exported (not to be confused with the points object)
    function point(args) {
        if (!(this instanceof point)) return new point(args)
        if (args instanceof vec) args = {pos:args}
        this.radius = 0
        for (var id in args)
            this[id] = args[id]
        if (this.pos === undefined) throw new Error("Must specify pos for a point on a curve")
    }
    property.declare( point.prototype, {
        __curve: null,
        pos: new attributeVector(null, 0,0,0),
        color: new attributeVector(null, -1,-1,-1),
        radius: { value: true, onchanged: function() { this.__change() } },
        pickable: { value: true, onchanged: function() { this.__change() } },
        visible: { value: true, onchanged: function() { this.__change() } },
        __change: function() { 
                if (this.__id) {
                    this.__curve.canvas.__changed[this.__id] = this 
                    this.__curve.canvas.__changed[this.__curve.__id] = this.__curve 
                }
            },
        __update: function() {
            var pos = this.__pos
            var radius = this.radius || -1
            var color = this.color || vec(-1,-1,-1)
            var s = this.__prevsegment
            if (s) {
                s[4] = pos.x; s[5] = pos.y; s[6] = pos.z; s[7] = radius;
                s[12] = color.x; s[13] = color.y; s[14] = color.z; // eventually, s[15] = opacity
            }
            s = this.__nextsegment
            if (s) {
                s[0] = pos.x; s[1] = pos.y; s[2] = pos.z; s[3] = radius;
                s[8] = color.x; s[9] = color.y; s[10] = color.z; // eventually, s[11] = opacity
            }
        }
    })
    
    function points(args) { // TODO: shrinking a curve's extent doesn't trigger moving the camera inward; dunno why.
    	if (!(this instanceof points)) {
    		var a = []
    		for (var i=0; i<arguments.length; i++) a.push(arguments[i])
    		return new points(a)  // so curve() is like new curve()
    	}
    	if (args.canvas !== null) { // it's null if first setting up objects; see subclass function
    		initObject(this, points, {})
    		this.__points = [] // list of point objects
	        this.__radius = 0 // means width of a few pixels
	    	this.__retain = -1 // signal that all points should be retained
	    	this.__pixels = true
	    	this.__opacity = 1
	    	this.pickable = true
	    	if (args.length == 1 && toType(args[0]) == 'object') {
	    		var obj = args[0]
		    	if (obj.size_units !== undefined) {
		    		if (obj.size_units == 'pixels') this.__pixels = true
		    		else if (obj.size_units == 'world') this.__pixels = false
		    		else throw new Error('size_units must be "pixels" (the default) or "world".')
		    		delete obj.size_units
		    	}
	            for (var a in obj) { // include user variables
	            	if (a === 'pos') continue
    				this[a] = obj[a]
    				delete obj[a]
	            }
	    	}
            var temp = this.__setup(args) // returns [pos, specs]; specs irrelevant in constructor
            pos = temp[0]
        	if (pos.length > 0) this.__push_and_append(pos, {})
        	this.canvas.__points_objects.push(this)
    	}
    }
    subclass(points, curve)
    property.declare( points.prototype, {
    	origin: {
    		get: function() { throw new Error("The points object has no origin attribute.") },
    		set: function(value) { throw new Error("The points object has no origin attribute.") }
    	},
    	color: {
    		get: function() { return this.__color },
    		set: function(value) {
    			this.__color = value
    			if (!this.__pixels) { // if pixel radius, renderer will adjust color
	    			for (var i=0; i<this.__points.length; i++) {
	    				if (!this.__points[i].__own_color) this.__points[i].color = value
	    			}
    			}
    		}
    	},
    	axis: {
    		get: function() { throw new Error("The points object has no axis attribute.") },
    		set: function(value) { throw new Error("The points object has no axis attribute.") }
    	},
    	size: {
    		get: function() { throw new Error("The points object has no size attribute.") },
    		set: function(value) { throw new Error("The points object has no size attribute.") }
    	},
    	up: {
    		get: function() { throw new Error("The points object has no up attribute.") },
    		set: function(value) { throw new Error("The points object has no up attribute.") }
    	},
    	size_units: {
    		get: function() { return (this.__pixels) ? 'pixels' : 'world' },
    		set: function(value) { 
    			if (value == 'pixels') this.__pixels = true
    			else if (value == 'world') this.__pixels = false
    			else throw new Error("The points object ")
    		}
    	},
    	rotate: {
    		get: function(args) { throw new Error("The points object has no rotate method.") }
    	},
    	shape: {
    		get: function() { return 'round' },
    		set: function(value) { if (value != 'round') throw new Error('The points object only supports shape = "round".')}
    	},
    	visible: {
    		get: function() { return this.__visible },
    		set: function(value) {
    				for (var p in this.__points) {
    					this.__points[p].visible = value
    				}
    				this.__visible = value
    		}
    	},
        __update: function() { } // changes to the points object drive updates to the sphere objects
    })

    function helix(args) { return initObject(this, helix, args) }
    subclass(helix, cylinder)
    property.declare( helix.prototype, {
        __initialize: true,
        thickness: { value: 0, onchanged: function() { this.__change() } },
        coils: { value: 5, onchanged: function() { this.__initialize = true; this.__change() } },
        __update: function () {
            var NCHORDS = 20 // number of chords in one coil of a helix
            
            if (this.__initialize) {
                if (this.__curve !== undefined) {
                    this.__curve.clear()
                } else {
                    this.__curve = new curve({canvas:this.canvas, __no_autoscale:true})
                }
            }

        	var c = this.__curve
            c.origin = this.__pos
        	c.axis = this.__axis
        	c.up = this.__up
        	c.size = this.__size
        	c.color = this.__color
            c.radius = this.__thickness ? this.__thickness / 2 : this.__size.y/40
            if (!this.__initialize) return
            
            // Create a helix in the direction (1,0,0) with length 1 and diameter 1, with specified number of coils
            var X = vec(1,0,0)
            var Y = vec(0,1,0)
            var Z = vec(0,0,1)

            var r = 0.5
            var count = this.__coils * NCHORDS
            var dx = 1/count
            var ds = Math.sin(2 * Math.PI / NCHORDS), dc = Math.cos(2 * Math.PI / NCHORDS)
            var x = 0, y = 0, z = r
            var znew

            for (var i = 0; i < count+1; i++) {
            	c.push( vec(x,y,z) )
            	x += dx
                znew = z * dc - y * ds
                y = y * dc + z * ds
                z = znew
            }
        	this.__initialize = false
        }
    })
    
    function vp_helix(args) { return initObject(this, vp_helix, args) }
    subclass(vp_helix, helix)
    property.declare( vp_helix.prototype, {
        size: new attributeVectorSize(null, 1,2,2),
        radius: {
        	get: function() { return this.__size.__y/2 },
        	set: function(value) {
        		this.__size.__y = this.__size.__z = 2*value
        		this.__change()
        	}
        },
        length: {
        	get: function() { return this.__size.__x },
        	set: function(value) {
        		this.__size.__x = value
        		this.__change()
        	}
        },
	    height: {
	    	get: function() { return this.__size.__y },
	    	set: function(value) {
	    		this.__size.__y = value
	    		this.__change()
	    	}
	    },
        width: {
        	get: function() { return this.__size.__z },
        	set: function(value) {
        		this.__size.__z = value
        		this.__change()
        	}
        }
    })

	function arrayequals(a,b) {
	    var La = a.length
	    var Lb = b.length
	    if (La !== Lb) return false
	    for (var i=0; i<La; i++) if (a[i] !== b[i]) return false
	    return true
	}
    
	function ring(args) { return initObject(this, ring, args) }
    subclass(ring, box)
    property.declare( ring.prototype, {
        size: new attributeVector(null, 0.1,1,1)
    })
    
	function vp_ring(args) { return initObject(this, vp_ring, args) }
    subclass(vp_ring, vp_box)
    property.declare( vp_ring.prototype, {
    	size: new attributeVector(null, 0.2,2.2,2.2),
        thickness: {
        	get: function() { return this.__size.__x/2 },
        	set: function(value) {
        		var R1 = this.radius
        		this.__thickness = value
        		this.__size.x = 2*value
        		this.__size.y = this.__size.z = 2*(value + R1)
        		this.__change()
        	}
        },
        radius: {
        	get: function() { return (this.__size.y-this.__size.x)/2 },
        	set: function(value) {
        		var R2 = this.thickness
        		this.__radius = value
        		this.__size.y = this.__size.z = 2*(value + R2)
        		this.__change()
        	}
        }
    })

    function distant_light(args) {
        if (!(this instanceof distant_light)) return new distant_light(args)  // so distant_light() is like new distant_light()
        if (args.direction === undefined) throw new Error("Must specify the distant_light direction.")
        init(this, args)
        this.canvas.lights.push(this)
    }
    property.declare( distant_light.prototype, {
        direction: new attributeVector(null, 0,0,1),
        color: new attributeVector(null, 1,1,1),
        visible: true,
        __get_model: function() { return null },
        __change: function() {}
    })

    function local_light(args) {
        if (!(this instanceof local_light)) return new local_light(args)  // so local_light() is like new local_light()
        if (args.pos === undefined) throw new Error("Must specify the local_light position.")
        init(this, args)
        this.canvas.lights.push(this)
    }
    property.declare( local_light.prototype, {
        pos: new attributeVector(null, 0,0,0),
        color: new attributeVector(null, 1,1,1),
        visible: true,
        __get_model: function() { return null },
        __change: function() {}
    })

    function draw(args) {
    // This is adequate for GlowScript purposes, including drawing an icon for scene.pause.
    // However, it needs more work before release and documentation, because there is no
    // mechanism here for detecting changes in the this.points array.
        if (!(this instanceof draw)) return new draw(args)  // so draw() is like new draw()
        args = args || {}

        this.points = []
        init(this, args)

        this.canvas.__overlay_objects.objects.push(this) // should be in list of visible objects
    }
    property.declare( draw.prototype, {
        color: { value: null, type: property.nullable_attributeVector },
        fillcolor: { value: null, type: property.nullable_attributeVector },
        linewidth: { value: 1, onchanged: function() { this.__change() } }, 
        opacity: { value: 0.66, onchanged: function() { this.__change() } }, 
        visible: { value: false, onchanged: function() { this.__change() } },

        __get_model: function() { return this.canvas.__renderer.models[this.constructor.name] },
        __update: function (ctx, camera) {
            var pts = this.points.length
            if (pts < 2) return
            if (this.fillcolor != null) {
                ctx.lineWidth = 1
                ctx.fillStyle = color.to_html_rgba(this.fillcolor, this.opacity)
                ctx.beginPath()
                for (var i=0; i<pts; i++) {
                    if (i == 0) ctx.moveTo(this.points[i].x,this.points[i].y)
                    else ctx.lineTo(this.points[i].x,this.points[i].y)
                }
                ctx.fill()
            }
            
            if (this.color != null) {
                ctx.lineWidth = this.linewidth
                ctx.strokeStyle = color.to_html_rgba(this.color, this.opacity)
                ctx.beginPath()
                for (var i=0; i<pts; i++) {
                    if (i == 0) ctx.moveTo(this.points[i].x,this.points[i].y)
                    else if (i == pts-1 && this.points[i].equals(this.points[0])) ctx.closePath()
                    else ctx.lineTo(this.points[i].x,this.points[i].y)
                }
                ctx.stroke()
            }
        },
        __change: function () { this.canvas.__overlay_objects.__changed = true }
    })

    function label(args) {
        if (!(this instanceof label)) return new label(args)  // so label() is like new label()
        args = args || {}

        this.pos = this.pos
        this.color = this.color
        init(this,args)

        this.canvas.__overlay_objects.objects.push(this) // should be in list of visible objects
    }
    property.declare( label.prototype, {
        pos: new attributeVector(null, 0,0,0), 
        color: { value: null, type: property.nullable_attributeVector },
        line: { value: true, onchanged: function() { this.__change() } },
        linecolor: { value: null, type: property.nullable_attributeVector },
        background: { value: null, type: property.nullable_attributeVector },
        opacity: { value: 0.66, onchanged: function() { this.__change() } },
        text: { value: "", onchanged: function() { this.__change() } },
        font: { value: "Arial", onchanged: function() { this.__change() } },
        height: { value: 15, onchanged: function() { this.__change() } },
        visible: { value: false, onchanged: function() { this.__change() } },
        align: { value: null, onchanged: function() { this.__change() } },
        box: { value: true, onchanged: function() { this.__change() } },
        border: { value: 5, onchanged: function() { this.__change() } },
        linewidth: { value: 1, onchanged: function() { this.__change() } }, 
        xoffset: { value: 0, onchanged: function() { this.__change() } },
        yoffset: { value: 0, onchanged: function() { this.__change() } },
        space: { value: 0, onchanged: function() { this.__change() } },
        // if pixel_pos == true, pos interpreted as a pixel position:
        pixel_pos: { value: false, onchanged: function() { this.__change() } }, 

        __get_model: function () { return null },
        __update: function (ctx, camera) {
        	// Explanation of this rather complex label display:
        	// First we run through all the lines of a possibly multiline text,
        	// find the maximuom width, and determine, given this.__align, how
        	// the lines should be displayed inside a bounding box (which may
        	// not be displayed, depending on this.__box).
        	// Next we decide where this block of text should be displayed,
        	// and therefor where to draw the box, and a possible line to the box.
        	// The height in pixels of a text with nlines, where dh is 1.3*this.__height, is
        	//     (nlines-1)*dh + this.__height
        	// because the distance from the vertical midpoint of the first and last lines
        	// is (nlines-1)*dh, and there is in addition the upper part of the fist line and
        	// the lower part of the last line. The box (if drawn) is this.__border from
        	// the edges of the block of text.
            var xoffset = this.__xoffset, yoffset = this.__yoffset
            var posx, posy
            if (this.__pixel_pos) {
                posx = this.__pos.x
                posy = this.canvas.__height - this.__pos.y
                yoffset = -yoffset
            } else {
                if (this.canvas.__width >= this.canvas.__height) var factor = 2 * this.canvas.__range / this.canvas.__height // real coord per pixel
                else var factor = 2 * this.canvas.__range / this.canvas.__width
                var viewMatrix = mat4.lookAt(camera.pos, camera.target, camera.up)
                var vnew = mat4.multiplyVec3(viewMatrix, vec3.create([this.pos.x, this.pos.y, this.pos.z]))
                // Check for wrap-around or out-of-range label
                if (vnew[2] > -camera.zNear || vnew[2] < -camera.zFar) return
                var d = camera.distance
                var k = -d/(vnew[2]*factor)
                posx = Math.round(k * vnew[0] + this.canvas.__width / 2) // label.pos in terms of pixels
                posy = Math.round(-k * vnew[1] + this.canvas.__height / 2)
            }

            var h = this.__height
            var upperchar = 0.4*this.__height // from y of text location to top of the character; approximate
            var f = this.__font
            if (this.__font == 'sans') f = 'Arial'
            else if (this.__font == 'serif') f = 'Georgia'
            ctx.textBaseline = 'middle'
            ctx.lineWidth = this.__linewidth
            var default_color = vec(1,1,1)
            if (this.canvas.__background.equals(vec(1,1,1))) default_color = vec(0,0,0)
            ctx.strokeStyle = color.to_html(this.__linecolor || this.__color || default_color)
            
            // Layout text, return bounding box info
            var info = parse_html( {ctx: ctx, text: print_to_string(this.__text), x: posx, y: posy, align: this.__align || 'center', font: f, fontsize: h, color: this.__color || default_color} )
            var nlines = info.lines.length
            var width = info.maxwidth
            var dh = 1.3*this.__height // vertical spacing from one line to the next
            var height = this.__height + (nlines-1)*dh // from top of top line to bottom of bottom line, without borders
            
            /*
            var xbase // left edge of text
            var ybase = posy // y position of first line of text
            var border = this.__border
            switch (this.__align) { 
	        	case null: // if program didn't specify an alignment, default is 'center'
	            case 'center':
	                xbase = posx - width/2
	                break
	            case 'left':
	            	xbase = posx
	            	break
	            case 'right':
	                xbase = posx - width
	                break
	        }
	        */

            // Determine placement of text
            var xbase // left edge of text
            var ybase // y position of first line of text
            var border = this.__border
        	if (xoffset || yoffset) {
        		if (Math.abs(yoffset) > Math.abs(xoffset)) {
        			if (yoffset > 0) { // line goes to center of bottom of box
        				xbase = posx + xoffset - width/2
        				ybase = posy - yoffset - height - border + upperchar
        			} else { // line goes to center of top of box
        				xbase = posx + xoffset - width/2
        				ybase = posy - yoffset + border + upperchar
        			}
        		} else if (Math.abs(xoffset) > 0) {
    				ybase = posy - yoffset - height/2 + upperchar
        			if (xoffset > 0) { // line goes to left edge of box
        				xbase = posx + xoffset + border
	        		} else if (xoffset < 0) { // line goes to right edge of box
	        			xbase = posx + xoffset - width - border
	        		}
        		}
        	} else {
        		ybase = posy
                switch (this.__align) { 
	            	case null: // if program didn't specify an alignment, default is 'center'
	                case 'center':
	                    xbase = posx - width/2
	                    break
	                case 'right':
	                    xbase = posx - width
	                    break
	                case 'left':
	                	xbase = posx
	                	break
                }
        	}

            var bcolor
            if (this.__background == null) bcolor = this.canvas.__background
            else bcolor = this.__background
            ctx.fillStyle = color.to_html_rgba(bcolor, this.__opacity)
            ctx.fillRect(xbase-border, ybase-upperchar-border, width+2*border, height+2*border)
            
            if ((xoffset || yoffset) && this.__line) { // draw a line to the box
            	ctx.beginPath()
                if (this.space > 0) {
                    var v = (vec(xoffset, -yoffset, 0).norm()).multiply(this.space)
                    v = v.add(vec(posx, posy, 0))
                    ctx.moveTo(v.x, v.y)
                } else ctx.moveTo(posx, posy)
                ctx.lineTo(posx+xoffset, posy-yoffset)
                ctx.stroke()
            }
            
            if (this.__box) { // draw a box around the text
                ctx.beginPath()
                ctx.moveTo(xbase-border, ybase-upperchar-border)
                ctx.lineTo(xbase+width+border, ybase-upperchar-border)
                ctx.lineTo(xbase+width+border, ybase-upperchar+height+border)
                ctx.lineTo(xbase-border, ybase-upperchar+height+border)
                ctx.closePath()
                ctx.stroke()
            }
            info.x = xbase
            info.y = ybase
            switch (this.__align) { 
	        	case null: // if program didn't specify an alignment, default is 'center'
	            case 'center':
	                info.x += width/2
	                break
	            case 'right':
	            	info.x += width
	                break
	            case 'left':
	            	info.x += 0
	            	break
	        }
            display_2D(info)
        },
        __change: function () { if (this.canvas !== undefined) this.canvas.__overlay_objects.__changed = true }
    })

    function attach_trail(objectOrFunction, options) {
        if (!(this instanceof attach_trail)) return new attach_trail(objectOrFunction, options)  // so attach_trail() is like new attach_trail()
        if (options === undefined) options = {}
        this.__options = {}
        this.__obj = objectOrFunction // either an object or a function or a string
        if (options.canvas !== undefined) this.canvas = options.canvas
        else this.canvas = canvas.selected
        var radius = 0
        if (options.type === undefined) {
            this.type = 'curve'
        } else {
            switch (options.type) {
                case 'curve':
                    this.type = options.type
                    break
                case 'spheres': // JavaScript name
                case 'points':  // VPython name
                    this.type = "points"
                    this.__options['size_units'] = "world" // make default size units same as those of curve
                    break
                default:
                    throw new Error("attach_trail type must be 'curve' or 'points' (or 'spheres')")
            }
        }
        if (typeof objectOrFunction !== "function" && typeof objectOrFunction !== "string") { // an object
        	this.canvas = objectOrFunction.canvas
        	this.__options['color'] = objectOrFunction.color
            if (options.radius === undefined) {
            	if (this.type == 'points') radius = 0.1*objectOrFunction.size.y
            } else radius = options.radius
        } else {
            if (options.radius !== undefined) radius = options.radius
        }
        this.__options['radius'] = this.__radius = radius
        this.__options['canvas'] = this.canvas
        if (options.color !== undefined) {
        	this.__options['color'] = options.color
        } else this.__options['color'] = vec(1,1,1)
        this.__options['retain'] = -1
        if (options.retain !== undefined) {
        	this.__options['retain'] = options.retain
        }
        this.pps = 0 // means show all trail points
        if (options.pps !== undefined) {
        	this.pps = options.pps
        }
        this.__options['pickable'] = false
        var send = {} // send a copy to curve or points, to prevent overwrite of this.__options
        for (var a in this.__options) send[a] = this.__options[a]
        if (this.type == 'curve') this.__trail = curve(send)
        else this.__trail = points(send)
        this.__trails = [this.__trail] // keep a list of curves we've made
        this.canvas.trails.push(this)
        this.__last_pos = null
        this.__last_time = null
        this.__run = true
        this.__elements = 0 // number of points created
    }
	property.declare( attach_trail.prototype, {
        color: {
        	get: function() { return this.__options.color },
        	set: function(value) { this.__options.color = value }
        },
        radius: {
        	get: function() { return this.__options.radius },
        	set: function(value) { this.__options.radius = value }
        },
        retain: {
        	get: function() { return this.__options.retain },
        	set: function(value) { this.__options.retain = value }
        },
        start: function () {
            this.__run = true
            var send = {} // send a copy to curve or points, to prevent overwrite of this.__options
            for (var a in this.__options) send[a] = this.__options[a]
            if (this.type === 'curve') this.__trail = curve(send) // start new curve
            else this.__trail = points(send)
            this.__trails.push(this.__trail) // keep a list of curves we've made
        },
        stop: function() { this.__run = false },
        clear: function() {
            this.__last_pos = null
            this.__last_time = null
            this.__elements = 0 // number of points created
            for (var i=0; i<this.__trails.length; i++) this.__trails[i].clear()
            if (typeof this.__obj !== "function") this.__obj.__ninterval = 0 // ensure proper handling of first new point; see __update_trail
        }
	})

    function attach_arrow(obj, attr, options) {
        if (!(this instanceof attach_arrow)) return new attach_arrow(obj, attr, options)  // so attach_trail() is like new attach_trail()
        if (options === undefined) options = {}
        if (options.canvas === undefined) options.canvas = obj.canvas
        this.obj = obj
        this.attr = attr
        this.scale = 1
        if (options.scale !== undefined) {
            this.scale = options.scale
            delete options.scale
        }
        if (options.color === undefined) options.color = obj.color
        this.options = options
        var thiscanvas = options.canvas
        if (window.__GSlang == 'vpython') this.arrow = vp_arrow(this.options)
        else this.arrow = arrow(this.options)
        this.arrow.visible = false
        this.arrow.pickable = false
        this.last_pos = null
        this.run = true
        this.shaftwidth = this.arrow.shaftwidth
        this.color = this.arrow.color
        thiscanvas.arrows.push(this)
        
        this.start = function() {this.arrow.visible = this.run = true}
        this.stop = function()  {this.arrow.visible = this.run = false}
    }
	
	function rgb_to_css(c) {
		var r = Math.floor(255*c.x).toString()
		var g = Math.floor(255*c.y).toString()
		var b = Math.floor(255*c.z).toString()
		return 'rgb('+r+','+g+','+b+')'
	}
	
	var widgetid = 0

	function radio(args) { // a radio button
	    if (!(this instanceof radio)) return new radio(args)  // so radio() is like new radio()
	    var cvs = canvas.get_selected()
	    var attrs = {pos:cvs.caption_anchor, checked:false, text:''}
	    if (args.bind !== undefined) {
	    	attrs.bind = args.bind
	    	delete args.bind
	    } else throw new Error("A radio button must have a bind attribute.")
	    for (a in attrs) {
	    	if (args[a] !== undefined) {
	    		attrs[a] = args[a]
	    		delete args[a]
	    	}
	    }
		widgetid++
		attrs._id = widgetid.toString()
		attrs.jradio = $('<input type="radio"/>').css({width:'16px', height:'16px'}).appendTo(attrs.pos)
		.click( function() {
			attrs.checked = !attrs.checked
			$(attrs.jradio).prop('checked', attrs.checked)
			attrs.bind(cradio) 
		} )
		$('<span id='+attrs._id+'> '+attrs.text+'</span>').appendTo(attrs.pos)
		
		var cradio = { // this structure implements a JavaScript "closure", essential for radio to work
	        get disabled() {return attrs.disabled},
	        set disabled(value) {
	        	attrs.disabled = value
	            $(attrs.jradio).attr('disabled', attrs.disabled)
	            if (attrs.disabled)
	            	$("#"+attrs._id).css({color:rgb_to_css(vec(0.7,0.7,0.7))})
	            else
	            	$("#"+attrs._id).css({color:rgb_to_css(vec(0,0,0))})
	        },
	        get checked() {return attrs.checked},
	        set checked(value) {
	            attrs.checked = value
	            $(attrs.jradio).prop('checked', value)
	        },
	        get text() {return attrs.text},
	        set text(value) {
	        	attrs.text = value
	        	$('#'+attrs._id).html(' '+value)
	        },
	        remove: function() {
//	        	attrs.disabled = true
//	            $(attrs.jradio).attr('disabled', attrs.disabled)
	        	$(attrs.jradio).remove()
	            $("#"+attrs._id).remove()
	        }	
		}
	    for (var a in args) { // include user-defined attributes
	    	cradio[a] = args[a]
	    }
		cradio.checked = attrs.checked
		return cradio
	}

	function checkbox(args) { // a checkbox
	    if (!(this instanceof checkbox)) return new checkbox(args)  // so checkbox() is like new checkbox()
	    var cvs = canvas.get_selected()
	    var attrs = {pos:cvs.caption_anchor, checked:false, text:''}
	    if (args.bind !== undefined) {
	    	attrs.bind = args.bind
	    	delete args.bind
	    } else throw new Error("A checkbox must have a bind attribute.")
	    for (a in attrs) {
	    	if (args[a] !== undefined) {
	    		attrs[a] = args[a]
	    		delete args[a]
	    	}
	    }
		widgetid++
		attrs._id = widgetid.toString()
		attrs.jcheckbox = $('<input type="checkbox"/>').css({width:'16px', height:'16px'}).appendTo(attrs.pos)
		.click( function() {
			attrs.checked = !attrs.checked
			$(attrs.jcheckbox).prop("checked", attrs.checked)
			attrs.bind(ccheckbox) 
		} )
		$('<span id='+attrs._id+'> '+attrs.text+'</span>').appendTo(attrs.pos)
		
		var ccheckbox = { // this structure implements a JavaScript "closure", essential for checkbox to work
	        get disabled() {return attrs.disabled},
	        set disabled(value) {
	        	attrs.disabled = value
	            $(attrs.jcheckbox).attr('disabled', attrs.disabled)
	            if (attrs.disabled)
	            	$("#"+attrs._id).css({color:rgb_to_css(vec(0.7,0.7,0.7))})
	            else
	            	$("#"+attrs._id).css({color:rgb_to_css(vec(0,0,0))})
	        },
	        get checked() {return attrs.checked},
	        set checked(value) {
	            attrs.checked = value
	            $(attrs.jcheckbox).prop("checked", value)
	        },
	        get text() {return attrs.text},
	        set text(value) {
	        	attrs.text = value
	        	$('#'+attrs._id).html(' '+value)
	        },
	        remove: function() {
//	        	attrs.disabled = true
//	            $(attrs.jcheckbox).attr('disabled', attrs.disabled)
	            $(attrs.jcheckbox).remove()
	            $("#"+attrs._id).remove()
	        }
		}
	    for (var a in args) { // include user-defined attributes
	    	ccheckbox[a] = args[a]
	    }
		ccheckbox.checked = attrs.checked
		return ccheckbox
	}

	function wtext(args) { // a wtext (widget text) allows modification after insertion in caption or title
	    if (!(this instanceof wtext)) return new wtext(args)  // so wtext() is like new wtext()
	    args = args || {}
	    var cvs = canvas.get_selected()
	    var attrs = {pos:cvs.caption_anchor, text:''}
	    for (var a in attrs) {
	    	if (args[a] !== undefined) {
	    		attrs[a] = args[a]
	    		delete args[a]
	    	}
	    }
		widgetid++
		attrs._id = widgetid.toString()
		$('<span id='+attrs._id+'>'+print_to_string(attrs.text)+'</span>').appendTo(attrs.pos)
		
		var cwtext = { // this structure implements a JavaScript "closure", essential for wtext to work
	        get text() {return attrs.text},
	        set text(value) {
	        	attrs.text = value
	        	$('#'+attrs._id).html(print_to_string(value))
	        },
	        remove: function() {
	            $("#"+attrs._id).remove()
	        }
		}
	    for (var a in args) { // include user-defined attributes
	    	cwtext[a] = args[a]
	    }
		return cwtext
	}
	
	function button(args) {
	    if (!(this instanceof button)) return new button(args)  // so button() is like new button()
	    var cvs = canvas.get_selected()
	    var attrs = {pos:cvs.caption_anchor, text:' ', color:vec(0,0,0), background:vec(1,1,1), disabled:false}
	    if (args.bind !== undefined) {
	    	attrs.bind = args.bind
	    	delete args.bind
	    } else throw new Error("A button must have a bind attribute.")
	    for (a in attrs) {
	    	if (args[a] !== undefined) {
	    		attrs[a] = args[a]
	    		delete args[a]
	    	}
	    }
	    attrs.jbutton = $('<button/>').html(attrs.text).appendTo(attrs.pos)
	    		.css({color:rgb_to_css(attrs.color), backgroundColor:rgb_to_css(attrs.background), "font-size":"15px"})
	    		.click( function() { attrs.bind(cbutton) } )
	    $(attrs.pos).append(' ')
	    
	    var cbutton = { // this structure implements a JavaScript "closure", essential for <button/> to work
	        get disabled() {return attrs.disabled},
	        set disabled(value) {
	        	attrs.disabled = value
	            $(attrs.jbutton).attr('disabled', attrs.disabled)
	            if (attrs.disabled)
	            	$(attrs.jbutton).css({color:rgb_to_css(vec(0.7,0.7,0.7)), backgroundColor:rgb_to_css(vec(1,1,1))})
	            else
	            	$(attrs.jbutton).css({color:rgb_to_css(attrs.color), backgroundColor:rgb_to_css(attrs.background)})
	        },
	        get text() {return attrs.text},
	        set text(value) {
	        	attrs.text = value
	            $(attrs.jbutton).html(attrs.text)
	        },
	        get textcolor() {return attrs.color}, // legacy name; no apparent reason why it was "textcolor" instead of "color"
	        set textcolor(value) {
	        	attrs.color = value
	            $(attrs.jbutton).css({color:rgb_to_css(attrs.color)})
	        },
	        get color() {return attrs.color},
	        set color(value) {
	        	attrs.color = value
	            $(attrs.jbutton).css({color:rgb_to_css(attrs.color)})
	        },
	        get background() {return attrs.background},
	        set background(value) {
	        	attrs.background = value
	            $(attrs.jbutton).css({backgroundColor:rgb_to_css(attrs.background)})
	        },
	        remove: function() {
	        	attrs.disabled = true
	            $(attrs.jbutton).attr('disabled', attrs.disabled)
	            $(attrs.jbutton).remove()
	        }
	    }
	    for (var a in args) { // include user-defined attributes
	    	cbutton[a] = args[a]
	    }
	    cbutton.disabled = attrs.disabled
	    return cbutton
	}
	
	var slider_id = 0
	
	function slider(args) {
	    if (!(this instanceof slider)) return new slider(args)  // so slider() is like new slider()
	    var cvs = canvas.get_selected()
	    var attrs = {pos:cvs.caption_anchor, length:400, width:10, vertical:false,
	    			 min:0, max:1, align:'left', left:0, right:0, top:0, bottom:0}
	    if (args.bind !== undefined) {
	    	attrs.bind = args.bind
	    	delete args.bind
	    } else throw new Error("A slider must have a bind attribute.")
	    for (a in attrs) {
	    	if (args[a] !== undefined) {
	    		attrs[a] = args[a]
	    		delete args[a]
	    	}
	    }
	    attrs.step = 0.001*(attrs.max-attrs.min)
	    if (args.step !== undefined) {
	    	attrs.step = args.step
	    	delete args.step
	    }
	    attrs.value = attrs.min
	    if (args.value !== undefined) {
	    	attrs.value = args.value
	    	delete args.value
	    }
	    attrs._id = 's'+slider_id
	    slider_id += 1
    	var m = attrs.top+'px ' + attrs.right+'px ' + attrs.bottom+'px '+ attrs.left+'px'
    	var o = 'horizontal'
    	var w = attrs.length
    	var h = attrs.width
	    if (attrs.vertical) {
	    	o = 'vertical'
	    	w = attrs.width
	    	h = attrs.length
	    }
	    // evt.originalEvent is undefined if the change or slide is made by the user;
	    // otherwise the slider value has been changed by program, in which case 
	    // we do NOT call the bound function, as it makes it difficult to manage
	    // multiple sliders that interact, as in the RGB-HSV demo program.
	    $("<span id="+attrs._id+"></span>").css({width:w, height:h,
	    						float:attrs.align, margin:m}).appendTo(attrs.pos)
	    attrs.jslider = $( "#"+attrs._id ).slider({orientation:o, range:"min", 
    		min:attrs.min, max:attrs.max, value:attrs.value, step:attrs.step,
    		change: function (evt) {
    			if (!attrs.disabled && evt.originalEvent !== undefined) attrs.bind(cslider)
    		},
    		slide:  function (evt) {
    			if (!attrs.disabled && evt.originalEvent !== undefined) attrs.bind(cslider)
    		}
	    })
	    
	    var cslider = {
	    	// Was unable to figure out how to disable being able to drag the slider (but events are not passed on if disabled)
	        get disabled() {return attrs.disabled},
	        set disabled(value) {attrs.disabled = value},
	        
	        get min() {return attrs.min},
	        set min(value) {throw new Error("Cannot change the min of an existing slider.")},
	        
	        get max() {return attrs.max},
	        set max(value) {throw new Error("Cannot change the max of an existing slider.")},
	        
	        get value() {return $(attrs.jslider).slider('value')},
	        set value(val) {$(attrs.jslider).slider('value',val)},
	        
	        get width() {return attrs.width},
	        set width(value) {throw new Error("Cannot change the width of an existing slider.")},
	        
	        get length() {return attrs.length},
	        set length(value) {throw new Error("Cannot change the length of an existing slider.")},
	        
	        remove: function() {
	        	attrs.disabled = true
	            $(attrs.jslider).attr('disabled', attrs.disabled)
	            $(attrs.jslider).remove()
	        }
	    }
	    for (var a in args) { // include user-defined attributes
	    	cslider[a] = args[a]
	    }
	    return cslider
	}
	
	function menu(args) {
	    if (!(this instanceof menu)) return new menu(args)  // so slider() is like new slider()
	    var cvs = canvas.get_selected()
	    var attrs = {pos:cvs.caption_anchor, selected:null} // selected = -1 means no choice is highlighted initially
		if (args.bind !== undefined) {
			attrs.bind = args.bind
			delete args.bind
		} else throw new Error("A menu must have a bind attribute.")
	    if (args.pos !== undefined) {
	    	attrs.pos = args.pos
	    	delete args.pos
	    }
		if (args.choices !== undefined) {
			attrs.choices = args.choices
			delete args.choices
		} else throw new Error("A menu must have a a list of choices.")
	    if (args.selected !== undefined) {
	    	attrs.selected = args.selected
	    	delete args.selected
	    }
	    var s = ''
	    for (var i=0; i<attrs.choices.length; i++) {
	    	var cc = attrs.choices[i]
	    	if (cc === attrs.selected) s += '<option selected="selected">' + cc + '</option>\n'
	    	else s += '<option>' + cc + '</option>\n'
	    }
	    attrs.jmenu = $('<select>'+s+'</select>').css("font-size","15px").change(function () {
	    	attrs.bind(cmenu)
	    }).appendTo(attrs.pos)
	    $(attrs.pos).append(' ')
	    
	    var cmenu = { // this structure implements a JavaScript "closure", essential for menu to work
	        get disabled() {return attrs.disabled},
	        set disabled(value) {
	        	attrs.disabled = value
	            $(attrs.jmenu).attr('disabled', attrs.disabled)
	            if (attrs.disabled)
	            	$(attrs.jmenu).css({color:rgb_to_css(vec(0.7,0.7,0.7)), backgroundColor:rgb_to_css(vec(1,1,1))})
	            else
	            	$(attrs.jmenu).css({color:rgb_to_css(attrs.color), backgroundColor:rgb_to_css(attrs.background)})
	        },
	        get selected() {return $(attrs.jmenu).val()},
	        set selected(value) {$(attrs.jmenu).val(value)},
	        	
	        get choices() {return attrs.choices},
	        set choices(value) {throw new Error("The list of choices cannot be changed after creating a menu.")},
	        
	        get index() {return attrs.choices.indexOf($(attrs.jmenu).val())},
	        set index(value) {$(attrs.jmenu).val(attrs.choices[value])},
	        
	        remove: function() {
	        	attrs.disabled = true
	            $(attrs.jmenu).attr('disabled', attrs.disabled)
	            $(attrs.jmenu).remove()
	        }
		}
	    for (var a in args) { // include user-defined attributes
	    	cmenu[a] = args[a]
	    }
		return cmenu
	}

    eval("0") // Force minifier not to mangle e.g. box function name (since it breaks constructor.name)

    var exports = {
        box: box, vp_box: vp_box,
        cylinder: cylinder, vp_cylinder: vp_cylinder,
        cone: cone, vp_cone: vp_cone,
        pyramid: pyramid, vp_pyramid: vp_pyramid,
        sphere: sphere, vp_sphere: vp_sphere, vp_ellipsoid: vp_ellipsoid,
        simple_sphere: simple_sphere,
        arrow: arrow, vp_arrow: vp_arrow,
        curve: curve,
        points: points,
        paths: paths,
        shapes: shapes,
        helix: helix, 
        vp_helix: vp_helix,
        ring: ring, 
        vp_ring: vp_ring,
        compound: compound,
        vp_compound: vp_compound,
        vertex: vertex,
        triangle: triangle,
        quad: quad,
        draw: draw,
        label: label,
        distant_light: distant_light,
        local_light: local_light,
        attach_trail: attach_trail,
        attach_arrow: attach_arrow,
        textures: textures,
        bumpmaps: bumpmaps,
        text: text,
        wtext: wtext,
        radio: radio,
        checkbox: checkbox,
        button: button,
        slider: slider,
        menu: menu,
    }

    Export(exports)
})()