GlowScript 1.0
/* 1000 rotating cubes */

scene.title.text("10 by 10 by 10 rotating cubes; fps = frames/sec\n ")
// Display frames per second and render time:
$("<div id='fps'/>").appendTo(scene.title)
scene.caption.text("Click a box to turn it white")

var boxes = []

var L = 6
var N = 10
var b
scene.range = L

for(var x=0; x<N; x++)
  for(var y=0; y<N; y++)
    for(var z=0; z<N; z++) {
        b = box({color:vec(x/N,y/N,z/N), 
                pos:vec(L*(x/(N-1)-.5),L*(y/(N-1)-.5),L*(z/(N-1)-.5)), 
                size:vec(.6*L/N,.4*L/N,.6*L/N)})
        boxes.push(b)
    }

var lasthit = null
var lastcolor = null
scene.bind("click", function() {
    var hit = scene.mouse.pick()
    if (hit) {
        if (lasthit !== null) lasthit.color = lastcolor
        lasthit = hit
        lastcolor = lasthit.color
        hit.color = color.white
    }
})

var t = 0
var dt = 0.01
while (true) {
    scene.waitfor("redraw",wait)
    t += dt
    for(var i=0; i<boxes.length; i++)
        boxes[i].axis = vec( sin(t), 0, cos(t) )
}

