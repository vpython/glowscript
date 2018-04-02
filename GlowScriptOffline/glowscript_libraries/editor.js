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

var wmargin = 50 // from right edge of text to right edge of window
var hmargin = 50 // from bottom of text to bottom of window
var numberwidth = 50 // width of line number area
var initialized = false
var original

var GSedit = {linenumbersarea:null, editarea: null, readonly:true, source:null, change:null}

GSedit.getValue = function () { return GSedit.editarea.val() }

GSedit.setValue = function (source) {
	GSedit.editarea.val(source)
	original = GSedit.editarea.val() // important to save in the form it has in the textarea, else GSedit.changed() fails
	GSupdate()
	GSedit.editarea.scrollTop(0)
}

GSedit.changed = function () {
	var changed = GSedit.editarea.val() != original // for a large program (Stonehenge) this takes either 0 time or 0.1 millisecond
	if (!changed) window.onbeforeunload = undefined
	return changed
}

GSedit.setwidth = function(w) { // w is the width used by the program text; affected by dragging divider between text and display
	GSedit.editarea.css('width', w-numberwidth-wmargin)
}

GSedit.init = function(placement, source, width, readonly) {
	window.onbeforeunload = undefined
	GSedit.readonly = readonly
	var w = width-numberwidth-wmargin
	var h = window.innerHeight -hmargin
	GSedit.linenumbersarea = $('<textarea id=linenumbers></textarea>').appendTo($(placement)).css('font-family', 
		'monospace').css('overflow', 'hidden').css('font-size', '13px').css('float',
		'left').css('width', numberwidth).css('height', h).css('resize', 'none').css('text-align',
		'right').css('padding-right', '5px').css('background-color', '#EEEEEE').css('border',
		'0').css('outline-width', '0').css('line-height', '15px')
	GSedit.linenumbersarea.attr('readonly', true)
	var info = $(placement).append('<div></div>')
	GSedit.editarea = $('<textarea id=edit wrap="off" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>').appendTo(info).css('font-family', 
	    'monospace').css('font-size', '13px').css('width', w).css('height', h).css('border', '0').css('outline', 'none').css('line-height', '15px')
	GSedit.linenumbersarea.val('1')
	GSedit.editarea.val(source)
	original = GSedit.editarea.val() // important to save in the form it has in the textarea, else GSedit.changed() fails
	GSedit.editarea.attr('readonly', GSedit.readonly)
	GSedit.editarea[0].addEventListener('keyup', GScheck)
	GSedit.editarea[0].addEventListener('cut', GScutpaste)
	GSedit.editarea[0].addEventListener('paste', GScutpaste)
	var end = source.indexOf('\n')+1 // position cursor at start of line 2, below GlowScript header
	GSedit.editarea[0].setSelectionRange(end,end)
	GSedit.editarea[0].focus()
	GSupdate()
	GSedit.editarea.scrollTop(0)
	
	GSedit.editarea.scroll( function(){ // when the program text scrolls, scroll the line numbers
		GSedit.linenumbersarea.scrollTop(GSedit.editarea[0].scrollTop) // adjust line number display
	});
	initialized = true
	$('#edit').on('keydown', function(e) {
		var keyCode = e.keyCode || e.which
		if (keyCode == TAB) {
			if (e.shiftKey) SHIFT = true
			e.preventDefault()
		}
	})
	setTimeout(updatechange, 200) // 200 ms is much longer than the time to execute GSedit.changed()
}

var updatechange = function() {
	GSedit.changed()
	setTimeout(updatechange, 200) // maintain the changed status so that quitting the browser can avoid issuing needless warnings
}


var GSresize = function(w) { // readjust the width and height of the textareas
	GSedit.editarea.css('width', w-numberwidth-wmargin)
	var h = window.innerHeight -hmargin
	GSedit.editarea.css('height', h)
	GSedit.linenumbersarea.css('height', h)
}

var GScutpaste = function() {
	window.onbeforeunload = Quit // ensure giving a warning when quitting the browser or browser tab
	setTimeout(function(){GSupdate(), 10}) // the cut or paste hasn't happened yet; delay GSupdate
}

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

var ENTER =     13   // Enter
var BACK  =      8   // Backspace
var DEL   =     46   // Delete
//var SHIFT =     16   // Shiftkey
var CTRL  =     17   // Ctrl
var COMMENT =  191   // Crtl-/
var TAB   =      9   // Tab
var SHIFT = false // true if Shift-Tab

var INDENTLENGTH = 4
var INDENT = '    ' // four spaces for an indent

var GScheck = function() { // handle indentation; check whether we might need to update the display of line numbers
	window.onbeforeunload = Quit // ensure giving a warning when quitting the browser or browser tab
	
	var indenting = function(text, cursor) { // create indent depending on next line
		var startspaces = /([\ ]*)/
		var endcolon = /:[\ ]*$/
		var thisline = '', spaces, indent
		for (var n=cursor-2; text[n] != '\n' && n !== 0; n--) thisline = text[n]+thisline // up to the newly inserted newline
		var thisindent = thisline.match(startspaces)[0]
		if (thisline.match(endcolon) !== null) { // there is an ending colon, such as "while True:" or "if x: y = 5"
			var endline = ''
			for (n=cursor+1; text[n] != '\n' && n < text.length; n++) endline += text[n] // accumulate current line after cursor
			indent = 4 // default
			var s = text.slice(n+1)
			var spaces = s.match(startspaces)[0]
			if (spaces.length > 0) indent = spaces.length
			else spaces = '    ' // default
		} else {
			spaces = thisindent
			indent = thisindent.length
		}
		if (indent > 0) {
			GSedit.editarea.val(text.slice(0,cursor)+spaces+text.slice(cursor))
			GSedit.editarea[0].setSelectionRange(cursor+indent,cursor+indent)
		}
	}
	
	var c = window.event.keyCode
	if (c == ENTER || c == BACK || c == DEL) {
		var cursor = GSedit.editarea[0].selectionStart
		if (c == ENTER) { // the newline character has already been inserted at the location given by cursor
			var text = GSedit.editarea.val()
			indenting(text, cursor)
		}
		GSupdate()
	} else if (c == TAB || c == COMMENT) {
		var start = GSedit.editarea[0].selectionStart
		var end   = GSedit.editarea[0].selectionEnd
		var text  = GSedit.editarea.val()
		while (start > 0 && text[start] != '\n') start--
		if (start > 0) start++
		if (c == TAB) { // indent or exdent
			while (true) {
				if (SHIFT && start+INDENTLENGTH < text.length && text.slice(start,start+INDENTLENGTH) == INDENT) {
					text = text.slice(0,start)+text.slice(start+INDENTLENGTH)
					end -= INDENTLENGTH
				} else {
					text = text.slice(0,start)+INDENT+text.slice(start)
					end += INDENTLENGTH
				}
				var next = text.slice(start).indexOf('\n') // find next newline
				if (next < 0) break
				start += next+1
				if (start >= end) break
			}
			SHIFT = false
			GSedit.editarea.val(text)
			GSupdate()
		} else if (c == COMMENT) { // toggle commenting
			var n = text.indexOf('\n')
			if (n > 0) {
				var firstline = text.slice(0,n)
				var insert = '//'
				var length = 2
				if (firstline.indexOf('yth') > 0 || firstline.indexOf('pyd') > 0) { // Python or RapydScript
					insert = '#'
					length = 1
				}
				while (true) {
					if (text.slice(start,start+length) == insert) {
						text = text.slice(0,start)+text.slice(start+length)
						end -= length
					} else {
						text = text.slice(0,start)+insert+text.slice(start)
						end += length
					}
					var next = text.slice(start).indexOf('\n') // find next newline
					if (next < 0) break
					start += next+1
					if (start >= end) break
				}
				GSedit.editarea.val(text)
				GSupdate()
			}
		}
	}
}

