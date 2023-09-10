from vpython import *
# Create a simple scrolling text object
scene.width = scene.height = 250
scene.title = 'This is a test'
B = box(pos=vec(0.1,0.2,0))

# Create a textarea element on the web page, below the box object.
# $ stands for jQuery, an important web page addition to JavaScript.
# The string \n represents a carriage return.
T = $('<textarea/>').val('Click above.\n').appendTo(scene.caption_anchor).css('width', '250px').css('height', '90px').css('font-family', 'sans-serif').css('font-size', '14px')

scene.waitfor('click')
# T.val() represents the current contents of the textarea; add to it:
T.val(T.val()+'B.pos = '+B.pos+'\n')
T.val(T.val()+'Type more text here and a scroll bar will appear.\n')

s = ''
$('<input placeholder="What is your name?"/>').appendTo($('body')).keypress(def (e):
    global s
    if String.fromCharCode(e.keyCode) == '\r': # '\r' is a carriage return ("Enter")
        s = $(this).val()
        $(this).hide()
        scene.trigger('input')
)

scene.waitfor('input')
print_options(width=250)
print('Your name is',s+'.')