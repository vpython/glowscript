from vpython import *

# GlowScript version of Jupyter demo program Color-RGB-HSV

scene.userzoom = False
scene.userspin = False
scene.width = 460
scene.height = 200
scene.range = 1
scene.background = color.red
box(pos=vector(10,0,0)) # Force creation of canvas; box is not seen because it is outside the canvas
cancopy = 'You can Ctrl-C or Command-C copy these RGB and HSV values:\n'
scene.title = cancopy
scene.append_to_title("RGB = <")
titlergb = wtext(pos=scene.title_anchor, text="1.000, 0.000, 0.000")
scene.append_to_title(">, HSV = <")
titlehsv = wtext(pos=scene.title_anchor, text="0.000, 0.000, 0.000")
scene.append_to_title(">")

C = ['Red', 'Green', 'Blue', 'Hue', 'Saturation', 'Value']
sliders = []
wts = []

def set_background(sl):
    if sl.id < 3:
        wts[sl.id].text = '{:1.3f}'.format(sl.value)
        rgb = vector(sliders[0].value, sliders[1].value, sliders[2].value)
        hsv = color.rgb_to_hsv(rgb)
        sliders[3].value = int(1000*hsv.x)/1000 # reset HSV slider positions; display 3 figures
        sliders[4].value = int(1000*hsv.y)/1000
        sliders[5].value = int(1000*hsv.z)/1000
        wts[3].text = '{:1.3f}'.format(hsv.x)
        wts[4].text = '{:1.3f}'.format(hsv.y)
        wts[5].text = '{:1.3f}'.format(hsv.z)
    else:
        wts[sl.id].text = '{:1.3f}'.format(sl.value)
        hsv = vector(sliders[3].value, sliders[4].value, sliders[5].value)
        rgb = color.hsv_to_rgb(hsv)
        sliders[0].value = int(1000*rgb.x)/1000 # reset RGB slider positions; display 3 figures
        sliders[1].value = int(1000*rgb.y)/1000
        sliders[2].value = int(1000*rgb.z)/1000
        wts[0].text = '{:1.3f}'.format(rgb.x)
        wts[1].text = '{:1.3f}'.format(rgb.y)
        wts[2].text = '{:1.3f}'.format(rgb.z)
    scene.background = rgb
    # For readability, limit precision of display of quantities to 3 figures
    titlergb.text = "{:1.3f}, {:1.3f}, {:1.3f}".format(rgb.x, rgb.y, rgb.z)
    titlehsv.text = "{:1.3f}, {:1.3f}, {:1.3f}".format(hsv.x, hsv.y, hsv.z)

scene.caption = '\n'
for i in range(6): # Create the 3 RGB and 3 HSV sliders
    sliders.append(slider(length=300, left=10, min=0, max=1, bind=set_background, id=i))
    scene.append_to_caption('    '+C[i]+' ') # Display slider name
    wts.append(wtext(text='0.000'))
    scene.append_to_caption('\n\n')
    if i == 2: scene.append_to_caption("\n\n") # Separate the RGB and HSV sliders
sliders[0].value = 1 # make the background red
sliders[4].value = sliders[5].value = 1
wts[0].text = '1.000'
wts[4].text = wts[5].text = '1.000'