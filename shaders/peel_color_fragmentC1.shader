#ifdef GL_ES
#  ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#  else
precision mediump float;
#  endif
#endif

uniform int light_count;
uniform vec4 light_pos[8];
uniform vec3 light_color[8];
uniform vec3 light_ambient;
#define LP(i) light_pos[i]
#define LC(i) light_color[i]
uniform vec2 canvas_size;

uniform sampler2D texmap;  // TEXTURE0 - user texture
uniform sampler2D bumpmap; // TEXTURE1 - user bumpmap
uniform sampler2D D0; // TEXTURE3 - opaque depth map (minormode 5)

varying vec3 es_position;     // eye space surface position
varying vec3 es_normal;       // eye space surface normal
varying vec2 mat_pos;         // surface material position in [0,1]^2
varying vec4 vcolor;
varying vec3 bumpX;
varying vec4 parameters; // shininess, emissive, hasTexture, hasBump
#define shininess parameters[0]
#define emissive parameters[1]
#define hasTexture parameters[2]
#define hasBump parameters[3]

vec3 normal;
vec3 pos;
vec3 diffuse_color;
vec3 specular_color;
vec3 color;

void calc_color(vec4 lpos, vec3 lcolor)
{
    vec3 L = lpos.xyz - pos*lpos.w; // w == 0 for distant_light
    L = normalize(L);
    float N = max(dot(normal,L), 0.0);
    color += (lcolor * N)*diffuse_color;
    if (shininess > 0.0) {
        vec3 R = reflect(L,normal);
        color += specular_color * LC(0) * pow(max(dot(R,normalize(pos)),0.0),100.0*shininess);
    }
}

// Return lit surface color based on the given surface properties and the lights
//   specified by the light_* uniforms.
void lightAt()
{    
    if (hasTexture != 0.0) {
        diffuse_color = diffuse_color * texture2D(texmap, mat_pos).xyz;
    }
    if (hasBump != 0.0) {
        vec3 Y = cross(normal, bumpX);
        vec3 Nb = texture2D(bumpmap, mat_pos).xyz;
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
    
    // It was necessary to restructure this shader completely in order to
    // run on the Samsung Galaxy S3 smartphone. Apparently its compiler
    // does not handle for loops correctly. An Asus Android tablet was ok.
    if (light_count == 0) return;
    calc_color(LP(0), LC(0));
    if (light_count == 1) return;
    calc_color(LP(1), LC(1));
    if (light_count == 2) return;
    calc_color(LP(2), LC(2));
    if (light_count == 3) return;
    calc_color(LP(3), LC(3));
    if (light_count == 4) return;
    calc_color(LP(4), LC(4));
    if (light_count == 5) return;
    calc_color(LP(5), LC(5));
    if (light_count == 6) return;
    calc_color(LP(6), LC(6));
    if (light_count == 7) return;
    calc_color(LP(7), LC(7));
}

ivec4 encode(float k) { // assumes k is >= 0
    if (k <= 0.0) return ivec4(0, 0, 0, 0);
    k = 3.0*128.0*k;
    int b1 = int(k);
    int b2 = int(256.0*fract(k));
    return ivec4(
    	b1,
    	b2,
    	0,
    	0);
}

int decode(ivec4 d) {
    return int(256*d[0] + d[1]);
}

int fdecode(vec4 d) {
    return int(255.0*(256.0*d[0] + d[1]));
}

void main(void) {
    // create transparency color map - C1 (minormode 6), C2 (8), C3 (19), C4 (12)
    ivec4 c = encode(1.0 - gl_FragCoord.z);
    int z = decode(c);
    vec2 loc = vec2(gl_FragCoord.x/canvas_size.x, gl_FragCoord.y/canvas_size.y);
    int zmin = fdecode(texture2D(D0, loc));

    normal = normalize(es_normal);
    pos = es_position;
    diffuse_color = vcolor.rgb;
    specular_color = vec3(.8,.8,.8);
    lightAt(); // determine color from lighting
	
	if (zmin < z) {
        gl_FragColor = vec4( color, vcolor.a );
    } else {
    	discard;
    }
}
