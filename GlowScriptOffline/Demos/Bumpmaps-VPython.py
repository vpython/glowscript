from vpython import *
scene.title = "Enhanced 3D of surfaces using bump maps"
scene.caption = "Drag the single light with the left button, rotate with the right button."
c = box(pos=vec(0,0,0), shininess=0, texture={'file':textures.stones, 'bumpmap':bumpmaps.stones})

scene.background = color.gray(.5)
scene.lights = []
L = distant_light(direction=vec(0,0,1))
pos = None

def move(ev):
    global pos
    if pos is not None:
        m = scene.mouse.pos
        L.direction = vector(m.x-pos.x, m.y-pos.y, 1)

def up(ev):
    global pos
    pos = None
    scene.unbind("mousemove", move)
    scene.unbind("mouseup", up)

def down(ev):
    global pos
    pos = scene.mouse.pos
    scene.bind("mousemove", move)
    scene.bind("mouseup", up)

scene.bind("mousedown", down)