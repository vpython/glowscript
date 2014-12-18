GlowScript 1.0
scene.visible = false
scene.title.text("Enhanced 3D of surfaces using bump maps")
scene.caption.text("Drag the single light with the left button, rotate with the right button.\n")
scene.caption.append("Notice especially the appearance of the left and right faces.")
var c = box({pos:vec(0,0,0), shininess:0,
    texture:{file:textures.stones,  
    bumpmap:bumpmaps.stucco} })
c.rotate( {angle:pi/2, axis:vec(0,0,1)} )
c.rotate( {angle:pi, axis:vec(0,1,0)} )
scene.waitfor("textures",wait)
scene.visible = true

scene.background = color.gray(.5)
scene.lights = []
var L = distant_light( {direction:vec(0,0,1)} )

scene.bind("mousedown", function() {
    var pos = scene.mouse.pos
    
    scene.bind("mousemove", function () {
        if (pos !== null) {
            var x = scene.mouse.pos.x
            var y = scene.mouse.pos.y
            L.direction.x = x-pos.x
            L.direction.y = y-pos.y
        }
    })
    
    scene.bind("mouseup", function () {
        pos = null
    })
})