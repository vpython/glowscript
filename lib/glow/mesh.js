;(function () {
    "use strict";

    // Mesh() represents a mesh of triangles
    // TODO: Big meshes (>64K vertices) for compound()
    function Mesh() {
        this.pos = []
        this.normal = []
        this.color = []
        this.opacity = []
        this.shininess = []
        this.emissive = []
        this.texpos = []
        this.bumpaxis = []
        this.index = []
        this.model_transparent = false
    }
    $.extend( Mesh.prototype, {
        merge: function merge(otherMesh, object, bias) {
        	var xmin = null, xmax = null, ymin = null, ymax = null, zmin = null, zmax = null
            var offset = this.pos.length / 3
            if (object instanceof vertex) {
            	if (offset >= 4.29e9) return null
	            if (bias < 0) this.index.push(offset + bias)
	            else {
	        		if (xmin === null || object.__pos.x < xmin) xmin = object.__pos.x
	        		if (xmax === null || object.__pos.x > xmax) xmax = object.__pos.x        	
	        		if (ymin === null || object.__pos.y < ymin) ymin = object.__pos.y
	        		if (ymax === null || object.__pos.y > ymax) ymax = object.__pos.y        	
	        		if (zmin === null || object.__pos.z < zmin) zmin = object.__pos.z
	        		if (zmax === null || object.__pos.z > zmax) zmax = object.__pos.z
		            this.pos.push(object.__pos.x, object.__pos.y, object.__pos.z)
		            this.normal.push(object.__normal.x, object.__normal.y, object.__normal.z)
		            this.color.push(object.__color.x, object.__color.y, object.__color.z)
	            	if (object.__opacity < 1) this.model_transparent = true
	            	this.opacity.push(object.__opacity)
	            	this.shininess.push(object.__shininess)
	            	this.emissive.push(object.__emissive)
		            this.texpos.push(object.__texpos.x, object.__texpos.y)
		            this.bumpaxis.push(object.__bumpaxis.x, object.__bumpaxis.y, object.__bumpaxis.z) 
		            this.index.push(offset) 
	            }
            } else {
            	if (offset + otherMesh.pos.length/3 >= 4.29e9) return null
                var c = [object.__color.x, object.__color.y, object.__color.z]
	            for (var j = 0; j < otherMesh.pos.length; j++) {
	            	if (j%3 === 0) {
	            		if (xmin === null || otherMesh.pos[j] < xmin) xmin = otherMesh.pos[j]
	            		if (xmax === null || otherMesh.pos[j] > xmax) xmax = otherMesh.pos[j]
	            	} else if (j%3 === 1) {
	            		if (ymin === null || otherMesh.pos[j] < ymin) ymin = otherMesh.pos[j]
	            		if (ymax === null || otherMesh.pos[j] > ymax) ymax = otherMesh.pos[j]
	            	} else if (j%3 === 2) {
	            		if (zmin === null || otherMesh.pos[j] < zmin) zmin = otherMesh.pos[j]
	            		if (zmax === null || otherMesh.pos[j] > zmax) zmax = otherMesh.pos[j]
	            	}
	                this.pos.push(otherMesh.pos[j])
	            }
	            for (var j = 0; j < otherMesh.normal.length; j++)
	                this.normal.push(otherMesh.normal[j])
	            for (var j = 0; j < otherMesh.color.length; j++) 
	            	this.color.push( c[j % 3] * otherMesh.color[j] )
	            for (var j = 0; j < otherMesh.opacity.length; j++) {
	            	var opacity = object.__opacity * otherMesh.opacity[j]
	            	if (opacity < 1) this.model_transparent = true
	                this.opacity.push(opacity)
	            }
	            for (var j = 0; j < otherMesh.shininess.length; j++) {
	            	var shininess = object.__shininess * otherMesh.shininess[j]
	            	this.shininess.push( shininess )
	            }
		        for (var j = 0; j < otherMesh.emissive.length; j++)  {
		            var emissive = object.__emissive || otherMesh.emissive[j] ? 1 : 0
		            this.emissive.push( emissive )
		        }
	            for (var j = 0; j < otherMesh.texpos.length; j++)
	                this.texpos.push(otherMesh.texpos[j])
	            for (var j = 0; j < otherMesh.bumpaxis.length; j++)
	                this.bumpaxis.push(otherMesh.bumpaxis[j])
	            for (var j = 0; j < otherMesh.index.length; j++)
	                this.index.push(offset + otherMesh.index[j])
            }
            return {__xmin:xmin, __ymin:ymin, __zmin:zmin, __xmax:xmax, __ymax:ymax, __zmax:zmax}
        },
        transformed: function transformed(matrix) {
            var normalTrans = mat3.toMat4(mat3.transpose(mat4.toInverseMat3(matrix)))
            var out = new Mesh()
            out.index = this.index
            out.color = this.color
            out.opacity = this.opacity
            out.shininess = this.shininess
            out.emissive = this.emissive
            out.texpos = this.texpos
            var L = this.pos.length
            for (var i = 0; i < L; i += 3) {
                var v = [this.pos[i], this.pos[i + 1], this.pos[i + 2]]
                var n = [this.normal[i], this.normal[i + 1], this.normal[i + 2], 0]
                var b = [this.bumpaxis[i], this.bumpaxis[i + 1], this.bumpaxis[i + 2], 0]
                mat4.multiplyVec3(matrix, v)
                mat4.multiplyVec4(normalTrans, n)
                mat4.multiplyVec4(matrix, b)
                vec3.normalize(b)
                out.pos.push(v[0], v[1], v[2])
                out.normal.push(n[0], n[1], n[2])
                out.bumpaxis.push(b[0], b[1], b[2])
            }
            return out
        },
        adjust: function adjust(v, s) { // called from compound constructor; make compound mesh size be vec(1,1,1)
        	var dx = v.x, dy = v.y, dz = v.z
        	var sx = s.x, sy = s.y, sz = s.z
        	for (var i=0; i<this.pos.length; i+=3) {
        		this.pos[i]   = (this.pos[i]-dx)/sx
        		this.pos[i+1] = (this.pos[i+1]-dy)/sy
        		this.pos[i+2] = (this.pos[i+2]-dz)/sz
        		this.normal[i]   *= sx
        		this.normal[i+1] *= sy
        		this.normal[i+2] *= sz
        	}
        }
    })

    // Mesh.make*() generate meshes for specific primitives
    $.extend( Mesh, {
        makeGroup: function() { // placeholder for group objects
            let m = new Mesh()
            m.pos.push(
                0, 0, 0 )
            return m
        },
        makeCube: function() {
            var m = new Mesh()
            var s = 0.5; // from VPython; 1x1x1 cube
            m.pos.push( 
                  +s, +s, +s,    +s, -s, +s,     +s, -s, -s,     +s, +s, -s,   // Right face
                  -s, +s, -s,    -s, -s, -s,     -s, -s, +s,     -s, +s, +s,   // Left face
                  -s, -s, +s,    -s, -s, -s,     +s, -s, -s,     +s, -s, +s,   // Bottom face
                  -s, +s, -s,    -s, +s, +s,     +s, +s, +s,     +s, +s, -s,   // Top face
                  -s, +s, +s,    -s, -s, +s,     +s, -s, +s,     +s, +s, +s,   // Front face
                  +s, +s, -s,    +s, -s, -s,     -s, -s, -s,     -s, +s, -s )  // Back face
            m.normal.push(
                  +1, 0, 0 ,  +1, 0, 0 ,  +1, 0, 0 ,  +1, 0, 0,
                  -1, 0, 0,   -1, 0, 0,   -1, 0, 0,   -1, 0, 0,
                  0, -1, 0,   0, -1, 0,   0, -1, 0,   0, -1, 0,
                  0, +1, 0,   0, +1, 0,   0, +1, 0,   0, +1, 0,
                  0, 0, +1,   0, 0, +1,   0, 0, +1,   0, 0, +1,
                  0, 0, -1,   0, 0, -1,   0, 0, -1,   0, 0, -1 )
            m.color.push(
            	  1, 1, 1,    1, 1, 1,    1, 1, 1,    1, 1, 1,
            	  1, 1, 1,    1, 1, 1,    1, 1, 1,    1, 1, 1,
            	  1, 1, 1,    1, 1, 1,    1, 1, 1,    1, 1, 1,
            	  1, 1, 1,    1, 1, 1,    1, 1, 1,    1, 1, 1,
            	  1, 1, 1,    1, 1, 1,    1, 1, 1,    1, 1, 1,
            	  1, 1, 1,    1, 1, 1,    1, 1, 1,    1, 1, 1 )
            m.opacity.push(
            	  1, 1, 1, 1,
            	  1, 1, 1, 1,
            	  1, 1, 1, 1,
            	  1, 1, 1, 1,
            	  1, 1, 1, 1,
            	  1, 1, 1, 1 )
            m.shininess.push(
            	  1, 1, 1, 1,
            	  1, 1, 1, 1,
            	  1, 1, 1, 1,
            	  1, 1, 1, 1,
            	  1, 1, 1, 1,
            	  1, 1, 1, 1 )
            m.emissive.push(
	           	  0, 0, 0, 0,
	           	  0, 0, 0, 0,
	           	  0, 0, 0, 0,
	           	  0, 0, 0, 0,
	           	  0, 0, 0, 0,
	           	  0, 0, 0, 0 )
            m.texpos.push(
                  0, 1,  0, 0,  1, 0,  1, 1,
                  0, 1,  0, 0,  1, 0,  1, 1,
                  0, 1,  0, 0,  1, 0,  1, 1,
                  0, 1,  0, 0,  1, 0,  1, 1,
                  0, 1,  0, 0,  1, 0,  1, 1,
                  0, 1,  0, 0,  1, 0,  1, 1 )
            m.bumpaxis.push(
                  0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
                  0, 0, +1,  0, 0, +1,  0, 0, +1,  0, 0, +1,
                  +1, 0, 0,  +1, 0, 0,  +1, 0, 0,  +1, 0, 0,
                  +1, 0, 0,  +1, 0, 0,  +1, 0, 0,  +1, 0, 0,
                  +1, 0, 0,  +1, 0, 0,  +1, 0, 0,  +1, 0, 0,
                  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0 )
            m.index.push(
                  0, 1, 2, 0, 2, 3,   4, 5, 6, 4, 6, 7,   8, 9, 10, 8, 10, 11,
                  12, 13, 14, 12, 14, 15,   16, 17, 18, 16, 18, 19,   20, 21, 22, 20, 22, 23 )
            return m
        },

        makeQuad: function() { // origin of 2-triangle quad at lower left: (0, 0); used for depth peeling merge
            var m = new Mesh()
            m.pos.push( 
            	  -1, -1, 0,    +1, -1, 0,    +1, +1, 0,    -1, +1, 0 )
            m.normal.push(
                  0, 0, 1,    0, 0, 1,    0, 0, 1,    0, 0, 1 )
            m.color.push(
            	   1, 1, 1,    1, 1, 1,   1, 1, 1,   1, 1, 1)
            m.opacity.push(
            	   1,  1,  1,  1)
            m.shininess.push(
                   1,  1,  1,  1)
            m.emissive.push(
            	   0,  0,  0,  0)
            m.texpos.push( 
            	  0, 0,    1, 0,    1, 1,    0, 1 )
            m.bumpaxis.push(
                  1, 0, 0,    1, 0, 0,    1, 0, 0,    1, 0, 0 )
            m.index.push(
                  0, 1, 2,    0, 2, 3 )
            return m
        },
        
        
        makeCylinder: function(R) {
            var N = 50 // number of sides of the cylinder, of radius 1 and axis < 1,0,0 >
            // Total number of pos is 4*N+2 = 202 for N = 50
            var dtheta = 2*Math.PI/N
            var sind = Math.sin(dtheta), cosd = Math.cos(dtheta)
            // sin(theta+dtheta) = sin(theta)*cosd + cos(theta)*sind, so newy = y*cosd + z*sind
            // cos(theta+dtheta) = cos(theta)*cosd - sin(theta)*sind, so newz = z*cosd - y*sind
            var y = -R, z = 0
            var newy, newz
            var m = new Mesh()
            m.pos.push( 0, 0, 0,  1, 0, 0 )
            m.normal.push( -1, 0, 0,  1, 0, 0 )
            m.color.push( 1, 1, 1,  1, 1, 1 )
            m.opacity.push( 1, 1 )
            m.shininess.push( 1, 1 )
            m.emissive.push( 0, 0 )
            m.texpos.push( 0.5,0.5,  0.5,0.5 )
            m.bumpaxis.push( 0,0,1,  0,0,-1 )
            var k = 4*N
            for (var i=2; i<=2+4*N; i+=4) {
                
                m.pos.push( 0,y,z,  0,y,z,  1,y,z,  1,y,z )
                
                m.normal.push( -1,0,0,  0,y,z,  1,0,0,  0,y,z )
                
                m.color.push( 1,1,1,  1,1,1,  1,1,1,  1,1,1)
                
                m.opacity.push(1,  1,  1,  1)
                
                m.shininess.push(1,  1,  1,  1)
                
                m.emissive.push(0, 0, 0, 0)
                
                if (i < 2+2*N){
                    m.texpos.push( 0.5*(1+z/R),0.5+0.5*y/R,  0,(i-2)/4/(N/2),         0.5*(1-z/R),0.5+0.5*y/R,   1,(i-2)/4/(N/2) )
                    m.bumpaxis.push( 0,0,1,  1,0,0,  0,0,-1,  1,0,0  )
                } else {
                    m.texpos.push( 0.5*(1+z/R),0.5+0.5*y/R,  0,1-(i-2-2*N)/4/(N/2),   0.5*(1-z/R),0.5+0.5*y/R,   1,1-(i-2-2*N)/4/(N/2) )
                    m.bumpaxis.push( 0,0,1,  -1,0,0,  0,0,-1,  -1,0,0  )
                }
                                
                if (i != 2+4*N) m.index.push( 0,(i-2)%k+2,(i+4-2)%k+2,        i+1,(i+3-2)%k+2,(i+7-2)%k+2,
                                              i+1,(i+7-2)%k+2,(i+5-2)%k+2,    1,(i+6-2)%k+2,(i+2-2)%k+2  )
                
                newy = y*cosd + z*sind
                newz = z*cosd - y*sind
                y = newy
                z = newz
            }
            return m
        },
        
        
        // sin(theta+dtheta) = sin(theta)*cosd + cos(theta)*sind, so newy = y*cosd + z*sind
        // cos(theta+dtheta) = cos(theta)*cosd - sin(theta)*sind, so newz = z*cosd - y*sind
        makeRing: function(R1, R2) {
        	// R1 = radius of centerline of cross sections (default 0.5-0.05; see WebGLRenderer.js)
        	// R2 = radius of cross section (default 0.05; see WebGLRenderer.js)
            // Axis is vec(1,0,0).
            // Mesh vertices consist of NC oval cross sections.
            // Total points = (NC+1)*(N+1).
        	// The vertex shader obtains from "normal" the position of the outer edge of the cross section.
        	// The mesh "pos" contains the 2D <x,z> shape of the circular cross section, with <0,0>
        	// at the outer edge of the cross section. This information is sufficient to efficiently
        	// determine the real-world position and normal of the vertex, for given size specifications.       	
        	
            var NC = 60 // number of open cylinders
            var dphi = 2*Math.PI/NC  // around the ring equator
            var sinp = Math.sin(dphi), cosp = Math.cos(dphi)
            
			var N = 20   // number of sides of each open cylinder
            var dtheta = 2*Math.PI/N // around a cross-section, the sides of each cylinder
            var sint = Math.sin(dtheta), cost = Math.cos(dtheta)
            var x=0, z=-R2 // put seam to inside of ring
            var newx, newz
            //var k = 1/Math.cos(dphi/2) // multiply z by k to stretch along the joint; only 1.00121, so approximate by 1
            var tube = [] // list of x,z points in the xz plane representing the tubular shape at a joint
            for (var i=0; i<N+1; i++) {
            	//tube.push(vec(x,0,k*z-k*R2)) 
            	tube.push(vec(x,0,z-R2)) // <0,0> position at outer edge of cross section
            	newx = x*cost + z*sint
            	newz = z*cost - x*sint
            	x = newx
            	z = newz
            }
            
            var y=0, z=-(R1+R2) // put seam to the back
            var newy, newz
        	var normals = []
            for (var c=0; c<NC+1; c++) {
            	var r = vec(0, y, z) // vector from origin to outer edge of oval cross section
                normals.push(r) // use normal to contain the vector from origin to outer edge of the oval

            	newy = y*cosp - z*sinp // circulate counterclockwise around axis
            	newz = z*cosp + y*sinp
            	y = newy
            	z = newz
            }
 
            var m = new Mesh()
            var offset = N+1
            for (var c=0; c<NC+1; c++) {
                var s = c*offset
             	for (var i=0; i<offset; i++) {
             		var v0 = tube[i]
             		m.pos.push( v0.x,v0.y,v0.z )

             		v0 = normals[c]
             		m.normal.push( v0.x,v0.y,v0.z )
           		    v0 = v0.norm()
                    m.bumpaxis.push( 0,-v0.z,v0.y )

          		    m.color.push( 1, 1, 1 )
          		    m.opacity.push( 1 )
          		    m.shininess.push( 1 )
          		    m.emissive.push( 0 )
          		    
          		    m.texpos.push( c/NC, i/N )

          		    m.index.push( s+i,s+i+offset,s+i+offset+1,   s+i,s+i+offset+1,s+i+1 )
                 }
                 m.index.length -= 6 // discard last set of indices
            }
            m.index.length -= 6*(offset-1) // discard entire last band of indices
            return m
        },

        makeRing_compound: function(size) {
            // This function is used to create a mesh for adding a ring to a compound.
            // This is an elliptical ring, with the defining characteristics that the outer edge is an ellipse 
            // bounded by size.x and size.y, and the inner edge is also an ellipse with semi axes
            // (size.y/2 - 2*R2) and (size.z/2 - 2*R2).
        	var R2 = size.x/2
            var R1 = size.y/2 - R2
        	// R1 = radius of centerline of cross sections (assuming circular ring)
        	// R2 = radius of cross section
            // Axis is vec(1,0,0).
            // Mesh vertices consist of NC oval cross sections.
            // Total points = (NC+1)*(N+1).
        	
            var NC = 60 // number of open cylinders
            var dphi = 2*Math.PI/NC  // going around the ring
            var sinp = Math.sin(dphi), cosp = Math.cos(dphi)
            
			var N = 20   // number of sides of each open cylinder
            var dtheta = 2*Math.PI/N // going around a cross-section, the sides of each cylinder
            var sint = Math.sin(dtheta), cost = Math.cos(dtheta)
            var x=0, z=-R2 // put seam to inside of ring
            var newx, newz
            //var k = 1/Math.cos(dphi/2) // multiply z by k to stretch along the joint; only 1.00121, so approximate by 1
            var tube = [] // list of x,z points in the xz plane representing the tubular shape at a joint
            for (var i=0; i<N+1; i++) {
            	//tube.push(vec(x,0,k*z-k*R2)) 
            	tube.push(vec(x,0,z-R2)) // <0,0> position at outer edge of cross section
            	newx = x*cost + z*sint
            	newz = z*cost - x*sint
            	x = newx
            	z = newz
            }
            
            var y=0, z=-0.5 // put seam to the back
            var newy, newz
        	var pts = []
            var normals = []
            var tans = []
            for (var c=0; c<NC+1; c++) {
            	var r = vec(0, y*size.y, z*size.z) // vector from origin to outer edge of cross section
                var n = vec(0, y, z).norm()  // outward-going unit vector in plane of cross section (note: only approximately normal to outer edge of elliptical ring!)
                var t = vec(0,-z, y).norm()  // unit vector perpendicular to cross section plane in phi direction
                var st = vec(0, -z*size.y, y*size.z) // scaled tangent in phi direction at outer edge of ring
            	var center = r.sub(n.multiply(R2))   // center of cross section
                for (var i=0; i<N+1; i++) {
                	var xc = tube[i].x
                	var zc = tube[i].z
                	var p = vec(xc,0,0).add(n.multiply(zc)).add(r)
                	pts.push(p)
                    normals.push(p.sub(center).norm()) // again only approximately normal to ring surface, but it'll do
                    tans.push(st.add(t.multiply(zc)).norm()) // this is the exact tangent to the ring in the phi direction
                }
            	newy = y*cosp - z*sinp // circulate counterclockwise around axis
            	newz = z*cosp + y*sinp
            	y = newy
            	z = newz
            }
                
            var m = new Mesh()
            var offset = N+1
            for (var c=0; c<NC+1; c++) {
                var s = c*offset
             	for (var i=0; i<offset; i++) {
             		var v0 = pts[s+i]
             		m.pos.push( v0.x,v0.y,v0.z )
             		v0 = normals[s+i]
             		m.normal.push( v0.x,v0.y,v0.z )
                    v0 = tans[s+i]
                    m.bumpaxis.push( v0.x,v0.y,v0.z )

                    m.color.push( 1, 1, 1 )
          		    m.opacity.push( 1 )
          		    m.shininess.push( 1 )
          		    m.emissive.push( 0 )
          		    
          		    m.texpos.push( c/NC, i/N )
          		    
          		    m.index.push( s+i,s+i+offset,s+i+offset+1,   s+i,s+i+offset+1,s+i+1 )
             	}
                m.index.length -= 6 // discard last set of indices
            }
            m.index.length -= 6*(offset-1) // discard entire last band of indices
            return m
        },
        
        makeSphere: function(R, N, hemi) {
            // A UV sphere: vertices are on latitude-longitude lines, total points = (Nlat+1)*(Nlong+1).
            // Points at the poles and the "Date Line" are degenerate (i.e., not "welded").
            // This simplifies the code and might render textures better.
            // The hemi flag creates an "Eastern hemisphere" (x > 0), open on the other side,
            // and is primarily used as an endcap for the curve object.
            // 
            // A scheme which used spherical symmetry didn't save any time and was somewhat harder to read.
            // An improvement would be to offset alternate latitudes by dphi/2 to make equilateral triangles.
            var Nlat = N, Nlong = N   // number of latitude and longitude slices
            var offset = Nlong+1  // index offset to next latitude (seam points are degenerate)
            var dtheta = Math.PI/Nlat   // polar angle (latitude)
            var dphi = 2*Math.PI/Nlong  // azimuthal angle (longitude)
            var sint = Math.sin(dtheta), cost = Math.cos(dtheta)
            var sinp = Math.sin(dphi), cosp = Math.cos(dphi)

            if (hemi) {
            	Nlat = N/2
            	Nlong = 4
            	offset = Nlong+1 // one more because the hemisphere latitude slice doesn't wrap around
            	dtheta = Math.PI/Nlat
            	sint = -Math.sin(dtheta)
				cost = Math.cos(dtheta)
            	dphi = Math.PI/Nlong
            	sinp = Math.sin(dphi)
            	cosp = Math.cos(dphi)
            }
            // sin(theta+dtheta) = sin(theta)*cost + cos(theta)*sint
            // cos(theta+dtheta) = cos(theta)*cost - sin(theta)*sint
            var m = new Mesh()
            var x1, x2, y1, y2, z1, z2, newx1, newz1
            var i, j, s
            x1 = 0
            y1 = R // topmost latitude in this latitude band
            z1 = 0
            for (i=0; i<Nlat+1; i++) {
                s = i*offset // starting index for this latitude band
                x2 = 0
                y2 = y1*cost+z1*sint // bottom latitude in this latitude band
                z2 = z1*cost-y1*sint
                for (j=0; j<offset; j++) { 
                    m.pos.push( x1, y1, z1 )
                    m.normal.push( x1/R, y1/R, z1/R )
                    m.color.push( 1, 1, 1 )
                    m.opacity.push( 1 )
                    m.shininess.push( 1 )
                    m.emissive.push( 0 )
                    m.texpos.push( j/Nlong, 1-i/Nlat )
                    m.bumpaxis.push( z1/R, 0, -x1/R )
                
                    newx1 = x1*cosp+z1*sinp
                    newz1 = z1*cosp-x1*sinp
                    x1 = newx1
                    z1 = newz1
                
                    m.index.push( s+j,s+j+offset,s+j+offset+1, s+j,s+j+offset+1,s+j+1 )
                }
                m.index.length -= 6 // discard last set of indices
                x1 = x2
                y1 = y2
                z1 = z2
            }
            m.index.length -= 6*(offset-1) // discard entire last band of indices
            return m
        },

        makeCone: function(R) {        
            var N = 200 // number of sides of the cone, of radius R=0.5; size is <1,1,1>,  axis is < 1,0,0 >
            // Total number of pos is 3*N+1 = 601 for N = 200 (not smooth enough with N = 100)
            var m = new Mesh()
            m.pos.push( 0, 0, 0 )
            m.normal.push( -1, 0, 0 )
            m.color.push( 1, 1, 1 )
            m.opacity.push( 1 )
            m.shininess.push( 1 )
            m.emissive.push( 0 )
            m.texpos.push( 0.5,0.5 )
            m.bumpaxis.push( 0,0,1 )
            var dtheta = 2*Math.PI/N
            var sind = Math.sin(dtheta), cosd = Math.cos(dtheta)
            var k = 1/(R*Math.sqrt(5))
            // sin(theta+dtheta) = sin(theta)*cosd + cos(theta)*sind, so newy = y*cosd + z*sind
            // cos(theta+dtheta) = cos(theta)*cosd - sin(theta)*sind, so newz = z*cosd - y*sind
            var y = 0, z = -R
            var newy, newz
            for (var i=1; i<=1+3*N; i+=3) {
                newy = y*cosd + z*sind
                newz = z*cosd - y*sind
            
                m.pos.push( 0,y,z,  0,y,z,      1,0,0 )
                
                m.normal.push( -1,0,0,  k*R,2*k*y,2*k*z,  k*R,2*k*(y+newy)/2,2*k*(z+newz)/2 )
                
                m.color.push( 1,1,1,  1,1,1,  1,1,1 )
                
                m.opacity.push( 1,  1,  1 )
                
                m.shininess.push( 1, 1, 1 )
                
                m.emissive.push( 0, 0, 0 )
                
                m.texpos.push( 0.5*(1+z/R),0.5*(1+y/R), 1-(i-1)/N/3,0,  1-(i-1)/N/3,1 )
                
                m.bumpaxis.push( 0,0,1,  0,-z/R,y/R,  0,-z/R,y/R )
                 
                if (i != 1+3*N) m.index.push( 0,i,i+3,  i+1,i+2,i+4  )
            
                y = newy
                z = newz
            }
            return m
        },

        makePyramid: function() {
            // pyramid has base that is length (x=1) by width (z=1) by height (y=1); size is <1,1,1>,  axis is < 1,0,0 >
            var m = new Mesh()
            var k = 1/Math.sqrt(5)
            m.pos.push(
                    0,.5,.5,   0,.5,-.5,  0,-.5,-.5,  0,-.5,.5,  // base (on left)
                    0,.5,-.5,   0,.5,.5,    1,0,0,  // top
                    0,-.5,-.5,  0,.5,-.5,   1,0,0,  // back
                    0,-.5,.5,   0,-.5,-.5,  1,0,0,  // bottom
                    0,.5,.5,    0,-.5,.5,   1,0,0 ) // front
            m.normal.push(
                    -1,0,0,  -1,0,0,  -1,0,0,  -1,0,0,  // base (on left)
                    k,2*k,0,   k,2*k,0,   k,2*k,0,  // top
                    k,0,-2*k,  k,0,-2*k,  k,0,-2*k, // back
                    k,-2*k,0,  k,-2*k,0,  k,-2*k,0, // bottom
                    k,0,2*k,   k,0,2*k,   k,0,2*k ) // front
            m.color.push(
            		1,1,1,  1,1,1,  1,1,1,  1,1,1,
            		1,1,1,  1,1,1,  1,1,1,
            		1,1,1,  1,1,1,  1,1,1,
            		1,1,1,  1,1,1,  1,1,1,
            		1,1,1,  1,1,1,  1,1,1)
            m.opacity.push(
            		1,  1,  1,  1,
            		1,  1,  1,
            		1,  1,  1,
            		1,  1,  1,
            		1,  1,  1 )
            m.shininess.push(
                    1,  1,  1,  1,
                    1,  1,  1,
                    1,  1,  1,
                    1,  1,  1,
                    1,  1,  1 )
             m.emissive.push(
                    0,  0,  0,  0,
                    0,  0,  0,
                    0,  0,  0,
                    0,  0,  0,
                    0,  0,  0 )
            m.texpos.push( 1,1, 0,1, 0,0, 1,0,           // base (on left) 
            				0,0,    0.25,0,   0.125,1,    // top
            				1,0,    0.75,0,   0.875,1,    // back
            				0.5,0,  0.75,0,   0.625,1,    // bottom
            				0.25,0, 0.5,0,    0.375,1 )   // front
            m.bumpaxis.push( 0,0,1, 0,0,1, 0,0,1, 0,0,1,     // base (on left)  
   				 			 0,0,1,  0,0,1,  0,0,1,          // top
            				 0,1,0,  0,1,0,  0,1,0,          // back  
            				 0,0,-1, 0,0,-1, 0,0,-1,         // bottom
            				 0,-1,0, 0,-1,0, 0,-1,0  )       // front
            m.index.push(0,1,2,  0,2,3,  4,5,6,  7,8,9,  10,11,12,  13,14,15)
            return m
        },
        
        makeCurveSegment: function(R) {
            // A low-triangle-count cylinder with a hemisphere at one end, to be rendered using the "curve_vertex" program
            // which will stretch the cylinder, but not the hemisphere, over the length of the segment.  To make this possible,
            // we provide 4D pos x,y,z,w, with w=0 being the beginning of the segment and w=1 the end. The position of a
        	// vertex with w=0 is relative to the beginning of the segment. The position of a vertex with w=1 is relative
        	// to the center of the hemisphere at the end of the segment. For example, x=0, y=0, z=0 with w=1 is the center
        	// of the hemisphere, whereas x=0, y=0, z=0 with w=0 is the center of the beginning of the segment.

            // An open-ended low-triangle-count cylinder for segments of a curve object
            var N = 16 // number of sides of the cylinder, of radius 1 and axis < 1,0,0 >
            // Total number of pos is 2*N = 32 for N = 16
            var dtheta = 2*Math.PI/N
            var sind = Math.sin(dtheta), cosd = Math.cos(dtheta)
            // sin(theta+dtheta) = sin(theta)*cosd + cos(theta)*sind, so newy = y*cosd + z*sind
            // cos(theta+dtheta) = cos(theta)*cosd - sin(theta)*sind, so newz = z*cosd - y*sind
            var y = 0, z = -R
            var newy, newz
            var m = new Mesh()
            for (var i=0; i<=2*N; i+=2) {
            
                m.pos.push( 0,y,z,0,  0,y,z,1 )
                m.normal.push(  0,y,z,  0,y,z )
                m.color.push( 1,1,1,  1,1,1 )
                m.opacity.push( 1, 1 )
                m.shininess.push ( 1, 1 )
                m.emissive.push( 0, 0 )
                m.texpos.push( 0,0, 0,0 ) // no textures or bumpmaps currently for curve points
                m.bumpaxis.push( 0,0,0, 0,0,0 )

                if (i != 2*N) m.index.push( i,i+2,i+1,  i+1,i+2,i+3  )
                
                newy = y*cosd + z*sind
                newz = z*cosd - y*sind
                y = newy
                z = newz
            }
            
            var offset = m.pos.length/4 // add sphere data to cylinder data
            var sph = Mesh.makeSphere(R, N, true) // make rightmost hemisphere
            var L = sph.pos.length/3
            for(var i=0; i<L; i++) {
                m.pos.push( sph.pos[3*i], sph.pos[3*i+1], sph.pos[3*i+2], 1 )
                m.normal.push(sph.normal[3*i], sph.normal[3*i+1], sph.normal[3*i+2])
                m.color.push(1, 1, 1)
                m.opacity.push(1)
                m.shininess.push ( 1 )
                m.emissive.push( 0 )
                m.texpos.push( sph.texpos[2*i], sph.texpos[2*i+1] )
                m.bumpaxis.push( sph.bumpaxis[3*i], sph.bumpaxis[3*i+1], sph.bumpaxis[3*i+2] )
            }
            for(var i=0; i<sph.index.length; i++)
                m.index.push(sph.index[i] + offset)
            return m
        }
    })

    var exports = {
        Mesh:Mesh
        }

    Export(exports)
})()
