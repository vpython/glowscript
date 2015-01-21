; (function () {
    "use strict";

    function orbital_camera(canvas, args) {
        if (!(this instanceof orbital_camera)) return new orbital_camera(canvas, args)

        this.canvas = canvas
        this.follower = null
    }

    property.declare(orbital_camera.prototype, {
        pos: { get: function() {
            var c = this.canvas
            return c.center.sub( c.forward.norm().multiply( c.range / Math.tan(c.fov/2) ) )
            } },
        
        follow: function(objectOrFunction) { this.follower = objectOrFunction },

        __activate: function () {
            var canvas = this.canvas
            var camera = this

            var contextMenuDisabled = false
            var lastX=[null,null], lastY=[null,null] // corresponding to two fingers
            var downX=[null,null], downY=[null,null] // initial mouse locations
            var angleX = 0, angleY = 0
            var afterdown = false
            var rotating, zooming
            var leftButton=false, rightButton=false

            var zoom = function (ev, delta) {
                var z = Math.exp(-delta * .05)
                canvas.range = canvas.range * z
            }
            
            var spin = function(ev) {
                var dx = ev.pageX - lastX[0]
				var dy = ev.pageY - lastY[0]
                angleX += dx * .01
                angleY += dy * .01;
                if (angleY < -1.4) angleY = -1.4;
                if (angleY > 1.4) angleY = 1.4;
                var distance = canvas.range / Math.tan(canvas.fov / 2)
                canvas.forward = canvas.forward.rotate({angle:-.01 * dx, axis:canvas.up})
                var max_vertical_angle = canvas.up.diff_angle(canvas.forward.multiply(-1))
                var vertical_angle = .01 * dy
                if (!(vertical_angle >= max_vertical_angle || vertical_angle <= (max_vertical_angle - Math.PI))) {
                    // Over the top (or under the bottom) rotation
                    canvas.__forward = canvas.__forward.rotate({angle:-vertical_angle, axis:canvas.__forward.cross(canvas.__up)})
                }
            }

            $(document).bind("contextmenu", function (e) {
                return !contextMenuDisabled
            })
            canvas.elements.mousewheel(function (ev, delta) { // ev.which is 0 during mousewheel move
                if (canvas.userzoom) zoom(ev, delta)
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
                downX[0] = lastX[0] = ev.pageX
                downY[0] = lastY[0] = ev.pageY
                if (rotating || zooming) contextMenuDisabled = true
                else canvas.trigger("mouse", ev)
	            afterdown = true
	            ev.preventDefault()
	            ev.stopPropagation()
	            return false // makes jquery handlers execute preventDefault and stopPropagation
            })
            // Ideally we should bind and unbind this as rotating and zooming change
            $(document).mousemove(function (ev) {
            	if (!afterdown) return // eliminate mousemove events due to touchmove generating a mousemove
            	if (ev.pageX === lastX[0] && ev.pageY === lastY[0]) return
                if (zooming) {
                    var dy = lastY[0] - ev.pageY
                    if (dy !== 0) zoom(ev, 0.1 * dy)
                } else if (rotating) {
                	spin(ev)
                } else if (ev.which == 1) canvas.trigger("mouse", ev)
                lastX[0] = ev.pageX
				lastY[0] = ev.pageY
            })
            $(document).mouseup(function (ev) {
                if (ev.which == 1) leftButton = false
                if (ev.which == 3) rightButton = false
                if (ev.which == 3 && contextMenuDisabled)
                    setTimeout(function () { contextMenuDisabled = false }, 0)
                canvas.trigger("mouse", ev) // the up event
                if (!(rotating || zooming)) {
                	if (abs(ev.pageX - downX[0]) <= 5 && abs(ev.pageY - downY[0]) <= 5) {
                		ev.type = "click"
                		canvas.trigger("mouse", ev) // add a click event
                	}
                }
                rotating = zooming = afterdown = false
            	lastX = [null,null]
            	lastY = [null,null]
            })
            
			var lastSep = null // previous separation of two fingers
			var sep = null     // current separation of two fingers
			var fingers = 0    // number of fingers down
			var nomove = false // true if removing fingers from zooming
			var tstart
			var saveEvent
			
			$(canvas.elements).bind('touchstart', function (ev) {
			  rotating = zooming = nomove = false
			  var pt
			  var data = ev.originalEvent.targetTouches
			  if (data.length > 2) return
			  fingers++
			  var i = 0
			  if (lastX[0] !== null) i = 1
		      pt = data[0]
		      downX[i] = lastX[i] = pt.clientX
		      downY[i] = lastY[i] = pt.clientY
			  lastSep = null
			  saveEvent = {type:"mousedown", pageX:downX[0], pageY:downY[0], which:1}
			  // Delay passing touchstart info until we've checked whether rotating or not
			  tstart = window.performance.now()
              ev.preventDefault()
              ev.stopPropagation()
              return false // makes jquery handlers execute preventDefault and stopPropagation
			})
			
			$(document).bind('touchmove', function (ev) {
			  if (nomove) return
			  var t = window.performance.now() - tstart
			  var data = ev.originalEvent.targetTouches
			  if (data.length > 2) return
			  var pt
			  var newx=[null,null], newy=[null,null]
			  var dx=[0,0], dy=[0,0]           // relative to previous move location
			  var relx=[0,0], rely=[0,0]       // relative to downX, downY of touchstart
			  for (var i=0; i<data.length; i++) {
				  pt = data[i]
				  dx[i] = pt.clientX - lastX[i]
				  dy[i] = pt.clientY - lastY[i]
				  relx[i] = pt.clientX - downX[i]
				  rely[i] = pt.clientY - downY[i]
				  newx[i] = pt.clientX
				  newy[i] = pt.clientY
			  }
			  if (saveEvent !== null) { // not yet emitted mousedown event
			  	if (data.length == 2) {
			  		zooming = true
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
			  			rotating = true
			  			saveEvent = null
			  		}
			  	}
			  }
			  if (saveEvent === null) {
			  	  if (newx[0] === lastX[0] && newy[0] === lastY[0] &&
			  	  	  newx[1] === lastX[1] && newy[1] === lastY[1]) return
                  ev.pageX = newx[0]
                  ev.pageY = newy[0]
                  ev.type = "mousemove"
			      if (rotating) spin(ev)
			      else if (zooming) {
		        	  var xx = newx[1] - newx[0]
		              var yy = newy[1] - newy[0]
		              sep = Math.sqrt(xx*xx + yy*yy)
		              if (lastSep !== null && sep != lastSep) zoom(ev, 0.2*(sep -lastSep)) 
					  lastSep = sep
			      } else canvas.trigger("mouse", ev)
			  }
			  lastX[0] = newx[0]
			  lastX[1] = newx[1]
			  lastY[0] = newy[0]
			  lastY[1] = newy[1]
			})
			
			$(document).bind('touchend', function (ev) {
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
			})
        }
    })

    var exports = {
        orbital_camera: orbital_camera
    }
    Export(exports)
})()