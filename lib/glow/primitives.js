; (function () {
    "use strict";

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

    // Factored because there are way too many things that add themselves to canvas in different ways
    // TODO: Make them all subclasses of VisualObject or something and give them a uniform way of tracking themselves!
    // TODO: Prohibit or handle changing primitive.canvas (need to update model even if it is invisible)
    function init(obj, args) {
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
            obj.canvas.__activate()
            obj.__model = obj.__get_model()
        }
        if (args.__obj) { // indicates an object that is a component, such as arrow
        	obj.__obj = args.__obj
        	delete args.__obj
        }
        
        /*
    	if (obj.constructor == curve || obj.constructor == points) {
        	var attrs = ['pos', 'color', 'radius', 'retain']
        	var pointarg = {}
        	for (var a in attrs) {
        		var attr = attrs[a]
        		if (args[attr] !== undefined) {
        			pointarg[attr] = args[attr]
        			if (attr != 'pos') obj[attr] = args[attr]
        			delete args[attr]
        		}
        	}
        	pointarg['_constructor'] = true
    		obj.push(pointarg)
    	}
    	*/

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
        	obj.axis = args.axis
        	delete args.axis
        }
        if (args.size !== undefined) {
        	obj.size = args.size
        	delete args.size
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

        for (var id in args) obj[id] = args[id]

        // We have to set visible unless args has visible set, or canvas is null (initial subclass setup)
        if (args.visible === undefined && obj.canvas !== null) obj.visible = true
    }

    function initObject(obj, constructor, args) {
        if (!(obj instanceof constructor)) return new constructor(args)  // so box() is like new box()
        args = args || {}  // so box() is like box({})
        obj.__tex = {file: null, bumpmap: null, texture_ref: {reference: null}, bumpmap_ref: {reference: null}, 
				  left: false, right: false, sides: false, flipx: false, flipy: false, turn: 0, flags: 0 }

    	// We have to initialize ALL vector attributes here, because they need
		// pointers back to "this" :-(
        if (constructor != curve && constructor != points) { if (args.pos === undefined) obj.pos = obj.pos }
        if (args.color === undefined) obj.color = obj.color
        if (constructor == curve) obj.origin = obj.origin
        if (constructor != points) {
        	if (constructor == arrow) {
        		if (args.axis !== undefined) throw new Error("arrow does not have axis; replace with axis_and_length")
        		else if (args.axis_and_length === undefined) obj.axis_and_length = obj.axis_and_length
        	} else if (constructor == vp_arrow && args.axis_and_length !== undefined) {
        		throw new Error("VPython arrow does not have axis_and_length; replace with axis")
        	} else if (args.axis === undefined) obj.axis = obj.axis
	        if (args.up === undefined) obj.up = obj.up
	        if (args.size === undefined) obj.size = obj.size
        }
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
        color: new attributeVector(null, 1,1,1),
        up:    new attributeVector(null, 0,1,0),
        axis:  new attributeVector(null, 1,0,0),
        size:  new attributeVector(null, 1,1,1),
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
            	if (this.__obj) return this.__obj.__id != null // component objects are handled by their parent
            	return this.__id != null 
            },
            set: function(value) {
            	if (this.__obj) return // component objects are handled by their parent
                if (value == (this.__id != null)) return // no change in visible status
                if (this.__deleted) return // do not make visible a deleted object
                if (this.__curve) this.__curve.visible = value
                if (value) {
                    if (this.constructor == vp_arrow || this.constructor == arrow) {
                    	if (!this.__components) this.__update() // need to create the components (box and pyramid)
	                    this.__id = nextVisibleId
                    	var fc
                    	nextVisibleId++
                        for (var i = 0; i < this.__components.length; i++) {
                        	var c = this.__components[i]
                        	c.__id = nextVisibleId
                        	if (i === 0) fc = id_to_falsecolor(nextVisibleId)
                        	c.__falsecolor = fc
    	                    this.canvas.__visiblePrimitives[nextVisibleId] = c
    	                    this.canvas.__changed[nextVisibleId] = c
    	                    nextVisibleId++
                        }
                    } else {
	                    this.__id = nextVisibleId
	                    this.__falsecolor = id_to_falsecolor(nextVisibleId)
	                    this.canvas.__visiblePrimitives[nextVisibleId] = this
	                    this.canvas.__changed[nextVisibleId] = this
	                    nextVisibleId++
                    }
                    if (this instanceof extrusion) {
                    	this.__vis = value
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
                    if (this.constructor == vp_arrow || this.constructor == arrow) {
                        for (var i = 0; i < this.__components.length; i++) {
                        	var c = this.__components[i]
                        	delete this.canvas.__visiblePrimitives[c.__id]
                        	delete this.canvas.__changed[c.__id]
                            if (c.__model) delete c.__model.id_object[c.__id]
                        }
                    } else {
                        delete this.canvas.__visiblePrimitives[this.__id]
                        delete this.canvas.__changed[this.__id]
                    	if (this.__model) delete this.__model.id_object[this.__id]
                    }
                    if (this instanceof extrusion) {
                    	this.__vis = value
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
                    this.__id = null
                }
            }},
        clone: function(args) { // cloning a standard primitive
        	if (this instanceof triangle || this instanceof quad)
        		throw new Error('Cannot clone a '+this.constructor.name+' object.')
        	if (this instanceof curve) {
        		var newargs = {origin:this.__origin, pos:this.pos, color:this.__color, radius:this.__radius,
            			size:this.__size, axis:this.__axis, up:this.__up,
                		shininess:this.__shininess, emissive:this.__emissive, 
                		visible:true, pickable:this.__pickable}
        	} if (this instanceof helix) {
        		var newargs = {pos:this.pos, color:this.__color,
        				thickness:this.__thickness, coils:this.__coils,
            			size:this.__size, axis:this.__axis, up:this.__up,
                		shininess:this.__shininess, emissive:this.__emissive, 
                		visible:true, pickable:this.__pickable}
        	} else {
	        	var newargs = {pos:this.__pos, color:this.__color, opacity:this.__opacity, 
	        			size:this.__size, axis:this.__axis, up:this.__up, __tex:this.__tex,
	            		shininess:this.__shininess, emissive:this.__emissive,
	            		visible:true, pickable:this.__pickable}
	        	if (this instanceof arrow || this instanceof vp_arrow) {
	        		newargs.shaftwidth = this.__shaftwidth
	        		newargs.headwidth = this.__headwidth
	        		newargs.headlength = this.__headlength
	        	}
        	}
        	for (var attr in args) {
        		newargs[attr] = args[attr]
        	}
        	return new this.constructor(newargs)
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
            if (args === undefined || args.angle === undefined) { throw new Error("object.rotate() requires an angle.") }
            var angle = args.angle
            var rotaxis, origin
            if (args.axis === undefined) { rotaxis = this.__axis }
            else rotaxis = args.axis.norm()
            if (args.origin === undefined) { origin = this.__pos }
            else origin = args.origin
            
            var isarrow = (this.constructor == arrow)
            var iscurve = (this.constructor == curve)
            
            var X = isarrow ? this.__axis_and_length.norm() : this.__axis.norm()
            var Y = this.__up.norm()
            var Z = X.cross(Y)
            if (Z.dot(Z) < 1e-10) {
            	Y = vec(1,0,0)
                Z = X.cross(Y)
                if (Z.dot(Z) < 1e-10)
                	Y = vec(0,1,0)
            }

            if (iscurve) this.origin = origin.add(this.__origin.sub(origin).rotate({angle:angle, axis:rotaxis}))
            else this.pos = origin.add(this.__pos.sub(origin).rotate({angle:angle, axis:rotaxis}))
            if (isarrow) this.__axis_and_length = this.__axis_and_length.rotate({angle:angle, axis:rotaxis})
            else this.axis = this.__axis.rotate({angle:angle, axis:rotaxis}) // maintain special character of VPython axis
            this.up = Y.rotate({angle:angle, axis:rotaxis})
        },
        getTransformedMesh: function() {
            var X = this.__axis.norm()
            var Y = this.__up.norm()
            var Z = X.cross(Y)
            if (Z.dot(Z) < 1e-10) {
            	Y = vec(1,0,0)
                Z = X.cross(Y)
                if (Z.dot(Z) < 1e-10)
                	Y = vec(0,1,0)
                    Z = X.cross(Y)
            }
            Z = Z.norm()
            Y = Z.cross(X).norm()
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
    
    function vp_box(args) { return initObject(this, vp_box, args) }
    subclass(vp_box, box)
    property.declare( vp_box.prototype, {
        axis: new attributeVectorAxis(null, 1,0,0), // unless size is modified, sphere should stay spherical
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
    	axis: new attributeVector(null, 1,0,0),
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
        var size = obj.__size
        var up = obj.__up
        var L = size.__x
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
        shaft.axis = tip.axis = axis
        shaft.up = tip.up = up
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
	 * the parent arrow object. In the setter for arrow.visible, "if
	 * (this.__org)" indicates that this is a box and pyramid object, handled by
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
		args = args || {}
		var pos = null
		if (args.pos !== undefined) pos = args['pos']
		args['pos'] = vec(0,0,0)
		this.__vis = false
		if (args.visible !== undefined) this.__vis = args['vis']
		var ret = text3D(args) // create a compound object representing the 3D text
		this.__comp = ret[0]
		this.__offset = this.__comp.__pos // where the compound center is located, relative to text.pos
		if (pos !== null) this.pos = pos
		this.__color = this.__comp.__color
		this.__size = this.__comp.__size
		this.__axis = this.__comp.__axis
		this.__up = this.__comp.__up
		args = ret[1]
		for (var attr in args) this[attr] = args[attr]
		return initObject(this, text, {})
	}
    subclass(text, box)
    property.declare( text.prototype, {
        __update: function() {
            var axis = norm(this.__axis)
            var up = norm(this.__up)
            var zaxis = norm(cross(axis,up))
            var offset = this.__offset
            // Calculate the world location of the center of the compound object
            var pos = this.__pos.add(axis.multiply(offset.x).add(up.multiply(offset.y)).add(zaxis.multiply(offset.z)))
            this.__comp.pos = pos
            this.__comp.__size = this.__size
            this.__comp.__axis = this.__axis
            this.__comp.__up = this.__up
            this.__comp.__color = this.__color
        },
    	texture: {
    		get: function() { throw new Error('Cannot currently apply a texture to a text obect') },
    		set: function(value) { throw new Error('Cannot currently apply a texture to a text obect') }
    	},
        length: {
        	get: function() { return this.__length },
        	set: function(value) {
        		if (value === this.__length) return
        		var m = value/this.__length
	    		this.__comp.__size.x *= m
	    		this.__offset.x *= m
        		this.__length = value
        		this.__comp.__change()
        	}
        },
	    height: {
	    	get: function() { return this.__height },
	    	set: function(value) {
	    		if (value === this.__height) return
	    		var m = value/this.__height
	    		this.__comp.__size.y *= m
	    		this.__offset.y *= m
	    		this.__descender *= m
	    		this.__height = value
        		this.__comp.__change()
	    	}
	    },
    	depth: { // 3D text object; depth > 0 means extrude in +z direction
    		get: function() { return this.__depth },
    		set: function(value) {
    			if (Math.abs(value) < 0.01*this.__height) {
    				if (value < 0) value = -0.01*this.__height
    				else value = 0.01*this.__height
    			}
    			if (value === this.__depth) return
    			this.__comp.__size.z = Math.abs(value)
    			this.__offset.z = value/2
				this.__depth = value
        		this.__comp.__change()
    		}
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
    	descender: {
    		get: function() { return this.__descender },
    		set: function(value) { throw new Error('descender is read-only') }
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
        this.__tex = {file: null, bumpmap: null, texture_ref: {reference: null}, bumpmap_ref: {reference: null}, 
				  left: false, right: false, sides: false, flipx: false, flipy: false, turn: 0, flags: 0 }
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
    
    function compound(objects, parameters) {
        if (!(this instanceof compound)) return new compound(objects, parameters)
        parameters = parameters || {}
        if (objects.length === undefined) throw new Error("compound takes a list of objects")
        var visible = true
        if (parameters['visible'] !== undefined) {
        	visible = parameters['visible']
        	delete parameters.visible
        }
        
        var cloning
        if (parameters.__cloning) {
        	cloning = true
        	initObject(this, compound, parameters)
        	var mesh = parameters.__cloning
        	delete parameters.__cloning
        } else { // compound
        	cloning = false
        	initObject(this, compound, {}) // apply parameters after creating compound mesh
        }
        
        function update_extent(c, extent) {
        	if (extent.__xmin === null) return
	        for (var ext in extent) {
	        	var value = extent[ext]
	        	if (ext.slice(-3) == 'min') { if (c[ext] === null || value < c[ext]) c[ext] = value }
	        	else { if (c[ext] === null || value > c[ext]) c[ext] = value }
	        }
        }

        if (!cloning) { // !cloning means that we're compounding
	        var mesh = new Mesh()
	        for (var i = 0; i < objects.length; i++) {
	            var o = objects[i]

		        if (o instanceof arrow)
	            	throw new Error('Currently cannot include an arrow in a compound.')
	            else if (o instanceof curve)
	            	throw new Error('Currently cannot include a curve in a compound.')
	            else if (o instanceof helix)
	            	throw new Error('Currently cannot include a helix in a compound.')
	            else if (o instanceof label)
	            	throw new Error('Currently cannot include a label in a compound.')
	            if (o.__tex.file !== null)
	            	throw new Error('Currently objects in a compound cannot have their own texture.')
	            if (o.__tex.bumpmap !== null)
	            	throw new Error('Currently objects in a compound cannot have their own bumpmap.')

	            o.visible = false
	            o.__deleted = true // do not allow this object to be made visible any more
	            if (o instanceof triangle || o instanceof quad) {
	            	// For each vertex in o.vs, extract the mesh information, and free up no longer used vertex slots
	            	var q = o.vs
	            	for (var k=0; k<3; k++) {
	            		update_extent( this, mesh.merge(q[k], q[k], 0) )
	            		if (this.canvas.__vertices.object_info[ q[k].__id ][o.__id] !== undefined)
	            			delete this.canvas.__vertices.object_info[ q[k].__id ][o.__id]
	            		if (this.canvas.__vertices.object_info[ q[k].__id ] === {}) // this vertex object is no longer used
	            			this.canvas.__vertices.available.push(q[k].__id) // release no longer needed vertex object
	            	}
	            	if (o instanceof quad) {
	            		// Bias the index to point to already existing data:
	            		update_extent( this, mesh.merge(o.v0, o.v0, -3) )
	            		update_extent( this, mesh.merge(o.v2, o.v2, -1) )
	            		update_extent( this, mesh.merge(o.v3, o.v3, 0) )
		        		this.canvas.__vertices.available.push(o.v3.__id) // release vertex object
	            		if (this.canvas.__vertices.object_info[ o.v3.__id ] === {}) // this vertex object is no longer used
	            			this.canvas.__vertices.available.push(o.v3.__id) // release no longer needed vertex object
	            	}
	            } else if (o instanceof extrusion) {
	            	// An extrusion contains a set of quads plus end tessellations.
	            	// For each quad p, extract the mesh information, and free up no longer used vertex slots
	            	for (var n=0; n<o.__quads.length; n++) {
	            		var p = o.__quads[n]
	            		q = p.vs
	            		q.visible = false
	            		q.__deleted = true
		            	for (var k=0; k<3; k++) {
		            		update_extent( this, mesh.merge(q[k], q[k], 0) )
		            		if (this.canvas.__vertices.object_info[ q[k].__id ][p.__id] !== undefined)
		            			delete this.canvas.__vertices.object_info[ q[k].__id ][p.__id]
		            		if (this.canvas.__vertices.object_info[ q[k].__id ] === {}) // this vertex object is no longer used
		            			this.canvas.__vertices.available.push(q[k].__id) // release no longer needed vertex object
		            	}
	            		// Bias the index to point to already existing data:
	            		update_extent( this, mesh.merge(p.v0, p.v0, -3) )
	            		update_extent( this, mesh.merge(p.v2, p.v2, -1) )
	            		update_extent( this, mesh.merge(p.v3, p.v3, 0) )
	            		if (this.canvas.__vertices.object_info[ p.v3.__id ] === {}) // this vertex object is no longer used
	            			this.canvas.__vertices.available.push(p.v3.__id) // release no longer needed vertex object	            		
	            	}
	            	this.__texture = o.texture
	            } else {
	            	update_extent( this, mesh.merge(o.getTransformedMesh(), o, 0) )
	            }
	        }
	        this.pos = vec( (this.__xmin + this.__xmax)/2, (this.__ymin + this.__ymax)/2, (this.__zmin + this.__zmax)/2 )
	        this.size = vec( (this.__xmax-this.__xmin), (this.__ymax-this.__ymin), (this.__zmax-this.__zmin) )
	        mesh.adjust(this.pos, this.size)
	        compound_id++
	        mesh.__mesh_id = 'compound'+compound_id
	        this.canvas.__renderer.add_model(mesh, false)
        	for (var attr in parameters) {
        		this[attr] = parameters[attr]
        	}
        }
		this.__mesh = mesh
        this.__model = this.canvas.__renderer.models[mesh.__mesh_id]
        this.visible = visible
    }
    if (window.__GSlang == 'vpython') subclass(compound, box)
    else subclass(compound, vp_box)
    property.declare( compound.prototype, {
    	// origin of an extrusion, for use in constructor
    	origin: {
    		get: function() {return this.__pos},
    		set: function(value) {this.pos = value}
    	},
    	
    	// Attributes of a compound object representing an extrusion object:
    	show_start_face: {
    		get: function() {
    			if (this.__is_extrusion === undefined) throw new Error('show_start_face is not an attribute of this object')
    			return this.__show_start_face
    			},
    		set: function(value) { throw new Error('show_start_face is read-only') }
    	},
    	show_end_face: {
    		get: function() {
    			if (this.__is_extrusion === undefined) throw new Error('show_end_face is not an attribute of this object')
    			return this.__show_end_face
    			},
    		set: function(value) { throw new Error('show_end_face is read-only') }
    	},
    	start_face_color: {
    		get: function() {
    			if (this.__is_extrusion === undefined) throw new Error('start_face_color is not an attribute of this object')
    			return this.__start_face_color
    			},
    		set: function(value) { throw new Error('start_face_color is read-only') }
    	},
    	end_face_color: {
    		get: function() {
    			if (this.__is_extrusion === undefined) throw new Error('end_face_color is not an attribute of this object')
    			return this.__end_face_color
    			},
    		set: function(value) { throw new Error('end_face_color is read-only') }
    	},
    	
        clone: function(args) { // cloning a compound object
        	var newargs = {pos:this.__pos, color:this.__color, opacity:this.__opacity, 
        			size:this.__size, axis:this.__axis, up:this.__up,
            		shininess:this.__shininess, emissive:this.__emissive,
            		visible:true, pickable:this.__pickable,
            		__center:this.__center, __pseudosize:this.__pseudosize}
        	if (this.texture.file !== null) newargs.texture = this.texture
        	for (var attr in args) {
        		newargs[attr] = args[attr]
        	}
        	newargs.__cloning = this.__mesh
        	return new this.constructor([], newargs)
        },
        _world_zaxis: function() {
	        var axis = this.__axis
	        var up = this.__up
	        var z_axis
	        if (Math.abs(axis.dot(up)) / Math.sqrt(up.mag2*axis.mag2) > 0.98) {
	            if (Math.abs(axis.norm().dot(vec(-1,0,0))) > 0.98) {
	                z_axis = axis.cross(vec(0,0,1)).norm()
	            } else {
	                z_axis = axis.cross(vec(-1,0,0)).norm()
	            }
	        } else {
	            z_axis = axis.cross(up).norm()
	        }
	        return z_axis
        },
	    world_to_compound: function(v) {
	        var axis = this.__axis
	        var z_axis = this._world_zaxis()
	        var y_axis = z_axis.cross(axis).norm()
	        var x_axis = axis.norm()
	        var v = v.sub(this.__pos)
	        return vec(v.dot(x_axis), v.dot(y_axis), v.dot(z_axis))
	    },	
	    compound_to_world: function(v) {
	    	var axis = this.__axis        
	    	var z_axis = this._world_zaxis()
	        var y_axis = z_axis.cross(axis).norm()
	        var x_axis = axis.norm()
	        return this.__pos.add(x_axis.multiply(v.x)).add(y_axis.multiply(v.y)).add(z_axis.multiply(v.z))
	    },
        __get_model: function() { return this.__model },
		/*
    	__get_extent: function(ext) {    		
    		// Mock up appropriate data structures for Autoscale.find_extent
    		var savepos = this.__pos
    		var savesize = this.__size
    		var v = vec(this.__size.x*this.__center.x, this.__size.y*this.__center.y, this.__size.z*this.__center.z) 
    		var tpos = v.add(this.__pos)
    		var tsize = vec(this.__size.x*this.__pseudosize.x, this.__size.y*this.__pseudosize.y, this.__size.z*this.__pseudosize.z)
    		this.__pos = tpos
    		this.__pos.__x = tpos.x
    		this.__pos.__y = tpos.y
    		this.__pos.__z = tpos.z
    		this.__size = tsize
    		this.__size.__x = tsize.x
    		this.__size.__y = tsize.y
    		this.__size.__z = tsize.z
    		Autoscale.find_extent(this, ext)
    		this.__pos = savepos
    		this.__size = savesize
    	},
    	*/
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
    		return new curve(arguments)  // so curve() is like new curve()
    	}
        args = args || {}
    	if (args.canvas !== null) { // it's null if first setting up objects; see subclass function
	        var iargs = []
            if (arguments.length !== undefined)
            	// make a copy of the arguments so that the caller (attach_trail) doesn't lose them
            	for (var i=0; i<args.length; i++) iargs.push(args[i])
            else for (var i=0; i<arguments.length; i++) iargs.push(arguments[i])
	    	this.__color = vec(1,1,1)
	        this.__radius = 0 // means width of a few pixels
	    	this.__retain = -1 // signal that all points should be retained
	    	this.pickable = true
	    	this.__points = []
	        if (iargs.length == 1 && toType(iargs[0]) == 'object') {
	        	// this is the case of curve(pos=..., color=.... etc.)
	        	var obj = iargs[0]
	    		if (obj['texture'] !== undefined) throw new Error("Textures are not available for curve objects.")
		    	if (obj['opacity'] !== undefined) throw new Error("Opacity is not available for curve objects.")
	        	var haspos = false
	        	if (obj['pos'] !== undefined) {
	        		haspos = true
	        		this.__pos = obj.pos
	        		delete obj.pos
	        	}
	        	initObject(this, curve, obj)
	        	if (haspos) this.push(this.__pos)
	        } else {
	        	initObject(this, curve, {}) // create curve with no arguments
		        if (toType(iargs) == 'array' && toType(iargs[0]) == 'array') this.push(iargs[0])
		    	else this.push(iargs) // pass arguments to push method
	        }
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
        	// TODO: must do more sophisticated extent calculation now that points are relative to origin
        	var xmin=null, ymin=null, zmin=null, xmax=null, ymax=null, zmax=null
        	var length = this.__points.length
        	var pnt = this.__points
        	var p
            for (var i = 0; i < length; i++) {
                // ext.point_extent(this, pnt[i].__pos)
            	p = pnt[i].__pos
            	if (xmin === null || p.x < xmin) xmin = p.x
            	if (ymin === null || p.y < ymin) ymin = p.y
            	if (zmin === null || p.z < zmin) zmin = p.z
            	if (xmax === null || p.x > xmax) xmax = p.x
            	if (ymax === null || p.y > ymax) ymax = p.y
            	if (zmax === null || p.z > zmax) zmax = p.z
            }
    		// Mock up appropriate data structures for Autoscale.find_extent
	        var center = vec( (xmin + xmax)/2, (ymin + ymax)/2, (zmin + zmax)/2 )
	        var pseudosize = vec( (xmax-xmin),(ymax-ymin), (zmax-zmin) )
    		var savepos = this.__pos, savesize = this.__size
    		var v = vec(this.__size.x*center.x, this.__size.y*center.y, this.__size.z*center.z) 
    		var tpos = v.add(this.__pos)
    		var tsize = vec(this.__size.x*pseudosize.x, this.__size.y*pseudosize.y, this.__size.z*pseudosize.z)
    		this.__pos = tpos
    		this.__pos.__x = tpos.x
    		this.__pos.__y = tpos.y
    		this.__pos.__z = tpos.z
    		this.__size = tsize
    		this.__size.__x = tsize.x
    		this.__size.__y = tsize.y
    		this.__size.__z = tsize.z
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
        push: function(pts) {
        	var args = []
            var pos
            if (pts.length !== undefined) {
            	if (pts.length == 1) args = pts[0]
            	else args = pts
            } else for (var i=0; i<arguments.length; i++) args.push(arguments[i])
            var pointarg = {} // contains those attributes mentioned in args
    		var attrs = ['color', 'radius', 'retain', 'visible']
        	for (var a in attrs) {
        		var attr = attrs[a]
        		if (attr == 'radius' && attr in args && this.constructor == points)
        			throw new Error('In a points object, you cannot specify the radius of an individual point.')
        		if (attr in args) pointarg[attr] = args[attr]
        	}
            var argtype = toType(args)
            var objects = false
            if (args instanceof vec) args = [{'pos':args}] // vec
            else if (argtype == 'array') { // [vec, vec] or [{...}, {...}]
            	if (args[0] instanceof vec) args = [{'pos':args}]
            	else if (toType(args[0]) == 'object') objects = true
            }
            else if (argtype == 'object') args = [args]
            for (var i=0; i<args.length; i++) {
        		var obj = args[i]
        		pos = obj
        		if ('pos' in obj) {
        			pos = obj.pos
        		}
    			if (toType(pos) != 'array') pos = [pos]
        		for (var j=0; j<pos.length; j++) {
        			var p = pos[j]
        			if (toType(p) == 'array') p = vec(p[0], p[1], p[2])
        			//if (!(p instanceof vec)) p = vec(p[0], p[1], p[2])
        			// GlowScript 1.1 permitted (x,y,z) as well as vec(x,y,z)
        			// The following would require vec:
        			// if (!(p instanceof vec)) throw new Error('curve and
					// points positions must be vectors')
        			var setup
        			if (objects) {
        				setup = obj
        				setup.pos = p
        			} else {
	        			setup = {'pos':p}
	        			for (var a in pointarg) {
	        				setup[a] = pointarg[a]
	        			}
        			}
        			if (this.constructor == curve) { // else points object
	        			var pt = point(setup)
	                    var retain = this.__retain // global retain
	                    if (setup.retain !== undefined) retain = setup.retain
	                    if (retain > -1 && this.__points.length >= retain) {
	                    	// If retaining, re-use one of the point objects
							// rather than creating a new one
	                    	var N = this.__points.length-retain
	                    	for (var d=0; d<N; d++) {
	                    		var first = this.__points.shift()
	                    		first.visible = false
	                    	}
	                        var prev = this.__points[this.__points.length - 1]
	                    	var pt = this.__points.shift()
	                    	for (var a in setup) pt[a] = setup[a]
	                    	this.__points.push(pt)
	                    	var s = pt.__prevsegment = prev.__nextsegment = new Float32Array(16)
	                        s[11] = s[15] = 1;  // opacities
	                        prev.__change()
	                        pt.__change()
	                    } else {
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
	                    var retain = this.__retain // global retain
	                    if (setup.retain !== undefined) retain = setup.retain
	                    if (retain > -1 && this.__points.length >= retain) {
	                    	// If retaining, re-use one of the spheres rather than creating a new one
	                    	var N = this.__points.length-retain
	                    	for (var d=0; d<N; d++) {
	                    		var first = this.__points.shift()
	                    		first.visible = false
	                    	}
	                        var prev = this.__points[this.__points.length - 1]
	                    	var pt = this.__points.shift()
	                    	for (var a in setup) pt[a] = setup[a]
	                    	this.__points.push(pt)
	                        pt.__change()
                        } else {
	                    	var D = 2*this.__radius
	                    	var c = (setup.color === undefined) ? this.__color : setup.color
	                    	// Avoid resetting all sphere diameters (in WebGLRenderer.js) if possible:
	    	                if (this.__points.length > 0 && this.__last_range != -1 && this.__last_range === this.canvas.__range) {
	                    		D = this.__points[0].__size.x // can use diameter of existing sphere
	        				} else {
	        					D = 0
	        					this.__last_range = -1 // force readjustments of diameter
	        				}
	    	            	if (window.__GSlang == 'vpython') {
	    	                    this.__points.push(vp_sphere({pos:setup.pos, size:vec(D,D,D), color:c, pickable:false,}))
	    	            	} else{
	    	            		this.__points.push(sphere({pos:setup.pos, size:vec(D,D,D), color:c, pickable:false}))
	    	            	}
                        }
        			}
        		}
        	}
            this.__change()
        },
        append: function(pts) { // synonym for push, for better match to Python
        	var args = []
            if (pts.length !== undefined) args = pts
            else for (var i=0; i<arguments.length; i++) args.push(arguments[i])
        	this.push(args)
        },
        pop: function() {
            var p = this.__points.pop()
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
            var p = this.__points.shift()
            p.visible = false
            this.__change()
            return {pos:p.pos, color:p.color, radius:p.radius, visible:p.visible}
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
            for (var i=2; i<arguments.length; i++) pts.push(arguments[i])
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
        for (var id in args)
            this[id] = args[id]
        if (this.pos === undefined) throw new Error("Must specify pos for a point on a curve")
    }
    property.declare( point.prototype, {
        __curve: null,
        pos: new attributeVector(null, 0,0,0),
        color: new attributeVector(null, -1,-1,-1),
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
        },
    })
    
    function points(iargs) {
    	if (!(this instanceof points)) {
    		return new points(arguments)  // so curve() is like new curve()
    	}
        iargs = iargs || {}
    	if (iargs.canvas !== null) { // it's null if first setting up objects; see subclass function
	        if (iargs['texture'] !== undefined) throw new Error("Textures are not available for points objects.")
	    	if (iargs['opacity'] !== undefined) throw new Error("Opacity is not available for points objects.")
	        var saveargs = []
            if (arguments.length !== undefined)
            	// make a copy of the arguments so that the caller (attach_trail) doesn't lose them
            	for (var i=0; i<iargs.length; i++) saveargs.push(iargs[i])
            else for (var i=0; i<arguments.length; i++) saveargs.push(arguments[i])
	    	this.__color = vec(1,1,1)
	        this.__radius = 0 // means width of a few pixels
	    	this.__retain = -1 // signal that all points should be retained
	    	this.__pixels = true
	    	this.__points = []
	        this.pickable = false
	        if (toType(saveargs) == 'array' && saveargs.length == 1 && toType(saveargs[0]) == 'object') {
	        	// this is the case of points(pos=..., color=.... etc.)
	        	var obj = saveargs[0]
	    		if (obj['texture'] !== undefined) throw new Error("Textures are not available for points objects.")
		    	if (obj['opacity'] !== undefined) throw new Error("Opacity is not available for points objects.")
	        	var haspos = false
	        	if (obj['pos'] !== undefined) {
	        		haspos = true
	        		this.__pos = obj.pos
	        		delete obj.pos
	        	}
		        if (obj.size_units !== undefined) {
		        	if (obj.size_units == 'world') this.__pixels = false
		        	delete obj.size_units
		        }
	        	initObject(this, points, obj)
	        	if (haspos) this.push(this.__pos)
	        } else {
		    	initObject(this, points, {}) // create points with no arguments
		        if (toType(saveargs) == 'array' && toType(saveargs[0]) == 'array') this.push(saveargs[0])
		    	else this.push(saveargs) // pass arguments to push method
	        }
			this.__last_range = -1
	    	this.canvas.__points_objects.push(this)
    	}
    }
    subclass(points, curve)
    property.declare( points.prototype, {
    	origin: {
    		get: function() { throw new Error("The points object has no origin attribute.") },
    		set: function(value) { throw new Error("The points object has no origin attribute.") }
    	},
    	axis: {
    		get: function() { throw new Error("The points object has no axis attribute.") },
    		set: function(value) { throw new Error("The points object has no axis attribute.") }
    	},
    	up: {
    		get: function() { throw new Error("The points object has no up attribute.") },
    		set: function(value) { throw new Error("The points object has no up attribute.") }
    	},
    	size: {
    		get: function() { throw new Error("The points object has no size attribute.") },
    		set: function(value) { throw new Error("The points object has no size attribute.") }
    	},
    	size_units: {
    		get: function() { return (this.__pixels) ? 'pixels' : 'world' },
    		set: function(value) { 
    			if (value == 'pixels') this.__pixels = true
    			else if (value == 'world') this.__pixels = false
    			else throw new Error("The points object ")
    		}
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
        __update: function() { } // changes drive updates to the sphere objects
    })

    function helix(args) { return initObject(this, helix, args) }
    subclass(helix, cylinder)
    property.declare( helix.prototype, {
        __initialize: true,
        /*
        texture: {
        	get: function() {throw new Error("Textures are not available for helix objects.")},
        	set: function(val) {throw new Error("Textures are not available for helix objects.")}
        },
        opacity: {
        	get: function() {throw new Error("opacity is not available for helix objects.")},
        	set: function(val) {throw new Error("opacity is not available for helix objects.")}
        },
        visible: {
        	get: function() {return this.__vis},
        	set: function(val) {
        		console.log('1', val)
        		this.__vis = val
        		console.log('2', val)
        		this.__update()
        		console.log('3', val)
        		}
        },
        */
        thickness: { value: 0, onchanged: function() { this.__change() } },
        coils: { value: 5, onchanged: function() { this.__initialize = true; this.__change() } },
        __update: function () {
            var NCHORDS = 20 // number of chords in one coil of a helix
            
            if (this.__initialize) {
                if (this.__curve !== undefined) {
                    this.__curve.clear()
                } else {
                    this.__curve = curve({canvas:this.canvas, __no_autoscale:true})
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
        axis: new attributeVectorAxis(null, 1,0,0),
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
    	// VPython ring does not link size and axis, so use standard attribute vectors
    	axis: new attributeVector(null, 1,0,0),
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
        if (args.direction === undefined) throw new Error("Must specify the distant_light, direction:..")
        init(this, args)
        this.canvas.lights.push(this)
    }
    property.declare( distant_light.prototype, {
        direction: new attributeVector(null, 0,0,1),
        color: new attributeVector(null, 1,1,1),
        __get_model: function() { return this.canvas.__renderer.models[this.constructor.name] },
        __change: function() {}
    })

    function local_light(args) {
        if (!(this instanceof local_light)) return new local_light(args)  // so local_light() is like new local_light()
        if (args.pos === undefined) throw new Error("Must specify the local_light position, pos:..")
        init(this, args)
        this.canvas.lights.push(this)
    }
    property.declare( local_light.prototype, {
        pos: new attributeVector(null, 0,0,0),
        color: new attributeVector(null, 1,1,1),
        __get_model: function() { return this.canvas.__renderer.models[this.constructor.name] },
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
        	// The height in pixels of a text with nlines, where dh is 1.2*this.__height, is
        	//     (nlines-1)*dh + this.__height
        	// because the distance from the vertical midpoint of the first and last lines
        	// is (nlines-1)*dh, and there is addition the upper part of the fist line and
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
            var f = this.__font
            if (this.__font == 'Verdana') h *= 13/15 // Had been using Verdana default, which is unusually large
            else if (this.__font == 'sans') f = 'Arial'
            else if (this.__font == 'serif') f = 'Georgia'
            ctx.font = h + 'px ' + f
            ctx.textAlign = 'left' // make explicit to simplify/clarify later calculations
            ctx.textBaseline = 'middle'
            ctx.lineWidth = this.__linewidth
            var default_color = vec(1,1,1)
            if (this.canvas.__background.equals(vec(1,1,1))) default_color = vec(0,0,0)
            ctx.strokeStyle = color.to_html(this.__linecolor || this.__color || default_color)
            
            var lines, nlines
            var dh = 1.2*this.__height // vertical spacing from one line to the next
            var upperchar = 0.4*this.__height // from y of text location to top of the character; approximate
            if (typeof this.__text === 'string') lines = this.__text.split('\n')
            else lines = [print_to_string(this.__text)]
	    	nlines = lines.length
	    	var height = this.__height + (nlines-1)*dh // from top of top line to bottom of bottom line, without borders
	    	var width = 0                  // maximum width of text, without borders
	    	var linewidths = []
	    	for (var nth=0; nth<nlines; nth++) { // find maximum width of lines of text
	    		var w = Math.ceil(ctx.measureText(lines[nth]).width)
	    		linewidths.push(w)
	    		if (w > width) width = w
	    	}
            
            var tstart = [] // x location of start of text on a line; depends on this.__align
            for (var nth=0; nth<nlines; nth++) {
                switch (this.__align) { // ctx.textAlign is set to 'left', with adjustments made here:
	            	case null: // if program didn't specify an alignment, default is 'center'
	            		if (xoffset === 0 && yoffset === 0) tstart.push((width-linewidths[nth])/2)
	            		else {
		            		if (Math.abs(yoffset) > Math.abs(xoffset)) {
		            			tstart.push((width-linewidths[nth])/2) // cewnter
		            		} else {
		            			if (xoffset > 0) { // line goes to left edge of box
		            				tstart.push(0) // left adjusted
		            			} else if (xoffset < 0) {
		            				tstart.push(width-linewidths[nth])// line goes to left edge of box
		            			}
		            		}
	            		}
	            		break
	                case 'center':
	                    tstart.push((width-linewidths[nth])/2)
	                    break
	                case 'right':
	                    tstart.push(width-linewidths[nth])
	                    break
	                case 'left':
	                	tstart.push(0)
	                	break
	                default:
	                	throw new Error('Label align must be "center" or "left" or "right".')
                }
            }

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
            
    		ctx.fillStyle = color.to_html(this.__color || default_color)
            for (var nth=0; nth<nlines; nth++) { // display the text
	    		var x = xbase + tstart[nth]
	    		var y = ybase + dh*nth
	    		ctx.fillText(lines[nth], x, y)
        	}
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
        }
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
		attrs.jradio = $('<input type="radio"/>').css({width:'16px', height:'16px'}).appendTo(attrs.pos)
		.click( function() {
			attrs.checked = !attrs.checked
			$(attrs.jradio).prop('checked', attrs.checked)
			attrs.bind(cradio) 
		} )
		widgetid++
		attrs._id = widgetid.toString()
		$('<span id='+attrs._id+'> '+attrs.text+'</span>').appendTo(attrs.pos)
		
		var cradio = { // this structure implements a JavaScript "closure", essential for radio to work
	        get checked() {return attrs.checked},
	        set checked(value) {
	            attrs.checked = value
	            $(attrs.jradio).prop('checked', value)
	        },
	        get text() {return attrs.text},
	        set text(value) {
	        	attrs.text = value
	        	$('#'+attrs.id).text(' '+value)
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
		attrs.jcheckbox = $('<input type="checkbox"/>').css({width:'16px', height:'16px'}).appendTo(attrs.pos)
		.click( function() {
			attrs.checked = !attrs.checked
			$(attrs.jcheckbox).prop("checked", attrs.checked)
			attrs.bind(ccheckbox) 
		} )
		widgetid++
		attrs._id = widgetid.toString()
		$('<span id='+attrs._id+'> '+attrs.text+'</span>').appendTo(attrs.pos)
		
		var ccheckbox = { // this structure implements a JavaScript "closure", essential for checkbox to work
	        get checked() {return attrs.checked},
	        set checked(value) {
	            attrs.checked = value
	            $(attrs.jcheckbox).prop("checked", value)
	        },
	        get text() {return attrs.text},
	        set text(value) {
	        	attrs.text = value
	        	$('#'+attrs.id).text(' '+value)
	        }
		}
	    for (var a in args) { // include user-defined attributes
	    	ccheckbox[a] = args[a]
	    }
		ccheckbox.checked = attrs.checked
		return ccheckbox
	}
	
	function button(args) {
	    if (!(this instanceof button)) return new button(args)  // so button() is like new button()
	    var cvs = canvas.get_selected()
	    var attrs = {pos:cvs.caption_anchor, text:' ', textcolor:vec(0,0,0), background:vec(1,1,1), disabled:false}
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
	    		.css({color:rgb_to_css(attrs.textcolor), backgroundColor:rgb_to_css(attrs.background), "font-size":"15px"})
	    		.click( function() { attrs.bind(cbutton) } )
	    $(attrs.pos).append(' ')
	    
	    var cbutton = { // this structure implements a JavaScript "closure", essential for <button/> to work
	        get disabled() {return attrs.disabled},
	        set disabled(value) {
	        	if (value === 0) value = false
	        	else if (value == 1) value = true
	        	attrs.disabled = value
	            $(attrs.jbutton).attr('disabled', attrs.disabled)
	            if (attrs.disabled)
	            	$(attrs.jbutton).css({color:rgb_to_css(vec(0.7,0.7,0.7)), backgroundColor:rgb_to_css(vec(1,1,1))})
	            else
	            	$(attrs.jbutton).css({color:rgb_to_css(attrs.textcolor), backgroundColor:rgb_to_css(attrs.background)})
	        },
	        get text() {return attrs.text},
	        set text(value) {
	        	attrs.text = value
	            $(attrs.jbutton).html(attrs.text)
	        },
	        get textcolor() {return attrs.textcolor},
	        set textcolor(value) {
	        	attrs.textcolor = value
	            $(attrs.jbutton).css({color:rgb_to_css(attrs.textcolor)})
	        },
	        get background() {return attrs.background},
	        set background(value) {
	        	attrs.background = value
	            $(attrs.jbutton).css({backgroundColor:rgb_to_css(attrs.background)})
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
	    		change: function (evt) {if (evt.originalEvent !== undefined) attrs.bind(cslider)},
	    		slide:  function (evt) {if (evt.originalEvent !== undefined) attrs.bind(cslider)}
	    		})
	    
	    var cslider = {
	        get min() {return attrs.min},
	        set min(value) {throw new Error("Cannot change the min of an existing slider.")},
	        
	        get max() {return attrs.max},
	        set max(value) {throw new Error("Cannot change the max of an existing slider.")},
	        
	        get value() {return $(attrs.jslider).slider('value')},
	        set value(val) {$(attrs.jslider).slider('value',val)},
	        
	        // $(attrs.jcheckbox).prop("checked", value)
	        
	        get width() {return attrs.width},
	        set width(value) {throw new Error("Cannot change the width of an existing slider.")},
	        
	        get length() {return attrs.length},
	        set length(value) {throw new Error("Cannot change the length of an existing slider.")}
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
	        get selected() {return $(attrs.jmenu).val()},
	        set selected(value) {$(attrs.jmenu).val(value)},
	        	
	        get choices() {return attrs.choices},
	        set choices(value) {throw new Error("The list of choices cannot be changed after creating a menu.")},
	        
	        get index() {return attrs.choices.indexOf($(attrs.jmenu).val())},
	        set index(value) {$(attrs.jmenu).val(attrs.choices[value])}
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
        radio: radio,
        checkbox: checkbox,
        button: button,
        slider: slider,
        menu: menu,
    }

    Export(exports)
})()