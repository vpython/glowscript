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

        mouse_locked: { value: false, type: null },
        
        follow: function(objectOrFunction) { this.follower = objectOrFunction },

        __activate: function () {
            var canvas = this.canvas
            var camera = this

            var contextMenuDisabled = false
            var lastX = null, lastY = null
            var angleX = null, angleY = null
            var leftButton = false, rightButton = false, rotating = false, zooming = false

            var zoom = function (ev, delta) {
                var z = Math.exp(-delta * .05)
                canvas.range = canvas.range * z
            }

            $(document).bind("contextmenu", function (e) {
                return !contextMenuDisabled;
            })
            canvas.elements.mousewheel(function (ev, delta) { // ev.which is 0 during mousewheel move
                if (canvas.userzoom) zoom(ev, delta)
                return false;
            })
            canvas.elements.mousedown(function (ev) {
                // This basic mousedown event happens before the user script mousedown event
                // ev.which is 1 for left button, 2 for mousewheel, 3 for right button
                if (ev.which == 1) leftButton = true
                if (ev.which == 3) rightButton = true
                rotating = canvas.userspin && (ev.which == 3 || (ev.which == 1 && canvas.mouse.ctrl && !canvas.mouse.alt))
                zooming = canvas.userzoom && (ev.which == 2 || (ev.which == 1 && canvas.mouse.alt && !canvas.mouse.ctrl) || (leftButton && rightButton))
                if (rotating || zooming) {
                    camera.mouse_locked = true
                    contextMenuDisabled = true
                    lastX = ev.pageX; lastY = ev.pageY
                    ev.preventDefault()
                    ev.stopPropagation()
                    return false
                }
            })
            // Ideally we should bind and unbind this as rotating and zooming change
            $(document).mousemove(function (ev) {
                if (zooming) {
                    var dy = lastY - ev.pageY
                    lastY = ev.pageY
                    zoom(ev, 0.1 * dy)
                } else if (rotating) {
                    var dx = ev.pageX - lastX; var dy = ev.pageY - lastY
                    lastX = ev.pageX; lastY = ev.pageY
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
            })
            $(document).mouseup(function (ev) {
                if (ev.which == 1) leftButton = false
                if (ev.which == 3) rightButton = false
                if (ev.which == 3 && contextMenuDisabled)
                    setTimeout(function () { contextMenuDisabled = false }, 0)
                if (rotating || zooming) {
                    rotating = zooming = false
                    camera.mouse_locked = false
                    return false
                }
            })
        }
    })

    var exports = {
        orbital_camera: orbital_camera
    }
    Export(exports)
})()