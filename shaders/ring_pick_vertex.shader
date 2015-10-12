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
    // Adjust model pos based on specified R1 and R2 of ring
    float R1 = 0.5;                          // radius of centerline of model
    float R2 = 0.05;                         // radius of cross-section of model
    vec3 Rp = vec3(0.0,pos.y,pos.z);         // from center of ring to projection of model vertex onto yz plane
    vec3 r1 = R1*normalize(Rp);              // from center of ring to outer edge of model in yz plane
    vec3 rc1 = (R1-R2)*normalize(Rp);        // from center of ring to centerline
    vec3 r2 = r1*objectScale;                // resize the circular centerline to an ellipse in yz plane
    vec3 nr2 = normalize(r2);
    vec3 rc2 = (length(r2)-0.5*objectScale.x)*nr2; // from center of ring to centerline, world coordinates
    vec3 adjpos = rc2 + 0.5*objectScale.x*(pos.x*vec3(1,0,0) + dot(Rp-rc1,normalize(Rp))*nr2)/R2; // world coordinates
    vec3 N = adjpos - rc2;                   // normal, world coordinates
    
    vec3 ws_pos = rot*(adjpos) + objectPos;  // point in world space
    vec4 pos4 = viewMatrix * vec4( ws_pos, 1.0);
    gl_Position = projMatrix * pos4;
    vcolor = objectColor;
}
