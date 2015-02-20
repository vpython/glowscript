#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

// Construct depth maps for depth peeling handling of opacity

uniform vec2 canvas_size;
uniform sampler2D D0; // TEXTURE3 - opaque depth map (minormode 5)
uniform sampler2D D1; // TEXTURE4 - 1st transparency depth map (minormode 6)

// minormode = 0 render, 1 pick, 2 autoscale, 4 C0, 5 D0, 6 D1, 7 D2, 8 D3, 9 C1, 10 C2, 11 C3, 12 C4

vec4 encode(float k) { // assumes k is >= 0 and k < 1.0
    if (k <= 0.0) return vec4(0.0, 0.0, 0.0, 0.0);
    return vec4(
        floor(256.0*k)/255.0,
        floor(256.0*fract(256.0*k))/255.0,
        0.0,
        0.0);
}

float decode(vec4 d) {
    if (length(d) == 0.0) return 0.0;
    return 255.0*(d[0] + d[1]/256.0)/256.0;
}

void main(void) {
    // create depth map D2 (7)
    float z = 1.0 - gl_FragCoord.z;
    vec4 c = encode(z);
    vec2 loc = vec2(gl_FragCoord.x/canvas_size.x, gl_FragCoord.y/canvas_size.y);
    float zmin = decode(texture2D(D0, loc));
    float zmax = decode(texture2D(D1, loc));
    if (zmin < z && z < zmax) {
    	gl_FragColor = c;
    } else {
        discard;
    }
}