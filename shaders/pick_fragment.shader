#version 300 es
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif

in vec4 vcolor;

out vec4 output_color;

void main(void) {
    output_color = vcolor;
}
