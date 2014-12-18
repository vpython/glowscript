GlowScript 1.0 CoffeeScript
scene.width = scene.height = 600
scene.range = 0.6

# A pulse ripples along a rug, demonstrating dynamic changea of shape
# Bruce Sherwood, May 2012

s = "Click to stop or start\n\nIn GlowScript programs:\n\n"
s += "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n\n"
s += "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt key and drag,\n         or use the mouse wheel."
scene.caption.text(s)

# Construct a square WxH divided into little squares
# There are (w+1)x(h+1) vertices
# Center of rug is at 0,0,0

H = W = 1
w = 1
h = 50
dx = W/w
dy = H/h

# Create a grid of vertex objects covering the rug
verts = []
for y in [0..h] # from 0 to h inclusive, to include both bottom and top edges
    verts.push([])
    for x in [0..w] # from 0 to w inclusive, to include both left and right edges
        verts[y].push(vertex
                        pos:vec(-0.5+x*dx,-0.5+y*dy,0)
                        normal:vec(0,0,1) 
                        texpos:vec(x/w,y/h,0)
                        shininess: 0 )

# Create quads (equivalent to two triangles) based on the vertex objects just created.
# Note that a particular vertex may be shared by as many as 4 neighboring quads, and
# changing one vertex affects all of the quads that use that vertex.
for y in [0...h] # from 0 to h, not including h
    for x in [0...w] # from 0 to w, not including w
        quad
            v0: verts[y][x]
            v1: verts[y][x+1]
            v2: verts[y+1][x+1]
            v3: verts[y+1][x]
            texture:{file: textures.rug}

scene.waitfor('textures',wait)

Lpulse = 0.4 # length of half sine wave
dy_pulse = Lpulse/50
k = pi/(0.6*Lpulse)
A = 0.05
pulse = (z) -> # return the pulse height and normal
    if z < 0.2*Lpulse then return 0
    if z > 0.8*Lpulse then return 0
    z -= 0.2*Lpulse
    return A*sin(k*z)

run = true
scene.bind("mousedown", () ->
    run = not run
)

y = -0.5-Lpulse-dy_pulse # bottom of pulse (starts below rug)
loop
    while not run
        scene.waitfor('redraw',wait)
    y += dy_pulse
    if y+Lpulse <= -0.5
        continue
    if y >= 0.5
        y = -0.5-Lpulse
        continue
        
    start = Math.floor((y+0.5)/dy)     # lowest row of vertices in pulse
    end = Math.ceil((y+0.5+Lpulse)/dy) # highest row of vertices in pulse
    if start < 0
        if end <= 0 then continue
        start = 0
    if end > h 
        end = h
    
    scene.waitfor('redraw',wait) # synchronize updates with graphics card
    
    yp = -0.5+start*dy
    for s in [start...end]
        z0 = pulse(yp-y-dy_pulse)
        z1 = pulse(yp-y)
        z2 = pulse(yp+dy_pulse-y)
        yp += dy # advance to next row
        
        # If slope of a line is dy/dz, normal to the line is in direction < -dz, +dy >
        n1y0 = -(z1-z0)
        n2y0 = -(z2-z1)
        n1y = .5*(n1y0+n2y0) # average adjacent normals to smooth the lighting
        n1z = dy
        
        vy = verts[s]
        for vx in [0..w]
            vy[vx].pos.z = z1
            vy[vx].normal = vec(0,n1y,n1z)
      
