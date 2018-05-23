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
	GSedit.editarea[0].focus()
    setTimeout(setcursor0, 30)
}

var setcursor0 = function() {
    GSedit.editarea[0].setSelectionRange(0,0)
}

GSedit.isPython = function() { // return true if vpython or rapydscript; false if javascript
	var cr = GSedit.editarea.val().search('\n')
	if (cr < 0) return true
	var elements = GSedit.editarea.val().slice(0,cr).split(" ")
	if (elements[0] != 'GlowScript') return true
	if (elements.length == 3) {
	    return (elements[2].toLowerCase() != 'javascript')
	} else {
		return false // the case of "GlowScript X.Y"
	}
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
	GSedit.editarea[0].addEventListener('keydown', GScheck)
	GSedit.editarea[0].addEventListener('keyup', GSkeyup)
	GSedit.editarea[0].addEventListener('cut', GScutpaste)
	GSedit.editarea[0].addEventListener('paste', GScutpaste)
	var end = source.length
	GSedit.editarea[0].setSelectionRange(end,end)
	GSedit.editarea[0].focus()
	GSupdate()
	GSedit.editarea.scrollTop(0)
	
	GSedit.editarea.scroll( function(){ // when the program text scrolls, scroll the line numbers
		GSedit.linenumbersarea.scrollTop(GSedit.editarea[0].scrollTop) // adjust line number display
	});
	initialized = true
    $('#edit').on('keydown', function(e) { 
    	// Prevent TAB from moving among elements of the web page and
    	// prevent ctrl-1 or ctrl-2 from moving to a different browser tab
		if (e.keyCode == TAB) e.preventDefault()
		else if (ctrldown && (e.keyCode == 49 || e.keyCode == 50)) e.preventDefault() // 1 and 2 are keyCode 49 and 50
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
var SHIFT =     16   // Shiftkey
var CTRL  =     17   // Ctrl
var SLASH =    191   // /
var TAB   =      9   // Tab

var shiftdown = false
var ctrldown = false

var INDENTLENGTH = 4
var INDENT = '    ' // four spaces for an indent

var GSkeyup = function(key) { // keyup events
    var keycode = key.keyCode
    if (keycode == SHIFT) shiftdown = false
    else if (keycode == CTRL) ctrldown = false
}

var GScheck = function(key) { // keydown events
    var keycode = key.keyCode
	window.onbeforeunload = Quit // ensure giving a warning when quitting the browser or browser tab
	
	var indenting = function(text, cursor) { // create indent depending on line preceding the ENTER event
        if (cursor < 2) return // at or next to the start of the program; note n=cursor-2 below
        var startspaces = /([\ ]*)/
		var endchar = GSedit.isPython() ? /:$/ : /{$/
		var thisline = '', spaces, indent
		for (var n=cursor-1; text[n] != '\n' && n >= 0; n--) thisline = text[n]+thisline
		var spaces = thisline.match(startspaces)[1]
        if (thisline.match(endchar) !== null) { // there is an ending colon or {, such as "while True:" or "if (...) {"
        	spaces += INDENT
		} 
		if (spaces.length > 0) {
			var extra = ''
			if (text.length > cursor) extra = text.slice(cursor+1)
			GSedit.editarea.val(text.slice(0,cursor)+'\n'+spaces+extra)
            startcursor = endcursor = cursor+spaces.length+1
            resetCursor() // Don't know why we need to call resetCursor twice, but we do have to. Sigh.
            setTimeout(resetCursor, 0)
		}
	}
    
    var startcursor
    var endcursor
    var resetCursor = function() {
        GSedit.editarea[0].focus()
        GSedit.editarea[0].setSelectionRange(startcursor,endcursor)
    }
	
    if (keycode == SHIFT) {
        shiftdown = true
    } else if (keycode == CTRL) { // should enable Ctrl-1 and Ctrl-2 to run
        ctrldown = true
    } else if (ctrldown && (keycode == 49 || keycode == 50)) { // Ctrl-1 or Ctrl-2 should run the program
        runCode()
	} else {
        if (keycode == ENTER || keycode == BACK || keycode == DEL) {
            var cursor = GSedit.editarea[0].selectionStart
            if (keycode == ENTER) { // the newline character has already been inserted at the location given by cursor
                var text = GSedit.editarea.val()
                indenting(text, cursor)
            }
            GSupdate()
        } else if (keycode == TAB || (ctrldown && keycode == SLASH)) {
            var start = GSedit.editarea[0].selectionStart
            var end   = GSedit.editarea[0].selectionEnd
            var start0 = start
            var text  = GSedit.editarea.val()
            while (start > 0 && text[start] != '\n') start--
            if (start > 0) start++
            if (keycode == TAB) { // indent or exdent
                if (start === end+1 && start >0 && text[start-1] == '\n') { // cursor at end of a line; last character is at text[start-2]
                    // Odd that when the cursor is at the end of a line, start == end+1.
                    GSedit.editarea.val(text.slice(0,start-1)+INDENT+text.slice(start-1))
                    startcursor = endcursor = end+INDENTLENGTH
                    setTimeout(resetCursor, 0) // experimentally, can't correctly update cursor position here
                    return
                }
                while (true) {
                    if (shiftdown) { 
                        if (start+INDENTLENGTH < text.length && text.slice(start,start+INDENTLENGTH) == INDENT) {
                            if (text.charAt(start) == ' ') {
                                text = text.slice(0,start)+text.slice(start+INDENTLENGTH)
                                end -= INDENTLENGTH
                            }
                        }
                    } else {
                        text = text.slice(0,start)+INDENT+text.slice(start)
                        end += INDENTLENGTH
                    }
                    var next = text.slice(start).indexOf('\n') // find next newline
                    if (next < 0) break
                    start += next+1
                    if (start >= end) break
                }
                GSedit.editarea.val(text)
                GSupdate()
                endcursor = end
                startcursor = (shiftdown) ? start0-INDENTLENGTH : start0+INDENTLENGTH
                setTimeout(resetCursor, 0) // experimentally, can't correctly update cursor position here
            } else { // toggle commenting
                var n = text.indexOf('\n')
                if (n > 0) {
                    var insert = '//'
                    var length = 2
                    if (GSedit.isPython()) { // Python or RapydScript
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
                    startcursor = start0+1
                    endcursor = end
                    setTimeout(resetCursor, 0) // experimentally, can't correctly update cursor position here
                }
            }
        }
	}
}

