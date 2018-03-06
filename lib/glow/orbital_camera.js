; (function () {
    "use strict";

    function orbital_camera(canvas, args) {
        if (!(this instanceof orbital_camera)) return new orbital_camera(canvas, args)

        this.canvas = canvas
        this.follower = null
    }

    property.declare(orbital_camera.prototype, {
        pos: {
        	get: function() {
	            var c = this.canvas
	            return c.center.sub( c.forward.norm().multiply( c.range / Math.tan(c.fov/2) ) )
            },
            set: function(val) {
            	var c = this.canvas
            	c.center = val.add(this.axis)
            }
        },
        axis: {
        	get: function() {
            	var c = this.canvas
	            return c.forward.norm().multiply( c.range / Math.tan(c.fov/2) )
            },
            set: function(val) {
            	var c = this.canvas
            	c.center = this.pos.add(val)
            	c.forward = norm(val)
            	c.range = mag(val)*Math.tan(c.fov/2)
            }
        },
        rotate: function (args) {
            if (args === undefined || args.angle === undefined) { throw new Error("object.rotate() requires an angle") }
            var angle = args.angle
            var rotaxis, origin
            if (args.axis === undefined) { rotaxis = this.axis.norm() }
            else rotaxis = args.axis.norm()
            if (args.origin === undefined) { origin = this.pos }
            else origin = args.origin
            
            this.pos = origin.add(this.pos.sub(origin).rotate({angle:angle, axis:rotaxis}))
            this.axis = this.axis.rotate({angle:angle, axis:rotaxis})
        },
        follow: function(objectOrFunction) { this.follower = objectOrFunction },

        __activate: function () {
            var canvas = this.canvas
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
                canvas.range = canvas.range * z
            }
            
            var zrotate = function(dtheta) {
            	canvas.up = canvas.up.rotate({angle:2*dtheta, axis:canvas.__forward})
            }
            
            var spin = function(ev) {
                var dx = ev.pageX - lastX[0]
				var dy = ev.pageY - lastY[0]
                angleX += dx * .01
                angleY += dy * .01
                if (angleY < -1.4) angleY = -1.4
                if (angleY > 1.4) angleY = 1.4
                //var distance = canvas.range / Math.tan(canvas.fov / 2)
                canvas.__forward = canvas.__forward.rotate({angle:-.01 * dx, axis:canvas.up})
                var max_vertical_angle = canvas.up.diff_angle(canvas.__forward.multiply(-1))
                var vertical_angle = .01 * dy
                if (!(vertical_angle >= max_vertical_angle || vertical_angle <= (max_vertical_angle - Math.PI))) {
                    // Over the top (or under the bottom) rotation
                    canvas.__forward = canvas.__forward.rotate({angle:-vertical_angle, axis:canvas.__forward.cross(canvas.__up)})
                }
            }
            
            var pan = function(ev) {
            	var csave = vec(canvas.__last_center)
            	canvas.mouse.__update(ev)
            	//var c = canvas.mouse.project({normal:canvas.__forward})
            	var c = canvas.mouse.pos
            	var xaxis = canvas.__forward.cross(canvas.__up).hat
            	var yaxis = xaxis.cross(canvas.__forward).hat
            	var d = c.sub(lastpos)
            	var dx = d.dot(xaxis)
            	var dy = d.dot(yaxis)
            	lastpos = c.sub(d)
            	canvas.__center = canvas.__center.sub(xaxis.multiply(dx).add(yaxis.multiply(dy)))
                canvas.__last_center = csave
            }

            $(document).bind("contextmenu", function (e) {
                return !contextMenuDisabled
            })
            canvas.elements.mousewheel(function (ev, delta) { // ev.which is 0 during mousewheel move
                if (canvas.userzoom) zoom(delta)
                return false
            })
            
            canvas.elements.mousedown(function (ev) {
                // This basic mousedown event happens before the user program's mousedown event
                // ev.which is 1 for left button, 2 for mousewheel, 3 for right button
                if (ev.which == 1) leftButton = true
                if (ev.which == 3) rightButton = true
                rotating = canvas.userspin && (ev.which == 3 || (ev.which == 1 &&
                			 canvas.mouse.ctrl && !canvas.mouse.alt))
                zooming = canvas.userzoom && (ev.which == 2 || (ev.which == 1 &&
                			 canvas.mouse.alt && !canvas.mouse.ctrl) || (leftButton && rightButton))
                panning = canvas.userpan && (ev.which == 1) && canvas.mouse.shift
                if (ev.which == 3 && !(rotating || zooming)) return
                downX[0] = lastX[0] = ev.pageX
                downY[0] = lastY[0] = ev.pageY
                if (rotating || zooming || panning) contextMenuDisabled = true
                else if (ev.which == 1) canvas.trigger("mouse", ev)
                if (panning) {
                	canvas.autoscale = false
                	canvas.mouse.__update(ev)
                	lastpos = canvas.mouse.pos
                	//lastpos = canvas.mouse.project({normal:canvas.__forward})
                }
                afterdown = true
	            ev.preventDefault()
	            ev.stopPropagation()
	            return false // makes jquery handlers execute preventDefault and stopPropagation
            })
            
            // Ideally we should bind and unbind this as rotating and zooming change
            canvas.elements.mousemove(function (ev) {
            	if (ev.pageX === lastX[0] && ev.pageY === lastY[0]) return
            	if (!afterdown) { // eliminate mousemove events due to touchmove generating a mousemove
            		canvas.mouse.__update(ev) // update scene.mouse.pos, scene.mouse.ray
            		return
            	}
                if (zooming) {
                    var dy = lastY[0] - ev.pageY
                    if (dy !== 0) zoom(0.1 * dy)
                } else if (rotating) {
                	spin(ev)
                } else if (panning) {
                	pan(ev)
                } else if (ev.which == 1) canvas.trigger("mouse", ev)
                if (!panning) {
	                lastX[0] = ev.pageX
					lastY[0] = ev.pageY
                }
            })
            
            canvas.elements.mouseup(function (ev) {
                if (ev.which == 1) leftButton = false
                if (ev.which == 3) rightButton = false
            	if (!afterdown) return
                if (ev.which == 3 && contextMenuDisabled)
                    setTimeout(function () { contextMenuDisabled = false }, 0)
                if (!(rotating || zooming || panning)) {
                	if (ev.which == 1) {
	                	canvas.trigger("mouse", ev) // the up event
	                	if (abs(ev.pageX - downX[0]) <= 5 && abs(ev.pageY - downY[0]) <= 5) {
	                		ev.type = "click"
	                		canvas.trigger("mouse", ev) // add a click event
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
			
			canvas.elements.bind('touchstart', function (ev) {
			  rotating = zooming = nomove = false
			  lastSep = lastAngle = null
			  var pt
			  var data = ev.originalEvent.targetTouches
			  if (data.length > 2) return
			  if (data.length == 2 && !(canvas.userspin || canvas.userzoom)) return
			  fingers++
			  for (var i=0; i<data.length; i++) {
			  	  pt = data[i]
			      downX[i] = lastX[i] = pt.clientX
			      downY[i] = lastY[i] = pt.clientY
			      zoompos[i] = vec(downX[i], downY[i], 0)
			  }
			  lastSep = null
			  saveEvent = {type:"mousedown", pageX:downX[0], pageY:downY[0], which:1}
			  if (!(canvas.userspin || canvas.userzoom)) { // no need to delay decision about this event
			  	  canvas.trigger("mouse", saveEvent)
			  	  saveEvent = null
			  }
			  // Delay passing touchstart info until we've checked whether rotating or not
			  tstart = msclock()
              ev.preventDefault()
              ev.stopPropagation()
              return false // makes jquery handlers execute preventDefault and stopPropagation
			})
			
			canvas.elements.bind('touchmove', function (ev) {
	          if (nomove) {
	              canvas.mouse.__update(ev) // update scene.mouse.pos, scene.mouse.ray
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
			    if (!(canvas.userspin || canvas.userzoom)) return
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
			  				zrotating = canvas.userspin // rotating about perpendicular to screen, not zooming
			  				if (!canvas.userspin) zooming = false
			  			}
			  		} else return
			  	}
			  }
			  if (saveEvent !== null) { // not yet emitted mousedown event
			    if (data.length == 2) { // two-finger gesture
			  		saveEvent = null
			  	} else {
			  		var near = (relx[0] <= 5 && rely[0] <= 5)
			  		if (!rotating && t > 150 && near) {
			  			// The following triggers a mousedown event from within a touchmove
			  			// context, with the result that the mousemove event above gets
			  			// triggered but is ignored without a preceding real mousedown event.
			  			canvas.trigger("mouse", saveEvent)
			  			saveEvent = null
			  		} else if (!near) {
			  			rotating = canvas.userspin
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
		              } else if (canvas.userzoom) { // zooming
		              	var sep = Math.sqrt(xx*xx + yy*yy)
		                if (lastSep !== null && sep != lastSep) zoom(0.2*(sep -lastSep))
					  	lastSep = sep
					  }
			      } else canvas.trigger("mouse", ev)
			  }
			  lastX[0] = newx[0]
			  lastX[1] = newx[1]
			  lastY[0] = newy[0]
			  lastY[1] = newy[1]
			})
			
			canvas.elements.bind('touchend', function (ev) {
				fingers--
				if (saveEvent !== null && !(rotating || zooming)) {
					canvas.trigger("mouse", saveEvent)
					saveEvent = null
				}
				var data = ev.originalEvent.changedTouches
			    ev.pageX = data[0].clientX
			    ev.pageY = data[0].clientY
                if (!(rotating || zooming)) {
				    ev.type = "mouseup"
	                canvas.trigger("mouse", ev) // the up event
	                	if (abs(ev.pageX - downX[0]) <= 5 && abs(ev.pageY - downY[0]) <= 5) {
	                		ev.type = "click"
	                		canvas.trigger("mouse", ev) // add a click event
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