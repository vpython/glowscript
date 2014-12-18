GlowScript 1.0
/* Double pendulum */

//The analysis is in terms of Lagrangian mechanics.
//The Lagrangian variables are angle of upper bar, angle of lower bar,
//measured from the vertical.

//Bruce Sherwood

scene.width = scene.height = 600
scene.range = 1.8

function display_instructions() {
    var s1 = "In GlowScript programs:\n\n"
    var s2 = "    Rotate the camera by dragging with the right mouse button,\n        or hold down the Ctrl key and drag.\n\n"
    var s3 = "    To zoom, drag with the left+right mouse buttons,\n         or hold down the Alt key and drag,\n         or use the mouse wheel."
    scene.caption.text(s1+s2+s3)
}

// Display text below the 3D graphics:
scene.title.text("A double pendulum")
display_instructions()


var g = 9.8
var M1 = 2.0
var M2 = 1.0
var d = 0.05 // thickness of each bar
var gap = 2*d // distance between two parts of upper, U-shaped assembly
var L1 = 0.5 // physical length of upper assembly; distance between axles
var L1display = L1+d // show upper assembly a bit longer than physical, to overlap axle
var L2 = 1 // physical length of lower bar
var L2display = L2+d/2 // show lower bar a bit longer than physical, to overlap axle
// Coefficients used in Lagrangian calculation
var A = (1/4)*M1*Math.pow(L1,2)+(1/12)*M1*Math.pow(L1,2)+M2*Math.pow(L1,2)
var B = (1/2)*M2*L1*L2
var C = g*L1*(M1/2+M2)
var D = M2*L1*L2/2
var E = (1/12)*M2*Math.pow(L2,2)+(1/4)*M2*Math.pow(L2,2)
var F = g*L2*M2/2

var hpedestal = 1.3*(L1+L2) // height of pedestal
var wpedestal = 0.1 // width of pedestal
var tbase = 0.05 // thickness of base
var wbase = 8*gap // width of base
var offset = 2*gap // from center of pedestal to center of U-shaped upper assembly
var pedestal_top = vec(0,hpedestal/2,0) // top of inner bar of U-shaped upper assembly

var theta1 = 1.3*pi/2 // initial upper angle (from vertical)
var theta1dot = 0 // initial rate of change of theta1
var theta2 = 0 // initial lower angle (from vertical)
var theta2dot = 0 // initial rate of change of theta2

var pedestal = box( {pos:pedestal_top-vec(0,hpedestal/2,offset),
                size:vec(wpedestal,1.1*hpedestal,wpedestal),
                color:vec(0.4,0.4,0.5)} )
var base = box( {pos:pedestal_top-vec(0,hpedestal+tbase/2,offset),
                 size:vec(wbase,tbase,wbase),
                 color:pedestal.color} )
var axle1 = cylinder( {pos:pedestal_top-vec(0,0,gap/2-d/4), axis:vec(0,0,-1),
        		  size:vec(offset,d/4,d/4), color:color.yellow} )

var bar1 = box( {pos:pedestal_top+vec(L1display/2-d/2,0,-(gap+d)/2), 
			 size:vec(L1display,d,d), color:color.red} )
bar1.rotate( {angle:-pi/2, axis:vec(0,0,1), origin:vec(axle1.pos.x, axle1.pos.y, bar1.pos.z)} )
bar1.rotate( {angle:theta1, axis:vec(0,0,1), origin:vec(axle1.pos.x, axle1.pos.y, bar1.pos.z)} )

var bar1b = box( {pos:pedestal_top+vec(L1display/2-d/2,0,(gap+d)/2), 
			  size:vec(L1display,d,d), color:bar1.color} )
bar1b.rotate( {angle:-pi/2, axis:vec(0,0,1), origin:vec(axle1.pos.x, axle1.pos.y, bar1b.pos.z)} )
bar1b.rotate( {angle:theta1, axis:vec(0,0,1), origin:vec(axle1.pos.x, axle1.pos.y, bar1b.pos.z)} )

var pivot1 = vec(axle1.pos.x, axle1.pos.y, 0)

var axle2 = cylinder( {pos:pedestal_top+vec(L1,0,-(gap+d)/2), axis:vec(0,0,1), 
                size:vec(gap+d,axle1.size.y/2,axle1.size.y/2), color:axle1.color} )
axle2.rotate( {angle:-pi/2, axis:vec(0,0,1), origin:vec(axle1.pos.x, axle1.pos.y, axle2.pos.z)} )
axle2.rotate( {angle:theta1, axis:vec(0,0,1), origin:vec(axle1.pos.x, axle1.pos.y, axle2.pos.z)} )

var bar2 = box( {pos:axle2.pos+vec(L2display/2-d/2,0,(gap+d)/2), 
		size:vec(L2display,d,d), color:color.green} )

bar2.rotate( {angle:-pi/2,  axis:vec(0,0,1), origin:vec(axle2.pos.x, axle2.pos.y, bar2.pos.z)} )
bar2.rotate( {angle:theta2,  axis:vec(0,0,1), origin:vec(axle2.pos.x, axle2.pos.y, bar2.pos.z)} )

var dt = 0.01
var t = 0

while (true) {
    rate(1/dt,wait) 
    // Calculate accelerations of the Lagrangian coordinates:
    var atheta1 = ((E*C/B)*sin(theta1)-F*sin(theta2))/(D-E*A/B)
    var atheta2 = -(A*atheta1+C*sin(theta1))/B
    // Update velocities of the Lagrangian coordinates:
    theta1dot = theta1dot+atheta1*dt
    theta2dot = theta2dot+atheta2*dt
    // Update Lagrangian coordinates:
    var dtheta1 = theta1dot*dt
    var dtheta2 = theta2dot*dt
    theta1 = theta1+dtheta1
    theta2 = theta2+dtheta2
	
    bar1.rotate( {angle:dtheta1, axis:vec(0,0,1), origin:pivot1} )
    bar1b.rotate( {angle:dtheta1, axis:vec(0,0,1), origin:pivot1} )
    var pivot2 = vec(axle2.pos.x, axle2.pos.y, pivot1.z)
    axle2.rotate( {angle:dtheta1, axis:vec(0,0,1), origin:pivot1} )
    bar2.rotate( {angle:dtheta2, axis:vec(0,0,1), origin:pivot2} )
    pivot2 = vec(axle2.pos.x, axle2.pos.y, pivot1.z)
    bar2.pos = pivot2 + bar2.axis/2
	
    t = t+dt
}
