GlowScript 1.0
/* Electric field of a dipole */

var scale = 4e-14/1e17
var ec = 1.6e-19  // electron charge
scene.range = 2e-13

var charges = [ sphere( { pos : vec(-1e-13,0,0), Q :  ec, color:color.red, size : 1.2e-14*vec(1,1,1) } ),
                sphere( { pos : vec( 1e-13,0,0), Q : -ec, color:color.blue, size : 1.2e-14*vec(1,1,1) } )]

var s1 = "Click or drag to plot an electric field vector produced by the two charges."
var s2 = "Arrows representing the field are bluer if low magnitude, redder if high."
scene.caption.text(s1+'\n\n'+s2)

function getfield(p) {
    var f = vec(0,0,0)
    for (var _c in charges) {
        var c = charges[_c]
        f = f + (p-c.pos) * 8.988e9 * c.Q / pow(mag(p-c.pos),3)
    }
    return f
}

function mouse_to_field (a) {
    var p = scene.mouse.pos
    var f = getfield(p)
    var m = mag(f)
    var red = Math.max( 1-1e17/m, 0 )
    var blue = Math.min(   1e17/m, 1 )
    if (red >= blue) { 
        blue = blue/red
		red = 1.0
	}
	else { 
		red = red/blue
		blue = 1.0
	}
    a.pos = p
    a.axis_and_length = scale*f
    a. color = vec(red,0,blue)
}

var drag = false
var a

scene.bind("mousedown", function() {
    a = arrow( {shaftwidth:6e-15} )
    mouse_to_field(a)
    drag = true
})

scene.bind("mousemove", function() {
    if (!drag) return
    mouse_to_field(a)
})

scene.bind("mouseup", function() {
    mouse_to_field(a)
    drag = false
})
