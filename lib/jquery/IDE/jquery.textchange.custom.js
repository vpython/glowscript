/*!
 * jQuery TextChange Plugin
 * http://www.zurb.com/playground/jquery-text-change-custom-event
 *
 * Copyright 2010, ZURB
 * Released under the MIT License
 *
 * Edited and updated for use with jQuery 1.11+ by Adam Thompson
 * bind -> on, unbind -> off
 */
(function ($) {
	
	$.event.special.textchange = {
		
		setup: function (data, namespaces) {
		  $(this).data('lastValue', this.contentEditable === 'true' ? $(this).html() : $(this).val());
			$(this).on('keyup.textchange', $.event.special.textchange.handler);
			$(this).on('cut.textchange paste.textchange input.textchange', $.event.special.textchange.delayedHandler);
		},
		
		teardown: function (namespaces) {
			$(this).off('.textchange');
		},
		
		handler: function (event) {
			$.event.special.textchange.triggerIfChanged($(this));
		},
		
		delayedHandler: function (event) {
			var element = $(this);
			setTimeout(function () {
				$.event.special.textchange.triggerIfChanged(element);
			}, 25);
		},
		
		triggerIfChanged: function (element) {
		  var current = element[0].contentEditable === 'true' ? element.html() : element.val();
			if (current !== element.data('lastValue')) {
				element.trigger('textchange',  [element.data('lastValue')]);
				element.data('lastValue', current);
			}
		}
	};
	
	$.event.special.hastext = {
		
		setup: function (data, namespaces) {
			$(this).on('textchange', $.event.special.hastext.handler);
		},
		
		teardown: function (namespaces) {
			$(this).off('textchange', $.event.special.hastext.handler);
		},
		
		handler: function (event, lastValue) {
			if ((lastValue === '') && lastValue !== $(this).val()) {
				$(this).trigger('hastext');
			}
		}
	};
	
	$.event.special.notext = {
		
		setup: function (data, namespaces) {
			$(this).on('textchange', $.event.special.notext.handler);
		},
		
		teardown: function (namespaces) {
			$(this).off('textchange', $.event.special.notext.handler);
		},
		
		handler: function (event, lastValue) {
			if ($(this).val() === '' && $(this).val() !== lastValue) {
				$(this).trigger('notext');
			}
		}
	};	

})(jQuery);