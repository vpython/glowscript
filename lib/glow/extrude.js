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

function text3D(a) { // this factory function returns a compound object, as though text.pos is <0,0,0>
    if (a.text == "" || a.text == undefined) throw new Error("A text object needs non-empty text")
    textobj.canvas = (a.canvas === undefined) ? canvas.selected : a.canvas
    vert.canvas = textobj.canvas
    textobj.text = a.text
	textobj.align = (a.align === undefined) ? 'left' : a.align
	textobj.height =  (a.height === undefined) ? 1 : a.height
	textobj.depth = (a.depth === undefined) ? 0.2*textobj.height : a.depth
	if (Math.abs(textobj.depth) < 0.01*textobj.height) textobj.depth = 0.01*textobj.height // avoid pathologies
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
    //var comp = new compound(meshes, compattrs) // text object does not link size and axis
    var comp = new compound(meshes)
    
    var args = {canvas:textobj.canvas, __text:textobj.text, __align:textobj.align,
    	    __height:textobj.height, __depth:textobj.depth, __length:length,
    	    __font:textobj.font, __billboard: textobj.billboard, __color:textobj.color,
    	    shininess:textobj.shininess, emissive:textobj.emissive, opacity:textobj.opacity,
        	__show_start_face:textobj.show_start_face, __show_end_face:textobj.show_end_face, 
        	__start_face_color:textobj.start_face_color, __end_face_color:textobj.end_face_color,
    	    __descender:descent*textobj.height, __lines:lines.length}
    
    delete a.text
    delete a.align
    delete a.height
    delete a.depth
    delete a.font
    delete a.billboard
    delete a.color
    delete a.opacity
    delete a.shininess
    delete a.emissive
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
    //   Make list of all joints, with their properties.
    //   Make list of the 2D shape positions, with their properties.
	//      There can be holes (inner contours) and multiple outer contours.
    //   Loop over joints.
    //      If the turn is sharp, create two sets of vertex objects, with different normals.
    //      If the turn is gradual (not sharp), average the neighboring normals to smooth the joint.
    //   If the path is not closed, tessellate (divide into triangles) and apply to the ends of the path.
	// After creating all the quads and triangles, return a compound object made from these.

    // Implemented December 2020 - March 2021 by Bruce Sherwood: 
    // Major restructuring of the extrusion code, making it feasible to implement
    // scale, xscale, yscale, color, and twist that can be lists (length must equal number of joints)
    // or single values which then apply all along the path.
    // Also newly implemented: start_normal, end_normal, smooth_joints, sharp_joints. 
    
    if (args.canvas === undefined) args.canvas = canvas.get_selected()
    if (args.path === undefined) throw new Error('An extrusion object needs a path attribute.')
    if (args.path.length < 2) throw new Error('The path must have more than one point.')
    var path_closed = args.path[args.path.length-1].equals(args.path[0])
    if (args.shape === undefined) throw new Error('An extrusion object needs a shape attribute.')
    args.pos = (args.pos === undefined) ? null : args.pos
    args.axis = (args.axis === undefined) ? null : args.axis
    args.up = (args.up === undefined) ? vec(0,1,0) : args.up.norm()
    let first_segment = (args.path[1].sub(args.path[0])).norm()
    if (first_segment.cross(args.up).mag < 0.1)  { // construct args.up to be perpendicular to first_segment
        if (args.up.cross(vec(0,1,0)).mag > 0.2) { // try making args.up be vec(0,1,0)
            args.up = vec(0,1,0)
        } else if (args.up.cross(vec(1,0,0)).mag > 0.2) { // try making args.up be vec(1,0,0)
            args.up = vec(1,0,0)
        } else if (args.up.cross(vec(0,0,1)).mag > 0.2) { // try making args.up be vec(0,0,1)
            args.up = vec(0,0,1)
        }
    }

    args.color = (args.color === undefined) ? color.white : args.color
    args.twist = (args.twist === undefined) ? 0 : args.twist
    args.opacity = (args.opacity === undefined) ? 1 : args.opacity
    args.shininess = (args.shininess === undefined) ? 0.6 : args.shininess
    args.emissive = (args.emissive === undefined) ? false : args.emissive
    args.sharp_joints = (args.sharp_joints === undefined) ? [] : args.sharp_joints
    args.smooth_joints = (args.smooth_joints === undefined) ? [] : args.smooth_joints
    if (args.sharp_joints.length === undefined) throw new Error("sharp_joints must be a list of path indexes.")
    if (args.smooth_joints.length === undefined) throw new Error("smooth_joints must be a list of path indexes.")

    if (path_closed) {
        if (args.show_start_face !== undefined) throw new Error("Cannot specify show_start_face for a closed-path extrusion.")
        if (args.show_end_face !== undefined) throw new Error("Cannot specify show_end_face for a closed-path extrusion.")
        if (args.start_face_color !== undefined) throw new Error("Cannot specify start_face_color for a closed-path extrusion.")
        if (args.end_face_color !== undefined) throw new Error("Cannot specify end_face_color for a closed-path extrusion.")
        if (args.start_normal !== undefined) throw new Error("Cannot specify start_normal for a closed-path extrusion.")
        if (args.end_normal !== undefined) throw new Error("Cannot specify end_normal for a closed-path extrusion.")
    }

    args.start_normal = (args.start_normal === undefined) ? null : args.start_normal
    args.end_normal = (args.end_normal === undefined) ? null : args.end_normal
    args.show_start_face = (args.show_start_face === undefined) ? true : args.show_start_face
    args.show_end_face = (args.show_end_face === undefined) ? true : args.show_end_face

    // Smooth the edges if cosine of difference angle is greater than 0.95 (less than 18 degrees)
    args.smooth = (args.smooth === undefined) ? 0.95 : args.smooth

    let slen, i, n
    if (args.scale !== undefined) {
        if (typeof args.scale === 'number') {
            n = args.scale
            args.scale = []
            for (i=0; i<args.path.length; i++) args.scale.push(n)
        } else {
            slen = args.scale.length
            if (slen !== args.path.length) 
                throw new Error('The length '+slen+' of the list of scale values does not match the length '+args.path.length+' of the path.')
            if (path_closed && (args.scale[slen-1] !== args.scale[0]))
                throw new Error('With a closed path, the last scale value, '+args.scale[slen-1]+', must equal the first scale value, '+args.scale[0]+'.')
        }
    } else args.scale = null
    if (args.xscale !== undefined) {
        if (args.scale !== null) throw new Error('One cannot specify both "scale" and "xscale".')
        if (typeof args.xscale === 'number') {
            n = args.xscale
            args.xscale = []
            for (i=0; i<args.path.length; i++) args.xscale.push(n)
        } else {
            slen = args.xscale.length
            if (slen !== args.path.length) 
                throw new Error('The length '+slen+' of the list of xscale values does not match the length '+args.path.length+' of the path.')
            if (path_closed && (args.xscale[slen-1] !== args.xscale[0]))
                throw new Error('With a closed path, the last xscale value, '+args.xscale[slen-1]+', must equal the first xscale value, '+args.xscale[0]+'.')
        }
    } else args.xscale = null
    if (args.yscale !== undefined) {
        if (args.scale !== null) throw new Error('One cannot specify both "scale" and "yscale".')
        if (typeof args.yscale === 'number') {
            n = args.yscale
            args.yscale = []
            for (i=0; i<args.path.length; i++) args.yscale.push(n)
        } else {
            slen = args.yscale.length
            if (slen !== args.path.length) 
                throw new Error('The length '+slen+' of the list of yscale values does not match the length '+args.path.length+' of the path.')
            if (path_closed && (args.yscale[slen-1] !== args.yscale[0]))
                throw new Error('With a closed path, the last yscale value, '+args.yscale[slen-1]+', must equal the first yscale value, '+args.yscale[0]+'.')
        }
    } else args.yscale = null

    if (args.color instanceof vec) {
        n = args.color
        args.color = []
        for (i=0; i<args.path.length; i++) args.color.push(n)
    } else {
        slen = args.color.length
        if (slen !== args.path.length)
            throw new Error('The length '+slen+' of the list of color values does not match the length '+args.path.length+' of the path.')
    }
    
    args.start_face_color = (args.start_face_color === undefined) ? args.color[0] : args.start_face_color
    args.end_face_color = (args.end_face_color === undefined) ? args.color[args.color.length-1] : args.end_face_color

    let tw = args.twist
    args.twist = []
    let total = 0
    if (typeof tw === 'number') {
        args.twist.push(0)
        for (i=1; i<args.path.length; i++) {
            args.twist.push(total+tw)
            total += tw
        }
    } else {
        slen = tw.length
        if (slen !== args.path.length)
            throw new Error('The length '+slen+' of the list of twist values does not match the length '+args.path.length+' of the path.')
        for (i=0; i<args.path.length; i++) {
            args.twist.push(total+tw[i])
            total += tw[i]
        }
    }

    let shapeinfo = []    // elements of this list are {pos:p, normal:n, smooth:T/F} info for the given shape
    let quads = []        // quads made from triangles (which are made from vertex objects) to form the sides of a segment
    let starting_quad = 0 // quads[starting_quad] is first quad of current path
    let Ls                // Ls is number of points in shape
    let shapecount        // shapecount is Ls + the number of repeats of shape sharp corners

    let smoothangle = Math.acos(args.smooth) // determines whether a joint is rendered as sharp or smooth

    if (path_closed) args.path.pop()
    let L = args.path.length
    let p = [] // points along the path
    let xs = [], ys = []
    for (let i=0; i<L; i++) {
        if (i > 0 && i <args.path.length-1 ) {
            let a = args.path[i].sub(args.path[i-1])
            let b = args.path[i+1].sub(args.path[i])
        }
        p.push(args.path[i])
        if (args.scale !== null)  {
            xs.push(args.scale[i])
            ys.push(args.scale[i])
        } else {
            if (args.xscale !== null) xs.push(args.xscale[i])
            else xs.push(1)
            if (args.yscale !== null) ys.push(args.yscale[i])
            else ys.push(1)
        }
    }
    L = p.length
    if (L < 2) throw new Error('An extrusion path must contain more than one distinct point.')
    let start_normal, end_normal, theta, A, extraA, axis, x, y, z

    // Deal with normals to the end caps:
    if (!path_closed) {
        z = p[1].sub(p[0]) // points inward
        y = norm(args.up)
        x = norm(z.cross(y))
        start_normal = z
        if (args.start_normal !== null) start_normal = args.start_normal.multiply(-1) // points inward
        if (!norm(start_normal).equals(norm(z))) {
            axis = z.cross(start_normal)
            theta = 2*start_normal.diff_angle(z)
            x = x.rotate({angle:theta, axis:axis})
            y = y.rotate({angle:theta, axis:axis})
            z = z.rotate({angle:theta, axis:axis})
        }

        A = p[L-1].sub(p[L-2])
        end_normal = A // the normal to the end cap
        extraA = A // the direction of an additional segment whose joint has the normal "end_normal"
        if (args.end_normal !== null) end_normal = args.end_normal
        if (!end_normal.norm().equals(A.norm())) {
            axis = A.cross(end_normal)
            theta = A.diff_angle(end_normal)
            extraA = A.rotate({angle:2*theta, axis:axis})
        }
    } else {
        z = p[0].sub(p[L-1])
        y = norm(args.up)
        x = norm(z.cross(y))
    }

    // Analyze the whole path before creating quads.
    // Determine information about each joint between adjacent segments.
    let joints = [] // Each joint:{pos:p[ipath], x:x, y:y, z:z,
    //             sharp:sharp, turn:norm(z).add(norm(newz),
    //             xscale:xs[ipath], yscale:ys[ipath], ltex:ltex}
    // pos is the center of a joint; if sharp is true, there is a large change in direction of the path.
    // A is the value of z for the preceding joint.
    // ltex is the texture length coming to this joint.

    // x, y, z are the vectors in a left-handed xyz set; x and y are unit vectors.
    // z points from ipath[n] to ipath[n+1] and is not a unit vector.
    // y starts out pointing up (args.up; default is <0,1,0>); a shape point at [sx,sy] is at pos + sx*x + sy*y.
    // x starts out pointing in the direction of z.cross(y); xyz is a left-handed set of coordinates.
    // Concretely, picture a default z in the -z direction with x to the right and y up.

    let ipath, sharp, newx, newy, newz, turn
    let ltex = 0
    let lastzero = 0 // ipath[start] has ltex = 0

    for (ipath=0; ipath<L; ipath++) {
        if (ipath < L-1) newz = p[ipath+1].sub(p[ipath])
        if (!path_closed && ipath == L-1) newz = extraA
        else if (path_closed && ipath === 0) z = p[0].sub(p[p.length-1])
        else if (path_closed && ipath == L-1) newz = p[0].sub(p[ipath])
        axis = z.cross(newz)
        theta = newz.diff_angle(z)
        newx = x.rotate({angle:theta, axis:axis})
        newy = y.rotate({angle:theta, axis:axis})
        sharp = (theta >= smoothangle) // if true, path takes a sharp turn here
        if (!path_closed && (ipath === 0 || ipath == L-1)) sharp = false
        if (sharp) { // if ipath is in both args.smooth_joints and in args.sharp_joints, no change:
            if (args.smooth_joints.indexOf(ipath) >= 0) sharp = false
            if (args.sharp_joints.indexOf(ipath) >= 0) sharp = true
        } else {    // if ipath is in both args.smooth_joints and in args.sharp_joints, no change:
            if (args.sharp_joints.indexOf(ipath) >= 0) sharp = true
            if (args.smooth_joints.indexOf(ipath) >= 0) sharp = false
        }
        turn = norm(z).add(norm(newz))
        if (ipath > 0 && (sharp || ipath == L-1)) {
            for (let k=lastzero+1; k<ipath; k++) joints[k].ltex /= ltex
            lastzero = ipath
            ltex = 1
        }
        joints.push({pos:p[ipath], x:newx, y:newy, z:newz,
                        turn:turn, sharp:sharp, color:args.color[ipath], twist:args.twist[ipath],
                        xscale:xs[ipath], yscale:ys[ipath], ltex:ltex})
        ltex += mag(z)
        x = newx
        y = newy
        z = newz
    } // end of marching through all the joints
    L = joints.length
    // end of determining information about joints
    
    let contours = args.shape
    if (contours.length === undefined) throw new Error("An extrusion shape must be a list of [x,y] points.")
    if (contours.length == 1 && contours[0].length !== undefined) contours = contours[0]
    n = level(contours) // 1, 2, or 3 levels of lists
    let xmin, xmax, ymin, ymax
    
    // Find bounding box for the superposition of all the outer shapes, for determining texture coordinates
    if (n == 1) bounding_box([contours]) // one outer shape, no inner shapes
    else if (n == 2) bounding_box([contours[0]]) // one outer shape, possibly with inner shapes
    else { // n == 3; multiple outer shapes, possibly with inner shapes
        let shs = []
    	for (var nn=0; nn<contours.length; nn++) shs.push(contours[nn][0])
    	bounding_box(shs)
    }
    
    let start_vertices = [] // points in the start face
    let end_vertices = []   // points in the end face

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
            start_vertices = []
            end_vertices = []
    		var c = contours[nn]
	        for (var nc=0; nc<c.length; nc++) {
                make_quads(c[nc], nc===0) // 0th contour is an outer shape; others are inner
            }
	        endfaces(c)
    	}
    }
    if (path_closed) args.path.push(args.path[0]) // Restore the final point that was removed
    delete args.path  // compound has no need of the path
    delete args.shape // compound has no need of the shape
    delete args.start_face_color
    delete args.end_face_color
    delete args.show_start_face
    delete args.show_end_face
    delete args.color  // don't overwrite start and end face colors
    delete args.smooth
    delete args.up
    delete args.start_normal
    delete args.last_normal
    if (args.pos === null) delete args.pos
    if (args.axis === null) delete args.axis
    return compound(quads, args)

    function level(a) {
    	// Determine format of shape specification:
        //    return 1 if a = [S, S, ...] where S is [x,y]
        //    return 2 if a = [ [S, S, ... ], [S, S, ...], [S, S, ...] ]
        //    return 3 if a = [ [ [S, S, ... ], [S, S, ...], [S, S, ...] ],
        //                      [ [S, S, ... ], [S, S, ...], [S, S, ...] ], ... ]
        if (a.length === undefined) throw new Error("A shape must be a list of [x,y] elements.")
        if (typeof a[0] == 'number') throw new Error("A shape must be a list of [x,y] elements.")
        if (a[0].x !== undefined) throw new Error("A shape must be a list of [x,y] elements.")
        if (typeof a[0][0] == 'number') return 1
        if (typeof a[0][0][0] == 'number') return 2
        if (typeof a[0][0][0][0] == 'number') return 3
        throw new Error("A shape must be a list of lists of [x,y] elements.")
    }
    
    function bounding_box(shs) {
    	// Determine bounding box for a 2D shape (called for all the shapes to be extruded)
    	for (let i=0; i<shs.length; i++) {
    		let ystart = null
    		let shapemin = null
    		for (let j=0; j<shs[i].length-1; j++) {
    			let p = shs[i][j]
    			let x = p[0]
    			let y = p[1]
    			xmin = (xmin === undefined) ? x : Math.min(x,xmin)
    	    	xmax = (xmax === undefined) ? x : Math.max(x,xmax)
    	    	ymin = (ymin === undefined) ? y : Math.min(y,ymin)
    	    	ymax = (ymax === undefined) ? y : Math.max(y,ymax)
    		}
    	}
    }

    function find_shape_info(contour) {
    	// For points in the 2D shape xy plane, find pos and normal for needed vertex objects.
        let last = contour[contour.length-1]
        let ax = contour[0][0], ay = contour[0][1], bx = last[0], by = last[1]
        if (ax !== bx || ay !== by) throw new Error("An extrusion shape must be a closed curve.")
        let curl = 0, i
        for (i=0; i< contour.length-1; i++) { // force points in shape to go counter-clockwise
            ax = contour[i][0]
            ay = contour[i][1]
            bx = contour[i+1][0] - contour[i][0]
            by = contour[i+1][1] - contour[i][1]
            curl += ax*by - ay*bx
        }
        if (curl < 0) contour.reverse()
    	let slist = []
        for (i=0; i<contour.length; i++) slist.push(vec(contour[i][0], contour[i][1], 0))
        shapeinfo = []
        Ls = slist.length
        shapecount = 0
        let totallength = 0
        let vs = [], lengths=[], v
        
        // Identify that corner of the shape that is the lowest point (minimum y)
        let miny, minyi
        for (i=0; i<Ls-1; i++) { // create list of vectors, calculate total length of the shape
        	v = slist[i+1].sub(slist[i])
        	if (miny === undefined || slist[i].y < miny) { // find location of lowest point
        		miny = slist[i].y
        		minyi = i
        	}
        	let magv = mag(v)
        	totallength += magv
        	vs.push(v)
        	lengths.push(magv)
        }
    	// texval will be a list of texel values for the shape corners from 0 to 1 and back to 0,
    	// for two copies of the texture along the sides of the extrusion; they meet at
    	// two places with equal pixel patterns
        let texval = []
        for (i=0; i<lengths.length; i++) {
        	lengths[i] /= totallength
        	texval.push(0)
        }
        let d = 0 // distance along circumference from minyi to one less than the corner where d > 0.5
        let np = 0 // number of corners spanned by d
        let j
        for (i=0; i<lengths.length; i++) {
        	j = (minyi+i) % lengths.length
        	d += lengths[j]
        	if (d > 0.5) {
        		d -= lengths[j]
        		break
        	}
        	np += 1
        }
    	// minyi and j are the starting and ending indices of the corners spanning the first texture
        let d2 = 0
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
        
        let previous = vs[vs.length-1]
        for (i=0; i<Ls-1; i++) {
            v = vs[i]
            let len = lengths[i]
            let c = norm(v).dot(norm(previous))
            let v1 = slist[i]
            let sharp = false
            if (c <= args.smooth) { // sharp corner
                shapecount++
                sharp = true
            }
            shapeinfo.push({pos:v1, sharp:sharp, length:texval[i]}) 
            previous = v
        }
        shapecount += shapeinfo.length
    }

    function showquad(q) { // for debugging; displays arrows representing normals and prints their values
        let v
        let first = true
        let sw = .2
        let s = ''
        let cs = [color.orange, color.red, color.green, color.cyan]
        let m = [8, 2, 4, 6]
        for (let v=0; v<4; v++) {
            s += q.vs[v].pos.toString()+'  '
            arrow({pos:q.vs[v].pos, axis:q.vs[v].normal.multiply(m[v]), color:cs[v], shaftwidth:sw}) // debugging
            sw = .4
        }
        // console.log('Ns:', q.v0.normal.toString(), q.v1.normal.toString(), q.v2.normal.toString(), q.v3.normal.toString())
        return s
    }    

    function generate_vertices(ipath) {
        // Generate vertices and quads corresponding to joints[ipath] and joints[ipath+1]
        // Each joint:{pos:p[ipath], x:x, y:y, z:z,
        //             sharp:sharp, turn:norm(z).add(norm(newz),
        //             xscale:xs[ipath], yscale:ys[ipath], ltex:ltex}

        function duplicate(vs, v) {
            for (const dup of vs) if (dup.equals(v)) return true
            return false
        }

        let twist1 = joints[ipath]
        let twist2 = joints[ipath+1]

        let Ls = shapeinfo.length
        let verts = []
        let info, v, lastv, n, N0, N1, N2, N3, k, i, j, s, x, y, z, pos, xs, ys, c, tw
        
        // Determine vertex positions for joints[ipath] and joints[ipath+1]
        for (i=ipath; i<ipath+2; i++) {
            if (i == L && path_closed) j = joints[0]
            else j = joints[i]
            if (i === ipath) c = j.color
            x = j.x // axes
            y = j.y
            z = j.z
            xs = j.xscale
            ys = j.yscale
            pos = j.pos
            n = j.turn
            tw = j.twist
            x = x.rotate({angle:-tw, axis:z})
            y = y.rotate({angle:-tw, axis:z})
            for (k=0; k<Ls; k++) {
                info = shapeinfo[k]
                let r = info.pos
                let zcomp = -(n.dot(x)*r.x*xs+n.dot(y)*r.y*ys)/n.dot(norm(z))
                v = x.multiply(r.x*xs).add(y.multiply(r.y*ys)).add( norm(z).multiply(zcomp) ).add(pos)
                if (i === 0 && !path_closed && args.show_start_face) {
                    if (k === 0 || (!v.equals(lastv) && !duplicate(start_vertices, v)) ) {
                        start_vertices.push(v)
                        lastv = v
                    }
                } else if (i == L-1 && !path_closed && args.show_end_face) {
                    if (k === 0 || (!v.equals(lastv) && !duplicate(end_vertices, v)) ) {
                        end_vertices.push(v)
                        lastv = v
                    }
                }
                verts.push( {pos:v, color:c, sharp:info.sharp, 
                    canvas:args.canvas, texpos:vec(j.ltex, info.length, 0)} )
            }
        }

        function vert_to_vertex(v) {
            return vertex({pos:v.pos, canvas:v.canvas, normal:v.normal, color:v.color, 
                sharp:v.sharp, texpos:v.texpos})
        }

        // Now make quads from the positions recorded in verts:        
        let v0, v1, v2, v3
        for (k=0; k<Ls; k++) {
            let Lq = quads.length
            v0 = verts[k]
            v1 = verts[Ls+k]
            if (k == Ls-1) {
                v2 = verts[Ls]
                v3 = verts[0]
            } else {
                v2 = verts[Ls+k+1]
                v3 = verts[k+1]
            }
            N0 = v1.pos.sub(v0.pos).cross(v3.pos.sub(v0.pos)).norm()
            v0.normal = N0
            if (twist1 === 0 && twist2 === 0) {
                N1 = N2 = N3 = N0
                v1.normal = v2.normal = v3.normal = N0
            } else {
                N1 = v2.pos.sub(v1.pos).cross(v0.pos.sub(v1.pos)).norm()
                v1.normal = N1
                N2 = v3.pos.sub(v2.pos).cross(v1.pos.sub(v2.pos)).norm()
                v2.normal = N2
                N3 = v0.pos.sub(v3.pos).cross(v2.pos.sub(v3.pos)).norm()
                v3.normal = N3
            }
            let adjusted = false
            if (ipath > 0 && !joints[ipath].sharp) {
                adjusted = true
                c = v0.color
                v0 = quads[Lq-Ls].v1
                v0.normal = N0.add(v0.normal)
                v0.color = c
                v3 = quads[Lq-Ls].v2
                v3.normal = N3.add(v3.normal)
                v3.color = c
            }
            if (k === 0) {
                v0 = vert_to_vertex(v0)
                v1 = vert_to_vertex(v1)
                v2 = vert_to_vertex(v2)
                v3 = vert_to_vertex(v3)
            } else if (k == Ls-1) {
                if (verts[k].sharp) {
                    v0 = vert_to_vertex(verts[k])
                    v1 = vert_to_vertex(verts[k+Ls])
                    v2 = vert_to_vertex(verts[Ls])
                    v3 = vert_to_vertex(verts[0])
                } else {
                    if (quads[Lq-Ls+1].v0.sharp) {
                        v0 = vert_to_vertex(verts[k])
                        v1 = vert_to_vertex(verts[Ls])
                        v2 = vert_to_vertex(verts[Ls+1])
                        v3 = vert_to_vertex(verts[k+1])
                    } else {
                        if (!adjusted) {
                            v0 = quads[Lq-1].v3
                            v0.normal = N0.add(v0.normal)
                            v3 = quads[Lq-Ls+1].v0
                            v3.normal = N3.add(v3.normal)
                        }
                        v1 = quads[Lq-1].v2
                        v1.normal = N1.add(v1.normal)
                        v2 = quads[Lq-Ls+1].v1
                        v2.normal = N2.add(v2.normal)
                    }
                }

            } else {
                if (verts[k].sharp) {
                    if (!adjusted) {
                        v0 = vert_to_vertex(verts[k])
                        v3 = vert_to_vertex(verts[k+1])
                        v0.texpos.x = 0
                        v3.texpos.x = 0
                    }
                    v1 = vert_to_vertex(verts[k+Ls])
                    v2 = vert_to_vertex(verts[k+Ls+1])
                } else {
                    if (!adjusted) {
                        v0 = quads[Lq-1].v3
                        v0.normal = N0.add(v0.normal)
                        v3 = vert_to_vertex(verts[k+1])
                    }
                    v1 = quads[Lq-1].v2
                    v1.normal = N1.add(v1.normal)
                    v2 = vert_to_vertex(verts[k+Ls+1])
                }
            }
            if (ipath == L-1) {
                if (path_closed) { 
                    if (!joints[0].sharp) {
                        v1 = quads[starting_quad+k].v0
                        v1.normal = N1.add(v1.normal)
                        v2 = quads[starting_quad+k].v3
                        v2.normal = N2.add(v2.normal)
                    }
                } else {
                    v1.color = v2.color = args.color[args.color.length-1]
                }
            } else if (!path_closed && ipath == L-2) {
                v1.color = v2.color = args.color[args.color.length-1]
            }
            quads.push(quad({vs: [v0, v1, v2, v3]}))
            // if (quads.length == 7) showquad(quads[quads.length-1]) // debugging; show normals when quad created
        }
    } // end of generate_vertices()
    
    function make_quads(contour, outside) { // if outside is true, this is an outer contour
        if (outside || !path_closed) {
            find_shape_info(contour) //, outside)
        } else return
        // Now we have all the information about all the joints and can generate quads
        starting_quad = quads.length
        for (ipath=0; ipath<L-1; ipath++) {
            generate_vertices(ipath) // generate vertices and quads for the next segment
        }
        if (path_closed) generate_vertices(L-1)
        // for (let i=0; i<quads.length; i++) console.log(i, showquad(quads[i])) // debugging; show normals
        // for (let i=0; i<quads.length; i++) showquad(quads[i])
        // let qq = 8
        // for (let i=qq; i<qq+4; i++) console.log(i, showquad(quads[i]))
        // for (let i=0; i<quads.length; i++) console.log(i, quads[i].v0.color.toString(), quads[i].v1.color.toString(),
        // quads[i].v2.color.toString(), quads[i].v3.color.toString())
    }

    function tessellate(contours) {
    	// Use the poly2tri.js library to divide a 2D shape with possible holes into triangles.
    	// Not called if the path is closed (so no end caps need to be displayed).
        let i, j
        let c = contours[0]

        // poly2tri.js does not accept duplicate points (here c = contours[0] is outer contour):
        if (c[0][0] === c[c.length-1][0] && c[0][1] === c[c.length-1][1]) c = c.slice(0,-1)
        
        // Create poly2tri.js element for outer contour:
        let pts = []
        for (i=0; i<c.length; i++) pts.push(new Point(c[i][0], c[i][1]))
        let swctx = new SweepContext(pts)
        
        // Create poly2tri.js element for inner contours:
        for (j=1; j<contours.length; j++) {
            c = contours[j]
            if (c[0][0] === c[c.length-1][0] && c[0][1] === c[c.length-1][1])  c = c.slice(0,-1)
            pts = []
            for (i=0; i<c.length; i++) {
                pts.push(new Point(c[i][0], c[i][1]))
            }
            swctx.addHole(pts)
        }

        function findindex(p) { // the [x,y] coordinates of a point of a triangle portion of the 2D shape
            let nth = 0
            for (i=0; i<contours.length; i++) {
                for (j=0; j<contours[i].length-1; j++) { // the last element is a duplicate of the first element
                    if (p.x === contours[i][j][0] && p.y === contours[i][j][1]) return nth // the nth point in the shape
                    nth++
                }
            }
        }

        swctx.triangulate() // poly2tri.js generates triangles
        let tris = swctx.getTriangles() // fetch the triangle vertices
        let p0, p1, p2, t, indices = []
        for (let k=0; k<tris.length; k++) {
        	t = tris[k]
        	p0 = t.getPoint(0)
        	p1 = t.getPoint(1)
            p2 = t.getPoint(2)
            indices.push([findindex(p0), findindex(p1), findindex(p2)])
        }
        return indices
    }
        
    function texpos(x,y) { // evalulate texture coordinates, using bounding box info
        return vec((x-xmin)/(xmax-xmin), (y-ymin)/(ymax-ymin), 0)
    }

	function endfaces(contours) {
        // For a non-closed path, create triangles for the starting and ending faces (unless asked not to)
        if (path_closed) return
        if (!args.show_start_face && !args.show_end_face) return 
        // add faces to beginning and/or end of extrusion path
        let T = tessellate(contours)
        let faces = []
        if (args.show_start_face) {
            for (const v of start_vertices) {
                faces.push(vertex({pos:v, canvas:args.canvas, normal:start_normal.multiply(-1), color:args.start_face_color, texpos:texpos(v.x,v.y)}))
            }
            for (let i=0; i<T.length; i++) {
                let vs = T[i]
                quads.push( triangle({vs:[ faces[vs[0]], faces[vs[1]], faces[vs[2]] ]}) )
            }
        }
        if (args.show_end_face) {
            faces = []
            for (const v of end_vertices) {
                faces.push(vertex({pos:v, canvas:args.canvas, normal:end_normal, color:args.end_face_color, texpos:texpos(v.x,v.y)}))
            }
            for (let i=0; i<T.length; i++) {
                let vs = T[i]
                quads.push( triangle({vs:[ faces[vs[0]], faces[vs[1]], faces[vs[2]] ]}) )
            }
        }
    }
} // end of extrusion()

let exports = {
	text3D: text3D,
    extrusion: extrusion
}

Export(exports)

})()