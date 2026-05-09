import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
 */
export class DXFLoader extends Component {
    /**
     * English comment.
     */
    static defaultConfig = {
        url: '',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
        // English comment.
        fonts: null, // English comment.
        clearColor: new THREE.Color('#000000'), // English comment.
        clearAlpha: 0, // English comment.
        autoResize: false, // English comment.
        colorCorrection: true, // English comment.
        // English comment.
        showLayers: true,
        visibleLayers: null, // English comment.
        // English comment.
        enableInteraction: true,
        // English comment.
        canvasAlpha: true,
        canvasPremultipliedAlpha: false,
        antialias: true,
        preserveDrawingBuffer: false
    };

    /**
     * English comment.
     */
    async onMounted() {
        // English comment.
        this.dxfData = null;
        this.viewer = null;
        this.dxfGroup = null;
        this.interactiveObjects = [];
        this.layersMap = new Map();

        // English comment.
        this.loadDXF()
            .then(() => {
                // English comment.
                this.setupInteractiveObjects();
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('DXFLoader: DXF loading failed in onMounted', error);
            });
    }

    /**
     * English comment.
     */
    async loadDXF() {
        if (!this.config.url) {
            // eslint-disable-next-line no-console
            console.warn('DXFLoader: url is required');
            return;
        }

        try {
            // English comment.
            this.emit('loadStart', { url: this.config.url });

            // English comment.
            // eslint-disable-next-line no-undef
            const response = await fetch(this.config.url);
            if (!response.ok) {
                throw new Error(`Failed to load DXF file: ${response.statusText}`);
            }

            const dxfString = await response.text();

            // English comment.
            this.emit('loadProgress', { progress: 0.5 });

            // English comment.
            const { default: DxfParser } = await import('dxf-parser');
            const parser = new DxfParser();
            this.dxfData = parser.parseSync(dxfString);

            if (!this.dxfData) {
                throw new Error('Failed to parse DXF file');
            }

            // eslint-disable-next-line no-console
            console.log('DXF parsed successfully:', this.dxfData);

            // English comment.
            this.emit('loadProgress', { progress: 0.75 });

            // English comment.
            this.createGeometry();

            // English comment.
            this.applyTransform();

            // English comment.
            if (this.config.visibleLayers) {
                this.setVisibleLayers(this.config.visibleLayers);
            }

            /* English comment. */
            const box = new THREE.Box3().setFromObject(this.dxfGroup);
            this.dxfGroup.position.set(
                -box.min.x - (box.max.x - box.min.x) / 2,
                -box.min.y - (box.max.y - box.min.y) / 2,
                -box.min.z - (box.max.z - box.min.z) / 2
            );

            // English comment.
            this.emit('loadProgress', { progress: 1.0 });

            // English comment.
            this.emit('loadComplete', {
                dxfData: this.dxfData
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('DXFLoader: Failed to load DXF file', error);
            this.emit('error', { error, url: this.config.url });
            throw error;
        }
    }

    /**
     * English comment.
     */
    createGeometry() {
        if (!this.dxfData) {
            return;
        }

        try {
            // English comment.
            this.dxfGroup = new THREE.Group();
            this.dxfGroup.name = 'DXF_Content';

            // English comment.
            if (this.dxfData.tables && this.dxfData.tables.layer) {
                Object.keys(this.dxfData.tables.layer.layers).forEach((layerName) => {
                    const layer = this.dxfData.tables.layer.layers[layerName];
                    this.layersMap.set(layerName, {
                        name: layerName,
                        displayName: layerName,
                        color: layer.color || 7, // English comment.
                        visible: true
                    });
                });
            }

            // English comment.
            if (this.dxfData.entities && this.dxfData.entities.length > 0) {
                this.dxfData.entities.forEach((entity) => {
                    const object = this.createEntityObject(entity);
                    if (object) {
                        this.dxfGroup.add(object);
                    }
                });
            }

            // English comment.
            this.add(this.dxfGroup);
            // English comment.
            this.dxfGroup.updateMatrixWorld();
            this.dxfGroup.geometryBBox = new THREE.Box3().setFromObject(this.dxfGroup);
            this.dxfGroup.geometryCenter = this.dxfGroup.geometryBBox.getCenter(
                new THREE.Vector3()
            );
            this.dxfGroup.geometrySize = this.dxfGroup.geometryBBox.getSize(new THREE.Vector3());
            this.dxfGroup.geometryScale = this.dxfGroup.geometrySize.length();
            this.dxfGroup.geometryAspect =
                this.dxfGroup.geometrySize.x / this.dxfGroup.geometrySize.y;

            // eslint-disable-next-line no-console
            console.log('DXF geometry created, entities:', this.dxfData.entities?.length || 0);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('DXFLoader: Failed to create geometry', error);
            throw error;
        }
    }

    /**
     * English comment.
     */
    createEntityObject(entity) {
        try {
            let object = null;

            switch (entity.type) {
            case 'LINE':
                object = this.createLine(entity);
                break;
            case 'LWPOLYLINE':
            case 'POLYLINE':
                object = this.createPolyline(entity);
                break;
            case 'CIRCLE':
                object = this.createCircle(entity);
                break;
            case 'ARC':
                object = this.createArc(entity);
                break;
            case 'SPLINE':
                object = this.createSpline(entity);
                break;
            default:
                // English comment.
                break;
            }

            if (object && entity.layer) {
                object.userData.layer = entity.layer;
            }

            return object;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('DXFLoader: Failed to create entity:', entity.type, error);
            return null;
        }
    }

    /**
     * English comment.
     */
    createLine(entity) {
        const points = [];
        points.push(
            new THREE.Vector3(entity.vertices[0].x, entity.vertices[0].y, entity.vertices[0].z || 0)
        );
        points.push(
            new THREE.Vector3(entity.vertices[1].x, entity.vertices[1].y, entity.vertices[1].z || 0)
        );

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.getEntityColor(entity)
        });

        return new THREE.Line(geometry, material);
    }

    /**
     * English comment.
     */
    createPolyline(entity) {
        const points = [];
        entity.vertices.forEach((vertex) => {
            points.push(new THREE.Vector3(vertex.x, vertex.y, vertex.z || 0));
        });

        // English comment.
        if (entity.shape && points.length > 0) {
            points.push(points[0].clone());
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.getEntityColor(entity)
        });

        return new THREE.Line(geometry, material);
    }

    /**
     * English comment.
     */
    createCircle(entity) {
        const curve = new THREE.EllipseCurve(
            entity.center.x,
            entity.center.y,
            entity.radius,
            entity.radius,
            0,
            2 * Math.PI,
            false,
            0
        );

        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.getEntityColor(entity)
        });

        const circle = new THREE.Line(geometry, material);
        circle.position.z = entity.center.z || 0;

        return circle;
    }

    /**
     * English comment.
     */
    createArc(entity) {
        const curve = new THREE.EllipseCurve(
            entity.center.x,
            entity.center.y,
            entity.radius,
            entity.radius,
            entity.startAngle,
            entity.endAngle,
            false,
            0
        );

        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.getEntityColor(entity)
        });

        const arc = new THREE.Line(geometry, material);
        arc.position.z = entity.center.z || 0;

        return arc;
    }

    /**
     * English comment.
     */
    createSpline(entity) {
        if (!entity.controlPoints || entity.controlPoints.length < 2) {
            return null;
        }

        const points = entity.controlPoints.map((cp) => new THREE.Vector3(cp.x, cp.y, cp.z || 0));

        const curve = new THREE.CatmullRomCurve3(points);
        const curvePoints = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const material = new THREE.LineBasicMaterial({
            color: this.getEntityColor(entity)
        });

        return new THREE.Line(geometry, material);
    }

    /**
     * English comment.
     */
    getEntityColor(entity) {
        // English comment.
        const autocadColors = {
            1: 0xff0000, // English comment.
            2: 0xffff00, // English comment.
            3: 0x00ff00, // English comment.
            4: 0x00ffff, // English comment.
            5: 0x0000ff, // English comment.
            6: 0xff00ff, // English comment.
            7: 0xffffff, // English comment.
            8: 0x808080, // English comment.
            9: 0xc0c0c0 // English comment.
        };

        if (entity.color !== undefined && entity.color !== 256) {
            // English comment.
            return autocadColors[entity.color] || 0xffffff;
        }

        // English comment.
        if (entity.layer && this.layersMap.has(entity.layer)) {
            const layerColor = this.layersMap.get(entity.layer).color;
            return autocadColors[layerColor] || 0xffffff;
        }

        return 0xffffff; // English comment.
    }

    /**
     * English comment.
     */
    applyTransform() {
        if (!this.dxfGroup) {
            return;
        }

        // English comment.
        if (this.config.position) {
            const [x, y, z] = this.config.position;
            this.dxfGroup.position.set(x, y, z);
        }

        // English comment.
        if (this.config.rotation) {
            const [x, y, z] = this.config.rotation;
            this.dxfGroup.rotation.set(x, y, z);
        }

        // English comment.
        if (this.config.scale) {
            const scale = this.config.scale;
            if (typeof scale === 'number') {
                this.dxfGroup.scale.set(scale, scale, scale);
            } else if (Array.isArray(scale)) {
                const [sx, sy, sz] = scale;
                this.dxfGroup.scale.set(sx, sy, sz);
            }
        }
    }

    /**
     * English comment.
     */
    setVisibleLayers(layerNames) {
        if (!this.dxfGroup) {
            return;
        }

        const layerSet = new Set(layerNames);

        this.dxfGroup.traverse((object) => {
            if (object.userData && object.userData.layer) {
                object.visible = layerSet.has(object.userData.layer);
            }
        });
    }

    /**
     * English comment.
     */
    getLayers() {
        return Array.from(this.layersMap.keys());
    }

    /**
     * English comment.
     */
    getLayersInfo() {
        return Array.from(this.layersMap.values());
    }

    /**
     * English comment.
     */
    setLayerVisible(layerName, visible) {
        // English comment.
        const layerInfo = this.layersMap.get(layerName);
        if (layerInfo) {
            layerInfo.visible = visible;
        }

        // English comment.
        if (this.dxfGroup) {
            this.dxfGroup.traverse((object) => {
                if (object.userData && object.userData.layer === layerName) {
                    object.visible = visible;
                }
            });
        }
    }

    /**
     * English comment.
     */
    setupInteractiveObjects() {
        if (!this.config.enableInteraction || !this.dxfGroup) {
            return;
        }

        // English comment.
        this.interactiveObjects = [];
        this.dxfGroup.traverse((object) => {
            if (object.isMesh || object.isLine) {
                this.interactiveObjects.push(object);
            }
        });
    }

    /**
     * English comment.
     */
    getInteractiveObjects() {
        return this.interactiveObjects;
    }

    /**
     * English comment.
     */
    onDispose() {
        // English comment.
        this.dxfData = null;

        // English comment.
        if (this.dxfGroup) {
            this.dxfGroup.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach((material) => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
            this.dxfGroup = null;
        }

        // English comment.
        this.layersMap.clear();

        // English comment.
        this.interactiveObjects = [];
    }
}
