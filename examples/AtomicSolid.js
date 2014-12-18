GlowScript 1.0
/* In GlowScript programs, rotate the camera by dragging with the right mouse button, or hold down the Ctrl key and drag.
   
To zoom, drag with the left+right mouse buttons, or hold down the Alt key and drag, or use the mouse wheel.*/

vec.axes = [vec(1,0,0), vec(0,1,0), vec(0,0,1)]

var k = 1
var m = 1
var spacing = 1.0
var atom_radius = 0.3*spacing
var L0 = spacing-1.8*atom_radius
var V0 = pi*pow(0.5*atom_radius,2)*L0 // initial volume of spring
var N = 3
var crystal = makeCrystal(N, atom_radius, spacing, 0.1*spacing*sqrt(k/m))
scene.center = 0.5*(N-1)*vec(1,1,1)
scene.autoscale = false
var dt = 0.04*(2*pi*sqrt(m/k))

function display_instructions() {
    var s1 = "In GlowScript programs:\n\n"
    var s2 = "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n\n"
    var s3 = "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt key and drag,\n         or use the mouse wheel."
    scene.caption.text(s1+s2+s3)
}

// Display text below the 3D graphics:
scene.title.text("A model of a solid represented as atoms connected by interatomic bonds")
display_instructions()

function makeCrystal( N, atom_radius, spacing, momentumRange ) {
    var crystal = { atoms:[], springs:[] }
    var atom
    var x,y,z

    function atomAt(np) {
        if (np.x>=0 && np.y>=0 && np.z>=0 && np.x<N && np.y<N && np.z<N)
            return crystal.atoms[np.x + np.y*N + np.z*N*N]
        // Otherwise create an invisible wall and return it
        var w = box()
        w.visible = false  // comment out to see the true model
        w.size = atom_radius*vec(1,1,1)
        w.pos = np*spacing
        w.momentum = vec(0,0,0)
        return w
    }

    // Create N^3 atoms in a grid
    for(z=0; z<N; z++)
        for(y=0; y<N; y++)
            for(x=0; x<N; x++) {
                atom = sphere()
                atom.pos = vec(x,y,z)*spacing
                atom.size = 2*atom_radius*vec(1,1,1)
                atom.color = vec(0,0.58,0.69)
                atom.momentum = momentumRange*vec.random()
                crystal.atoms.push( atom )
            }
    
    // Create a grid of springs linking each atom to the adjacent atoms
    // in each dimension, or to invisible walls where no atom is adjacent
    for(var d=0; d<3; d++)
        for(z=-1; z<N; z++)
            for(y=-1; y<N; y++)
                for(x=-1; x<N; x++) {
                    atom = atomAt(vec(x,y,z))
                    var neighbor = atomAt(vec(x,y,z)+vec.axes[d])

                    if (atom.visible || neighbor.visible) {
                        var spring = helix()
                        spring.visible = atom.visible && neighbor.visible
                        spring.thickness = 0.05
                        spring.size = vec(spacing,atom_radius,atom_radius)
                        spring.up = vec(1,1,1) // prevent fibrillation of vertical springs
                        spring.atoms = [ atom, neighbor ]
                        spring.color = vec(1,0.5,0)
                        crystal.springs.push(spring)
                    }
                }
    return crystal
}

while (true) {
    rate(30,wait)
    for(var a=0; a<crystal.atoms.length; a++) {
        var atom = crystal.atoms[a]
        atom.pos = atom.pos + atom.momentum/m*dt
    }
    for(var s=0; s<crystal.springs.length; s++) {
        var spring = crystal.springs[s]
        spring.axis = spring.atoms[1].pos - spring.atoms[0].pos
        var L = mag(spring.axis)
        spring.axis = spring.axis.norm()
        spring.pos = spring.atoms[0].pos+0.5*atom_radius*spring.axis
        var Ls = L-1*atom_radius
        spring.size.x = Ls
        var Fdt = spring.axis * (k*dt * (1-spacing/L))
        spring.atoms[0].momentum = spring.atoms[0].momentum + Fdt
        spring.atoms[1].momentum = spring.atoms[1].momentum - Fdt
    }
}
