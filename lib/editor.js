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

var wmargin = 40 // from right edge of text to right edge of window
var hmargin = 50 // from bottom of text to bottom of window
var numberwidth = 50 // width of line number area

var GSedit = {linenumbersarea:null, editarea: null, readonly:true, source:null, change:null}

GSedit.getValue = function () { return GSedit.editarea.val() }

GSedit.init = function(placement, source, readonly) {
	GSedit.readonly = readonly
	var w = window.innerWidth - wmargin
	var h = window.innerHeight -hmargin
	GSedit.linenumbersarea = $('<textarea id=linenumbers></textarea>').appendTo($(placement)).css('font-family', 
		'monospace').css('overflow', 'hidden').css('font-size', '13px').css('float',
		'left').css('width', numberwidth).css('height', h).css('resize', 'none').css('text-align',
		'right').css('padding-right', '5px').css('background-color', '#EEEEEE').css('border',
		'0').css('outline-width', '0').css('line-height', '15px')
	GSedit.linenumbersarea.attr('readonly', true)
	var info = $(placement).append('<div></div>')
	GSedit.editarea = $('<textarea id=edit wrap="off" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>').appendTo(info).css('font-family', 
	    'monospace').css('font-size', '13px').css('width', w).css('height', h).css('resize', 
		'none').css('border', '0').css('outline', 'none').css('line-height', '15px')
	GSedit.linenumbersarea.val('1')
	GSedit.editarea.val(source)
	GSedit.editarea.attr('readonly', GSedit.readonly)
	GSedit.editarea[0].addEventListener('keyup', GScheck)
	GSresize()
	GSupdate()
	
	GSedit.editarea.scroll( function(){ // when the program text scrolls, scroll the line numbers
		GSedit.linenumbersarea.scrollTop(editarea[0].scrollTop) // adjust line number display
	});
}

var GSresize = function() { // readjust the width and height of the textareas
	var w = window.innerWidth - wmargin - numberwidth
	var h = window.innerHeight -hmargin
	GSedit.editarea.css('width', w).css('height', h)
	GSedit.linenumbersarea.css('height', h)
}

$(window).resize(function () {
	if (navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) GSresize()
})

var GSupdate = function() { // update the display of line numbers if necessary
	var lines = GSedit.editarea.val().split('\n').length
	var numbers = GSedit.linenumbersarea.val().split('\n').length
	var s = ''
	if (lines != numbers) {
		if (lines > numbers) {
			for (var i=numbers; i<lines; i++) s += '\n'+(i+1)
			GSedit.linenumbersarea.val(GSedit.linenumbersarea.val()+s)
		} else {
			s = '1'
			for (var i=1; i<lines; i++) s += '\n'+(i+1)
			GSedit.linenumbersarea.val(s)
		}
		GSedit.linenumbersarea.scrollTop(GSedit.editarea[0].scrollTop) // adjust line number display
	}
}

var GScheck = function() { // check whether we might need to update the display of line numbers
	var c = window.event.keyCode
	if (c == 86) GSupdate() // could be CTRL-V for paste
	else if (c < 32) GSupdate() // could be Backspace or Delete
	if (GSedit.change) GSedit.change() // GS.change is set in ide.js
}

