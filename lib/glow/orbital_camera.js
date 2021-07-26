; (function () {
	"use strict";
	
	// Angus Croll:
	// http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
    // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
    // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"

    var toType = function(obj) { 
        return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
	}

    function orbital_camera(canvas) {
		if (!(this instanceof orbital_camera)) return new orbital_camera(canvas)

        this.canvas = canvas
        this.follower = null
    }

    property.declare(orbital_camera.prototype, {
		// The primary data are scene.center, scene.axis (synonym for scene.forward), and scene.up.
		// This orbital_camera machinery provides a convenient alternative mechanism for getting
		//    and setting the primary data.
        pos: {
        	get: function() {
	            var c = this.canvas
	            return c.__center.sub( c.__axis.norm().multiply( c.range / Math.tan(c.fov/2) ) )
            },
            set: function(val) {
            	var c = this.canvas
				c.__autoscale = false // no autoscaling if camera.pos set explicitly
            	c.center = val.add(this.axis)
            }
        },
        axis: {
        	get: function() {
            	var c = this.canvas
	            return c.__axis.norm().multiply( c.range / Math.tan(c.fov/2) )
            },
            set: function(val) {
            	var c = this.canvas
				c.__autoscale = false // no autoscaling if camera.axis set explicitly
            	c.center = this.pos.add(val)
            	c.axis = norm(val)
            	c.range = mag(val)*Math.tan(c.fov/2)
            }
        },
        rotate: function (rargs) {
			// canonical form rotate({angle:a, axis:ax, origin:or}), but can also be
			// such forms as rotate(a, ax, or) or rotate(a, ax, {origin:or}), etc.
			var L = arguments.length
			if (L < 1 || L > 3) throw new Error('camera.rotate takes 1 to 3 arguments')
			var args = {}
			for (var i=0; i<L; i++) {
				var arg = arguments[i]
				if (toType(arg) == 'object' && !(arg instanceof vec)) {
					if (arg.angle !== undefined) args.angle = arg.angle
					if (arg.axis !== undefined) args.axis = arg.axis
					if (arg.origin !== undefined) args.origin = arg.origin
				} else {
					if (i === 0) args.angle = arg
					else if (i == 1) args.axis = arg
					else if (i == 2) args.origin = arg
				}
			}
			var origin = this.pos
            if (args.origin !== undefined) origin = args.origin
            if (args.angle === undefined) { throw new Error("camera.rotate() requires an angle.") }
            var angle = args.angle
            if (angle === 0) return
            var rotaxis = args.axis
			var c = this.canvas
			if (args.axis === undefined) rotaxis = c.__axis
			if (!origin.equals(this.pos)) origin = origin.add(this.pos.sub(origin).rotate({angle:angle, axis:rotaxis}))

			window.__adjustupaxis = false // needed if axis and up are attributeVectorAxis and attributeVectorUp
            if (diff_angle(c.__axis,rotaxis) > 1e-6)
            	// change axis, which will also change up
				c.axis = c.__axis.rotate({angle:angle, axis:rotaxis})
			c.up = c.__up.rotate({angle:angle, axis:rotaxis})
			c.center = origin.add(this.axis)
			window.__adjustupaxis = true
        },
        follow: function(objectOrFunction) { this.follower = objectOrFunction },

        __activate: function () {
            var cvs = this.canvas
            var camera = this

            var contextMenuDisabled = false
            var lastX=[null,null], lastY=[null,null] // corresponding to two fingers
            var downX=[null,null], downY=[null,null] // initial mouse locations
            var lastpos = null
            var angleX = 0, angleY = 0
            var afterdown = false
            var rotating, zrotating, zooming, panning // zrotating is subset of zooming (both involve two fingers)
            var leftButton=false, rightButton=false, mouseWheel=false
            
            // The following variables have mainly to do with touch inputs
			var lastSep = null // previous separation of two fingers
            var lastAngle = null  // 0 to 2*pi angle of line from first finger to second figure (rotate about z)
			var fingers = 0    // number of fingers down
			var nomove = false // true if removing fingers from zooming
			var tstart         // time of touchstart
			var zoompos=[null,null] // locations of two fingers when 2nd finger makes contact
			var saveEvent      // touchstart event

            var zoom = function (delta) {
                var z = Math.exp(-delta * .05)
                cvs.range = cvs.range * z
            }
            
            var zrotate = function(dtheta) {
            	cvs.up = cvs.up.rotate({angle:2*dtheta, axis:cvs.__axis})
            }
            
            var spin = function(ev) {
                var dx = ev.pageX - lastX[0]
				var dy = ev.pageY - lastY[0]
                angleX += dx * .01
                angleY += dy * .01
                if (angleY < -1.4) angleY = -1.4
                if (angleY > 1.4) angleY = 1.4
                //var distance = cvs.range / Math.tan(cvs.fov / 2)
                cvs.__axis = cvs.__axis.rotate({angle:-.01 * dx, axis:cvs.__up})
                var max_vertical_angle = cvs.__up.diff_angle(cvs.__axis.multiply(-1))
                var vertical_angle = .01 * dy
                if (!(vertical_angle >= max_vertical_angle || vertical_angle <= (max_vertical_angle - Math.PI))) {
                    // Over the top (or under the bottom) rotation
                    cvs.__axis = cvs.__axis.rotate({angle:-vertical_angle, axis:cvs.__axis.cross(cvs.__up)})
                }
            }
            
            var pan = function(ev) {
            	var csave = vec(cvs.__last_center)
            	cvs.mouse.__update(ev)
            	//var c = cvs.mouse.project({normal:cvs.__axis})
            	var c = cvs.mouse.pos
            	var xaxis = cvs.__axis.cross(cvs.__up).hat
            	var yaxis = xaxis.cross(cvs.__axis).hat
            	var d = c.sub(lastpos)
            	var dx = d.dot(xaxis)
            	var dy = d.dot(yaxis)
            	lastpos = c.sub(d)
            	cvs.__center = cvs.__center.sub(xaxis.multiply(dx).add(yaxis.multiply(dy)))
                cvs.__last_center = csave
            }

            $(document).bind("contextmenu", function (e) {
                return !contextMenuDisabled
            })
            cvs.elements.mousewheel(function (ev, delta) { // ev.which is 0 during mousewheel move
                if (cvs.userzoom) zoom(delta)
                return false
            })
            
            cvs.elements.mousedown(function (ev) {
                // This basic mousedown event happens before the user program's mousedown event
                // ev.which is 1 for left button, 2 for mousewheel, 3 for right button
                if (ev.which == 1) leftButton = true
                if (ev.which == 3) rightButton = true
                rotating = cvs.userspin && (ev.which == 3 || (ev.which == 1 &&
					cvs.mouse.ctrl && !cvs.mouse.alt))
                zooming = cvs.userzoom && (ev.which == 2 || (ev.which == 1 &&
					cvs.mouse.alt && !cvs.mouse.ctrl) || (leftButton && rightButton))
                panning = cvs.userpan && (ev.which == 1) && cvs.mouse.shift
                if (ev.which == 3 && !(rotating || zooming)) return
                downX[0] = lastX[0] = ev.pageX
                downY[0] = lastY[0] = ev.pageY
                if (rotating || zooming || panning) contextMenuDisabled = true
                else if (ev.which == 1) cvs.trigger("mouse", ev)
                if (panning) {
                	cvs.autoscale = false
                	cvs.mouse.__update(ev)
                	lastpos = cvs.mouse.pos
                	//lastpos = cvs.mouse.project({normal:cvs.__forward})
                }
                afterdown = true
	            ev.preventDefault()
	            ev.stopPropagation()
	            return false // makes jquery handlers execute preventDefault and stopPropagation
            })
            
            // Ideally we should bind and unbind this as rotating and zooming change
            cvs.elements.mousemove(function (ev) {
            	if (ev.pageX === lastX[0] && ev.pageY === lastY[0]) return
            	if (!afterdown) { // eliminate mousemove events due to touchmove generating a mousemove
            		cvs.mouse.__update(ev) // update scene.mouse.pos, scene.mouse.ray
            		return
            	}
                if (zooming) {
                    var dy = lastY[0] - ev.pageY
                    if (dy !== 0) zoom(0.1 * dy)
                } else if (rotating) {
                	spin(ev)
                } else if (panning) {
                	pan(ev)
                } else if (ev.which == 1) {
					cvs.__mouse_move = ev // only process mousemove events every render time
				}
                if (!panning) {
	                lastX[0] = ev.pageX
					lastY[0] = ev.pageY
                }
            })
            
            cvs.elements.mouseup(function (ev) {
                if (ev.which == 1) leftButton = false
                if (ev.which == 3) rightButton = false
            	if (!afterdown) return
                if (ev.which == 3 && contextMenuDisabled)
                    setTimeout(function () { contextMenuDisabled = false }, 0)
                if (!(rotating || zooming || panning)) {
                	if (ev.which == 1) {
	                	cvs.trigger("mouse", ev) // the up event
	                	if (abs(ev.pageX - downX[0]) <= 5 && abs(ev.pageY - downY[0]) <= 5) {
	                		ev.type = "click"
	                		cvs.trigger("mouse", ev) // add a click event
	                	}
                	} else if (ev.which == 3) {
                		contextMenuDisabled = true
                		return
                	}
                }
                rotating = zooming = panning = afterdown = false
            	lastX = [null,null]
            	lastY = [null,null]
            })
			
			cvs.elements.bind('touchstart', function (ev) {
			  rotating = zooming = nomove = false
			  lastSep = lastAngle = null
			  var pt
			  var data = ev.originalEvent.targetTouches
			  if (data.length > 2) return
			  if (data.length == 2 && !(cvs.userspin || cvs.userzoom)) return
			  fingers++
			  for (var i=0; i<data.length; i++) {
			  	  pt = data[i]
			      downX[i] = lastX[i] = pt.clientX
			      downY[i] = lastY[i] = pt.clientY
			      zoompos[i] = vec(downX[i], downY[i], 0)
			  }
			  lastSep = null
			  saveEvent = {type:"mousedown", pageX:downX[0], pageY:downY[0], which:1}
			  if (!(cvs.userspin || cvs.userzoom)) { // no need to delay decision about this event
				cvs.trigger("mouse", saveEvent)
			  	  saveEvent = null
			  }
			  // Delay passing touchstart info until we've checked whether rotating or not
			  tstart = msclock()
              ev.preventDefault()
              ev.stopPropagation()
              return false // makes jquery handlers execute preventDefault and stopPropagation
			})
			
			cvs.elements.bind('touchmove', function (ev) {
	          if (nomove) {
				cvs.mouse.__update(ev) // update scene.mouse.pos, scene.mouse.ray
	        	  return
	          }
			  var t = msclock() - tstart
			  var data = ev.originalEvent.targetTouches
			  if (data.length > 2) return
			  var pt
			  var newx=[null,null], newy=[null,null]
			  var relx=[0,0], rely=[0,0]       // relative to downX, downY of touchstart
			  for (var i=0; i<data.length; i++) {
				  pt = data[i]
				  newx[i] = pt.clientX
				  newy[i] = pt.clientY
				  relx[i] = newx[i] - downX[i]
				  rely[i] = newy[i] - downY[i]
			  }
			  if (data.length == 2) { // two-finger gesture
			    if (!(cvs.userspin || cvs.userzoom)) return
			  	var dzoom = [null,null]
			  	if (!zooming) {
			  		zrotating = false
			  		for (var i=0; i<2; i++) dzoom[i] = vec(newx[i],newy[i],0).sub(zoompos[i])
			  		if (dzoom[0].mag > 15 || dzoom[1].mag > 15) { // can make a decision
			  			saveEvent = null
			  			zooming = true
			  			//if (dzoom[0].mag <= 4 || dzoom[1].mag <= 4) zrotating = true
			  			var r = zoompos[1].sub(zoompos[0]).norm() // unit vector from one finger to the other
			  			var angmom = r.cross(dzoom[1]).sub(r.cross(dzoom[0])).mag
			  			if (angmom > 10) {
			  				zrotating = cvs.userspin // rotating about perpendicular to screen, not zooming
			  				if (!cvs.userspin) zooming = false
			  			}
			  		} else return
			  	}
			  }
			  if (saveEvent !== null) { // not yet emitted mousedown event
			    if (data.length == 2) { // two-finger gesture
			  		saveEvent = null
			  	} else {
			  		var near = (Math.abs(relx[0]) <= 5 && Math.abs(rely[0]) <= 5)
			  		if (!rotating && t > 150 && near) {
			  			// The following triggers a mousedown event from within a touchmove
			  			// context, with the result that the mousemove event above gets
			  			// triggered but is ignored without a preceding real mousedown event.
			  			cvs.trigger("mouse", saveEvent)
			  			saveEvent = null
			  		} else if (!near) {
			  			rotating = cvs.userspin
			  			saveEvent = null
			  		}
			  	}
			  } else {
			  	  if (newx[0] === lastX[0] && newy[0] === lastY[0] &&
			  	  	  newx[1] === lastX[1] && newy[1] === lastY[1]) return
                  ev.pageX = newx[0]
                  ev.pageY = newy[0]
                  ev.type = "mousemove"
			      if (rotating) spin(ev)
			      else if (zooming) { // zrotating is 
		        	  var xx = newx[1] - newx[0]
		              var yy = newy[1] - newy[0]
		              if (zrotating) { // if rotating about perpendicular to screen
			              var angle = Math.atan2(yy, xx)
			              if (lastAngle !== null) {
			      	  		var dangle
			              	var va = vec(Math.cos(lastAngle),Math.sin(lastAngle),0)
			              	var vb = vec(Math.cos(angle),    Math.sin(angle),    0)
			              	var vc = va.cross(vb)
			              	var amag = Math.abs(Math.asin(vc.mag))
			              	if (vc.z >= 0) dangle = -amag
			              	else dangle = amag
			              	zrotate(dangle)
			              }
			              lastAngle = angle
		              } else if (cvs.userzoom) { // zooming
		              	var sep = Math.sqrt(xx*xx + yy*yy)
		                if (lastSep !== null && sep != lastSep) zoom(0.2*(sep -lastSep))
					  	lastSep = sep
					  }
			      } else cvs.__mouse_move = ev // only process mousemove events every render time
			  }
			  lastX[0] = newx[0]
			  lastX[1] = newx[1]
			  lastY[0] = newy[0]
			  lastY[1] = newy[1]
			})
			
			cvs.elements.bind('touchend', function (ev) {
				fingers--
				if (saveEvent !== null && !(rotating || zooming)) {
					cvs.trigger("mouse", saveEvent)
					saveEvent = null
				}
				var data = ev.originalEvent.changedTouches
			    ev.pageX = data[0].clientX
			    ev.pageY = data[0].clientY
                if (!(rotating || zooming)) {
				    ev.type = "mouseup"
	                cvs.trigger("mouse", ev) // the up event
	                	if (Math.abs(ev.pageX - downX[0]) <= 5 && Math.abs(ev.pageY - downY[0]) <= 5) {
	                		ev.type = "click"
	                		cvs.trigger("mouse", ev) // add a click event
	                	}
                }
                if (zooming) {
                	if (fingers > 0) nomove = true
                	else zooming = nomove = false
                }
	            rotating = false
            	lastX = [null,null]
            	lastY = [null,null]
            	lastSep = lastAngle = null
			})
        }
    })

    var exports = {
        orbital_camera: orbital_camera
    }
    Export(exports)
})()
