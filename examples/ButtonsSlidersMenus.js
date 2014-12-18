GlowScript 1.0
scene.width = 350
scene.height = 300
scene.range = 1.5
scene.title.text("Buttons, Sliders, and Drop-down Menus\n")
// The buttons and drop-down menu implemented here use jQuery; see jquery.com
// The slider uses jQuery UI; see jqueryui.com

var running = true

// Create a button, label it "Pause", append to scene.title,
//     and bind a click routine to it, using jquery instructions.
// $('<button/>') adds <button/> to the html web page.
// .text("Pause") inserts "Pause", creating <button>Pause</button>.
// .appendTo(scene.title) places the button after the existing text,
//      which ended with \n, a newline character, so the button
//      appears below the title.
// .click(...) specifies what to do when the user clicks the button.
// $(this) refers to this button, and .text(...) is used to change
//      the text of the button.
$('<button/>').text("Pause").appendTo(scene.title)
    .click( function() {
        running = !running
        if (running) $(this).text("Pause") 
        else $(this).text("Run")
    })

var box_object = box({visible:true})
var cone_object = cone({visible:false})
var pyramid_object = pyramid({visible:false})
var cylinder_object = cylinder({visible:false})

var col = color.cyan
var currentobject = box_object
currentobject.color = col

// Create another button, label it "red" in red color with cyan background,
// append to scene.title, and bind a click routine to it:
$('<button/>').text("red").appendTo(scene.title)
    .css({color:"red", backgroundColor:"cyan", fontWeight:"bold"})
    .click( function() {
        if (col == color.cyan) { // change to cyan on a red background
            currentobject.color = col = color.red
            $(this).text("cyan").css({color: "cyan", backgroundColor: "red"})
        } else {                 // change to red on a cyan background
            currentobject.color = col = color.cyan
            $(this).text("red").css({color: "red", backgroundColor: "cyan"})
        }
    })

scene.caption.text("Vary the rotation rate: ")
var speed = 150

function setspeed() {
    speed = $("#speed_slider").slider("value")
}

// By default, a slider is placed horizontally.
// If you want a vertical slider, change "width" to "height" in .css(...)
// and in the function specify orientation:vertical.
$('<div id="speed_slider"></div>').appendTo(scene.caption)
    .css({width:"350px"}) // specify height if vertical orientation
$(function() { $("#speed_slider").slider( {
        // orientation: vertical, // to make a vertical slider
        value: 250, 
        min: 20, 
        max: 500,
        range:"min", // color fills left portion of slider
        slide: function() {setspeed()},
        change: function() {setspeed()}
    }) 
})

// Place text below the slider:
var choose = $("<p>Change the object: </p>").appendTo(scene.caption)

// Create a drop-down menu (a "select" object). Set up the options to appear:
var s = ""
s += "<option select=selected>box</option>"
s += "<option>cone</option>"
s += "<option>pyramid</option>"
s += "<option>cylinder</option>"

$('<select/>').html(s).css({font:"sans"})
    .change(function() { // come here when a change is made in the menu choice
            var currentaxis = currentobject.axis
            currentobject.visible = false
        switch ($(this).val()) {
            case "box": 
                currentobject = box_object
                break;
            case "cone": 
                currentobject = cone_object
                break;
            case "pyramid": 
                currentobject = pyramid_object
                break;
            case "cylinder": 
                currentobject = cylinder_object
                break;
        }
        currentobject.color = col
        currentobject.axis = currentaxis
        currentobject.visible = true
    })
    .appendTo(choose) // place drop-down menu beside the text, "Change the object: "

while (true) {
    rate(100,wait)
    if (running) {
        currentobject.rotate({angle:speed*1e-4, axis:vec(0,1,0)})
    }
}