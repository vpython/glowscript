; (function () {
    "use strict";
    
/*
 The path and shape objects were designed and implemented by Kadir Haldenbilen
 for Classic VPython 5. Modified by Bruce Sherwood for GlowScript/Jupyter VPython,
 eliminating dependency on Polygon library.

 GlowScript API:
 shape = [2Ds], hole = [2Ds] or shape = [ [shape 2Ds], [hole 2Ds] ]
 Another option for hole is [ [hole1], [hole2], ..... ]
  If hole represents multiple holes, len[hole[0]] > 1
*/

// ##################################
// ## ----------- shapes ------------
// ##################################
    
var npdefault = 64 // default number of points for a circle. ellipse, and arc

function shape_object() {
}
shape_object.prototype.roundc = function roundc(cps, args) {
    var cp = [], i
    for (i=0; i<cps.length; i++) cp.push(vec(cps[i][0], cps[i][1], 0)) // convert [x,y] => vec(x,y,0), so can use vector functions
    args = args || {}
    var roundness = .1
    var nseg = 16
    var invert = false
    if (args.roundness !== undefined) roundness = args.roundness
    if (args.nseg !== undefined) nseg = args.nseg
    if (args.invert !== undefined) invert = args.invert
    var dv, vord, p1, p2, lm, L, r, ncp, i1, i2, wrt, v1, v2, rax, afl, cc, ccp, tt, t1, t2, nc, dseg, a
    
    // If points are ordered counterclockwise, vord will be > 0
    vord = 0
    cp.pop() // remove the final point, which is equal to the initial point
    var lcp = cp.length
    for (i = 0; i < lcp; i++) {
        i1 = (i + 1) % lcp
        i2 = (i + 2) % lcp
        v1 = cp[i1].sub(cp[i])
        v2 = cp[i2].sub(cp[i1])
        dv = cross(v1, v2).z
        vord += dv
    }
    if (vord < 0) cp.reverse() // force points to be in counterclockwise order
    
    // Determine shortest side
    L = 1e200
    for (i = 0; i < lcp; i++) {
        p1 = cp[i]
        p2 = cp[(i + 1) % lcp]
        lm = mag(p2.sub(p1))
        if (lm < L) {
            L = lm
        }
    }
    r = L * roundness // radius of rounded curve connecting adjacent sides
    
    var d, dtheta
    ncp = [[0,0]] // starting point will be modified later
    for (i=0; i<lcp; i++) {
        v1 = cp[(i+1) % lcp].sub(cp[i % lcp])   // first side
        v2 = cp[(i+2) % lcp].sub(cp[(i+1) % lcp]) // next side
        var theta = diff_angle(v1,v2)   // angle of change of direction from first side to next side
        d = r*Math.tan(theta/2)         // how much to shorten the end of a side and the start of the next
        p1 = cp[i].add(v1.sub(norm(v1).multiply(d)))   // end of first side, start of bend
        p2 = cp[(i+1) % lcp].add(norm(v2).multiply(d)) // start of next side, end of bend
        ncp.push([p1.x, p1.y])
        var N = cross(norm(v1),norm(v2))
        var center = p1.add(norm(cross(N,v1)).multiply(r)) // center of circular arc
        var v = p1.sub(center)
        dtheta = theta/(nseg+1)
        if (N.z < 0) dtheta = -dtheta
        if (invert) {
            var c = p1.add(p2).multiply(0.5) // midpoint along line connecting p1 and p2
            center = c.add(c.sub(center))    // move center to other side of corner
            v = p1.sub(center)
            dtheta = -dtheta
        }
        for (var j=1; j<=nseg; j++) {
            v1 = center.add(v.rotate(j*dtheta))
            ncp.push([v1.x, v1.y])
        }
        ncp.push([p2.x, p2.y])
    }
    v1 = cp[1].sub(cp[0])
    v1 = cp[0].add(norm(v1).multiply(d)) // start of first side, at end of preceding bend
    ncp[0] = [v1.x, v1.y]
    return ncp
}
shape_object.prototype.rotatecp = function rotatecp(cp, pr, angle){
    var sinr, cosr, cpr, x, y, xRel, yRel, newx, newy, p
    sinr = Math.sin(angle)
    cosr = Math.cos(angle)
    xRel = pr[0]
    yRel = pr[1]
    cpr = []
    for (var i=0; i<cp.length; i++) {
        p = cp[i]
        x = p[0]
        y = p[1]
        newx = x * cosr - y * sinr - xRel * cosr + yRel * sinr + xRel
        newy = x * sinr + y * cosr - xRel * sinr - yRel * cosr + yRel
        cpr.push([ newx, newy ])
    }
    return cpr
}
shape_object.prototype.scale = function scale(cp, xscale, yscale){
    var cpr, p
    cpr = []
    for (var i = 0; i < cp.length; i++) {
        p = cp[i]
        cpr.push([ xscale * p[0], yscale * p[1] ])
    }
    return cpr
}
shape_object.prototype.addpos = function addpos(pos, cp) {
    var p
    for (var i = 0; i < cp.length; i++) {
        p = cp[i]
        p[0] += pos[0]
        p[1] += pos[1]
    }
    return cp
}

shape_object.prototype.rframe = function rframe(args) { // pos, width, height, thickness, rotate, roundness, invert, scale, xscale, yscale
    args = args || {}
    if (args.thickness === undefined) args.thickness = null    
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.width === undefined) args.width = 1
    if (args.height === undefined) args.height = null
    if (args.rotate === undefined) args.rotate = 0
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    if (args.height === null) {
        args.height = args.width
    }
    if (args.thickness === null) args.thickness = min(args.height, args.width) * .2
    else args.thickness = min(args.height, args.width) * args.thickness * 2
    var outer, inner
    outer = this.rectangle({pos: args.pos, width: args.width, height: args.height})
    inner = this.rectangle({pos: args.pos, width: args.width - args.thickness, height: args.height - args.thickness})
    if (args.rotate !== 0) {
        outer = this.rotatecp(outer, args.pos, args.rotate)
        inner = this.rotatecp(inner, args.pos, args.rotate)
    }
    if (args.xscale !== 1 || args.yscale !== 1) {
        outer = this.scale(outer, args.xscale, args.yscale)
        inner = this.scale(inner,args. xscale, args.yscale)
    }
    if (args.roundness > 0) {
        outer = this.roundc(outer, {roundness: args.roundness, invert: args.invert})
        inner = this.roundc(inner, {roundness: args.roundness, invert: args.invert})
    }
    return [ outer, inner ]
}

shape_object.prototype.rectangle = function rectangle(args) { // pos, width, height, rotate, thickness, roundness, invert, scale, xscale, yscale
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.width === undefined) args.width = 1
    if (args.height === undefined) args.height = null
    if (args.rotate === undefined) args.rotate = 0
    if (args.thickness === undefined) args.thickness = 0
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    var w2, h2, cp
    if (args.height === null) {
        args.height = args.width
    }
    if (args.thickness === 0) {
        cp = []
        w2 = args.width / 2
        h2 = args.height / 2
        cp = [ [ w2, -h2 ], [ w2, h2 ], [ -w2, h2 ], [ -w2, -h2 ], [ w2, -h2 ] ]
        cp = this.addpos(args.pos, cp)
        if (args.rotate !== 0) cp = this.rotatecp(cp, args.pos, args.rotate)
        if (args.scale !== 1) args.xscale = args.yscale = args.scale
        if (args.xscale !== 1 || args.yscale !== 1) cp = this.scale(cp, args.xscale, args.yscale)
        if (args.roundness > 0) cp = this.roundc(cp, {roundness: args.roundness, invert: args.invert})
    } else {
        cp = this.rframe(args)
    }
    return cp
}
shape_object.prototype.cross = function cross(args) {
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.width === undefined) args.width = 1
    if (args.rotate === undefined) args.rotate = 0
    if (args.thickness === undefined) args.thickness = .2
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    var wtp, w2, t2, cp
    wtp = (args.width + args.thickness) / 2
    w2 = args.width / 2
    t2 = args.thickness / 2
    cp = [ [ w2, -t2 ], [ w2, t2 ], [ t2, t2 ], [ t2, w2 ], [ -t2, w2 ], [ -t2, t2 ], [ -w2, t2 ],
           [ -w2, -t2 ], [ -t2, -t2 ], [ -t2, -w2 ], [ t2, -w2 ], [ t2, -t2 ], [ w2, -t2 ] ]
    cp = this.addpos(args.pos, cp)
    if (rotate !== 0) cp = this.rotatecp(cp, args.pos, args.rotate)
    if (args.scale !== 1) args.xscale = args.yscale = args.scale
    if (args.xscale !== 1 || args.yscale !== 1) cp = this.scale(cp, args.xscale, args.yscale)
    if (args.roundness > 0) cp = this.roundc(cp, {roundness: args.roundness, invert: args.invert})
    return cp
}
shape_object.prototype.trframe = function trframe(args){
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.width === undefined) args.width = 2
    if (args.height === undefined) args.height = 1
    if (args.top === undefined) args.top = null
    if (args.rotate === undefined) args.rotate = 0
    if (args.thickness === undefined) args.thickness = 0
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    var angle, db, outer, inner
    if (args.top === null) {
        args.top = width / 2
    }
    if (args.thickness === null) {
        args.thickness = min(args.height, args.top) * .2
    } else {
        args.thickness = min(args.height, args.top) * args.thickness * 2
    }
    outer = this.trapezoid({pos: args.pos, width: args.width, height: args.height, top: args.top})
    angle = Math.atan((args.width - args.top) / 2 / args.height)
    db = args.thickness / Math.cos(angle)
    inner = this.trapezoid({pos: args.pos, width: args.width - db - args.thickness * Math.tan(angle), 
                            height: args.height - args.thickness, top: args.top - (db - args.thickness * Math.tan(angle))})
    outer = this.addpos(args.pos, outer)
    inner = this.addpos(args.pos, inner)
    if (args.rotate !== 0) {
        outer = this.rotatecp(outer, args.pos, args.rotate)
        inner = this.rotatecp(inner, args.pos, args.rotate)
    }
    if (args.scale !== 1) args.xscale = args.yscale = args.scale
    if (args.xscale !== 1 || args.yscale !== 1) {
        outer = this.scale(outer, args.xscale, args.yscale)
        inner = this.scale(inner, args.xscale, args.yscale)
    }
    if (args.roundness > 0) {
        outer = this.roundc(outer, {roundness: args.roundness, invert: args.invert})
        inner = this.roundc(inner, {roundness: args.roundness, invert: args.invert})
    }
    return [ outer, inner ]
}
shape_object.prototype.trapezoid = function trapezoid(args) {
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.width === undefined) args.width = 2
    if (args.height === undefined) args.height = 1
    if (args.top === undefined) args.top = null
    if (args.rotate === undefined) args.rotate = 0
    if (args.thickness === undefined) args.thickness = 0
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    var w2, h2, t2, cp
    w2 = args.width / 2
    h2 = args.height / 2
    if (args.top === null) {
        args.top = w2
    }
    t2 = args.top / 2
    if (args.thickness === 0) {
        cp = [ [ w2, -h2 ], [ t2, h2 ], [ -t2, h2 ], [ -w2, -h2 ], [ w2, -h2 ] ]
        cp = this.addpos(args.pos, cp)
        if (args.rotate !== 0) cp = this.rotatecp(cp, args.pos, args.rotate)
        if (args.scale !== 1) args.xscale = args.yscale = args.scale
        if (args.xscale !== 1 || args.yscale !== 1) cp = this.scale(cp, args.xscale, args.yscale)
        if (args.roundness > 0) cp = this.roundc(cp, {roundness: args.roundness, invert: args.invert})
    } else {
        cp = this.trframe(args)
    }
    return cp
}
shape_object.prototype.circframe = function circframe(args) {
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.radius === undefined) args.radius = 0.5
    if (args.iradius === undefined) args.iradius = null
    if (args.np === undefined) args.np = npdefault
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    if (args.angle1 === undefined) args.angle1 = 0
    if (args.angle2 === undefined) args.angle2 = 2 * Math.PI
    if (args.rotate === undefined) args.rotate = 0
    args.thickness = 0
    var outer, inner
    if (args.iradius === null) args.iradius = args.radius * .8
    outer = this.circle(args)
    if (args.angle1 === 0 && args.angle2 == 2*Math.PI) {
        args.radius = args.iradius
    } else {
        var t = args.radius - args.iradius
        var angle = (args.angle1 + args.angle2)/2 // pos and center lie on this line
        var offset = t/Math.sin((args.angle2-args.angle1)/2)
        args.corner = [args.pos[0]+offset*Math.cos(angle), args.pos[1]+offset*Math.sin(angle)]
        var dangle = Math.asin(t/args.iradius)
        args.angle1 = args.angle1 + dangle
        args.angle2 = args.angle2 - dangle
        args.radius = args.iradius
    }
    inner = this.circle(args)
    if (args.rotate !== 0) {
        outer = this.rotatecp(outer, args.pos, args.rotate)
        inner = this.rotatecp(inner, args.pos, args.rotate)
    }
    if (args.scale !== 1) args.xscale = args.yscale = args.scale
    if (args.xscale !== 1 || args.yscale !== 1) {
        outer = this.scale(outer, args.xscale, args.yscale)
        inner = this.scale(inner, args.xscale, args.yscale)
    }
    return [ outer, inner ]
}
shape_object.prototype.circle = function circle(args) {
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    var corner = args.pos // where the two straight edges meet
    if (args.corner !== undefined) corner = args.corner
    if (args.radius === undefined) args.radius = 0.5
    if (args.np === undefined) args.np = npdefault
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    if (args.thickness === undefined) args.thickness = 0
    if (args.angle1 === undefined) args.angle1 = 0
    if (args.angle2 === undefined) args.angle2 = 2 * Math.PI
    if (args.rotate === undefined) args.rotate = 0
    var seg, nseg, dc, ds, x0, y0, c2, s2, c, s, i, cp
    cp = []
    if (args.thickness > 0) {
        args.iradius = args.radius - args.radius*args.thickness
        cp = this.circframe(args)
    } else {
        if (args.angle1 !== 0 || args.angle2 !== 2 * Math.PI) {
            cp.push([ corner[0], corner[1] ])
        }
    	seg = 2 * Math.PI / args.np
        nseg = Math.floor(Math.abs((args.angle2 - args.angle1) / seg + .5))
        seg = (args.angle2 - args.angle1) / nseg
        if (args.angle1 !== 0 || args.angle2 !== 2 * Math.PI) {
            nseg += 1
        }
        c = args.radius * Math.cos(args.angle1)
        s = args.radius * Math.sin(args.angle1)
        dc = Math.cos(seg)
        ds = Math.sin(seg)
        x0 = args.pos[0]
        y0 = args.pos[1]
        cp.push([ x0 + c, y0 + s ])
        for (i = 0; i < nseg - 1; i++) {
            c2 = c * dc - s * ds
            s2 = s * dc + c * ds
            cp.push([ x0 + c2, y0 + s2 ])
            c = c2
            s = s2
        }
        cp.push(cp[0])
        if (args.rotate !== 0 && (args.angle1 !== 0 || args.angle2 !== 2 * Math.PI)) {
            cp = this.rotatecp(cp, args.pos, args.rotate)
        }
        if (args.scale !== 1) args.xscale = args.yscale = args.scale
        if (args.xscale !== 1 || args.yscale !== 1) cp = this.scale(cp, args.xscale, args.yscale)
    }
    return cp
}
shape_object.prototype.arc = function arc(args) {
    args = args || {}
    if (args.path === undefined) args.path = false
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.radius === undefined) args.radius = 0.5
    if (args.np === undefined) args.np = npdefault
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    if (args.thickness === undefined) args.thickness = null
    if (args.angle1 === undefined) args.angle1 = 0
    if (args.angle2 === undefined) args.angle2 = 2 * Math.PI
    if (args.rotate === undefined) args.rotate = 0
    if (args.path === undefined) args.path = false
    var cpi, nseg, seg, x, y, i, p, cp
    if (args.thickness === null) {
        args.thickness = .01 * args.radius
    }
    cp = []  // outer arc
    cpi = [] // inner arc
    seg = 2 * Math.PI / args.np
    nseg = Math.floor(Math.abs(args.angle2 - args.angle1) / seg) + 1
    seg = (args.angle2 - args.angle1) / nseg
    for (i = 0; i < nseg + 1; i++) {
        x = Math.cos(args.angle1 + i * seg)
        y = Math.sin(args.angle1 + i * seg)
        cp.push([args.radius * x + args.pos[0], args.radius * y + args.pos[1]])
        if (!args.path) cpi.push([(args.radius - args.thickness) * x + args.pos[0],
                                  (args.radius - args.thickness) * y + args.pos[1]])
    }
    if (!args.path) {
        cpi.reverse()
        for (var i=0; i<cpi.length; i++) cp.push(cpi[i])
        cp.push(cp[0])
    }
    if (args.rotate !== 0) cp = rotatecp(cp, args.pos, args.rotate)
    if (args.scale !== 1) args.xscale = args.yscale = args.scale
    if (args.xscale !== 1 || args.yscale !== 1) this.scale(cp, args.xscale, args.yscale)
    return cp
}
shape_object.prototype.ellipse = function ellipse(args) {
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.width === undefined) args.width = 1
    if (args.height === undefined) args.height = null
    if (args.np === undefined) args.np = npdefault
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    if (args.thickness === undefined) args.thickness = 0
    if (args.angle1 === undefined) args.angle1 = 0
    if (args.angle2 === undefined) args.angle2 = 2 * Math.PI
    if (args.rotate === undefined) args.rotate = 0
    if (args.height === null) {
        args.height = .5 * args.width
    }
    args.yscale *= args.height/args.width
    args.radius = args.width
    return this.circle(args)
}
shape_object.prototype.line = function line(args) { // not called by paths.line()
    args = args || {}
    if (args.pos === undefined) args.pos = [0,0]
    if (args.np === undefined) args.np = 2
    if (args.rotate === undefined) args.rotate = 0
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    if (args.thickness === undefined) args.thickness = null
    if (args.start === undefined) args.start = [0,0]
    if (args.end === undefined) args.end = [0,1]
    var v, dv, dx, dy, cpi, vline, mline, x, y, i, p, cp
    v = vec(args.end[0] - args.start[0], args.end[1] - args.start[1], 0)
    if (args.thickness === null) args.thickness = .01 * mag(v)
    dv = norm(cross(vec(0, 0, 1), v)).multiply(args.thickness)
    dx = dv.x
    dy = dv.y
    cp = []   // outer line
    cpi = []  // inner line
    var vstart = vec(args.start[0], args.start[1], 0)
    v = vec(args.end[0]-args.start[0], args.end[1]-args.start[1], 0)
    vline = v.divide(Math.floor(args.np-1))
    for (i = 0; i < args.np; i++) {
        x = args.start[0] + (vline.multiply(i)).x
        y = args.start[1] + (vline.multiply(i)).y
        cp.push([x + args.pos[0], y + args.pos[1]])
        cpi.push([x + args.pos[0] + dx, y + args.pos[1] + dy])
    }
    cpi.reverse()
    for (var i=0; i<cpi.length; i++) cp.push(cpi[i])
    cp.push(cp[0])
    if (args.rotate !== 0) cp = this.rotatecp(cp, args.pos, args.rotate)
    if (args.scale !== 1) args.xscale = args.yscale = args.scale
    if (args.xscale !== 1 || args.yscale !== 1) this.scale(cp, args.xscale, args.yscale)
    return cp
}
shape_object.prototype.nframe = function nframe(args) {
    args = args || {}
    if (args.thickness === undefined) args.thickness = 0    
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.length === undefined) args.length = 1
    if (args.np === undefined) args.np = 3
    if (args.thickness === undefined) args.thickness = null
    if (args.rotate === undefined) args.rotate = 0
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    var angle, length2, outer, inner
    if (args.thickness === null) {
        args.thickness = args.length * .1
    } else {
        args.thickness = args.length * args.thickness
    }
    outer = this.ngon({pos: args.pos, np: args.np, length: args.length})
    angle = Math.PI * (.5 - 1 / args.np)
    length2 = args.length - 2 * args.thickness / Math.tan(angle)
    inner = this.ngon({pos: args.pos, np: args.np, length: length2})
    if (args.rotate !== 0) {
        outer = this.rotatecp(outer, args.pos, args.rotate)
        inner = this.rotatecp(inner, args.pos, args.rotate)
    }
    if (args.scale !== 1) args.xscale = args.yscale = args.scale
    if (args.xscale !== 1 || args.yscale !== 1) {
        outer = this.scale(outer, args.xscale, args.yscale)
        inner = this.scale(inner, args.xscale, args.yscale)
    }
    if (args.roundness > 0) {
        outer = this.roundc(outer, {roundness: args.roundness, invert: args.invert})
        inner = this.roundc(inner, {roundness: args.roundness, invert: args.invert})
    }
    return [ outer, inner ]
}
shape_object.prototype.ngon = function ngon(args) { // pos, width, height, rotate, thickness, roundness, invert, scale, xscale, yscale
    args = args || {}
    if (args.thickness === undefined) args.thickness = 0    
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.length === undefined) args.length = 1
    if (args.rotate === undefined) args.rotate = 0
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    if (args.np === undefined) args.np = 3
    var seg, x, y, angle, radius, i, cp
    cp = []
    if (args.np < 3) throw Error("number of sides can not be less than 3")
    angle = 2 * Math.PI / args.np
    radius = args.length / 2 / Math.sin(angle / 2)
    if (args.thickness === 0) {
        seg = 2 * Math.PI / args.np
        angle = 0
        for (i = 0; i < args.np; i++) {
            x = radius * Math.cos(angle) + args.pos[0]
            y = radius * Math.sin(angle) + args.pos[1]
            cp.push([ x, y ])
            angle += seg
        }
        cp.push(cp[0])
        if (args.rotate !== 0) cp = this.rotatecp(cp, args.pos, args.rotate)
        if (args.scale !== 1) args.xscale = args.yscale = args.scale
        if (args.xscale !== 1 || args.yscale !== 1) cp = this.scale(cp, args.xscale, args.yscale)
        if (args.roundness > 0) cp = this.roundc(cp, {roundness: args.roundness, invert: args.invert})
    } else {
        cp = this.nframe(args)
    }
    return cp
}

shape_object.prototype.triangle = function triangle(args) {
    args = args || {}
    if (args.rotate === undefined) args.rotate = 0
    args.np = 3
    args.rotate = args.rotate - Math.PI/6
    return this.ngon(args)
}
shape_object.prototype.pentagon = function pentagon(args) {
    args = args || {}
    if (args.rotate === undefined) args.rotate = 0
    args.np = 5
    args.rotate = args.rotate + Math.PI/10
    return this.ngon(args)
}
shape_object.prototype.hexagon = function hexagon(args) {
    args = args || {}
    if (args.rotate === undefined) args.rotate = 0
    args.np = 6
    return this.ngon(args)
}
shape_object.prototype.octagon = function octagon(args) {
    args = args || {}
    if (args.rotate === undefined) args.rotate = 0
    args.np = 8
    args.rotate = args.rotate + Math.PI/8
    return this.ngon(args)
}
shape_object.prototype.sframe = function sframe(args) {
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.radius === undefined) args.radius = 1
    if (args.n === undefined) args.n = 5
    if (args.iradius === undefined) args.iradius = null
    if (args.rotate === undefined) args.rotate = 0
    if (args.thickness === undefined) args.thickness = 0
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    var outer, inner, cp
    if (args.iradius === null) {
        args.iradius = .5 * args.radius
    }
    if (args.thickness === null) {
        args.thickness = .2 * args.radius
    } else {
        args.thickness = args.thickness * 2 * args.iradius
    }
    outer = this.star({pos: args.pos, n: args.n, radius: args.radius, iradius:args. iradius})
    inner = this.star({pos:args. pos, n: args.n, radius: args.radius - args.thickness, iradius: (args.radius - args.thickness) * args.iradius / args.radius})
    if (args.rotate !== 0) {
        outer = this.rotatecp(outer, args.pos, args.rotate)
        inner = this.rotatecp(inner, args.pos, args.rotate)
    }
    if (args.scale !== 1) args.xscale = args.yscale = args.scale
    if (args.xscale !== 1 || args.yscale !== 1) {
        outer = this.scale(outer, args.xscale, args.yscale)
        inner = this.scale(inner, args.xscale, args.yscale)
    }
    if (args.roundness > 0) {
        outer = this.roundc(outer, {roundness: args.roundness, invert: args.invert})
        inner = this.roundc(inner, {roundness: args.roundness, invert: args.invert})
    }
    return [ outer, inner ]
}
shape_object.prototype.star = function star(args) {
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.radius === undefined) args.radius = 1
    if (args.n === undefined) args.n = 5
    if (args.iradius === undefined) args.iradius = null
    if (args.rotate === undefined) args.rotate = 0
    if (args.thickness === undefined) args.thickness = 0
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    // radius is from center to outer point of the star
    // iradius is from center to inner corners of the star
    var dtheta, theta, i, cp
    if (args.iradius === null) args.iradius = args.radius * .5
    if (args.thickness === 0) {
        cp = []
        dtheta = Math.PI / args.n
        theta = 0
        for (i = 0; i < 2 * args.n + 1; i++) {
            if (i % 2 === 0) {
                cp.push([ -args.radius * Math.sin(theta), args.radius * Math.cos(theta) ])
            } else {
                cp.push([ -args.iradius * Math.sin(theta), args.iradius * Math.cos(theta) ])
            }
            theta += dtheta
        }
        cp = this.addpos(args.pos, cp)
        cp[cp.length-1] = cp[0] // take care of possible rounding errors
        if (args.rotate !== 0) cp = this.rotatecp(cp, args.pos, args.rotate)
        if (args.scale !== 1) args.xscale = args.yscale = args.scale
        if (args.xscale !== 1 || args.yscale !== 1) cp = this.scale(cp, args.xscale, args.yscale)
        if (args.roundness > 0) cp = this.roundc(cp, {roundness: args.roundness, invert: args.invert})
    } else {
        cp = this.sframe(args)
    }
    return cp
}
shape_object.prototype.points = function points(args) {
    args = args || {}
    var path = false
    if (args.pos === undefined) args.pos = []
    if (args.rotate === undefined) args.rotate = 0
    if (args.roundness === undefined) args.roundness = 0
    if (args.invert === undefined) args.invert = false
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    if (args.path === undefined) path = args.path
    var closed, cp
    cp = args.pos
    closed = cp[cp.length-1][0] === cp[0][0] && cp[cp.length-1][1] === cp[0][1]
    if (!closed && !path) cp.push(cp[0])
    if (cp.length && args.rotate !== 0) cp = this.rotatecp(cp, cp[0], args.rotate)
    if (args.scale !== 1) args.xscale = args.yscale = args.scale
    if (args.xscale !== 1 || args.yscale !== 1) cp = this.scale(cp, args.xscale, args.yscale)
    if (args.roundness > 0) cp = this.roundc(cp, {roundness: args.roundness, invert: args.invert})
    return cp
}

/*
    ##################################
    ## ----------- GEARS ------------
    ##################################

    ## The following script has been developed and based on the
    ## Blender 235 script "Blender Mechanical Gears"
    ## developed in 2004 by Stefano <S68> Selleri,
    ## released under the Blender Artistic License (BAL).
    ## See www.blender.org.

    ####################################################################
    #CREATES THE BASE INVOLUTE PROFILE
    ####################################################################
*/
shape_object.prototype.ToothOutline = function ToothOutline(args) {
    args = args || {}
    if (args.n === undefined) args.n = 30
    if (args.res === undefined) args.res = 1
    if (args.phi === undefined) args.phi = 20
    if (args.radius === undefined) args.radius = 50
    if (args.addendum === undefined) args.addendum = .4
    if (args.dedendum === undefined) args.dedendum = .5
    if (args.fradius === undefined) args.fradius = .1
    if (args.bevel === undefined) args.bevel = .05
    var TOOTHGEO, R, DiametralPitch, ToothThickness, CircularPitch, U1, U2, ThetaA1, ThetaA2, ThetaA3
    var A, pts, normals, i, Aw, r, u, xp, yp, auxth, m, rA, xc, yc, P0, Ra, th, N, P, V
    TOOTHGEO = {
        "PitchRadius": args.radius,
        "TeethN": args.n,
        "PressureAng": args.phi,
        "Addendum": args.addendum,
        "Dedendum": args.dedendum,
        "Fillet": args.fradius,
        "Bevel": args.bevel,
        "Resolution": args.res
    }
/*      
        ####################################################################
        #Basic Math computations: Radii
*/
    R = {
        "Bottom": TOOTHGEO["PitchRadius"] - TOOTHGEO["Dedendum"] - TOOTHGEO["Fillet"],
        "Ded": TOOTHGEO["PitchRadius"] - TOOTHGEO["Dedendum"],
        "Base": TOOTHGEO["PitchRadius"] * cos(TOOTHGEO["PressureAng"] * Math.PI / 180),
        "Bevel": TOOTHGEO["PitchRadius"] + TOOTHGEO["Addendum"] - TOOTHGEO["Bevel"],
        "Add": TOOTHGEO["PitchRadius"] + TOOTHGEO["Addendum"]
    }
    DiametralPitch = TOOTHGEO["TeethN"] / (2 * TOOTHGEO["PitchRadius"])
    ToothThickness = Math.PI/2 / DiametralPitch
    CircularPitch = Math.PI / DiametralPitch
    U1 = sqrt((1 - Math.cos(TOOTHGEO["PressureAng"] * Math.PI / 1800)) / Math.cos(TOOTHGEO["PressureAng"] * Math.PI / 180))
    U2 = sqrt(R["Bevel"] * R["Bevel"] / (R["Ded"] * R["Ded"]) - 1)
    ThetaA1 = Math.atan((sin(U1) - U1 * Math.cos(U1)) / (Math.cos(U1) + U1 * Math.sin(U1)))
    ThetaA2 = Math.atan((sin(U2) - U2 * Math.cos(U2)) / (Math.cos(U2) + U2 * Math.sin(U2)))
    ThetaA3 = ThetaA1 + ToothThickness / (TOOTHGEO["PitchRadius"] * 2)
    A = {
        "Theta0": CircularPitch / (TOOTHGEO["PitchRadius"] * 2),
        "Theta1": ThetaA3 + TOOTHGEO["Fillet"] / R["Ded"],
        "Theta2": ThetaA3,
        "Theta3": ThetaA3 - ThetaA2,
        "Theta4": ThetaA3 - ThetaA2 - TOOTHGEO["Bevel"] / R["Add"]
    }
/*
        ####################################################################
        # Profiling
*/
    N = TOOTHGEO["Resolution"]
    pts = []
    normals = []
    // Top half bottom of tooth
    for (i = 0; i < 2 * N; i++) {
        th = (A["Theta1"] - A["Theta0"]) * i / (2 * N - 1) + A["Theta0"]
        pts.push([ R["Bottom"] * Math.cos(th), R["Bottom"] * Math.sin(th) ])
        normals.push([ -Math.cos(th), -Math.sin(th) ])
    }
    
    // Bottom Fillet
    xc = R["Ded"] * Math.cos(A["Theta1"])
    yc = R["Ded"] * Math.sin(A["Theta1"])
    Aw = Math.PI / 2 + A["Theta2"] - A["Theta1"]
    for (i = 0; i < N; i++) {
        th = Aw * (i + 1) / N + Math.PI + A["Theta1"]
        pts.push([ xc + TOOTHGEO["Fillet"] * Math.cos(th), yc + TOOTHGEO["Fillet"] * Math.sin(th) ])
        normals.push([ Math.cos(th), Math.sin(th) ])
    }
    
    // Straight part
    for (i = 0; i < N; i++) {
        r = (R["Base"] - R["Ded"]) * (i + 1) / N + R["Ded"]
        pts.push([ r * Math.cos(A["Theta2"]), r * Math.sin(A["Theta2"]) ])
        normals.push([ Math.cos(A["Theta2"] - Math.PI / 2), Math.sin(A["Theta2"] - Math.PI / 2) ])
    }
    
    // Tooth Involute
    for (i = 0; i < 3 * N; i++) {
        r = (R["Bevel"] - R["Base"]) * (i + 1) / (3 * N) + R["Base"]
        u = Math.sqrt(r * r / (R["Base"] * R["Base"]) - 1)
        xp = R["Base"] * (Math.cos(u) + u * Math.sin(u))
        yp = -R["Base"] * (Math.sin(u) - u * Math.cos(u))
        pts.push([ xp * Math.cos(A["Theta2"]) - yp * Math.sin(A["Theta2"]),
                   xp * Math.sin(A["Theta2"]) + yp * Math.cos(A["Theta2"]) ])
        normals.push([ -Math.sin(u), -Math.cos(u) ])
    }
    
    // Tooth Bevel
    auxth = -u
    auxth = auxth + ThetaA3 + Math.PI / 2
    m = Math.tan(auxth)
    P0 = pts[pts.length - 1]
    rA = TOOTHGEO["Bevel"] / (1 - Math.cos(auxth - A["Theta4"]))
    xc = P0[0] - rA * Math.cos(auxth)
    yc = P0[1] - rA * Math.sin(auxth)
    for (i = 0; i < N; i++) {
        th = (A["Theta4"] - auxth) * (i + 1) / N + auxth
        pts.push([ xc + rA * Math.cos(th), yc + rA * Math.sin(th) ])
        normals.push([ -Math.cos(th), -Math.sin(th) ])
    }
    
    // Tooth Top
    P0 = pts[pts.length - 1]
    A["Theta4"] = Math.atan(P0[1] / P0[0])
    Ra = Math.sqrt(P0[0] * P0[0] + P0[1] * P0[1])
    for (i = 0; i < N; i++) {
        th = -A["Theta4"] * (i + 1) / N + A["Theta4"]
        pts.push([ Ra * Math.cos(th), Ra * Math.sin(th) ])
        normals.push([ -Math.cos(th), -Math.sin(th) ])
    }
    
    // Mirrors this!
    N = pts.length
    for (i = 0; i < N - 1; i++) {
        P = pts[N - 2 - i]
        pts.push([ P[0], -P[1] ])
        V = normals[N - 2 - i]
        normals.push([ V[0], -V[1] ])
    }
    return pts
}

/*
   ####################################################################
    #CREATES THE BASE RACK PROFILE
    ####################################################################
*/
shape_object.prototype.RackOutline = function RackOutline(args) {
    args = args || {}
    if (args.n === undefined) args.n = 30
    if (args.res === undefined) args.res = 1
    if (args.phi === undefined) args.phi = 20
    if (args.radius === undefined) args.radius = 5
    if (args.addendum === undefined) args.addendum = .4
    if (args.dedendum === undefined) args.dedendum = .5
    if (args.fradius === undefined) args.fradius = .1
    if (args.bevel === undefined) args.bevel = .05
    var TOOTHGEO, X, DiametralPitch, ToothThickness, CircularPitch, Pa, yA1, yA2, yA3, A
    var pts, normals, ist, i, Aw, Xded, x, rA, xc, yc, th, y, N, P, V
    TOOTHGEO = {
        "PitchRadius": args.radius,
        "TeethN": args.n,
        "PressureAng": args.phi,
        "Addendum": args.addendum,
        "Dedendum": args.dedendum,
        "Fillet": args.fradius,
        "Bevel": args.bevel,
        "Resolution": args.res
    }

/*
        ####################################################################
        # Basic Math computations: Quotes
*/
    X = {
        "Bottom": -TOOTHGEO["Dedendum"] - TOOTHGEO["Fillet"],
        "Ded": -TOOTHGEO["Dedendum"],
        "Bevel": TOOTHGEO["Addendum"] - TOOTHGEO["Bevel"],
        "Add": TOOTHGEO["Addendum"]
    }
    
/*
        ####################################################################
        #Basic Math computations: Angles
*/
    DiametralPitch = TOOTHGEO["TeethN"] / (2 * TOOTHGEO["PitchRadius"])
    ToothThickness = Math.PI/2 / DiametralPitch
    CircularPitch = Math.PI / DiametralPitch
    Pa = TOOTHGEO["PressureAng"] * Math.PI / 180
    yA1 = ToothThickness / 2
    yA2 = (-X["Ded"] + TOOTHGEO["Fillet"] * Math.sin(Pa)) * Math.tan(Pa)
    yA3 = TOOTHGEO["Fillet"] * Math.cos(Pa)
    A = {
        "y0": CircularPitch / 2,
        "y1": yA1 + yA2 + yA3,
        "y2": yA1 + yA2,
        "y3": yA1 - (X["Add"] - TOOTHGEO["Bevel"]) * Math.tan(Pa),
        "y4": yA1 - (X["Add"] - TOOTHGEO["Bevel"]) * Math.tan(Pa) - cos(Pa) / (1 - Math.sin(Pa)) * TOOTHGEO["Bevel"]
    }

/*
        ####################################################################
        # Profiling
*/
    N = TOOTHGEO["Resolution"]
    pts = []
    normals = []
    ist = 0
    if (args.fradius) {
        ist = 1
    }
    // Top half bottom of tooth
    for (i = ist; i < 2 * N; i++) {
        y = (A["y1"] - A["y0"]) * i / (2 * N - 1) + A["y0"]
        pts.push([ X["Bottom"], y ])
        normals.push([ -1, -0 ])
    }
    
    // Bottom Fillet
    xc = X["Ded"]
    yc = A["y1"]
    Aw = Math.PI / 2 - Pa
    for (i = 0; i < N; i++) {
        th = Aw * (i + 1) / N + Math.PI
        pts.push([ xc + TOOTHGEO["Fillet"] * Math.cos(th), yc + TOOTHGEO["Fillet"] * Math.sin(th) ])
        normals.push([ Math.cos(th), Math.sin(th) ])
    }
    
    // Straight part
    Xded = X["Ded"] - TOOTHGEO["Fillet"] * Math.sin(Pa)
    for (i = 0; i < 4 * N; i++) {
        x = (X["Bevel"] - Xded) * (i + 1) / (4 * N) + Xded
        pts.push([ x, yA1 - Math.tan(Pa) * x ])
        normals.push([ -Math.sin(Pa), -Math.cos(Pa) ])
    }
    
    // Tooth Bevel
    rA = TOOTHGEO["Bevel"] / (1 - Math.sin(Pa))
    xc = X["Add"] - rA
    yc = A["y4"]
    for (i = 0; i < N; i++) {
        th = (-Math.PI / 2 + Pa) * (i + 1) / N + Math.PI / 2 - Pa
        pts.push([ xc + rA * Math.cos(th), yc + rA * Math.sin(th) ])
        normals.push([ -Math.cos(th), -Math.sin(th) ])
    }
    
    // Tooth Top
    for (i = 0; i < N; i++) {
        y = -A["y4"] * (i + 1) / N + A["y4"]
        pts.push([ X["Add"], y ])
        normals.push([ -1, 0 ])
    }
    
    // Mirrors this!
    N = pts.length
    for (i = 0; i < N - 1; i++) {
        P = pts[N - 2 - i]
        pts.push([ P[0], -P[1] ])
        V = normals[N - 2 - i]
        normals.push([ V[0], -V[1] ])
    }
    return pts
}

/* Crown gears not yet implemented
//    ####################################################################
//    # CREATES THE BASE CROWN INVOLUTE 
//    ####################################################################

shape_object.prototype.CrownOutline = function CrownOutline(args) {
    args = args || {}
    if (args.n === undefined) args.n = 30
    if (args.res === undefined) args.res = 1
    if (args.phi === undefined) args.phi = 20
    if (args.radius === undefined) args.radius = 50
    if (args.addendum === undefined) args.addendum = .4
    if (args.dedendum === undefined) args.dedendum = .5
    if (args.fradius === undefined) args.fradius = .1
    if (args.bevel === undefined) args.bevel = .05
    var TOOTHGEO, R, DiametralPitch, ToothThickness, CircularPitch, U1, U2, ThetaA1, ThetaA2, ThetaA3, A, M, apoints, anormals, i, Aw, r, u, xp, yp, auxth, m, rA, xc, yc, P0, Ra, th, pts, normals, N, P, V
    TOOTHGEO = {
        "PitchRadius": args.radius,
        "TeethN": args.n,
        "PressureAng": args.phi,
        "Addendum": args.addendum,
        "Dedendum": args.dedendum,
        "Fillet": args.fradius,
        "Bevel": args.bevel,
        "Resolution": args.res
    }

//    ####################################################################
//    # Basic Math computations: Radii
        
    R = {
        "Bottom": TOOTHGEO["PitchRadius"] * cos(TOOTHGEO["PressureAng"] * Math.PI / 1800),
        "Base": TOOTHGEO["PitchRadius"] * cos(TOOTHGEO["PressureAng"] * Math.PI / 1800) + TOOTHGEO["Fillet"],
        "Ded": TOOTHGEO["PitchRadius"] + TOOTHGEO["Dedendum"]
    }

//        ####################################################################
//        #Basic Math computations: Angles

    DiametralPitch = TOOTHGEO["TeethN"] / (2 * TOOTHGEO["PitchRadius"])
    ToothThickness = Math.PI/2 / DiametralPitch
    CircularPitch = Math.PI / DiametralPitch
    U1 = Math.sqrt((1 - Math.cos(TOOTHGEO["PressureAng"] * Math.PI / 180)) / Math.cos(TOOTHGEO["PressureAng"] * Math.PI / 180))
    U2 = Math.sqrt(R["Ded"] * R["Ded"] / (R["Base"] * R["Base"]) - 1)
    ThetaA1 = Math.atan((Math.sin(U1) - U1 * Math.cos(U1)) / (Math.cos(U1) + U1 * Math.sin(U1)))
    ThetaA2 = Math.atan((Math.sin(U2) - U2 * Math.cos(U2)) / (Math.cos(U2) + U2 * Math.sin(U2)))
    ThetaA3 = ThetaA1 + ToothThickness / (TOOTHGEO["PitchRadius"] * 2)
    A = {
        "Theta0": CircularPitch / (TOOTHGEO["PitchRadius"] * 2),
        "Theta1": ThetaA3 + TOOTHGEO["Fillet"] / R["Base"],
        "Theta2": ThetaA3,
        "Theta3": ThetaA3 - ThetaA2,
        "Theta4": ThetaA3 - ThetaA2 - TOOTHGEO["Bevel"] / R["Ded"]
    }
    M = A["Theta0"]
    A["Theta0"] = 0
    A["Theta1"] = A["Theta1"] - M
    A["Theta2"] = A["Theta2"] - M
    A["Theta3"] = A["Theta3"] - M
    A["Theta4"] = A["Theta4"] - M
    
//        ####################################################################
//        # Profiling

    N = TOOTHGEO["Resolution"]
    apoints = []
    anormals = []
    
    // Top half top of tooth
    for (i = 0; i < 2 * N; i++) {
        th = (A["Theta1"] - A["Theta0"]) * i / (2 * N - 1) + A["Theta0"]
        apoints.push([ R["Bottom"] * Math.cos(th), R["Bottom"] * Math.sin(th) ])
        anormals.push([ Math.cos(th), Math.sin(th) ])
    }
    
    // Bottom Bevel
    xc = R["Base"] * Math.cos(A["Theta1"])
    yc = R["Base"] * Math.sin(A["Theta1"])
    Aw = Math.PI / 2 + A["Theta2"] - A["Theta1"]
    for (i = 0; i < N; i++) {
        th = Aw * (i + 1) / N + Math.PI + A["Theta1"]
        apoints.push([ xc + TOOTHGEO["Fillet"] * Math.cos(th), yc + TOOTHGEO["Fillet"] * Math.sin(th) ])
        anormals.push([ -Math.cos(th), -Math.sin(th) ])
    }
    
    // Tooth Involute
    for (i = 0; i < 4 * N; i++) {
        r = (R["Ded"] - R["Base"]) * (i + 1) / (4 * N) + R["Base"]
        u = Math.sqrt(r * r / (R["Base"] * R["Base"]) - 1)
        xp = R["Base"] * (Math.cos(u) + u * Math.sin(u))
        yp = -R["Base"] * (Math.sin(u) - u * Math.cos(u))
        apoints.push([ xp * Math.cos(A["Theta2"]) - yp * Math.sin(A["Theta2"]), +xp * Math.sin(A["Theta2"]) + yp * Math.cos(A["Theta2"]) ])
        anormals.push([ Math.sin(u), Math.cos(u) ])
    }
    
    // Tooth Bevel
    auxth = -u
    auxth = auxth + ThetaA3 + Math.PI / 2
    m = Math.tan(auxth)
    P0 = apoints[apointslength - 1]
    rA = TOOTHGEO["Bevel"] / (1 - Math.cos(auxth - A["Theta4"]))
    xc = P0[0] - rA * Math.cos(auxth)
    yc = P0[1] - rA * Math.sin(auxth)
    for (i = 0; i < N; i++) {
        th = (A["Theta4"] - auxth) * (i + 1) / N + auxth
        apoints.push([ xc + rA * Math.cos(th), yc + rA * Math.sin(th) ])
        anormals.push([ Math.cos(th), Math.sin(th) ])
    }
    
    // Tooth Top
    P0 = apoints[apoints.length - 1]
    A["Theta4"] = Math.atan(P0[1] / P0[0])
    Ra = Math.sqrt(P0[0] * P0[0] + P0[1] * P0[1])
    for (i = 0; i < N; i++) {
        th = (-M - A["Theta4"]) * (i + 1) / N + A["Theta4"]
        apoints.push([ Ra * Math.cos(th), Ra * Math.sin(th) ])
        anormals.push([ Math.cos(th), Math.sin(th) ])
    }
    pts = []
    normals = []
    N = apoints.length
    for (i = 0; i < N; i++) {
        pts.push(apoints[N - 1 - i])
        normals.push(anormals[N - 1 - i])
    }
      
    // Mirrors this!
    N = pts.length
    for (i = 0; i < N - 1; i++) {
        P = pts[N - 2 - i]
        pts.push([ P[0], -P[1] ])
        V = normals[N - 2 - i]
        normals.push([ V[0], -V[1] ])
    }
    return pts
} // End of CrownOutline function
*/

shape_object.prototype.gear = function gear(args) {
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.n === undefined) args.n = 20
    if (args.radius === undefined) args.radius = 1
    if (args.phi === undefined) args.phi = 20
    if (args.addendum === undefined) args.addendum = 0.08*args.radius
    if (args.dedendum === undefined) args.dedendum = 0.1*args.radius
    if (args.fradius === undefined) args.fradius = 0.02*args.radius
    if (args.rotate === undefined) args.rotate = 0
    if (args.scale === undefined) args.scale = 1
    if (args.res === undefined) args.res = 1
    var bevel = 0
    if (args.bevel !== undefined) bevel = args.bevel
    var itooth, px, py, rad, driro, ir, ro, ix, iy, p, tooth, rotan, rtooth, rx, ry, x, y, i, gear, outer
    var lastx = 10000, lasty = 10000
    args.bevel = 0
    tooth = this.ToothOutline(args)
    args.bevel = bevel
    gear = []
    for (i=0; i < args.n; i++) {
        rotan = -i * 2 * Math.PI / args.n
        rtooth = []
        for (var j=0; j<tooth.length; j++) {
            p = tooth[j]
            x = p[0]
            y = p[1]
            rx = x * Math.cos(rotan) - y * Math.sin(rotan) +  args.pos[0]
            ry = x * Math.sin(rotan) + y * Math.cos(rotan) +  args.pos[1]
            rtooth.push([rx, ry])
        }
        gear = gear.concat(rtooth)
    }
    if (args.scale !== 1) gear = this.scale(gear, args.scale, args.scale)
    if (args.rotate !== 0) gear = this.rotatecp(gear, args.pos, args.rotate)
    var pts = []
    var g1, g2, g3
    for (var i=0; i<gear.length; i++) { 
    	// must eliminate neighboring repeated points and collinear points; poly2tri.js chokes on them
    	g1 = gear[i]
    	pts.push(g1)
    	if (i == gear.length-1) break
    	g2 = gear[i+1]
    	if (i < gear.length-2) {
    		g3 = gear[i+2]
    		// just check for a-b-a instance of collinear points
    		if ( (Math.abs(g3[0]-g1[0]) < .001*args.radius) && (Math.abs(g3[1]-g1[1]) < .001*args.radius) ) i += 2
    		g2 = gear[i]
    		if (g1[0] === g2[0] && g1[1] === g2[1]) i++
    		continue
    	}
    	if (g1[0] === g2[0] && g1[1] === g2[1]) {
    		i++
    		continue
    	}
    }
	g1 = pts[0]
	g2 = pts[pts.length-1]
	if (!(g1[0] === g2[0] && g1[1] === g2[1])) pts.push(g1)
    return pts
}
shape_object.prototype.rackgear = function rackgear(args) {
    args = args || {}
    if (args.pos === undefined) args.pos = [ 0, 0 ]
    if (args.n === undefined) args.n = 30
    if (args.radius === undefined) args.radius = 5
    if (args.phi === undefined) args.phi = 20
    if (args.addendum === undefined) args.addendum = .08 * args.radius
    if (args.dedendum === undefined) args.dedendum = .1 * args.radius
    if (args.fradius === undefined) args.fradius = .02 * args.radius
    if (args.rotate === undefined) args.rotate = 0
    if (args.scale === undefined) args.scale = 1
    if (args.length === undefined) args.length = 10 * Math.PI
    if (args.res === undefined) args.res = 1
    if (args.bevel === undefined) args.bevel = .05
    if (args.depth === undefined) args.depth = .4 + .6 + .1
    var tooth, toothl, nt, flength, gear, ntooth, nx, ny, i
    var x, y, left, right, bottom, top, g, center, dx, dy, gear2, p
    var lastx = 10000, lasty = 10000
    tooth = this.RackOutline(args)
    toothl = tooth[0][1] - tooth[tooth.length-1][1]
    nt = Math.floor(args.length / toothl)
    flength = nt * toothl
    gear = []
    for (i = 0; i < nt; i++) {
        ntooth = []
        for (var j=0; j<tooth.length; j++) {
            p = tooth[j]
            x = p[0]
            y = p[1]
            if (x == lastx || y == lasty) continue
            nx = x + args.pos[0]
            ny = -i * toothl + y + args.pos[1]
            ntooth.push([nx, ny])
            lastx = x
            lasty = y
        }
        gear = gear.concat(ntooth)
    }
    gear.push([gear[gear.length-1][0] - args.depth, gear[gear.length-1][1]])
    gear.push([gear[0][0] - args.depth, gear[0][1]])
    gear.push(gear[0])
    left = 1e3
    right = -1e3
    bottom = 1e3
    top = -1e3
    for (i=0; i<gear.length; i++) {
        g = gear[i]
        x = g[0]
        y = g[1]
        if (x < left) left = x
        if (x > right) right = x
        if (y < bottom) bottom = y
        if (y > top) top = y
    }
    center = [ (left + right) / 2, (bottom + top) / 2 ]
    dx = args.pos[0] - center[0]
    dy = args.pos[1] - center[1]
    gear2 = []
    for (i=0; i<gear.length; i++) {
        g = gear[i]
        gear2.push([ g[0] + dx, g[1] + dy ])
    }
    if (args.scale !== 1) gear2 = this.scale(gear2, args.scale, args.scale)
    if (args.rotate !== 0) gear2 = this.rotate(gear2, args.pos, args.rotate)
	var g1 = gear2[0]
	var g2 = gear2[gear2.length-1]
	if (!(g1[0] === g2[0] && g1[1] === g2[1])) gear2.push(g1)
    return gear2
}

/*
##################################
## ----------- paths -------------
##################################
*/

function path_object() {
}
path_object.prototype.convert = function convert(args) { // pos, up, pts
    args = args || {}
    if (args.pos === undefined) args.pos = vec(0, 0, 0)
    if (args.up === undefined) args.up = vec(0, 1, 0)
    if (args.pts === undefined) args.pts = null
    if (args.closed === undefined) args.closed = true
    var up0, angle, reorient, axis, p, newpt, pt, i
    args.up = norm(args.up)
    up0 = vec(0, 1, 0)
    angle = Math.acos(args.up.dot(up0))
    reorient = angle > 0
    axis = up0.cross(args.up)
    p = []
    for (i=0; i<args.pts.length; i++) {
        pt = args.pts[i]
        newpt = vec(pt[0], 0, 0-pt[1])
        if (reorient) newpt = newpt.rotate({angle: angle, axis: axis})
        p.push(args.pos.add(newpt))
    }
    if (closed && !(p[p.length-1].equals(p[0]))) {
        p.push(pts[0])
    }
    return p
}
path_object.prototype.setuppath = function setuppath(args) {
	args.path = true
    var pos // a vector that positions the path
    if (args.pos === undefined) {
        pos = vec(0,0,0)
    } else {
        pos = args.pos
        if (pos.x === undefined) throw new Error('The pos attribute of a path must be a vector.')
        delete args.pos
    }
    return pos
}
path_object.prototype.rectangle = function rectangle(args) { // pos, width, height, rotate, thickness, roundness, invert, scale, xscale, yscale, up
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in a rectangular path")
    var pos = this.setuppath(args)
    var c = shapes.rectangle(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.cross = function cross(args) {
    args = args || {}
    var pos = this.setuppath(args)
    var c = shapes.cross(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.trapezoid = function trapezoid(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in a trapezoid path")
    var pos = this.setuppath(args)
    var c = shapes.trapezoid(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.circle = function circle(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in a circle path")
    var pos = this.setuppath(args)
    var c = shapes.circle(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.line = function line(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in a line path")
    if (args.np === undefined) args.np = 2
    if (args.rotate === undefined) args.rotate = 0
    if (args.scale === undefined) args.scale = 1
    if (args.xscale === undefined) args.xscale = 1
    if (args.yscale === undefined) args.yscale = 1
    if (args.start === undefined) args.start = vec(0,0,0)
    if (args.end === undefined) args.end = vec(0,0,-0.1)
    let v, dv, i
    let cp = [args.start]
    v = args.end.sub(args.start)
    dv = v.divide(Math.floor(args.np-1))
    for (i = 1; i < args.np; i++) {
    	cp.push(cp[i-1].add(dv))
    }
    return cp
}
path_object.prototype.arc = function arc(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in an arc path")
    args.path = true
    var pos = this.setuppath(args)
    var c = shapes.arc(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.ellipse = function ellipse(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in an ellipse path")
    var pos = this.setuppath(args)
    var c = shapes.ellipse(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.ngon = function ngon(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in an ngon path")
    var pos = this.setuppath(args)
    var c = shapes.ngon(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.triangle = function triangle(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in a pentagon path")
    var pos = this.setuppath(args)
    var c = shapes.triangle(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.pentagon = function pentagon(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in a triangle path")
    var pos = this.setuppath(args)
    var c = shapes.pentagon(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.hexagon = function hexagon(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in a hexagon path")
    var pos = this.setuppath(args)
    var c = shapes.hexagon(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.octagon = function octagon(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in an octagon path")
    var pos = this.setuppath(args)
    var c = shapes.octagon(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}
path_object.prototype.star = function star(args) {
    args = args || {}
    if (args.thickness !== undefined) throw Error("Thickness is not allowed in a star path")
    var pos = this.setuppath(args)
    var c = shapes.star(args)
    return this.convert({pos: pos, up: args.up, pts: c})
}

var paths = new path_object()
var shapes = new shape_object()
    
var exports = {
    paths: paths,
    shapes: shapes
}

Export(exports)

})()
