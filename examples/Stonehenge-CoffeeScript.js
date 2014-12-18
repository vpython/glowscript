GlowScript 1.0 CoffeeScript
# The statement above invokes the CoffeeScript language (which generates JavaScript).
# See coffeescript.org for information about CoffeeScript.

# Fly through Surreal Stonehenge 
# Bruce Sherwood

# Converted from the JavaScript version of Stonehenge using js2coffee.org

# A surreal scene that illustrates many of the features of GlowScript

hourminute = ->
  now = new Date()
  hour = now.getHours()
  minute = now.getMinutes()
  [ hour, minute ]
 
class Analog_clock
  #constructor: (pos: vec(0,0,0), axis: vec(0,0,1), radius: 1) ->
  constructor: (@pos = vec(0,0,0), @axis = vec(0,0,1), @radius = 1) ->
      #alert(@pos.toString()+', '+@axis.toString()+', '+@radius)
      @hour = 0
      @minute = -1
      @spheres = []
      for n in [0...12]
        @spheres.push sphere(
            pos: @pos + @radius * scene.up.rotate(
                angle: -2 * pi * n / 12
                axis: @axis
                )
            size: 0.1 * @radius * vec(1, 1, 1)
            color: color.hsv_to_rgb(vec(n / 12, 1, 1))
        )
      @hand = arrow(
        pos: @pos
        axis_and_length: 0.95 * @radius * scene.up
        shaftwidth: @radius / 10
        color: color.cyan
      )
      @update()

  update: ->
    [hour, minute] = hourminute()
    hour -= 12  if hour >= 12
    return  if @hour is hour and @minute is minute
    @hand.axis = 0.95 * @radius * scene.up.rotate(
      angle: -2 * pi * minute / 60
      axis: @axis
    )
    @spheres[@hour].size = 0.1 * @radius * vec(1, 1, 1) # restore normal size
    @spheres[hour].size = 0.2 * @radius * vec(1, 1, 1) # enalarge the house
    @hour = hour
    @minute = minute

scene.width = 800
scene.height = 400
roam = false

scene.bind "mousedown", ->
  roam = true

scene.bind "mouseup", ->
  roam = false

ycenter = 2
$(canvas.container).css "font-size", "90%"
scene.title.html "<b>Surreal Stonehenge</b>"

# Comment this in to see performance (frames per second, render time in milliseconds)
#$("<div id='fps'/>").appendTo(scene.title)

scene.center = vec(0, ycenter, 0)
scene.range = 12
scene.userspin = false
scene.userzoom = false
grey = color.gray(0.8)
Nslabs = 8
R = 10
w = 5
d = 0.5
h = 5
photocenter = 0.15 * w

scene.visible = false # make no display until textures are loaded

# The floor, central post, and ball atop the post
floor = box(
  pos: vec(0, -0.1, 0)
  size: vec(0.2, 24, 24)
  axis: vec(0, 1, 0)
  texture: textures.wood
)
pole = cylinder(
  pos: vec(0, 0, 0)
  axis: vec(0, 1, 0)
  size: vec(h, .4, .4)
  color: color.red
)
sphere
  pos: vec(0, h, 0)
  color: vec(1, 0, 0)

# Set up the gray slabs, including a portal
i = 0
while i < Nslabs
  theta = i * 2 * pi / Nslabs
  c = cos(theta)
  s = sin(theta)
  xc = R * c
  zc = R * s
  if i is 2
    box
      pos: vec(-3 * w / 8, 0.75 * h / 2, R)
      size: vec(0.5 * w / 2, 0.75 * h, d)
      color: grey

    box
      pos: vec(3 * w / 8, 0.75 * h / 2, R)
      size: vec(0.5 * w / 2, 0.75 * h, d)
      color: grey

    box
      pos: vec(0, 0.85 * h, R)
      size: vec(w, 0.3 * h, d)
      color: grey
  else
    slab = box(
      pos: vec(R * c, h / 2, R * s)
      axis: vec(c, 0, s)
      size: vec(d, h, w)
      color: grey
    )
    unless i is 6
      T = textures.flower
      T = textures.rug  if i is 7 or i is 4
      box
        pos: slab.pos
        size: vec(1.1 * d, 0.9 * 4 * photocenter, 0.9 * 4 * photocenter)
        axis: vec(c, 0, s)
        texture: T
  i++

# Decorate back slab with a gold box and a clock
box
  pos: vec(0, h / 2, -R + d / 2 + 0.1)
  size: vec(w / 2, w / 2, 0.2)
  color: vec(1, 0.8, 0)
  texture: textures.wood_old
  
pos = vec(0, h / 2, -R + d / 2 + 0.2 + 0.2 * h / 10)
clock = new Analog_clock(pos, vec(0,0,1), 0.2*w)
clock.update()

# Draw guy wires from the top of the central post
Nwires = 32
i = 0
while i < Nwires
  theta = i * 2 * pi / Nwires
  L = vec(R * cos(theta), -h - 0.1, R * sin(theta))
  cylinder
    pos: vec(0, h, 0)
    axis: L
    size: vec(mag(L), .02, .02)
    color: vec(1, 0.7, 0)
  i++

# Display a pyramid
pyramid
  pos: vec(-4, 0, -5)
  size: vec(2, 2, 2)
  axis: vec(0, 1, 0)
  color: vec(0, .5, 0)
  texture: textures.rough

# Display smoke rings rising out of a black tube
smoke = []
Nrings = 20
x0 = -5
y0 = 1.5
z0 = -2
r0 = 0.1
spacing = 0.2
thick = r0 / 2
dr = 0.015
dthick = thick / Nrings
gray = 1
cylinder
  pos: vec(x0, 0, z0)
  axis: vec(0, 1, 0)
  size: vec(y0 + r0, 3 * r0, 3 * r0)
  color: color.black

# Create the smoke rings
i = 0
while i < Nrings
  D = 2 * (r0 + dr * i)
  T = thick - dthick * i
  smoke.push ring(
    pos: vec(x0, y0 + spacing * i, z0)
    axis: vec(0, 1, 0)
    size: vec(T, D, D)
    color: color.gray(gray)
  )
  i++

y = 0
dy = spacing / 20
top_of_rings = Nrings - 1

# Roll a log back and forth
rlog = 1
wide = 4
zpos = 2
zface = 5
tlogend = 0.2
v0 = 0.3
v = v0
omega = -v0 / rlog
theta = 0
dt = 0.1
tstop = 0.3

# Log rolls back and forth between two stops
logcyl = cylinder(
  pos: vec(-wide, rlog, zpos)
  size: vec(zface - zpos, 2, 2)
  axis: vec(0, 0, 1)
  texture: textures.granite
)
leftstop = box(
  pos: vec(-wide - rlog - tstop / 2, 0.6 * rlog, (zpos + zface) / 2)
  size: vec(tstop, 1.2 * rlog, (zface - zpos))
  color: color.red
  emissive: 1
)
rightstop = box(
  pos: vec(wide + rlog + tstop / 2, 0.6 * rlog, (zpos + zface) / 2)
  size: vec(tstop, 1.2 * rlog, (zface - zpos))
  color: color.red
  emissive: 1
)

# Run a ball up and down the pole
y1 = 0.2 * h
y2 = 0.7 * h
rball = 0.4
Dband = 1.3 * pole.size.y
cylinder
  pos: vec(0, y1 - 0.9 * rball, 0)
  axis: vec(0, 1, 0)
  size: vec(0.1, Dband, Dband)
  color: color.green

cylinder
  pos: vec(0, y2 + 0.9 * rball, 0)
  axis: vec(0, 1, 0)
  size: vec(0.1, Dband, Dband)
  color: color.green

vball0 = 0.3 * v0
vball = vball0
ballangle = 0.05 * pi
poleball = sphere(
  pos: vec(0, y1, 0)
  size: 2 * rball * vec(1, 1, 1)
  color: color.blue
)
polecones = []
nn = 0

while nn < 4
  cc = cone(
    pos: vec(0.8 * rball, y1, 0)
    size: rball * vec(3, 1, 1)
    color: color.yellow
  )
  cc.rotate
    angle: 0.5 * nn * pi
    axis: vec(0, 1, 0)
    origin: vec(0, y1, 0)

  polecones.push cc
  nn++
rbaseball = 0.3
vbaseball0 = 3 * v0

# A table with a mass-spring object sliding on it
table = cone(
  pos: vec(0.4 * R, h / 4, -.3 * R)
  size: vec(h / 4, 0.6 * R, 0.6 * R)
  axis: vec(0, -1, 0)
  texture:
    file: textures.wood_old
    turn: 1
)
tabletop = table.pos
rspring = 0.02 * h
Lspring = .15 * R
Lspring0 = .1 * R
hmass = 4 * rspring
post = cylinder(
  pos: tabletop
  axis: vec(0, 1, 0)
  size: vec(2 * hmass, .4, .4)
  color: color.gray(.6)
)
spring = helix(
  pos: post.pos + vec(0, hmass / 2, 0)
  size: vec(Lspring, 2 * rspring, 2 * rspring)
  color: color.orange
  thickness: rspring
)
mass = cylinder(
  pos: post.pos + vec(Lspring, 0, 0)
  axis: vec(0, 1, 0)
  size: vec(hmass, .04 * R, .04 * R)
  color: color.orange
)
mass.p = vec(10, 0, 5)
mass.m = 1
kspring = 200
deltat = .01

# Display an ellipsoid
Rcloud = 0.8 * R
omegacloud = 3 * v0 / Rcloud
cloud = sphere(
  pos: vec(0, 0.7 * h, -Rcloud)
  size: vec(5, 2, 2)
  color: color.green
  opacity: 0.3
)
rhairs = 0.025
dhairs = 2
maxcosine = dhairs / sqrt(pow(rhairs, 2) + pow(dhairs, 2))
haircolor = color.black

scene.waitfor "textures", wait
scene.visible = true

# Add instructions below the display
s1 = "<b>Fly through the scene:</b> With the mouse button down,<br><br>"
s2 = "    move the mouse above or below the center of the scene to move forward or backward;<br><br>"
s3 = "    move the mouse right or left to turn your direction of motion.<br><br>"
s4 = "(Normal GlowScript rotate and zoom are turned off in this program.)"
scene.caption.html s1 + s2 + s3 + s4

loop
  if roam
    ray = scene.mouse.ray
    if abs(ray.dot(scene.forward)) < maxcosine
      newray = norm(vec(ray.x, 0, ray.z))
      angle = asin(scene.forward.cross(newray).dot(scene.up))
      newforward = scene.forward.rotate(
        angle: angle / 30
        axis: scene.up
      )
      dist = mag(scene.center - scene.camera.pos)
      scene.center = scene.camera.pos + newforward * dist
      scene.forward = newforward
      scene.center = scene.center + scene.forward * ray.y / 4
    
  # Roll the log  theta = theta + omega * dt
  logcyl.pos.x = logcyl.pos.x + v * dt
  logcyl.rotate
    angle: omega * dt
    axis: vec(0, 0, 1)

  if logcyl.pos.x >= wide
    v = -v0
    omega = -v / rlog
    if rightstop.color.equals(color.red)
      rightstop.color = color.cyan
    else
      rightstop.color = color.red
  if logcyl.pos.x <= -wide
    v = +v0
    omega = -v / rlog
    if leftstop.color.equals(color.red)
      leftstop.color = color.cyan
    else
      leftstop.color = color.red
      
  # Move the cloud
  cloud.rotate
    angle: omegacloud * dt
    axis: vec(0, 1, 0)
    origin: vec(0, 0, 0)

  # Run the ball up and down
  poleball.pos.y = poleball.pos.y + vball * dt
  i = 0
  while i < 4
    polecones[i].pos.y = poleball.pos.y
    polecones[i].rotate
      angle: ballangle
      axis: vec(0, 1, 0)
      origin: vec(0, 0, 0)
    i++
  if poleball.pos.y >= y2
    vball = -vball0
    ballangle = -ballangle
  if poleball.pos.y <= y1
    vball = +vball0
    ballangle = -ballangle
    
  # Move the smoke rings
  i = 0
  while i < Nrings
    smoke[i].pos = smoke[i].pos + vec(0, dy, 0)
    smoke[i].size.y = smoke[i].size.z = smoke[i].size.y + (dr / spacing) * dy
    smoke[i].size.x = smoke[i].size.x - (dthick / spacing) * dy
    i++
  y = y + dy
  if y >= spacing
    y = 0
    smoke[top_of_rings].pos = vec(x0, y0, z0)
    smoke[top_of_rings].size = vec(thick, 2 * r0, 2 * r0)
    top_of_rings--
  top_of_rings = Nrings - 1  if top_of_rings < 0
  
  # Update the mass-spring motion
  F = -kspring * (spring.size.x - Lspring0) * spring.axis.norm()
  mass.p = mass.p + F * deltat
  mass.pos = mass.pos + (mass.p / mass.m) * deltat
  spring.axis = mass.pos + vec(0, hmass / 2, 0) - spring.pos
  spring.size.x = mag(spring.axis)

  # Update the analog clock on the back slab
  clock.update()
  rate 30, wait
