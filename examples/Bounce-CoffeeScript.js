GlowScript 1.0 CoffeeScript
# The statement above invokes the CoffeeScript language (which generates JavaScript).
# See coffeescript.org for information about CoffeeScript.

display_instructions = () ->
    s1 = "In GlowScript programs:\n\n"
    s2 = "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n\n"
    s3 = "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt key and drag,\n         or use the mouse wheel."
    scene.caption.text(s1+s2+s3)

# Display text below the 3D graphics:
scene.title.text("A ball bounces in a box")
display_instructions()

side = 4.0
thk = 0.3
s2 = 2*side - thk
s3 = 2*side + thk
wallR = box ( pos:vec( side, 0, 0), size:vec(thk,s2,s3),  color : color.red )
wallL = box ( pos:vec(-side, 0, 0), size:vec(thk,s2,s3),  color : color.red )
wallB = box ( pos:vec(0, -side, 0), size:vec(s3,thk,s3),  color : color.blue )
wallT = box ( pos:vec(0,  side, 0), size:vec(s3,thk,s3),  color : color.blue )
wallBK = box( pos:vec(0, 0, -side), size:vec(s2,s2,thk),  color : color.gray(0.7) )

ball = sphere ( color : color.green, size : 0.8*vec(1,1,1) )
ball.mass = 1.0
ball.p = vec(-0.15, -0.23, +0.27)
attach_trail(ball, {pps:200, retain:100})

side = side - thk*0.5 - ball.size.x/2

dt = 0.3
t=0.0
while true
  rate(200, wait)
  t = t + dt
  ball.pos = ball.pos + (ball.p/ball.mass)*dt
  
  # Note the three-way numerical comparisons here, not available in JavaScript:
  if not (-side < ball.pos.x < side)  
    ball.p.x = -ball.p.x
  if not (-side < ball.pos.y < side)
    ball.p.y = -ball.p.y
  if not (-side < ball.pos.z < side)
    ball.p.z = -ball.p.z
