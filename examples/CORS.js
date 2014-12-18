GlowScript 1.0 CoffeeScript

scene.range = 1.5
scene.forward = vec(-1,-.5,-1)
box
    size:vec(2,1,1)
    texture: "https://s3.amazonaws.com/glowscript/textures/cors_test.jpg"

s = 'This illustrates the use of an image from another web site as a texture.\n'
s += 'This is an example of CORS, "Cross-Origin Resource Sharing".'
scene.caption.text(s)

display_instructions = () ->
    s1 = "\n\nIn GlowScript programs:\n\n"
    s2 = "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n\n"
    s3 = "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt key and drag,\n         or use the mouse wheel."
    scene.caption.append(s1+s2+s3)

# Display text below the 3D graphics:
display_instructions()
