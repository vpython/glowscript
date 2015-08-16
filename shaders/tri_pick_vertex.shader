// Vertex shader for picking triangles

#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

attribute vec3 pos;
attribute vec4 color;

uniform mat4 viewMatrix;
uniform mat4 projMatrix;

varying vec4 vcolor;

void main(void) {
    gl_Position = projMatrix * viewMatrix * vec4( pos, 1.0);
    vcolor = color;
}
