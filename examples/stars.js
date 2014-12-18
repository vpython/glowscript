GlowScript 1.0

/* Stars interacting gravitationally. */

// Bruce Sherwood; optimized for GlowScript by David Scherer

scene.width = scene.height = 600

function display_instructions() {
    var s1 = "In GlowScript programs:\n\n"
    var s2 = "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n\n"
    var s3 = "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt key and drag,\n         or use the mouse wheel."
    scene.caption.text(s1+s2+s3)
}

// Display text below the 3D graphics:
scene.title.text("Stars interacting gravitationally")
display_instructions()

var Nstars = 20  // change this to have more or fewer stars

var G = 6.7e-11 // Universal gravitational constant

// Typical values
var Msun = 2E30
var Rsun = 2E9
var L = 4e10
var vsun = 0.8*sqrt(G*Msun/Rsun)

scene.range = 2*L
scene.forward = vec(-1,-1,-1)

var xaxis = curve( {color:color.gray(0.5), radius:3e8} )
xaxis.push(vec(0,0,0))
xaxis.push(vec(L,0,0))
var yaxis = curve( {color:color.gray(0.5), radius:3e8} )
yaxis.push(vec(0,0,0))
yaxis.push(vec(0,L,0))
var zaxis = curve( {color:color.gray(0.5), radius:3e8} )
zaxis.push(vec(0,0,0))
zaxis.push(vec(0,0,L))

var Stars = []
var star_colors = [color.red, color.green, color.blue,
              color.yellow, color.cyan, color.magenta]

var psum = vec(0,0,0)
for (var i=0; i<Nstars; i++) {
    var star = sphere()
    star.pos = L*vec.random()
    var R = Rsun/2+Rsun*Math.random()
    star.size = 2*R*vec(1,1,1)
    star.mass = Msun*pow(R/Rsun,3)
    star.momentum = vec.random()*vsun*star.mass
    star.color = star_colors[i % 6]
    attach_trail(star)
    Stars.push( star )
    psum = psum + star.momentum
}

// make total initial momentum equal zero
for (var i=0; i<Nstars; i++) {
    Stars[i].momentum = Stars[i].momentum - psum/Nstars
}

var dt = 1000.0
var Nhits = 0
var steps = 0

function computeForces( stars, hitlist ) {
    // For maximum speed, there is no operator overloading here.
    "no overloading";
    
    var len = stars.length
    var dlen = 0
    var data = new Array(len * 6)
    var i
    
    // For speed, unpack structs
    for(i=0; i<len; i++) {
        var star = stars[i]
        if (star === null) continue;
        data[dlen] = star.pos.x
        data[dlen+1] = star.pos.y
        data[dlen+2] = star.pos.z
        data[dlen+3] = star.size.x/2 // star radius
        data[dlen+4] = star.mass
        data[dlen+5] = i
        dlen += 6
    }
    
    for(i=0; i<dlen; i+=6) {
        var Fx=0, Fy=0, Fz=0
        var ix = data[i], iy=data[i+1], iz=data[i+2], iradius=data[i+3], imass=data[i+4]
        for(var j=0; j<dlen; j+=6) {
            if (i===j) continue;
            
            var rx=data[j]-ix, ry=data[j+1]-iy, rz=data[j+2]-iz, rad=data[j+3]+iradius, jmass=data[j+4]
            var rmag2 = rx*rx + ry*ry + rz*rz
            if (rmag2 <= rad*rad)
                hitlist.push([data[i+5],data[j+5]])
            var f = G*imass*jmass/pow(rmag2,1.5)
            Fx += f*rx
            Fy += f*ry
            Fz += f*rz
        }
        var star = stars[data[i+5]]
        star.momentum.x += Fx*dt
        star.momentum.y += Fy*dt
        star.momentum.z += Fz*dt
    }
}

while (true) {
    rate(100,wait)
    var hitlist = []
    
    // Compute all forces on all stars
    computeForces(Stars, hitlist)

    // Having updated all momenta, now update all positions
    for (var i=0; i<Stars.length; i++) {
        var star = Stars[i]
        if (star) {
            star.pos = star.pos + star.momentum*(dt/star.mass)
        }
    }

    // If any collisions took place, merge those stars
    for(var hit=hitlist.length-1; hit>=0; hit--) {
        var s1 = Stars[hitlist[hit][0]]
        var s2 = Stars[hitlist[hit][1]]
        if (!s1 || !s2) continue;
    
        var snew = sphere()
        snew.mass = s1.mass + s2.mass
        snew.momentum = s1.momentum + s2.momentum
        snew.pos = (s1.mass*s1.pos + s2.mass*s2.pos) / snew.mass
        snew.color = (s1.mass*s1.color + s2.mass*s2.color) / snew.mass
        attach_trail(snew, {color:snew.color, radius:2e8})
        var R = Rsun*pow(snew.mass / Msun, 1/3)
        snew.size = 2*R*vec(1,1,1)
        
        s1.visible = false
        s2.visible = false
        Stars[hitlist[hit][0]] = snew
        Stars[hitlist[hit][1]] = null
    }
}
