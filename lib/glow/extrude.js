; (function () {
    "use strict";

// Font machinery by Kadir Haldenbilen, June 2016
// Modified by Bruce Sherwood for use in GlowScript
// Tessellation with multiple holes, JavaScript version: https://github.com/r3mi/poly2tri.js
// For explanation of poly2tri, see http://sites-final.uclouvain.be/mema/Poly2Tri
// Font manipulation: https://github.com/nodebox/opentype.js
    
var font
var otf
var textobj, pos
var unitsPerEm, ascender, descender
var length = 0

function text3D(args) {
    if (args.text == "" || args.text == undefined) throw new Error("A text object needs non-empty text")
    if (args.align === undefined) args.align = 'left'
    if (args.height === undefined) args.height = 1
    //if (args.depth === undefined) args.depth = 0.05*args.height
	textobj = args
	pos = textobj.pos
    // Esperanto characters with accents, for testing Unicode: ĉĝĥĵŝŭĈĜĤĴŜŬ
	var f = '../lib/fonts/Roboto-Medium.ttf' // a sans serif font
	if (f.slice(-4) != '.ttf' && f.slice(-4) != '.otf') throw new Error("Requires use of .tff or .otf font file")
	otf = (f.slice(-4) == '.otf')
	font = window.__font_sans
	if (font === undefined) throw new Error('Font not available for text object.')
    unitsPerEm = font.unitsPerEm          // e.g. 2048 for Roboto-Medium.ttf
    ascender = font.ascender              // e.g. 2146 for Roboto-Medium.ttf
    descender = Math.abs(font.descender)  // e.g. font.descender is -555 for Roboto-Medium.ttf
	    
    var textPath = font.getPath(textobj.text, 0, 0, ascender) // text, x, baseline y, font size
    // There exists Font.getPaths() that returns a list of paths.
    var commands = textPath.commands

    // Determine clockwiseness of every contour for every otf character:
    var set
    if (otf) set = fontInspect(txt, font)
    var contoursT = [] // contours that are clockwise
    var contoursF = [] // contours that are counterclockwise

    var contours = []
    var contour = []
    for (var i=0; i<commands.length; i++) {
        var cmd = commands[i]
        switch (cmd.type) { // start contour
            case 'M': // Move to
                if (contour.length > 0) { // a ttf file has a 'Z' only at the end of a character
                    var c0 = contour[0]
                    var c = contour[contour.length-1]
                    if (equals(c0,c)) contour.pop() // poly2tri doesn't want this extra point
                    contours.push(contour)
                }
                contour = []
            case 'L': // Line to
                contour.push(new poly2tri.Point(cmd.x, cmd.y))
                if (cmd.x > length) length = cmd.x
                break
            case 'C': // Bezier
                var points = [contour.pop()]
                points.push(new poly2tri.Point(cmd.x1, cmd.y1))
                if (cmd.x1 > length) length = cmd.x1
                if (otf) {
                   points.push(new poly2tri.Point(cmd.x2, cmd.y2))
                   points.push(new poly2tri.Point(cmd.x, cmd.y))
                   if (cmd.x > length) length = cmd.x
                } else {
                   points.push(new poly2tri.Point(cmd.x, cmd.y))
                   points.push(new poly2tri.Point(cmd.x2, cmd.y2))
                   if (cmd.x2 > length) length = cmd.x2
                }
                var Bpoints = addBezier(3, points, 8)
                contour = contour.concat(Bpoints)
                break
            case 'Q': // quadratic Bezier
                var points = [contour.pop()]
                points.push(new poly2tri.Point(cmd.x1, cmd.y1))
                points.push(new poly2tri.Point(cmd.x, cmd.y))
                if (cmd.x > length) length = cmd.x
                if (cmd.x1 > length) length = cmd.x1
                var Bpoints = addBezier(2, points, 8)
                contour = contour.concat(Bpoints)
                break
            case 'Z': // end of a contour
                var c0 = contour[0]
                var c = contour[contour.length-1]
                if (equals(c0,c)) contour.pop() // poly2tri doesn't want this extra point
                if (otf) {
                    if (isCW(contour)) contoursT.push(contour)
                    else contoursF.push(contour)
                } else {
                    contours.push(contour)
                }
                contour = []
                break
         }
    }
	length *= textobj.height/ascender

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

       return getContours(contours, expConts)
   } else { // ttf
       return getContours(contours, null)
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
function getContours(contours, expConts) {
    var dx = 0 // default shift in x for align = 'left'
    if (textobj.align == 'right') dx = -length
    else if (textobj.align == 'center') dx = -length/2
    var T = []
    if (otf) { // otf
        for (var i=0; i<contours.length; i++) {
            var chContour = contours[i]
            if (equals(chContour[0][0], chContour[0][chContour[0].length-1])) chContour[0].pop()
            var swctx = new poly2tri.SweepContext(chContour[0])
            for (j=1; j<chContour.length; j++) {
                if (!expConts[i][j]) {                  
                    if (equals(chContour[j][0], chContour[j][chContour[j].length-1])) chContour[j].pop()
                    swctx.addHole(chContour[j])
                }
            }
            swctx.triangulate()
            var triangles = swctx.getTriangles()
            T = T.concat(makeTriangles(triangles, dx))
        }
    } else { // ttf
        var conhole = []
        var i = 0
        var con = []
        while ( i<contours.length) {
            var contour = contours[i]
            if (!isCW(contour)) {
                if (con.length > 0) conhole.push(con)
                var con = [i]
            } else {
                con.push(i)
            }
            i += 1
        }
        conhole.push(con)
        for (var i=0; i<conhole.length; i++) {
            var con = conhole[i]
            var swctx = new poly2tri.SweepContext(contours[con[0]])
                for (var j=1; j<con.length; j++) {
                    swctx.addHole(contours[con[j]])
                }
            swctx.triangulate()
            var triangles = swctx.getTriangles()
            T = T.concat(makeTriangles(triangles, dx))
        }
    }
    return compound(T, {pos:pos, __height:textobj.height, __length:length,
    	__descender:textobj.height*descender/ascender, __align:textobj.align})
}

function makeTriangles(tris, dx) {
	var K = textobj.height/ascender
	var Tlist = []
    for (var ti=0; ti<tris.length; ti++) {
    	var t = tris[ti]
    	var p0 = t.getPoint(0)
    	var p1 = t.getPoint(1)
    	var p2 = t.getPoint(2)
    	textobj.pos = vec(K*p0.x+dx,-K*p0.y,0)
    	var v0 = vertex(textobj)
    	textobj.pos = vec(K*p1.x+dx,-K*p1.y,0)
    	var v1 = vertex(textobj)
        textobj.pos = vec(K*p2.x+dx,-K*p2.y,0)
    	var v2 = vertex(textobj)
    	Tlist.push(triangle({vs:[v0,v1,v2]}))
    }
	return Tlist
}

function equals(a,b) {
    return a.x === b.x && a.y === b.y
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