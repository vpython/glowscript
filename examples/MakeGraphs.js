GlowScript 1.0
/* Making Flot 2D graphs to accompany GlowScript 3D graphics */

scene.width = 300
scene.height = 200
scene.range = 1
var b = box({color:color.yellow})
scene.forward = vec(-1,-0.2,-1)
scene.caption.text("Make a graph of sine and cosine on the same graph:")
scene.pause("Click to advance",wait)

/*
var options = { // specify fixed graphing limits
    xaxis: { min: 4, max: 20, show: true },
    yaxis: { min: 0, max: 6, show: true }
}
graph(options) // default width and height
*/

// autoscaled graph is the default
// Display sine and cosine on the same graph:
var gd = graph() // default width and height
var p = series( {color:color.red, label:'sin(x)'} )
var q = series()
q.color = color.green // can change the color after creating the object
q.label = 'cos(x)'

for (var i = 0; i < 11; i += 0.2) {
    rate(100,wait)
    p.plot(i+5, 3+2*sin(i))
    q.plot(i+5, 3+2*cos(i))
}

scene.caption.text("Move the mouse over the graph and see the crosshairs")
scene.pause(wait)

// Pause, then change cosine curve to dots:
scene.caption.text("Change the cosine line graph to a scatter plot:")
scene.pause(wait)
q.type = 'scatter'

// Add another graph
scene.caption.text("Add a second graph:")
scene.pause(wait)
graph( {width:400, height:150} )
var p2 = series( {color:color.blue, label:'cos(5x)exp(-.5x)'} )

for (var i = 0; i < 5; i += 0.1) {
    rate(100,wait)
    p2.plot(i, cos(5*i)*exp(-.5*i))
}

// Plot vertical bars; note ability to set initial data:
scene.caption.text("Make a bar graph:")
scene.pause(wait)
var bargraph = graph( {width:400, height:150} )
var vb = series( {type:'bar', delta:0.2, color:color.green, data:[ [1,5], [3,-2], [6,4] ]} )

// Change the data:
scene.caption.text("Change the bar graph data")
scene.pause(wait)
vb.color = color.black
vb.data = [[1,-2], [3,2], [8,3], [12,4]] // reset all the data

// Transfer cosine curve to bargraph:
scene.caption.text("Transfer the cosine information from the first graph to the new graph:")
scene.pause(wait)
q.graph = bargraph

// Add a horizontal line to the first graph:
scene.caption.text("Add a horizontal line to the first graph:")
scene.pause(wait)

var N = series( {graph:gd, color:color.blue} )
N.plot([5+pi/2,5], [5+5*pi/2,5])

// Rotate a cube
scene.caption.text("Flash the line in the first graph while rotating the cube:")
scene.pause(wait)
var steps = 0
while (true) {
    rate(50,wait)
    b.rotate({angle:.02, axis:vec(0,1,1)})
    steps++
    if (steps == 20) {
        N.visible = !N.visible
        steps = 0
    }
}
