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
attribute float shininess;
attribute float emissive;
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

varying vec3 es_position;     // eye space surface position
varying vec3 es_normal;       // eye space surface normal
varying vec2 mat_pos;         // surface material position in [0,1]^2
varying vec4 vcolor;
varying vec3 bumpX;
varying vec4 parameters; // shininess, emissive, hasTexture, hasBump, flipx, flipy, turn

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
    vec3 ws_pos = rot*(objectScale*pos) + objectPos;
    vec4 pos4 = viewMatrix * vec4( ws_pos, 1.0);
    es_position = pos4.xyz;
    es_normal = (viewMatrix * vec4(rot*(normal/objectScale), 0.0)).xyz;
    gl_Position = projMatrix * pos4;
    bumpX = (viewMatrix * vec4(rot*bumpaxis, 0.0)).xyz;
    mat_pos = texpos;
    vcolor = vec4(color*objectColor.rgb, opacity*objectColor.a);
    
    float f = flags; // turn, flipy, flipx, sides, right, left, bumpmap, texture
    float turn = floor(f/128.0);
    f -= 128.0*turn;
    float flipy = floor(f/64.0);
    f -= 64.0*flipy;
    float flipx = floor(f/32.0);
    f -= 32.0*flipx;
    float sides = floor(f/16.0);
    f -= 16.0*sides;
    float right = floor(f/8.0);
    f -= 8.0*right;
    float left = floor(f/4.0);
    f -= 4.0*left;
    float B = floor(f/2.0);
    f -= 2.0*B;
    float T = f;
    if (T != 0.0) {
        if (flipx != 0.0) {
            mat_pos.x = 1.0 - mat_pos.x;
        }
        if (flipy != 0.0) {
            mat_pos.y = 1.0 - mat_pos.y;
        }
        if (turn > 0.0 && turn <= 3.0) {
            if (turn == 1.0) {
                mat_pos = vec2(mat_pos.y,1.0 - mat_pos.x);
            } else if (turn == 2.0) {
                mat_pos = vec2(1.0 - mat_pos.x,1.0 - mat_pos.y);
            } else {
                mat_pos = vec2(1.0 - mat_pos.y,mat_pos.x);
            }
        }
        T = 0.0;
        bool L = (normal.x == -1.0);
        bool R = (normal.x == 1.0);
        bool S = !L && !R;
        if (L && left == 1.0) T = 1.0;
        if (R && right == 1.0) T = 1.0;
        if (S && sides == 1.0) T = 1.0;
        if (T == 0.0) {
            B = 0.0;
        } else if (left == 0.0 || right == 0.0 || sides == 0.0) {
            // don't mix texture and object color if texture doesn't cover entire object
            vcolor = vec4(1.0, 1.0, 1.0, 1.0);
        }
    }
    float emit = 0.0;
    if (objectEmissive != 0.0) emit = 1.0;
    if (emissive != 0.0) emit = 1.0;
    parameters = vec4(objectShininess * shininess, emit, T, B);
}
