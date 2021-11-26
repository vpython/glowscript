#version 300 es
// Vertex shader for rendering standard 'objects' parameterized by
// pos, axis, up, size, color

in vec3 pos;

void main(void) {
    gl_Position = vec4(pos, 1.0);
}
