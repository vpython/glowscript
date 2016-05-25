# The following code is for testing in Classic VPython.
# This file needs to be converted to JavaSCript for use with extrusion.
#from __future__ import division, print_function
#from visual import vector, curve, mag, norm, cross, display, degrees, dot
#from math import sin, cos, tan, acos, atan, sqrt, pi
#vec = vector
#scene = display()

# The path and shape objects were designed and implemented by Kadir Haldenbilen
# for Classic VPython 6. Modified by Bruce Sherwood for GlowScript/Jupyter VPython,
# eliminating dependency on Polygon library.

# GlowScript API:
# shape = [2Ds], hole = [2Ds] or shape = [ [shape 2Ds], [hole 2Ds] ]
# Another option for hole is [ [hole1], [hole2], ..... ]
#  If hole represents multiple holes, len[hole[0]] > 1

##################################
## ----------- shapes ------------
##################################

class shape_object(object):

    def roundc(self, cp, roundness=0.1, nseg=8, invert=False):
        vort = 0
        cp.pop()
        for i in range(len(cp)):
            i1 = (i+1)%len(cp)
            i2 = (i+2)%len(cp)
            v1 = vec(cp[i1]) - vec(cp[i])
            v2 = vec(cp[(i2)%len(cp)]) - vec(cp[i1])
            dv = dot(v1,v2)
            vort += dv

        if vort > 0: cp.reverse()

        L = 999999
        
        for i in range(len(cp)):
            p1 = vec(cp[i])
            p2 = vec(cp[(i+1)%len(cp)])
            lm = mag(p2-p1)
            if lm < L: L = lm

        r = L*roundness
        ncp = []
        lcp = len(cp)

        for i in range(lcp):
            i1 = (i+1)%lcp
            i2 = (i+2)%lcp
            
            w0 = vec(cp[i])
            w1 = vec(cp[i1])
            w2 = vec(cp[i2])

            wrt = cross((w1-w0),(w2-w0))

            v1 = w1-w0
            v2 = w1-w2
            rax = norm(((norm(v1)+norm(v2))/2))
            angle = acos(dot(norm(v2),norm(v1)))
            afl = 1
            if wrt[2] > 0: afl = -1
            angle2 = angle/2
            cc = r/sin(angle2)
            ccp = vec(cp[i1]) - rax*cc
            tt = r/tan(angle2)
            t1 = vec(cp[i1]) -norm(v1)*tt
            t2 = vec(cp[i1]) -norm(v2)*tt

            ncp.append(tuple(t1)[0:2])
            nc = []
            a = 0
            dseg = afl*(pi-angle)/nseg
            if not invert:
                for i in range(nseg):
                    nc.append(self.rotatep(t1, ccp, a))
                    ncp.append(tuple(nc[-1])[0:2])
                    a -= dseg
            else:
                dseg = afl*(angle)/nseg
                for i in range(nseg):
                    nc.append(self.rotatep(t1, (cp[i1][0],cp[i1][1],0), a))
                    ncp.append(tuple(nc[-1])[0:2])
                    a += dseg
            ncp.append(tuple(t2)[0:2])
        ncp.append(ncp[0])
        return ncp
    
    def rotatep(self, p, pr, angle):
        #Rotate a single point p angle radians around pr
        sinr = sin(angle)
        cosr = cos(angle)
        x = p[0]
        y = p[1]
        xRel = pr[0]
        yRel = pr[1]
        newx = x * cosr - y * sinr - xRel * cosr + yRel * sinr + xRel
        newy = x * sinr + y * cosr - xRel * sinr - yRel * cosr + yRel
        pr = [newx, newy]
        return pr

    def rotatecp(self, cp, pr, angle):
        #Rotate point-set cp angle radians around pr
        sinr = sin(float(angle))
        cosr = cos(float(angle))
        cpr = []
        for p in cp:
            x, y = p
            xRel, yRel = pr[0], pr[1]
            newx = x * cosr - y * sinr - xRel * cosr + yRel * sinr + xRel
            newy = x * sinr + y * cosr - xRel * sinr - yRel * cosr + yRel
            cpr.append([newx, newy])
        return cpr

    def scale(self, cp, xscale, yscale):
            cpr = []
            for p in cp:
                cpr.append([xscale*p[0], yscale*p[1]])
            return cpr

    def addpos(self, pos, cp):
        for p in cp:
            p[0] += pos[0]
            p[1] += pos[1]
        return cp

    def rframe(self, pos=[0,0], width=1, height=None, thickness=None, rotate=0,
               roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        # for rectangle
        if height == None: height = width
        if thickness == None: thickness = min(height,width)*0.2
        else: thickness = min(height,width)*thickness*2
        outer = self.rectangle(pos=pos, width=width, height=height)
        inner = self.rectangle(pos=pos, width=(width-thickness), height=height-thickness)
        if roundness > 0:
            outer = self.roundc(outer, roundness=roundness, invert=invert)
            inner = self.roundc(inner, roundness=roundness, invert=invert)
        if xscale != 1 or yscale != 1:
            outer = self.scale(outer,xscale,yscale)
            inner = self.scale(inner,xscale,yscale)
        if rotate != 0:
            outer = self.rotatecp(outer, pos, rotate)
            inner = self.rotatecp(inner, pos, rotate)
        return [outer, inner]

    def rectangle(self, pos=[0,0], width=1, height=None, rotate=0, thickness=0,
                  roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        if height is None: height = width
        if thickness == 0:
            cp = []
            w2 = width/2
            h2 = height/2
            cp = [[w2,-h2], [w2,h2], [-w2,h2], [-w2,-h2], [w2,-h2]]
            cp = self.addpos(pos, cp)
            if roundness > 0:
                cp = self.roundc(cp, roundness=roundness, invert=invert)
            if scale != 1: xscale = yscale = scale
            if xscale != 1 or yscale != 1: cp = self.scale(cp,xscale,yscale)
            if rotate != 0: cp = self.rotatecp(cp, pos, rotate)
        else:
            cp = self.rframe(pos=pos, width=width, height=height, thickness=thickness, rotate=rotate,
                             roundness=roundness, invert=invert, scale=scale, xscale=xscale, yscale=yscale)
        return cp

    def cross(self, pos=[0,0], width=1, thickness=0.2, rotate=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        wtp = (width+thickness)/2
        w2 = width/2
        t2 = thickness/2
        cp = [[w2,-t2], [w2,t2], [t2,t2], [t2,w2], [-t2,w2], [-t2,t2],
              [-w2,t2], [-w2,-t2], [-t2,-t2], [-t2,-w2], [t2,-w2], [t2,-t2], [w2,-t2]]
        cp = self.addpos(pos, cp)
        if roundness > 0:
                cp = self.roundc(cp, roundness=roundness, invert=invert)
        if xscale != 1 or yscale != 1: cp = self.scale(cp,xscale,yscale)
        if rotate != 0: cp = self.rotatecp(cp, pos, rotate)
        return cp

    def trframe(self, pos=[0,0], width=2, height=1, top=None, thickness=None,
                rotate=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        # for trapezoid
        if top is None: top = width/2
        if thickness == None: thickness = min(height,top)*0.2
        else: thickness = min(height,top)*thickness*2
        outer = self.trapezoid(pos=pos, width=width, height=height, top=top)
        angle = atan((width-top)/2/height)
        db = (thickness)/cos(angle)
        inner = self.trapezoid(pos=pos, width=(width-db-thickness*tan(angle)),
                               height=height-thickness, top=top-(db-thickness*tan(angle)))
        outer = self.addpos(pos,outer)
        inner = self.addpos(pos,inner)
        if roundness > 0:
            outer = self.roundc(outer, roundness=roundness, invert=invert)
            inner = self.roundc(inner, roundness=roundness, invert=invert)
        if xscale != 1 or yscale != 1:
            outer = self.scale(outer,xscale,yscale)
            inner = self.scale(inner,xscale,yscale)
        if rotate != 0:
            outer = self.rotatecp(outer, pos, rotate)
            inner = self.rotatecp(inner, pos, rotate)
        return [outer, inner]

    def trapezoid(self, pos=[0,0], width=2, height=1, top=None, rotate=0,
                  thickness=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        w2 = width/2
        h2 = height/2
        if top is None: top = w2
        t2 = top/2
        if top == None: top = w2
        if thickness == 0:
            cp = [[w2,-h2], [t2,h2], [-t2,h2], [-w2,-h2], [w2,-h2]]
            cp = self.addpos(pos, cp)
            if rotate != 0: cp = self.rotatecp(cp, pos, rotate)
            if scale != 1: xscale = yscale = scale
            if xscale != 1 or yscale != 1: cp = self.scale(cp,xscale,yscale)
            if roundness > 0:
                    cp = roundc(pp.contour(0), roundness=roundness, invert=invert)
        else:
            cp = self.trframe(pos=pos, width=width, height=height, thickness=thickness,
                        rotate=rotate, roundness=roundness, invert=invert,
                        top=top, scale=scale, xscale=xscale, yscale=yscale)
        return cp
    
    def ring(self, pos=[0,0], radius=1, iradius=None, np=32, scale=1, xscale=1, yscale=1, rotate=0):
        if iradius == None: iradius = radius*0.8
        outer = self.circle(pos=pos, radius=radius, np=np, scale=1, xscale=1, yscale=1)
        inner = self.circle(pos=pos, radius=iradius, np=np, scale=1, xscale=1, yscale=1)
        if xscale != 1 or yscale != 1:
            outer = self.scale(outer,xscale,yscale)
            inner = self.scale(inner,xscale,yscale)
        if rotate != 0:
            outer = self.rotatecp(outer, pos, rotate)
            inner = self.rotatecp(inner, pos, rotate)
        return [outer, inner]

    def circle(self, pos=[0,0], radius=0.5, np=32, scale=1, xscale=1, yscale=1,
               thickness=0, angle1=0, angle2=2*pi, rotate=0):
        cp = []
        if thickness > 0 and angle1 == 0 and angle2 == 2*pi:
            cp = self.ring(pos=pos, radius=radius, iradius=radius-thickness, np=np, scale=scale,
                               xscale=xscale, yscale=yscale)
        else:
            if angle1 != 0 or angle2 != 2*pi:
                cp.append([pos.x,pos.y])
            seg = 2*pi/np
            nseg = int(abs((angle2-angle1)/seg+.5))
            seg = (angle2-angle1)/nseg
            if angle1 != 0 or angle2 != 2*pi: nseg += 1
            c = radius*cos(angle1)
            s = radius*sin(angle1)
            dc = cos(seg)
            ds = sin(seg)
            x0 = pos[0]
            y0 = pos[1]
            cp.append([x0+c,y0+s])
            for i in range(nseg-1):
                c2 = c*dc - s*ds
                s2 = s*dc + c*ds
                cp.append([x0+c2,y0+s2])
                c = c2
                s = s2
            if angle1 != 0 or angle2 != 2*pi: cp.append(cp[0])
            cp.append(cp[0])
            if scale != 1: xscale = yscale = scale
            if xscale != 1 or yscale != 1: cp = self.scale(cp,xscale,yscale)
            if rotate != 0 and angle1 != 0 or angle2 != 2*pi:
                cp = self.rotatecp(cp, pos, rotate)
        return cp

    def line(self, pos=[0,0], np=2, rotate=0, scale=1, xscale=1, yscale=1,
             thickness=None, start=vec(0,0,0), end=vec(0,1,0)):
        v = vec((end[0]-start[0]), (end[1]-start[1]))
        if thickness is None:
            thickness = 0.01*mag(v)
        dv = thickness*norm(cross(vec(0,0,1),v))
        dx = dv.x
        dy = dv.y
        cp = [] # outer line
        cpi = [] # inner line
        vline = (vec(end)-vec(start)).norm()
        mline = mag(vec(end)-vec(start))
        for i in range(np):
            x = start[0] + (vline*i)[0]/float(np-1)*mline
            y = start[1] + (vline*i)[1]/float(np-1)*mline
            cp.append( (x+pos[0],y+pos[1]) )
            cpi.append( (x+pos[0]+dx,y+pos[1]+dy) )
        if not path:
                cpi.reverse()
                for p in cpi:
                    cp.append(p)
                cp.append(cp[0])
        if scale != 1: xscale = yscale = scale
        if xscale != 1 or yscale != 1: self.scale(cp,xscale,yscale)
        if rotate != 0: cp = self.rotatecp(cp, pos, rotate)
        return cp

    def arc(self, pos=[0,0], radius=0.5, np=32, rotate=0, scale=1, xscale=1, yscale=1,
            thickness=None, angle1=0, angle2=pi, path=False):
        if thickness is None:
            thickness = 0.01*radius
        cp = []  # outer arc
        cpi = [] # inner arc
        seg = 2*pi/np
        nseg = int(abs((angle2-angle1))/seg)+1
        seg = (angle2-angle1)/nseg
        for i in range(nseg+1):
            x = cos(angle1+i*seg)
            y = sin(angle1+i*seg)
            cp.append( (radius*x+pos[0],radius*y+pos[1]) )
            cpi.append( ((radius-thickness)*x+pos[0],(radius-thickness)*y+pos[1]) )
        if not path:
            cpi.reverse()
            for p in cpi:
                cp.append(p)
            cp.append(cp[0])
        if scale != 1: xscale = yscale = scale
        if xscale != 1 or yscale != 1: self.scale(cp,xscale,yscale)
        if rotate != 0: cp = rotatecp(cp, pos, rotate)
        if not path:
                return cp
        else:
                return [cp]

    def ellipse(self, pos=[0,0], width=1, height=None, np=32, rotate=0,
                thickness=None, scale=1, xscale=1, yscale=1, angle1=0, angle2=2*pi):
        if height == None: height = 0.5*width
        return self.circle(pos=pos, radius=width, np=np, xscale=xscale, yscale=yscale*height/width,
                           thickness=thickness, rotate=rotate)
    
    def nframe(self, pos=[0,0], length=1, np=3, thickness=None,
               rotate=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        # for ngon
        if thickness == None: thickness = length*0.2
        else: thickness = length*thickness*2
        outer = self.ngon(pos=pos, np=np, length=length)
        angle = pi*(.5 - 1/np)
        length2 = length-2*thickness/tan(angle)
        inner = self.ngon(pos=pos, np=np, length=length2)
        if roundness > 0:
            outer = self.roundc(outer, roundness=roundness, invert=invert)
            inner = self.roundc(inner, roundness=roundness, invert=invert)
        if xscale != 1 or yscale != 1:
            outer = self.scale(outer,xscale,yscale)
            inner = self.scale(inner,xscale,yscale)
        if rotate != 0:
            outer = self.rotatecp(outer, pos, rotate)
            inner = self.rotatecp(inner, pos, rotate)
        return [outer, inner]
        
    def ngon(self, pos=[0,0], np=3, length=None, radius=1, rotate=0,
             thickness=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        cp = [] 
        if np < 3:
            raise AttributeError("number of sides can not be less than 3")
        angle = 2*pi/np
        if length != None: radius = (length/2)/(sin(angle/2))   
        else: length = radius*(sin(angle/2))*2
        if thickness == 0:
            seg = 2*pi/np
            angle = 0
            for i in range(np):
                x = radius*cos(angle) + pos[0]
                y = radius*sin(angle) + pos[1]
                cp.append([x,y])
                angle += seg
            cp.append(cp[0])
            if scale != 1: xscale = yscale = scale
            if xscale != 1 or yscale != 1: cp = self.scale(cp,xscale,yscale)
            if roundness > 0:
                    cp = roundc(cp.contour(0), roundness=roundness, invert=invert)
            if rotate != 0: cp = self.rotatecp(cp, pos, rotate)
        else:
            cp = self.nframe(pos=pos, np=np, length=length, scale=scale, xscale=xscale, yscale=yscale,
                    thickness=thickness, roundness=roundness, invert=invert, rotate=rotate)
        return cp

    def triangle(self, pos=[0,0], length=1, rotate=0, roundness=0,
                 thickness=0, invert=False, scale=1, xscale=1, yscale=1):
        return self.ngon(pos=pos, np=3, length=length, rotate=rotate-pi/60,
                         roundness=roundness, invert=invert,
                         scale=scale, xscale=xscale, yscale=yscale, thickness=thickness)

    def pentagon(self, pos=[0,0], length=1, rotate=0, roundness=0,
                 thickness=0, invert=False, scale=1, xscale=1, yscale=1):
        return self.ngon(pos=pos, np=5, length=length, rotate=rotate+pi/1,
                         roundness=roundness, invert=invert,
                         scale=scale, xscale=xscale, yscale=yscale, thickness=thickness)

    def hexagon(self, pos=[0,0], length=1, rotate=0, roundness=0,
                thickness=0, invert=False, scale=1, xscale=1, yscale=1):
        return self.ngon(pos=pos, np=6, length=length, rotate=rotate,
                         roundness=roundness, invert=invert,
                         scale=scale, xscale=xscale, yscale=yscale, thickness=thickness)
    
    def sframe(self,pos=[0,0], n=5, radius=1, iradius=None,
               thickness=None, rotate=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        # for star
        if iradius == None: iradius = 0.5*radius
        if thickness == None: thickness = 0.2*radius
        else: thickness = thickness*2*iradius
        outer = self.star(pos=pos, n=n, radius=radius, iradius=iradius)
        inner = self.star(pos=pos, n=n, radius=radius-thickness, iradius=(radius-thickness)*iradius/radius)
        if xscale != 1 or yscale != 1: pp.scale(xscale,yscale)
        if roundness > 0:
            outer = self.roundc(outer, roundness=roundness, invert=invert)
            inner = self.roundc(inner, roundness=roundness, invert=invert)
        if xscale != 1 or yscale != 1:
            outer = self.scale(outer,xscale,yscale)
            inner = self.scale(inner,xscale,yscale)
        if rotate != 0:
            outer = self.rotatecp(outer, pos, rotate)
            inner = self.rotatecp(inner, pos, rotate)
        if rotate != 0: cp = self.rotate(cp, rotate)
        return [outer,inner]

    def star(self, pos=[0,0], radius=1, n=5, iradius=None, rotate=0,
             thickness=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        # radius is from center to outer point of the star
        # iradius is from center to inner corners of the star
        if iradius == None: iradius = radius*0.5
        if thickness == 0:
            cp = []
            dtheta = pi/n
            theta = 0
            for i in range(2*n+1):
                if i % 2 == 0: cp.append([-radius*sin(theta),radius*cos(theta)])
                else: cp.append([-iradius*sin(theta),iradius*cos(theta)])
                theta += dtheta
            cp = self.addpos(pos, cp)
            cp[-1] = cp[0] # take care of possible rounding errors
            if scale != 1: xscale = yscale = scale
            if xscale != 1 or yscale != 1: cp = self.scale(cp,xscale,yscale)
            if roundness > 0:
                cp = self.roundc(cp, roundness=roundness, invert=invert)
            cp = self.rotatecp(cp, pos, rotate)
        else:
            cp = self.sframe(pos=pos, radius=radius, iradius=iradius, rotate=rotate,
                        thickness=thickness, roundness=roundness, invert=invert,
                        scale=scale, xscale=xscale, yscale=yscale, n=n)
        return cp

    def pointlist(self, pos=[], rotate=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1, path=False):
        cp = pos[:]
        closed = (cp[-1]== cp[0])
        if not closed and not path:
            cp.append(cp[0])
        if scale != 1: xscale = yscale = scale
        if xscale != 1 or yscale != 1: cp = self.scale(cp,xscale,yscale)
        if roundness > 0:
            cp = self.roundc(cp, roundness=roundness, invert=invert)
        if len(cp) and rotate != 0: cp = self.rotatecp(cp,cp[0],rotate)
        return cp

    ##################################
    ## ----------- GEARS ------------
    ##################################

    ##The following script has been developed and based on the
    ##Blender 235 script "Blender Mechanical Gears"
    ##developed in 2004 by Stefano <S68> Selleri,
    ##released under the Blender Artistic License (BAL).
    ##See www.blender.org.

    ####################################################################
    #CREATES THE BASE INVOLUTE PROFILE
    ####################################################################
    def ToothOutline(self, n=30, res=1, phi=20, radius=50,
                     addendum=0.4, dedendum=0.5, fradius=0.1, bevel=0.05):
        TOOTHGEO = {
            'PitchRadius' : radius,
            'TeethN'      : n,
            'PressureAng' : phi,
            'Addendum'    : addendum,
            'Dedendum'    : dedendum,
            'Fillet'      : fradius,
            'Bevel'       : bevel,
            'Resolution'  : res,
            }   
        ####################################################################
        #Basic Math computations: Radii
        #
        R = {
            'Bottom'  : TOOTHGEO['PitchRadius'] - TOOTHGEO['Dedendum'] - TOOTHGEO['Fillet'],
            'Ded'     : TOOTHGEO['PitchRadius'] - TOOTHGEO['Dedendum'],
            'Base'    : TOOTHGEO['PitchRadius'] * cos(TOOTHGEO['PressureAng']*pi/1800),
            'Bevel'   : TOOTHGEO['PitchRadius'] + TOOTHGEO['Addendum'] - TOOTHGEO['Bevel'],
            'Add'     : TOOTHGEO['PitchRadius'] + TOOTHGEO['Addendum']
        }

        ####################################################################
        #Basic Math computations: Angles
        #
        DiametralPitch = TOOTHGEO['TeethN']/(2*TOOTHGEO['PitchRadius'])
        ToothThickness = 1.5708/DiametralPitch
        CircularPitch  = pi / DiametralPitch

        U1 = sqrt((1-cos(TOOTHGEO['PressureAng']*pi/1800))/ cos(TOOTHGEO['PressureAng']*pi/1800))
        U2 = sqrt(R['Bevel']*R['Bevel']/(R['Ded']*R['Ded'])-1)

        ThetaA1 = atan((sin(U1)-U1*cos(U1))/(cos(U1)+U1*sin(U1)))
        ThetaA2 = atan((sin(U2)-U2*cos(U2))/(cos(U2)+U2*sin(U2)))
        ThetaA3 = ThetaA1 + ToothThickness/(TOOTHGEO['PitchRadius']*2)
        
        A = {
            'Theta0' : CircularPitch/(TOOTHGEO['PitchRadius']*2),
            'Theta1' : ThetaA3 + TOOTHGEO['Fillet']/R['Ded'],
            'Theta2' : ThetaA3,
            'Theta3' : ThetaA3 - ThetaA2,
            'Theta4' : ThetaA3 - ThetaA2 - TOOTHGEO['Bevel']/R['Add']
        }
        
        ####################################################################
        # Profiling
        #
        N = TOOTHGEO['Resolution']
        pts  = []
        normals = []   
        # Top half bottom of tooth
        for i in range(2*N):
            th = (A['Theta1'] - A['Theta0'])*i/(2*N-1) + A['Theta0']              
            pts.append ([R['Bottom']*cos(th), R['Bottom']*sin(th)])
            normals.append([-cos(th), -sin(th)])
            
        # Bottom Fillet
        xc = R['Ded']*cos(A['Theta1'])
        yc = R['Ded']*sin(A['Theta1'])
        Aw = pi/2 + A['Theta2'] - A['Theta1']
        for i in range(N):
            th = (Aw)*(i+1)/(N) + pi + A['Theta1']
            pts.append ([xc + TOOTHGEO['Fillet']*cos(th), yc + TOOTHGEO['Fillet']*sin(th)])
            normals.append([cos(th), sin(th)])

        # Straight part
        for i in range(N):
            r = (R['Base']-R['Ded'])*(i+1)/(N) + R['Ded']              
            pts.append ([r*cos(A['Theta2']), r*sin(A['Theta2'])])
            normals.append([cos(A['Theta2']-pi/2), sin(A['Theta2']-pi/2)])
        
        # Tooth Involute
        for i in range(3*N):
            r = (R['Bevel'] - R['Base'])*(i+1)/(3*N) + R['Base']
            u = sqrt(r*r/(R['Base']*R['Base'])-1)
            xp = R['Base']*(cos(u)+u*sin(u))
            yp = - R['Base']*(sin(u)-u*cos(u))
            pts.append ([xp*cos(A['Theta2'])-yp*sin(A['Theta2']), +xp*sin(A['Theta2'])+yp*cos(A['Theta2'])])
            normals.append([-sin(u), -cos(u)])
            
        # Tooth Bevel
        auxth = -u 
        auxth = auxth + ThetaA3 + pi/2
        m     = tan(auxth)
        P0    = pts[len(pts)-1]
        rA    = TOOTHGEO['Bevel']/(1-cos(auxth-A['Theta4']))
        xc    = P0[0] - rA*cos(auxth)
        yc    = P0[1] - rA*sin(auxth)
        for i in range(N):
            th = (A['Theta4'] - auxth)*(i+1)/(N) + auxth              
            pts.append ([xc + rA*cos(th), yc +rA*sin(th)])
            normals.append([-cos(th), -sin(th)])

        # Tooth Top
        P0    = pts[len(points)-1]
        A['Theta4'] = atan (P0[1]/P0[0])
        Ra = sqrt(P0[0]*P0[0]+P0[1]*P0[1])
        for i in range(N):
            th = (-A['Theta4'])*(i+1)/(N) + A['Theta4']              
            pts.append ([Ra*cos(th), Ra*sin(th)])
            normals.append([-cos(th), -sin(th)])

        # Mirrors this!
        N = len(pts)
        for i in range(N-1):
            P = pts[N-2-i]
            pts.append([P[0],-P[1]])
            V = normals[N-2-i]
            normals.append([V[0],-V[1]])

    # ,normals
        return pts               

    ####################################################################
    #CREATES THE BASE RACK PROFILE
    ####################################################################
    def RackOutline(self, n=30, res=1, phi=20, radius=5,
                    addendum=0.4, dedendum=0.5, fradius=0.1, bevel=0.05):
        TOOTHGEO = {
            'PitchRadius' : radius,
            'TeethN'      : n,
            'PressureAng' : phi,
            'Addendum'    : addendum,
            'Dedendum'    : dedendum,
            'Fillet'      : fradius,
            'Bevel'       : bevel,
            'Resolution'  : res,
            }  
        ####################################################################
        #Basic Math computations: QUotes
        #
        X = {
            'Bottom'  :  - TOOTHGEO['Dedendum'] - TOOTHGEO['Fillet'],
            'Ded'     :  - TOOTHGEO['Dedendum'],
            'Bevel'   : TOOTHGEO['Addendum'] - TOOTHGEO['Bevel'],
            'Add'     : TOOTHGEO['Addendum']
        }

        ####################################################################
        #Basic Math computations: Angles
        #
        DiametralPitch = TOOTHGEO['TeethN']/(2*TOOTHGEO['PitchRadius'])
        ToothThickness = 1.5708/DiametralPitch
        CircularPitch  = pi / DiametralPitch

        Pa = TOOTHGEO['PressureAng']*pi/180.0
        
        yA1 = ToothThickness/2.0
        yA2 = (-X['Ded']+TOOTHGEO['Fillet']*sin(Pa))*tan(Pa)
        yA3 = TOOTHGEO['Fillet']*cos(Pa)

        A = {
            'y0' : CircularPitch/2.0,
            'y1' : yA1+yA2+yA3,
            'y2' : yA1+yA2,
            'y3' : yA1 -(X['Add']-TOOTHGEO['Bevel'])*tan(Pa),
            'y4' : yA1 -(X['Add']-TOOTHGEO['Bevel'])*tan(Pa)
                    - cos(Pa)/(1-sin(Pa))*TOOTHGEO['Bevel']
        }

        ####################################################################
        # Profiling
        #
        N = TOOTHGEO['Resolution']
        pts  = []
        normals = []
        ist = 0
        if fradius: ist = 1
        # Top half bottom of tooth
        for i in range(ist, 2*N):
            y = (A['y1'] - A['y0'])*i/(2*N-1) + A['y0']              
            pts.append ([X['Bottom'],
                            y])
            normals.append([-1.0,
                            -0.0])
            
        # Bottom Fillet
        xc = X['Ded']
        yc = A['y1']
        Aw = pi/2.0 - Pa
        
        for i in range(N):
            th = (Aw)*(i+1)/(N) + pi
            pts.append ([xc + TOOTHGEO['Fillet']*cos(th),
                            yc + TOOTHGEO['Fillet']*sin(th)])
            normals.append([cos(th),
                            sin(th)])

        # Straight part
        Xded = X['Ded'] - TOOTHGEO['Fillet']*sin(Pa)
        for i in range(4*N):
            x = (X['Bevel']-Xded)*(i+1)/(4*N) + Xded              
            pts.append ([x,
                            yA1-tan(Pa)*x])
            normals.append([-sin(Pa),
                            -cos(Pa)])
        
        # Tooth Bevel
        rA    = TOOTHGEO['Bevel']/(1-sin(Pa))
        xc    =  X['Add'] - rA
        yc    =  A['y4']
        for i in range(N):
            th = (-pi/2.0+Pa)*(i+1)/(N) + pi/2.0-Pa
            pts.append ([xc + rA*cos(th),
                            yc + rA*sin(th)])
            normals.append([-cos(th),
                            -sin(th)])

        # Tooth Top
        for i in range(N):
            y = -A['y4']*(i+1)/(N) + A['y4']
            pts.append ([X['Add'],
                            y])
            normals.append([-1.0,
                            0.0])

        # Mirrors this!
        N = len(pts)
        for i in range(N-1):
            P = pts[N-2-i]
            pts.append([P[0],-P[1]])
            V = normals[N-2-i]
            normals.append([V[0],-V[1]])

        return pts               # ,normals

    ####################################################################
    #CREATES THE BASE CROWN INVOLUTE 
    ####################################################################
    def CrownOutline(self, n=30, res=1, phi=20, radius=50, addendum=0.4, dedendum=0.5, fradius=0.1, bevel=0.05):
        TOOTHGEO = {
            'PitchRadius' : radius,
            'TeethN'      : n,
            'PressureAng' : phi,
            'Addendum'    : addendum,
            'Dedendum'    : dedendum,
            'Fillet'      : fradius,
            'Bevel'       : bevel,
            'Resolution'  : res,
            }  
        ####################################################################
        #Basic Math computations: Radii
        #
        R = {
            'Bottom'  : TOOTHGEO['PitchRadius'] * cos(TOOTHGEO['PressureAng']*pi/1800) ,
            'Base'    : TOOTHGEO['PitchRadius'] * cos(TOOTHGEO['PressureAng']*pi/1800) + TOOTHGEO['Fillet'],
            'Ded'     : TOOTHGEO['PitchRadius'] + TOOTHGEO['Dedendum']
        }

        ####################################################################
        #Basic Math computations: Angles
        #
        DiametralPitch = TOOTHGEO['TeethN']/(2*TOOTHGEO['PitchRadius'])
        ToothThickness = 1.5708/DiametralPitch
        CircularPitch  = pi / DiametralPitch

        U1 = sqrt((1-cos(TOOTHGEO['PressureAng']*pi/1800))/ cos(TOOTHGEO['PressureAng']*pi/1800))
        U2 = sqrt(R['Ded']*R['Ded']/(R['Base']*R['Base'])-1)

        ThetaA1 = atan((sin(U1)-U1*cos(U1))/(cos(U1)+U1*sin(U1)))
        ThetaA2 = atan((sin(U2)-U2*cos(U2))/(cos(U2)+U2*sin(U2)))
        ThetaA3 = ThetaA1 + ToothThickness/(TOOTHGEO['PitchRadius']*2)
        
        A = {
            'Theta0' : CircularPitch/(TOOTHGEO['PitchRadius']*2),
            'Theta1' : (ThetaA3 + TOOTHGEO['Fillet']/R['Base']),
            'Theta2' : ThetaA3,
            'Theta3' : ThetaA3 - ThetaA2,
            'Theta4' : ThetaA3 - ThetaA2 - TOOTHGEO['Bevel']/R['Ded']
        }

        M = A['Theta0'] 
        A['Theta0'] = 0
        A['Theta1'] = A['Theta1']-M
        A['Theta2'] = A['Theta2']-M
        A['Theta3'] = A['Theta3']-M
        A['Theta4'] = A['Theta4']-M
        
        ####################################################################
        # Profiling
        #
        N = TOOTHGEO['Resolution']
        apoints  = []
        anormals = []   

        # Top half top of tooth
        for i in range(2*N):
            th = (A['Theta1'] - A['Theta0'])*i/(2*N-1) + A['Theta0']              
            apoints.append ([R['Bottom']*cos(th), R['Bottom']*sin(th)])
            anormals.append([cos(th), sin(th)])
            
        # Bottom Bevel
        xc = R['Base']*cos(A['Theta1'])
        yc = R['Base']*sin(A['Theta1'])
        Aw = pi/2 + A['Theta2'] - A['Theta1']
        for i in range(N):
            th = (Aw)*(i+1)/(N) + pi + A['Theta1']
            apoints.append ([xc + TOOTHGEO['Fillet']*cos(th), yc + TOOTHGEO['Fillet']*sin(th)])
            anormals.append([-cos(th), -sin(th)])

        # Tooth Involute
        for i in range(4*N):
            r = (R['Ded'] - R['Base'])*(i+1)/(4*N) + R['Base']
            u = sqrt(r*r/(R['Base']*R['Base'])-1)
            xp = R['Base']*(cos(u)+u*sin(u))
            yp = - R['Base']*(sin(u)-u*cos(u))
            apoints.append ([xp*cos(A['Theta2'])-yp*sin(A['Theta2']), +xp*sin(A['Theta2'])+yp*cos(A['Theta2'])])
            anormals.append([sin(u), cos(u)])
            
        # Tooth Bevel
        auxth = -u 
        auxth = auxth + ThetaA3 + pi/2
        m     = tan(auxth)
        P0    = apoints[len(apoints)-1]
        rA    = TOOTHGEO['Bevel']/(1-cos(auxth-A['Theta4']))
        xc    = P0[0] - rA*cos(auxth)
        yc    = P0[1] - rA*sin(auxth)
        for i in range(N):
            th = (A['Theta4'] - auxth)*(i+1)/(N) + auxth              
            apoints.append ([xc + rA*cos(th), yc +rA*sin(th)])
            anormals.append([cos(th), sin(th)])

        # Tooth Top
        P0    = apoints[len(apoints)-1]
        A['Theta4'] = atan (P0[1]/P0[0])
        Ra = sqrt(P0[0]*P0[0]+P0[1]*P0[1])
        for i in range(N):
            th = (-M - A['Theta4'])*(i+1)/(N) + A['Theta4']
            apoints.append ([Ra*cos(th), Ra*sin(th)])
            anormals.append([cos(th), sin(th)])
        pts = []
        normals = []
        N = len(apoints)
        for i in range(N):
            pts.append(apoints[N-1-i])
            normals.append(anormals[N-1-i])
            
        # Mirrors this!
        N = len(pts)
        for i in range(N-1):
            P = pts[N-2-i]
            pts.append([P[0],-P[1]])
            V = normals[N-2-i]
            normals.append([V[0],-V[1]])

    #,normals       process normals later
        return pts

    def gear(self, pos=[0,0], n=20, radius=5, phi=20, addendum=None, dedendum=None,
             fradius=None, rotate=0, scale=1, internal=False, res=1, bevel=0):
        if addendum is None: addendum = 0.08*radius
        if dedendum is None: dedendum = 0.1*radius
        if fradius is None: fradius = 0.02*radius
        tooth = self.ToothOutline(n=n, res=res, phi=phi, radius=radius,
                                  addendum=addendum, dedendum=dedendum, fradius=fradius, bevel=0)

        if internal:
            itooth = []
            for p in tooth:
                px = p[0]
                py = p[1]
                rad = radius-(addendum+dedendum)
                driro = sqrt(px*px +py*py) - rad
                ir = rad - driro
                ro = rad + driro
                ix = (ir/ro)*px
                iy = (ir/ro)*py
                itooth.append((ix,iy))
            tooth = itooth
        gear = []
        for i in range(0, n):
            rotan = -i*2*pi/n
            rtooth = []
            for (x, y) in tooth:
                rx = x*cos(rotan) - y*sin(rotan) + pos[0]
                ry = x*sin(rotan) + y*cos(rotan) + pos[1]
                rtooth.append((rx,ry))
            gear.extend(rtooth)
        if scale != 1 : gear = self.scale(gear, scale,scale)
        if rotate != 0: gear = self.rotate(gear,rotate)
        if internal:
            outer = self.circle(pos=pos, radius=radius)
            return [outer,gear]
        else:
            return gear

    def rackgear(self, pos=[0,0], n=30, radius=5, phi=20, addendum=None, dedendum=None,
                 fradius=None, rotate=0, scale=1, length=10*pi, res=1, bevel=0.05, depth=(0.4+0.6+0.1)):
        if addendum is None: addendum = 0.08*radius
        if dedendum is None: dedendum = 0.1*radius
        if fradius is None: fradius = 0.02*radius
        tooth = self.RackOutline(n=n, res=res, phi=phi, radius=radius,
                                 addendum=addendum, dedendum=dedendum, fradius=fradius, bevel=bevel)

        toothl = tooth[0][1] - tooth[-1][1]

        ntooth = int(length/toothl)
        flength = ntooth * toothl

        gear = []
        for i in range(0, ntooth):
            ntooth = []
            for (x, y) in tooth:
                nx = x + pos[0]
                ny = -i*toothl + y + pos[1]
                ntooth.append((nx,ny))
            gear.extend(ntooth)
        gear.append((gear[-1][0]-depth,gear[-1][1]))
        gear.append((gear[0][0]-depth,gear[0][1]))
        gear.append(gear[0])
        left = 1000
        right = -1000
        bottom = 1000
        top = -1000
        for g in gear:
            x, y = g
            if x < left: left = x
            if x > right: right = x
            if y < bottom: bottom = y
            if y > top: top = y
        center = [(left+right)/2, (bottom+top)/2]
        dx = pos[0]-center[0]
        dy = pos[1]-center[1]
        gear2 = []
        for g in gear:
            gear2.append([g[0]+dx, g[1]+dy])
        if scale != 1 : gear2 = self.scale(gear2,scale,scale)
        if rotate != 0: gear2 = self.rotate(gear2,rotate)
        return gear2


##################################
## ----------- paths -------------
##################################

class path_object(object):
    
    def convert(self, pos=vec(0,0,0), up=vec(0,1,0), pts=None, closed=True):
        pos = vec(pos)
        up = norm(vec(up))
        up0 = vec(0,1,0)
        angle = acos(up.dot(up0))
        reorient = (angle > 0)
        axis = up0.cross(up)
        p = []
        for pt in pts:
            newpt = vec(pt[0],0,-pt[1])
            if reorient: newpt = newpt.rotate(angle=angle, axis=axis)
            p.append(pos+newpt)
        if closed and (p[-1] != p[0]): p.append(pts[0])
        return p

    def rectangle(self, pos=vec(0,0,0), width=6, height=None, rotate=0,
                  thickness=None, roundness=0, invert=False, scale=1,
                  xscale=1, yscale=1, up=vec(0,1,0)):
        if height == None: height = width
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in a rectangular path")
        c = shapes.rectangle(width=width, height=height, rotate=rotate,
                             thickness=0, roundness=roundness, invert=invert,
                             scale=scale, xscale=xscale, yscale=yscale)
        return self.convert(pos=pos, up=up, pts=c)

    def cross(self, pos=vec(0,0,0), width=5, thickness=2, rotate=0, roundness=0,
              invert=False, scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        c = shapes.cross(width=width, rotate=rotate, thickness=thickness,
                         roundness=roundness, invert=invert,
                         scale=scale, xscale=xscale, yscale=yscale)
        return self.convert(pos=pos, up=up, pts=c)

    def trapezoid(self, pos=vec(0,0,0), width=6, height=3, top=None, rotate=0,
                  thickness=None, roundness=0, invert=False,
                  scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
            if height == None: height = width
            if thickness is not None:
                raise AttributeError("Thickness is not allowed in a trapezoidal path")
            c = shapes.trapezoid(width=width, height=height, top=top, rotate=rotate,
                             thickness=0, roundness=roundness, invert=invert,
                             scale=scale, xscale=xscale, yscale=yscale)
            return self.convert(pos=pos, up=up, pts=c)

    def circle(self, pos=vec(0,0,0), radius=3, np=32, thickness=None,
               scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in a circular path")
        c = shapes.circle(radius=radius, np=np, scale=scale, xscale=xscale, yscale=yscale)
        return self.convert(pos=pos, up=up, pts=c)
    
    def line(self, start=vec(0,0,0), end=vec(0,0,-1), np=2):
        if np < 2:
            raise AttributeError("The minimum value of np is 2 (one segment)")
        vline = (end-start)/(np-1)
        p = []
        for i in range(np):
            p.append(start + i*vline)
        return p

    def arc(self, pos=vec(0,0,0), radius=3, np=32, rotate=0, angle1=0, angle2=pi,
            thickness=None, scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in a circular path")
        c = shapes.arc(radius=radius, angle1=angle1, angle2=angle2, rotate=rotate, np=np,
                   scale=scale, xscale=xscale, yscale=yscale, path=True)
        return self.convert(pos=pos, up=up, pts=c[0], closed=False)

    def ellipse(self, pos=vec(0,0,0), width=6, height=None, np=32,
                thickness=None, scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in an elliptical path")
        c = shapes.ellipse(width=width, height=height, np=np,
                           scale=scale, xscale=xscale, yscale=yscale)
        return self.convert(pos=pos, up=up, pts=c)

    def ngon(self, pos=vec(0,0,0), np=3, length=6, radius=30, rotate=0,
             thickness=None, roundness=0, invert=False,
             scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in an ngon path")
        c = shapes.ngon(np=np, length=length, radius=radius, rotate=rotate,
                        thickness=0, roundness=roundness, invert=invert,
                        scale=scale, xscale=xscale, yscale=yscale)
        return self.convert(pos=pos, up=up, pts=c)

    def triangle(self, pos=vec(0,0,0), length=6, rotate=0,
                 thickness=None, roundness=0, invert=False,
                 scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in a triangular path")
        c = shapes.ngon(np=3, length=length, rotate=rotate-pi/60,
                        thickness=0, roundness=roundness, invert=invert,
                        scale=scale, xscale=xscale, yscale=yscale)
        return self.convert(pos=pos, up=up, pts=c)

    def pentagon(self, pos=vec(0,0,0), length=6, rotate=0,
                 thickness=None, roundness=0, invert=False,
                 scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in a pentagonal path")
        c = shapes.ngon(np=5, length=length, rotate=rotate+pi/1, thickness=0,
                        roundness=roundness, invert=invert,
                        scale=scale, xscale=xscale, yscale=yscale)
        return self.convert(pos=pos, up=up, pts=c)

    def hexagon(self, pos=vec(0,0,0), length=6, rotate=0,
                thickness=None, roundness=0, invert=False,
                scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in a hexagonal path")
        c = shapes.ngon(np=6, length=length, rotate=rotate,
                        thickness=0, roundness=roundness, invert=invert,
                        scale=scale, xscale=xscale, yscale=yscale)
        return self.convert(pos=pos, up=up, pts=c)

    def star(self, pos=vec(0,0,0), radius=3, n=5, iradius=None, rotate=0,
             thickness=None, roundness=0, invert=False,
             scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in a star path")
        c = shapes.star(n=n, radius=radius, iradius=iradius, rotate=rotate,
                        roundness=roundness, invert=invert,
                        scale=scale, xscale=xscale, yscale=yscale)
        return self.convert(pos=pos, up=up, pts=c)

    def pointlist(self, pos=[], rotate=0, thickness=None, roundness=0, invert=False,
                    scale=1, xscale=1, yscale=1, up=vec(0,1,0)):
        if thickness is not None:
            raise AttributeError("Thickness is not allowed in a pointlist path")
        c = shapes.pointlist(pos=pos, rotate=rotate, roundness=roundness, invert=invert,
                             scale=scale, xscale=xscale, yscale=yscale, path=True)
        return c

##def show(s):
##    L = len(s)
##    if L != 2:
##        L = 1
##        s = [s]
##    for i in range(L):
##        c = curve()
##        for v in s[i]:
##            c.append(v)
##
##def showp(p):
##    #scene.forward = vec(0,-1,-1)
##    curve(pos=p)

paths = path_object()
shapes = shape_object()
##s = shapes.arc()
##show(s)
##p = paths.arc()
##showp(p)

