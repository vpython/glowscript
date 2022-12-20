;(function () {
    "use strict";
    
    // log10 and format_number are used with Flot
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
            var mantissa = val*Math.pow(10,-nformat+1)
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
    
    var fontsize = 16
    var graphid = 0

    function graph(options) {
        
        graph.activated = []
        graph.__selected = null
        graph.get_selected = function() {return graph.__selected}
        
        if (!(this instanceof graph)) return new graph(options)
        options = options || {} 
    	if (options.x !== undefined) delete options.x // meaningless currently in GlowScript
    	if (options.y !== undefined) delete options.y
    	this.fast = true
    	if (options.fast !== undefined) {
    		this.fast = options.fast
    		delete options.fast
		}
		this.scroll = false
		if (options.scroll !== undefined) {
			this.scroll = options.scroll
			delete options.scroll
		}
        
    	this.graph_options = {}
    	if (this.fast) {
	        this.graph_options = { series: { shadowSize:0 }, crosshair: { mode: "xy", color: "rgba(0,0,0,1)" },
	    		xaxis: {min:null, max:null, tickFormatter:format_number},
	    		yaxis: {min:null, max:null, tickFormatter:format_number}
	        }
		}
    	
        this.__lock = false
    	
    	this.__id = "graph"+graphid
        graphid++
        this.container = $('<div id="'+this.__id+'"></div>')
        this.__activated = false // don't create the graph until/unless there are objects to put in it
        this.__deleted = false // this is set to true if a graph is deleted
        this.graph_series = [] // series added to graph, in time order of creation of a series
        this.__todo_list = []  // Plotly restyle options to apply once this.__lock becomes false; each item is [ {info}, gobject.__id ]
    	graph.__selected = this
        this.__width = 640
        this.__height = 400
        this.__plot = null
        this.__xmin = this.__ymin = null // the graph limits specified in the graph constructor
        this.__xmax = this.__ymax = null
        this.__xmin_actual = this.__ymin_actual = null // the min and max of data actually plotted
        this.__xmax_actual = this.__ymax_actual = null
        this.__title = this.__xtitle = this.__ytitle = ''
        this.__made_title = false
        this.__made_xtitle = false
        this.__made_ytitle = false
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
        if (options.title !== undefined) {
        	this.__title = print_to_string(options.title) // could be set to None in VPython
            delete options.title
        }
    	if (options.xtitle !== undefined) {
        	this.__xtitle = print_to_string(options.xtitle) // could be set to None in VPython
    		delete options.xtitle
    	}
    	if (options.ytitle !== undefined) {
        	this.__ytitle = print_to_string(options.ytitle) // could be set to None in VPython
    		delete options.ytitle
    	}
        this.__foreground = color.black
        this.__background = color.white
        if (options.foreground !== undefined) {
        	var v = options.foreground
        	if (!(v instanceof vec)) throw new Error("graph foreground must be a vector.")
            this.__foreground = v
            delete options.foreground
        }
        if (options.background !== undefined) {
        	var v = options.background
			if (!(v instanceof vec)) throw new Error("graph background must be a vector.")
			var hsv = color.rgb_to_hsv(v)
			if (hsv.z < 0.5) hsv.z = 0.5 // avoid seeing a blank black canvas
            this.__background = color.hsv_to_rgb(hsv)
            delete options.background
        }
        var minmax = 0
        if (options.xmin !== undefined) {
            this.__xmin = options.xmin
            if (this.fast) this.graph_options.xaxis.min = options.xmin
            minmax++
            delete options.xmin
        }
        if (options.xmax !== undefined) {
            this.__xmax = options.xmax
            if (this.fast) this.graph_options.xaxis.max = options.xmax
            minmax++
            delete options.xmax
		}
		if (this.scroll) {
			if (minmax != 2)
				throw new Error("For a scrolling graph, both xmin and xmax must be specified.")
			if (this.__xmax <= this.xmin)
				throw new Error("For a scrolling graph, xmax must be greater than xmin.")
			}
		if (!this.fast && minmax == 1) {
	        if (this.__xmin === null && this.__xmax > 0) this.__xmin = 0
	        else if (this.__xmin < 0 && this.__xmax === null) this.__xmax = 0
	        else throw new Error("You must specify both xmin and xmax.")
        }
        minmax = 0
        if (options.ymin !== undefined) {
            this.__ymin = options.ymin
            if (this.fast) this.graph_options.yaxis.min = options.ymin
            minmax++
            delete options.ymin
        }
        if (options.ymax !== undefined) {
            this.__ymax = options.ymax
            if (this.fast) this.graph_options.yaxis.max = options.ymax
            minmax++
            delete options.ymax
        }
        if (!this.fast && minmax == 1) {
	        if (this.__ymin === null && this.__ymax > 0) this.__ymin = 0
	        else if (this.__ymin < 0 && this.__ymax === null) this.__ymax = 0
	        else throw new Error("You must specify both ymin and ymax.")
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
        
        if (this.fast) {
	        if (this.__logx) {
	            this.graph_options.xaxis.transform = function (v) { return log10(v) }
	            this.graph_options.xaxis.inverseTransform = function (v) { return Math.pow(10,v) }
	        }
	        if (this.__logy) {
	            this.graph_options.yaxis.transform = function (v) { return log10(v) }
	            this.graph_options.yaxis.inverseTransform = function (v) { return Math.pow(10,v) }
	        }
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
        // Given the large number of attributes, it's probably helpful not to accept user attributes.
        for (var id in options)
            this.options[id] = options[id]
        */

		function compute_offset(T) {
			if (T == null || T == '') return 0
			T = T.replace('<br>', '\n')
			T = T.replace('<br/>', '\n')
			T = T.split('\n')
			if (T.length == 1) return fontsize
			return fontsize + 1.3*fontsize*(T.length-1)
		}
		
		if (this.fast) {
			var top=0, left=0, right=0, bottom=0
			if (this.__align == 'right') right = 40
			
			var d = 10
			if (this.__title !== '') top = d + compute_offset(this.__title)
			if (this.__ytitle !== '') {
				left = compute_offset(this.__ytitle)
				if (left > fontsize) throw new Error("graph ytitle must not contain line breaks.")
				left += d
			}
			if (this.__xtitle !== null && this.__xtitle !== '') {
				bottom = compute_offset(this.__xtitle)
				if (bottom > fontsize) throw new Error("graph xtitle must not contain line breaks.")
				bottom += d
			}
	        this.graph_options.grid = { 
	        	color: color.to_html(this.__foreground), backgroundColor: color.to_html(this.__background),
	        	offsets: {left: left, right: right, top: top, bottom: bottom}
	        }
		}
    }
    
    property.declare( graph.prototype, {
    	type: {
    		get: function () { return this.__type },
    		set: function () { throw new Error('Cannot change the type of a graph.') }
    	},
    	select: function () {
    		graph.__selected = this
    	},
		__todo: function (info, id) { // called when there is a Plotly restyle to be done
			if (!this.__lock) Plotly.restyle(this.__id, info, id)
    		else this.__todo_list.push([info, id])
    	},
        __changed: false,
        remove: function() { // JavaScript forbids anything.delete(), so in preprocessing we change .delete to .remove
        	if (this.__activated) {
	        	if (!this.fast) Plotly.purge(this.__id) // delete the graph
	        	this.__deleted = true // signal to update to ignore this deleted graph
	        	this.container.remove() // delete its container
        	}
        },
    	title: {
	        get: function () { return this.__title },
	        set: function (value) {
	        	var m = value.match(/([^\n])*/) // if there is an unassigned string following the call, there's extra stuff appended
	        	value = m[0]
            	this.__title = value
            	if (this.__activated) {
            		if (this.fast) {
            			this.make_title(value)
            		} else {
            			Plotly.relayout(this.__id, {title:value})
            		}
            	}
	        }
    	},
    	xtitle: {
	        get: function () { return this.__xtitle},
	        set: function (value) {
	        	var m = value.match(/([^\n])*/) // if there is an unassigned string following the call, there's extra stuff appended
	        	value = m[0]
            	this.__xtitle = value
            	if (this.__activated) {
            		if (this.fast) {
            			this.make_xtitle(value)
            		} else {
            			Plotly.relayout(this.__id, {'xaxis.title':value})
            		}
            	}
	        }
    	},
    	ytitle: {
	        get: function () { return this.__ytitle },
	        set: function (value) {
	        	var m = value.match(/([^\n])*/) // if there is an unassigned string following the call, there's extra stuff appended
	        	value = m[0]
            	this.__ytitle = value
            	if (this.__activated) {
            		if (this.fast) {
            			this.make_ytitle(value)
            		} else {
            			Plotly.relayout(this.__id, {'yaxis.title':value})
            		}
            	}
	        }
    	},
        width: {
	        get: function () { return this.__width },
	        set: function (value) {
                this.__width = value
                if (this.fast) {
                    this.container.css('width', value)
                    var plot = $.plot(this.container, [], this.graph_options)
                    plot.resize()
                    plot.setupGrid()
                } else {
                	if (this.__activated) Plotly.relayout(this.__id, {width:value})
                }
	         }
    	},
		height: {
	        get: function () { return this.__height },
	        set: function (value) {
                this.__height = value
                if (this.fast) {
	                this.container.css('height', value)
	                var plot = $.plot(this.container, [], this.graph_options)
	                plot.resize()
	                plot.setupGrid()
                } else {
                	if (this.__activated) Plotly.relayout(this.__id, {height:value})
                }
	         }
		},
        align: {
        	get: function() { return this.__align },
        	set: function(value) {
	        	if (this.__activated) throw new Error("Cannot change align after the graph is activated.")
        		if (value == 'left' || value == 'right' || value == 'none') {
        			this.__align = value
        		} else throw new Error("align must be 'left', 'right', or 'none' (the default).")
        	 }
        },
	    xmin: {
	        get: function () { return this.__xmin },
	        set: function (value) {
	        	this.__xmin = value
                if (this.fast) this.graph_options.xaxis.min = value
                else if (this.__activated) Plotly.relayout(this.__id, {'xaxis.range':[value,this.__xmax]})
	        }
	    },
	    xmax: {
	        get: function () { return this.__xmax },
	        set: function (value) {
	        	this.__xmax = value
	        	if (this.fast) this.graph_options.xaxis.max = value
	        	else if (this.__activated) Plotly.relayout(this.__id, {'xaxis.range':[this.__xmin,value]})
            }
	    },
	    ymin: {
	        get: function () { return this.__ymin },
	        set: function (value) {
	        	this.__ymin = value
	        	if (this.fast) this.graph_options.yaxis.min = value
	        	else if (this.__activated) Plotly.relayout(this.__id, {'yaxis.range':[value,this.__ymax]})
            }
	    },
	    ymax: {
	        get: function () { return this.__ymax },
	        set: function (value) {
	        	this.__ymax = value
	        	if (this.fast) this.graph_options.yaxis.max = value
	        	else if (this.__activated) Plotly.relayout(this.__id, {'yaxis.range':[this.__ymin,value]})
            }
	    },
	    logx: {
	        get: function () { return this.__logx },
	        set: function (value) {
	        	//if (this.__activated) throw new Error("Cannot change logx after the graph is activated.")
	        	this.__logx = value
                if (this.__logx == value) return
                if (this.fast) {
	                if (value) {
	                    this.graph_options.xaxis.transform = function (v) { return log10(v) }
	                    this.graph_options.xaxis.inverseTransform = function (v) { return Math.pow(10,v) }
	                } else {
	                    delete this.graph_options.xaxis.transform
	                    delete this.graph_options.xaxis.inverseTransform
	                }
                } else if (this.__activated) {
                	if (value) Plotly.relayout(this.__id, {'xaxis.type':'log'})
	                else Plotly.relayout(this.__id, {'xaxis.type':null})
                }
            }
	    },
	    logy: {
	        get: function () { return this.__logy },
	        set: function (value) {
	        	//if (this.__activated) throw new Error("Cannot change logy after the graph is activated.")
	        	this.__logy = value
                if (this.__logy == value) return
                if (this.fast) {
                    if (value) {
                        this.graph_options.yaxis.transform = function (v) { return log10(v) }
                        this.graph_options.yaxis.inverseTransform = function (v) { return Math.pow(10,v) }
                    } else {
                        delete this.graph_options.yaxis.transform
                        delete this.graph_options.yaxis.inverseTransform
                    }
                } else if (this.__activated) {
                	if (value) Plotly.relayout(this.__id, {'yaxis.type':'log'})
	                else Plotly.relayout(this.__id, {'yaxis.type':null})
                }
        }
	    },
	    foreground: {
	        get: function () { return this.__foreground },
	        set: function (value) {
	        	if (!(value instanceof vec)) throw new Error("graph foreground color must be a vector.")
                this.__foreground = value
                var col = color.to_html(value)
                if (this.fast) this.graph_options.grid.color = col
                else if (this.__activated) Plotly.relayout(this.__id, {'paper_bgcolor':col})
	         }
	    },
	    background: {
	        get: function () { return this.__background },
	        set: function (value) {
	        	if (!(value instanceof vec)) throw new Error("graph background color must be a vector.")
                this.__background = value
                var col = color.to_html(value)
                if (this.fast) this.graph_options.grid.backgroundColor = col
                else if (this.__activated) Plotly.relayout(this.__id, {'plot_bgcolor':col})
	         }
	    },	        
	    make_title: function (title) { // used with Flot
        	var o = this.graph_options.grid.offsets
        	if (o.top === 0) throw new Error("Cannot change a graph title if it does not already have a title.")
        	var ctx = this.__plot.getCanvas().getContext('2d')
        	ctx.fillStyle = color.to_html_rgba(vec(1,1,1), 1) // fully opaque
        	ctx.fillRect(0, 0, this.__width, o.top)
        	var font = 'Arial'
        	if (title !== null && title !== '') {
            	//var x0 = 0
            	var y0 = 15
            	var x0 = o.left + (this.__width - o.left - o.right)/2
            	//if (this.__title_align == 'center') x0 = o.left + (this.__width - o.left - o.right)/2 // other alignments no longer supported
            	//else if (this.__title_align == 'right') x0 = this.__width - o.right
            	var info = parse_html( {ctx: ctx, text: title.toString(), x: x0, y: y0, align: 'center', font: font, fontsize: fontsize, angle: 0} )
            	display_2D(info)
        	}
	    },
	    make_xtitle: function (title) { // used with Flot
        	var o = this.graph_options.grid.offsets
        	if (o.bottom === 0) throw new Error("Cannot change a graph xtitle if it does not already have an xtitle.")
        	var ctx = this.__plot.getCanvas().getContext('2d')
        	ctx.fillStyle = color.to_html_rgba(vec(1,1,1), 1) // fully opaque
        	ctx.fillRect(o.left, this.__height-o.bottom, this.__width-o.right, this.__height)
        	var font = 'Arial'
        	if (title !== null && title !== '') {
            	var x0 = o.left + (this.__width-o.left-o.right)/2
            	var y0 = this.__height + o.top - 5
            	var info = parse_html( {ctx: ctx, text: title.toString(), x: x0, y: y0, align: 'center', font: font, fontsize: fontsize, angle: 0} )
            	display_2D(info)
        	}
	    },
	    make_ytitle: function (title) { // used with Flot
        	var o = this.graph_options.grid.offsets
        	if (o.left === 0) throw new Error("Cannot change a graph ytitle if it does not already have a ytitle.")
        	var ctx = this.__plot.getCanvas().getContext('2d')
        	ctx.fillStyle = color.to_html_rgba(vec(1,1,1), 1) // fully opaque
        	ctx.fillRect(0, o.top, o.left, this.__height-o.top-o.bottom)
        	var font = 'Arial'
        	if (title !== null && title !== '') {
        		var x0 = 15
            	var y0 = o.top + (this.__height - o.bottom -15)/2
            	var info = parse_html( {ctx: ctx, text: title.toString(), x: x0, y: y0, align: 'center', font: font, fontsize: fontsize, angle: -Math.PI/2} )
            	display_2D(info)
        	}
	    },
        add_to_graph: function (obj) {
        	obj.__id = this.graph_series.length
			obj.__activated = false
			obj.__scrolldata = [] // keep a copy of data sent to graphing package
            this.graph_series.push(obj)
        },
    	__activate: function (dheight) { // called only from __update()
    		if (this.__activated) return
	    	if (!this.fast) {
	            this.container.addClass("glowscript-graph").css("width", this.__width).
	            	css("height", this.__height+dheight).appendTo( canvas.container )
	            if (this.__align != 'none') this.container.css("float", this.__align)
    		} else {
                this.container.addClass("glowscript-graph").css("width", this.__width).css("height",
                		this.__height + this.graph_options.grid.offsets.top).appendTo( canvas.container )
                this.container.css("float", this.__align)
    		}
        	graph.activated.push(this)
        	this.__activated = true
    	},
		__update: function() { // called once by plot function, if graph not yet activated
			if (!this.__changed || this.__deleted) return
    		if (this.__lock) return
			var already_activated = this.__activated
	        
	        function compute_offset(s) { // used to adjust graph height to accommodate a title
				var m = s.match(/<br>/g)
				if (m === null) return 0
				return m.length
	    	}
			
			var xmax = this.__xmax
        	if (!this.fast) { // Plotly
        		for (var i=0; i<this.__todo_list; i++) {
					var info = this.__todo_list[i]
        			Plotly.restyle(this.__id, info[0], [ info[1] ])
        		}
	    		this.__todo_list = []
				if (!this.__activated) { // graph has not been activated
					// Lay out the graph
					var layout = {}
					layout.width = this.__width
					layout.height = this.__height
					layout.font = {size:11, family: 'Arial'}
					var titlefont = {size:15, family: 'Arial'}
					var tickfont = {size:14, family: 'Arial'}
					layout.plot_bgcolor = color.to_html(this.background)
					layout.xaxis = {showgrid:true, zeroline:true, showline:true, linecolor:this.foreground,
							gridcolor:color.to_html(this.foreground), linewidth:3, mirror:'ticks',
							exponentformat:'e', showexponent:'all',
							titlefont:titlefont, tickfont:tickfont}
					layout.yaxis = {showgrid:true, zeroline:true, showline: true, linecolor:this.foreground,
							gridcolor:color.to_html(this.foreground), linewidth:3, mirror:'ticks',
							exponentformat:'e', showexponent:'all',
							titlefont:titlefont, tickfont:tickfont}
					if (this.__logx) layout.xaxis.type = 'log'
					if (this.__logy) layout.yaxis.type = 'log'
					if (this.__xmin !== null) layout.xaxis.range = [this.__xmin, this.__xmax] // currently no way to specify just min or max
					if (this.__ymin !== null) layout.yaxis.range = [this.__ymin, this.__ymax]
					var dh = 0
					var t = 35
					if (this.title !== undefined && this.title.length > 0) {
						layout.title = this.title
						var n = compute_offset(this.title)
						t = 65
						if (n > 0) t += 45*(n-1)
						dh += 45*(n+1)
						layout.height += dh
					}
					var l = 65
					if (this.ytitle !== undefined && this.ytitle.length > 0) {
						layout.yaxis.title = this.ytitle
						var d = compute_offset(this.ytitle)
						if (d > 0) throw new Error('A ytitle must not contain <br>.') // was unable to reposition grid
						l = 80
					}
					var b = 45
					if (this.xtitle !== undefined && this.xtitle.length > 0) {
						layout.xaxis.title = this.xtitle
						var d = compute_offset(this.xtitle)
						if (d > 0) throw new Error('An xtitle must not contain <br>.') // was unable to reposition grid
					}
					layout.margin = {l:l, r:20, b:b, t:t, pad:4}
					this.__activate(dh) // activate the graph display
					this.__activated = true
				} // end of activating a slow series graph
					
				var indices = [] // [0, 1, 2] if there are 3 series
				for (var i=0; i<this.graph_series.length; i++) { // activate any graphing objects not already activated
					indices.push(i)
					var s = this.graph_series[i]
					if (!s.__activated) { // Create the graph object
	                	s.__activated = true
						var p = s.__realtype
						var col = color.to_html(s.__color)
						if (i === 0) {
							if (p == 'bar') Plotly.newPlot(this.__id, [ {x:[], y:[], type:p,
								name:s.__label, showlegend:s.__legend, visible:s.__visible, width:s.__delta,
								orientation:s.__orientation, marker:{ color:color.to_html_rgba(s.__color, 0.5), 
								line:{color:color.to_html_rgba(s.__color, 1), width:2} } } ], layout)
							else if (p == 'lines') {
								Plotly.newPlot(this.__id, [ {x:[], y:[], mode:p, type:'scatter',
									name:s.__label, showlegend:s.__legend, visible:s.__visible,
									line:{color:col, width:s.__width}} ], layout)
							} else if (p == 'markers') {
								// could not get pointcloud or scattergl to work in GlowScript; may be WebGL conflict
								/*
								var trace0 = {
									type: "scattergl",
									mode: 'markers', // no mode if pointcloud
									marker: {
										//sizemin: 0.5,
										//sizemax: 30,  // // sizemax=100 => diameter was 36 pixels on screen; what is "sizemax"?
										color: col
									},
									x: [],
									y: []
									}
								Plotly.plot(this.__id, [ trace0 ], layout)
								*/
								Plotly.newPlot(this.__id, [ {x:[], y:[], mode:p, type:'scatter', 
									name:s.__label, showlegend:s.__legend, visible:s.__visible,
									marker:{color:col, size:2*s.__radius}} ], layout)
									
								//begin Aaron Titus
								//integrate selected data
								if(s.__integrate_selected){
									var myPlot = document.getElementById(this.__id) //graph div
									myPlot.on('plotly_selected', function(eventData){
										var x = [] //x points of selected data
										var y = [] //y points of selected data
										if(eventData !== undefined){
											eventData.points.forEach(function(pt) {
												x.push(pt.x)
												y.push(pt.y)
											})
											var sum=0 //integral
											for(var i=1; i<x.length; i++){
												var dx=x[i]-x[i-1]
												sum=sum+(y[i]+y[i-1])/2*dx //trapezoidal rule
											}
											var layoutupdate = { //add annotation to the layout
												annotations: [
													{
														text: '<b>integral of selected points = '+sum.toPrecision(6) + '</b>',
														font: {
															color: "black",
															size: 14
														},
														showarrow: false
													}
												]
											}
											Plotly.relayout(myPlot, layoutupdate)
											//add new trace for selected data
											for (var t=0; t< myPlot.data.length; t++){
												if(myPlot.data[t]['name']=='selected data'){
													Plotly.deleteTraces(myPlot, t);
												}
											}
											Plotly.addTraces(myPlot, {x:x, y:y, type:'scatter', fill:'tozeroy', 
												mode:'none', name:'selected data', showlegend:false, hoverinfo:'none'
											})
										}
									})
								}
								//end Aaron Titus
							}
						} else {
						if (p == 'bar') Plotly.addTraces(this.__id, {x:[], y:[], type:p,
							name:s.__label, showlegend:s.__legend,  visible:s.__visible, width:s.__delta,
							orientation:s.__orientation, marker:{ color:color.to_html_rgba(s.__color, 0.5), 
							line:{color:color.to_html_rgba(s.__color, 1), width:2} } } )
						else if (p == 'lines') {
							if (s.__markers) p = 'markers+lines'
							Plotly.addTraces(this.__id, {x:[], y:[], mode:p, type:'scatter',
								name:s.__label, showlegend:s.__legend, visible:s.__visible,
								marker:{color:color.to_html(s.__marker_color), size:2*s.__radius},
								line:{color:col, width:s.__width}})
						} else if (p == 'markers') Plotly.addTraces(this.__id, {x:[], y:[], mode:p, type:'scatter',
							name:s.__label, showlegend:s.__legend,  visible:s.__visible,
							marker:{color:col, size:2*s.__radius} }  )
						}
					}
				}

				// Set up the xs and ys arrays of data for the various graphing objects
				var xs = [] // the list of lists of x values for each series
				var ys = []
				var n = 0
				for (var i=0; i<this.graph_series.length; i++) {
					var s = this.graph_series[i]
					var data = s.__newdata
					var x = []
					var y = []
					for (var j=0; j<data.length; j++) {
						var d = data[j]
						s.__data.push(d)
						var xx = d[0]
						var yy = d[1]
						x.push(xx)
						y.push(yy)
						if (this.scroll) {
							s.__scrolldata.push([xx,yy])
							if (xx > xmax) xmax = xx
						}
					}
					xs.push(x)
					ys.push(y)
					s.__newdata = []
				} // end of ith series

				if (this.scroll && xmax > this.__xmax) {
					var d = xmax-this.__xmax
					this.xmin += d
					this.xmax += d
				}

	            if (!this.__lock) {
	            	this.__lock = true
					var self = this
	            	// See https://community.plot.ly/t/i-want-to-show-loading-symbol-while-loading-the-graph/157
					Plotly.extendTraces(this.__id, { x:xs, y:ys }, indices).then(function() { self.__lock = false })
				}
        	} // end of non-fast graph (Plotly)
    	
	    	else { // update fast graph (Flot)
				var info = []
	            for (var i = 0; i < this.graph_series.length; i++) {
	            	var s = this.graph_series[i]
	            	if (!s.__visible) continue
	            	s.__activated = true
					s.options.data = s.__data
					var L = s.__data.length
					if (L > 0) {
						var x = s.__data[L-1][0] // the most recent value of x
						if (x > xmax) xmax = x
					}
                    info.push(s.options)
                    if (s.__linemarker !== null && s.__markers) {
                    	s.__linemarker.data = s.__data
                    	s.__linemarker.color = s.__linemarker.points.fillColor
                    	s.__linemarker.points.radius = s.__radius
                    	info.push(s.__linemarker)
                    }
                    if (s.__dot && s.__realtype == 'lines' && s.__data.length > 0) {
                        var dotdisplay = { points: { show: true } }
                        if (s.__dot_radius !== null) dotdisplay.points.radius = s.__dot_radius
                        else dotdisplay.points.radius = s.__width+1
                        if (s.__dot_color !== null) dotdisplay.color = color.to_html(s.__dot_color)
                        else dotdisplay.color = color.to_html(s.__color)
                        dotdisplay.points.fillColor = dotdisplay.color
                        dotdisplay.data = [s.options.data[s.options.data.length-1]]
                        info.push(dotdisplay)
					}
                }

				if (this.scroll && xmax > this.__xmax) {
					var d = xmax-this.__xmax
					this.xmin += d
					this.xmax += d
				}

	            if (info.length > 0) {
		            this.__activate(0)
		            this.__plot = $.plot(this.container, info, this.graph_options)
		            this.__plot.draw()
	            }
	            
	            if (!already_activated) {
	            	if (this.__title !== null && this.__title !== '') this.make_title(this.__title)
	
	            	if (this.__xtitle !== null && this.__xtitle !== '') this.make_xtitle(this.__xtitle)
	
	            	if (this.__ytitle !== null && this.__ytitle !== '') this.make_ytitle(this.__ytitle)
	            }
	    	} // end of fast version of update
	        this.__changed = false
			if (!already_activated) new render_graph(this)
	    } // end of update()
    }) // end of graph prototype
    
    // For converting from Flot lines, scatter, bar -> Plotly lines, markers, bar
    var to_slow_type = { lines: "lines", scatter: "markers", 
    		markers: "markers", bar: "bar" // deal with markers+lines separately
    }
    var to_fast_type = { lines: "lines", scatter: "points", 
    		markers: "points", bar: "bars"
    }

    function gobject(options) {
        options = options || {}
        this.__data = []
        this.__newdata = [] // prepared by the plot function, cleared by this.__graph.__update()
        this.__color = vec(0,0,0)
        this.__marker_color = vec(0,0,0)
        this.__linemarker = null
    	this.__lineobj = null
    	this.__markerobj = null
        this.__label = null
        this.__save_label = null
        this.__delta = 1
        this.__width = 2
        this.__radius = 3
        this.__horizontal = false
        this.__dot = false
        this.__xmin = null
        this.__xmax = null
        this.__ymin = null
        this.__ymax = null
        this.__label = ''
        this.__legend = false
        this.__markers = false
        this.__interval = -1 // -1 signals no interval specified; 0 signals no plotting
        this.__integrate_selected = false //Aaron Titus
        var fast = true
        if (options.fast !== undefined){
        	fast = options.fast
        	delete options.fast
        }
        if (options.graph !== undefined) {
            this.__graph = options.graph
            delete options.graph
        } else if (options.gdisplay !== undefined) {
            this.__graph = options.gdisplay
            delete options.gdisplay
        } else {
        	try {
        		this.__graph = graph.get_selected()
        	} catch(err) {
        		this.__graph = graph({fast:fast})
        	}
        }
        this.__type = 'lines' // default type; others are 'scatter' and 'bar'
        if (options.type !== undefined) {
            this.__type = options['type']
            delete options['type']
        }
        if (this.__graph.fast) this.__realtype = to_fast_type[this.__type]
        else this.__realtype = to_slow_type[this.__type]
        if (!this.__realtype) throw new Error("Unknown series type: " + this.__type)
        
        this.options = {} // used by Flot
        
        var ftype = this.__realtype
        var initialdata = []

        if (options.data !== undefined) {
        	initialdata = options.data
        	delete options.data
        }
        
        if (options.color !== undefined) {
        	var c = options.color
        	if (!(c instanceof vec)) throw new Error("graph color must be a vector.")
            this.__color = c
            this.__marker_color = c
            delete options.color
        }
        if (this.__graph.fast) {
        	if      (ftype == 'lines') this.options[ftype] = { show: true, lineWidth:this.__width }
        	else if (ftype == 'points') this.options[ftype] = { show:true, radius:this.__radius, fill:true, lineWidth:0 }
	        else if (ftype == 'bars') this.options[ftype] = { show:true, align:'center', horizontal:false, barWidth:1, lineWidth:1, fill: 0.5 }
		}
	    this.options.color = color.to_html(this.__color)
	    if (this.__graph.fast) {
	    	if (this.__realtype == 'points') this.options[ftype].fillColor = this.options.color
	    	else this.options.fillColor = this.options.color
	    }
        
        if (options.marker_color !== undefined) {
        	var c = options.marker_color
        	if (!(c instanceof vec)) throw new Error("graph color must be a vector.")
            this.__marker_color = c
            delete options.marker_color
        }

        if (options.width !== undefined) {
            this.__width = options.width
            if (this.__graph.fast) this.options[ftype].lineWidth = options.width
            delete options.width
        }
        if (options.markers !== undefined) {
        	if (this.__realtype != 'lines') throw new Error('One can add markers only to graph curves.')
        	if (options.markers === true) {
	        	this.__markers = options.markers
	        	var r = this.__width/2 + 2
	        	if (options.radius !== undefined) r = options.radius
	        	if (this.__graph.fast) this.__linemarker = 
	        			{points:{show: true, radius:r, lineWidth:0, fillColor:color.to_html(this.__marker_color), fill:true}}
	        	else this.__radius = r
        	}
        	delete options.markers
        }
        if (options.radius !== undefined) {
            this.__radius = options.radius
            if (this.__graph.fast) this.options[ftype].radius = options.radius
            delete options.radius
        }
        if (options.size !== undefined) {
            this.__radius = options.size/2
            if (this.__graph.fast) this.options[ftype].radius = options.size/2
            delete options.size
        }
        if (options.horizontal !== undefined) {
            this.__horizontal = options.horizontal
            if (this.__graph.fast) this.options[ftype].horizontal = options.horizontal
            delete options.horizontal
        }
        if (options.delta !== undefined) {
            this.__delta = options.delta
            if (this.__graph.fast) this.options[ftype].barWidth = options.delta
            delete options.delta
        }
        
        if (options.label !== undefined) {
        	this.__label = options.label
        	this.__save_label = options.label
        	if (this.__graph.fast) this.options.label = options.label
        	if (options.label.length > 0) this.__legend = true
        	delete options.label
        }
        if (options.legend !== undefined) {
        	this.__legend = options.legend
        	if (this.__graph.fast && !options.legend && this.__label !== null) delete this.options.label
        	delete options.legend
        }
        if (options.__lineobj !== undefined) {
        	this.__lineobj = options.__lineobj // The gcurve object using this gdots object
        	delete options.__lineobj
        }
        if (options.__markerobj !== undefined) {
        	this.__markerobj = options.__markerobj // The gcurve object using this gdots object
        	delete options.__markerobj
        }
        if (options.dot !== undefined) {
        	if (this.__realtype != 'lines' ) throw new Error('Can add a moving dot only to a gcurve or "lines" object')
            this.__dot = options.dot
            this.__dot_radius = this.__width/2 + 4
            this.__dot_color = this.__color
            delete options.dot
        }
        if (options.dot_radius !== undefined) {
            this.__dot_radius = options.dot_radius
            delete options.dot_radius
        }
        this.__dot_color = this.__color
        if (options.dot_color !== undefined) {
        	var v = options.dot_color
        	if (!(v instanceof vec)) throw new Error("graph dot_color must be a vector.")
            this.__dot_color = v
            delete options.dot_color
        }
        if (options.interval !== undefined) {
            this.__interval = options.interval
            this.__ninterval = options.interval
            delete options.interval
        }
        if (options.integrate_selected !== undefined){
        	this.__integrate_selected = options.integrate_selected
        	delete options.integrate_selected
        }        
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
            this.options[slow_type][id] = options[id]
        }
        */
        this.__graph.add_to_graph(this) // this sets this.__id

		// If fast == False we invoke plotly, and plotly doesn't display a label 
		// if there is only one active object in the graph. The following code
		// adds a gcurve to the first object and plots at (0,0), which has the
		// effect of forcing display of the label of the first object.
		if (!this.__graph.fast && this.__graph.graph_series.length == 1) {
			let gc = gcurve()
			gc.plot(0,0)
		}
        
        this.remove = function() { // JavaScript forbids anything.delete(), so in preprocessing we change .delete to .remove
        	this.data = []
        }
	     
		  // Angus Croll: http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
		  // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
		  // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"
		
		  var toType = function(obj) { return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase() }
		
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
				  if (arguments.length === 0) return []
			      for (var i=0; i<arguments[0].length; i++) {
			          v = arguments[0][i]
			          if (toType(v) == 'array' && v.length == 2) ret.push(v)
			          else return null
			          }
			      }
			      return ret
		  }
		  
		  var checkval = function(n) {
			  if (toType(n) == 'number') return
			  if (n instanceof vec) throw new Error("Cannot plot a vector, only a vector component.")
			  throw new Error("A quantity to plot must be an ordinary number.")
		  }

          this.plot = function (args) {
			  // Prepare data for the graph object to make a display about 60 times/s
			  // Accept plot(x,y) or plot([x,y], [x,y], ...) or plot([[x,y], [x,y], ...]]) or plot(data=[x,y]) or plot(pos=[x,y])
        	  var data
 			  if (args.color !== undefined) throw new Error("Cannot currently change color in a plot statement.")
 			  if (args.data !== undefined) data = resolveargs(args.data)
 			  else if (args.pos !== undefined) data = resolveargs(args.pos)
 			  else if (toType(args) == 'array' && arguments.length == 1) data = resolveargs(args)
 			  else {
	 			  var a = []
	 			  for (var i=0; i<arguments.length; i++) a.push(arguments[i])
	 			  if (toType(a[0]) == 'array') data = resolveargs(a)
	 			  else data = resolveargs([a])
 			  }
			  if (data === null) throw new Error("Must be plot(x,y) or plot(data=[x,y]) or plot(pos=[x,y]) or plot([x,y]) or plot([x,y], ...) or plot([ [x,y], ... ])")

			  if (this.__realtype != 'lines' || this.__markers) {
				  for (var i=0; i<data.length; i++) {
		        	  if (this.__interval > 0) {
		        		  this.__ninterval++
		        		  if (this.__ninterval >= this.__interval) this.__ninterval = 0
		        		  else continue
		        	  }
		        	  if (this.__graph.fast) this.__data.push(data[i]) // we have to give flot the entire data each time we render
		        	  else this.__newdata.push(data[i]) // with Plotly we can extend incrementally (though it's no faster)
					  if (!this.__graph.fast && this.__realtype == 'lines' && this.__newdata.length > 0) {
						  var d = this.__newdata[this.__newdata.length-1]
			        	  if (this.__dot ) this.__dotobject.data = [ data[i] ]
			        	  if (this.__markers) this.__markerobject.__newdata.push(data[i])
					  }
				  }
			  } else { // for gcurve, eliminate points that are very close together
				  var x, y, dx, dy, lastx, lasty, dt, xy, wx, wy
				  var g = this.__graph
				  var xmin = g.__xmin // specifed in graph constructor, or null
				  var xmax = g.__xmax
				  var ymin = g.__ymin
				  var ymax = g.__ymax
				  var xmin_actual = g.__xmin_actual // min and max of data actually plotted; initially null
				  var xmax_actual = g.__xmax_actual
				  var ymin_actual = g.__ymin_actual
				  var ymax_actual = g.__ymax_actual
				  dt = Math.floor(msclock() - this.__lasttime)
				  this.__lasttime = msclock()
				  lastx = lasty = null
				  if (this.__data.length > 0) {
					  xy = this.__data[this.__data.length-1]
					  lastx = xy[0]
					  lasty = xy[1]
				  }
				  for (var i=0; i<data.length; i++) {
		        	  if (this.__interval > 0) {
		        		  this.__ninterval++
		        		  if (this.__ninterval >= this.__interval) this.__ninterval = 0
		        		  else continue
		        	  }
					  xy = data[i]
					  x = xy[0]
					  y = xy[1]
					  checkval(x)
					  checkval(y)
					  if (g.scroll) {
						g.__xmin_actual = xmin_actual = g.__xmin
						g.__xmax_actual = xmax_actual = g.__xmax
					  } else {
						if (xmin_actual === null || x < xmin_actual) g.__xmin_actual = xmin_actual = x
						if (xmax_actual === null || x > xmax_actual) g.__xmax_actual = xmax_actual = x
					  }
					  if (ymin_actual === null || y < ymin_actual) g.__ymin_actual = ymin_actual = y
					  if (ymax_actual === null || y > ymax_actual) g.__ymax_actual = ymax_actual = y
					  if (lastx !== null) {
						  wx = xmax_actual - xmin_actual
						  dx = (wx === 0) ? 0 : Math.abs(x-lastx)/wx
						  wy = ymax_actual - ymin_actual
						  dy = (wy === 0) ? 0 : Math.abs(y-lasty)/wy
						  if (dx < 0.001 && dy < 0.001) continue
					  }
					  if (this.__graph.fast) this.__data.push(xy) // we have to give flot the entire data each time we render
		        	  else this.__newdata.push(xy) // with Plotly we can extend incrementally (though it's no faster currently)
					  lastx = x
					  lasty = y
				  }
				  if (this.__dot && !this.__graph.fast && this.__newdata.length > 0) {
		        	  this.__dotobject.data = [ this.__newdata[this.__newdata.length-1] ]
				  }
			  } // end of gcurve
			  this.__graph.__changed = true
			  
			  if (!this.__graph.__activated) this.__graph.__update() // will activate the graph and trigger rendering
          } // end of plot
		  
		  if (initialdata.length > 0) this.plot(initialdata) // will start the rendering
          
    } // end of gobject constructor
    
    property.declare( gobject.prototype, {
    	graph: {
    		get: function () { return this.__graph },
            set: function (value) {
	        	throw new Error("Cannot change the choice of graph for an existing graphing object.")
	        	/* Have been unable to make this work
            	var oldi = this.__id
            	this.__graph.graph_series[oldi] = null
                this.__graph = value
                this.__graph.add_to_graph(this)
                this.data = this.__data
                */
             }
    	},
    	type: {
	        get: function () { return this.__type },
	        set: function (value) {
	        	throw new Error("Cannot change the type of an existing graphing object.")
	        	// Needs more work; probably need to delete and re-create
	        	//var m = value.match(/([^\n])*/)
	        	/*
	        	value = m[0]
	        	var slow_type = type_to_slow_type[value]
                if (!slow_type) throw new Error("Unknown series type: " + value)
	        	if (slow_type == this.__slow_type) return
                this.__type = value
                this.__slow_type = slow_type
                */
	         }
    	},
    	data: {
	        get: function () { return this.__data.concat(this.__newdata) }, // newdata hasn't yet been added to data
	        set: function (value) {
                this.__data = []
                this.options.data = []
                this.__newdata = []
                if (!this.__graph.fast) { // plotly
		        	if (this.__realtype == 'lines') {
		        		if (this.__dot) {
			        		this.__dotobject.__data = []
			        		this.__dotobject.__newdata = []
		    	            if (this.__graph.__activated) this.__graph.__todo({x:[[]], y:[[]]}, this.__dotobject.__id)
		    			}
		        		if (this.__markers) {
	        				this.__markerobject.__data = []
	        				this.__markerobject.__newdata = []
	        				if (this.__graph.__activated) this.__graph.__todo({x:[[]], y:[[]]}, this.__markerobject.__id)
		        		}
		        	}
		        	if (this.__graph.__activated) this.__graph.__todo({x:[[]], y:[[]]}, this.__id)
	        	}
            	this.__graph.__changed = true
                if (value.length > 0) this.plot(value)
            }
	    },
        markers: {
        	get: function () { return this.__markers },
        	set: function (value) {
	        	if (this.__realtype != 'lines') throw new Error('One can add markers only to graph curves.')
	        	if (this.__markers === value) return
	        	this.__markers = value
	        	var r = this.__radius + 2
                if (this.__activated) {
                	if (value) {
			        	var up = {}
			        	up['marker.color'] = color.to_html(this.__color)
			        	if (this.__graph.fast) this.options.points = {show: true, radius:r}
			        	else this.__graph.__todo(up, this.__markerobject.__id)
		        	} else {
		        		var up = {}
		        		up['marker.size'] = 0.1
			        	if (this.__graph.fast) this.options.points = {show: false, radius:r}
			        	else this.__graph.__todo(up, this.__markerobject.__id)
			        	this.__graph.__changed = true
		        	}
	        	}
        	}
        },
    	color: {
	        get: function () { return this.__color },
	        set: function (value) {
	        	if (!(value instanceof vec)) throw new Error("graphing color must be a vector.")
                if (this.__color.equals(value)) return
                this.__color = value
                var col = color.to_html(value)
                if (this.__graph.fast) this.options.color = col
                if (this.__activated) {
                	if (this.__graph.fast) {
            	    	if (this.__realtype == 'points') this.options[ftype].fillColor = this.options.color
            	    	else this.options.fillColor = this.options.color
                        this.__graph.__changed = true
                	} else {
		                var up = {}
		                if (this.__realtype == 'bar') {
		                	up['marker.color'] = color.to_html_rgba(value,0.5)
		                	up['marker.line.color'] = color.to_html_rgba(value,1)
		                } else if (this.__realtype == 'markers') {
		                	up['marker.color'] = col
		                } else if (this.__realtype == 'lines') {
		                	up['line.color'] = col
		                	up['marker.color'] = col
		                }
		                this.__graph.__todo(up, this.__id)
                	}
                }
            }
	    },
    	marker_color: {
	        get: function () { return this.__marker_color },
	        set: function (value) {
	        	if (!(value instanceof vec)) throw new Error("graphing marker_color must be a vector.")
                if (this.__marker_color.equals(value)) return
                this.__marker_color = value
                var col = color.to_html(value)
                if (this.__graph.fast) this.options.marker_color = col
                if (this.__activated) {
                	if (this.__graph.fast) {
                        if (this.__realtype == 'lines') this.__linemarker.points.fillColor = col
                        else this.options.color = col
                        this.__graph.__changed = true
                	} else {
    	        		if (this.__markerobject.__activated) {
    		                var up = {}
    		                up['marker.color'] = col
    		                this.__graph.__todo(up, this.__markerobject.__id)
            			}
                	}
                }
            }
	    },
	    label: {
	        get: function () {
	                if (this.__label === undefined) return ''
	                return this.__label
	            },
	        set: function (value) {
	        	var m = value.match(/([^\n])*/) // if there is an unassigned string following the call, there's extra stuff appended
	        	value = m[0]
                if (this.__label == value) return
                this.__label = value
                if (this.__graph.fast) this.options.label = value
                if (value.length > 0) this.__legend = true
                if (this.__activated) {
                	if (this.__graph.fast) {
    	                this.options.label = value
    	                this.__graph.__changed = true
                	} else this.__graph.__todo({'name':value, 'showlegend':this.__legend}, this.__id)
	            }
	        }
	    },
	    legend: {
	        get: function () { return this.__legend },
	        set: function (value) {
                if (this.__legend == value) return
                this.__legend = value
                if (this.__graph.fast) this.options.legend = value
                if (this.__activated) {
                	if (this.__graph.fast) {
                		if (this.options.label !== null) {
                			if (value) this.options.label = this.__save_label
                			else delete this.options.label
                		}
                		this.options.legend = value
                		this.__graph.__changed = true
                	} else this.__graph.__todo({'showlegend':value}, this.__id)
                }
        	}
	    },
	    delta: {
	        get: function () { return this.__delta },
	        set: function (value) {
                if (this.__delta == value) return
                this.__delta = value
                if (this.__graph.fast) this.options[this.__realtype].barWidth = value
                if (this.__activated) {
                	if (this.__graph.fast) {
    	                this.__graph.__changed = true
                	} else this.__graph.__todo({'width':value}, this.__id)
                }
        	}
	    },
	    width: {
	        get: function () { return this.__width },
	        set: function (value) {
                if (this.__width == value) return
                this.__width = value
                if (this.__graph.fast) this.options[this.__realtype].lineWidth = value
                if (this.__activated) {
                	if (this.__graph.fast) {
    	                this.__graph.__changed = true
                	} else {
		                var up = {}
                        if (this.__realtype == 'bar') {
                            return
                        } else if (this.__realtype == 'lines') {
                            up['line.width'] = value
                        } else if (this.__realtype == 'markers') {
                            return
                        }
		                this.__graph.__todo(up, this.__id)
                	}
                }
            }
	    },
	    radius: {
	        get: function () { return this.__radius },
	        set: function (value) {
                if (this.__radius == value) return
                this.__radius = value
                if (this.__graph.fast) this.options[this.__realtype].radius = value
                if (this.__activated) {
	                if (this.__graph.fast) {
		                this.__graph.__changed = true
	                } else {
		                var up = {}
                        up['marker.size'] = 2*value
                        if (this.__realtype == 'lines') {
                        	if (!this.__markers) return
                        	this.__graph.__todo(up, this.__markerobject.__id)
                        } else if (this.__realtype == 'markers') {
                        	this.__graph.__todo(up, this.__id)
                        }
                	}
                }
            }
		},
	    size: {
	        get: function () { return 2*this.__radius },
	        set: function (value) {
                if (2*this.__radius == value) return
                this.__radius = value/2
                if (this.__graph.fast) this.options[this.__realtype].radius = value/2
                if (this.__activated) {
                	if (this.__graph.fast) {
    	                this.__graph.__changed = true
                	} else {
		                var up = {}
                        if (this.__realtype == 'bar') {
                            return
                        } else if (this.__realtype == 'lines') {
                            up['line.width'] = value
                            up['marker.size'] = value
                        } else if (this.__realtype == 'markers') {
                            up['marker.size'] = value
                        }
		                this.__graph.__todo(up, this.__id)
                	}
                }
            }
		},
	    horizontal: {
	        get: function () { return this.__horizontal },
	        set: function (value) {
                if (this.__horizontal == value) return
                this.__horizontal = value
                if (this.__graph.fast) this.options[this.__realtype].horizontal = value
                if (this.__activated) {
                	if (this.__graph.fast) {
    	                this.__graph.__changed = true
                	} else {
		                if (value) this.__graph.__todo({'orientation':'h'}, this.__id)
		                else this.__graph.__todo({'orientation':'v'}, this.__id)
                	}
                }
            }
	    },
	    orientation: {
	        get: function () { 
	        	var ret = (this.__horizontal) ? 'h' : 'v'
	        	return ret
	        },
	        set: function (value) {
	        	var m = value.match(/([^\n])*/) // if there is an unassigned string following the call, there's extra stuff appended
	        	value = m[0]
                this.__orientation = value
                if (value == 'v') this.__horizontal = false
                else if (value == 'h') this.__horizontal = true
                else throw new Error("orientation must be either 'v' for vertical or 'h' for horizontal")
                if (this.__activated) {
                	if (this.__graph.fast) this.__graph.__changed = true
                	else this.__graph.__todo({'orientation':value}, this.__id)
                }
	        }
		},
	    dot: {
	        get: function () { return this.__dot },
	        set: function (value) {
	        	if (this.__activated) throw new Error("Cannot change gcurve dot after the gcurve has been activated.")
                if (this.__dot == value) return
                this.__dot = value               
            }
		},
		dot_color: {
	        get: function () { return this.__dot_color },
	        set: function (value) {
	        	if (!(value instanceof vec)) throw new Error("graph dot_color must be a vector.")
                if (this.__dot_color.equals(value)) return
                this.__dot_color = value
                var col = color.to_html(value)
            	if (this.__graph.fast) {
                    this.options.dot_color = col
                    this.__graph.__changed = true
            	} else if (this.__dotobject.__activated) {
	                var up = {}
	                up['marker.color'] = col
	                this.__graph.__todo(up, this.__dotobject.__id)
    			}
            }
		},
		dot_radius: {
	        get: function () { return this.__dot_radius },
	        set: function (value) {
                if (this.__dot_radius == value) return
                this.__dot_radius = value
                if (this.__graph.fast) {
                	this.options.dot_radius = value
                    this.__graph.__changed = true
                } else if (this.__dotobject.__activated) {
		                var up = {}
	                    up['marker.size'] = 2*value
		                this.__graph.__todo(up, this.__dotobject.__id)
	    		}
            }
		},
		visible: {
	        get: function () { return this.__visible },
	        set: function (value) {
                if (this.__visible == value) return
                this.__visible = value
                if (this.__activated) {
                	if (!this.__graph.fast) this.__graph.__todo({visible:value}, this.__id)
                	this.__graph.__changed = true
                }
            }
		}
    } ) // end gobject prototype
    
    function render_graph(grf) {
    	
    	function grender() {
    		window.requestAnimationFrame(grender)
        	grf.__update()
    	}
    	
    	grender() // start the rendering
    }
    
    function series(options) {
    	var ret = new gobject(options)
    	if (ret.dot) {
    		options = {type:'scatter', color:ret.__dot_color, radius:ret.__dot_radius}
    		ret.__dotobject = new gobject(options)
    	}
    	return ret
    }
    
    function gcurve(options) {
    	options = options || {}    	
    	options.type = 'lines'
    	if (options.pos !== undefined) { // we accept data instead of pos, and data now preferred in docs
    		options.data = options.pos
    		delete options.pos
    	}
    	if (options.size !== undefined) {
    		options.dot_radius = options.size/2
    		delete options.size
    	}
    	var ret = new gobject(options)
    	if (!ret.__graph.fast) {
	    	if (ret.dot ) ret.__dotobject = gdots({color:ret.__dot_color, radius:ret.__dot_radius, __lineobj:ret})
	    	if (ret.markers) ret.__markerobject = gdots({color:ret.__marker_color, radius:ret.__radius, __markerobj:ret})
		}
    	return ret
    }
    
    function gdots(options) {
    	options = options || {}
    	options.type = 'scatter'
    	if (options.pos !== undefined) { // we accept data instead of pos, and data now preferred in docs
    		options.data = options.pos
    		delete options.pos
    	}
    	return new gobject(options)
    }
    
    function gvbars(options) {
    	options = options || {}
    	options.type = 'bar'
    	options.horizontal = false
    	if (options.pos !== undefined) { // we accept data instead of pos, and data now preferred in docs
    		options.data = options.pos
    		delete options.pos
    	}
    	return new gobject(options)
    }
    
    function ghbars(options) {
    	options = options || {}
    	options.type = 'bar'
    	options.horizontal = true
    	if (options.pos !== undefined) { // we accept data instead of pos, and data now preferred in docs
    		options.data = options.pos
    		delete options.pos
    	}
    	return new gobject(options)
    }
    
    function ghistogram(options) {
    	throw new Error('ghistogram is not currently implemented in GlowScript.')
    }

    var exports = {
        graph: graph,
        vp_graph: graph, // backward compatibility with GlowScript 2.6
        gdisplay: graph,
        series: series,
        gcurve: gcurve,
        gdots: gdots,
        gvbars: gvbars,
        ghbars: ghbars,
        ghistogram: ghistogram
    }
    Export(exports)
})()