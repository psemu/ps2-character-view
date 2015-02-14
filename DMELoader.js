/**
 * @author jseidelin / http://nihilogic.dk/
 */

var DME = require("dme");

THREE.DMELoader = function ( manager ) {

    this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.DMELoader.prototype = {

    constructor: THREE.DMELoader,

    load: function ( url, onLoad, onProgress, onError ) {

        var scope = this;

        var loader = new THREE.XHRLoader( scope.manager );
        loader.setCrossOrigin( this.crossOrigin );
        loader.setResponseType("arraybuffer");
        loader.load( url, function (data) {
            onLoad(scope.parse(new Buffer(new Uint8Array(data))));
        } );

    },

    parse: function ( data ) {
        
        var result = {
            geometries: [],
            materials: []
        };

        var object = new THREE.Object3D();
        var geometry, material, mesh, drawCall, dmeMesh;
        var i, j, k, l;

        var dme = DME.read(data),
            dmat = dme.dmat;

        var dmatMaterial = dmat.materials[0];

        if (dmatMaterial) {
            var material = {};
            material.name = dmatMaterial.name;
            for (var j=0;j<dmatMaterial.parameters.length;j++) {
                var param = dmatMaterial.parameters[j];
                switch (param.name) {
                    case "DetailBumpiness":
                        material.detailBumpiness = param.value;
                        break;
                    case "DetailFrequency":
                        material.detailFrequency = param.value;
                        break;
                    case "ShowDecalTint":
                        material.showDecalTint = !!param.value;
                        break;
                    case "ShowTilingTint":
                        material.showTilingTine = !!param.value;
                        break;
                }
            }
            result.materials.push(material);
        }

        for (i=0;i<dme.meshes.length;i++) {
            dmeMesh = dme.meshes[i];
            
            for (k=0;k<dmeMesh.drawCalls.length;k++) {
                drawCall = dmeMesh.drawCalls[k];
            
                var vertices = dmeMesh.vertices.slice(drawCall.vertexOffset, drawCall.vertexOffset + drawCall.vertexCount);
                var indices = dmeMesh.indices.slice(drawCall.indexOffset, drawCall.indexOffset + drawCall.indexCount);
                var skinIndices = dmeMesh.skinIndices.slice(drawCall.vertexOffset, drawCall.vertexOffset + drawCall.vertexCount);
                var skinWeights = dmeMesh.skinWeights.slice(drawCall.vertexOffset, drawCall.vertexOffset + drawCall.vertexCount);
                var boneMap = dmeMesh.boneMapEntries.slice(drawCall.boneStart, drawCall.boneStart + drawCall.boneCount);


                geometry = new THREE.Geometry();

                var uvs = [];
                var uvs2 = [];
                var uvs3 = [];
                var normals = [];

                var hasUV = (dmeMesh.uvs[0] && dmeMesh.uvs[0].length > 0);
                var hasUV2 = (dmeMesh.uvs[1] && dmeMesh.uvs[1].length > 0);
                var hasUV3 = (dmeMesh.uvs[2] && dmeMesh.uvs[2].length > 0);
                var hasNormal = (dmeMesh.normals.length > 0)
                var hasBinormal = (dmeMesh.binormals.length > 0)

                for (j=0,l=vertices.length;j<l;j++) {
                    var vertex = vertices[j];
                    geometry.vertices.push(
                        new THREE.Vector3(vertex[0], vertex[1], vertex[2])
                    );
                }

                if (hasUV) {
                    var drawCallUvs = dmeMesh.uvs[0].slice(drawCall.vertexOffset, drawCall.vertexOffset + drawCall.vertexCount);
                    for (j=0,l=drawCallUvs.length;j<l;j++) {
                        var uv = drawCallUvs[j];
                        uvs.push(
                            new THREE.Vector2(uv[0], uv[1])
                        );
                    }
                    geometry.faceVertexUvs[0] = [];
                }
                if (hasUV2) {
                    var drawCallUvs2 = dmeMesh.uvs[1].slice(drawCall.vertexOffset, drawCall.vertexOffset + drawCall.vertexCount);
                    for (j=0,l=drawCallUvs2.length;j<l;j++) {
                        var uv = drawCallUvs2[j];
                        uvs2.push(
                            new THREE.Vector2(uv[0], uv[1])
                        );
                    }
                    geometry.faceVertexUvs[1] = [];
                }
                if (hasNormal) {
                    var drawCallNormals = dmeMesh.normals.slice(drawCall.vertexOffset, drawCall.vertexOffset + drawCall.vertexCount);
                    for (j=0,l=drawCallNormals.length;j<l;j++) {
                        var normal = drawCallNormals[j];
                        normals.push(
                            new THREE.Vector3(normal[0], normal[1], normal[2])
                        );
                    }
                }

                for (j=0,l=indices.length;j<l;j+=3) {
                    var a = indices[j+2] - drawCall.vertexOffset,
                        b = indices[j+1] - drawCall.vertexOffset,
                        c = indices[j] - drawCall.vertexOffset;
                    geometry.faces.push(
                        new THREE.Face3(a, b, c, 
                            hasNormal ? [
                                normals[a].clone(),
                                normals[b].clone(),
                                normals[c].clone()
                            ] : undefined
                        )
                    );
                    if (hasUV) {
                        geometry.faceVertexUvs[0].push([
                            uvs[a].clone(),
                            uvs[b].clone(),
                            uvs[c].clone()
                        ]);
                    }
                    if (hasUV2) {
                        geometry.faceVertexUvs[1].push([
                            uvs2[a].clone(),
                            uvs2[b].clone(),
                            uvs2[c].clone()
                        ]);
                    }
                }
                geometry.bones = [];
                geometry.boneInverses = [];

                var boneLookup = [];
                for (var j=0;j<boneMap.length;j++) {
                    boneLookup[boneMap[j].globalIndex] = boneMap[j].boneIndex;
                }

                geometry.skinIndices = skinIndices.map(function(a) {
                    return new THREE.Vector4(
                        boneLookup[a[0]],
                        boneLookup[a[1]],
                        boneLookup[a[2]],
                        boneLookup[a[3]]
                    );
                });
                geometry.skinWeights = skinWeights.map(function(a) {
                    return new THREE.Vector4(
                        (a[0] + 1) / 2, 
                        (a[1] + 1) / 2, 
                        (a[2] + 1) / 2, 
                        (a[3] + 1) / 2
                    );
                });

                geometry.influencesPerVertex = 4;
                for (j=0,l=dmeMesh.bones.length;j<l;j++) {
                    geometry.bones[j] = {
                        parent: -1,
                        name: dmeMesh.bones[j].nameHash,
                        pos: [0,0,0],
                        rotq: [0,0,0,1]
                    };
                    var inverse = new THREE.Matrix4();
                    inverse.elements = dmeMesh.bones[j].inverseBindPose.slice(0);

                    geometry.boneInverses.push(inverse);
                }

                result.geometries.push(geometry);
            
            }

        }

        for (var i=0, l=result.geometries.length;i<l;i++) {
            var geometry = result.geometries[i];
            geometry.computeTangents();
            geometry.computeBoundingSphere();
        }
        
        return result;

    }

};