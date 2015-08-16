// Vertex shader for rendering triangles

#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

attribute vec3 pos;

uniform mat4 viewMatrix;
uniform mat4 projMatrix;

void main(void) {
    gl_Position = projMatrix * viewMatrix * vec4( pos, 1.0);
}
