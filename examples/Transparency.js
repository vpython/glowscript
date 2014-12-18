GlowScript 1.0
scene.width = 600
scene.height = 600
scene.background = color.gray(0.5)
scene.range = 1.3
var s = 'Pixel-level transparency using "depth-peeling."'
s += "\nNote the correct transparencies of the intersecting slabs."
s += "\nHere are the <a href='http://glowscript.org/docs/GlowScriptDocs/technical.html' target='_blank'>technical details</a> of the depth-peeling algorithm."
scene.title.html(s)

// http://www.glowscript.org/docs/GlowScriptDocs/technical.html

box({pos:vec(0,0,0), opacity:1, size:vec(1,1,1), texture:textures.flower})
sphere({pos:vec(0,0,.9), opacity:0.3, shininess:0, size:0.4*vec(1,1,1), color:color.green})
var s = sphere({pos:vec(0.1,0,1.2), opacity:0.2, shininess:0, size:0.2*vec(1,1,1), color:color.cyan})
box({pos:s.pos, size:0.3*s.size, color:color.gray(.2)})
box({pos:vec(0,.5,1), color:color.red,  opacity:0.2, size:vec(.05,.2,.8), axis:vec(1,0,1) })
box({pos:vec(0,.5,1), color:color.cyan, opacity:0.2, size:vec(.05,.2,.8), axis:vec(1,0,-1)})

function display_instructions() {
    var s1 = "In GlowScript programs:\n\n"
    var s2 = "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n\n"
    var s3 = "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt key and drag,\n         or use the mouse wheel."
    scene.caption.text(s1+s2+s3)
}

display_instructions()
