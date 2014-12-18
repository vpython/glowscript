// Vertex shader for rendering standard 'objects' parameterized by
// pos, axis, up, size, color

#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

attribute vec3 pos;

void main(void) {
    gl_Position = vec4(pos, 1.0);
}
