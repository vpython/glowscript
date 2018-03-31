from vpython import *
#GlowScript 2.7 VPython

s = '''Public lecture demo programs written in VPython by Ruth Chabay and Bruce Sherwood,<br>
designed to complement the textbook and curriculum <a href="http://matterandinteractions.org" target=_blank>Matter &amp Interactions</a>.<br>
The number indicates the associated textbook chapter for the 4th edition.<br><br>
Right button drag or Ctrl-drag to rotate "camera" to view scene.<br>
Middle button or Alt/Option-drag to drag up or down or scroll wheel to zoom in or out.<br>
&nbsp&nbsp&nbspOn a two-button mouse, middle is left + right.<br>
Touch screen: pinch/extend to zoom, swipe or two-finger rotate.<br>
&nbsp&nbsp&nbspTo drag something, press and hold, then drag.<br><br>'''

iphone = navigator.userAgent.match(/iPhone|iPad|iPod/i)

if iphone:
    s += "iPhone and iPad devices currently prevent seeing the complete list of programs here,<br>"
    s += "but the <a href='http://matterandinteractions.org/glowscript/MIdemos.html' target=_blank'><b>full list</b></a> is available.<br><br>"

def link(url, d):
    global s
    s += "<a href='http://www.glowscript.org/#/user/matterandinteractions/folder/matterandinteractions/program/" + url + "' target='_blank'>" + url + "</a>"
    s += " " + d + "<br><br>"

link('00-Instructions', "Instructions on how to use these programs")
link('01-3Dvector', "Display a vector in 3D")
link('01-space-station', "Motion in the noninertial frame of a rotating space station")
link('02-Newton', "Drag an object with a single force illustrating the Momentum Principle (Newton's 2nd law)")
link('02-Newton-grid', "Similar to 02-Newton, but the camera follows the object")
link('02-world-line', "Plot motion in 3D (x, y, and t) with 2D projections")
link('03-3body-3D', "3D motion of three stars")
link('03-particle-collision', "Collision of two charged particles")
link('03-double-pendula', "Two double pendula; complex motion and sensitivity to initial conditions")
link('04-ball-and-spring-model', "Ball and spring model of a solid")
link('04-speed-of-sound', "Model the propagation of sound in aluminum and lead")
link('06-potential-energy-well', "Design a potential energy well and observe motion in the well")
link('08-absorb-emit', "Atoms absorb energy from electron beam, emit photons")
link('08-spectrum', "How a diffraction grating displays emission spectra and dark-line absorption spectra")
link('08-quantum-oscillator', "Quantum harmonic oscillator, with classical oscillator display for context")
link('08-Franck-Hertz', "Franck-Hertz experiment: electrons impact mercury atoms")
link('08-Bohr-levels', "Bohr model of the hydrogen atom")
link('09-Krel', "Kinetic energy relative to center of mass of a moving object")
link('09-rotate-vibrate-translate', "A translating, rotating, vibrating object")
link('09-two-pucks', "Rotating and nonrotating pucks")
link('10-reference-frames', "Motion seen from different reference frames")
link('11-cross-product', "3D view of the cross product")
link('11-cross-product-area', "3D view of the cross product, with a parallelogram whose area is the magnitude")
link('11-ferris-wheel', "Angular momentum of a rider on a Ferris wheel")
link('11-wheel-L', "Rotational angular momentum of a wheel")
link('11-barbell-angular-momentum', "Angular momentum of a barbell whose center of mass moves")
link('11-angular-momentum-binary-star', "Angular momenta of two stars orbiting each other")
link('11-drop-clay', "Drop a lump of clay onto a low-friction wheel")
link('11-hanging-gyroscope', "A gyroscope hanging from a spring")
link('11-gyroscope', "A gyroscope on a pedestal precessing and nutating")
link('12-wells-oscillator', "A unit cell of the Einstein model of a solid")
link('S1-hard-sphere-gas', "A hard-sphere gas, with graph of the distribution of speeds")
link('S1-piston', "Adiabatic (Q=0) compression and expansion")
link('S1-Carnot-cycle', "The Carnot cycle")

s += '<br>'

link('13-fields', "A general utility that can display electric and magnetic fields; visualize potential difference, Gauss's law, and Ampere's law")
link('13-Efield-point', "Electric field of a point charge in 3D")
link('13-E-point-charge-drag', "Electric field throughout space around a charge; can drag the source charge")
link('14-mobile-electrons', "Electrons moving through a positively charged lattice")
link('15-E-ring-demo-dE', "Add up electric field of pieces of a ring to make electric field of a ring")
link('15-E-disk-add-rings', "Add up electric field of rings to make field of a disk")
link('15-E-sphere-outside-rings', "Add up electric field of rings to make the field outside a sphere")
link('15-E-sphere-inside-rings', "Add up electric field of rings to make the field inside a sphere")
link('15-Edisk', "Electric field near a uniformly charged disk")
link('17-mobile-electron-current', "Electron current: mobile electrons driven by an electric field")
link('17-cross-product', "3D view of the cross product")
link('17-cross-product-area', "3D view of the cross product, with a parallelogram whose area is the magnitude")
link('17-Bwire-with-r', "Magnetic field of a wire")
link('17-B-loop-with-r-dB', "Magnetic field of a ring, one step at a time")
link('17-B-loop-xy-xz', "Display magnetic field of a ring, in two planes")
link('17-toroid', "Magnetic field of a toroid")
link('18-Erings', "Electric field near a line of rings with linearly varying charge")
link('18-SurfaceCharge', "Distributions of surface charge and electric field, electrostatics and circuits")
link('19-RCcircuit', "Graphs of charge and current in an RC circuit, calculated iteratively")
link('20-interacting-current-loops', "Magnetic forces do no (net) work")
link('20-spark-mean-free-path', "Mean free path in a gas; relevant for Ch. 20 discussion of sparks")
link('21-Gauss', "A qualitative introduction to Gauss's law")
link('22-Faraday-coil', "Curly electric field associated with the changing magnetic field of a coil")
link('22-Faraday-magnet', "Curly electric field associated with the changing magnetic field of a moving magnet")

link('23-fieldlines', "Field lines of a point charge")
link('23-radiate2D-fieldline-kink', "The kink in the field lines of an accelerated charge")
link('23-pulse-plane-wave', "A pulse train of electromagnetic radiation")
link('23-radiate2D', "A 2D slice of lectromagnetic radiation spreading out from an accelerated charge, by Joe Heafner")
link('23-radiation-3D', "Radiative E and B spreading out in 3D from accelerated charge, by Joe Heafner")
link('23-sinusoidal-plane-wave', "A plane wave of sinusoidal radiation")
link('23-sinusoidal-wave-wavelength', "The meaning of wavelength")
link('23-antenna', "Radiation from an antenna")
link('23-wavefront', "Rays and wavefronts at the boundary between two materials with differing index of refraction")
link('23-lens', "Interactive ray tracing through a converging or diverging lens")
link('S3-interference-constructive', "Constructive interference of two sources of electromagnetic radiation")
link('S3-interference-destructive', "Denstructive interference of two sources of electromagnetic radiation")
link('S3-interference-both', "Constructive and destructive interference of two sources")
link('S3-crystal-planes', "Planes in crystals relevant for x-ray diffraction")
link('S3-powder-xrays', "Powder x-ray diffraction")
link('S3-standing-wave', "A standing wave produced by interference of leftward-going and rightward-going waves")

$('body').append(s)