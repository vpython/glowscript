#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

uniform sampler2D C0; // TEXTURE2 - opaque color map (minormode 4)
uniform sampler2D C1; // TEXTURE4 - color map for transparency render 1 (minormode 6)
uniform sampler2D C2; // TEXTURE6 - color map for transparency render 2 (minormode 8)
uniform sampler2D C3; // TEXTURE8 - color map for transparency render 3 (minormode 10)
uniform sampler2D C4; // TEXTURE10 - color map for transparency render 4 (minormode 12)
uniform vec2 canvas_size;

void main(void) {
    // need to combine colors from C0, C1, C2, C3, C4
    vec2 loc = vec2( gl_FragCoord.x/canvas_size.x, gl_FragCoord.y/canvas_size.y);
    vec4 c0 = texture2D(C0, loc);
    vec4 c1 = texture2D(C1, loc);
    vec4 c2 = texture2D(C2, loc);
    vec4 c3 = texture2D(C3, loc);
    vec4 c4 = texture2D(C4, loc);
    
    vec3 mcolor = c1.rgb*c1.a + 
                 (1.0-c1.a)*(c2.rgb*c2.a +
                 (1.0-c2.a)*(c3.rgb*c3.a +
                 (1.0-c3.a)*(c4.rgb*c4.a + 
                 (1.0-c4.a)*c0.rgb)));
    gl_FragColor = vec4 (mcolor, 1.0);
}
