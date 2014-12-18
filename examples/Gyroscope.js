GlowScript 1.0
// Converted from the VPython program gyro2

// Gyroscope sitting on a pedestal

// The analysis is in terms of Lagrangian mechanics.
// The Lagrangian variables are polar angle theta,
// azimuthal angle phi, and spin angle alpha.

// Bruce Sherwood

scene.width = 800
scene.height = 600
scene.visible = false
scene.title.text("A precessing, nutating gyroscope")

var Lshaft = 1 // length of gyroscope shaft
var r = Lshaft/2 // distance from support point to center of mass
var Rshaft = 0.03 // radius of gyroscope shaft
var M = 1 // mass of gyroscope (massless shaft)
var Rrotor = 0.4 // radius of gyroscope rotor
var Drotor = 0.1 // thickness of gyroscope rotor
var I = 0.5*M*pow(Rrotor,2) // moment of inertia of gyroscope
var hpedestal = Lshaft // height of pedestal
var wpedestal = 0.1 // width of pedestal
var tbase = 0.05 // thickness of base
var wbase = 3*wpedestal // width of base
var g = 9.8
var Fgrav = vec(0,-M*g,0)
var pedestal_top = vec(0,0,0) // top of pedestal

var theta = pi/3 // initial polar angle of shaft (from vertical)
var thetadot = 0 // initial rate of change of polar angle
var alpha = 0 // initial spin angle
var alphadot = 15 // initial rate of change of spin angle (spin ang. velocity)
var phi = -pi/2 // initial azimuthal angle
var phidot = 0 // initial rate of change of azimuthal angle
// Comment in the following statements to get pure precession
//if abs(cos(theta)) < 1e-8:
//    phidot = M*g*r/(I*alphadot)
//else:
//    phidot = (-alphadot+sqrt(alphadot**2+2*M*g*r*cos(theta)/I))/cos(theta)

var pedestal = box( {pos:pedestal_top-vec(0,hpedestal/2,0),
                 size:vec(wpedestal,hpedestal,wpedestal),
                 color:vec(0.4,0.4,0.5) } )
var base = box( {pos:pedestal_top-vec(0,hpedestal+tbase/2,0),
                 size:vec(wbase,tbase,wbase),
                 color:pedestal.color } )

var shaft = cylinder( {axis:vec(1,0,0), size:vec(Lshaft,2*Rshaft,2*Rshaft), color:vec(0,1,0)} )
var rotor = cylinder( {pos:vec(Lshaft/2 - Drotor/2, 0, 0), axis:vec(1,0,0),
                 size:vec(Drotor,2*Rrotor,2*Rrotor), color:vec(1,0,0), texture:textures.rough} )

scene.caption.text("Loading textures...")
scene.waitfor("textures",wait)
scene.caption.text("")

function display_instructions() {
    var s1 = "In GlowScript programs:\n\n"
    var s2 = "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n\n"
    var s3 = "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt key and drag,\n         or use the mouse wheel."
    scene.caption.text(s1+s2+s3)
}

// Display text below the 3D graphics:
display_instructions()

var dt = 3e-5
var t = 0
var Nsteps = 200 // number of calculational steps between graphics updates

while (true) { 
    scene.waitfor("redraw",wait)
    for (var step=0; step<Nsteps; step++) { // multiple calculation steps for accuracy
        // Calculate accelerations of the Lagrangian coordinates:
        var atheta = (pow(phidot,2)*sin(theta)*cos(theta)-
                  2*(alphadot+phidot*cos(theta))*phidot*sin(theta)+
                  2*M*g*r*sin(theta)/I)
        var aphi = 2*thetadot*(alphadot-phidot*cos(theta))/sin(theta)
        var aalpha = phidot*thetadot*sin(theta)-aphi*cos(theta)
        // Update velocities of the Lagrangian coordinates:
        thetadot = thetadot+atheta*dt
        phidot = phidot+aphi*dt
        alphadot = alphadot+aalpha*dt
        // Update Lagrangian coordinates:
        theta = theta+thetadot*dt
        phi = phi+phidot*dt
        alpha = alpha+alphadot*dt

    }
    var newaxis = vec(sin(theta)*sin(phi),cos(theta),sin(theta)*cos(phi))
    // Display approximate rotation of rotor and shaft:
    rotor.axis = shaft.axis = newaxis
    rotor.pos = shaft.pos + shaft.axis*Lshaft/2
    rotor.rotate( {angle:alphadot*dt*Nsteps, axis:rotor.axis, origin:rotor.pos} )

    if (t === 0) {
        scene.visible = true
        attach_trail(function() {return (shaft.pos + shaft.axis*Lshaft)}, 
            {radius:Rshaft/8, color:color.yellow, retain:50})
    }
    t = t+dt*Nsteps
}
