#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

uniform sampler2D FINAL;
varying vec2 mat_pos;

void main(void) {
    gl_FragColor = vec4( texture2D(FINAL, mat_pos).xyz, 1.0);
}
