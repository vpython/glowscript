; (function () {
    "use strict";

// Font machinery by Kadir Haldenbilen, June 2016
// Adapted by Bruce Sherwood for use in GlowScript
// Tessellation with multiple holes, JavaScript version: https://github.com/r3mi/poly2tri.js
//   See GlowScript version of poly2tri.js, altered to work with both GlowScript and Jupyter
// For explanation of poly2tri, see
//   "Sweep-line algorithm for constrained Delaunay triangulation" by V. Domiter and and B. Zalik,
//   http://dl.acm.org/citation.cfm?id=1451778, and http://sites-final.uclouvain.be/mema/Poly2Tri
// Font manipulation: https://github.com/nodebox/opentype.js
// Public-domain sans serif font Roboto-Medium.ttf from http://www.1001freefonts.com/roboto.font
// Public-domain serif font NimbusRomNo9L-Med.otf from http://www.1001fonts.com/nimbus-roman-no9-l-font.html
// These fonts were chosen both for appearance and broad coverage (tested for Greek, Russian, Esperanto).
//   No Arabic, Hebrew, or Asian languages, alas
    
var font          // an opentype.js Font object
var otf           // true if an Open Type Font (.otf), else True Type Font (.tff)
var textobj = {}  // the object literal passed to text3D from primitives.py
var vert = {}     // attributes for vertex objects
var Hheights = {} // height/descent of an h for text.height = 1; entries are font_name: [Hheight, descent]
var Hheight       // height of current font
var length        // maximum length of the longest line, in real-world coordinates
var smooth = 0.95 // a bend is smooth if the bending angle has a cosine > smooth (less than about 18 degrees)
var meshes        // collect triangles and quads into meshes, then make compound(meshes)

function text3D(a) { // this factory function returns a compound object
    if (a.text == "" || a.text == undefined) throw new Error("A text object needs non-empty text")
	textobj.canvas = (a.canvas === undefined) ? canvas.selected : a.canvas
	textobj.text = a.text
	textobj.align = (a.align === undefined) ? 'left' : a.align
	textobj.height =  (a.height === undefined) ? 1 : a.height
	textobj.depth = (a.depth === undefined) ? 0.2*textobj.height : a.depth
	if (Math.abs(textobj.depth) < 0.01*textobj.height) textobj.depth = 0.01*textobj.height // avoid pathologies
	textobj.pos = vec(0,0,0)
    textobj.font = (a.font === undefined) ? 'sans' : a.font
    textobj.billboard = (a.billboard === undefined) ? false : a.billboard
	textobj.color = (a.color === undefined) ? vec(1,1,1) : vec(a.color)
	textobj.opacity = (a.opacity === undefined) ? 1 : a.opacity
	textobj.shininess = (a.shininess === undefined) ? 0.6 : a.shininess
	textobj.emissive = (a.emissive == undefined) ? false : a.emissive
    textobj.show_start_face = (a.show_start_face === undefined) ? true : a.show_start_face
    textobj.show_end_face = (a.show_end_face === undefined) ? true : a.show_end_face
    textobj.start_face_color = (a.start_face_color === undefined) ? textobj.color : vec(a.start_face_color)
    textobj.end_face_color = (a.end_face_color === undefined) ? textobj.color : vec(a.end_face_color)
    vert.color = textobj.color
    vert.emissive = textobj.emissive
	meshes = []
    // Esperanto characters that have diacritics, for testing Unicode: ĉĝĥĵŝŭĈĜĤĴŜŬ
	// Some lowercase Greek characters, for testing Unicode: αβγδεθλμνξοπρστφχψω
	// Some uppercase Russian characters, for testing Unicode: АБВГДЁЖЗЛЦЧШ
	
	otf = false
    if (textobj.font == 'sans') font = window.__font_sans
    else if (textobj.font == 'serif') {otf = true; font = window.__font_serif}
    else throw new Error('The text font must be either "sans" or "serif".')
	if (font === undefined) throw new Error('Font not available for text object.')
	var fullName = font.names.fullName.en
    if (Hheights[fullName] === undefined) {   // keep font data for re-use with later text objects
    	var h = processOneLine('h', 0, true) // the real-world height of an h is 1 for textobj.height = 1
    	var d = processOneLine('y', 0, true) // h-d is the real-world height of a y-descender for textobj.height = 1 (about 0.23)
    	Hheights[fullName] = [h, h-d]
    }
    Hheight = Hheights[fullName][0]
	var descent = Hheights[fullName][1]
    
    var lines = textobj.text.split('\n')
    var liney = 0 // construct display as though y == 0; then move the compound object
    var maxlength = 0
    for (var i=0; i<lines.length; i++) { // add triangles and quads to meshes
    	liney = -i*1.5*Hheight
    	processOneLine(lines[i], liney, false)
    	if (length > maxlength) maxlength = length  // note that length is a global variable defined above
    }
    
    var compattrs = {canvas:textobj.canvas}
    if (a.length !== undefined) compattrs.length = a.length
    var comp = compound(meshes, compattrs) // text object does not link size and axis
    
    var args = {canvas:textobj.canvas, __text:textobj.text, __align:textobj.align,
    	    __height:textobj.height, __depth:textobj.depth,
    	    __font:textobj.font, __billboard: textobj.billboard,
    	    __shininess:textobj.shininess, __emissive:textobj.emissive,
        	__show_start_face:textobj.show_start_face, __show_end_face:textobj.show_end_face, 
        	__start_face_color:textobj.start_face_color, __end_face_color:textobj.end_face_color,
    	    __length:maxlength, __descender:descent*textobj.height, __lines:lines.length}
    
    delete a.text
    delete a.align
    delete a.height
    delete a.depth
    delete a.pos
    delete a.font
    delete a.billboard
    delete a.show_start_face
    delete a.show_end_face
    delete a.start_face_color
    delete a.end_face_color
    for (var attr in a) args[attr] = a[attr] // includes user attributes
    return [comp, args]
}

function processOneLine(line, liney, returnymax) {
	length = 0
	var ymax = 0
    //if (Hheight === undefined)
    var textPath = font.getPath(line, 0, -liney, 1) // text, x, baseline y, font size in pixels
    // There exists Font.getPaths() that returns a list of paths.
    var commands = textPath.commands

    // Determine clockwiseness of every contour for every otf character:
    var set
    if (otf) set = fontInspect(line)
    var contoursT = [] // contours that are clockwise
    var contoursF = [] // contours that are counterclockwise

    var contours = []
    var contour = []
    var CW = [] // an entry of true means that contour is clockwise
    for (var i=0; i<commands.length; i++) {
        var cmd = commands[i]
        switch (cmd.type) { // start contour
            case 'M': // Move to
                if (contour.length > 0) { // a ttf file has a 'Z' only at the end of a character
                    var c0 = contour[0]
                    var c = contour[contour.length-1]
                    if (Point.equals(c0,c)) contour.pop() // poly2tri doesn't want this extra point
                    contours.push(contour)
                    CW.push(isCW(contour))
                }
                contour = []
            case 'L': // Line to
                contour.push(new Point(cmd.x, cmd.y))
                if (cmd.x > length) length = cmd.x
                if (cmd.y < ymax) ymax = cmd.y
                break
            case 'C': // Bezier
                var points = [contour.pop()]
                points.push(new Point(cmd.x1, cmd.y1))
                if (cmd.x1 > length) length = cmd.x1
                if (cmd.y1 < ymax) ymax = cmd.y1
                if (otf) {
                   points.push(new Point(cmd.x2, cmd.y2))
                   points.push(new Point(cmd.x, cmd.y))
                   if (cmd.x > length) length = cmd.x
                   if (cmd.y < ymax) ymax = cmd.y
                } else {
                   points.push(new Point(cmd.x, cmd.y))
                   points.push(new Point(cmd.x2, cmd.y2))
                   if (cmd.x2 > length) length = cmd.x2
                   if (cmd.y2 < ymax) ymax = cmd.y2
                }
                var Bpoints = addBezier(3, points, 8)
                contour = contour.concat(Bpoints)
                break
            case 'Q': // quadratic Bezier
                var points = [contour.pop()]
                points.push(new Point(cmd.x1, cmd.y1))
                points.push(new Point(cmd.x, cmd.y))
                if (cmd.x > length) length = cmd.x
                if (cmd.x1 > length) length = cmd.x1
                if (cmd.y < ymax) ymax = cmd.y
                if (cmd.y1 < ymax) ymax = cmd.y1
                var Bpoints = addBezier(2, points, 8)
                contour = contour.concat(Bpoints)
                break
            case 'Z': // end of a contour
                var c0 = contour[0]
                var c = contour[contour.length-1]
                if (Point.equals(c0,c)) contour.pop() // poly2tri doesn't want this extra point
                if (otf) {
                    if (isCW(contour)) {
                    	contoursT.push(contour)
                    	CW.push(true)
                    } else {
                    	contoursF.push(contour)
                    	CW.push(false)
                    }
                } else {
                    contours.push(contour)
                    CW.push(isCW(contour))
                }
                contour = []
                break
         }
    }

    if (returnymax) return -ymax
	length *= textobj.height/Hheight

    if (otf) {
        // Build expected contour structure for otf font before completing processing
       var expConts = []
       for (var ci=0; ci<line.length; ci++) {
       	   var c = line[ci]
           var clst = set[c] // list of clockwiseness of this character's contours
           var sum = clst.reduce(function(a, b) { return a + b }, 0)
           if (clst.length > 1  && sum/clst.length <= 0.51) {
               clst = clst.sort()
               clst = clst.reverse()
               expConts.push(clst)
           } else if (sum/clst.length < 0.80) {
               var ccharPath = font.getPath(c, 100, 300, 288) // text, x, baseline y, font size
               var ccommands = ccharPath["commands"]
               var ccontoursT = []
               var ccontoursF = []
               var ccontour = []
               for (var cmdi=0; cmdi<commands.length; cmdi++) {
            	   var cmd = commands[cmdi]
                   if (cmd.type == "M") {
                       ccontour = []
                       ccontour.push(new Point(cmd.x, cmd.y))
                   } else if (cmd.type === 'L' || cmd.type === 'C' || cmd.type === 'Q') {
                        ccontour.push(new Point(cmd.x, cmd.y))
                   } else if (cmd.type === 'Z') {
                        ccontour.push(ccontour[0])
                        if (isCW(ccontour)) ccontoursT.push(ccontour)
                        else  ccontoursF.push(ccontour)
                   }
               }

               for (var i=0; i<ccontoursT.length; i++) {
                   pp = [true]
                   for (var j=0; j<ccontoursF.length; j++) {
                       if (pinPoly(ccontoursT[i], ccontoursF[j][0])) pp.push(false)
                   }
                   expConts.push(pp)
               }
                  
           } else if (sum == clst.length) {
               for (var ppi=0; ppi<clst.length; ppi++) {
            	   var pp = clst[ppi]
            	   expConts.push([pp])
               }
           }
       }

       for (var i=0; i<expConts.length; i++) {
           var chContour = []
           for (var j=0; j<expConts[i].length; j++) {
               if (expConts[i][j]) chContour.push(contoursT.shift())
               else chContour.push(contoursF.shift())
           }
           contours.push(chContour)
       }

       return getContours(contours, CW, expConts)
   } else { // ttf
		return getContours(contours, CW, null)
   }

    function fontInspect(inputText) {
        // Return an object whose keys are the characters in the text
        // and each value is a list in order of the form [true, false, ....]
        // where true means a clockwise contour.
        var set = {}
        for (var i = 0; i < inputText.length; i++) set[inputText[i]] = true
        var keys = Object.keys(set)
        for (var chari=0; chari<keys.length; chari++) {
        	var char = keys[chari]
            var charPath = font.getPath(char, 100, 300, 288)
            var commands = charPath["commands"]
            set[char] = []
            for (var cmdi=0; cmdi<commands.length; cmdi++) {
            	var cmd = commands[cmdi]
                if (cmd.type == "M") {
                    contour = []
                    contour.push(new Point(cmd.x, cmd.y))
                } else if (cmd.type === 'L' || cmd.type === 'C' || cmd.type === 'Q') {
                     contour.push(new Point(cmd.x, cmd.y))
                } else if (cmd.type === 'Z') {
                     contour.push(contour[0])
                     set[char].push(isCW(contour));
                }
            }
        }
        return set
    }
}

function Bezier2(t,w){
    var t2 = t * t
    var mt = 1-t
    var mt2 = mt * mt
    return new Point(w[0].x*mt2 + w[1].x*2*mt*t + w[2].x*t2, w[0].y*mt2 + w[1].y*2*mt*t + w[2].y*t2)
}

function Bezier3(t,w){
    var t2 = t * t
    var t3 = t2 * t
    var mt = 1-t
    var mt2 = mt * mt
    var mt3 = mt2 * mt
    return new Point(w[0].x*mt3 + 3*w[1].x*mt2*t + 3*w[2].x*mt*t2 + w[3].x*t3, w[0].y*mt3 + 3*w[1].y*mt2*t + 3*w[2].y*mt*t2 + w[3].y*t3) 
}

function addBezier(nb, points, nt) {
    var newpoints = []
    for (var i=0; i<nt+1; i++) {
        var t = i/nt
        if (nb == 2) var np = Bezier2(t,points)
        else if (nb == 3) var np = Bezier3(t,points)
        newpoints.push(np)
    }
    return newpoints
}

function isCW(contour) {
     var area=0
     var i = 0
     while ( i < contour.length) {
          var j = (i + 1) % contour.length
          area += contour[i].x * contour[j].y
          area -= contour[j].x * contour[i].y
          i += 1
     }
     return (area < 0)
}
function getContours(contours, CW, expConts) {
	var dx = 0 // default shift in x for align = 'left'
    if (textobj.align == 'right') dx = -length
    else if (textobj.align == 'center') dx = -length/2
    var dz = textobj.depth
    if (otf) { // otf
        for (var i=0; i<contours.length; i++) {
            var chContour = contours[i]
            if (Point.equals(chContour[0][0], chContour[0][chContour[0].length-1])) chContour[0].pop()
            if (dz !== 0) meshes = meshes.concat(makeQuads(chContour[0], false, dx, dz))
            var swctx = new SweepContext(chContour[0])
            for (j=1; j<chContour.length; j++) {
                if (!expConts[i][j]) {
                    if (dz !== 0) meshes = meshes.concat(makeQuads(chContour[j], false, dx, dz))
                    if (Point.equals(chContour[j][0], chContour[j][chContour[j].length-1])) chContour[j].pop()
                    swctx.addHole(chContour[j])
                }
            }
            swctx.triangulate()
            var triangles = swctx.getTriangles()
            meshes = meshes.concat(makeTriangles(triangles, dx, dz))
        }
    } else { // ttf
        var conhole = []
        var con = []
        var i = 0
        while (i<contours.length) {
            var contour = contours[i]
            if (!isCW(contour)) {
                if (con.length > 0) conhole.push(con)
                con = [i]
            } else {
                con.push(i)
            }
            i += 1
        }
        conhole.push(con)
        for (var i=0; i<conhole.length; i++) {
            var con = conhole[i]
            if (dz !== 0) meshes = meshes.concat(makeQuads(contours[con[0]], false, dx, dz))
            var swctx = new SweepContext(contours[con[0]]) // outer contour
            for (var j=1; j<con.length; j++) {
                swctx.addHole(contours[con[j]]) // inner contour
                meshes = meshes.concat(makeQuads(contours[con[j]], CW[j], dx, dz))
            }
            swctx.triangulate()
            var triangles = swctx.getTriangles()
            meshes = meshes.concat(makeTriangles(triangles, dx, dz))
        }
    }
}

function f(p) {
	var val = 1000
	var ret = (Math.floor(p.x*val)/val).toString()+','+(Math.floor(p.y*val)/val).toString()+'   '
	return ret
}

function getShapeInfo(slist, inner) { // slist is list of 2D shape poly2tri.Point objects, inner = true if inner contour
	// For points in the shape xy plane, find pos and normal for needed vertex objects
	// Use 2D Point operations - add, sub, negate, cross, dot, normalize
	var shapeinfo = []
    if (!Point.equals(slist[slist.length-1],slist[0])) slist.push(slist[0]) // add duplicate point
    var L = slist.length
    var previous = Point.sub(slist[0],slist[L-2])
    var v
    for (var i=0; i<L; i++) {
    	if (i == L-1) v = Point.sub(slist[1],slist[0])
        else v = Point.sub(slist[i+1],slist[i])
        var a = new Point(previous.y,-previous.x)
        var b = new Point(v.y,-v.x)
        a.normalize()
        b.normalize()
        previous.normalize()
        v.normalize()
        if (inner) {
            a.negate() // inner skin has normals pointing inward
            b.negate()
        }
        var c = Point.dot(v,previous)
        var v1 = slist[i]
        if (c <= smooth) { // sharp corner
        	if (i === 0) {
        		shapeinfo.push({pos:vec(v1.x, v1.y, 0), normal:vec(b.x, -b.y, 0), smooth:false})
        	} else {
        		shapeinfo.push({pos:vec(v1.x, v1.y, 0), normal:vec(a.x, -a.y, 0), smooth:false})
        		// Except for the last point (paired with first point), a sharp corner needs two points:
        		if (i != L-1) shapeinfo.push({pos:vec(v1.x, v1.y, 0), normal:vec(b.x, -b.y, 0), smooth:false})
        	}
        } else { // smooth corner
            var n = Point.add(a,b)
            n.normalize()
            shapeinfo.push({pos:vec(v1.x, v1.y, 0), normal:vec(n.x, -n.y, 0), smooth:true})
        }
        previous = v
    }
    if (Point.equals(slist[slist.length-1],slist[0])) slist.pop() // remove duplicate point
    var s = shapeinfo
    return shapeinfo
}

function makeQuads(contour, inner, dx, dz) { // sides of the extruded text; inner = true if inner contour
	var shape = getShapeInfo(contour, inner) // list of {pos, normal, smooth}
	var K = textobj.height/Hheight
	var p0, p1, p2, p3, v0, v1, v2, v3, N0, N2
	var Qlist = []
	var z1 = 0   // back
	var z2 = dz  // front
	if (dz < 0) {
		z1 = dz
		z2 = 0
	}
	var lastsmooth = false
	for (var i=0; i<shape.length; i++) {
		var s = shape[i]
		if (!lastsmooth) {
			vert.pos = vec(K*s.pos.x+dx, -K*s.pos.y, z2)
			vert.normal = s.normal
			v0 = vertex(vert)
			vert.pos.z = z1
			v1 = vertex(vert)
			lastsmooth = true
			continue
		}
		vert.pos = vec(K*s.pos.x+dx, -K*s.pos.y, z1)
		vert.normal = s.normal
		v2 = vertex(vert)
		vert.pos.z = z2
		v3 = vertex(vert)
		var vs = [v0,v1,v2,v3]
		Qlist.push(quad({vs:[v0,v1,v2,v3]}))
		if (s.smooth) {
			v0 = v3
			v1 = v2
			lastsmooth = true
		} else lastsmooth = false
	}
	return Qlist
}

function makeTriangles(tris, dx, dz) { // front and back of text
	var K = textobj.height/Hheight
	var Tlist = []
	var z, t, p0, p1, p2, v0, v1, v2
    for (var ti=0; ti<tris.length; ti++) {
    	t = tris[ti]
    	p0 = t.getPoint(0)
    	p1 = t.getPoint(1)
    	p2 = t.getPoint(2)
    	z = dz
    	if (dz >= 0) z = 0
    	if (textobj.show_start_face) {
    		vert.color = textobj.start_face_color
    		if (dz >= 0) {
    			vert.normal = vec(0,0,-1)
    		} else {
    			vert.normal = vec(0,0,1)
    			z = 0
    		}
	    	vert.pos = vec(K*p0.x+dx,-K*p0.y,z) // start of extruded text
	    	v0 = vertex(vert)
	    	vert.pos = vec(K*p1.x+dx,-K*p1.y,z)
	    	v1 = vertex(vert)
	        vert.pos = vec(K*p2.x+dx,-K*p2.y,z)
	    	v2 = vertex(vert)
	    	Tlist.push(triangle({vs:[v0,v1,v2]}))
    	}
    	if (dz !== 0 && textobj.show_end_face) {
    		z = dz
    		vert.color = textobj.end_face_color
	    	if (dz > 0) {
	    		vert.normal = vec(0,0,1)
	    	} else {
	    		vert.normal = vec(0,0,-1)
	    	}
	    	vert.pos = vec(K*p0.x+dx,-K*p0.y,z) // end of extruded text
        	var v0 = vertex(vert)
        	vert.pos = vec(K*p1.x+dx,-K*p1.y,z)
        	var v1 = vertex(vert)
            vert.pos = vec(K*p2.x+dx,-K*p2.y,z)
        	var v2 = vertex(vert)
        	Tlist.push(triangle({vs:[v0,v1,v2]}))
    	}
    }
	vert.color = textobj.color // restore default color
	return Tlist
}

function pinPoly(contour, testp)
{
    var i = 0
    var j = 0
    var c = 0

    var nvert = contour.length
    for (i = 0, j = nvert-1; i < nvert; j = i++) {
        if ( ((contour[i].y > testp.y) != (contour[j].y > testp.y)) &&
            (testp.x < (contour[j].x-contour[i].x) * (testp.y-contour[i].y) / (contour[j].y-contour[i].y) + contour[i].x) ) {
            c = !c
        }
    }
    return c
}

function extrusion(args) {
    // Main stages in creating an extrusion of a shape along a path:
    //   Make list of all joints, with data about axes of preceding segment and axes of joint.
    //   Process shape: list 2D positions and normals (sharp turn => two positions and normals).
	//      There can be holes (inner contours) and multiple outer contours.
    //   Loop over joints, using their data to generate vertex objects and quads.
    //      If the turn is sharp, create two sets of vertex objects, with different normals.
    //      If the turn is gradual (not sharp), average the neighboring normals to smooth the joint.
    //   If the path is not closed, tessellate (divide into triangles) and apply to the ends of the path.
	// After creating all the vertices, quads, and triangles, return a compound object made from these.
	// This means that currently dynamics of an extrusion are restricted to changing standard object
	// attributes, not the path or shape.
    
	if (args.canvas !== undefined) args.canvas = args.canvas
    else args.canvas = canvas.get_selected()
    if (args.path === undefined) throw new Error('An extrusion object needs a path attribute.')
    if (args.shape === undefined) throw new Error('An extrusion object needs a shape attribute.')
    args.pos = (args.pos === undefined) ? null : args.pos
    args.axis = (args.axis === undefined) ? null : args.axis
    args.size = (args.size === undefined) ? null : args.size
    args.up = (args.up === undefined) ? vec(0,1,0) : norm(args.up)
    args.color = (args.color === undefined) ? color.white : args.color
    args.opacity = (args.opacity === undefined) ? 1 : args.opacity
    args.shininess = (args.shininess === undefined) ? 0.6 : args.shininess
    args.emissive = (args.emissive === undefined) ? false : args.emissive
    args.show_start_face = (args.show_start_face === undefined) ? true : args.show_start_face
    args.show_end_face = (args.show_end_face === undefined) ? true : args.show_end_face
    args.start_face_color = (args.start_face_color === undefined) ? args.color : args.start_face_color
    args.end_face_color = (args.end_face_color === undefined) ? args.color : args.end_face_color
    // Smooth the edges if cosine of difference angle is greater than 0.95 (less than 18 degrees)
    args.smooth = (args.smooth === undefined) ? 0.95 : args.smooth
    var vertices = []

    var shapeinfo = [] // elements of this list are {pos:p, normal:n, smooth:T/F} info for the given shape
    var quads = []

    var path_closed = args.path[args.path.length-1].equals(args.path[0])
    var sharps = [] // locations of sharp corners along the path
    var smoothangle = Math.acos(args.smooth)
   
    // Analyze the whole path before creating quads
    // Determine information about each joint between adjacent segments
    var joints = [] // Each joint: [A1, A2, sharp, pos, x, y, xaxis, yaxis, xaxis2, yaxis2, ltex]
    // x, y are normalized vectors in the plane of the joint; y is rotation axis
    // xaxis and xaxis2 are outward-pointing unit vectors at right angles to A1 and A2, lying in the A1-A2 plane
    // yaxis is norm(xaxis.cross(A1)), the "up" vector for A1; similarly for yaxis2
    // ltex is a number between 0 and 1 representing the distance along the path from the start of the path
    //    or from the most recent sharp bend to this joint, divided by the total distance between sharp bends.
    //    This is used for quad texture coordinates.
    var L = args.path.length
    var p = [args.path[0]]
    for (var i=1; i<L; i++) { // Eliminate duplicate points, at least for now
        if (args.path[i].equals(p[p.length-1])) continue
        else p.push(args.path[i])
    }
    L = args.path.length
    
    var x, y, ipath
    var A1, A2, sharp, xaxis, yaxis, xaxis2, yaxis2
    var ltex = 0
    var perp    // a unit vector perpendicular to the joint cross section
    var alpha   // angle between A1 and perp
    var theta   // angle between adjacent segments
    
    if (L < 2) throw new Error('An extrusion pos must contain more than one distinct point.')
    if (L == 2) { // a straight extrusion
        A1 = norm(p[1].sub(p[0]))
        yaxis = args.up
        xaxis = A1.cross(yaxis)
        if (xaxis.dot(xaxis) < 1e-10) {
            xaxis = yaxis.cross(vec(1,0,0))
            if (xaxis.dot(xaxis) < 1e-10) xaxis = yaxis.cross(vec(0,1,0))
        }
        xaxis = norm(xaxis)
        yaxis = xaxis.cross(A1)
        joints.push([A1, A1, true, p[0], xaxis, yaxis, xaxis, yaxis, xaxis, yaxis, 0])
        joints.push([A1, A1, true, p[1], xaxis, yaxis, xaxis, yaxis, xaxis, yaxis, 1])
    } else { // L >= 3 points
        for (ipath=0; ipath<L; ipath++) {
            if (ipath === 0) {
                A1 = p[1].sub(p[0])
                yaxis = args.up
                xaxis = A1.cross(yaxis)
                if (xaxis.dot(xaxis) < 1e-10) {
                    xaxis = yaxis.cross(vec(1,0,0))
                    if (xaxis.dot(xaxis) < 1e-10) xaxis = yaxis.cross(vec(0,1,0))
                }
                xaxis = norm(xaxis)
                yaxis = norm(xaxis.cross(A1))
                joints.push([A1, A1, true, p[ipath], xaxis, yaxis, xaxis, yaxis, xaxis, yaxis, 0])
                if (!path_closed) {
                	sharps.push(0)
                	continue
                }
            } else if (ipath == L-1) { // last point on path
                A1 = p[ipath].sub(p[ipath-1])
                ltex += mag(A1)
                if  (path_closed) {
                    theta = A1.diff_angle(joints[0][0]) // bend from last segment to first segment
                    sharp = (theta >= smoothangle) // if true, path takes a sharp turn here
                    if (sharp) sharps.push(ipath)
                    var jcopy = []
                    // For a closed path, it's convenient to add a copy of the first point:
                    for (var j=0; j<joints[0].length; j++) jcopy.push(joints[0][j])
                    joints.push(jcopy)
                    joints[joints.length-1][10] = ltex
                } else {
                    x = xaxis // xaxis and sharp still have values from next to last joint
                    sharps.push(ipath)
                    joints.push([A1, A1, true, p[ipath], x, yaxis, xaxis, yaxis, xaxis, yaxis, ltex])
                }
                continue
            }
            if (ipath === 0) { // closed path; note statement above: if (!path_closed) continue
                A1 = p[0].sub(p[L-2])
                A2 = p[1].sub(p[0])
            } else {
                A1 = p[ipath].sub(p[ipath-1])
                A2 = p[ipath+1].sub(p[ipath])
            }
            theta = A2.diff_angle(A1)
            sharp = (theta >= smoothangle) // if true, path takes a sharp turn here
            if (ipath > 0) ltex += mag(A1)
            y = norm(A1.cross(A2))
            perp = norm(norm(A1).add(norm(A2)))
            alpha = theta/2
            x = norm(y.cross(perp))
            xaxis2 = xaxis.rotate({angle:theta, axis:y})
            yaxis2 = norm(xaxis2.cross(A2))
            if (ipath === 0) { // closed path; revise initial joint based on bend between final and initial segment
            	var jnt = joints[0]
                jnt[0] = A1
                jnt[1] = A2
                jnt[2] = sharp
                jnt[4] = x
                jnt[5] = y
                jnt[6] = xaxis.rotate({angle:-theta, axis:y}) // xaxis for final segment
                jnt[7] = yaxis
                jnt[10] = 0
                continue
            }
            joints.push([A1, A2, sharp, p[ipath], x, y, xaxis, yaxis, xaxis2, yaxis2, ltex])
            // A sharp corner has two joints (same positions, different normals):
            if (sharp) {
            	sharps.push(joints.length-1)
            	joints.push([A1, A2, sharp, p[ipath], x, y, xaxis, yaxis, xaxis2, yaxis2, ltex])
            }
            xaxis = xaxis2
            yaxis = yaxis2
        }

        var i, j, starti, start, endi, end, L
        if (sharps.length === 0) {
        	if (path_closed) {
	        	for (j=1; j<joints.length; j++) {// find midpoint along the path
	        		if (Math.abs(joints[j][10] - ltex/2) < 0.001*ltex) break // very close to midpoint
	        		if (joints[j][10] > ltex/2) {
	        			j -= 1 // past the midpoint, back up
	        			break
	        		}
	        	}
	        	end = joints[j][10]
	        	for (i=0; i<=j; i++) joints[i][10] /= end
	        	L = ltex-end
	        	for (i=j+1; i<joints.length; i++) {
	        		joints[i][10] = 1 - (joints[i][10]-end)/L
	        	}
        	} else {
        		for (i=0; i<joints.length; i++) joints[i][10] /= ltex
        	}
        } else {
        	j = 0
        	start = 0
        	starti = 0
	        while (j<sharps.length) { // Each joint: [A1, A2, sharp, pos, x, y, xaxis, yaxis, xaxis2, yaxis2, ltex]
	        	endi = sharps[j]
	        	end = joints[endi][10]
	        	L = end-start
	        	for (var k=starti; k<=endi; k++) joints[k][10] = (joints[k][10]-start)/L
	        	start = end
	        	starti = endi+1
	        	j++
	        	if (j == sharps.length && path_closed) {
	        		L = joints[0][10]-start
	        		for (var k=starti; k<joints.length; k++) joints[k][10] = (joints[k][10]-start)/L
	        	}
	        }
        }
    } // end of determining information about joints
    
    var contours = args.shape
    var n = level(contours) // 1, 2, or 3 levels of lists
    var xmin, xmax, ymin, ymax
    
    // Find bounding box for the superposition of all the outer shapes, for determining texture coordinates
    if (n == 1) bounding_box([contours]) // one outer shape, no inner shapes
    else if (n == 2) bounding_box([contours[0]]) // one outer shape, possibly with inner shapes
    else { // n == 3; multiple outer shapes, possibly with inner shapes
        var shs = []
    	for (var nn=0; nn<contours.length; nn++) shs.push(contours[nn][0])
    	bounding_box(shs)
    }
    
    if (n == 1) { // one outer shape, no inner shapes
    	contours = [contours]
    	make_quads(contours[0], true)
    	endfaces(contours)
    } else if (n == 2) { // one outer shape, possibly with inner shapes
	    for (var nc=0; nc<contours.length; nc++) {
	    	make_quads(contours[nc], nc===0) // 0th contour is an outer contour; others are inner
	    }
	    endfaces(contours)
    } else { // n == 3; multiple outer shapes, possibly with inner shapes
    	for (var nn=0; nn<contours.length; nn++) {
    		var c = contours[nn]
	        for (var nc=0; nc<c.length; nc++) {
	        	make_quads(c[nc], nc===0) // 0th contour is an outer shape; others are inner
	        }
	        endfaces(c)
    	}
    }

    delete args.path  // compound has no need of the path
    delete args.shape // compound has no need of the shape
    delete args.start_face_color
    delete args.end_face_color
    delete args.show_start_face
    delete args.show_end_face
    delete args.color  // don't overwrite start and end face colors
    delete args.smooth
    delete args.up
    if (args.pos === null) delete args.pos
    if (args.axis === null) delete args.axis
    if (args.size === null) delete args.size
    if (window.__GSlang == 'vpython') return vp_compound(quads, args)
    else return compound(quads, args)

    function level(a) {
    	// Determine format of shape specification:
        //    return 1 if a = [S, S, ...] where S is [x,y]
        //    return 2 if a = [ [S, S, ... ], [S, S, ...], [S, S, ...] ]
        //    return 3 if a = [ [ [S, S, ... ], [S, S, ...], [S, S, ...] ],
        //                      [ [S, S, ... ], [S, S, ...], [S, S, ...] ], ... ]
        if (a.length === undefined) throw new Error("A shape must be a list of [x,y] elements.")
        if (typeof a[0] == 'number') throw new Error("A shape must be a list of [x,y] elements.")
        if (typeof a[0][0] == 'number') return 1
        if (typeof a[0][0][0] == 'number') return 2
        if (typeof a[0][0][0][0] == 'number') return 3
        throw new Error("A shape must be a list of lists of [x,y] elements.")
    }
    
    function bounding_box(shs) {
    	// Determine bounding box for a 2D shape (called for all the shapes to be extruded)
    	for (var i=0; i<shs.length; i++) {
    		var ystart = null
    		var shapemin = null
    		for (var j=0; j<shs[i].length-1; j++) {
    			var p = shs[i][j]
    			var x = p[0]
    			var y = p[1]
    			xmin = (xmin === undefined) ? x : Math.min(x,xmin)
    	    	xmax = (xmax === undefined) ? x : Math.max(x,xmax)
    	    	ymin = (ymin === undefined) ? y : Math.min(y,ymin)
    	    	ymax = (ymax === undefined) ? y : Math.max(y,ymax)
    		}
    	}
    }

    function find_shape_info(contour, outside) {
    	// For points in the 2D shape xy plane, find pos and normal for needed vertex objects.
        // outside is true if this is an outer contour.
    	var slist = []
        for (var i=0; i<contour.length; i++) slist.push(vec(contour[i][0], contour[i][1], 0))
        var shape_closed = slist[slist.length-1].equals(slist[0])
        if (!shape_closed) throw new Error("An extrusion shape must be a closed curve.")
    	shapeinfo = []
        var out = vec(0,0,1)
        var L = slist.length
        var firstsharp = null
        var totallength = 0
        var vs = [], lengths=[], i, v
        
        // Identify that corner of the shape that is the lowest point (minimum y)
        var miny, minyi
        for (i=0; i<L-1; i++) { // create list of vectors, calculate total length of the shape
        	v = slist[i+1].sub(slist[i])
        	if (miny === undefined || slist[i].y < miny) { // find location of lowest point
        		miny = slist[i].y
        		minyi = i
        	}
        	var magv = mag(v)
        	totallength += magv
        	vs.push(v)
        	lengths.push(magv)
        }
    	// texval will be a list of texel values for the shape corners from 0 to 1 and back to 0,
    	// for two copies of the texture along the sides of the extrusion; they meet at
    	// two places with equal pixel patterns
        var texval = []
        for (i=0; i<lengths.length; i++) {
        	lengths[i] /= totallength
        	texval.push(0)
        }
        var d = 0 // distance along circumference from minyi to one less than the corner where d > 0.5
        var np = 0 // number of corners spanned by d
        for (i=0; i<lengths.length; i++) {
        	var j = (minyi+i) % lengths.length
        	d += lengths[j]
        	if (d > 0.5) {
        		d -= lengths[j]
        		break
        	}
        	np += 1
        }
    	// minyi and j are the starting and ending indices of the corners spanning the first texture
        var d2 = 0
        for (i=0; i<np; i++) { // y from 0 to 1
        	var k = (minyi+i+1) % lengths.length
        	d2 += lengths[k]
        	texval[k] = d2/d
        }
        d2 = 0
        for (i=0; i<lengths.length-np; i++) { // y from 1 back down to 0
        	var k = (j+i+1) % lengths.length
        	d2 += lengths[k]
        	texval[k] = 1-d2/(1-d)
        }
        
        var previous = vs[vs.length-1]
        var second = false // true when texpos decreasing from 1 to 0
        for (i=0; i<L-1; i++) {
            v = vs[i]
            var len = lengths[i]
            var a = previous.cross(out).norm()
            var b = v.cross(out).norm()
            if (!outside) {
                a = a.multiply(-1) // inner skin has normals pointing inward
                b = b.multiply(-1)
            }
            var c = norm(v).dot(norm(previous))
            var v1 = slist[i]
            if (c <= args.smooth) { // sharp corner
                if (i === 0) firstsharp = {pos:v1, normal:a, smooth:false, length:texval[i]}
                else shapeinfo.push({pos:v1, normal:a, smooth:false, length:texval[i]})
                shapeinfo.push({pos:v1, normal:b, smooth:false, length:texval[i]})
            } else { // smooth corner
                var n = norm(a.add(b))
                shapeinfo.push({pos:v1, normal:n, smooth:true, length:texval[i]})
            }
            previous = v
        }
        if (firstsharp !== null) shapeinfo.push(firstsharp)
    }

    function generate_vertices(p,x,y,nx,ny,nx2,ny2,sharp,makequads,ltex) { 
    	// Generate vertices at a joint, used to make quads for the sides of the extrusion.
        // path p, x and y axes in shape plane.
        // nx, ny are unit vectors perpendicular to path.
        // nx2, ny2 are unit vectors perpendicular to path in the next segment.
        // A vertex pos relative to the shape's center is expressed in terms
        //    of nx and ny as pos = a*nx + b*ny + c*A, where A points along the path.
        // The same pos in terms of x and y is pos = aa*x + bb*y = a*nx + b*ny + c*A.
        // Dot this equation into nx and ny, where dot(nx,A) and dot(ny,A) are zero, then solve for aa and bb.
    	for (i=0; i<2; i++) { // must run through this twice if sharp is false, to average normals
            if (i == 1) { // second pass with sharp false uses nx/ny axes of second segment
                nx = nx2
                ny = ny2
            }
            var c1 = dot(y,ny)
            var c2 = dot(y,nx)
            var c3 = dot(x,ny)
            var c4 = dot(x,nx)
            var d = c1*c4 - c2*c3
            var info, v, n, N, a, b, aa, bb, xmin, xmax, ymin, ymax, y
            var V = shapeinfo.length
            for (var k=0; k<V; k++) {
                info = shapeinfo[k]
                a = info.pos.x
                b = info.pos.y
                aa = (a*c1 - b*c2)/d
                bb = (b*c4 - a*c3)/d
                v = p.add(x.multiply(aa).add(y.multiply(bb))) // p + aa*x + bb*y
                n = info.normal
                N = norm(nx.multiply(n.x).add(ny.multiply(n.y)))
                if (i === 0) { // first pass
                    //arrow({pos:v, axis_and_length:0.3*N, color:color.orange})
                    vertices.push(vertex({pos:v, normal:N, color:args.color, texpos:vec(ltex,info.length,0)}))
                } else { // second pass; sharp = false, must average normals
                    vertices[vertices.length-V+k].normal = norm(vertices[vertices.length-V+k].normal.add(N))
                    //arrow({pos:v, axis_and_length:0.3*vertices[vertices.length-V+k].normal, color:color.cyan})
                }
            }
            if (sharp) break
        }
        if (makequads) {
            var start = vertices.length-2*V
            for (var k=start; k<start+V; k++) {
                if (k == start+V-1) {
                    quads.push(quad({v0:vertices[k], v1:vertices[k+V], v2:vertices[start+V], v3:vertices[start]}))
                } else {
                    quads.push(quad({v0:vertices[k], v1:vertices[k+V], v2:vertices[k+V+1], v3:vertices[k+1]}))
                    if (!shapeinfo[k-start+1].smooth) k++
                }
            }
        }
    } // end of generate_vertices()
    
    function make_quads(contour, outside) { // if outside is true, this is an outer contour
    	// Call generate_vertices() to create quads for the sides of the extrusion.
        if (outside || !path_closed) {
            find_shape_info(contour, outside)
        } else return
        // Now we have all the information about all the joints and can generate quads
        // generate_vertices(p,x,y,nx,ny,nx2,ny2,sharp,makequads)
        var pp, pos
        L = joints.length
        for (ipath=0; ipath<L; ipath++) {
            pp = joints[ipath] // [A1, A2, sharp, pos, x, y, xaxis, yaxis, xaxis2, yaxis2, ltex]
            A1 = pp[0]
            A2 = pp[1]
            sharp = pp[2]
            pos = pp[3]
            x = pp[4]
            y = pp[5]
            xaxis = pp[6]
            yaxis = pp[7]
            xaxis2 = pp[8]
            yaxis2 = pp[9]
            ltex = pp[10]
            if (ipath === 0) {
                if (sharp) generate_vertices(pos,x,y,xaxis2,yaxis2,xaxis2,yaxis2,sharp,false,0)
                else generate_vertices(pos,x,y,xaxis,yaxis,xaxis2,yaxis2,sharp,false,0)
            } else if (ipath == L-1) {
                if (path_closed) {
                    pp = joints[0]
                    sharp = pp[2]
                    pos = pp[3]
                    x = pp[4]
                    y = pp[5]
                    xaxis = pp[6]
                    yaxis = pp[7]
                    xaxis2 = pp[8]
                    yaxis2 = pp[9]
                    ltex = pp[10]
                    generate_vertices(pos,x,y,xaxis,yaxis,xaxis2,yaxis2,sharp,true,ltex)
                } else generate_vertices(pos,x,y,xaxis,yaxis,xaxis2,yaxis2,sharp,true,ltex)
            } else if (sharp) { // sharp corner
                if (ipath > 0) generate_vertices(pos,x,y,xaxis,yaxis,xaxis2,yaxis2,true,true,1)
                if (ipath < L-1) generate_vertices(pos,x,y,xaxis2,yaxis2,xaxis2,yaxis2,true,false,0)
            } else { // smooth corner
                generate_vertices(pos,x,y,xaxis,yaxis,xaxis2,yaxis2,false,ipath>0,ltex)
            }
        }
    } // end of make_quads

    function tessellate(contours) {
    	// Use the poly2tri.js library to divide a 2D shape with possible holes into triangles.
    	// Not called if the path is closed (so no end caps need to be displayed).
        var i, j, endsave=null
        var c = contours[0]
        // poly2tri.js does not accept duplicate points:
        if (c[0][0] === c[c.length-1][0] && c[0][1] === c[c.length-1][1]) endsave = c.pop()
        
        // Create poly2tri.js element for outer contour:
        var pts = []
        for (i=0; i<c.length; i++) pts.push(new Point(c[i][0], c[i][1]))
        var swctx = new SweepContext(pts)
        
        // Create poly2tri.js element for inner contours:
        for (j=1; j<contours.length; j++) {
        	c = contours[j]
            if (c[0][0] === c[c.length-1][0] && c[0][1] === c[c.length-1][1]) c.pop()
            pts = []
            for (i=0; i<contours[j].length; i++) pts.push(new Point(c[i][0], c[i][1]))
            swctx.addHole(pts)
        }
        if (endsave !== null) c.push(endsave) // restore last contour point
        
        function texpos(p) { // evalulate texture coordinates, using bounding box info
        	var x=p.x, y=p.y
        	return vec((x-xmin)/(xmax-xmin), (y-ymin)/(ymax-ymin), 0)
        }

        swctx.triangulate() // poly2tri.js generates triangles
        var tris = swctx.getTriangles() // fetch the triangle vertices
        var p0, p1, p2, t
        var N = vec(0,0,1)
        var tri_indices = []  // vertex indices of triangles
        for (i=0; i<tris.length; i++) {
        	t = tris[i]
        	p0 = t.getPoint(0)
        	p1 = t.getPoint(1)
        	p2 = t.getPoint(2)
        	vertices.push(vertex({pos:vec(p0.x, p0.y, 0), normal:N, texpos:texpos(p0)}))
        	vertices.push(vertex({pos:vec(p1.x, p1.y, 0), normal:N, texpos:texpos(p1)}))
        	vertices.push(vertex({pos:vec(p2.x, p2.y, 0), normal:N, texpos:texpos(p2)}))
        	tri_indices.push([3*i, 3*i+1, 3*i+2])
        }
        return tri_indices // [ [i,j,k], [l,m,n] .....] vertex indices of triangles
    }

	function endfaces(contours) {
		// For a non-closed path, create triangles for the starting and ending faces (unless asked not to)
	    if (!path_closed && (args.show_start_face || args.show_end_face)) { // add faces to beginning and end of extrusion path
	    	var T, js, start=vertices.length // tesselate() will add vertices to this list
	        T = tessellate(contours)
	        var faces = []
	        var L = vertices.length - start
	        if (args.show_start_face && !path_closed) {
	            var jnt = joints[0] // Each joint: [A1, A2, sharp, pos, x, y, xaxis, yaxis, xaxis2, yaxis2]
	            var p = jnt[3] // pos
	            var N = jnt[0] // A1
	            N = N.multiply(-1) // A1 points inward on beginning face
	            var x = jnt[4]
	            var y = jnt[5]
	            for (var k=0; k<L; k++) {
	                var vert = vertices[start+k]
	                faces.push([vert.pos.x, vert.pos.y])
	                var v = p.add(x.multiply(vert.pos.x).add(y.multiply(vert.pos.y)))
	                vertices[start+k].pos = v
	                vertices[start+k].normal = N
	                vertices[start+k].color = args.start_face_color
	            }
	            for (var vi=0; vi<T.length; vi++) {
	                var vs = T[vi]
	                quads.push( triangle({vs:[ vertices[start+vs[0]], vertices[start+vs[1]], vertices[start+vs[2]] ]}) )
	            }
	        }
	        if (args.show_end_face && !path_closed) {
	            var jnt = joints[joints.length-1]
	            var p = jnt[3] // pos
	            var N = jnt[0] // A1
	            var x = jnt[4]
	            var y = jnt[5]
	            for (var k=0; k<L; k++) {
	                if (!args.show_start_face) { // already have vertices we can use
	                    var vert = vertices[start+k]
	                    vert.color = args.end_face_color
	                    var v = p.add(x.multiply(vert.pos.x).add(y.multiply(vert.pos.y)))
	                    vertices[start+k].pos = v
	                    vertices[start+k].normal = N
	                } else { // need to create additional vertices
	                    var vert = faces[k]
	                    var v = p.add(x.multiply(vert[0]).add(y.multiply(vert[1])))
	                    vertices.push(vertex({pos:v, normal:N, color:args.end_face_color, texpos:vertices[start+k].texpos}))
	                }
	            }
	            if (args.show_start_face) start += L
	            for (var vi=0; vi<T.length; vi++) {
	                var vs = T[vi]
	                quads.push( triangle({vs:[ vertices[start+vs[0]], vertices[start+vs[1]], vertices[start+vs[2]] ]}) )
	            }
	        }
	    }
	}
} // end of extrusion()

var exports = {
	text3D: text3D,
    extrusion: extrusion
}

Export(exports)

})()