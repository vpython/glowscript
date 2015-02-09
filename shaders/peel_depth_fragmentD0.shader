#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

// Construct depth maps for depth peeling handling of opacity

uniform vec2 canvas_size;

// minormode = 0 render, 1 pick, 2 autoscale, 4 C0, 5 D0, 6 D1, 7 D2, 8 D3, 9 C1, 10 C2, 11 C3, 12 C4
uniform int minormode;

vec4 encode(float k) { // assumes k is >= 0
    if (k <= 0.0) return vec4(0.0, 0.0, 0.0, 0.0);
    return vec4(
        floor(256.0*k)/255.0,
        floor(256.0*fract(256.0*k))/255.0,
        0.0,
        0.0);
}


void main(void) {
    // create depth map D0 (5)
    vec4 c = encode(1.0 - gl_FragCoord.z);
    gl_FragColor = c;
}