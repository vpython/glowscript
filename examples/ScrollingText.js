GlowScript 1.0
/* Create a simple scrolling text object */
// A simpler syntax for this may be implemented in the future in GlowScript.
scene.width = scene.height = 250
var B = box({pos:vec(0.1,0.2,0)})

// Create a textarea element on the web page, below the box object.
// $ stands for jQuery, an important web page addition to JavaScript.
// The string \n represents a carriage return.
var T = $('<textarea/>').val('Click above.\n').appendTo(scene.caption)
    .css('width', '250px') // minimum width in pixels
    .css('height', '80px') // minimum height in pixels

scene.pause(wait)
// T.val() represents the current contents of the textarea; add to it:
T.val(T.val()+'B.pos = '+B.pos.toString()+'\n')
T.val(T.val()+'Type more text here and a scroll bar will appear.\n')