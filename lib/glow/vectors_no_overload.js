;(function () {
    "use strict";
    
    // This is a version of vectors.js from which has been stripped the machinery for
    // adding methods to the vec, Number, and Array classes, for use in VPython 7,
    // where the GlowScript code in glowcom.js and glowcom.html does not use operator
    // overloading and can in fact malfunction in its presence.
    
    // vector operator overloading is handled in file papercomp.js, extracted by Salvatore di Dio
    // from the PaperScript project of Jurg Lehni: http://scratchdisk.com/posts/operator-overloading.

    // Angus Croll:
	// http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
    // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
    // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"

    var toType = function(obj) { 
        return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
	}
    
    function adjust_up(parent, oldaxis, newaxis) { // adjust up when axis is changed
    	parent.__change()
    	if (newaxis.mag2 === 0) {
    		// If axis has changed to <0,0,0>, must save the old axis to restore later
    		if (parent.__oldaxis === undefined) parent.__oldaxis = oldaxis
    		return
    	}
		if (parent.__oldaxis !== undefined) {
			// Restore saved oldaxis now that newaxis is nonzero
			oldaxis = parent.__oldaxis
			parent.__oldaxis = undefined
    	}
		if (newaxis.dot(parent.__up) === 0) return // axis and up already orthogonal
    	var angle = oldaxis.diff_angle(newaxis)
    	if (angle > 1e-6) { // smaller angles lead to catastrophes
    		var rotaxis, newup
    		// If axis is flipped 180 degrees, cross(oldaxis,newaxis) is <0,0,0>:
    		if (Math.abs(angle-Math.PI) < 1e-6) newup = parent.__up.multiply(-1)
    		else {
	        	rotaxis = cross(oldaxis,newaxis)
	        	newup = parent.__up.rotate({angle:angle, axis:rotaxis})
    		}
        	// Be careful not to alter the attributeVectorUp character of parent.__up
        	parent.__up.__x = newup.x
        	parent.__up.__y = newup.y
        	parent.__up.__z = newup.z
	    }
    }
    
    function adjust_axis(parent, oldup, newup) { // adjust axis when up is changed
        parent.__change()
    	if (newup.mag2 === 0) {
    		// If up will be set to <0,0,0>, must save the old up to restore later
    		if (parent.__oldup === undefined) parent.__oldup = oldup
    	}
		if (parent.__oldup !== undefined) {
			// Restore saved oldup now that newup is nonzero
			oldup = parent.__oldup
			parent.__oldup = undefined
		}
		if (newup.dot(parent.__axis) === 0) return // axis and up already orthogonal
		var angle = oldup.diff_angle(newup)
    	if (angle > 1e-6) { // smaller angles lead to catastrophes
    		var rotaxis, newaxis
    		// If up is flipped 180 degrees, cross(oldup,newup) is <0,0,0>:
    		if (Math.abs(angle-Math.PI) < 1e-6) newaxis = parent.__axis.multiply(-1)
    		else {
	        	rotaxis = cross(oldup,newup)
	        	newaxis = parent.__axis.rotate({angle:angle, axis:rotaxis})
    		}
        	// Be careful not to alter the attributeVectorAxis character of parent.__axis
        	parent.__axis.__x = newaxis.x
        	parent.__axis.__y = newaxis.y
        	parent.__axis.__z = newaxis.z
    	}
    }

    function vec(x, y, z) {

        if (!(this instanceof vec)) { // "this" is an instance of vec if the function was invoked as "new vec(...)"
            // vec(vec) makes a copy of the vec
            // Mentioning arguments in a function slows the function down.
            // In the case of Microsoft Edge (Dec. 2015), vec was 10 times slower if arguments mentioned!!
            if (y === undefined) 
                if (z === undefined) return new vec(x.x, x.y, x.z)
            return new vec(x, y, z)
        }
        
        if (z === undefined || y === undefined) throw new Error("vector() requires 3 arguments: x, y, and z.")
        this.x = x
        this.y = y
        this.z = z
    }  
    
    // These attributeVector objects must be set up in property.js

    function attributeVector(parent, x, y, z) {
        this.__parent = parent
        this.__x = x
        this.__y = y
        this.__z = z
        if (parent) {
        	parent.__change()
        }
    }
    attributeVector.prototype = new vec(0, 0, 0)
    attributeVector.prototype.constructor = attributeVector

    function attributeVectorPos(parent, x, y, z) { // for pos, to make make_trail work
    	this.__parent = parent
        this.__x = x
        this.__y = y
        this.__z = z
        if (parent) {
        	parent.__change()
        	parent._pos_set = true // needed by attach_trail updating
        	if (parent.__make_trail) parent.__update_trail(vec(x,y,z))
        }
    }
    attributeVectorPos.prototype = new vec(0, 0, 0)
    attributeVectorPos.prototype.constructor = attributeVectorPos

    function attributeVectorAxis(parent, x, y, z) { // for axis in both VPython and JS/RS environments
        this.__parent = parent
        let currentaxis
        if (parent) currentaxis = vec(parent.__axis)
        this.__x = x
        this.__y = y
        this.__z = z
        if (parent) {
            parent.__axis = this
            let m = Math.sqrt(x*x + y*y + z*z)
            if (parent.__sizing) parent.__size.__x = m // Not sphere or ring or text or compound
            if (m === 0) {
                if (parent.__oldaxis === undefined ) parent.__oldaxis = currentaxis
            } else {
                if (parent.__oldaxis !== undefined) {
                    currentaxis = parent.__oldaxis
                    parent.__oldaxis = undefined
                }
                // Do not adjust up if in the process of rotating an object
                if (window.__adjustupaxis) adjust_up(parent, currentaxis, this)
            }
            
        	parent.__change()
        }
    }
    attributeVectorAxis.prototype = new vec(1, 0, 0)
    attributeVectorAxis.prototype.constructor = attributeVectorAxis

    function attributeVectorSize(parent, x, y, z) { // for size in VPython environment
    	this.__parent = parent
        this.__x = x
        this.__y = y
        this.__z = z
        if (parent) {
        	if (parent.__sizing) { // Not sphere or ring or text or compound
                // Be careful not to alter the attributeVectorAxis character of parent.__axis
                var pa = parent.__axis
                if (pa.x === 0 && pa.y === 0 && pa.z === 0) {
                    if (parent.__oldaxis !== undefined) {
                        pa = parent.__oldaxis
                        parent.__oldaxis = undefined
                    } else {
                        pa = vec(1,0,0)
                    }
                }
                var v = pa.norm().multiply(x)
	        	parent.__axis.__x = v.x
	        	parent.__axis.__y = v.y
                parent.__axis.__z = v.z
        	}
        	parent.__change()
        }
    }
    attributeVectorSize.prototype = new vec(1,1,1)
    attributeVectorSize.prototype.constructor = attributeVectorSize

    function attributeVectorUp(parent, x, y, z) { // for size in VPython environment
    	var oldup
        this.__parent = parent
        if (parent) oldup = norm(parent.__up)
        this.__x = x
        this.__y = y
        this.__z = z
        if (parent) {
        	// Do not adjust axis if in the process of rotating an object:
        	if (window.__adjustupaxis) adjust_axis(parent, oldup, this)
        	parent.__change()
        }
    }
    attributeVectorUp.prototype = new vec(0,1,0)
    attributeVectorUp.prototype.constructor = attributeVectorUp
    
    // Ordinary attributeVector --------------------------------------------------------------------

    Object.defineProperty(attributeVector.prototype, '__x', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVector.prototype, 'x', {
        enumerable: true,
        get:
            function () { return this.__x },
        set:
            function (value) {
                this.__x = value
                this.__parent.__change()
            }
    });

    Object.defineProperty(attributeVector.prototype, '__y', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVector.prototype, 'y', {
        enumerable: true,
        get:
            function () { return this.__y },
        set:
            function (value) {
                this.__y = value
                this.__parent.__change()
            }
    });

    Object.defineProperty(attributeVector.prototype, '__z', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVector.prototype, 'z', {
        enumerable: true,
        get:
            function () { return this.__z },
        set:
            function (value) {
                this.__z = value
                this.__parent.__change()
            }
    });
    
    // attributeVectorPos for pos attribute ------------------------------------------------------

    Object.defineProperty(attributeVectorPos.prototype, '__x', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorPos.prototype, 'x', {
        enumerable: true,
        get:
            function () { return this.__x },
        set:
            function (value) {
                this.__x = value
                this.__parent.__change()
            	this.__parent._pos_set = true // needed by attach_trail updating
            	if (this.__parent.__make_trail) this.__parent.__update_trail(vec(this.__x, this.__y, this.__z))
            }
    });

    Object.defineProperty(attributeVectorPos.prototype, '__y', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorPos.prototype, 'y', {
        enumerable: true,
        get:
            function () { return this.__y },
        set:
            function (value) {
            	this.__y = value
                this.__parent.__change()
            	this.__parent._pos_set = true // needed by attach_trail updating
            	if (this.__parent.__make_trail) this.__parent.__update_trail(vec(this.__x, this.__y, this.__z))
            }
    });

    Object.defineProperty(attributeVectorPos.prototype, '__z', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorPos.prototype, 'z', {
        enumerable: true,
        get:
            function () { return this.__z },
        set:
            function (value) {
        		this.__z = value
                this.__parent.__change()
            	this.__parent._pos_set = true // needed by attach_trail updating
            	if (this.__parent.__make_trail) this.__parent.__update_trail(vec(this.__x, this.__y, this.__z))
            }
    });
    
    // attributeVectorAxis for axis attribute ------------------------------------------------------

    Object.defineProperty(attributeVectorAxis.prototype, '__x', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorAxis.prototype, 'x', {
        enumerable: true,
        get:
            function () { return this.__x },
        set:
            function (value) {
    			var oldaxis = norm(this.__parent.__axis)
                this.__x = value
				if (this.__parent.__sizing) this.__parent.__size.x = this.mag
				adjust_up(this.__parent, oldaxis, this)
            }
    });

    Object.defineProperty(attributeVectorAxis.prototype, '__y', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorAxis.prototype, 'y', {
        enumerable: true,
        get:
            function () { return this.__y },
        set:
            function (value) {
				var oldaxis = norm(this.__parent.__axis)
	            this.__y = value
				if (this.__parent.__sizing) this.__parent.__size.x = this.mag
	            adjust_up(this.__parent, oldaxis, this)
            }
    });

    Object.defineProperty(attributeVectorAxis.prototype, '__z', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorAxis.prototype, 'z', {
        enumerable: true,
        get:
            function () { return this.__z },
        set:
            function (value) {
				var oldaxis = norm(this.__parent.__axis)
	            this.__z = value
				if (this.__parent.__sizing) this.__parent.__size.x = this.mag
	            adjust_up(this.__parent, oldaxis, this)
            }
    });
    
    // attributeVectorSize for VPython size attribute --------------------------------------------------------

    Object.defineProperty(attributeVectorSize.prototype, '__x', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorSize.prototype, 'x', {
        enumerable: true,
        get:
            function () { return this.__x },
        set:
            function (value) {
                this.__x = value
                // Be careful not to alter the attributeVectorAxis character of this.__parent.__axis
                if (this.__parent.__sizing) {
                    var pa = this.__parent.__axis
                    if (pa.x === 0 && pa.y === 0 && pa.z === 0) {
                        if (this.__parent.__oldaxis !== undefined) {
                            pa = this.__parent.__oldaxis
                            this.__parent.__oldaxis = undefined
                        } else {
                            pa = vec(1,0,0)
                        }
                    }
                    var v = pa.norm().multiply(value)
	            	this.__parent.__axis.__x = v.x
	            	this.__parent.__axis.__y = v.y
                    this.__parent.__axis.__z = v.z
                }
                this.__parent.__change()
            }
    });

    Object.defineProperty(attributeVectorSize.prototype, '__y', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorSize.prototype, 'y', {
        enumerable: true,
        get:
            function () { return this.__y },
        set:
            function (value) {
                this.__y = value
                this.__parent.__change()
            }
    });

    Object.defineProperty(attributeVectorSize.prototype, '__z', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorSize.prototype, 'z', {
        enumerable: true,
        get:
            function () { return this.__z },
        set:
            function (value) {
                this.__z = value
                this.__parent.__change()
            }
    });
    
    // attributeVectorUp for up attribute ------------------------------------------------------

    Object.defineProperty(attributeVectorUp.prototype, '__x', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorUp.prototype, 'x', {
        enumerable: true,
        get:
            function () { return this.__x },
        set:
            function (value) {
				var oldup = norm(this.__parent.__up)
	            this.__x = value
	            adjust_axis(parent, oldup, this)
            }
    });

    Object.defineProperty(attributeVectorUp.prototype, '__y', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorUp.prototype, 'y', {
        enumerable: true,
        get:
            function () { return this.__y },
        set:
            function (value) {
			var oldup = norm(this.__parent.__up)
            this.__y = value
            adjust_axis(parent, oldup, this)
            }
    });

    Object.defineProperty(attributeVectorUp.prototype, '__z', { enumerable: false, writable: true, value: 0 })
    Object.defineProperty(attributeVectorUp.prototype, 'z', {
        enumerable: true,
        get:
            function () { return this.__z },
        set:
            function (value) {
				var oldup = norm(this.__parent.__up)
	            this.__z = value
	            adjust_axis(parent, oldup, this)
            }
    });
    
    // General vec properties

    vec.prototype.toString = function () {
        // Mimics the vector display of VPython
        var input = [this.x, this.y, this.z]
        var output = []
        for (var i = 0; i < 3; i++) {
        	output.push(__convert(input[i]))
        }
        return "< " + output[0] + ", " + output[1] + ", " + output[2] + " >"
    }

    // --------------------------------------------------------------------
    
    // Measurements show that including a scalar-vector test makes a
    // negligible difference in the speed of these vector operations.
    // The check costs about 0.3 ns, the operation takes about 18 ns.
    
    vec.prototype.add = function (v) {
        return new vec(this.x + v.x, this.y + v.y, this.z + v.z)
    }

    vec.prototype.sub = function (v) {
        return new vec(this.x - v.x, this.y - v.y, this.z - v.z)
    }

    vec.prototype.multiply = function (r) {
        return new vec(this.x * r, this.y * r, this.z * r)
    }

    vec.prototype.divide = function (r) {
        return new vec(this.x / r, this.y / r, this.z / r)
    }
    
    // ----------------------------------------------------------------------

    property.declare( vec.prototype, {
        mag: {
        	get: function () { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) },
        	set: function (value) { 
        		var v = this.norm().multiply(value)
        		this.x = v.x
        		this.y = v.y
        		this.z = v.z
        	}
        },
        mag2: {
        	get: function () { return this.x * this.x + this.y * this.y + this.z * this.z },
        	set: function (value) {
        		var v = this.norm().multiply(Math.sqrt(value))
        		this.x = v.x
        		this.y = v.y
        		this.z = v.z
        	}
        },
        hat: {
        	get: function () { return this.norm() },
        	set: function (value) {
        		var v = value.hat.multiply(this.mag)
        		this.x = v.x
        		this.y = v.y
        		this.z = v.z
        	}
        }
    })

    vec.prototype.norm = function () {
        var r = this.mag
        if (r == 0) return new vec(0, 0, 0)
        return new vec(this.x / r, this.y / r, this.z / r)
    }

    vec.prototype.dot = function (v) {
        return this.x * v.x + this.y * v.y + this.z * v.z
    }

    vec.prototype.equals = function (v) {
    	if (v === null) return false
        return (this.x === v.x && this.y === v.y && this.z === v.z)
    }

    vec.prototype.proj = function (v) {
        var B = norm(v)
        return B.multiply(this.dot(B))
    }

    vec.prototype.comp = function (v) {
        return this.dot(norm(v))
    }

    vec.prototype.cross = function (v) {
        return new vec(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x)
    }

    vec.prototype.diff_angle = function (v) {
    	var a = this.norm().dot(v.norm())
    	if (a > 1) return 0 // guard against acos returning NaN
    	if (a < -1) return Math.PI
        return Math.acos(a)
    }

    vec.prototype.rotate = function (args) {
    	var angle, axis
        // canonical form v.rotate({angle:a, axis:ax}), but can also be
        // such forms as v.rotate(a, ax) or v.rotate(ax, {origin:or}), etc.
        var L = arguments.length
        if (L < 1 || L > 2) throw new Error('vector.rotate takes 1 or 2 arguments')
        for (var i=0; i<L; i++) {
            var arg = arguments[i]
            if (toType(arg) == 'object' && !(arg instanceof vec)) {
                if (arg.angle !== undefined) angle = arg.angle
                if (arg.axis !== undefined) axis = arg.axis
            } else {
                if (i === 0) angle = arg
                else if (i == 1) axis = arg
            }
        }
    	if (angle === undefined) throw new Error("To rotate a vector you must specify an angle.")
        if (angle === 0) return new vec(this.x, this.y, this.z)
        if (axis === undefined) axis = new vec(0, 0, 1)
        var axis = axis.norm()
        var parallel = axis.multiply(axis.dot(this)) // projection along axis
        var perp = axis.cross(this)
        var pmag = perp.mag // length of 'this' projected onto plane perpendicular to axis
        if (pmag === 0) return new vec(this.x, this.y, this.z)
        perp = perp.norm()
        var y = perp.cross(axis) // y, perp, axis is an orthogonal coordinate system
        var rotated = y.multiply(pmag * Math.cos(angle)).add(perp.multiply(pmag * Math.sin(angle)))
        return parallel.add(rotated)
    }

    vec.random = function () {
        return new vec(-1 + 2 * Math.random(), -1 + 2 * Math.random(), -1 + 2 * Math.random())
    }
    
    var exports = { vec: vec, 
    		        attributeVector: attributeVector,
    		        attributeVectorPos: attributeVectorPos,
    		        attributeVectorAxis: attributeVectorAxis, 
    		        attributeVectorSize: attributeVectorSize, 
    		        attributeVectorUp: attributeVectorUp }
    Export(exports)
})()

; (function vectorLibraryWrappers() {
    "use strict";

    function mag(A) {
        return A.mag;
    }
    function mag2(A) {
        return A.mag2;
    }
    function norm(A) {
        return A.norm();
    }
    function hat(A) {
        return A.hat;
    }
    function dot(A,B) {
        return A.dot(B);
    }
    function cross(A,B) {
        return A.cross(B);
    }
    function proj(A,B) {
        return A.proj(B);
    }
    function comp(A,B) {
        return A.comp(B);
    }
    function diff_angle(A,B) {
        return A.diff_angle(B);
    }
    function rotate(args) {
        // Angus Croll:
        // http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
        // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
        // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"

        var toType = function(obj) { 
            return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
        }

        var v, angle, axis
        // canonical form rotate(v, {angle:a, axis:ax}), but can also be
        // such forms as rotate(v, a, ax) or rotate(v, ax, {origin:or}), etc.
        var L = arguments.length
        if (L < 1 || L > 3) throw new Error('rotate(vector, ...) takes 1 to 3 arguments')
        v = arguments[0]
        for (var i=1; i<L; i++) {
            var arg = arguments[i]
            if (toType(arg) == 'object' && !(arg instanceof vec)) {
                if (arg.angle !== undefined) angle = arg.angle
                if (arg.axis !== undefined) axis = arg.axis
            } else {
                if (i == 1) angle = arg
                else if (i == 2) axis = arg
            }
        }
    	if (axis === undefined) axis = new vec(0,0,1)
        return v.rotate({angle:angle, axis:axis})
    }
    var exports = {
        mag: mag,
        mag2: mag2,
        norm: norm,
        hat: hat,
        dot: dot,
        cross: cross,
        proj: proj,
        comp: comp,
        diff_angle: diff_angle,
        rotate: rotate
    }
    Export(exports)
})();
