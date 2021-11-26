#version 300 es
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif

uniform int light_count;
uniform vec4 light_pos[32];
uniform vec3 light_color[32];
uniform vec3 light_ambient;
#define LP(i) light_pos[i]
#define LC(i) light_color[i]
uniform vec2 canvas_size;

uniform sampler2D texmap;  // TEXTURE0 - user texture
uniform sampler2D bumpmap; // TEXTURE1 - user bumpmap

in vec3 es_position;     // eye space surface position
in vec3 es_normal;       // eye space surface normal
in vec2 mat_pos;         // surface material position in [0,1]^2
in vec4 vcolor;
in vec3 bumpX;
in vec4 parameters; // shininess, emissive, hasTexture, hasBump
#define shininess parameters[0]
#define emissive parameters[1]
#define hasTexture parameters[2]
#define hasBump parameters[3]

vec3 normal;
vec3 pos;
vec3 diffuse_color;
vec3 specular_color;
vec3 color;

out vec4 output_color;

void calc_color(vec4 lpos, vec3 lcolor)
{
    vec3 L = lpos.xyz - pos*lpos.w; // w == 0 for distant_light
    L = normalize(L);
    float N = max(dot(normal,L), 0.0);
    color += (lcolor * N)*diffuse_color;
    if (shininess > 0.0) {
        vec3 R = reflect(L,normal);
        color += specular_color * lcolor * pow(max(dot(R,normalize(pos)),0.0),100.0*shininess);
    }
}

// Return lit surface color based on the given surface properties and the lights
//   specified by the light_* uniforms.
void lightAt()
{    
    if (hasTexture != 0.0) {
        diffuse_color = diffuse_color * texture(texmap, mat_pos).xyz;
    }
    if (hasBump != 0.0) {
        vec3 Y = cross(normal, bumpX);
        vec3 Nb = texture(bumpmap, mat_pos).xyz;
        Nb = 2.0*Nb - 1.0;
        normal = normalize(Nb.x*bumpX + Nb.y*Y + Nb.z*normal);
    }
    if (emissive != 0.0) {
        // From VPython materials.emissive:
        float d = dot(normalize(-pos), normal);
        d = pow(d * 1.5, 0.4) * 1.1;
        if (d > 1.0) d = 1.0;
        color = diffuse_color * d;
        return;
    }
    
    color = light_ambient * diffuse_color;

    for (int i=0; i<100; i++) { // for cannot test against a variable
        if (i == light_count) break;
        calc_color(LP(i), LC(i));
    }
}

void main(void) {
    normal = normalize(es_normal);
    pos = es_position;
    diffuse_color = vcolor.rgb;
    specular_color = vec3(.8,.8,.8);
    lightAt(); // determine color from lighting
    output_color = vec4( color, 1.0 );
}
