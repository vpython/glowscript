"use strict";

var linenumbersarea, editarea
var wmargin = 100
var hmargin = 50

window.onload = function init() {
	var w = window.innerWidth - wmargin
	var h = window.innerHeight -hmargin
	linenumbersarea = $('<textarea id=linenumbers></textarea>').appendTo($('body')).css('font-family', 
		'Verdana', 'Sans-Serif').css('overflow', 'hidden').css('font-size', '10pt').css('float',
		'left').css('width', '50px').css('height', h).css('resize', 'none').css('text-align',
		'right').css('padding-right', '5px').css('background-color', '#EEEEEE').css('border',
		'0').css('outline-width', '0')
	linenumbersarea.attr('readonly', true)
	var info = $('body').append('<div></div>')
	editarea = $('<textarea id=edit wrap="off"></textarea>').appendTo(info).css('font-family', 'Verdana', 
	    'Sans-Serif').css('font-size', '10pt').css('width', w).css('height', h).css('resize', 
		'none').css('border', '0').css('outline', 'none')
	linenumbersarea.val('1')
	var s = 'GlowScript 1.1 VPython\n'
	editarea.val(s)
	update()
}

$(window).resize(function () {
	var w = window.innerWidth - wmargin
	var h = window.innerHeight -hmargin
	editarea.css('width', w).css('height', h)
	linenumbersarea.css('height', h)
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

this.addEventListener('keyup', update)
