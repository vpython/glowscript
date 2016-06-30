; (function () {
    "use strict";

// Font machinery by Kadir Haldenbilen, June 2016
// Modified by Bruce Sherwood for use in GlowScript
// Tessellation with multiple holes, JavaScript version: https://github.com/r3mi/poly2tri.js
// For explanation of poly2tri, see http://sites-final.uclouvain.be/mema/Poly2Tri
// Font manipulation: https://github.com/nodebox/opentype.js
    
var font
var otf
var textobj
var originalpos // original value of textobj.pos
var unitsPerEm, ascender, descender
var Hheights = {} // height of an H ("cap height"); entries are font_name: [Hheight, descent]
var Hheight
var length
var smooth = 0.95 // a bend is smooth if the bending angle has a cosine > smooth (less than about 18 degrees)
var meshes = [] // collect triangles and quads into meshes, then make compound(meshes)

/*
function testshape() { // simple shapes for testing purposes
	var testing1 = [new poly2tri.Point(0,0),
	               new poly2tri.Point(0.5,-0.05),
	               new poly2tri.Point(1,0),
	               new poly2tri.Point(1,1),
	               new poly2tri.Point(0,1)]
	var testing2 = [new poly2tri.Point(0.5,-0.05),
	               new poly2tri.Point(1,0),
	               new poly2tri.Point(1,1),
	               new poly2tri.Point(0,1),
	               new poly2tri.Point(0,0)]
	var hole =    [new poly2tri.Point(0.9,0.1),
	               new poly2tri.Point(0.1,0.1),
	               new poly2tri.Point(0.1,0.9),
	               new poly2tri.Point(0.9,0.9)]
	return [testing1,hole]
}

function text3D(args) { // testing with a simple shape
	var f = '../lib/fonts/Roboto-Medium.ttf' // a sans serif font
	otf = (f.slice(-4) == '.otf')
    ascender = 1              // e.g. 2146 for Roboto-Medium.ttf
    descender = 1  // e.g. font.descender is -555 for Roboto-Medium.ttf
    if (args.pos === undefined) args.pos = vec(0,0,0)
    pos = args.pos
	textobj = {text:'o', color:color.cyan, height:1, align:'left', depth:1}
	var contours = testshape()
	var CW = [false,true]
	return getContours(contours, CW, null)
}
*/

function text3D(args) {
    if (args.text == "" || args.text == undefined) throw new Error("A text object needs non-empty text")
    if (args.align === undefined) args.align = 'left'
    if (args.height === undefined) args.height = 1
    if (args.depth === undefined) args.depth = 0.2*args.height
    if (args.pos === undefined) args.pos = vec(0,0,0)
	textobj = args
	originalpos = vec(textobj.pos) // make a copy
    // Esperanto characters that have diacritics, for testing Unicode: ĉĝĥĵŝŭĈĜĤĴŜŬ
	// Some lowercase Greek characters, for testing Unicode: αβγδεθλμνξοπρστφχψω
	// Some uppercase Russian characters, for testing Unicode: АБВГДЁЖЗЛЦЧШ
	//var f = '../lib/fonts/Roboto-Medium.ttf' // a sans serif font
	//if (f.slice(-4) != '.ttf' && f.slice(-4) != '.otf') throw new Error("Requires use of .tff or .otf font file")
	//otf = (f.slice(-4) == '.otf')
	font = window.__font_sans
	if (font === undefined) throw new Error('Font not available for text object.')
    unitsPerEm = font.unitsPerEm          // e.g. 2048 for Roboto-Medium.ttf
    ascender = font.ascender              // e.g. 2146 for Roboto-Medium.ttf
    descender = Math.abs(font.descender)  // e.g. font.descender is -555 for Roboto-Medium.ttf
	var fullName = font.names.fullName
    if (Hheights.fullName === undefined) {
    	var h = processOneLine('h', 0, true) // the real-world height of an h is 1 for textobj.height = 1
    	var d = processOneLine('y', 0, true) // h-d is the real-world height of a y-descender for textobj.height = 1 (about 0.23)
    	Hheights.fullName = [h, h-d]
    }
	Hheight = Hheights.fullName[0]
	var descent = Hheights.fullName[1]
    
    var lines = textobj.text.split('\n')
    var liney = 0 //originalpos.y
    var maxlength = 0
    for (var i=0; i<lines.length; i++) { // add triangles and quads to meshes
    	liney = -i*1.5*Hheight
    	processOneLine(lines[i], liney, false)
    	if (length > maxlength) maxlength = length
    }
    return compound(meshes, {pos:originalpos, __height:textobj.height, __length:maxlength,
    	__descender:descent,
    	__align:textobj.align, __text:textobj.text, __lines:lines.length})
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
    if (otf) set = fontInspect(txt, font)
    var contoursT = [] // contours that are clockwise
    var contoursF = [] // contours that are counterclockwise

    var contours = []
    var contour = []
    var CW = [] // a entry of true means that contour is clockwise
    for (var i=0; i<commands.length; i++) {
        var cmd = commands[i]
        switch (cmd.type) { // start contour
            case 'M': // Move to
                if (contour.length > 0) { // a ttf file has a 'Z' only at the end of a character
                    var c0 = contour[0]
                    var c = contour[contour.length-1]
                    if (poly2tri.Point.equals(c0,c)) contour.pop() // poly2tri doesn't want this extra point
                    contours.push(contour)
                    CW.push(isCW(contour))
                }
                contour = []
            case 'L': // Line to
                contour.push(new poly2tri.Point(cmd.x, cmd.y))
                if (cmd.x > length) length = cmd.x
                if (cmd.y < ymax) ymax = cmd.y
                break
            case 'C': // Bezier
                var points = [contour.pop()]
                points.push(new poly2tri.Point(cmd.x1, cmd.y1))
                if (cmd.x1 > length) length = cmd.x1
                if (cmd.y1 < ymax) ymax = cmd.y1
                if (otf) {
                   points.push(new poly2tri.Point(cmd.x2, cmd.y2))
                   points.push(new poly2tri.Point(cmd.x, cmd.y))
                   if (cmd.x > length) length = cmd.x
                   if (cmd.y < ymax) ymax = cmd.y
                } else {
                   points.push(new poly2tri.Point(cmd.x, cmd.y))
                   points.push(new poly2tri.Point(cmd.x2, cmd.y2))
                   if (cmd.x2 > length) length = cmd.x2
                   if (cmd.y2 < ymax) ymax = cmd.y2
                }
                var Bpoints = addBezier(3, points, 8)
                contour = contour.concat(Bpoints)
                break
            case 'Q': // quadratic Bezier
                var points = [contour.pop()]
                points.push(new poly2tri.Point(cmd.x1, cmd.y1))
                points.push(new poly2tri.Point(cmd.x, cmd.y))
                if (cmd.x > length) length = cmd.x
                if (cmd.y < ymax) ymax = cmd.y
                if (cmd.x1 > length) length = cmd.x1
                if (cmd.y1 < ymax) ymax = cmd.y1
                var Bpoints = addBezier(2, points, 8)
                contour = contour.concat(Bpoints)
                break
            case 'Z': // end of a contour
                var c0 = contour[0]
                var c = contour[contour.length-1]
                if (poly2tri.Point.equals(c0,c)) contour.pop() // poly2tri doesn't want this extra point
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
       for (var c of txt) {
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
               for (var cmd of ccommands) {
                   if (cmd.type == "M") {
                       ccontour = []
                       ccontour.push(new poly2tri.Point(cmd.x, cmd.y))
                   } else if (cmd.type === 'L' || cmd.type === 'C' || cmd.type === 'Q') {
                        ccontour.push(new poly2tri.Point(cmd.x, cmd.y))
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
               for (var pp of clst) {
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

    function fontInspect(inputText, font) {
        // Return an object whose keys are the characters in the text
        // and each value is a list in order of the form [true, false, ....]
        // where true means a clockwise contour.
        var set = {}
        for (var i = 0; i < inputText.length; i++) set[inputText[i]] = true
        var keys = Object.keys(set)
        for (var char of keys) {
            var charPath = font.getPath(char, 100, 300, 288)
            var commands = charPath["commands"]
            set[char] = []
            for (var cmd of commands) {
                if (cmd.type == "M") {
                    contour = []
                    contour.push(new poly2tri.Point(cmd.x, cmd.y))
                } else if (cmd.type === 'L' || cmd.type === 'C' || cmd.type === 'Q') {
                     contour.push(new poly2tri.Point(cmd.x, cmd.y))
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
    return new poly2tri.Point(w[0].x*mt2 + w[1].x*2*mt*t + w[2].x*t2, w[0].y*mt2 + w[1].y*2*mt*t + w[2].y*t2)
}

function Bezier3(t,w){
    var t2 = t * t
    var t3 = t2 * t
    var mt = 1-t
    var mt2 = mt * mt
    var mt3 = mt2 * mt
    return new poly2tri.Point(w[0].x*mt3 + 3*w[1].x*mt2*t + 3*w[2].x*mt*t2 + w[3].x*t3, w[0].y*mt3 + 3*w[1].y*mt2*t + 3*w[2].y*mt*t2 + w[3].y*t3) 
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
            if (poly2tri.Point.equals(chContour[0][0], chContour[0][chContour[0].length-1])) chContour[0].pop()
            var swctx = new poly2tri.SweepContext(chContour[0])
            for (j=1; j<chContour.length; j++) {
                if (!expConts[i][j]) {                  
                    if (poly2tri.Point.equals(chContour[j][0], chContour[j][chContour[j].length-1])) chContour[j].pop()
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
            var swctx = new poly2tri.SweepContext(contours[con[0]]) // outer contour
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

function getShapeInfo(slist, inner) { // slist is list of 2D shape poly2tri.Point objects, inner = true if inner contour
	// For points in the shape xy plane, find pos and normal for needed vertex objects
	// Use 2D Point operations - add, sub, negate, cross, dot, normalize
    var shapeinfo = []
    if (!poly2tri.Point.equals(slist[slist.length-1],slist[0])) slist.push(slist[0]) // add duplicate point
    var L = slist.length
    var previous = poly2tri.Point.sub(slist[0],slist[L-2])
    var v
    for (var i=0; i<L; i++) {
    	if (i == L-1) v = poly2tri.Point.sub(slist[1],slist[0])
        else v = poly2tri.Point.sub(slist[i+1],slist[i])
        var a = new poly2tri.Point(previous.y,-previous.x)
        var b = new poly2tri.Point(v.y,-v.x)
        a.normalize()
        b.normalize()
        if (inner) {
            a.negate() // inner skin has normals pointing inward
            b.negate()
        }
        var c = poly2tri.Point.dot(v.normalize(),previous.normalize())
        var v1 = slist[i]
        if (c <= smooth) { // sharp corner
        	if (i === 0) shapeinfo.push({pos:vec(v1.x, v1.y, 0), normal:vec(b.x, -b.y, 0), smooth:false})
        	else {
        		shapeinfo.push({pos:vec(v1.x, v1.y, 0), normal:vec(a.x, -a.y, 0), smooth:false})
        		// Except for the last point (paired with first point), a sharp corner needs two points:
        		if (i != L-1) shapeinfo.push({pos:vec(v1.x, v1.y, 0), normal:vec(b.x, -b.y, 0), smooth:false})
        	}
        } else { // smooth corner
            var n = poly2tri.Point.add(a,b).normalize()
            shapeinfo.push({pos:vec(v1.x, v1.y, 0), normal:vec(n.x, -n.y, 0), smooth:true})
        }
        previous = v
    }
    if (poly2tri.Point.equals(slist[slist.length-1],slist[0])) slist.pop() // remove duplicate point
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
			textobj.pos = vec(K*s.pos.x+dx, -K*s.pos.y, z2)
			textobj.normal = s.normal
			//vp_arrow({pos:textobj.pos, axis:textobj.normal, color:color.orange})
			v0 = vertex(textobj)
			textobj.pos.z = z1
			v1 = vertex(textobj)
			lastsmooth = true
			continue
		}
		textobj.pos = vec(K*s.pos.x+dx, -K*s.pos.y, z1)
		textobj.normal = s.normal
		v2 = vertex(textobj)
		textobj.pos.z = z2
		v3 = vertex(textobj)
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
	textobj.normal = vec(0,0,1)
	var Tlist = []
	var z, t, p0, p1, p2, v0, v1, v2
    for (var ti=0; ti<tris.length; ti++) {
    	t = tris[ti]
    	p0 = t.getPoint(0)
    	p1 = t.getPoint(1)
    	p2 = t.getPoint(2)
    	z = dz
    	if (dz > 0) z = 0
    	textobj.pos = vec(K*p0.x+dx,-K*p0.y,z) // back of extruded text
    	v0 = vertex(textobj)
    	textobj.pos = vec(K*p1.x+dx,-K*p1.y,z)
    	v1 = vertex(textobj)
        textobj.pos = vec(K*p2.x+dx,-K*p2.y,z)
    	v2 = vertex(textobj)
    	Tlist.push(triangle({vs:[v0,v1,v2]}))
    	if (dz !== 0) {
    		z = dz
    		if (dz < 0) z = 0
        	textobj.pos = vec(K*p0.x+dx,-K*p0.y,z) // front of extruded text
        	var v0 = vertex(textobj)
        	textobj.pos = vec(K*p1.x+dx,-K*p1.y,z)
        	var v1 = vertex(textobj)
            textobj.pos = vec(K*p2.x+dx,-K*p2.y,z)
        	var v2 = vertex(textobj)
        	Tlist.push(triangle({vs:[v0,v1,v2]}))
    	}
    }
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

var exports = {
	text3D: text3D
}

Export(exports)

})()