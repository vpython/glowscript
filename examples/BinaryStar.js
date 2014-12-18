GlowScript 1.0
/* Binary star */

function display_instructions() {
    var s1 = "In GlowScript programs:\n\n"
    var s2 = "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n\n"
    var s3 = "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt key and drag,\n         or use the mouse wheel."
    scene.caption.text(s1+s2+s3)
}

// Display text below the 3D graphics:
scene.title.text("Binary Star")
display_instructions()

scene.forward = vec(0,-.3,-1)

var G = 6.7e-11

var giant = sphere( {pos:vec(-1e11,0,0), size:4e10*vec(1,1,1), color:color.red} )
giant.mass = 2e30
giant.p = vec(0, 0, -1e4) * giant.mass
attach_trail(giant, {retain:150})

var dwarf = sphere( {pos:vec(1.5e11,0,0), size:2e10*vec(1,1,1), color:color.yellow} )
dwarf.mass = 1e30
dwarf.p = -giant.p
attach_trail(dwarf, {type:"spheres", pps:20, retain:40})

var dt = 1e5
while (true) { 
    rate(200,wait)

    var dist = dwarf.pos - giant.pos
    var force = G * giant.mass * dwarf.mass * dist / pow(mag(dist),3)
    giant.p = giant.p + force*dt
    dwarf.p = dwarf.p - force*dt

    var stars = [giant, dwarf]
    for (var _star in stars) {
		var star = stars[_star]
		star.pos = star.pos + (star.p/star.mass) * dt
	}
}
