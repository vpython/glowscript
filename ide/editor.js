"use strict";

/*
A simple program editor, inspired by http://alan.blog-city.com/jquerylinedtextarea.htm
and by the behavior and appearance of the Ace editor, http://ace.c9.io.
At the time of writing, Ace was used by GlowScript but did not work on mobile devices.

Bruce Sherwood, August 2015, for the GlowScript project (glowscript.org).
Feel free to do anything whatsoever with this editor.

The basic idea is to place a textarea on the left containing line numbers,
aligned with a textarea on the right containing the user program. Changes
in the height of the window change the height of the line number textarea,
and changes in the width or height of the window change the width and height
of the program area to maximize its use of the full window. Line numbers are
displayed only for as many lines as there are in the program; this is
achieved by listening for keyup events and making adjustments if needed. 

*/

var linenumbersarea, editarea
var wmargin = 40 // from right edge of text to right edge of window
var hmargin = 50 // from bottom of text to bottom of window
var numberwidth = 50 // width of line number area

window.onload = function() {
	var w = window.innerWidth - wmargin
	var h = window.innerHeight -hmargin
	linenumbersarea = $('<textarea id=linenumbers></textarea>').appendTo($('body')).css('font-family', 
		'monospace').css('overflow', 'hidden').css('font-size', '13px').css('float',
		'left').css('width', numberwidth).css('height', h).css('resize', 'none').css('text-align',
		'right').css('padding-right', '5px').css('background-color', '#EEEEEE').css('border',
		'0').css('outline-width', '0').css('line-height', '15px')
	linenumbersarea.attr('readonly', true)
	var info = $('body').append('<div></div>')
	editarea = $('<textarea id=edit wrap="off" spellcheck="false"></textarea>').appendTo(info).css('font-family', 
	    'monospace').css('font-size', '13px').css('width', w).css('height', h).css('resize', 
		'none').css('border', '0').css('outline', 'none').css('line-height', '15px')
	linenumbersarea.val('1')
	var s = 'GlowScript 1.1 VPython\n'
	editarea.val(s)
	resize()
	update()
	
	editarea.scroll( function(){ // when the program text scrolls, scroll the line numbers
		linenumbersarea.scrollTop(editarea[0].scrollTop) // adjust line number display
	});
}

var resize = function() { // readjust the width and height of the textareas
	var w = window.innerWidth - wmargin - numberwidth
	var h = window.innerHeight -hmargin
	editarea.css('width', w).css('height', h)
	linenumbersarea.css('height', h)
}

$(window).resize(function () {
	resize()
})

var update = function() { // update the display of line numbers if necessary
	var lines = editarea.val().split('\n').length
	var numbers = linenumbersarea.val().split('\n').length
	var s = ''
	if (lines != numbers) {
		if (lines > numbers) {
			for (var i=numbers; i<lines; i++) s += '\n'+(i+1)
			linenumbersarea.val(linenumbersarea.val()+s)
		} else {
			s = '1'
			for (var i=1; i<lines; i++) s += '\n'+(i+1)
			linenumbersarea.val(s)
		}
		linenumbersarea.scrollTop(editarea[0].scrollTop) // adjust line number display
	}
}

var check = function() { // check whether we might need to update the display of line numbers
	var c = window.event.keyCode
	if (c == 86) update() // could be CTRL-V for paste
	else if (c < 32) update() // could be Backspace or Delete
}

this.addEventListener('keyup', check)
