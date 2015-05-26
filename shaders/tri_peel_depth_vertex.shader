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

varying vec3 es_position;     // eye space surface position
varying vec3 es_normal;       // eye space surface normal

void main(void) {
    vec4 pos4 = viewMatrix * vec4( pos, 1.0);
    vec4 posp = projMatrix * pos4;
    gl_Position = posp;
}
