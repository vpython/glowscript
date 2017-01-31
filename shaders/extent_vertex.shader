// Vertex shader for rendering standard 'objects' parameterized by
// pos, axis, up, scale, color

#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

attribute vec3 pos;
attribute vec3 normal;
attribute vec3 color;
attribute float opacity;
attribute vec2 texpos;
attribute vec3 bumpaxis;

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
uniform vec3 center;

varying vec3 es_position;     // eye space surface position
varying vec3 es_normal;       // eye space surface normal
varying vec2 mat_pos;         // surface material position in [0,1]^2
varying vec4 vcolor;
varying vec3 bumpX;
varying vec4 parameters; // shininess, emissive, hasTexture, hasBump, flipx, flipy, turn

vec3 encode_float(float k) { // assumes k is >= 0
    if (k <= 0.0) return vec3(0.0, 0.0, 0.0);
    float logk = log(k);
    if (logk < 0.0) {
        logk = -logk + 128.0;
    }
    return vec3(
        floor(logk)/255.0,
        floor(256.0*fract(logk))/255.0,
        floor(256.0*fract(256.0*logk))/255.0);
}

mat3 getObjectRotation() { // Construct the object rotation matrix.
    // Divide objectAxis by its largest component before normalizing,
    // to avoid problems with very large or very small magnitudes.
    float vmax = max( max( abs(objectAxis.x), abs(objectAxis.y) ), abs(objectAxis.z) );
    vec3 X = normalize(objectAxis/vmax);
    vec3 Y = normalize(objectUp);
    // Note that axis and up are kept perpendicular to each other by CPU code.
    return mat3( X, Y, cross(X,Y));
}

void main(void) {
    mat3 rot = getObjectRotation();
    // The position of this vertex in world space
    vec3 ws_pos = rot*(objectScale*position) + objectPos;
    vec4 pos4 = viewMatrix * vec4( ws_pos, 1.0);
    es_position = pos4.xyz;
    es_normal = (viewMatrix * vec4(rot*(normal/objectScale), 0.0)).xyz;
    //gl_Position = posp;
    bumpX = (viewMatrix * vec4(rot*bumpaxis, 0.0)).xyz;
    mat_pos = texpos;
    float extent = abs(ws_pos.x-center.x);
    extent = max(abs(ws_pos.y-center.y), extent);
    extent = max(abs(ws_pos.z-center.z), extent);
    mat_color = vec4(encode_float(extent), 1.0);
    // Setting gl_Position.xy to (-1.0, -1.0) should store into pixel (0, 0), but doesn't work:
    gl_Position = vec4(-1.0, -1.0, 1e-20*extent, 1.0);

    parameters = vec4(objectShininess, objectEmissive, 0.0, 0.0);
}
