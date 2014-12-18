GlowScript 1.0
/* This program displays most GlowScript 3D objects.

It also illustrates key features such as mouse handling, rate, and sleep. */

// Bruce Sherwood, August 2011

var s
var drag = false

scene.bind("mousedown", function() {
    s = sphere({color:color.magenta})
    s.pos = scene.mouse.pos
    drag = true
})

scene.bind("mousemove", function() {
    if (!drag) { return }
    s.pos = scene.mouse.pos
})

scene.bind("mouseup", function() {
    s.visible = false
    drag = false
})

scene.title.text("A display of most GlowScript 3D objects")
scene.background = color.gray(0.7)
scene.center = vec(0,0.5,0)
scene.forward = vec(-.3,0,-1)
var title = label({pos:vec(1.1,2,0), text:'GlowScript', 
    xoffset:40, height:16, color:color.yellow})
box( {pos:vec(-2,0,0), size:vec(.3,2.5,2.5), color:color.red} )
box( {pos:vec(.25,-1.4,0), size:vec(4.8,.3,2.5), color:color.red} )
cylinder( {pos:vec(-2,2,1.25), size:vec(2.5,1.4,1.4), axis:vec(0,0,-1), color:color.blue} )
var ball = sphere( {pos:vec(2,1,0), size:1.2*vec(1,1,1), color:color.cyan} )
var ptr = arrow( {pos:vec(0,0,2), axis_and_length:vec(2,0,0), color:color.yellow} )
cone( {pos:vec(-2,0,0), size:vec(3,2,2), color:color.green} )
ring( {pos:vec(.2,0,0), size:1.2*vec(0.2,1,1), axis:vec(1,0,0), color:color.gray(0.4)} )
sphere( {pos:vec(-.3,2,0), color:color.orange, size:vec(.3,1.5,1.5)} )
pyramid( {pos:vec(.3,2,0), color:vec(0,0.5,.25), size:vec(0.8,1.2,1.2)} )
var spring = helix( {pos:vec(2,-1.25,0), size:vec(1.8,.6,.6), axis:vec(0,1,0),
        color:color.orange, thickness:.1} )

var angle = 0
var da = .01

var trail = curve({color:color.magenta, radius: .02})
trail.push(vec(1,0,0))
trail.push(vec(1,0,2))
trail.push(vec(2,0,2))

while (angle < 3*pi/4) {
  rate(100,wait)
  ptr.rotate( {angle:da, axis:vec(0,0,1), origin:ptr.pos} )
  trail.push(ptr.pos+ptr.axis_and_length)
  angle += da
}

sleep(1,wait) // sleep for 1 second
scene.autoscale = false
scene.caption.text("Drag the mouse and you'll drag a sphere.")

var t = 0
var dt = .01
var y0 = title.pos.y
var ball_yo = ball.pos.y
while (t < 10) {
  rate(1/dt,wait)
  ball.pos.y = ball_yo+0.5*sin(-4*t)
  spring.size.x = ball.pos.y-spring.pos.y-ball.size.y/2+0.15
  title.yoffset = 28*sin(-4*t)
  t += dt
}