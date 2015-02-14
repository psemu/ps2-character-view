
THREE.BVHLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.BVHLoader.prototype = {

	constructor: THREE.BVHLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var loader = new THREE.XHRLoader( scope.manager );
		loader.setCrossOrigin( this.crossOrigin );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( text ) );

		} );
	},

	parse: function ( text ) {
		var object = {};

		var lines = text.split("\n");

		function parseJoint(joints, parent, name, lines) {
			var object = {
				parent: parent,
				name: name,
				hash: Jenkins.oaat(name),
				keys: [],
				offset: null,
				channels: [],
			};
			joints.push(object);
			var index = joints.length - 1;

			var line = lines.shift().trim();
			if (line == "{") {
				while (lines.length && lines[0].trim() != "}") {
					var line = lines.shift().trim().split(" ");
					switch (line[0]) {
						case "OFFSET":
							object.offset = [
								+line[1], +line[2], +line[3]
							];
							break;
						case "CHANNELS":
							var n = +line[1];
							for (var i=0;i<n;i++) {
								object.channels.push(line[2 + i]);
							}
							break;
						case "JOINT":
							parseJoint(joints, index, line[1], lines);
							break;
						case "End":
							lines.shift();
							lines.shift();
							lines.shift();
							break;
					}
				}
				lines.shift();
			}
		}

		function parseHierarchy(lines) {
			var joints = [];
			var line = lines.shift().split(" ");
			if (line[0] == "ROOT") {
				parseJoint(joints, -1, line[1], lines);
			}
			return joints;
		}

		function parseMotion(object, lines) {
			var numFrames = +lines.shift().match(/Frames\:\s(.*)/)[1];
			var frameTime = +lines.shift().match(/Frame Time\:\s(.*)/)[1];

			var frameData;
			for (var i=0;i<numFrames;i++) {
				frameData = lines.shift().trim().split(" ");
				var time = i * frameTime;
				for (var j=0;j<object.hierarchy.length;j++) {
					var joint = object.hierarchy[j];
					var scale = 0.5;
					var key = {
						time: time,
						pos: [
							joint.offset[0] * scale, 
							joint.offset[2] * scale, 
							joint.offset[1] * scale
						],
						rot: [0, 0, 0],
						scl: [1,1,1]
					};
					for (var k=0;k<joint.channels.length;k++) {
						var value = +frameData.shift();
						switch (joint.channels[k]) {
							case "Xposition":
								key.pos[0] += value * scale;
								break;
							case "Yposition":
								key.pos[2] += value * scale;
								break;
							case "Zposition":
								key.pos[1] += value * scale;
								break;
							case "Xrotation":
								key.rot[0] = value * Math.PI / 180;
								break;
							case "Yrotation":
								key.rot[2] = -value * Math.PI / 180;
								break;
							case "Zrotation":
								key.rot[1] = value * Math.PI / 180;
								break;
						}
					}

					key.pos[0] *= 1;
					key.pos[1] *= 1;
					key.pos[2] *= -1;

					var rotX = new THREE.Matrix4().makeRotationX(key.rot[0]);
					var rotY = new THREE.Matrix4().makeRotationY(key.rot[1]);
					var rotZ = new THREE.Matrix4().makeRotationZ(key.rot[2]);
					var rotM = new THREE.Matrix4();

					rotM.multiply(rotY);
					rotM.multiply(rotX);
					rotM.multiply(rotZ);

					key.rot = new THREE.Quaternion().setFromRotationMatrix(rotM);
					joint.keys.push(key);
				}
			}

			object.fps = 1 / frameTime;
			object.length = frameTime * numFrames;
		}

		while (lines.length) {
			var line = lines.shift().trim();
			switch (line) {
				case "HIERARCHY":
					object.hierarchy = parseHierarchy(lines);
					break;
				case "MOTION":
					parseMotion(object, lines);
					break;
			}
		}
		return object;
	}

};