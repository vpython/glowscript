;(function () {
    "use strict";
    
    function log10(val) {
        return Math.log(val)/Math.LN10
    }
    var eformat = false
    var nformat = 0
    var nmax = 0
    function format_number(val,axis) { // callback routine for formatting tick labels
        if (axis.ticks.length == 0) { // when the first tick of this axis is sent to this function
            var delta = axis.tickSize // axis.tickSize is interval between ticks
            var amin = axis.min, amax = axis.max // axis.min and axis.max are the ends of this axis
            var nticks = Math.floor((amax-amin)/delta+0.5)+1
            var vmax, test
            for (var i=0; i<nticks; i++) {
                test = abs(amin + i*delta)
                if (vmax === undefined || (test > vmax && test != 0)) vmax = test
            }
            nmax = Math.floor(log10(vmax))+1 // +3 for 100; -2 for 0.001
            var n = Math.floor(log10(delta))+1 // +3 for 100; -2 for 0.001
            if (n > 3) { // ok
                eformat = true
                nformat = n
            } else if (n > 0) { // ok
                eformat = false
                nformat = 0
            } else if (n < 0) {
                eformat = true
                nformat = n
                if (nmax >= 0) {
                    eformat = false
                    nformat = -n+1
                }
            } else {
                eformat = false
                nformat = 1
            }
        }
        if (val == 0) return '0'
        if (eformat) {
            var nf, nexp
            var mantissa = val*pow(10,-nformat+1)
            nf = 0
            nexp = nformat-1
            if (nmax > nformat) {
                mantissa *= .1
                nf += 1
                nexp += 1
            }
            return mantissa.toFixed(nf)+'e'+nexp
        } else {
            return val.toFixed(nformat)
        }
    }

    function graph(options) {
        if (!(this instanceof graph)) return new graph(options)
        if (options === undefined) options = {}
        this.graph_options = { series: { shadowSize:0 }, crosshair: { mode: "xy", color: "rgba(0,0,0,1)" } }
        this.__width = 640
        this.__height = 400
        this.__title = ''
        this.__plot = null
        this.__xmin = this.__xmax = this.__ymin = this.__ymax = null
        this.wrapper = $("<div/>")
        if (options.width !== undefined) {
            this.__width = options.width
            delete options.width
        }
        if (options.height !== undefined) {
            this.__height = options.height
            delete options.height
        }
        this.__align = 'none'
        if (options.align !== undefined) {
            this.__align = options.align
            delete options.align
        }
        this.graph_options.xaxis = {min:null, max:null, tickFormatter:format_number}
        this.graph_options.yaxis = {min:null, max:null, tickFormatter:format_number}
        if (options.title !== undefined) {
            this.__title = options.title
            delete options.title
        }
        
        this.__foreground = color.black
        this.__background = color.gray(0.95)
        if (options.foreground !== undefined) {
        	var v = options.foreground
        	if (!(v instanceof vec)) throw new Error("graph foreground must be a vector.")
            this.__foreground = v
            delete options.foreground
        }
        if (options.background !== undefined) {
        	var v = options.background
        	if (!(v instanceof vec)) throw new Error("graph background must be a vector.")
            this.__background = v
            delete options.background
        }
        this.graph_options.grid = { color: color.to_html(this.__foreground), backgroundColor: color.to_html(this.__background)}
        
        if (options.xmin !== undefined) {
            this.__xmin = this.graph_options.xaxis.min = options.xmin
            delete options.xmin
        }
        if (options.xmax !== undefined) {
            this.__xmax = this.graph_options.xaxis.max = options.xmax
            delete options.xmax
        }
        if (options.ymin !== undefined) {
            this.__ymin = this.graph_options.yaxis.min = options.ymin
            delete options.ymin
        }
        if (options.ymax !== undefined) {
            this.__ymax = this.graph_options.yaxis.max = options.ymax
            delete options.ymax
        }
        this.__logx = this.__logy = false
        if (options.logx !== undefined) {
            this.__logx = this.graph_options.logx = options.logx
            delete options.logx
        }
        if (options.logy !== undefined) {
            this.__logy = this.graph_options.logy = options.logy
            delete options.logy
        }
        if (this.__logx) {
            this.graph_options.xaxis.transform = function (v) { return log10(v) }
            this.graph_options.xaxis.inverseTransform = function (v) { return pow(10,v) }
        }
        if (this.__logy) {
            this.graph_options.yaxis.transform = function (v) { return log10(v) }
            this.graph_options.yaxis.inverseTransform = function (v) { return pow(10,v) }
        }
        var err = '', count = 0
        for (var attr in options) {
            count += 1
            err += attr+', '
        }
        if (err.length > 0) {
            if (count == 1) throw new Error(err.slice(0,err.length-2)+' is not an attribute of a graph')
            else throw new Error('These are not attributes of a graph: '+err.slice(0,err.length-2))
        }
        /*
        // Doesn't seem to make sense to capture other attributes.
        for (var id in options)
            this.options[id] = options[id]
        */

        graph.selected = this
        this.graph_series = []
        this.__activated = false // don't create the graph until/unless there are objects to put in it
    }
    property.declare(graph, {
        selected: { 
            get: function() { return window.__context.graph_selected || null },
            set: function(value) { window.__context.graph_selected = value } }
    })

    property.declare( graph.prototype, {
    	__activate: function () {
    		if (this.__activated) return
    		this.__activated = true
    		this.__activate = function() {}
            if (this.__title !== undefined && this.__title.length > 0) $("<div>"+this.__title+"</div>").appendTo(canvas.container)
            this.wrapper.addClass("glowscript-graph").css("width", this.__width).css("height", this.__height).appendTo( canvas.container )
            this.wrapper.css("float", this.__align)
            this.__update()
    	},
        __update: function() {
            var self = this
            window.requestAnimFrame( function() { self.__update.call(self) }, this.wrapper.get(0) )

            if (!this.changed) return
            var info = []
            for (var i = 0; i < this.graph_series.length; i++) {
                var thisseries = this.graph_series[i]
                if (thisseries.__visible) {
                    info.push(thisseries.options)
                    if (thisseries.__dot && thisseries.__type == 'line' && thisseries.options.data.length > 0) {
                        var dotdisplay = { points: { show: true } }
                        if (thisseries.__dot_radius !== null) dotdisplay.points.radius = thisseries.__dot_radius
                        else dotdisplay.points.radius = thisseries.__width+1
                        if (thisseries.__dot_color !== null) dotdisplay.color = color.to_html(thisseries.__dot_color)
                        else dotdisplay.color = color.to_html(thisseries.__color)
                        dotdisplay.points.fillColor = dotdisplay.color
                        dotdisplay.data = [thisseries.options.data[thisseries.options.data.length-1]]
                        info.push(dotdisplay)
                    }
                }
            }
            this.changed = false
            if (info.length == 0) return
            this.__plot = $.plot(this.wrapper, info, this.graph_options)
            this.__plot.draw()
            // These don't work to update the crosshair overlay machinery after a canvas update:
            //make_plot.drawOverlay()
            //make_plot.triggerRedrawOverlay()
        },
        add_to_graph: function (obj) {
            this.graph_series.push(obj)
        	if (obj.options.data.length > 0) this.__activate()
        },
        changed: false,
        remove: function() { this.wrapper.remove() }, // JavaScript forbids anything.delete(), so in preprocessing we change .delete to .remove
    	width: {
	        get: function () { return this.__width },
	        set: function (value) {
	                this.__width = value
	                this.wrapper.css('width', value)
	                var plot = $.plot(this.wrapper, [], this.graph_options)
	                plot.resize()
	                plot.setupGrid()
	                this.changed = true
	            }
    	},
		height: {
	        get: function () { return this.__height },
	        set: function (value) {
	                this.__height = value
	                this.wrapper.css('height', value)
	                var plot = $.plot(this.wrapper, [], this.graph_options)
	                plot.resize()
	                plot.setupGrid()
	                this.changed = true
	            }
		},
        align: {
        	get: function() { return this.__align },
        	set: function(value) {
        		if (value == 'left' || value == 'right' || value == 'none') {
        			this.__align = value
        		} else throw new Error("align must be 'left', 'right', or 'none' (the default).")
        	}
        },  
		title: {
	        get: function () { return this.__title },
	        set: function (value) {
	                this.__title = value
	                this.changed = true
	            }
	    },
	    xmin: {
	        get: function () { return this.__xmin },
	        set: function (value) {
	                this.__xmin = this.graph_options.xaxis.min = value
	                this.changed = true
	            }
	    },
	    xmax: {
	        get: function () { return this.__xmax },
	        set: function (value) {
	                this.__xmax = this.graph_options.xaxis.max = value
	                this.changed = true
	            }
	    },
	    ymin: {
	        get: function () { return this.__ymin },
	        set: function (value) {
	                this.__ymin = this.graph_options.yaxis.min = value
	                this.changed = true
	            }
	    },
	    ymax: {
	        get: function () { return this.__ymax },
	        set: function (value) {
	                this.__ymax = this.graph_options.yaxis.max = value
	                this.changed = true
	            }
	    },
	    logx: {
	        get: function () { return this.__logx },
	        set: function (value) {
	                if (this.__logx == value) return
	                if (value) {
	                    this.graph_options.xaxis.transform = function (v) { return log10(v) }
	                    this.graph_options.xaxis.inverseTransform = function (v) { return pow(10,v) }
	                } else {
	                    delete this.graph_options.xaxis.transform
	                    delete this.graph_options.xaxis.inverseTransform
	                }
	                this.__logx = value
	                this.changed = true
	            }
	    },
	    logy: {
	        get: function () { return this.__logy },
	        set: function (value) {
                if (this.__logy == value) return
                if (value) {
                    this.graph_options.yaxis.transform = function (v) { return log10(v) }
                    this.graph_options.yaxis.inverseTransform = function (v) { return pow(10,v) }
                } else {
                    delete this.graph_options.yaxis.transform
                    delete this.graph_options.yaxis.inverseTransform
                }
                this.__logy = value
                this.changed = true
            }
	    },
	    foreground: {
	        get: function () { return this.__foreground },
	        set: function (value) {
	        	if (!(value instanceof vec)) throw new Error("graph foreground color must be a vector.")
                if (this.__foreground.equals(value)) return
                this.__foreground = value
                this.graph_options.grid.color = color.to_html(value)
                this.changed = true
	         }
	    },
	    background: {
	        get: function () { return this.__background },
	        set: function (value) {
	        	if (!(value instanceof vec)) throw new Error("graph background color must be a vector.")
                if (this.__background.equals(value)) return
                this.__background = value
                this.graph_options.grid.backgroundColor = color.to_html(value)
                this.changed = true
	         }
	    }
    })

    // For converting from line, scatter, bar -> Flot lines, points, bars
    var type_to_flot_type = { line: "lines", scatter: "points", bar: "bars", __proto__:null }

    function gobject(options) {
        if (options === undefined) options = { data: [] }
        else if (options.data === undefined) options.data = []
        this.__color = vec(0,0,0)
        this.__label = null
        this.__delta = 1
        this.__width = 1
        this.__radius = 3
        this.__horizontal = false
        this.__dot = false
        this.__dot_color = null
        this.__dot_radius = null
        this.__data = []
        this.__xmin = null
        this.__xmax = null
        this.__ymin = null
        this.__ymax = null
        this.__interval = -1 // -1 signals no interval specified; 0 signals no plotting
        if (options.graph !== undefined) {
            this.__graph = options.graph
            delete options.graph
        } else if (options.gdisplay !== undefined) {
            this.__graph = options.gdisplay
            delete options.gdisplay
        } else {
            this.__graph = graph.selected
            if (!this.__graph) this.__graph = graph()
        }
        this.__type = 'line' // default type; others are 'scatter' and 'bar'
        if (options.type !== undefined) {
            this.__type = options.type
            delete options.type
        }
        var ftype = this.__ftype = type_to_flot_type[this.__type]
        if (!ftype) throw new Error("Unknown series type: " + this.__type)
        this.options = {} // build the flot options
        this.options.data = options.data
        delete options.data
        this.options[ftype] = { show: true, align: 'center', horizontal: false, barWidth: 1}
        if (this.__type == 'scatter') this.options.fill = 1
        else if (this.__type == 'bar') this.options.fill = 0.5
        else this.options.fill = 0
        if (options.horizontal !== undefined) {
            this.__horizontal = this.options[ftype].horizontal = options.horizontal
            delete options.horizontal
        }
        if (options.delta !== undefined) {
            this.__delta = this.options[ftype].barWidth = options.delta
            delete options.delta
        }
        if (options.width !== undefined) {
            this.__width = this.options[ftype].lineWidth = options.width
            delete options.width
        }
        
        if (options.color !== undefined) {
        	var c = options.color
        	if (!(c instanceof vec)) throw new Error("graph color must be a vector.")
            this.__color = c
            delete options.color
        }
        this.options.color = color.to_html(this.__color)
        // Note the odd necessity of different code for fillColor:
        if (this.__type == 'scatter') this.options[ftype].fillColor = this.options.color
        else this.options.fillColor = this.options.color
        
        if (options.radius !== undefined) {
            this.__radius = this.options[ftype].radius = options.radius
            delete options.radius
        }
        if (options.dot !== undefined) {
            this.__dot = options.dot
            delete options.dot
        }
        if (options.dot_color !== undefined) {
        	var v = options.dot_color
        	if (!(v instanceof vec)) throw new Error("graph dot_color must be a vector.")
            this.__dot_color = v
            delete options.dot_color
        }
        if (options.dot_radius !== undefined) {
            this.__dot_radius = options.dot_radius
            delete options.dot_radius
        }
        if (options.label !== undefined) {
            this.__label = this.options.label = options.label
            delete options.label
        }
        if (options.interval !== undefined) {
            this.__interval = options.interval
            this.__ninterval = options.interval
            delete options.interval
        }
        if (this.options.data.length > 0) this.__graph.changed = true
        this.__visible = true
        if (options.visible !== undefined) {
            this.__visible = options.visible
            delete options.visible
        }
        var err = '', count = 0
        for (var attr in options) {
            count += 1
            err += attr+', '
        }
        if (err.length > 0) {
            if (count == 1) throw new Error(err.slice(0,err.length-2)+' is not an attribute of a series')
            else throw new Error('These are not attributes of a graph object: '+err.slice(0,err.length-2))
        }
        /*
        // Doesn't seem to make sense to capture other attributes.
        for (var id in options) {
            this.options[ftype][id] = options[id]
        }
        */
        this.__graph.add_to_graph(this)
        
        this.remove = function() { // JavaScript forbids anything.delete(), so in preprocessing we change .delete to .remove
            this.__graph.changed = true
            this.options.data = []        	
        }
        
	     // Angus Croll: http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
	     // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
	     // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"
	
	     var toType = function(obj) { 
	         return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
	     }
	
	     var resolveargs = function(args) {
	         var v, ret
	         ret = []
	         if (toType(arguments[0]) == 'array') { // plot([x,y], [x,y])
	             if (toType(arguments[0][0]) != 'array') {
	                 for (var i=0; i<arguments.length; i++) {
	                     v = arguments[i]
	                     if (toType(v) == 'array' && v.length == 2) ret.push(v)
	                     else return null
	                 }
	             } else { // plot([ [x,y], [x,y] ]
	                 for (var i=0; i<arguments[0].length; i++) {
	                     v = arguments[0][i]
	                     if (toType(v) == 'array' && v.length == 2) ret.push(v)
	                     else return null
	                 }
	             }
	         }  else {
	             if (arguments.length == 2) return [ [arguments[0],arguments[1]] ] // plot(x,y
	             return null // plot(x) or plot(x,y,z)
	         }
	         return ret
	     }
	     
		  // Angus Croll: http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
		  // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
		  // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"
		
		  var toType = function(obj) { 
		      return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
		  }
		
		  var resolveargs = function(args) {
			  var v, ret
			  ret = []
			  if (toType(arguments[0][0]) != 'array') { // plot([x,y], [x,y])
			      for (var i=0; i<arguments.length; i++) {
			          v = arguments[i]
			          if (toType(v) == 'array' && v.length == 2) ret.push(v)
			          else return null
			      }
			  } else { // plot([ [x,y], [x,y] ]
			      for (var i=0; i<arguments[0].length; i++) {
			          v = arguments[0][i]
			          if (toType(v) == 'array' && v.length == 2) ret.push(v)
			          else return null
			          }
			      }
			      return ret
		  }

          this.plot = function (args) {
			  // Accept plot(x,y) or plot([x,y], [x,y], ...) or plot([[x,y], [x,y], ...]]) or plot(pos=[x,y]) etc.
        	  if (this.__interval === 0) return
        	  var data
 			  if (args.color !== undefined) throw new Error("Cannot currently change color in a plot statement.")
 			  if (args.pos !== undefined) data = resolveargs(args.pos)
 			  else if (toType(args) == 'array' && arguments.length == 1) data = resolveargs(args)
 			  else {
	 			  var a = []
	 			  for (var i=0; i<arguments.length; i++) a.push(arguments[i])
	 			  if (toType(a[0]) == 'array') data = resolveargs(a)
	 			  else data = resolveargs([a])
 			  }
			  if (data === null) throw new Error("Must be plot(x,y) or plot(pos=[x,y]) or plot([x,y]) or plot([x,y], ...) or plot([ [x,y], ... ])")
			  else {
				  if (this.__type != 'line') {
					  for (var i=0; i<data.length; i++) this.options.data.push(data[i])
				  } else { // for gcurve, eliminate points that are very close together
					  var pt, x, y, xscale, yscale, dx, dy, x1, x2, y1, y2
					  var g = this.__graph
					  var gxmin = g.__xmin
					  var gxmax = g.__xmax
					  var gymin = g.__ymin
					  var gymax = g.__ymax
					  if (this.options.data.length === 0) {
						  pt = data[0]
						  x = pt[0]
						  y = pt[1]
						  if (gxmin === null) this.__xmin = x
						  if (gxmax === null) this.__xmax = x
						  if (gymin === null) this.__ymin = y
						  if (gymax === null) this.__ymax = y
						  this.__lastx = 1e300 // force using this point
						  this.__lasty = 1e300
					  }
					  for (var i=0; i<data.length; i++) {
			        	  if (this.__interval > 0) {
			        		  this.__ninterval++
			        		  if (this.__ninterval >= this.__interval) this.__ninterval = 0
			        		  else continue
			        	  }
						  pt = data[i]
						  x = pt[0]
						  y = pt[1]
						  if (gxmin === null && x < this.__xmin) this.__xmin = x
						  if (gxmax === null && x > this.__xmax) this.__xmax = x
						  if (gymin === null && y > this.__ymin) this.__ymin = y
						  if (gymax === null && y < this.__ymax) this.__ymax = y
						  x1 = (gxmin === null) ? this.__xmin : gxmin
						  x2 = (gxmax === null) ? this.__xmax : gxmax
						  y1 = (gymin === null) ? this.__ymin : gymin
						  y2 = (gymax === null) ? this.__ymax : gymax
						  xscale = g.__width/(x2-x1)
						  yscale = g.__height/(y2-y1)
						  dx = xscale*Math.abs(x-this.__lastx)
						  dy = yscale*Math.abs(y-this.__lasty)
						  if (dx < 2 && dy < 2) continue // ignore if less than 2 pixels change
						  this.__lastx = x
						  this.__lasty = y
						  this.options.data.push(pt)
					  }
				  }
			  }
			  this.__graph.changed = true
			  this.__graph.__activate()
          }
    }
    
    property.declare( gobject.prototype, {
    	graph: {
    		get: function () { return this.__graph },
            set: function (value) {
                    this.__graph.changed = true
                    this.__graph.graph_series.splice(this.__graph.graph_series.indexOf(this), 1)
                    this.__graph = value
                    this.__graph.add_to_graph(this)
                    this.__graph.changed = true
                }
    	},
    	type: {
	        get: function () { return this.__type },
	        set: function (value) {
	                var oldftype = this.__ftype
	                var ftype = type_to_flot_type[value]
	                if (!ftype) throw new Error("Unknown series type: " + value)
	                if (ftype == oldftype) return
	                this.options[ftype] = this.options[oldftype]
	                delete this.options[oldftype]
	                // Note the odd necessity of different code for fillColor in these 3 cases:
	                if (value == 'scatter') {
	                	this.options.fill = 1
	                	this.options[ftype].fillColor = this.options.color
	                } else if (value == 'bar') {
	                	this.options.fill = 0.5
	                	this.options.fillColor = this.options.color
	                } else {
	                	this.options.fill = 0
	                	this.options.fillColor = this.options.color
	                }
	                this.__type = value
	                this.__graph.changed = true
	            }
    	},
    	color: {
	        get: function () { return this.__color },
	        set: function (value) {
	        	if (!(value instanceof vec)) throw new Error("graph color must be a vector.")
                if (this.__color.equals(value)) return
                this.__color = value
                this.options.color = color.to_html(value)
                // Note the odd necessity of different code for fillColor:
                if (this.__type == 'scatter') this.options[this.__ftype].fillColor = this.options.color
                else this.options.fillColor = this.options.color
                this.__graph.changed = true
            }
	    },
	    label: {
	        get: function () {
	                if (this.options.label === undefined) return ''
	                return this.options.label
	            },
	        set: function (value) {
	                if (this.options.label == value) return
	                this.options.label = value
	                this.__graph.changed = true
	            }
	    },
	    delta: {
	        get:
	            function () { return this.__delta },
	        set:
	            function (value) {
	                if (this.__delta == value) return
	                this.__delta = value
	                var ftype = type_to_flot_type[this.__type]
	                this.options[ftype].barWidth = value
	                this.__graph.changed = true
	            }
	    },
	    width: {
	        get: function () { return this.__width },
	        set: function (value) {
	                if (this.__width == value) return
	                this.__width = value
	                var ftype = type_to_flot_type[this.__type]
	                this.options[ftype].lineWidth = value
	                this.__graph.changed = true
	            }
	    },
	    radius: {
	        get: function () { return this.__radius },
	        set: function (value) {
	                if (this.__radius == value) return
	                this.__radius = value
	                var ftype = type_to_flot_type[this.__type]
	                this.options[ftype].radius = value
	                this.__graph.changed = true
	            }
		},
	    size: {
	        get: function () { return 2*this.__radius },
	        set: function (value) {
	                if (2*this.__radius == value) return
	                this.__radius = value/2
	                var ftype = type_to_flot_type[this.__type]
	                this.options[ftype].radius = value/2
	                this.__graph.changed = true
	            }
		},
	    horizontal: {
	        get: function () { return this.__horizontal },
	        set: function (value) {
	                if (this.__horizontal == value) return
	                this.__horizontal = value
	                var ftype = type_to_flot_type[this.__type]
	                this.options[ftype].horizontal = value
	                this.__graph.changed = true
	            }
	    },
	    dot: {
	        get: function () { return this.__dot },
	        set: function (value) {
	                if (this.__dot == value) return
	                this.__dot = value
	                this.__graph.changed = true
	            }
		},
		dot_color: {
	        get: function () { return this.__dot_color },
	        set: function (value) {
	        	if (!(value instanceof vec)) throw new Error("graph dot_color must be a vector.")
                if (this.__dot_color.equals(value)) return
                this.__dot_color = value
                this.__graph.changed = true
            }
		},
		dot_radius: {
	        get: function () { return this.__dot_radius },
	        set: function (value) {
	                if (this.__dot_radius == value) return
	                this.__dot_radius = value
	                this.__graph.changed = true
	            }
		},
		visible: {
	        get: function () { return this.__visible },
	        set: function (value) {
	                if (this.__visible == value) return
	                this.__visible = value
	                this.__graph.changed = true
	            }
		},
		data: {
	        get: function () { return this.options.data },
	        set: function (value) {
                this.options.data = []
	            this.plot(value)
	        }
		}
    })
    
    function series(options) {
        return new gobject(options)
    }
    
    // wrappers for VPython programs to use GlowScript graph capabilities
    function vp_graph(options) {
    	if (options === undefined) return new graph()
    	if (options.x !== undefined) delete options.x
    	if (options.y !== undefined) delete options.y
    	var title='', xtitle='', ytitle=''
    	var indent = '&nbsp&nbsp&nbsp&nbsp&nbsp'
    	if (options.title !== undefined) {
    		title = options.title
    		delete options.title
    	}
    	if (options.xtitle !== undefined) {
    		xtitle = options.xtitle
    		delete options.xtitle
    	}
    	if (options.ytitle !== undefined) {
    		ytitle = options.ytitle
    		delete options.ytitle
    	}
    	var t1 = ''
    	var t2 = ''
    	if (title.length > 0 && (xtitle.length > 0 || ytitle.length > 0)) t1 = title + '<br>'
    	else if (title.length > 0) t1 = title
    	if (ytitle.length > 0) {
    		t2 = ytitle
    		if (xtitle.length > 0) t2 += ' vs '+xtitle
    	} else if (xtitle.length > 0) t2 = xtitle
    	if (t1.length > 0) t1 = indent + t1
    	if (t2.length > 0) options.title = t1+indent+t2
    	else if (t1.length > 0) options.title = t1
    	return new graph(options)
    }
    
    function gcurve(options) {
    	if (options === undefined) options = {}
    	options.type = 'line'
    	if (options.pos !== undefined) {
    		options.data = options.pos
    		delete options.pos
    	}
    	if (options.size !== undefined) {
    		options.dot_radius = options.size/2
    		delete options.size
    	} else options.dot_radius = 4
    	var ret = new gobject(options)
    	ret.gcurve = ret
    	return ret
    }
    
    function gdots(options) {
    	if (options === undefined) options = {}
    	options.type = 'scatter'
    	if (options.pos !== undefined) {
    		options.data = options.pos
    		delete options.pos
    	}
    	if (options.size !== undefined) {
    		options.radius = options.size/2
    		delete options.size
    	} else options.radius = 2.6
    	var ret = new gobject(options)
    	ret.dots = ret
    	return ret
    }
    
    function gvbars(options) {
    	if (options === undefined) options = {}
    	options.type = 'bar'
    	if (options.pos !== undefined) {
    		options.data = options.pos
    		delete options.pos
    	}
    	return new gobject(options)
    }
    
    function ghbars(options) {
    	if (options === undefined) options = {}
    	options.type = 'bar'
    	options.horizontal = true
    	if (options.pos !== undefined) {
    		options.data = options.pos
    		delete options.pos
    	}
    	return new gobject(options)
    }
    
    function ghistogram(options) {
    	throw new Error('ghistogram is not implemented in GlowScript.')
    }

    var exports = {
        graph: graph,
        series: series,
        gdisplay: vp_graph,
        vp_graph: vp_graph,
        gcurve: gcurve,
        gdots: gdots,
        gvbars: gvbars,
        ghbars: ghbars
    }
    Export(exports)
})()