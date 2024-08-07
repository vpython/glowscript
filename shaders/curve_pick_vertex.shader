#version 300 es

in vec4 pos;       // pos.w is 0 at the beginning of the segment and 1 at the end; 
                          // pos.xyz are relative to that end in an normal basis with x pointing along the segment and scaled by radius

uniform vec4 objectData[5];
#define objectPos objectData[0].xyz
#define objectShininess objectData[0].w
#define objectAxis objectData[1].xyz
#define objectEmissive objectData[1].w
#define objectUp objectData[2].xyz
#define flags objectData[2].w
#define objectScale objectData[3].xyz
#define objectRadius objectData[3].w
#define objectColor objectData[4].rgb

uniform vec4 segmentData[4];
#define segmentPosR(i) segmentData[i]
#define segmentColor(i) segmentData[2+i]

uniform mat4 viewMatrix;
uniform mat4 projMatrix;

out vec4 vcolor;

vec4 start;
vec4 end;

mat3 getObjectRotation() { // Construct the object rotation matrix.
    // Divide objectAxis by its largest component before normalizing,
    // to avoid problems with very large or very small magnitudes.
    float vmax = max( max( abs(objectAxis.x), abs(objectAxis.y) ), abs(objectAxis.z) );
    vec3 X = normalize(objectAxis/vmax);
    vec3 Y = normalize(objectUp);
    // Note that axis and up are kept perpendicular to each other by CPU code.
    return mat3( X, Y, cross(X,Y));
}

mat3 getSegmentRotation() {
    // Construct the object rotation matrix.
    vec3 v = end.xyz - start.xyz;
    float vmax = max( max( abs(v.x), abs(v.y) ), abs(v.z) );
    vec3 X = normalize(v/vmax);
    vec3 Z = cross(X,normalize(objectUp));
    if ( dot(Z,Z) < 1e-10 ) {
        Z = cross(X, vec3(1,0,0));
        if (dot(Z,Z) < 1e-10 ) {
            Z = cross(X, vec3(0,1,0));
        }
    }
    Z = normalize(Z);
    return mat3( X, normalize(cross(Z,X)), Z );
}

void main(void) {
    vec4 start_color = segmentColor(0);
    vec4 end_color = segmentColor(1);
    if (start_color.r < 0.0) start_color.rgb = objectColor;
    if (end_color.r < 0.0) end_color.rgb = objectColor.rgb;
    
    // The following code looks very clumsy, but all other more sensible schemes 
    // failed due to what might be bugs in shader compiling or execution.
    // Specifically, trying to set start or end inside the if statement fails
    // if the curve radius is less than about 1e-7 !!??
    float sw = 0.0;
    if (segmentPosR(0).w < 0.0) {
        sw = 1.0;
    }
    start = vec4(segmentPosR(0).xyz, sw*objectRadius + (1.0-sw)*segmentPosR(0).w);
    sw = 0.0;
    if (segmentPosR(1).w < 0.0) {
        sw = 1.0;
    }
    end = vec4(segmentPosR(1).xyz, sw*objectRadius + (1.0-sw)*segmentPosR(1).w);
    
    mat3 rotObject = getObjectRotation();
    start.xyz = rotObject*(objectScale*start.xyz) + objectPos;
    end.xyz = rotObject*(objectScale*end.xyz) + objectPos;

    // A rotation matrix with x pointed along the segment
    mat3 rot = getSegmentRotation();

    // The position and radius of "this" end of the segment in world space
    vec4 ws_segmentEnd = start * (1.-pos.w) + end * pos.w;

    // The position of this vertex in world space
    vec3 ws_pos = ws_segmentEnd.xyz + rot * (ws_segmentEnd.w*pos.xyz);

    vec4 pos4 = viewMatrix * vec4( ws_pos, 1.0);
    vcolor = start_color * (1.-pos.w) + end_color * pos.w;
    gl_Position = projMatrix * pos4;
}
