GlowScript 2.7 JavaScript

// Simulation of dancing pendulums.  

// Run the program and follow the link to the video for more explanation. */

// David Scherer, August 2011

function display_instructions() {
    var s = "In GlowScript programs:\n"
    s += "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n"
    s += "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt/Option key and drag,\n         or use the mouse wheel.\n"
    s += "Touch screen: pinch/extend to zoom, swipe or two-finger rotate."
    scene.title = s
}

display_instructions()

var pendulums = []

var hinge = cylinder()
hinge.color = vec(.5,.5,.8)
hinge.pos = vec(0,10,-15)
hinge.axis = vec(0,0,1)
hinge.size = vec(30,.8,.8)
scene.forward = vec(-1,-0.5,-1)
scene.range = 17

for(var i=0; i<15; i++) {
    var p = sphere()
    p.theta0 = -0.6
    p.size = 1.6*vec(1,1,1)
    p.period = 60/(51+i)
    p.color = color.hsv_to_rgb(vec(i/20, 0.6, 0.8))
    p.wire = cylinder()
    p.wire.color = p.color
    p.wire.pos = hinge.pos + vec(0,0,i+.5)*hinge.size.x/15
    p.wire.size = vec(15 * p.period*p.period, .1, .1)
    pendulums.push(p)
}

var start = new Date().getTime()
while (true) {
  var t = (new Date().getTime() - start)*.001
  scene.caption = "t=" + t.toFixed(1)
  for(var i=0; i<pendulums.length; i++) {
      var p = pendulums[i]
      var theta = p.theta0 * cos( 2*pi*t/p.period )
      p.wire.axis = vec(sin(theta),-cos(theta),0)
      p.pos = p.wire.pos + p.wire.axis*p.wire.size.x
  }
  scene.waitfor("redraw")
}