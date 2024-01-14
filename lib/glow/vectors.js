;(function () {
    "use strict";
    
    // vector operator overloading is handled in file papercomp.js, extracted by Salvatore di Dio
    // from the PaperScript project of Jurg Lehni: http://scratchdisk.com/posts/operator-overloading.

    // Angus Croll:
	// http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
    // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
    // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"

    let toType = function(obj) { 
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
    	let angle = oldaxis.diff_angle(newaxis)
    	if (angle > 1e-6) { // smaller angles lead to catastrophes
    		let rotaxis, newup
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
        if (typeof group !== 'undefined' && parent instanceof group) {
            parent.axis_changed(oldaxis, newaxis)
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
		let angle = oldup.diff_angle(newup)
    	if (angle > 1e-6) { // smaller angles lead to catastrophes
    		let rotaxis, newaxis
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
            // Mentioning arguments in a function slows the function down.
            // In the case of Microsoft Edge (Dec. 2015), vec was 10 times slower if arguments mentioned!!
            if (y === undefined && z === undefined) {
                // vec(vec) makes a copy of the vec
                if (!(x instanceof vec)) throw new Error("vector(non-vector) is an error.")
                return new vec(x.x, x.y, x.z)
            }
            if (typeof x != 'number') throw new Error("In a vector, x must be a number")
            if (typeof y != 'number') throw new Error("In a vector, y must be a number")
            if (typeof z != 'number') throw new Error("In a vector, z must be a number")
            return new vec(x, y, z)
        }
        
        if (x === undefined || y === undefined || z === undefined) throw new Error("vector() requires 3 arguments: x, y, and z.")
        if (typeof x != 'number') throw new Error("In a vector, x must be a number")
        if (typeof y != 'number') throw new Error("In a vector, y must be a number")
        if (typeof z != 'number') throw new Error("In a vector, z must be a number")
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
                let pa = parent.__axis
                if (pa.x === 0 && pa.y === 0 && pa.z === 0) {
                    if (parent.__oldaxis !== undefined) {
                        pa = parent.__oldaxis
                        parent.__oldaxis = undefined
                    } else {
                        pa = vec(1,0,0)
                    }
                }
                let v = pa.norm().multiply(x)
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
    	let oldup
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
    			let oldaxis = norm(this.__parent.__axis)
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
				let oldaxis = norm(this.__parent.__axis)
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
				let oldaxis = norm(this.__parent.__axis)
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
                    let pa = this.__parent.__axis
                    if (pa.x === 0 && pa.y === 0 && pa.z === 0) {
                        if (this.__parent.__oldaxis !== undefined) {
                            pa = this.__parent.__oldaxis
                            this.__parent.__oldaxis = undefined
                        } else {
                            pa = vec(1,0,0)
                        }
                    }
                    let v = pa.norm().multiply(value)
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
				let oldup = norm(this.__parent.__up)
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
			let oldup = norm(this.__parent.__up)
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
        let input = [this.x, this.y, this.z]
        let output = []
        for (let i = 0; i < 3; i++) {
        	output.push(__convert(input[i]))
        }
        return "< " + output[0] + ", " + output[1] + ", " + output[2] + " >"
    }

    // --------------------------------------------------------------------
    
    // Measurements show that including a scalar-vector test makes a
    // negligible difference in the speed of these vector operations.
    // The check costs about 0.3 ns, the operation takes about 18 ns.
    
    vec.prototype.add = function (v) {
    	if (!(v instanceof vec)) add_error()
        return new vec(this.x + v.x, this.y + v.y, this.z + v.z)
    }

    vec.prototype.sub = function (v) {
    	if (!(v instanceof vec)) sub_error()
        return new vec(this.x - v.x, this.y - v.y, this.z - v.z)
    }

    vec.prototype.multiply = function (r) {
    	if (r instanceof vec) multiply_error()
    	if (r === undefined || Number.isNaN(r)) badnumber(r)
        return new vec(this.x * r, this.y * r, this.z * r)
    }

    vec.prototype.divide = function (r) {
    	if (r instanceof vec) divide_error()
    	if (r === undefined || Number.isNaN(r)) badnumber(r)
        return new vec(this.x / r, this.y / r, this.z / r)
    }
    
    // ----------------------------------------------------------------------

    property.declare( vec.prototype, {
        mag: {
        	get: function () { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) },
        	set: function (value) { 
        		let v = this.norm().multiply(value)
        		this.x = v.x
        		this.y = v.y
        		this.z = v.z
        	}
        },
        mag2: {
        	get: function () { return this.x * this.x + this.y * this.y + this.z * this.z },
        	set: function (value) {
        		let v = this.norm().multiply(Math.sqrt(value))
        		this.x = v.x
        		this.y = v.y
        		this.z = v.z
        	}
        },
        hat: {
        	get: function () { return this.norm() },
        	set: function (value) {
        		let v = value.hat.multiply(this.mag)
        		this.x = v.x
        		this.y = v.y
        		this.z = v.z
        	}
        }
        
        /*
        list: {
        		get: function() { return [this.x, this.y, this.z] },
        		set: function(value) {
        			if (this.__parent !== undefined) {
        				;
        			} else {
        				this.x = value[0]
        				this.y = value[1]
        				this.z = value[2]
        			}
        		}
        }
        */
    })

    vec.prototype.norm = function () {
        let r = this.mag
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
        let B = norm(v)
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
    	let angle, axis
        // canonical form v.rotate({angle:a, axis:ax}), but can also be
        // such forms as v.rotate(a, ax) or v.rotate(ax, {origin:or}), etc.
        let L = arguments.length
        if (L < 1 || L > 2) throw new Error('vector.rotate takes 1 or 2 arguments')
        for (let i=0; i<L; i++) {
            let arg = arguments[i]
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
        axis = axis.norm()
        let parallel = axis.multiply(axis.dot(this)) // projection along axis
        let perp = axis.cross(this)
        let pmag = perp.mag // length of 'this' projected onto plane perpendicular to axis
        if (pmag === 0) return new vec(this.x, this.y, this.z)
        perp = perp.norm()
        let y = perp.cross(axis) // y, perp, axis is an orthogonal coordinate system
        let rotated = y.multiply(pmag * Math.cos(angle)).add(perp.multiply(pmag * Math.sin(angle)))
        return parallel.add(rotated)
    }

    vec.random = function () {
        return new vec(-1 + 2 * Math.random(), -1 + 2 * Math.random(), -1 + 2 * Math.random())
    }
    
    // Sept. 2017 testing: x = A+B where A and B are vectors takes about 18 nanoseconds, with or without a test.
    //    If A and B are scalars, this is about 11 ns without a vector test; about 16 ns with a test.
    //    Note that A*B must make a vector test to distinguish between scalar*vec and scalar*scalar.
    //    The validity test itself costs only a fraction of a nanosecond, but there is some kind of
    //    optimization by the JavaScript compiler that means that adding one test to the Number functions 
    //    adds about 5 ns, which doesn't happen with vec operations. It doesn't seem to matter whether
    //    the test is "r instanceof vec" or "r.x !== undefined". The 5 ns penalty comes from having a test.
    //    All of this was with Chrome. Surprisingly, Firefox does scalar+scalar in only 2.3 ns, with
    //    or without the validity check (but vector+vector is 20 ns, with or without check).
    //    Edge takes about 30 ns for scalar or vector addition, with or without validity check.

    function add_error()            { throw new Error("Cannot add a scalar and a vector.") }
    function sub_error()            { throw new Error("Cannot subtract a scalar and a vector.") }
    function multiply_error()       { throw new Error("Cannot multiply a vector by a vector.") }
    function divide_error()         { throw new Error("Cannot divide by a vector.") }
    function power_error()          { throw new Error("Cannot raise a vector to a power.") }
    function num_power_error()      { throw new Error("Cannot raise a number to a power that is a vector.") }
    function greater_error()        { throw new Error("Cannot use > with vectors.") }
    function less_error()           { throw new Error("Cannot use < with vectors.") }
    function greaterorequal_error() { throw new Error("Cannot use >= with vectors.") }
    function lessorequal_error()    { throw new Error("Cannot use <= with vectors.") }
//  Could not make === and !== work in RapydScript environment, which does its own equality tests
//    function equal_error()          { throw new Error("Cannot use == with a scalar and a vector.") }
//    function notequal_error()       { throw new Error("Cannot use != with a scalar and a vector.") }
    function badnumber(r) {
    	if (r === undefined) throw new Error("A variable is undefined.")
    	else throw new Error("A variable is 'NaN', not a number.")
    }
    
    // A test was performed of generating e.g. A.add(B) instead of A['+'](B) and the speed was the same.
    //    Also, if A was a literal, A*B failed in the Streamline processing.
    // Dec. 2015 testing: operations involving vectors cost about 1.3 microseconds,
    //    operations involving only scalars (Numbers) cost about 0.02 microseconds (20 nanoseconds)
    // In GScompiler.js are similar prototypes written into the compiled user program
    // See compiling/papercomp.js for what drives these functions
    String.prototype['+']  = function (r) { return this + r }
    String.prototype['+='] = function (r) { return this + r }
    String.prototype['*']  = function(r) { // string * number
	  	if (typeof r == 'number') return this.repeat(r)
	  		throw new Error("Cannot multiply a string by something that is not a number.")
    }

// Failed attempt to handle number*string and number*array; makes all computations too slow to be affordable.
// string*number and array*number are activated in GScompiler and don't cause speed problems.
//    function num_times_array(n, a) {
//    	if (typeof a == 'number') return n * a
//      if (typeof r == 'string') return a.repeat(n)
//		if (Array.isArray(a)) { // number * array
//			let na = a.length
//			let ret = []
//			for (let i=0; i<n; i++) {
//				for (let j=0; j<na; j++) ret.push(a[j])
//			}
//			return ret
//		}
//		throw new Error("Cannot multiply a number times an object.")
//    }   
  
  Number.prototype['+']  = function (r) {return (r instanceof vec) ? add_error() : this + r}
  Number.prototype['-']  = function (r) {return (r instanceof vec) ? sub_error() : this - r}
  Number.prototype['*']  = function (r) {return (r instanceof vec) ? r.multiply(this) : this * r }
  Number.prototype['/']  = function (r) {return (r instanceof vec) ? divide_error() : this / r}
  Number.prototype['**']  = function (r) {return (r instanceof vec) ? num_power_error() : this ** r}
  Number.prototype['>']  = function (r) {return (r instanceof vec) ? greater_error() : this > r}
  Number.prototype['<']  = function (r) {return (r instanceof vec) ? less_error() : this < r}
  Number.prototype['>='] = function (r) {return (r instanceof vec) ? greaterorequal_error() : this >= r}
  Number.prototype['<='] = function (r) {return (r instanceof vec) ? lessorequal_error() : this <= r}
  Number.prototype['%']  = function (r) {return this % r }
  Number.prototype['-u'] = function () {return -this }
  // Could not make === and !== work in RapydScript environment, which does its own equality tests
  //Number.prototype['eq'] = function(r) {return (r instanceof vec) ? equal_error() : this === r}
  //Number.prototype['ne'] = function(r) {return (r instanceof vec) ? notequal_error() : this !== r}
  
  vec.prototype['+'] =  vec.prototype.add
  vec.prototype['-'] =  vec.prototype.sub
  vec.prototype['*'] =  vec.prototype.multiply
  vec.prototype['/'] =  function (r) { return this.divide(r) }
  vec.prototype['**'] = function(r) {power_error()}
  vec.prototype["-u"] = function () { return new vec(-this.x, -this.y, -this.z) }
  vec.prototype['>']  = function(r) {greater_error() }
  vec.prototype['<']  = function(r) {less_error() }
  vec.prototype['>='] = function(r) {greaterorequal_error() }
  vec.prototype['<='] = function(r) {lessorequal_error() }
  // Could not make === and !== work in RapydScript environment, which does its own equality tests
  //vec.prototype['eq'] = function(r) {return (r instanceof vec) ?  this.equals(r) : equal_error()}
  //vec.prototype['ne'] = function(r) {return (r instanceof vec) ? !this.equals(r) : notequal_error()}

  var exports = { vec: vec, 
                    vector: vec,
    		        attributeVector: attributeVector,
    		        attributeVectorPos: attributeVectorPos,
    		        attributeVectorAxis: attributeVectorAxis, 
    		        attributeVectorSize: attributeVectorSize, 
    		        attributeVectorUp: attributeVectorUp }
    Export(exports)
})()

; (function vectorLibraryWrappers() {
    "use strict";
    
    function __array_times_number(a, r) { // array * number, used by VPython programs
    	if (typeof r === 'number') {
    		let n = r
    		let na = a.length
    		let ret = []
    		for (let i=0; i<n; i++) {
    			for (let j=0; j<na; j++) ret.push(a[j])
    		}
    		return ret
    	}
    	throw new Error("Cannot multiply a list by something that is not a number.")
    }

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

        let toType = function(obj) { 
            return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
        }

        let v, angle, axis
        // canonical form rotate(v, {angle:a, axis:ax}), but can also be
        // such forms as rotate(v, a, ax) or rotate(v, ax, {origin:or}), etc.
        let L = arguments.length
        if (L < 1 || L > 3) throw new Error('rotate(vector, ...) takes 1 to 3 arguments')
        v = arguments[0]
        for (let i=1; i<L; i++) {
            let arg = arguments[i]
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

    function log10(x) {
        const logten = Math.log(10)
        return log(x)/logten
    }

    // Because RapydScript-NG compiles to the JavaScript string.replace function, which
    //   replaces just one instance rather than multiple instances as in standard Python,
    //   here we implement string.GSrep that acts like standard Python and we replace
    //   all VPython instances of ".replace" (in user code) with ".__GSrep".
    String.prototype.__GSrep = function(t, r, n) {
        if (n === undefined) n = 1000000
        let s = this
        if (t === r) return s
        let tlong = t.length
        let i = 0
        while (true) {
            if (i >= n) return s
            i++
            let loc = s.search(t)
            if (loc < 0) return s
            s = s.slice(0,loc) + r + s.slice(loc+tlong)
        }
    }

    var exports = {
        log10: log10,
        mag: mag,
        mag2: mag2,
        norm: norm,
        hat: hat,
        dot: dot,
        cross: cross,
        proj: proj,
        comp: comp,
        diff_angle: diff_angle,
        rotate: rotate,
        __array_times_number: __array_times_number
    }
    Export(exports)
})();