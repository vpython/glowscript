from vpython import *

N = 10

scene.title = N+" by "+N+" by "+N+"= "+N*N*N+" rotating cubes\n "
scene.caption = "Click a box to turn it white"

boxes = []

L = 6
scene.range = L
length = 0.6*L/N
height = 0.4*L/N

for x in range(N):
  for y in range(N):
    for z in range(N):
      b = box(color=vector(x/N,y/N,z/N),
            pos=vector(L*(x/(N-1)-.5),L*(y/(N-1)-.5),L*(z/(N-1)-.5)),
            size=vector(length,height,length))
      boxes.append(b)
      
# Display frames per second and render time:
$("<div id='fps'/>").appendTo(scene.title_anchor)

lasthit = None
lastcolor = None

def handle_click():
  global lasthit, lastcolor
  if lasthit != None: lasthit.color = lastcolor
  hit = scene.mouse.pick
  if hit:
    lasthit = hit
    lastcolor = lasthit.color
    hit.color = color.white

scene.bind("mousedown", handle_click)

t = 0
dt = 0.01

while True:
  rate(200)
  t += dt
  v = length*vector( sin(t), 0, cos(t) )
  for b in boxes:
    b.rotate(angle=.01, axis=vector(0,1,0))
