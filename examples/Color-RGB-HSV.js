GlowScript 1.0
scene.userzoom = false
scene.userspin = false
scene.width = scene.height = 200
scene.range = 1
box({pos:vec(10,0,0)}) // Force creation of canvas; box is not seen

var C = ['Red', 'Green', 'Blue', 'Hue', 'Saturation', 'Value']

for (var i=0; i<6; i++) {
    scene.caption.append(C[i]) // Display slider name
    scene.caption.append("<p id='"+C[i]+"'></p>") // Make slider container
        .css({width:"180px", margin:"10px"})
    if (i == 2) scene.caption.append("\n\n\n") // Separate the RGB and HSV sliders
}

// set_rgb prevents propagation of changing RGB changing HSV changing RGB ....
var set_rgb = null // true if RGB changed, false if HSV changed, else null

function set_background() {
    var s = [], rgb, hsv
    for (var i=0; i<6; i++) { // Get values for all 6 sliders
        s[i] = $( "#"+C[i] ).slider( "value" )
    }
    if (set_rgb) {
        rgb = vec(s[0],s[1],s[2])
        hsv = color.rgb_to_hsv(rgb)
        $( "#"+C[3] ).slider( "value", hsv.x) // reset HSV slider positions
        $( "#"+C[4] ).slider( "value", hsv.y)
        $( "#"+C[5] ).slider( "value", hsv.z)
    } else {
        hsv = vec(s[3],s[4],s[5])
        rgb = color.hsv_to_rgb(hsv)
        $( "#"+C[0] ).slider( "value", rgb.x) // reset RGB slider positions
        $( "#"+C[1] ).slider( "value", rgb.y)
        $( "#"+C[2] ).slider( "value", rgb.z)
    }
    scene.background = vec(s[0],s[1],s[2])
    // For readability, limit precision of display of quantities to 3 figures
    // The function toFixed() generates a string which must be converted to a floating point quantity
    rgb = vec(parseFloat(rgb.x.toFixed(3)),parseFloat(rgb.y.toFixed(3)),parseFloat(rgb.z.toFixed(3)))
    hsv = vec(parseFloat(hsv.x.toFixed(3)),parseFloat(hsv.y.toFixed(3)),parseFloat(hsv.z.toFixed(3)))
    scene.title.text("RGB = "+rgb.toString()+"\nHSV = "+hsv.toString())
    set_rgb = null
}

function which(choose) { // true if RGB slider changed, else HSV slider changed
    if (set_rgb === null) {
        set_rgb = choose
        set_background()
    }
}

// Create RGB sliders; the string is "#Red, #Green, #Blue'
$(function() { $( '#'+C[0]+',#'+C[1]+',#'+C[2] ).slider({
    orientation: "horizontal",
    range: "min",
    min: 0,
    max: 1,
    value: 0,
    step: 0.01,
	slide: function() {which(true)},
    change: function() {which(true)}
})})

// Create HSV sliders; the string is "#Hue, #Saturation, #Value'
$(function() { $( '#'+C[3]+',#'+C[4]+',#'+C[5] ).slider({
    orientation: "horizontal",
	range: "min",
    min: 0,
	max: 1,
	value: 0,
    step: 0.01,
    slide: function() {which(false)},
    change: function() {which(false)}
})})

$( "#"+C[0] ).slider( "value", 1) // Start with pure red