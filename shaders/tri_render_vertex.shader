#version 300 es
// Vertex shader for rendering triangles

#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif

in vec3 pos;
in vec3 normal;
in vec3 color;
in float opacity;
in float shininess;
in float emissive;
in vec2 texpos;
in vec3 bumpaxis;

uniform mat4 viewMatrix;
uniform mat4 projMatrix;
uniform float T; // 1.0 if there is a texture, else 0.0
uniform float B; // 1.0 if there is a bumpmap, else 0.0

out vec3 es_position;     // eye space surface position
out vec3 es_normal;       // eye space surface normal
out vec2 mat_pos;         // surface material position in [0,1]^2
out vec4 vcolor;
out vec3 bumpX;
out vec4 parameters; // shininess, emissive, hasTexture, hasBump

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
