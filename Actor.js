THREE.Actor = function () {

    THREE.Object3D.call( this );

    this._material = null;
    this._meshes = [];
    this._boneSets = [];

    this.boneAttachmentName = "";
    this.actorUsage = 0;
    this.borrowSkeleton = false;
    this.modelName = "";
    this.textures = {};
};


THREE.Actor.prototype = Object.create( THREE.Object3D.prototype );

THREE.Actor.prototype.loadDefinition = function(filename, callback) {
    var actor = this;

    var loader = new THREE.XHRLoader();
    loader.setResponseType("text");
    loader.load("assets/actors/" + filename, function(data) {

        var parser = new DOMParser();
        var dom = parser.parseFromString(data, "text/xml");
        var baseNode = dom.querySelector("Base");
        
        actor.modelName = baseNode.getAttribute("fileName");

        var textureAliases = dom.querySelectorAll("ActorRuntime > TextureAliases > Alias");
        for (var i=0;i<textureAliases.length;i++) {
            var textureAlias = textureAliases[i];
            if (textureAlias.getAttribute("modelType") != "0") {
                continue;
            }
            var semanticHash = textureAlias.getAttribute("semanticHash");
            semanticHash = semanticHash >>> 0;
            var semantic = DME.MaterialParameters[semanticHash];
            if (semantic) {
                actor.textures[semantic.name] = textureAlias.getAttribute("textureName");
            } else {
                console.warn("Unknown texture semantic: " + semanticHash);
            }
        }

        var usageNode = dom.querySelector("Usage");
        actor.actorUsage = +usageNode.getAttribute("actorUsage");
        actor.borrowSkeleton = !!+usageNode.getAttribute("borrowSkeleton");
        actor.boneAttachmentName = usageNode.getAttribute("boneAttachmentName");

        callback();
    });
};


THREE.Actor.prototype.loadTexture = function(filename, callback) {
    if (!filename) {
        callback();
        return;
    }
    var loader = new THREE.DDSLoader();
    var texture = loader.load("assets/textures/" + filename, function(texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        if (callback)
            callback(texture);
    });
    return texture;
};

THREE.Actor.prototype.load = function(filename, options, callback) {
    options = options || {};

    function buildBoneMap(bone, boneMap, parent) {
        var hash = Jenkins.oaat(bone.name.toUpperCase());
        if (!boneMap[hash]) {
            boneMap[hash] = {
                name: bone.name,
                parent: parent
            };
        }
        for (var i=0;i<bone.children.length;i++) {
            buildBoneMap(bone.children[i], boneMap, hash);
        }
    }

    function lookupBoneParent(boneMap, bones, nameHash) {
        var parentHash = boneMap[nameHash].parent;
        for (var i=0;i<bones.length;i++) {
            if (bones[i].name == parentHash) {
                return i;
            }
        }
        return -1;
    }

    var me = this;


    me.loadDefinition(filename, function() {
        if (me.modelName) {
            var loader = new THREE.DMELoader();
            loader.load("assets/models/" + me.modelName, function(model) {
                var material = model.materials[0];
                var textures = me.textures;
                if (textures["BaseDiffuse"]) {
                    var ambient = 0x303030, diffuse = 0xffffff, specular = 0x404040, 
                        shininess = 200;

                    var shader = THREE.CharacterShader;
                    var uniforms = THREE.UniformsUtils.clone( shader.uniforms );

                    uniforms["enableAO"].value = false;
                    uniforms["enableDisplacement"].value = false;

                    uniforms["enableDiffuse"].value = true;                                
                    uniforms["tDiffuse"].value = me.loadTexture(textures["BaseDiffuse"]);

                    if (textures["Bump"]) {
                        uniforms["enableBump"].value = true;
                        uniforms["tNormal"].value = me.loadTexture(textures["Bump"]);
                        uniforms["uNormalScale"].value.y = -1;
                    }

                    if (textures["detailBump"]) {
                        uniforms["enableDetailBump"].value = true;
                        uniforms["tDetailBump"].value = me.loadTexture(textures["detailBump"]);
                        uniforms["tDetailMask"].value = me.loadTexture(textures["DetailMask"]);
                        uniforms["detailFrequency"].value = material.detailFrequency;
                        uniforms["detailBumpiness"].value = material.detailBumpiness;
                    }

                    if (textures["Spec"]) {
                        uniforms["enableSpecular"].value = true;
                        uniforms["tSpecular"].value = me.loadTexture(textures["Spec"]);
                    }

                    if (options.tint) {
                        uniforms["enableTint"].value = true;
                        uniforms["tTint"].value = me.loadTexture(options.tint);
                    }

                    uniforms["diffuse"].value.setHex(diffuse);
                    uniforms["specular"].value.setHex(specular);
                    uniforms["ambient"].value.setHex(ambient);

                    uniforms["shininess"].value = shininess;

                    uniforms["enableReflection"].value = true;
                    uniforms["tCube"].value = me.loadTexture("cubereflect.dds");
                    uniforms["reflectivity"].value = 0.2;

                    uniforms["diffuse"].value.convertGammaToLinear();
                    uniforms["specular"].value.convertGammaToLinear();
                    uniforms["ambient"].value.convertGammaToLinear();

                    var parameters = { 
                        fragmentShader: shader.fragmentShader, 
                        vertexShader: shader.vertexShader,
                        uniforms: uniforms, 
                        lights: true, 
                        fog: false
                    };
                    var shaderMaterial = new THREE.ShaderMaterial(parameters);
                    var geo, mesh;

                    if (options.skinning) {
                        shaderMaterial.skinning = true;

                        var boneMap = {};
                        buildBoneMap(BoneHierarchy, boneMap);
                        me._boneMap = boneMap;

                        for (var i=0;i<model.geometries.length;i++) {
                            geo = model.geometries[i];

                            me._boneSets[i] = [];

                            for (var j=0;j<geo.bones.length;j++) {
                                geo.bones[j].parent = lookupBoneParent(boneMap, geo.bones, geo.bones[j].name);
                            }

                            for (var j=0;j<geo.bones.length;j++) {
                                geo.bones[j].matrixWorld = new THREE.Matrix4().getInverse(geo.boneInverses[j]);
                            }

                            for (var j=0;j<geo.bones.length;j++) {
                                var bone = geo.bones[j];
                                bone.matrix = new THREE.Matrix4();

                                if (bone.parent > -1) {
                                    bone.matrix.getInverse(geo.bones[bone.parent].matrixWorld);
                                    bone.matrix.multiply(bone.matrixWorld);
                                } else {
                                    bone.matrix.copy(bone.matrixWorld);
                                }

                                var pos = new THREE.Vector3();
                                var rotq = new THREE.Quaternion();
                                var scl = new THREE.Vector3();

                                bone.matrix.decompose(pos, rotq, scl);

                                bone.pos = [pos.x, pos.y, pos.z];
                                bone.rotq = [rotq.x, rotq.y, rotq.z, rotq.w];
                                bone.scl = [scl.x, scl.y, scl.z];

                                me._boneSets[i].push(bone);
                            }

                            mesh = new THREE.SkinnedMesh(geo, shaderMaterial);
                            mesh.castShadow = true;
                            mesh.receiveShadow = true;
                            
                            me.add(mesh);
                            mesh.pose();

                            me._meshes[i] = mesh;

                            var helper = new THREE.SkeletonHelper( mesh );
                            helper.visible = false;
                            me.add( helper );

                        }
                    } else {
                        for (var i=0;i<model.geometries.length;i++) {
                            mesh = new THREE.Mesh(model.geometries[i], shaderMaterial);
                            mesh.castShadow = true;
                            mesh.receiveShadow = true;
                            me.add(mesh);
                        }
                    }

                    me._material = shaderMaterial;

                    if (callback) {
                        callback();
                    }

                } else {
                    console.warn("Actor definition has no texture: " + filename);
                }
            });
        } else {
            console.warn("Actor definition has no model: " + filename);
        }
    });
};


THREE.Actor.prototype.setAnimation = function(anim) {
    function remapAnimationBones(animation, boneMap, bones) {
        var hierarchy = animation.hierarchy;

        var object = {
            hierarchy: [],
            fps: animation.fps,
            length: animation.length
        };
        for (var i=0;i<bones.length;i++) {
            var bone = {
                parent: bones[i].parent,
                keys: [{
                    time: 0,
                    pos: [0,0,0],
                    scl: [1,1,1],
                    rot: [0,0,0,1]
                }]
            };
            var name = boneMap[bones[i].name].name;

            for (var j=0;j<hierarchy.length;j++) {
                if (hierarchy[j].name == name) {
                    bone.keys = hierarchy[j].keys;
                    break;
                }
            }

            object.hierarchy[i] = bone;
        }
        return object;
    }
    for (var i=0;i<this._meshes.length;i++) {
        var animObject = remapAnimationBones(anim, this._boneMap, this._boneSets[i]);
        var animation = new THREE.Animation(this._meshes[i], animObject);
        animation.play();
    }
};

THREE.Actor.prototype.pose = function() {
    for (var i=0;i<this._meshes.length;i++) {
        this._meshes[i].pose();
    }
};

THREE.Actor.prototype.attach = function(attachment) {
    if (!attachment.boneAttachmentName) {
        console.warn("Attachment has no bone attachment name");
        return;
    }
    var hash = Jenkins.oaat(attachment.boneAttachmentName.toUpperCase());
    for (var i=0;i<this._meshes.length;i++) {
        var mesh = this._meshes[i];
        var bones = mesh.skeleton.bones;
        for (var j=0;j<bones.length;j++) {
            if (bones[j].name == hash) {
                bones[j].add(attachment);
                return;
            }
        }
    }
};
