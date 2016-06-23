; (function () {
    "use strict";

// Kadir Haldenbilen, June 2016
// Modified by Bruce Sherwood
// Tessellation with multiple holes, JavaScript version: https://github.com/r3mi/poly2tri.js
// For explanation of poly2tri, see http://sites-final.uclouvain.be/mema/Poly2Tri
// Font manipulation:  https://github.com/nodebox/opentype.js
// Currently, support for otf files disabled; there are irregularities in otf formats

var f = 'Roboto-Medium.ttf'
var font
if (f.slice(-4) != '.ttf') throw new Error("Requires use of .tff font file")
opentype.load(f, function(err, fontref) {
    if (err) throw new Error('Font '+f+' could not be loaded: ' + err)
    font = fontref
})

function drawFont(txt) {
    // otf problems: doqBDPQ0
    // Roboto-Black.ttf, Roboto-Medium.ttf, FiraSansOT-Medium.otf, 
    // Esperanto characters with accents: ĉĝĥĵŝŭĈĜĤĴŜŬ
    var textPath = font.getPath(txt, 10, 100, 100) // text, x, baseline y, font size
    var commands = textPath["commands"]
    var contours = []
    var contour = []
    for (var i=0; i<commands.length; i++) {
        var cmd = commands[i]
        switch (cmd.type) { // start contour
            case 'M': // move to a new location
                if (contour.length > 0) contours.push(contour)
                var contour = []
                contour.push([cmd.x, cmd.y])
                break
            case 'L': // draw line
                contour.push([cmd.x, cmd.y])
                break
            case 'C': // Bezier
                var points = [contour[contour.length-1]]
                contour.pop()
                points.push([cmd.x1, cmd.y1])
                points.push([cmd.x, cmd.y])
                points.push([cmd.x2, cmd.y2])
                var Bpoints = addBezier(3, points, 8)
                points = []
                contour = contour.concat(Bpoints)
                break
            case 'Q': // quadratic Bezier
                var points = [contour[contour.length-1]]
                contour.pop()
                points.push([cmd.x1, cmd.y1])
                points.push([cmd.x, cmd.y])
                var Bpoints = addBezier(2, points, 8)
                points = []
                contour = contour.concat(Bpoints)
                break
            case 'Z': // end of a contour
                // ttf font data includes a point equal to the initial point, so don't need this:
                //var c = contour[contour.length-1]
                //if (c[0] !== contour[0][0] || c[1] !== contour[0][1]) contour.push(contour[0])
                break
        }
    }
    contours.push(contour)
    getContours(contours)
}

function Bezier2(t,w){
    var t2 = t * t
    var mt = 1-t
    var mt2 = mt * mt
    return [w[0][0]*mt2 + w[1][0]*2*mt*t + w[2][0]*t2, w[0][1]*mt2 + w[1][1]*2*mt*t + w[2][1]*t2]
}

function Bezier3(t,w){
    var t2 = t * t
    var t3 = t2 * t
    var mt = 1-t
    var mt2 = mt * mt
    var mt3 = mt2 * mt
    return [w[0][0]*mt3 + 3*w[1][0]*mt2*t + 3*w[2][0]*mt*t2 + w[3][0]*t3, w[0][1]*mt3 + 3*w[1][1]*mt2*t + 3*w[2][1]*mt*t2 + w[3][1]*t3] 
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

function isClockwise(contour) { // change is true if we should alter contour
    var area=0
    var i = 0
    for (var i=0; i<contour.length-1; i++) {
        var j = (i + 1) % contour.length
        area += contour[i][0] * contour[j][1]
        area -= contour[j][0] * contour[i][1]
        contour[i] = new poly2tri.Point(contour[i][0], contour[i][1])
    }
    contour.pop()
    return (area < 0) // return true if contour is clockwise
}

function getContours(contours) {
    var conhole = []
    var con = []
    for (var i=0; i<contours.length; i++) {
        var contour = contours[i]
        if (!isClockwise(contour)) {
            if (con.length > 0) conhole.push(con)
            var con = [i]
        }
        else con.push(i)
    }
    conhole.push(con)
    for (var i=0; i<conhole.length; i++) {
        var con = conhole[i]
        var swctx = new poly2tri.SweepContext(contours[con[0]])
        for (var j=1; j<con.length; j++) swctx.addHole(contours[con[j]])
        swctx.triangulate()
        var triangles = swctx.getTriangles()
        triangles.forEach(function(t) {
        	var p0 = t.getPoint(0)
        	var p1 = t.getPoint(1)
        	var p2 = t.getPoint(2)
        	var v0 = vertex({pos:vec(p0.x,-p0.y,0)})
        	var v1 = vertex({pos:vec(p1.x,-p1.y,0)})
        	var v2 = vertex({pos:vec(p2.x,-p2.y,0)})
        	triangle({vs:[v0,v1,v2]})
        })
    }
}

var exports = {
	drawFont: drawFont
}

Export(exports)

})()