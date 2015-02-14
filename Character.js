THREE.Character = function () {

    THREE.Object3D.call( this );

    this._head = null;
    this._body = null;
    this._meshes = [];

};


THREE.Character.prototype = Object.create( THREE.Object3D.prototype );

THREE.Character.prototype.updateMeshes = function() {

};

THREE.Character.prototype.setBody = function(actor, tint, callback) {
    if (this._body) {
        this.remove(this._body);
    }
    var me = this;
    var body = new THREE.Actor();
    me.add(body);
    this._body = body;

    body.load(actor, {tint: tint, skinning: true}, function() {
        if (callback) {
            callback();
        }
    });
};

THREE.Character.prototype.setHead = function(actor, callback) {
    if (this._head) {
        this.remove(this._head);
    }
    var head = new THREE.Actor();
    this.add(head);
    this._head = head;

    head.load(actor, {skinning: true}, function() {
        if (callback) {
            callback();
        }
    });
};


THREE.Character.prototype.setHelmet = function(actor, tint, callback) {
    if (this._helmet) {
        this.remove(this._helmet);
    }
    var helmet = new THREE.Actor();
    this.add(helmet);
    this._helmet = helmet;

    helmet.load(actor, {tint: tint,skinning: true}, function() {
        if (callback) {
            callback();
        }
    });
};


THREE.Character.prototype.setAttachment = function(actor, callback) {
    var attachment = new THREE.Actor();
    this.add(attachment);
    var body = this._body;
    attachment.load(actor, {skinning: false}, function() {
        body.attach(attachment);

        if (callback) {
            callback();
        }
    });
};

THREE.Character.prototype.setAnimation = function(filename, callback) {

    var loader = new THREE.BVHLoader();
    var me = this;
    loader.load(filename, function(anim) {
        me._body.setAnimation(anim);
        me._head.setAnimation(anim);
        me._helmet.setAnimation(anim);
        if (callback) {
            callback();
        }
    });
};

THREE.Character.prototype.pose = function() {
    this._body.pose();
    this._head.pose();
};
