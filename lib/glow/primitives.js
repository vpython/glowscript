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
        // Set radius, size, size_units and color before setting pos, to benefit curve and points objects
        if (args.radius !== undefined) {
        	obj.radius = args.radius
        	delete args.radius
        }
        if (args.size_units !== undefined) {
        	obj.size_units = args.size_units
        	delete args.size_units
        }
        // treat axis before size or length or height or width to match classic VPython constructor API
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
        if (args.pos !== undefined) {
        	obj.pos = args.pos // set obj.pos now to avoid trail update if make_trail = True
        	delete args.pos
        }

        // Mimic classic VPython (though GlowScript attach_trail is more powerful)
        if (obj.constructor != curve && obj.constructor != points && args.make_trail !== undefined) {
        	obj.__make_trail = args.make_trail
        	delete args.make_trail
        	if (args.interval !== undefined) {
        		obj.__interval = args.interval
        		delete args.interval
        	} else obj.__interval = 1
        	if (args.retain !== undefined) {
        		obj.__retain = args.retain
        		delete args.retain
        	} else obj.__retain = -1 // signal retain not set
        	var c = color.white
        	if (obj.color !== undefined) c = obj.color
	    	obj.__trail_type = 'curve'
	        	if (args.trail_type !== undefined) {
	        		if (args.trail_type != 'curve' && args.trail_type != 'points')
	        			throw new Error ("trail_type = "+args.trail_type+" but must be 'curve' or 'points'.")	        		
	        		obj.__trail_type = args.trail_type
	        		delete args.trail_type
	        	}

    		if (obj.__trail_type == 'curve') obj.__trail_object = curve({color:c})
    		else obj.__trail_object = points({color:c})
			if (obj.pos !== undefined) obj.__trail_object.push(obj.pos)
    		obj.__ninterval = 0
        }
        
        for (var id in args) obj[id] = args[id]

        // We have to set visible unless args has visible:false or canvas:null
        if (args.visible === undefined && obj.canvas !== null) obj.visible = true
    }

    function initObject(obj, constructor, args) {
        if (!(obj instanceof constructor)) return new constructor(args)  // so box() is like new box()
        if (args === undefined) args = {}  // so box() is like box({})
        obj.__tex = {file: null, bumpmap: null, texture_ref: {reference: null}, bumpmap_ref: {reference: null}, 
				  left: false, right: false, sides: false, flipx: false, flipy: false, turn: 0, flags: 0 }

    	// We have to initialize ALL vector attributes here, because they need pointers back to "this" :-(
        //if (constructor == vp_ring) obj.size = obj.size // prevent default axis setting from clobbering size.x
        if (args.pos === undefined) obj.pos = obj.pos
        if (args.color === undefined) obj.color = obj.color
        if (constructor == curve || constructor == extrusion) obj.origin = obj.origin
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

    // For now, ids are ever-increasing.  Perhaps change this to keep a compact list
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
    		//name = "images/"+name.slice(1) // our images were formerly here
    		name = "https://s3.amazonaws.com/glowscript/textures/"+name.slice(1)
    	}
    	obj.canvas.__renderer.initTexture(name, obj, isbump)
    }
    
    function Primitive() {}
    // The declare function in file property.js creates attributes such as pos as __pos
    property.declare( Primitive.prototype, {
        __id: null,
        __hasPosAtCenter: false,

        __zx_camera: null, __zy_camera: null, 
        __xmin:null, __ymin: null, __zmin: null,
        __xmax: null, __ymax: null, __zmax: null, 

        pos:   new attributeVector(null, 0,0,0),
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
            get: function() { return this.__id != null },
            set: function(value) {
                if (value == (this.__id != null)) return
                if (this.__curve) this.__curve.visible = value
                if (value) {
                    this.__id = nextVisibleId
                    nextVisibleId++
                    this.canvas.__visiblePrimitives[this.__id] = this
                    this.__falsecolor = id_to_falsecolor(this.__id)
                    this.canvas.__changed[this.__id] = this
                    if (this instanceof extrusion || this instanceof ring || this instanceof vp_ring) {
                    	this.__vis = value
                    } else if (this instanceof triangle || this instanceof quad) {
                    	var vars = ['__v0', '__v1', '__v2', '__v3'], N = 3
                    	if (this instanceof quad) N = 4
                    	// mark vertices used by this triangle/quad, to support autoscaling when the vertex changes
                        for (var i=0; i<N; i++) {
                        	this.canvas.__vertices.object_info[ this[vars[i]].__id ][this.__id] = this
                        }
                    }
                } else {
                    delete this.canvas.__visiblePrimitives[this.__id]
                    delete this.canvas.__changed[this.__id]
                    if (this.__model) delete this.__model.id_object[this.__id]
                    if (this.__components)
                        for (var i = 0; i < this.__components.length; i++)
                            delete this.__components[i].__model.id_object[this.__components[i].__id]
                    if (this instanceof extrusion || this instanceof ring || this instanceof vp_ring) {
                    	this.__vis = value
                    } else if (this instanceof triangle || this instanceof quad) {
                    	var vars = ['__v0', '__v1', '__v2', '__v3'], N = 3
                    	if (this instanceof quad) N = 4
                    	// mark vertices as not currently used by this triangle/quad
                        for (var i=0; i<N; i++) {
                        	delete this.canvas.__vertices.object_info[ this[vars[i]].__id ][this.__id]
                        }
                    }
                    this.__id = null
                }
            }},
        clone: function(args) {
        	if (this instanceof triangle || this instanceof quad)
        		throw new Error('Cannot clone a '+this.constructor.name+' object.')
        	var newargs = {pos:this.__pos, color:this.__color, opacity:this.__opacity, 
        			size:this.__size, axis:this.__axis, up:this.__up, __tex:this.__tex,
            		shininess:this.__shininess, emissive:this.__emissive, 
            		visible:true, pickable:this.__pickable}
        	for (var attr in args) {
        		newargs[attr] = args[attr]
        	}
        	return new this.constructor(newargs)
        },
        __change: function() { if (this.__id) this.canvas.__changed[this.__id] = this },
        __get_extent: function(ext) { Autoscale.find_extent(this, ext) },
        __get_model: function() { return this.canvas.__renderer.models[this.constructor.name] },
        __update: function() {
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
            if (args === undefined || args.angle === undefined) { throw new Error("object.rotate() requires angle:...") }
            var angle = args.angle
            var rotaxis, origin
            if (args.axis === undefined) { rotaxis = this.__axis }
            else rotaxis = args.axis.norm()
            if (args.origin === undefined) { origin = this.__pos }
            else origin = args.origin
            
            var isarrow = (this.constructor == arrow)
            
            var X = isarrow ? this.__axis_and_length.norm() : this.__axis.norm()
            var Y = this.__up.norm()
            var Z = X.cross(Y)
            if (Z.dot(Z) < 1e-10) {
            	Y = vec(1,0,0)
                Z = X.cross(Y)
                if (Z.dot(Z) < 1e-10)
                	Y = vec(0,1,0)
            }
            
            this.pos = origin.add(this.__pos.sub(origin).rotate({angle:angle, axis:rotaxis}))
            if (isarrow) this.__axis_and_length = this.__axis_and_length.rotate({angle:angle, axis:rotaxis})
            else this.axis = this.__axis.rotate({angle:angle, axis:rotaxis})
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
            	var R2 = this.__size.x/2
            	var R1 = this.__size.y/2 - R2
            	var m = Mesh.makeRing(R1,R2)
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
        pos:  new attributeVectorPos(null, 0,0,0),
        axis: new attributeVectorAxis(null, 1,0,0),
        size: new attributeVectorSize(null, 1,1,1),
        display: {
        	get: function() { return this.canvas },
        	set: function(value) { throw new Error('Cannot change display of existing object')}
        },
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
	    },
	    make_trail: {
	    	get: function() { return this.__make_trail },
	    	set: function(value) { this.__make_trail = value }
	    },
	    interval: {
	    	get: function() { return this.__interval },
	    	set: function(value) { 
	    		this.__interval = value
	    		this.__ninterval = 0
	    	}
	    },
	    retain: { // -1 means don't retain
	    	get: function() { return this.__retain },
	    	set: function(value) { this.__retain = value }
	    },
	    trail_type: {
	    	get: function() {
	    		if (this.__trail_type == 'curve') return 'curve'
	    		else if (this.__trail_type == 'spheres') return 'points'
	    		else return this.__trail_type
	    		},
	    	set: function(value) {
	    		if (value == 'curve') this.__trail_type = 'curve'
	    		else if (value == 'points') this.__trail_type = 'spheres'
	    		else throw new Error('trail_type must be "curve" or "points".')
	    	}
	    },
	    trail_object: {
	    	get: function() { return this.__trail_object }
	    },
	    __update_trail: function(v) {
	    	this.__ninterval++
	    	if (this.__ninterval >= this.__interval) {
	    		this.__ninterval = 0
				if (this.__retain == -1) this.__trail_object.push(v)
				else this.__trail_object.push({pos:v, retain:this.__retain})
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
        	if (vp) components = obj.__components = [vp_box({ canvas:obj.canvas, visible: obj.visible }), 
        	                                         vp_pyramid({ canvas:obj.canvas, visible: obj.visible })]
        	else components = obj.__components = [box({ canvas:obj.canvas, visible: obj.visible }), 
                                                  pyramid({ canvas:obj.canvas, visible: obj.visible })]
            for (var i = 0; i < components.length; i++) {
                components[i].__id = nextVisibleId++
                components[i].__falsecolor = obj.__falsecolor
            }
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

        obj.size = vec(L, hw, hw)

        shaft.__update()
        tip.__update()
    }

    function arrow(args) { return initObject(this, arrow, args) }
    subclass(arrow, box)
    property.declare( arrow.prototype, {
        __primitiveCount: 2,
        shaftwidth: 0,
        headwidth: 0,
        headlength: 0,
        axis_and_length: new attributeVectorAxis(null, 1,0,0),
        __update: function () { arrow_update(this, false) },
        __get_extent: function(ext) {
        	if (!this.__components) this.__update()
	        Autoscale.find_extent(this.__components[0], ext)
	        Autoscale.find_extent(this.__components[1], ext)
        }
    })
    
    function vp_arrow(args) { return initObject(this, vp_arrow, args) }
    subclass(vp_arrow, arrow)
    property.declare( vp_arrow.prototype, {
    	axis: new attributeVectorAxis(null, 1,0,0),
    	__update: function () { arrow_update(this, true) }
    })

    function vertex(args)  {
    	// Comment by David Scherer: In WebGL indices are required to be Uint16Array, so less than 65536.
    	// To handle more than this many index values, we need more lists. Moreover, a triangle or quad might
    	// use vertex objects from more than one list, which requires some duplication. As a temporary
    	// measure to get going, just give an error if one tries to create more than 65536 vertex objects.
    	// We keep info on what triangles or quads use a vertex, and if the
    	// count goes to zero, the slot can be reused.
    	if (!(this instanceof vertex)) { return new vertex(args) } // so vertex() is like new vertex()
    	args = args || {}
        if (args.canvas !== undefined) {
            this.canvas = args.canvas
            delete args.canvas
        } else if (args.display !== undefined) {
            this.canvas = args.display
            delete args.display
        } else {
            this.canvas = canvas.selected
        }
    	for (var attr in args) this[attr] = args[attr]
    	if (args.opacity === undefined) this.opacity = 1
    	if (this.__texpos.z !== 0) throw new Error('In a vertex the z component of texpos must be zero.')
    	if (this.canvas.vertex_id >= 65536) throw new Error('Currently the number of vertices is limited to 65536.')
    	var lengths = {pos:3, normal:3, color:3, opacity:1, shininess:1, emissive:1, texpos:2, bumpaxis:3}
    	this.__id = this.canvas.__vertices.available.pop()
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
        display: {
        	get: function() { return this.canvas },
        	set: function(value) { throw new Error('Cannot change display of existing object')}
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
    	// 1000000 Float32Array(array) or Uint16Array(array) costs about 15 ms
    	// Conclusion: keep data arrays in Float32Array format except for index array, which should be an ordinary array
	    if (!(this instanceof triangle)) return new triangle(args)  // so triangle() is like new triangle()
	    args = args || {}
	    var vnames = ['v0', 'v1', 'v2']
	    for (var i=0; i<3; i++)
	    	if (args[vnames[i]] === undefined) throw new Error('A triangle must have a vertex '+vnames[i]+'.')
        this.__tex = {file: null, bumpmap: null, texture_ref: {reference: null}, bumpmap_ref: {reference: null}, 
				  left: false, right: false, sides: false, flipx: false, flipy: false, turn: 0, flags: 0 }
	    init(this, args)
	    //this.__v0.__change() // force display of the triangle
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
        display: {
        	get: function() { return this.canvas },
        	set: function(value) { throw new Error('Cannot change display of existing object')}
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
	    for (var i=0; i<4; i++)
	    	if (args[vnames[i]] === undefined) throw new Error('A quad must have a vertex '+vnames[i]+'.')
        this.__tex = {file: null, bumpmap: null, texture_ref: {reference: null}, bumpmap_ref: {reference: null}, 
				  left: false, right: false, sides: false, flipx: false, flipy: false, turn: 0, flags: 0 }
	    init(this, args)
	    //this.__v0.__change() // force display of the quad
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
        display: {
        	get: function() { return this.canvas },
        	set: function(value) { throw new Error('Cannot change display of existing object')}
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
        initObject(this, compound, parameters)
        var cloning = false
        if (parameters.__cloning) {
        	cloning = true
        	var mesh = parameters.__cloning
        	delete parameters.__cloning
        }
        
        var visible = true
        if (parameters !== undefined) {
        	for (var attr in parameters) this[attr] = parameters[attr]
            visible = (parameters.visible === undefined) ? true : parameters.visible
        }
        
        function update_extent(c, extent) {
	        for (var ext in extent) {
	        	var value = extent[ext]
	        	if (ext.slice(-3) == 'min') { if (c[ext] === null || value < c[ext]) c[ext] = value }
	        	else { if (c[ext] === null || value > c[ext]) c[ext] = value }
	        }
        }

        if (!cloning) {
	        var mesh = new Mesh()
	        for (var i = 0; i < objects.length; i++) {
	            var o = objects[i]

	            if (o instanceof extrusion)
	            	throw new Error('Cannot currently make a compound of an extrusion object.')
	            else if (o instanceof arrow)
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
	            if (o instanceof triangle || o instanceof quad) {
	        		update_extent( this, mesh.merge(o.v0, o.v0, 0) )
	        		update_extent( this, mesh.merge(o.v1, o.v1, 0) )
	        		update_extent( this, mesh.merge(o.v2, o.v2, 0) )
	            	if (o instanceof quad) {
	            		// Bias the index to point to already existing data:
	            		update_extent( this, mesh.merge(o.v0, o.v0, -3) )
	            		update_extent( this, mesh.merge(o.v2, o.v2, -1) )
	            		update_extent( this, mesh.merge(o.v3, o.v3, 0) )
	            	}
	            } else {
	            	update_extent( this, mesh.merge(o.getTransformedMesh(), o, 0) )
	            }
	        }
	        this.__center = vec( (this.__xmin + this.__xmax)/2, (this.__ymin + this.__ymax)/2, (this.__zmin + this.__zmax)/2 )
	        this.__pseudosize = vec( (this.__xmax-this.__xmin), 
	        				(this.__ymax-this.__ymin), (this.__zmax-this.__zmin) )
	        compound_id++
			mesh.__mesh_id = 'compound'+compound_id
	        this.canvas.__renderer.add_model(mesh, false)
        }
		this.__mesh = mesh
        this.__model = this.canvas.__renderer.models[mesh.__mesh_id]

        this.visible = visible
    }
    subclass(compound, box)
    property.declare( compound.prototype, {
        clone: function(args) {
        	var newargs = {pos:this.__pos, color:this.__color, opacity:this.__opacity, 
        			size:this.__size, axis:this.__axis, up:this.__up, textures:this.__texture,
            		shininess:this.__shininess, emissive:this.__emissive, 
            		visible:true, pickable:this.__pickable,
            		__center:this.__center, __pseudosize:this.__pseudosize}
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
	        if (Math.abs(axis.dot(up)) / Math.sqrt(up.mag2()*axis.mag2()) > 0.98) {
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
    	__get_extent: function(ext) {
    		// Mock up appropriate data structures for Autoscale.find_extent
    		var savepos = this.__pos, savesize = this.__size
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
    })

    function curve(args) { // TODO: shrinking a curve's extent doesn't trigger moving the camera inward; dunno why.
        if (!(this instanceof curve)) return new curve(args)  // so curve() is like new curve()
        args = args || {}
    	if (args['texture'] !== undefined) throw new Error("Textures are not available for curve objects.")
    	if (args['opacity'] !== undefined) throw new Error("Opacity is not available for curve objects.")
    	this.__points = []
    	
    	initObject(this, curve, args)

        if (this.radius === undefined) this.radius = 0 // means width of a few pixels
    }
    subclass(curve, Primitive)
    property.declare( curve.prototype, {
    	pos: {
    		get: function() {
    			var ret = []
    			var pts = this.__points
    			for (var i=0; i<pts.length; i++) ret.append(pts[i].__pos)
    			return ret
    		},
    		set: function(value) {
    			this.__points = []
    			this.push(value) 
    		}
    	},
    	origin: new attributeVector(null, 0,0,0),
        radius: 0,
        display: {
        	get: function() { return this.canvas },
        	set: function(value) { throw new Error('Cannot change display of existing object')}
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
                //ext.point_extent(this, pnt[i].__pos)
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
    		Autoscale.find_extent(this, ext)
    		this.__pos = savepos
    		this.__size = savesize	
        },
        push: function(pts) {
            var args = [], pt
            if (pts.length !== undefined) args = pts
            else for (var i=0; i<arguments.length; i++) args.push(arguments[i])
            for (var i=0; i<args.length; i++) {
                pt = point(args[i])
                if (args[i].retain !== undefined) if (this.__points.length >= args[i].retain) this.shift()
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
            this.__change()
        },
        append: function(pts) { // synonym for push, for better match to Python
        	this.push(pts)
        },
        pop: function() {
            var p = this.__points.pop()
            p.visible = false
            this.__change()
            return {pos:p.pos, color:p.color, radius:p.radius, visible:p.visible}
        },
        point: function (N) {
        	return this.__points.slice(N,N+1)[0]
        },
        clear: function() {
            this.splice(0,this.__points.length)
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
                if (attr == 'y') this.__points[N].pos.y = args[attr]
                if (attr == 'z') this.__points[N].pos.z = args[attr]
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
        radius: { value: -1, onchanged: function() { this.__change() } },
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
    
    function points(args) { 
	    if (!(this instanceof points)) return new points(args)  // so points() is like new points()
	    args = args || {}
		if (args['texture'] !== undefined) throw new Error("Textures are not available for points objects.")
		if (args['opacity'] !== undefined) throw new Error("Opacity is not available for points objects.")
	    this.__points = []
		this.__size = 0 // means width of a few pixels
		this.__pixels = true
		this.__visible = true
		
		initObject(this, points, args)
	
		this.__last_range = -1
    	this.canvas.__points_objects.push(this)
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
    	radius: {
    		get: function() { throw new Error("The points object does not have a radius attribute.") },
    		set: function(value) { throw new Error("The points object does not have a radius attribute.") }
    	},
    	size: {
    		get: function() { return this.__size },
    		set: function(value) { this.__size = value }
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
    		get: function() {console.log('get', this.__visible); return this.__visible },
    		set: function(value) {
    				for (var p in this.__points) {
    					this.__points[p].visible = value
    				}
    		}
    	},
        push: function(pts) {
            var args = [], pt
            if (pts.length !== undefined) args = pts
            else for (var i=0; i<arguments.length; i++) args.push(arguments[i])
            for (var i=0; i<args.length; i++) {
            	var arg = args[i]
            	if (arg instanceof vec) arg = {pos:arg}
            	if (arg.radius !== undefined) throw new Error("The points object does not have a radius attribute.")
            	if (arg.size !== undefined) throw new Error("Individual points objects do not have a size attribute.")
                if (arg.retain !== undefined && this.__points.length >= arg.retain) {
                	var obj = this.__points.shift()
                	obj.pos = arg.pos
                	this.__points.push(obj)
                } else {
                	var D = this.__size
                	var c = (arg.color === undefined) ? this.__color : arg.color
                	// Avoid resetting all sphere diameters (in WebGLRenderer.js) if possible:
                	if (this.__last_range != -1 && this.__last_range === this.canvas.__range) {
                		D = this.__points[0].__size.x // can use diameter of existing sphere
    				} else {
    					D = 0
    					this.__last_range = -1 // force readjustments of diameter
    				}
	            	if (window.__GSlang == 'vpython') {
	                    this.__points.push(vp_sphere({pos:arg.pos, size:vec(D,D,D), color:c, pickable:false}))
	            	} else{
	            		this.__points.push(sphere({pos:arg.pos, size:vec(D,D,D), color:c, pickable:false}))
	            	}
                }
            }
        },
        append: function(pts) { // synonym for push, for better match to Python
        	this.push(pts)
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
        display: {
        	get: function() { return this.canvas },
        	set: function(value) { throw new Error('Cannot change display of existing object')}
        },
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
    
    // The beginnings of an extrusion object to be further developed in GlowScript.
	// This implementation currently lacks many features of the classic VPython extrusion object and undoubtedly has bugs.
	// The extrusion function creates the object using vertex and quad objects.

	function make_circle(args) {
	    var pos, axis, radius, np, path
	    pos = (args.pos === undefined) ? vec(0,0,0) : args.pos
	    radius = (args.radius === undefined) ? 3 : args.radius
	    np = (args.np === undefined) ? 32 : args.np
	    path = (args.path === undefined) ? true : args.path // if false, it is a shape
	    if (args.axis === undefined) {
	    	if (path) axis = vec(0,1,0)
	    	else axis = vec(0,0,1)
	    } else {
	    	if (!path) throw new Error("Cannot specify an axis when creating a shape.")
	    	axis = norm(args.axis)
	    }
	    var x = vec(1,0,0)
	    var y = vec(0,1,0)
	    var z = vec(0,0,1)
	    if (y.diff_angle(axis) > 0.001) {
	    	x = norm(y.cross(axis))
	    	y = axis
	    	z = norm(x.cross(axis))
	    }
	    var coords = []
	    var dtheta = 2*Math.PI/np
	    var dc = Math.cos(dtheta) // use trig recursive relations for speed
	    var ds = Math.sin(dtheta)
	    var c = radius
	    var s = 0
	    var temp
	    for (var i=0; i<np; i++) {
	        if (path) coords.push(pos.add(x.multiply(c).add(z.multiply(-s))))
	        else coords.push([pos.x+c,pos.y+s])
	        temp = c
	        c = c*dc - s*ds     // cos(a + da) = cos(a)cos(da) - sin(a)sin(da)
	        s = s*dc + temp*ds  // sin(a + da) = sin(a)cos(da) + cos(a)sin(da)
	    }
	    coords.push(coords[0]) // closed path or shape
	    return coords
	}

	function make_rectangle(args) {
	    var pos, axis, width, height, np, path
	    pos = (args.pos === undefined) ? vec(0,0,0) : args.pos
	    width = (args.width === undefined) ? 5 : args.width
	    height = (args.height === undefined) ? 3 : args.height
	    path = (args.path === undefined) ? true : args.path // if false, it is a shape
	    if (args.axis === undefined) {
	    	if (path) axis = vec(0,1,0)
	    	else axis = vec(0,0,1)
	    } else {
	    	if (!path) throw new Error("Cannot specify an axis when creating a shape.")
	    	axis = norm(args.axis)
	    }
	    var x = vec(1,0,0)
	    var y = vec(0,1,0)
	    var z = vec(0,0,1)
	    if (y.diff_angle(axis) > 0.001) {
	    	x = norm(y.cross(axis))
	    	y = axis
	    	z = norm(x.cross(axis))
	    }
	    var coords = []
	    var w = width/2
	    var h = height/2
	    if (path) {
	    	var xz = [ [w,h], [w,-h], [-w,-h], [-w,h] ] // CCW path in xz plane, starting at front right
		    for (var i=0; i<4; i++) {
		    	var c = xz[i]
		    	coords.push(pos.add(x.multiply(c[0]).add(z.multiply(c[1]))))
		    }
	    } else {
	    	var xy = [ [w,-h], [w,h], [-w,h], [-w,-h] ] // CCW path in xy plane, starting at lower right
		    for (var i=0; i<4; i++) {
		    	var c = xy[i]
		    	coords.push([pos.x+c[0],pos.y+c[1]])
		    }
	    }
	    coords.push(coords[0]) // closed path or shape
	    return coords
	}
	
	var paths = { // paths should by default go counterclockwise in the xz plane; that is, looking down from above
	    circle: function(args) {
	        args = args || {}
	        args.path = true
	        return make_circle(args)
	    },
	    rectangle: function(args) {
	        args = args || {}
	    	args.path = true
	        return make_rectangle(args)
	    }
	}
	
	var shapes = { // shapes should go counterclockwise in the xy plane
	    circle: function(args) {
	        args = args || {}
	        args.path = false
	        return make_circle(args)
	    },
	    rectangle: function(args) {
	        args = args || {}
	    	args.path = false
	        return make_rectangle(args)
	    }
	}
	
	function make_extrusion(args) {
	    var origin, pos, shapelist, col, up, opacity, can, owner // owner is an extrusion or a ring 
	    can = args.canvas
	    owner = args.owner
	    origin = (args.origin === undefined) ? vec(0,0,0) : args.origin
	    if (args.pos === undefined) {
	        throw new Error('An extrusion object needs a pos attribute.')
	    } else pos = args.pos
	    if (args.shape === undefined) {
	        throw new Error('An extrusion object needs a shape attribute.')
	    } else shapelist = args.shape
	    up = (args.up === undefined) ? can.up : args.up
	    col = (args.color === undefined) ? color.white : args.color
	    opacity = (args.opacity === undefined) ? 1 : args.opacity
	    var got_vertices = false
	    var vertices = []
	    if (args.vertices !== undefined) {
	    	vertices = args.vertices
	    	got_vertices = true
	    }
	
	    var shapeinfo = [] // elements of this list are {pos:p, normal:n} info for the given shape
	    var quads = []
        var shape = []
        for (var i=0; i<shapelist.length; i++) shape.push(vec(shapelist[i][0], shapelist[i][1], 0))
	    var shape_closed = shape[shape.length-1].equals(shape[0])
	    if (!shape_closed) throw new Error("Currently the extrusion shape must be closed.")
	    var path_closed = pos[pos.length-1].equals(pos[0])
	    if (!path_closed) throw new Error("Currently the extrusion path must be closed.")
	    var smooth = 0.95 // Smooth the edges if cosine of difference angle is greater than 0.95 (less than 18 degrees)
	    
	    function find_shape_info() { // for points in the shape xy plane, find pos and normal for needed vertex objects
	        var out = vec(0,0,1)
	        var L = shape.length
	        var previous = shape[0].sub(shape[L-2])
	        var firstsharp = null
	        for (var i=0; i<L-1; i++) {
	            var v = shape[i+1].sub(shape[i])
	            var a = previous.cross(out).norm()
	            var b = v.cross(out).norm()
	            var c = norm(v).dot(norm(previous))
	            var v1 = shape[i]
	            if (c <= smooth) { // sharp corner
	            	if (i === 0) firstsharp = {pos:v1, normal:a, smooth:false}
	            	else shapeinfo.push({pos:v1, normal:a, smooth:false})
	                shapeinfo.push({pos:v1, normal:b, smooth:false})
	            } else { // smooth corner
	                var n = norm(a.add(b))
	                shapeinfo.push({pos:v1, normal:n, smooth:true})
	            }
	            previous = v
	        }
	        if (firstsharp !== null) shapeinfo.push(firstsharp)
	    }
	    
	    find_shape_info()
	    var V = shapeinfo.length // number of vertices to render the shape
	    
        function generate_vertices(p,x,y,nx,sharp,makequads) { // path pos, x and y axes in shape plane
        	// s scales the normal in case of a smooth corner, where the shape is stretched
	    	// nx is the x axis in the case of a sharp bend in the path; it is perpendicular to the path
	    	var s = mag(x)
        	if (sharp) s = 1
            for (var k=0; k<V; k++) {
            	var info = shapeinfo[k]
            	// v is location of the shapeinfo vertex
                var v = (p.add(x.multiply(info.pos.x))).add(y.multiply(s*info.pos.y))
                var n = info.normal
                var N = nx.multiply(n.x).add(y.multiply(n.y))
                if (got_vertices && ivertex < vertices.length) {
                	var thisv = vertices[ivertex]
                	thisv.pos = v
                	thisv.normal = N
                	thisv.color = col
                	thisv.opacity = opacity
                	ivertex++
                } else {
                	vertices.push(vertex({pos:v.add(origin), normal:N, color:col, opacity:opacity}))
                	ivertex++
                }
            }
            if (!got_vertices && makequads) {
            	var start = vertices.length-2*V
                for (var k=start; k<start+V; k++) {
                    if (k == start+V-1) {
                        quads.push(quad({v0:vertices[k], v1:vertices[k+V], v2:vertices[start+V], v3:vertices[start], __owner:owner}))
                    } else {
                        quads.push(quad({v0:vertices[k], v1:vertices[k+V], v2:vertices[k+V+1], v3:vertices[k+1], __owner:owner}))
                        if (!shapeinfo[k-start+1].smooth) k++
                    }
                }
            }
        }
	
	    // At a corner along the path, A is the direction of the segment preceding this corner
	    // and Anext is the direction of the following segment.
	    // vx and vy are vectors representing axes in the plane of the 2D shape at this corner.
	    var vx, vy, Anext, theta, perp
	    var L = pos.length
	    var A = norm(pos[1].sub(pos[0]))
	    if (path_closed) {
	        Anext = A
	        A = norm(pos[0].sub(pos[L-2]))
	    }
	    
	    var ipath = 0
	    var ivertex = 0
	    while (ipath < L) {
	        if (path_closed && (ipath == L-1) && !got_vertices && !firstsharp) { // last set of quads
	            var start = vertices.length-V
	            for (var j=start; j<start+V; j++) {
	                if (j == start+V-1) {
	                    quads.push(quad({v0:vertices[j], v1:vertices[V-1], v2:vertices[0], v3:vertices[start], __owner:owner}))
	                } else {
	                	quads.push(quad({v0:vertices[j], v1:vertices[j-start], v2:vertices[j-start+1], v3:vertices[j+1], __owner:owner}))
                        if (!shapeinfo[j-start+1].smooth) j++
	                }
	            }
        	} else {
	            
	            if (ipath > 0 || !path_closed) {
	                if (ipath < L-1) {
	                    Anext = norm(pos[ipath+1].sub(pos[ipath]))
	                } else {
	                    Anext = A
	                }
	            }
	
	            if (ipath == L-1) {
	            	A = norm(pos[0].sub(pos[L-2]))
	            	Anext = norm(pos[1].sub(pos[0]))
	            }
	            theta = Anext.diff_angle(A)/2 // *** need to consider case of theta === 0
	            perp = norm(A.add(Anext))     // a vector perpendicular to the joint cross section
	            vy = norm(A.cross(Anext))     // *** again, need to deal with theta === 0
	            vx = perp.cross(vy).divide(Math.cos(theta))
	            var sharp = (A.dot(Anext) <= smooth) // if true, path takes a sharp turn here
	            var firstsharp
	            if (ipath === 0) firstsharp = sharp

		        if (sharp) { // sharp corner
		        	if (ipath > 0) generate_vertices(pos[ipath],vx,vy,norm(A.cross(vy)),true,true)
		        	if (ipath < L-1) generate_vertices(pos[ipath],vx,vy,norm(Anext.cross(vy)),true,false)
		        } else { // smooth corner
		        	generate_vertices(pos[ipath],vx,vy,norm(vx),false,ipath>0)
		        }
	            A = Anext
	       	}
            ipath++
	    }
	    return vertices
	}

	function arrayequals(a,b) {
	    var La = a.length
	    var Lb = b.length
	    if (La !== Lb) return false
	    for (var i=0; i<La; i++) if (a[i] !== b[i]) return false
	    return true
	}

	function extrusion(args) {
		if (!(this instanceof extrusion)) return new extrusion(args)  // so extrusion() is like new extrusion()
		initObject(this, extrusion, args)
		this.__initialize = true
		this.__update()
	}
	subclass(extrusion, Primitive)
	property.declare( extrusion.prototype, {
        texture: {
        	get: function() {throw new Error("Textures are not available for extrusion objects.")},
        	set: function(val) {throw new Error("Textures are not available for extrusion objects.")}
        },
        radius: {
        	get: function() {throw new Error("An extrusion has no radius.")},
        	set: function(val) {throw new Error("An extrusion has no radius.")}
        },
        display: {
        	get: function() { return this.canvas },
        	set: function(value) { throw new Error('Cannot change display of existing object')}
        },
    	origin: new attributeVector(null, 0,0,0),
        __initialize: true,
        pos: {
        	get: function() {
        		var ret = []
        		for (var i=0; i<this.pos.length; i++) ret.push(this.__pos[i].sub(this.__origin))
        		return ret
        		},
        	set: function(p) {
        		this.__pos = p
        		this.__change()
        	}
        },
        shape: {
        	get: function() {return this.__shape},
        	set: function(s) {
        		this.__shape = s
        		this.__change()
        	}
        },
        color: {
        	get: function() {return this.__color},
        	set: function(value) {
        		this.__color = value
        		this.__change()
        	}
        },
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
        __get_extent: function (ext) {
        	if (this.__comp) this.__comp.__get_extent(ext)
        },
        clone: function(args) {
        	var newargs = {canvas:this.canvas, origin:this.__origin, pos:this.__pos, shape:this.__shape, 
        			color:this.__color, __lastcolor:this.__lastcolor,
        			opacity:this.__opacity, __lastopacity:this.__lastopacity, visible:true}
        	for (var attr in args) {
        		newargs[attr] = args[attr]
        	}
        	return new this.constructor(newargs)
        },
        __update: function() {
        	if (!this.__initialize) {
        		if (!arrayequals(this.__pos,this.__lastpos) || !arrayequals(this.__shape,this.__lastshape)) {
        				this.__initialize = true
        		} else {
        			var col = !this.__color.equals(this.__lastcolor)
        			var op = (this.__opacity !== this.__lastopacity)
        			var org = !this.__origin.equals(this.__lastorigin)
        			if (col || op || org) {
	        			var dp = this.__origin.sub(this.__lastorigin)
	        			for (var i=0; i<this.__vertices.length; i++) {
	        				var v = this.__vertices[i]
		    				if (col) v.color = this.__color
		    				if (op) v.opacity = this.__opacity
		    				if (org) v.pos = v.pos.add(dp)
		    				// With more work it might be possible to adjust the normals of existing vertex objects
	        			}
        			}
    	            this.__lastpos = this.__pos.slice()
    	            this.__lastshape = this.__shape.slice()
    	            this.__lastcolor = vec(this.__color)
    	            this.__lastopacity = this.__opacity
    	            this.__lastorigin = vec(this.__origin)
    	            this.__initialize = false
        		}
        	}
            
        	if (this.__initialize) {
	    		// If this.__vertices exists, need to tell make_extrusion to use them.
        		this.__vertices =  make_extrusion({canvas:this.canvas, vertices:this.__vertices, origin:this.__origin,
	    			pos:this.__pos, shape:this.__shape, color:this.__color, 
	    			opacity:this.__opacity, owner:this})
	            // Save copies of the state of the last creation of vertices for the extrusion:
	            this.__lastpos = this.__pos.slice()
	            this.__lastshape = this.__shape.slice()
	            this.__lastcolor = vec(this.__color)
	            this.__lastopacity = this.__opacity
	            this.__lastorigin = vec(this.__origin)
	            this.__initialize = false
        	}
        }
    })
    
    /*
    // Make extrusion in shape of a ring in order to be able to compound the ring
    		obj.__vertices = make_extrusion({canvas:obj.canvas, vertices:obj.__vertices, 
    					color:obj.__color, opacity:obj.__opacity, owner:obj,
    					pos:paths.circle({make_ring:true, radius:0.5*(obj.__size.y-obj.__size.x), np:64,
        					pos:obj.__pos, axis:obj.__axis}), 
            			shape:shapes.circle({radius:0.5*obj.__size.x, np:20}) })
	*/
    
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
        font: { value: "Verdana", onchanged: function() { this.__change() } },
        height: { value: 13, onchanged: function() { this.__change() } },
        visible: { value: false, onchanged: function() { this.__change() } },
        align: { value: "center", onchanged: function() { this.__change() } },
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
            var xoffset = this.__xoffset, yoffset = this.__yoffset
            var posx, posy
            if (this.__pixel_pos) {
                posx = this.__pos.x
                posy = this.__pos.y
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

            ctx.font = this.__height + 'px ' + this.__font
            ctx.textAlign = 'left' // make explicit to simplify/clarify later calculations
            ctx.textBaseline = 'middle'
            ctx.lineWidth = this.__linewidth
            var default_color = vec(1,1,1)
            if (this.canvas.__background.equals(vec(1,1,1))) default_color = vec(0,0,0)
            ctx.strokeStyle = color.to_html(this.__linecolor || this.__color || default_color)

            function oneline(obj, px, py, line) { // output one line of a possibly multiline text
            	var tx = px, ty = py
	            var twidth = ctx.measureText(line).width
	            var tw, th, xleft, ytop, xend, yend
	            tw = Math.ceil(twidth)
	            th = Math.ceil(obj.__height + 2*obj.__border)
	            xleft = Math.floor(tx - obj.__border) + 0.5
	            ytop = Math.ceil(ty - .4 * th) - 0.5
	            if (xoffset || yoffset) {
	                if (Math.abs(yoffset) > Math.abs(xoffset)) {
	                    if (yoffset > 0) {
	                        ytop -= yoffset + th / 2
	                        ty -= yoffset + th / 2
	                        yend = ytop + th
	                    } else {
	                        ytop -= yoffset - th / 2
	                        ty -= yoffset - th / 2
	                        yend = ytop
	                    }
	                    tx += xoffset - tw / 2
	                    xleft = tx - obj.__border
	                    xend = tx + tw / 2
	                } else {
	                    if (xoffset > 0) {
	                        xleft += xoffset
	                        tx += xoffset
	                        xend = xleft
	                    } else {
	                        tx += xoffset - tw
	                        xleft = tx - obj.__border
	                        xend = tx + tw + obj.__border
	                    }
	                    ty -= yoffset
	                    ytop -= yoffset
	                    yend = ytop + th / 2
	                }
	                if (obj.__line) {
	                    ctx.beginPath()
	                    if (obj.space > 0) {
	                        var v = (vec(xend - px, yend - py, 0).norm()).multiply(k * obj.space)
	                        v = v.add(vec(px, py, 0))
	                        ctx.moveTo(v.x, v.y)
	                    } else ctx.moveTo(px, py)
	                    ctx.lineTo(xend, yend)
	                    ctx.stroke()
	                }
	            } else {
	                switch (obj.__align) {
	                    case 'center':
	                        tx -= twidth / 2
	                        xleft -= twidth / 2
	                        break
	                    case 'right':
	                        tx -= twidth
	                        xleft -= twidth
	                }
	            }
	            
            	tw += 2*obj.__border
	            return [xleft, ytop, tw, th, tx, ty]
            }

	    	var lines = this.__text.split('\n')
	    	var ret // [xleft, ytop, tw, th, tx, ty]
	    	var xy = []
	    	var xmin, ymax, width, height = 0
			for (var n=0; n<lines.length; n++) {
				ret = oneline(this, posx, posy+n*1.2*this.__height, lines[n])
				xy.push([ret[4], ret[5]])
				if (xmin === undefined || ret[0] < xmin) xmin = ret[0]
				if (n == 0) ymax = ret[1]
				if (width === undefined || ret[2] > width) width = ret[2]
				height += 1.2*this.__height
			}
	    	height += 2*this.__border - 0.2*this.__height

            var bcolor
            if (this.__background == null) bcolor = this.canvas.__background
            else bcolor = this.__background
            ctx.fillStyle = color.to_html_rgba(bcolor, this.__opacity)
            ctx.fillRect(xmin, ymax, width, height)
            
            if (this.__box) {
                ctx.beginPath()
                ctx.moveTo(xmin, ymax)
                ctx.lineTo(xmin + width, ymax)
                ctx.lineTo(xmin + width, ymax + height)
                ctx.lineTo(xmin, ymax + height)
                ctx.closePath()
                ctx.stroke()
            }

            ctx.fillStyle = color.to_html(this.__color || default_color)
            for (var n=0; n<lines.length; n++) {
	            ctx.fillText(lines[n], xy[n][0], xy[n][1])
            }
        },
        __change: function () { if (this.canvas !== undefined) this.canvas.__overlay_objects.__changed = true }
    })

    function attach_trail(objectOrFunction, options) {
        if (!(this instanceof attach_trail)) return new attach_trail(objectOrFunction, options)  // so attach_trail() is like new attach_trail()
        if (options === undefined) options = {}
    	if (window.__GSlang == 'vpython' && options.display !== undefined) {
    		options.canvas = options.display
    		delete options.display
    	}
        if (options.canvas === undefined) {
            options.canvas = canvas.selected
            if (typeof objectOrFunction !== "function") options.canvas = objectOrFunction.canvas
        }
        if (options.type === undefined) {
            this.type = 'curve'
        } else {
            switch (options.type) {
                case 'curve':
                    this.type = options.type
                    delete options.type
                    break
                case 'spheres':
                    this.type = options.type
                    delete options.type
                    break
                default:
                    throw new Error("attach_trail type must be 'curve' or 'spheres'")
            }
        }
        this.retain = -1 // show all trail points
        if (options.retain !== undefined) {
            this.retain = options.retain
            delete options.retain
        }
        this.pps = 0 // means show all trail points
        if (options.pps !== undefined) {
            this.pps = options.pps
            delete options.pps
        } 
        var radius
        this.__obj = objectOrFunction // either an object or a function
        if (typeof objectOrFunction !== "function") {
            if (options.color === undefined) options.color = objectOrFunction.color
            if (options.radius === undefined) radius = 0.1*objectOrFunction.size.y
            else {
                radius = options.radius
                delete options.radius
            }
        } else {
            if (options.radius === undefined) radius = 0.001*options.canvas.__range
            else {
                radius = options.radius
                delete options.radius
            }
        }
        if (this.type == 'curve') options.radius = radius
        else options.size = vec(2*radius,2*radius,2*radius)
        options.pickable = false
        this.__options = options
        if (this.type == 'curve') this.__curve = curve({canvas:options.canvas, color:options.color, radius:options.radius})
        else this.__spheres = []
        this.__last_pos = null
        this.__last_time = null
        this.__run = true
        this.__elements = 0 // number of curve points or spheres created
        options.canvas.trails.push(this)
        
        this.start = function() {
            this.__run = true
            if (this.type === 'curve') this.curve = curve(this.options) // start new curve
        }
        this.stop = function() {this.__run = false}
        this.clear = function() {
            this.__last_pos = null
            this.__last_time = null
            this.__elements = 0 // number of curve points or spheres created
            if (this.type == 'curve') {
                this.__curve.clear()
            } else {
                var c = this.__spheres
                for (var i=0; i<c.length; i++) {
                    c[i].visible = false // make all existing spheres invisible
                }
                this.__spheres = [] // create a new set of spheres
            }
        }
    }

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
        thiscanvas.arrows.push(this)
        
        this.start = function() {this.arrow.visible = this.run = true}
        this.stop = function()  {this.arrow.visible = this.run = false}
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
        extrusion: extrusion,
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
    }

    Export(exports)
})()
