GlowScript 1.0

/* Hard-sphere gas. */

// Bruce Sherwood, sped up with a routine by David Scherer

// VPython gas.py with 100 atoms, dt = 1e-5, rate 500, no graphing: 100 iterations = 0.4 seconds.
// If gas.py is modified to not use numpy, the time is 3.6 s.
// This similar Glowsript program with same conditions on same machine: 100 iterations = 1.0 seconds
// on Chrome, Firefox, or Internet Explorer.

var win=500

var Natoms = 100  // change this to have more or fewer atoms

// Typical values
var L = 1 // container is a cube L on a side
var gray = color.gray(0.7) // color of edges of container
var Matom = 4E-3/6E23 // helium mass
var Ratom = 0.03 // wildly exaggerated size of helium atom
var k = 1.4E-23 // Boltzmann constant
var T = 300 // around room temperature
var dt = 1E-5

var animation = canvas( {width:win, height:win} )
animation.range = L

var d = L/2+Ratom
var boxbottom = curve({color:gray})
boxbottom.push(vec(-d,-d,-d), vec(-d,-d,d), vec(d,-d,d), vec(d,-d,-d), vec(-d,-d,-d))
var boxtop = curve({color:gray})
boxtop.push(vec(-d,d,-d), vec(-d,d,d), vec(d,d,d), vec(d,d,-d), vec(-d,d,-d))
var vert1 = curve({color:gray})
var vert2 = curve({color:gray})
var vert3 = curve({color:gray})
var vert4 = curve({color:gray})
vert1.push(vec(-d,-d,-d), vec(-d,d,-d))
vert2.push(vec(-d,-d,d), vec(-d,d,d))
vert3.push(vec(d,-d,d), vec(d,d,d))
vert4.push(vec(d,-d,-d), vec(d,d,-d))

var colors = [color.red, color.green, color.blue,
              color.yellow, color.cyan, color.magenta]

var Atoms = []
var apos = []
var p = []
var mass = Matom*pow(Ratom,3)/pow(Ratom,3)
var pavg = sqrt(2*mass*1.5*k*T) // average kinetic energy p**2/(2mass) = (3/2)kT
    
for (var i=0; i<Natoms; i++) {
    var x = L*Math.random()-L/2
    var y = L*Math.random()-L/2
    var z = L*Math.random()-L/2
    Atoms.push(sphere( {pos:vec(x,y,z), color:colors[i % 6], size:2*Ratom*vec(1,1,1)} ) )
    apos.push(vec(x,y,z))
    var theta = pi*Math.random()
    var phi = 2*pi*Math.random()
    var px = pavg*sin(theta)*cos(phi)
    var py = pavg*sin(theta)*sin(phi)
    var pz = pavg*cos(theta)
    p.push(vec(px,py,pz))
}
animation.title.text('A "hard-sphere" gas')
var s = 'Theoretical and averaged speed distributions (meters/sec).\n'
s += 'Initially all atoms have the same speed, but collisions\n'
s += 'change the speeds of the colliding atoms.'
animation.caption.text(s)

var deltav = 100 // binning for v histogram

function barx(v) {
    return Math.floor(v/deltav) // index into bars array
}

var histo = new Array(4000/deltav)
for (var i=0; i<histo.length; i++) histo[i] = 0
histo[barx(pavg/mass)] = Natoms

graph( {width:win, height:0.4*win, xmax:3000, ymax:Natoms*deltav/1000} )
var theory = series( {color:color.cyan} )
var dv = 10
for (var v=0; v<3001+dv; v+=dv)  // theoretical prediction
    theory.plot( v, (deltav/dv)*Natoms*4*pi*pow(Matom/(2*pi*k*T),1.5) *exp(-0.5*Matom*pow(v,2)/(k*T))*pow(v,2)*dv )


var accum = new Array(3000/deltav)
for (var i=0; i<accum.length; i++) accum[i] = [deltav*(i+.5),0]
var vdist = series( {type:'bar', color:color.red, delta:deltav} )

function interchange(v1, v2) { // remove from v1 bar, add to v2 bar
    var barx1 = barx(v1)
    var barx2 = barx(v2)
    if (barx1 == barx2) { return }
    histo[barx1] -= 1
    histo[barx2] += 1
}

// The following routine by David Scherer increases the speed greatly
function checkCollisions(apos) {
    "no overloading"; // no operator overloading invoked here
    var hitlist = []
    var Natoms = apos.length;
    var r2 = 2*Ratom;
    r2*=r2;
    for (var i=0; i<Natoms; i++) {
        var ai = apos[i]
        var aix = ai.x, aiy = ai.y, aiz = ai.z
        for (var j=i+1; j<Natoms; j++) {
            var aj = apos[j]
            var dx = aix - aj.x, dy = aiy - aj.y, dz = aiz - aj.z
            if ( dx*dx + dy*dy + dz*dz < r2 ) 
                hitlist.push([i,j])
        }
    }
    return hitlist;
}

var nhisto = 0 // number of histogram snapshots to average

while(true) {
    rate(100,wait)
    // Accumulate and average histogram snapshots
    for (var i=0; i<accum.length; i++) accum[i][1] = (nhisto*accum[i][1] + histo[i])/(nhisto+1)
    if (nhisto % 10 === 0) vdist.data = accum // update graph every 10th iteration
    nhisto += 1

    // Update all positions
    for (var i=0; i<Natoms; i++) Atoms[i].pos = apos[i] = apos[i] + (p[i]/mass)*dt
    
    // Check for collisions
    var hitlist = checkCollisions(apos)

    // If any collisions took place, update momenta of the two atoms
    for (var id1 in hitlist) {
        var ij = hitlist[id1]
        var i = ij[0]
        var j = ij[1]
        var ptot = p[i]+p[j]
        var vi = p[i]/mass
        var vj = p[j]/mass
        var vrel = vj-vi
        var a = vrel.mag2()
        if (a === 0) continue;  // exactly same velocities
        var rrel = apos[j]-apos[i]
        var b = 2*rrel.dot(vrel)
        var c = rrel.mag2()-Ratom*Ratom
        var d = b*b-4*a*c
        if (d < 0) continue;  // something wrong; ignore this rare case
        var deltat = (-b+sqrt(d))/(2*a) // t-deltat is when they made contact
        apos[i] = apos[i]-vi*deltat // back up to contact configuration
        apos[j] = apos[j]-vj*deltat
        var mtot = 2*mass
        var pcmi = p[i]-ptot*mass/mtot // transform momenta to cm frame
        var pcmj = p[j]-ptot*mass/mtot
        rrel = norm(rrel)
        pcmi = pcmi-2*pcmi.dot(rrel)*rrel // bounce in cm frame
        pcmj = pcmj-2*pcmj.dot(rrel)*rrel
        p[i] = pcmi+ptot*mass/mtot // transform momenta back to lab frame
        p[j] = pcmj+ptot*mass/mtot
        apos[i] = apos[i]+(p[i]/mass)*deltat // move forward deltat in time
        apos[j] = apos[j]+(p[j]/mass)*deltat
        interchange(vi.mag(), p[i].mag()/mass)
        interchange(vj.mag(), p[j].mag()/mass)
    }
    
    for (var i=0; i<Natoms; i++) {
        var loc = apos[i]
        if (abs(loc.x) > L/2) {
            if (loc.x < 0) p[i].x =  abs(p[i].x)
            else p[i].x =  -abs(p[i].x)
        }
        if (abs(loc.y) > L/2) {
            if (loc.y < 0) p[i].y =  abs(p[i].y)
            else p[i].y =  -abs(p[i].y)
        }
        if (abs(loc.z) > L/2) {
            if (loc.z < 0) p[i].z =  abs(p[i].z)
            else p[i].z =  -abs(p[i].z)
        }
    }
}
