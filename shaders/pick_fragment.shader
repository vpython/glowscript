#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

varying vec4 vcolor;

void main(void) {
    gl_FragColor = vcolor;
}
