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
#define objectShininess objectData[0].w
#define objectAxis objectData[1].xyz
#define objectEmissive objectData[1].w
#define objectUp objectData[2].xyz
#define flags objectData[2].w
#define objectScale objectData[3].xyz
#define objectColor objectData[4].rgba

uniform mat4 viewMatrix;
uniform mat4 projMatrix;

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
    float zmodel = 0.5;  // default 0.5*size.z (outer radius of ring): ring mesh made with R1=0.5-0.05, R2=0.05
    float xmodel = 0.05; // default 0.5*size.x (radius of cross section of ring)
    float R2 = 0.5*objectScale.x;                                   // R2 = radius of cross section
    float R1 = 0.5*objectScale.z - R2;                              // R1 = radius of centerline of ring
    vec3 Rproj = vec3(0.0,pos.y,pos.z);                             // from center to projection of point in yz plane
    vec3 Rhat = normalize(Rproj);                                   // unit vector from center to yz projection of pos
    vec3 xhat = vec3(1.0,0.0,0.0);                                  // unit vector in direction of axis of ring
    float yz = (length(Rproj) - (zmodel - xmodel))*R2/xmodel;
    vec3 adjpos = (R2*pos.x/xmodel)*xhat +  (R1 + yz)*Rhat;         // adjusted point in model space
    vec3 ws_pos = rot*(adjpos) + objectPos;                         // point in world space
    
    vec4 pos4 = viewMatrix * vec4( ws_pos, 1.0);
    gl_Position = projMatrix * pos4;
}
