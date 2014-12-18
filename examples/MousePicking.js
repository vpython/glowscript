GlowScript 1.0
scene.width = scene.height = 500
scene.range = 2.2
//scene.title.text("Picking objects with the mouse")
scene.caption.text("Click to pick an object and make it red.")
scene.caption.append("\nNote picking of individual curve points.")
box({pos:vec(-1,0,0), color:color.cyan, opacity:1})
box({pos:vec(1,-1,0), color:color.green})
arrow({pos:vec(-1,-1,0), color:color.orange})
cone({pos:vec(2,0,0), axis:vec(0,1,-.3), color:color.blue, size:vec(2,1,1)})
sphere({pos:vec(-1.5,1.5,0), color:color.white, size:.4*vec(3,2,1)})
var square = curve( {color:color.yellow, radius:.05} )
square.push( vec(0,0,0), {pos:vec(0,1,0), color:color.cyan, radius:.1},
             vec(1,1,0), {pos:vec(1,0,0), radius:.1}, vec(0.3,-.3,0) )
var v0 = vertex({pos:vec(-.5,1.2,0), color:color.green})
var v1 = vertex({pos:vec(1,1.2,0), color:color.red})
var v2 = vertex({pos:vec(1,2,0), color:color.blue})
var v3 = vertex({pos:vec(-.5,2,0), color:color.yellow})
triangle({v0:v0, v1:v1, v2:v2})
//quad({v0:v0, v1:v1, v2:v2, v3:v3})

var lasthit = null
var lastpick = null
var lastcolor
scene.bind("mousedown", function() {
    if (lasthit !== null) {
        if (lastpick !== null) lasthit.modify(lastpick, {color:lastcolor})
        else lasthit.color = vec(lastcolor)
        lasthit = lastpick = null
    }
    var hit = scene.mouse.pick()
    if (hit !== null) {
        lasthit = hit
        lastpick = null
        if (hit.constructor == curve) { // pick individual point of curve
            lastpick = hit.pick
            // slice returns an array of points; we want the first (index = 0):
            lastcolor = hit.slice(lastpick, lastpick+1)[0].color
            hit.modify(hit.pick, {color:color.red})
        } else if (hit.constructor == triangle || hit.constructor == quad) {
            lasthit = hit.v0
            lastcolor = lasthit.color
            lasthit.color = color.red
        } else {
            lastcolor = vec(hit.color)
            hit.color = color.red
            //scene.caption.text(lastcolor.toString()+' '+hit.color.toString())
        }
    }
})
