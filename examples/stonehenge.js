GlowScript 1.0
/* Fly through Surreal Stonehenge */

// Bruce Sherwood

// A surreal scene that illustrates many of the features of GlowScript

// Display render time:
//$('<span id="fps"></span>').insertBefore('#glowscript')

scene.width = 800
scene.height = 400

var roam = false
// Toggle roaming option:
scene.bind("mousedown", function() {
    roam = true
})
scene.bind("mouseup", function() {
roam = false
})

function hourminute() {
    var now = new Date()
    var hour = now.getHours();
    var minute = now.getMinutes();
    return [hour, minute]
}

function analog_clock(args) {
    
    this.update = function () {
        var hour_and_minute = hourminute()
        var hour = hour_and_minute[0]
        var minute = hour_and_minute[1]
        if (hour >= 12) hour -= 12
        if (this.hour == hour && this.minute == minute) { return }
        this.hand.axis = 0.95*this.radius*scene.up.rotate({angle:-2*pi*minute/60, axis:this.axis})
        this.spheres[this.hour].size = this.radius/10*vec(1,1,1)
        this.spheres[hour].size = this.radius/5*vec(1,1,1)
        this.hour = hour
        this.minute = minute
    }
    
    this.pos = vec(0,0,0)
    this.axis = vec(0,0,1)
    this.radius = 1
    this.hour = 0
    this.minute = -1
    for (var attr in args) {
        if (args[attr] !== undefined) this[attr] = args[attr]
    }
    this.spheres = []
    this.hour = 0
    this.minute = -1
    for (var n=0; n<12; n++) {
        this.spheres.push(sphere( {pos:this.pos+this.radius*scene.up.rotate({angle:-2*pi*n/12, axis:this.axis}),
        size:0.1*this.radius*vec(1,1,1), color:color.hsv_to_rgb(vec(n/12,1,1)) } ))
    }
    this.hand = arrow( {pos:this.pos, axis_and_length:0.95*this.radius*scene.up,
                shaftwidth:this.radius/10, color:color.cyan} )
    this.update()
}

var ycenter = 2
$(canvas.container).css("font-size","90%")
scene.title.html("<b>Surreal Stonehenge</b>")
scene.center = vec(0,ycenter,0)
scene.range = 12
scene.userspin = false
scene.userzoom = false
var grey = color.gray(0.8)
var Nslabs = 8
var R = 10
var w = 5
var d = 0.5
var h = 5
var photocenter = 0.15*w

scene.visible = false

// The floor, central post, and ball atop the post
var floor = box( {pos:vec(0,-0.1,0), size:vec(0.2,24,24), axis:vec(0,1,0), 
    texture:textures.wood} )
var pole= cylinder( {pos:vec(0,0,0), axis:vec(0,1,0), size:vec(h,.4,.4), color:color.red} )
sphere( {pos:vec(0,h,0), color:vec(1,0,0)} )

// Set up the gray slabs, including a portal

for (var i=0; i<Nslabs; i++) {
    var theta = i*2*pi/Nslabs
    var c = cos(theta)
    var s = sin(theta)
    var xc = R*c
    var zc = R*s
    if (i == 2) {  // Make a portal
        box( {pos:vec(-3*w/8,0.75*h/2,R),
            size:vec(0.5*w/2,0.75*h,d), color:grey } )
        box( {pos:vec(3*w/8,0.75*h/2,R),
            size:vec(0.5*w/2,0.75*h,d), color:grey } )
        box( {pos:vec(0,0.85*h,R),
            size:vec(w,0.3*h,d), color:grey } )
    }
    else { 
        var slab = box( {pos:vec(R*c, h/2, R*s), axis:vec(c,0,s),
                   size:vec(d,h,w), color:grey } )
        if (i != 6) { 
            var T = textures.flower
            if (i == 7 || i == 4) T = textures.rug
            box( {pos:slab.pos,
                size:vec(1.1*d,0.9*4*photocenter,0.9*4*photocenter), axis:vec(c,0,s),
                    texture:T } )
        }
    }
}

// Decorate back slab with a gold box and a clock
box( {pos:vec(0,h/2,-R+d/2+0.1), size:vec(w/2,w/2,0.2), 
    color:vec(1,0.8,0), texture:textures.wood_old } )
var clock = new analog_clock( {pos:vec(0,h/2,-R+d/2+0.2+0.2*h/10),
                     radius:0.2*w, axis:vec(0,0,1) } )
                     
// Draw guy wires from the top of the central post
var Nwires = 32
for (i=0; i<Nwires; i++) {
    theta = i*2*pi/Nwires
    var L = vec(R*cos(theta),-h-0.1,R*sin(theta))
    cylinder( {pos:vec(0,h,0), axis:L, size:vec(mag(L),.02,.02), color:vec(1,0.7,0) } )
}

// Display a pyramid
pyramid( {pos:vec(-4,0,-5), size:vec(2,2,2), axis:vec(0,1,0), color:vec(0,.5,0), texture:textures.rough} )

// Display smoke rings rising out of a black tube
var smoke = []
var Nrings = 20
var x0 = -5, y0 = 1.5, z0 = -2
var r0 = 0.1
var spacing = 0.2
var thick = r0/2
var dr = 0.015
var dthick = thick/Nrings
var gray = 1
cylinder( {pos:vec(x0,0,z0), axis:vec(0,1,0), size:vec(y0+r0,3*r0,3*r0), color:color.black} )


// Create the smoke rings
for (i=0; i<Nrings; i++) {
    var D = 2*(r0+dr*i)
    var T = thick-dthick*i
    smoke.push(ring( {pos:vec(x0,y0+spacing*i,z0), axis:vec(0,1,0), size:vec(T,D,D),
                  color:color.gray(gray) } ))
}

var y = 0
var dy = spacing/20
var top_of_rings = Nrings-1

// Roll a log back and forth
var rlog = 1
var wide = 4
var zpos = 2
var zface = 5
var tlogend = 0.2
var v0 = 0.3
var v = v0
var omega = -v0/rlog
var theta = 0
var dt = 0.1
var tstop = 0.3

// Log rolls back and forth between two stops
var logcyl = cylinder( {pos:vec(-wide,rlog,zpos), size:vec(zface-zpos,2,2), axis:vec(0,0,1),
         texture:textures.granite } )

var leftstop = box( {pos:vec(-wide-rlog-tstop/2,0.6*rlog,(zpos+zface)/2),
    size:vec(tstop, 1.2*rlog, (zface-zpos)), color:color.red, emissive:1 } )
var rightstop = box( {pos:vec(wide+rlog+tstop/2,0.6*rlog,(zpos+zface)/2),
    size:vec(tstop, 1.2*rlog, (zface-zpos)), color:color.red, emissive:1 } )

// Run a ball up and down the pole
var y1 = 0.2*h
var y2 = 0.7*h
var rball = 0.4
var Dband = 1.3*pole.size.y
cylinder( {pos:vec(0,y1-0.9*rball,0), axis:vec(0,1,0), size:vec(0.1,Dband,Dband), color:color.green} )
cylinder( {pos:vec(0,y2+0.9*rball,0), axis:vec(0,1,0), size:vec(0.1,Dband,Dband), color:color.green} )
var vball0 = 0.3*v0
var vball = vball0
var ballangle = 0.05*pi
var poleball = sphere( {pos:vec(0,y1,0), size:2*rball*vec(1,1,1), color:color.blue} )
var polecones = []
for (var nn=0; nn<4; nn++) {
    var cc = cone( {pos:vec(0.8*rball,y1,0), size:rball*vec(3,1,1), color:color.yellow} )
    cc.rotate( {angle:0.5*nn*pi, axis:vec(0,1,0), origin:vec(0,y1,0)} )
    polecones.push(cc)
}
var rbaseball = 0.3
var vbaseball0 = 3*v0

// A table with a mass-spring object sliding on it
var table = cone({pos:vec(0.4*R,h/4,-.3*R), size:vec(h/4,0.6*R,0.6*R),
        axis:vec(0,-1,0), texture:{file:textures.wood_old, turn:1}})
var tabletop = table.pos
var rspring = 0.02*h
var Lspring = .15*R
var Lspring0 = .1*R
var hmass = 4*rspring
var post = cylinder({pos:tabletop, axis:vec(0,1,0), size:vec(2*hmass,.4,.4), color:color.gray(.6)})
var spring = helix({pos:post.pos+vec(0,hmass/2,0), size:vec(Lspring,2*rspring,2*rspring),
        color:color.orange, thickness:rspring})
var mass = cylinder({pos:post.pos+vec(Lspring,0,0), axis:vec(0,1,0), size:vec(hmass,.04*R,.04*R),
        color:color.orange})
mass.p = vec(10,0,5)
mass.m = 1
var kspring = 200
var deltat = .01

// Display an ellipsoid
var Rcloud = 0.8*R
var omegacloud = 3*v0/Rcloud
var cloud = sphere( {pos:vec(0,0.7*h,-Rcloud), size:vec(5,2,2),
                  color:color.green, opacity:0.3 } )
                  
var rhairs = 0.025
var dhairs = 2
var maxcosine = dhairs/sqrt(pow(rhairs,2)+pow(dhairs,2)) // if ray angle < maxcosine, don't move
var haircolor = color.black
// Add instructions below the display

scene.waitfor("textures",wait)
scene.visible = true

var s1 = "<b>Fly through the scene:</b> With the mouse button down,<br><br>"
var s2 = "    move the mouse above or below the center of the scene to move forward or backward;<br><br>"
var s3 = "    move the mouse right or left to turn your direction of motion.<br><br>"
var s4 = "(Normal GlowScript rotate and zoom are turned off in this program.)"

scene.caption.html(s1+s2+s3+s4)

while (true) { 
    if (roam) {
        var ray = scene.mouse.ray
        if (abs(ray.dot(scene.forward)) < maxcosine) {  // do something only if significant change of direction
            var newray = norm(vec(ray.x, 0, ray.z))
            var angle = asin(scene.forward.cross(newray).dot(scene.up))
            var newforward = scene.forward.rotate({angle:angle/30, axis:scene.up})
            var dist = mag(scene.center-scene.camera.pos)
            scene.center = scene.camera.pos+newforward*dist
            scene.forward = newforward
            scene.center = scene.center+scene.forward*ray.y/4
        }
    }
    
    // Roll the log
    theta = theta + omega*dt
    logcyl.pos.x = logcyl.pos.x+v*dt
    logcyl.rotate( {angle:omega*dt, axis:vec(0,0,1)} )
    if (logcyl.pos.x >= wide) { 
        v = -v0
        omega = -v/rlog
        if (rightstop.color.equals(color.red)) { 
            rightstop.color = color.cyan
        }
        else { 
            rightstop.color = color.red
        }
    }
    if (logcyl.pos.x <= -wide) { 
        v = +v0
        omega = -v/rlog
        if (leftstop.color.equals(color.red)) { 
            leftstop.color = color.cyan
        }
        else { 
            leftstop.color = color.red
        }
    }

    // Move the cloud
    cloud.rotate( {angle:omegacloud*dt, axis:vec(0,1,0), origin:vec(0,0,0)} )

    // Run the ball up and down
    poleball.pos.y = poleball.pos.y+vball*dt
    for (var i=0; i<4; i++) {
        polecones[i].pos.y = poleball.pos.y
        polecones[i].rotate( {angle:ballangle, axis:vec(0,1,0), origin:vec(0,0,0)} )
    }
    if (poleball.pos.y >= y2) { 
        vball = -vball0
        ballangle = -ballangle
    }
    if (poleball.pos.y <= y1) { 
        vball = +vball0
        ballangle = -ballangle
    }
  
    // Move the smoke rings
    for (i=0; i<Nrings; i++) {
        // Raise the smoke rings
        smoke[i].pos = smoke[i].pos+vec(0,dy,0)
        smoke[i].size.y = smoke[i].size.z =smoke[i].size.y+(dr/spacing)*dy
        smoke[i].size.x = smoke[i].size.x-(dthick/spacing)*dy
    }
    y = y+dy
    if (y >= spacing) { 
        // Move top ring to the bottom
        y = 0
        smoke[top_of_rings].pos = vec(x0, y0, z0)
        smoke[top_of_rings].size = vec(thick,2*r0,2*r0)
        top_of_rings--
    }
    if (top_of_rings < 0) { 
        top_of_rings = Nrings-1
    }
    
    // Update the mass-spring motion
    var F = -kspring*(spring.size.x-Lspring0)*spring.axis.norm()
    mass.p = mass.p + F*deltat
    mass.pos = mass.pos + (mass.p/mass.m)*deltat
    spring.axis = mass.pos+vec(0,hmass/2,0)-spring.pos
    spring.size.x = mag(spring.axis)

    // Update the analog clock on the back slab
    clock.update()
    
    rate(30,wait)

}