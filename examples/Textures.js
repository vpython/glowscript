GlowScript 1.0
scene.width = 600
scene.height = 600
var show = 'box'
var last_show = show
 
var D = 0.7 // size of box
var R = .4 // radius of sphere

var names = ['flower', 'granite', 'gravel', 'metal', 'rock', 'rough', 'rug', 'stones', 'stucco', 'wood', 'wood_old']
var bumps = [ null, null, 'gravel', null, 'rock', null, null, 'stones', 'stucco', null, 'wood_old']
var labels = []

function erase() {
    var objects = scene.objects
    for (var obj in objects) objects[obj].visible = false
    // At the time of writing, labels were not included in scene.objects:
    while (labels.length > 0) labels.pop().visible = false
}

function show_object(index, x, y) {
    var T = textures[names[index]]
    var B = null
    var c
    // Bump maps aren't very salient unless one moves the light or rotates the object,
    // so don't bother with bump maps unless there's an option to move the light or object.
    //if (bumps[index] !== null) B = bumpmaps[bumps[index]]
    if (show == 'box') {
        c = box( {pos:vec(x,y,0), size:D*vec(1,1,1)} )
    } else if (show == 'sphere') {
        c = sphere( {pos:vec(x,y,0), size:D*vec(1,1,1)} )
    } else if (show == 'cylinder') { 
        c = cylinder( {pos:vec(x-D/2,y,0), size:D*vec(1,1,1)} )
    } else if (show == 'cone') { 
        c = cone( {pos:vec(x-D/2,y,0), size:D*vec(1,1,1)} )
    } else if (show == 'pyramid') { 
        c = pyramid( {pos:vec(x-D/2,y,0), size:D*vec(1,1,1)} )
    }
    c.index = index
    c.shininess = 0
    c.texture = {file:T, bumpmap:B}
    labels.push(label( {pos:vec(x,y-.5,0), box:0, text:'textures.'+names[index]} ))
}

function start_setup() {
    scene.range = 2.2
    scene.fov = 0.2
    scene.center = vec(1.5,2,0)
    scene.forward = vec(0,0,-1)
    erase()
    scene.visible = false
    var index = 0
    for (var y=3.3; y>0; y-=1.3) {
        for (var x=0; x<4; x++) {
            if (index >= names.length) break; 
            show_object(index, x, y)
            index += 1
        }
    }
}

function end_setup() {
    scene.visible = true
    $('#message').text('Click an object to enlarge it.')
}

function setup() {
    start_setup()
    end_setup()
}

start_setup()
scene.caption.text("Loading textures...")
scene.waitfor("textures",wait)
scene.caption.text("")

var choose = $("<div>Change the type of object: </div>").appendTo(scene.caption)

// Create a drop-down menu (a "select" object). Set up the options to appear:
var s = ""
s += "<option select=selected>box</option>"
s += "<option>sphere</option>"
s += "<option>cylinder</option>"
s += "<option>cone</option>"
s += "<option>pyramid</option>"

$('<select/>').html(s).css({font:"sans"})
    .change(function() { // come here when a change is made in the menu choice
        show = $(this).val()
    })
.appendTo(choose)

$('<p id=message></p>').appendTo(scene.caption)
end_setup()

var hit = null
var clicked = false
scene.bind("click", function () {
    hit = scene.mouse.pick()
    clicked = true
})

function single_object(index) {
    scene.center = vec(0,-.1*R,0)
    scene.range = 1.5*R
    erase()
    show_object(index, 0, 0)
    $('#message').text('Click anywhere to see all textures.')
}

var picked = null
    
while (true) {
    rate(30,wait)
    if (show != last_show) {
        last_show = show
        if (picked !== null) {
            single_object(picked.index)
        } else setup()
    }
    if (clicked) {
        clicked = false
        if (picked !== null) {
            picked = null
            setup()
        } else if (picked === null && hit !== null) {
            picked = hit
            hit = null
            single_object(picked.index)
        }
    }
}