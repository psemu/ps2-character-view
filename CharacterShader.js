
THREE.CharacterShader = {

	uniforms: THREE.UniformsUtils.merge( [

		THREE.UniformsLib[ "fog" ],
		THREE.UniformsLib[ "lights" ],
		THREE.UniformsLib[ "shadowmap" ],

		{

		"enableAO"          : { type: "i", value: 0 },
		"enableDiffuse"     : { type: "i", value: 0 },
		"enableSpecular"    : { type: "i", value: 0 },
		"enableReflection"  : { type: "i", value: 0 },
		"enableDisplacement": { type: "i", value: 0 },
		"enableTint"        : { type: "i", value: 0 },
		"enableBump"        : { type: "i", value: 0 },
		"enableDetailBump"  : { type: "i", value: 0 },

		"detailBumpiness" : { type: "f", value: 0.0 },
		"detailFrequency" : { type: "f", value: 1.0 },

		"tDisplacement": { type: "t", value: null }, // must go first as this is vertex texture
		"tDiffuse"     : { type: "t", value: null },
		"tCube"        : { type: "t", value: null },
		"tNormal"      : { type: "t", value: null },
		"tSpecular"    : { type: "t", value: null },
		"tAO"          : { type: "t", value: null },
		"tTint"        : { type: "t", value: null },
		"tDetailBump"  : { type: "t", value: null },
		"tDetailMask"  : { type: "t", value: null },

		"uTintScale" : { type: "f", value: 3.0 },

		"uNormalScale": { type: "v2", value: new THREE.Vector2( 1, 1 ) },

		"uDisplacementBias": { type: "f", value: 0.0 },
		"uDisplacementScale": { type: "f", value: 1.0 },

		"diffuse": { type: "c", value: new THREE.Color( 0xffffff ) },
		"specular": { type: "c", value: new THREE.Color( 0x111111 ) },
		"ambient": { type: "c", value: new THREE.Color( 0xffffff ) },
		"shininess": { type: "f", value: 30 },
		"opacity": { type: "f", value: 1 },

		"useRefract": { type: "i", value: 0 },
		"refractionRatio": { type: "f", value: 0.98 },
		"reflectivity": { type: "f", value: 0.5 },

		"uOffset" : { type: "v2", value: new THREE.Vector2( 0, 0 ) },
		"uRepeat" : { type: "v2", value: new THREE.Vector2( 1, 1 ) },

		"wrapRGB" : { type: "v3", value: new THREE.Vector3( 1, 1, 1 ) }

		}

	] ),

	fragmentShader: [

		"uniform vec3 ambient;",
		"uniform vec3 diffuse;",
		"uniform vec3 specular;",
		"uniform float shininess;",
		"uniform float opacity;",

		"uniform bool enableDiffuse;",
		"uniform bool enableSpecular;",
		"uniform bool enableAO;",
		"uniform bool enableReflection;",
		"uniform bool enableTint;",
		"uniform bool enableBump;",
		"uniform bool enableDetailBump;",

		"uniform sampler2D tDiffuse;",
		"uniform sampler2D tNormal;",
		"uniform sampler2D tSpecular;",
		"uniform sampler2D tAO;",
		"uniform sampler2D tTint;",

		"uniform samplerCube tCube;",
		"uniform samplerCube tDetailBump;",

		"uniform sampler2D tDetailMask;",

		"uniform vec2 uNormalScale;",
		"uniform float detailFrequency;",
		"uniform float detailBumpiness;",

		"uniform bool useRefract;",
		"uniform float refractionRatio;",
		"uniform float reflectivity;",

		"varying vec4 vTangent;",
		"varying vec3 vBinormal;",
		"varying vec3 vNormal;",
		"varying vec2 vUv;",
		"varying vec2 vUv2;",

		"uniform vec3 ambientLightColor;",

		"#if MAX_DIR_LIGHTS > 0",

		"	uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];",
		"	uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];",

		"#endif",

		"#if MAX_HEMI_LIGHTS > 0",

		"	uniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];",
		"	uniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];",
		"	uniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];",

		"#endif",

		"#if MAX_POINT_LIGHTS > 0",

		"	uniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];",
		"	uniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];",
		"	uniform float pointLightDistance[ MAX_POINT_LIGHTS ];",

		"#endif",

		"#if MAX_SPOT_LIGHTS > 0",

		"	uniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];",
		"	uniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];",
		"	uniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];",
		"	uniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];",
		"	uniform float spotLightExponent[ MAX_SPOT_LIGHTS ];",
		"	uniform float spotLightDistance[ MAX_SPOT_LIGHTS ];",

		"#endif",

		"#ifdef WRAP_AROUND",

		"	uniform vec3 wrapRGB;",

		"#endif",

		"varying vec3 vWorldPosition;",
		"varying vec3 vViewPosition;",

		THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
		THREE.ShaderChunk[ "fog_pars_fragment" ],
		THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

		"void main() {",
			THREE.ShaderChunk[ "logdepthbuf_fragment" ],

		"	gl_FragColor = vec4( vec3( 1.0 ), opacity );",


// 1296^Character_TR_Tint_Abstract_Camo^ANY^TileTint^TilingTintHighlight^RGB^^0.576471^0.576471^0.576471^1.000000
// 1296^Character_TR_Tint_Abstract_Camo^ANY^TileTint^TilingTintMidtone^RGB^^0.207843^0.125490^0.023529^1.000000
// 1296^Character_TR_Tint_Abstract_Camo^ANY^TileTint^TilingTintShadow^RGB^^0.298039^0.000000^0.000000^1.000000
// 1296^Character_TR_Tint_Abstract_Camo^ANY^TileTint^TilingTintScale^SCALAR^^2.500000^0.000000^0.000000^0.000000

		"	vec3 tintHighlight = vec3(0.576471, 0.576471, 0.576471);",
		"	vec3 tintMidtone = vec3(0.207843, 0.125490, 0.023529);",
		"	vec3 tintShadow = vec3(0.298039, 0.0, 0.0);",
		"	float tintScale = 2.5;",
		"	vec2 tintTranslation = vec2(0.0);",
		"	float tintOpacity = 1.0;",
		"	float tintRotation = 0.0;",

		"	vec3 specularTex = vec3( 1.0 );",
		"	vec3 normalTex;",

    	"	vec4 c16 = vec4(1.0, 2.0, -1.0, -0.5);",
    	"	vec4 c17 = vec4(255.0, -250, 1.41421354, 128.0);",
    	"	vec4 c18 = vec4(-1.0, 1.0, 0.0, 0.166666672);",
    	"	vec4 c19 = vec4(1.0, 0.0, 0.5, 0.00392156886);",
    	"	vec4 c20 = vec4(0.501960814, 0.0, 0.0, 0.0);",
    	"	vec4 c21 = vec4(2.0, 1.0, -1.0, 0.0);",

    	"	vec4 c22 = vec4(0.0, 0.5, 1.0, -2.0);",

		"	vec4 r0 = texture2D( tNormal, vUv );",					// rawBump
		"	vec4 r1 = texture2D( tSpecular, vUv );",				// specularValues
		"	vec4 r2 = texture2D( tDiffuse, vUv );",					// albedo

		"	vec4 r3;",
		"	vec4 r4;",
		"	vec4 r5;",
		"	vec4 r6;",
		"	vec4 r7;",
		"	vec4 r8;",

    // if g_ShowTilingTint

// #line 73
//       add r3.xy, -c6, v0.zwzw
//       mul r3.xy, r3, c7.x  // ::uv<0,1>

		"	if (enableTint) {",

		"		r3.xy = vUv2 - tintTranslation;",
		"		r3.xy = r3.xy * tintScale;",

// rotation

// #line 77
//       mov r4.xw, c1.x
//       mov r4.y, -c0.x
//       dp2add r4.x, r3, r4, c22.x  // ::uvOutU<0>
//       mov r4.z, c0.x
//       dp2add r4.y, r3, r4.zwzw, c22.x  // ::uv<1>
//       add r3.xy, r4, c22.y  // ::uv<0,1>

// #line 116
//       texld r3, r3, s0  // ::tint<0,1,2,3>

		"		r3 = texture2D( tTint, r3.xy );",

// #line 156 "MathUtil.fxh"
//       add r4.xyz, -r3, c22.z  // ::invColor<0,1,2>
//       mul r5.xyz, r4, r4
//       mul r4.xyz, r3, r4
//       mul r4.xyz, r4, c9
//       add r4.xyz, r4, r4
//       mad r4.xyz, r5, c10, r4  // ::ret<0,1,2>
//       mul r3.xyz, r3, r3
//       mad r3.xyz, r3, c8, r4  // ::ret<0,1,2>

		"		r4.xyz = -r3.xyz + c22.z;",
		"		r5.xyz = r4.xyz * r4.xyz;",
		"		r4.xyz = r3.xyz * r3.xyz;",
		"		r4.xyz = r4.xyz * tintMidtone;",
		"		r4.xyz = r4.xyz + r4.xyz;",
		"		r4.xyz = r5.xyz * tintShadow + r4.xyz;",
		"		r3.xyz = r3.xyz * r3.xyz;",
		"		r3.xyz = r3.xyz * tintHighlight + r4.xyz;",

// #line 122 "Tint.fxh"
//       mad r4.xyz, r3, -c22.w, -c22.z
//       mad r4.xyz, r0.z, r4, c22.z
//       mul r5.xyz, r2, r4  // ::overlayTint<0,1,2>
//       mul r0.x, r0.z, c11.x
//       lrp r6.xyz, r0.x, r3, r2  // ::alphaTint<0,1,2>
//       mad r3.xyz, r2, -r4, r6
//       mad r2.xyz, c11.x, r3, r5  // ApplyTint::color<0,1,2>

		"		r4.xyz = r3.xyz * -c22.w - c22.z;",
		"		r4.xyz = r0.z * r4.xyz + c22.z;",
		"		r5.xyz = r2.xyz * r4.xyz;",
		"		r0.x = r0.z * tintOpacity;",
		"		r6.xyz = mix(r2.xyz, r3.xyz, r0.x);",
		"		r3.xyz = r2.xyz * -r4.xyz + r6.xyz;",
		"		r2.xyz = tintOpacity * r3.xyz + r5.xyz;",

// #line 123 "MathUtil.fxh"
//       lrp r4.x, r0.z, r3.w, c22.y  // Overlay::overlay<0>
//       add r0.x, r4.x, r4.x
//       mov_sat r0.x, r0.x
//       mad r3.xyz, r1.wyxw, c20.xyyw, c20.yzzw
//       mul r4.yzw, r0.x, r3.xxyz
//       mad_sat r0.z, r4.x, -c22.w, -c22.z
//       mad r3.xyz, r3, -r0.x, c22.z
//       mad r3.xyz, r0.z, r3, r4.yzww  // ::Overlay<0,1,2>

// #line 128 "Tint.fxh"
//       add r0.x, -r3.x, c22.z  // ApplyTint::roughness<0>

// #line 113
    // else
    //   mov r3.yz, r1.xyxw  // ApplyTint::dielectric<0>, ApplyTint::metallic<0>
    //   mov r0.x, r1.w  // ApplyTint::roughness<0>
    // endif

    	"	} else {",
      	"		r3.yz = r1.yx;",
		"		r0.x = r1.w;",
		"	}",

    // if g_ShowDecalTint
    // else
    //   mov r0.z, c18.z  // ApplyDecal::emissive<0>
    // endif

      	"		r0.z = 0.0;",

	// add r0.z, r0.z, r1.z  // ::emissive<0>
      	"		r0.z += r1.z;",

    // mad r0.yw, r0.xwzy, c16.y, c16.z  // ::normal<0,1>
    // dp2add_sat r1.x, r0.ywzw, r0.ywzw, c18.z
    // add r1.x, -r1.x, c16.x
    // rsq r1.x, r1.x
    // rcp r1.x, r1.x  // ::normal<2>

    	"		r0.yw = r0.wy * 2.0 - 1.0;",
    	"		r1.x = sqrt(1.0 - clamp(dot(r0.yw, r0.yw), 0.0, 1.0));",

		"	if (enableDetailBump) {",


	// texld r4, v0, s6  // ::v3DetailSelect<0,1,2>

		"		r4 = texture2D( tDetailMask, vUv);",

	// mad r1.yzw, r4.xxyz, c16.y, c16.z  // ::mask<0,1,2>

		"		r1.yzw = r4.xyz * 2.0 - 1.0;",



	// mul r4.xy, c14.x, v0.zwzw  // DetailBump::texCoord<0,1>
	// frc r4.xy, r4
	// add r4.xy, r4, c16.w  // ::cubeCoord<1,2>
		"		r4.xy = fract(detailFrequency * vUv2) - 0.5;",

	// cmp r5.xyz, -r1.yzww, c18.z, c18.y
		"		r5.x = (-r1.y >= 0.0) ? 0.0 : 1.0;",
		"		r5.y = (-r1.z >= 0.0) ? 0.0 : 1.0;",
		"		r5.z = (-r1.w >= 0.0) ? 0.0 : 1.0;",

	// cmp r6.xyz, r1.yzww, -c18.z, -c18.y
		"		r6.x = (r1.y >= 0.0) ? -0.0 : -1.0;",
		"		r6.y = (r1.z >= 0.0) ? -0.0 : -1.0;",
		"		r6.z = (r1.w >= 0.0) ? -0.0 : -1.0;",

	// add r5.xyz, r5, r6
		"		r5.xyz += r6.xyz;",

	// mov r4.z, -c16.w
		"		r4.z = 0.5;",

    // mul r6.xyz, r4.zxyw, r5.x
    	"		r6.xyz = r4.zxy * r5.x;",

	// texld r6, r6, g_DetailBumpSampler  // DecodeDNormCube::sample<0,1,3>
		"		r6 = textureCube(tDetailBump, r6.xyz);",

    // mad r6.xyz, r6.wyxw, c21.xxyw, c21.zzww
    	"		r6.xyz = r6.wyx * c21.xxy + c21.zzw;",

    // mul r5.xyw, r4.yzzx, r5.y
    	"		r5.xyw = r4.yzx * r5.y;",

    // texld r7, r5.xyww, g_DetailBumpSampler  // DecodeDNormCube::sample<0,1,3>
    	"		r7 = textureCube(tDetailBump, r5.xyw);",

    // mad r5.xyw, r7.wyzx, c21.xxzy, c21.zzzw
    	"		r5.xyw = r7.wyx * c21.xxy + c21.zzw;",

    // mul r5.xyw, r1_abs.z, r5
    	"		r5.xyw = abs(r1.z) * r5.xyw;",

    // mad r5.xyw, r1_abs.y, r6.xyzz, r5  // ::result<0,1,2>
    	"		r5.xyw = abs(r1.y) * r6.xyz + r5.xyw;",

    // mul r4.xyz, r4, r5.z
    	"		r4.xyz = r4.xyz * r5.z;",

    // texld r4, r4, g_DetailBumpSampler  // DecodeDNormCube::sample<0,1,3>
    	"		r4 = textureCube(tDetailBump, r4.xyz);",

    // mad r4.xyz, r4.wyxw, c21.xxyw, c21.zzww
    	"		r4.xyz = r4.wyx * c21.xxy + c21.zzw;",

    // mad r1.yzw, r1_abs.w, r4.xxyz, r5.xxyw  // ::result<0,1,2>
    	"		r1.yzw = abs(r1.w) * r4.xyz + r5.xyw;",

    // mul r1.yz, r1, c15.x
    	"		r1.yz = r1.yz * detailBumpiness;",

    // mad r4.xy, v2.w, c19, c19.yzzw
    	"		r4.xy = -vTangent.w * c19.xy + c19.yz;",

    // mul r4.xy, r1.yzzw, r4  // ::result<1>
    	"		r4.xy = r1.yz * r4.xy;",

    // mul r1.y, r1.w, r1.w  // ::finalStdDev<0>
    	"		r1.y = r1.w * r1.w;",

    // mul r1.y, r1.y, c15.x
    	"		r1.y = r1.y * detailBumpiness;",

    // mad_sat r3.x, r1.y, -c16.w, r0.x  // DetailBump::roughness<0>
    	"		r3.x = clamp(r1.y * 0.5 + r0.x, 0.0, 1.0);",

    	"	}",

    // mul r4.z, r4.x, -c16.w
    	"		r4.z = r4.x * 0.5;",

    // add r0.xy, r0.ywzw, r4.zyzw  // ::v3Bump<0,1>
    	"		r0.xy = r0.yw + r4.zy;",

    // mov r4.xyz, v2  // IN<10,11,12>
    	"		r4.xyz = vTangent.xyz;",

    // mul r1.yzw, r4.xzxy, v3.xyzx
    	"		r1.yzw = r4.zxy * vBinormal.yzx;",

    // mad r1.yzw, r4.xyzx, v3.xzxy, -r1  // ::normal<0,1,2>
    	"		r1.yzw = r4.yzx * vBinormal.zxy - r1.yzw;",

    // dp3 r0.w, v2, v2
    	"		r0.w = dot(vTangent.xyz, vTangent.xyz);",

    // dp3 r4.x, v3, v3
    	"		r4.x = dot(vBinormal.xyz, vBinormal.xyz);",

    // add r0.w, r0.w, r4.x
    // rsq r0.w, r0.w
    	"		r0.w = 1.0 / sqrt(r0.w + r4.x);",

    // mul r0.w, r0.w, c17.z
    	"		r0.w = r0.w * c17.z;",

    // mul r1.yzw, r0.w, r1  // ::normal<0,1,2>
    	"		r1.yzw = r0.w * r1.yzw;",

    // mul r1.yzw, r1, v2.w  // ::normal<0,1,2>
    	"		r1.yzw = r1.yzw * vTangent.w;",

    // mul r4.xyz, r0.y, v3

    	"		r4.xyz = vBinormal * r0.y;",

    // mad r0.xyw, r0.x, v2.xyzz, r4.xyzz

    	"		r0.xyw = r0.x * vTangent.xyz + r4.xyz;",

    // mad r0.xyw, r1.x, r1.yzzw, r0

    	"		r0.xyw = r1.x * r1.yzw + r0.xyw;",

    // dp3 r1.x, r0.xyww, r0.xyww
    // rsq r1.x, r1.x

    	"		r1.x = 1.0 / sqrt(dot(r0.xyw, r0.xyw));",


	// #line 51
	//     mov r4.xyw, v4  // IN<17,18,20>
	//     mul r1.yz, r4.w, v5.xxyw
	//     mad r1.yz, r4.xxyw, v5.w, -r1
	//     mul r1.w, v4.w, v4.w
	//     rcp r1.w, r1.w
	//     mul r1.yz, r1.w, r1  // ::CalcMotion<0,1>



	// #line 340 "GBuffers.fxh"
	//     mad r0.xyw, r0, r1.x, c16.x
	//     mul oC1.xyz, r0.xyww, -c16.w  // ::PS<4,5,6>

		"		normalTex = r0.xyw * r1.x;",


  //   	"	vec3 normalTex;",
		// "	if( enableBump ) {",
		// "		vec4 rawNormalTex = texture2D( tNormal, vUv ).rgba;",
		// "		vec2 normalXY = rawNormalTex.wy * 2.0 - 1.0;",
		// "		float normalZ = sqrt(1.0 - (normalXY.x*normalXY.x) - (normalXY.y*normalXY.y));",
		// "		normalTex = vec3(normalXY.x, normalXY.y, normalZ);",
		// "		normalTex.xy *= uNormalScale;",
		// "		normalTex = normalize( normalTex );",

		// "		normalTex = r0.xyw;",
		// "	}",

		"	if ( enableDetailBump ) {",

		// "		vec4 detailSelect = texture2D( tDetailMask, vUv);", // r4

		// "		vec4 detailMask;", // r1
		// "		detailMask.yzw = detailSelect.xxy * 2.0 - 1.0;",

		// "		detailSelect.xy = detailFreq * vUv2;",
		// "		detailSelect.x = detailSelect.x - floor(detailSelect.x);",
		// "		detailSelect.y = detailSelect.y - floor(detailSelect.y);",

		// "		detailSelect.xy = detailSelect.xy - 0.5;",

		// "		vec4 r5;",
		// "		vec4 r6;",

		// "		r5.x = (-detailSelect.y >= 0.0) ? 0.0 : 1.0;",
		// "		r5.y = (-detailSelect.z >= 0.0) ? 0.0 : 1.0;",
		// "		r5.z = (-detailSelect.w >= 0.0) ? 0.0 : 1.0;",

		// "		r6.x = (detailSelect.y >= 0.0) ? 0.0 : -1.0;",
		// "		r6.y = (detailSelect.z >= 0.0) ? 0.0 : -1.0;",
		// "		r6.z = (detailSelect.w >= 0.0) ? 0.0 : -1.0;",

		// "		r5.xyz = r5.xyz + r6.xyz;",

		// "		detailSelect.z = 0.5;",
		// "		r6.xyz = detailSelect.zxy * r5.x;",

		// "		r6 = textureCube( tDetailBump, r6.xyz );",
		// "		vec4 c21 = vec4(2.0, 1.0, -1.0, 0.0);",
		// "		r6.xyz = r6.wyx * c21.xxy + c21.zzw;",

		// "		r5.xyw = detailSelect.yzz * r5.y;",

		// "		vec4 r7 = textureCube(tDetailBump, r5.xyw);",
		// "		r5.xyw = r7.wyz * c21.xxz + c21.zzz;",
		// "		r5.xyw = abs(detailMask.z) * r5.xyz;",
		// "		r5.xyw = abs(detailMask.y) * r6.xyz + r5.xyz;",
		// "		detailSelect.xyz = detailSelect.xyz * r5.z;",

		// "		detailSelect = textureCube(tDetailBump, detailSelect.xyz);",

		// "		detailSelect.xyz = detailSelect.wyx * c21.xxy + c21.zzw;",
		// "		detailMask.yzw = abs(detailMask.w) * detailSelect.xxy + detailSelect.xxy;",
		// "		detailMask.yz = detailMask.xy * detailBumpiness;",

		// "		detailSelect.xy = 1.0 * vec2(1.0, 0.0) + vec2(0.0, 0.5);",
		// "		detailSelect.xy = detailMask.yz * detailSelect.xy;",

		// "		detailSelect.z = detailSelect.x * 0.5;",
		// "		normalTex.xy = normalTex.xy + detailSelect.xy;",

		"	}",


		"	if( enableDiffuse ) {",

		"		vec4 texelColor = vec4(r2.xyz, 1.0);",

		// "			vec4 texelColor = texture2D( tDiffuse, vUv );",
		// "		    if( enableTint ) {",
		// "				vec4 tintColor = texture2D( tTint, vUv2 );",
		// "				float tintMask = texture2D( tNormal, vUv ).b;",
		// "				texelColor = mix(texelColor, tintColor, tintMask);",
		// "	        }",

		"		#ifdef GAMMA_INPUT",
		"			texelColor.xyz *= texelColor.xyz;",
		"			gl_FragColor = gl_FragColor * texelColor;",
		"		#else",
		"			gl_FragColor = gl_FragColor * texelColor;",
		"		#endif",

		"	}",

	
		THREE.ShaderChunk[ "alphatest_fragment" ],

		"	if( enableSpecular )",
		"		specularTex = texture2D( tSpecular, vUv ).xyz;",

		//"	mat3 tsb = mat3( normalize( vTangent ), normalize( vBinormal ), normalize( vNormal ) );",
		//"	mat3 tsb = mat3( normalize( vTangent ), normalize( vBinormal ), vec3(0.0,0.0,1.0) );",
		//	vec3 finalNormal = vNormal;",
		// "	if ( enableBump ) {",
		 //"		mat3 tsb = mat3( vec3(1.0,0.0,0.0), vec3(0.0,1.0,0.0), normalize( vNormal ) );",
		 //"		finalNormal = tsb * normalTex;",
		// "	}",

		"	vec3 finalNormal = normalTex;",
		//"		finalNormal = -finalNormal;",
		"	#ifdef FLIP_SIDED",
		"		finalNormal = -finalNormal;",
		"	#endif",

		"	vec3 normal = normalize( finalNormal );",
		"	vec3 viewPosition = normalize( vViewPosition );",

			// point lights

		"	#if MAX_POINT_LIGHTS > 0",

		"		vec3 pointDiffuse = vec3( 0.0 );",
		"		vec3 pointSpecular = vec3( 0.0 );",

		"		for ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {",

		"			vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );",
		"			vec3 pointVector = lPosition.xyz + vViewPosition.xyz;",

		"			float pointDistance = 1.0;",
		"			if ( pointLightDistance[ i ] > 0.0 )",
		"				pointDistance = 1.0 - min( ( length( pointVector ) / pointLightDistance[ i ] ), 1.0 );",

		"			pointVector = normalize( pointVector );",

					// diffuse

		"			#ifdef WRAP_AROUND",

		"				float pointDiffuseWeightFull = max( dot( normal, pointVector ), 0.0 );",
		"				float pointDiffuseWeightHalf = max( 0.5 * dot( normal, pointVector ) + 0.5, 0.0 );",

		"				vec3 pointDiffuseWeight = mix( vec3( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), wrapRGB );",

		"			#else",

		"				float pointDiffuseWeight = max( dot( normal, pointVector ), 0.0 );",

		"			#endif",

		"			pointDiffuse += pointDistance * pointLightColor[ i ] * diffuse * pointDiffuseWeight;",

					// specular

		"			vec3 pointHalfVector = normalize( pointVector + viewPosition );",
		"			float pointDotNormalHalf = max( dot( normal, pointHalfVector ), 0.0 );",
		"			float pointSpecularWeight = specularTex.r * max( pow( pointDotNormalHalf, shininess ), 0.0 );",

		"			float specularNormalization = ( shininess + 2.0 ) / 8.0;",

		"			vec3 schlick = specular + vec3( 1.0 - specular ) * pow( max( 1.0 - dot( pointVector, pointHalfVector ), 0.0 ), 5.0 );",
		"			pointSpecular += schlick * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * pointDistance * specularNormalization;",

		"		}",

		"	#endif",

			// spot lights

		"	#if MAX_SPOT_LIGHTS > 0",

		"		vec3 spotDiffuse = vec3( 0.0 );",
		"		vec3 spotSpecular = vec3( 0.0 );",

		"		for ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {",

		"			vec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );",
		"			vec3 spotVector = lPosition.xyz + vViewPosition.xyz;",

		"			float spotDistance = 1.0;",
		"			if ( spotLightDistance[ i ] > 0.0 )",
		"				spotDistance = 1.0 - min( ( length( spotVector ) / spotLightDistance[ i ] ), 1.0 );",

		"			spotVector = normalize( spotVector );",

		"			float spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - vWorldPosition ) );",

		"			if ( spotEffect > spotLightAngleCos[ i ] ) {",

		"				spotEffect = max( pow( max( spotEffect, 0.0 ), spotLightExponent[ i ] ), 0.0 );",

						// diffuse

		"				#ifdef WRAP_AROUND",

		"					float spotDiffuseWeightFull = max( dot( normal, spotVector ), 0.0 );",
		"					float spotDiffuseWeightHalf = max( 0.5 * dot( normal, spotVector ) + 0.5, 0.0 );",

		"					vec3 spotDiffuseWeight = mix( vec3( spotDiffuseWeightFull ), vec3( spotDiffuseWeightHalf ), wrapRGB );",

		"				#else",

		"					float spotDiffuseWeight = max( dot( normal, spotVector ), 0.0 );",

		"				#endif",

		"				spotDiffuse += spotDistance * spotLightColor[ i ] * diffuse * spotDiffuseWeight * spotEffect;",

						// specular

		"				vec3 spotHalfVector = normalize( spotVector + viewPosition );",
		"				float spotDotNormalHalf = max( dot( normal, spotHalfVector ), 0.0 );",
		"				float spotSpecularWeight = specularTex.r * max( pow( spotDotNormalHalf, shininess ), 0.0 );",

		"				float specularNormalization = ( shininess + 2.0 ) / 8.0;",

		"				vec3 schlick = specular + vec3( 1.0 - specular ) * pow( max( 1.0 - dot( spotVector, spotHalfVector ), 0.0 ), 5.0 );",
		"				spotSpecular += schlick * spotLightColor[ i ] * spotSpecularWeight * spotDiffuseWeight * spotDistance * specularNormalization * spotEffect;",

		"			}",

		"		}",

		"	#endif",

			// directional lights

		"	#if MAX_DIR_LIGHTS > 0",

		"		vec3 dirDiffuse = vec3( 0.0 );",
		"		vec3 dirSpecular = vec3( 0.0 );",

		"		for( int i = 0; i < MAX_DIR_LIGHTS; i++ ) {",

		"			vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );",
		"			vec3 dirVector = normalize( lDirection.xyz );",

					// diffuse

		"			#ifdef WRAP_AROUND",

		"				float directionalLightWeightingFull = max( dot( normal, dirVector ), 0.0 );",
		"				float directionalLightWeightingHalf = max( 0.5 * dot( normal, dirVector ) + 0.5, 0.0 );",

		"				vec3 dirDiffuseWeight = mix( vec3( directionalLightWeightingFull ), vec3( directionalLightWeightingHalf ), wrapRGB );",

		"			#else",

		"				float dirDiffuseWeight = max( dot( normal, dirVector ), 0.0 );",

		"			#endif",

		"			dirDiffuse += directionalLightColor[ i ] * diffuse * dirDiffuseWeight;",

					// specular

		"			vec3 dirHalfVector = normalize( dirVector + viewPosition );",
		"			float dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );",
		"			float dirSpecularWeight = specularTex.r * max( pow( dirDotNormalHalf, shininess ), 0.0 );",

		"			float specularNormalization = ( shininess + 2.0 ) / 8.0;",

		"			vec3 schlick = specular + vec3( 1.0 - specular ) * pow( max( 1.0 - dot( dirVector, dirHalfVector ), 0.0 ), 5.0 );",
		"			dirSpecular += schlick * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight * specularNormalization;",

		"		}",

		"	#endif",

			// hemisphere lights

		"	#if MAX_HEMI_LIGHTS > 0",

		"		vec3 hemiDiffuse = vec3( 0.0 );",
		"		vec3 hemiSpecular = vec3( 0.0 );" ,

		"		for( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {",

		"			vec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );",
		"			vec3 lVector = normalize( lDirection.xyz );",

					// diffuse

		"			float dotProduct = dot( normal, lVector );",
		"			float hemiDiffuseWeight = 0.5 * dotProduct + 0.5;",

		"			vec3 hemiColor = mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );",

		"			hemiDiffuse += diffuse * hemiColor;",

					// specular (sky light)


		"			vec3 hemiHalfVectorSky = normalize( lVector + viewPosition );",
		"			float hemiDotNormalHalfSky = 0.5 * dot( normal, hemiHalfVectorSky ) + 0.5;",
		"			float hemiSpecularWeightSky = specularTex.r * max( pow( max( hemiDotNormalHalfSky, 0.0 ), shininess ), 0.0 );",

					// specular (ground light)

		"			vec3 lVectorGround = -lVector;",

		"			vec3 hemiHalfVectorGround = normalize( lVectorGround + viewPosition );",
		"			float hemiDotNormalHalfGround = 0.5 * dot( normal, hemiHalfVectorGround ) + 0.5;",
		"			float hemiSpecularWeightGround = specularTex.r * max( pow( max( hemiDotNormalHalfGround, 0.0 ), shininess ), 0.0 );",

		"			float dotProductGround = dot( normal, lVectorGround );",

		"			float specularNormalization = ( shininess + 2.0 ) / 8.0;",

		"			vec3 schlickSky = specular + vec3( 1.0 - specular ) * pow( max( 1.0 - dot( lVector, hemiHalfVectorSky ), 0.0 ), 5.0 );",
		"			vec3 schlickGround = specular + vec3( 1.0 - specular ) * pow( max( 1.0 - dot( lVectorGround, hemiHalfVectorGround ), 0.0 ), 5.0 );",
		"			hemiSpecular += hemiColor * specularNormalization * ( schlickSky * hemiSpecularWeightSky * max( dotProduct, 0.0 ) + schlickGround * hemiSpecularWeightGround * max( dotProductGround, 0.0 ) );",

		"		}",

		"	#endif",

			// all lights contribution summation

		"	vec3 totalDiffuse = vec3( 0.0 );",
		"	vec3 totalSpecular = vec3( 0.0 );",

		"	#if MAX_DIR_LIGHTS > 0",

		"		totalDiffuse += dirDiffuse;",
		"		totalSpecular += dirSpecular;",

		"	#endif",

		"	#if MAX_HEMI_LIGHTS > 0",

		"		totalDiffuse += hemiDiffuse;",
		"		totalSpecular += hemiSpecular;",

		"	#endif",

		"	#if MAX_POINT_LIGHTS > 0",

		"		totalDiffuse += pointDiffuse;",
		"		totalSpecular += pointSpecular;",

		"	#endif",

		"	#if MAX_SPOT_LIGHTS > 0",

		"		totalDiffuse += spotDiffuse;",
		"		totalSpecular += spotSpecular;",

		"	#endif",

		"	#ifdef METAL",

		"		gl_FragColor.xyz = gl_FragColor.xyz * ( totalDiffuse + ambientLightColor * ambient + totalSpecular );",

		"	#else",

		"		gl_FragColor.xyz = gl_FragColor.xyz * ( totalDiffuse + ambientLightColor * ambient ) + totalSpecular;",

		"	#endif",

		"	if ( enableReflection ) {",

		"		vec3 vReflect;",
		"		vec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );",

		"		if ( useRefract ) {",

		"			vReflect = refract( cameraToVertex, normal, refractionRatio );",

		"		} else {",

		"			vReflect = reflect( cameraToVertex, normal );",

		"		}",

		"		vec4 cubeColor = textureCube( tCube, vec3( -vReflect.x, vReflect.yz ) );",

		"		#ifdef GAMMA_INPUT",

		"			cubeColor.xyz *= cubeColor.xyz;",
		"			cubeColor.xyz *= cubeColor.xyz;",

		"		#endif",

		"		gl_FragColor.xyz = mix( gl_FragColor.xyz, cubeColor.xyz, r3.z * reflectivity );",

		"	}",


			THREE.ShaderChunk[ "shadowmap_fragment" ],
			THREE.ShaderChunk[ "linear_to_gamma_fragment" ],
			THREE.ShaderChunk[ "fog_fragment" ],

		"}"

	].join("\n"),

	vertexShader: [

		"attribute vec4 tangent;",

		"uniform vec2 uOffset;",
		"uniform vec2 uRepeat;",
		"uniform float uTintScale;",

		"uniform bool enableDisplacement;",

		"#ifdef VERTEX_TEXTURES",

		"	uniform sampler2D tDisplacement;",
		"	uniform float uDisplacementScale;",
		"	uniform float uDisplacementBias;",

		"#endif",

		"varying vec4 vTangent;",
		"varying vec3 vBinormal;",
		"varying vec3 vNormal;",
		"varying vec2 vUv;",
		"varying vec2 vUv2;",

		"varying vec3 vWorldPosition;",
		"varying vec3 vViewPosition;",

		THREE.ShaderChunk[ "skinning_pars_vertex" ],
		THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
		THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],

		"void main() {",

			THREE.ShaderChunk[ "skinbase_vertex" ],
			THREE.ShaderChunk[ "skinnormal_vertex" ],

			// normal, tangent and binormal vectors

		"	#ifdef USE_SKINNING",

		"		vNormal = normalize( normalMatrix * skinnedNormal.xyz );",

		"		vec4 skinnedTangent = skinMatrix * vec4( tangent.xyz, 0.0 );",
		"		vTangent.xyz = normalize( normalMatrix * skinnedTangent.xyz );",
		"		vTangent.w = tangent.w;",
		"	#else",

		"		vNormal = normalize( normalMatrix * normal );",
		"		vTangent.xyz = normalize( normalMatrix * tangent.xyz );",
		"		vTangent.w = tangent.w;",
		"	#endif",

		"	vBinormal = normalize( cross( vNormal, vTangent.xyz ) * tangent.w );",

		"	vUv = uv * uRepeat + uOffset;",

			// tint uvs
		"	vUv2 = uv2 * uTintScale;",

			// displacement mapping

		"	vec3 displacedPosition;",

		"	#ifdef VERTEX_TEXTURES",

		"		if ( enableDisplacement ) {",

		"			vec3 dv = texture2D( tDisplacement, uv ).xyz;",
		"			float df = uDisplacementScale * dv.x + uDisplacementBias;",
		"			displacedPosition = position + normalize( normal ) * df;",

		"		} else {",

		"			#ifdef USE_SKINNING",

		"				vec4 skinVertex = bindMatrix * vec4( position, 1.0 );",

		"				vec4 skinned = vec4( 0.0 );",
		"				skinned += boneMatX * skinVertex * skinWeight.x;",
		"				skinned += boneMatY * skinVertex * skinWeight.y;",
		"				skinned += boneMatZ * skinVertex * skinWeight.z;",
		"				skinned += boneMatW * skinVertex * skinWeight.w;",
		"				skinned  = bindMatrixInverse * skinned;",

		"				displacedPosition = skinned.xyz;",

		"			#else",

		"				displacedPosition = position;",

		"			#endif",

		"		}",

		"	#else",

		"		#ifdef USE_SKINNING",

		"			vec4 skinVertex = bindMatrix * vec4( position, 1.0 );",

		"			vec4 skinned = vec4( 0.0 );",
		"			skinned += boneMatX * skinVertex * skinWeight.x;",
		"			skinned += boneMatY * skinVertex * skinWeight.y;",
		"			skinned += boneMatZ * skinVertex * skinWeight.z;",
		"			skinned += boneMatW * skinVertex * skinWeight.w;",
		"			skinned  = bindMatrixInverse * skinned;",

		"			displacedPosition = skinned.xyz;",

		"		#else",

		"			displacedPosition = position;",

		"		#endif",

		"	#endif",

			//

		"	vec4 mvPosition = modelViewMatrix * vec4( displacedPosition, 1.0 );",
		"	vec4 worldPosition = modelMatrix * vec4( displacedPosition, 1.0 );",

		"	gl_Position = projectionMatrix * mvPosition;",

			THREE.ShaderChunk[ "logdepthbuf_vertex" ],

			//

		"	vWorldPosition = worldPosition.xyz;",
		"	vViewPosition = -mvPosition.xyz;",

			// shadows

		"	#ifdef USE_SHADOWMAP",

		"		for( int i = 0; i < MAX_SHADOWS; i ++ ) {",

		"			vShadowCoord[ i ] = shadowMatrix[ i ] * worldPosition;",

		"		}",

		"	#endif",

		"}"

	].join("\n")
};
