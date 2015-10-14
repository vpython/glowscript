// Vertex shader for picking standard 'objects' parameterized by
// pos, axis, up, size, color

#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

attribute vec3 pos;
attribute vec3 normal;

uniform vec4 objectData[5];
#define objectPos objectData[0].xyz
#define objectAxis objectData[1].xyz
#define objectUp objectData[2].xyz
#define objectScale objectData[3].xyz
#define objectColor objectData[4].rgba

uniform mat4 viewMatrix;
uniform mat4 projMatrix;

varying vec4 vcolor;

mat3 getObjectRotation() {
    // Construct the object rotation matrix.
    float vmax = max( max( abs(objectAxis.x), abs(objectAxis.y) ), abs(objectAxis.z) );
    vec3 X = normalize(objectAxis/vmax);
    vec3 Z = cross(X,normalize(objectUp));
    if ( dot(Z,Z) < 1e-10 ) {
        Z = cross(X, vec3(1,0,0));
        if (dot(Z,Z) < 1e-10 ) {
            Z = cross(X, vec3(0,1,0));
        }
    }
    Z = normalize(Z);
    return mat3( X, normalize(cross(Z,X)), Z );
}

void main(void) {
	mat3 rot = getObjectRotation();
	// See mesh.js for details on mesh; default radius of cross section is 0.05 (default outer radius is 0.5)
    vec3 r = normal*objectScale;           // from center of ring to outer edge of circular cross section
    vec3 n = normalize(r/objectScale);     // lies in the plane of the cross section at this location, perpendicular to outer edge
    vec3 adjpos = r + (objectScale.x/0.1)*(pos.x*vec3(1,0,0) + pos.z*n);    // vertex in world coordinates
    
    vec3 ws_pos = rot*(adjpos) + objectPos;  // point in world space
    vec4 pos4 = viewMatrix * vec4( ws_pos, 1.0);
    gl_Position = projMatrix * pos4;
    vcolor = objectColor;
}
