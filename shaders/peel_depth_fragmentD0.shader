#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

// Construct depth maps for depth peeling handling of opacity

// minormode = 0 render, 1 pick, 2 autoscale, 4 C0, 5 D0, 6 C1, 7 D1, 8 C2, 9 D2, 10 C3, 11 D3, 12 C4

ivec4 encode(float k) { // assumes k is >= 0
    if (k <= 0.0) return ivec4(0, 0, 0, 0);
    k = 3.0*128.0*k;
    int b1 = int(k);
    int b2 = int(256.0*fract(k));
    return ivec4(
    	b1,
    	b2,
    	0,
    	0);
}

void main(void) {
    // create depth map D0 (5)
    ivec4 c = encode(1.0 - gl_FragCoord.z);
    gl_FragColor = vec4(float(c.r)/255.0, float(c.g)/255.0, 0, 0);
}