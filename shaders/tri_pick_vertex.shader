#version 300 es
// Vertex shader for picking triangles

#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif

in vec3 pos;
in vec4 color;

uniform mat4 viewMatrix;
uniform mat4 projMatrix;

out vec4 vcolor;

void main(void) {
    gl_Position = projMatrix * viewMatrix * vec4( pos, 1.0);
    vcolor = color;
}
