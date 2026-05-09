
import * as THREE from 'three';

export class MeshLineGeometry extends THREE.BufferGeometry {
    constructor() {
        super();

        this.isMeshLine = true;
        this.type = 'MeshLine';

        this.positions = [];
        this.previous = [];
        this.next = [];
        this.side = [];
        this.width = [];
        this.indices_array = [];
        this.uvs = [];
        this.counters = [];
        this._points = [];
        this._geom = null;

        this.widthCallback = null;

        this.matrixWorld = new THREE.Matrix4();
    }


    get geometry() {
        return this;
    }

    get geom() {
        return this._geom;
    }
    set geom(value) {
        this.setGeometry(value, this.widthCallback);
    }

    get points() {
        return this._points;
    }
    set points(value) {
        this.setPoints(value, this.widthCallback);
    }


    setMatrixWorld(matrixWorld) {
        this.matrixWorld = matrixWorld;
    }

    setGeometry(g, c) {
        this._geometry = g;
        this.setPoints(g.getAttribute('position').array, c);
    }

    setPoints(points, wcb) {
        if (!(points instanceof Float32Array) && !(points instanceof Array)) {
            console.error('MeshLineGeometry: points must be Float32Array or Array');
            return;
        }

        this._points = points;
        this.widthCallback = wcb;
        this.positions = [];
        this.counters = [];

        if (points.length && points[0] instanceof THREE.Vector3) {
            for (let j = 0; j < points.length; j++) {
                const p = points[j];
                const c = j / points.length;
                this.positions.push(p.x, p.y, p.z);
                this.positions.push(p.x, p.y, p.z);
                this.counters.push(c);
                this.counters.push(c);
            }
        } else {
            for (let j = 0; j < points.length; j += 3) {
                const c = j / points.length;
                this.positions.push(points[j], points[j + 1], points[j + 2]);
                this.positions.push(points[j], points[j + 1], points[j + 2]);
                this.counters.push(c);
                this.counters.push(c);
            }
        }

        this.process();
    }

    compareV3(a, b) {
        const aa = a * 6;
        const ab = b * 6;
        return (
            this.positions[aa] === this.positions[ab] &&
            this.positions[aa + 1] === this.positions[ab + 1] &&
            this.positions[aa + 2] === this.positions[ab + 2]
        );
    }

    copyV3(a) {
        const aa = a * 6;
        return [this.positions[aa], this.positions[aa + 1], this.positions[aa + 2]];
    }

    process() {
        const l = this.positions.length / 6;

        this.previous = [];
        this.next = [];
        this.side = [];
        this.width = [];
        this.indices_array = [];
        this.uvs = [];

        let w, v;

        if (this.compareV3(0, l - 1)) {
            v = this.copyV3(l - 2);
        } else {
            v = this.copyV3(0);
        }
        this.previous.push(v[0], v[1], v[2]);
        this.previous.push(v[0], v[1], v[2]);

        for (let j = 0; j < l; j++) {
            // side
            this.side.push(1);
            this.side.push(-1);

            // width
            if (this.widthCallback) {
                w = this.widthCallback(j / (l - 1));
            } else {
                w = 1;
            }
            this.width.push(w);
            this.width.push(w);

            // uv
            this.uvs.push(j / (l - 1), 0);
            this.uvs.push(j / (l - 1), 1);

            if (j < l - 1) {
                v = this.copyV3(j);
                this.previous.push(v[0], v[1], v[2]);
                this.previous.push(v[0], v[1], v[2]);

                const n = j * 2;
                this.indices_array.push(n, n + 1, n + 2);
                this.indices_array.push(n + 2, n + 1, n + 3);
            }

            if (j > 0) {
                v = this.copyV3(j);
                this.next.push(v[0], v[1], v[2]);
                this.next.push(v[0], v[1], v[2]);
            }
        }

        if (this.compareV3(l - 1, 0)) {
            v = this.copyV3(1);
        } else {
            v = this.copyV3(l - 1);
        }
        this.next.push(v[0], v[1], v[2]);
        this.next.push(v[0], v[1], v[2]);

        if (
            !this._attributes ||
            this._attributes.position.count !== this.positions.length
        ) {
            this._attributes = {
                position: new THREE.BufferAttribute(new Float32Array(this.positions), 3),
                previous: new THREE.BufferAttribute(new Float32Array(this.previous), 3),
                next: new THREE.BufferAttribute(new Float32Array(this.next), 3),
                side: new THREE.BufferAttribute(new Float32Array(this.side), 1),
                width: new THREE.BufferAttribute(new Float32Array(this.width), 1),
                uv: new THREE.BufferAttribute(new Float32Array(this.uvs), 2),
                index: new THREE.BufferAttribute(new Uint16Array(this.indices_array), 1),
                counters: new THREE.BufferAttribute(new Float32Array(this.counters), 1),
            };
        } else {
            this._attributes.position.copyArray(new Float32Array(this.positions));
            this._attributes.position.needsUpdate = true;
            this._attributes.previous.copyArray(new Float32Array(this.previous));
            this._attributes.previous.needsUpdate = true;
            this._attributes.next.copyArray(new Float32Array(this.next));
            this._attributes.next.needsUpdate = true;
            this._attributes.side.copyArray(new Float32Array(this.side));
            this._attributes.side.needsUpdate = true;
            this._attributes.width.copyArray(new Float32Array(this.width));
            this._attributes.width.needsUpdate = true;
            this._attributes.uv.copyArray(new Float32Array(this.uvs));
            this._attributes.uv.needsUpdate = true;
            this._attributes.index.copyArray(new Uint16Array(this.indices_array));
            this._attributes.index.needsUpdate = true;
        }

        this.setAttribute('position', this._attributes.position);
        this.setAttribute('previous', this._attributes.previous);
        this.setAttribute('next', this._attributes.next);
        this.setAttribute('side', this._attributes.side);
        this.setAttribute('width', this._attributes.width);
        this.setAttribute('uv', this._attributes.uv);
        this.setAttribute('counters', this._attributes.counters);

        this.setIndex(this._attributes.index);

        this.computeBoundingSphere();
        this.computeBoundingBox();
    }

    advance(position) {
        const positions = this._attributes.position.array;
        const previous = this._attributes.previous.array;
        const next = this._attributes.next.array;
        const l = positions.length;

        // PREVIOUS
        memcpy(positions, 0, previous, 0, l);

        // POSITIONS
        memcpy(positions, 6, positions, 0, l - 6);
        positions[l - 6] = position.x;
        positions[l - 5] = position.y;
        positions[l - 4] = position.z;
        positions[l - 3] = position.x;
        positions[l - 2] = position.y;
        positions[l - 1] = position.z;

        // NEXT
        memcpy(positions, 6, next, 0, l - 6);
        next[l - 6] = position.x;
        next[l - 5] = position.y;
        next[l - 4] = position.z;
        next[l - 3] = position.x;
        next[l - 2] = position.y;
        next[l - 1] = position.z;

        this._attributes.position.needsUpdate = true;
        this._attributes.previous.needsUpdate = true;
        this._attributes.next.needsUpdate = true;
    }
}

function memcpy(src, srcOffset, dst, dstOffset, length) {
    src = src.subarray ? src.subarray(srcOffset, length && srcOffset + length) : src.slice(srcOffset, length && srcOffset + length);
    if (dst.set) {
        dst.set(src, dstOffset);
    } else {
        for (let i = 0; i < src.length; i++) {
            dst[i + dstOffset] = src[i];
        }
    }
    return dst;
}
