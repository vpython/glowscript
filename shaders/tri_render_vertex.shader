// Vertex shader for rendering triangles

#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

attribute vec3 pos;
attribute vec3 normal;
attribute vec3 color;
attribute float opacity;
attribute float shininess;
attribute float emissive;
attribute vec2 texpos;
attribute vec3 bumpaxis;

uniform mat4 viewMatrix;
uniform mat4 projMatrix;
uniform float T; // 1.0 if there is a texture, else 0.0
uniform float B; // 1.0 if there is a bumpmap, else 0.0

varying vec3 es_position;     // eye space surface position
varying vec3 es_normal;       // eye space surface normal
varying vec2 mat_pos;         // surface material position in [0,1]^2
varying vec4 vcolor;
varying vec3 bumpX;
varying vec4 parameters; // shininess, emissive, hasTexture, hasBump

void main(void) {
    vec4 pos4 = viewMatrix * vec4( pos, 1.0);
    es_position = pos4.xyz;
    es_normal = (viewMatrix * vec4(normal, 0.0)).xyz;
    gl_Position = projMatrix * pos4;
    bumpX = (viewMatrix * vec4(bumpaxis, 0.0)).xyz;
    mat_pos = texpos;
    vcolor = vec4(color, opacity);
    parameters = vec4(shininess, emissive, T, B);
}
