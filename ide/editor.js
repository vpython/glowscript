"use strict";

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
		'0').css('outline-width', '0')
	linenumbersarea.attr('readonly', true)
	var info = $('body').append('<div></div>')
	editarea = $('<textarea id=edit wrap="off" spellcheck="false"></textarea>').appendTo(info).css('font-family', 
	    'monospace').css('font-size', '13px').css('width', w).css('height', h).css('resize', 
		'none').css('border', '0').css('outline', 'none')
	linenumbersarea.val('1')
	var s = 'GlowScript 1.1 VPython\n'
	editarea.val(s)
	resize()
	update()
	
	/* React to the scroll event; see http://alan.blog-city.com/jquerylinedtextarea.htm */
	editarea.scroll( function(){
		var domTextArea		= editarea[0];
		var scrollTop 	 = domTextArea.scrollTop;
		var clientHeight = domTextArea.clientHeight;
		//codeLinesDiv.css( {'margin-top': (-1*scrollTop) + "px"} );
		//lineNo = fillOutLines( codeLinesDiv, scrollTop + clientHeight, lineNo );
	});
}

var resize = function() {
	var w = window.innerWidth - wmargin - numberwidth
	var h = window.innerHeight -hmargin
	editarea.css('width', w).css('height', h)
	linenumbersarea.css('height', h)
}

$(window).resize(function () {
	resize()
})

var update = function() {
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
	}
}

var check = function() {
	var c = window.event.keyCode
	if (c == 86) update() // could be CTRL-V for paste
	else if (c < 32) update() // could be Backspace or Delete
}

this.addEventListener('keyup', check)
