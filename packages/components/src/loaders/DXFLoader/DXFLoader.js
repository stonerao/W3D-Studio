import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Loader module component that parses DXF drawings into Three.js scene objects for CAD-style visualization.
 */
export class DXFLoader extends Component {
    static defaultConfig = {
        url: '',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
        fonts: null,
        clearColor: new THREE.Color('#000000'),
        clearAlpha: 0,
        autoResize: false,
        colorCorrection: true,
        showLayers: true,
        visibleLayers: null,
        enableInteraction: true,
        canvasAlpha: true,
        canvasPremultipliedAlpha: false,
        antialias: true,
        preserveDrawingBuffer: false
    };

    async onMounted() {
        this.dxfData = null;
        this.viewer = null;
        this.dxfGroup = null;
        this.interactiveObjects = [];
        this.layersMap = new Map();

        this.loadDXF()
            .then(() => {
                this.setupInteractiveObjects();
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('DXFLoader: DXF loading failed in onMounted', error);
            });
    }

    async loadDXF() {
        if (!this.config.url) {
            // eslint-disable-next-line no-console
            console.warn('DXFLoader: url is required');
            return;
        }

        try {
            this.emit('loadStart', { url: this.config.url });

            // eslint-disable-next-line no-undef
            const response = await fetch(this.config.url);
            if (!response.ok) {
                throw new Error(`Failed to load DXF file: ${response.statusText}`);
            }

            const dxfString = await response.text();

            this.emit('loadProgress', { progress: 0.5 });

            const { default: DxfParser } = await import('dxf-parser');
            const parser = new DxfParser();
            this.dxfData = parser.parseSync(dxfString);

            if (!this.dxfData) {
                throw new Error('Failed to parse DXF file');
            }

            // eslint-disable-next-line no-console
            console.log('DXF parsed successfully:', this.dxfData);

            this.emit('loadProgress', { progress: 0.75 });

            this.createGeometry();

            this.applyTransform();

            if (this.config.visibleLayers) {
                this.setVisibleLayers(this.config.visibleLayers);
            }


            const box = new THREE.Box3().setFromObject(this.dxfGroup);
            this.dxfGroup.position.set(
                -box.min.x - (box.max.x - box.min.x) / 2,
                -box.min.y - (box.max.y - box.min.y) / 2,
                -box.min.z - (box.max.z - box.min.z) / 2
            );

            this.emit('loadProgress', { progress: 1.0 });

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

    createGeometry() {
        if (!this.dxfData) {
            return;
        }

        try {
            this.dxfGroup = new THREE.Group();
            this.dxfGroup.name = 'DXF_Content';

            if (this.dxfData.tables && this.dxfData.tables.layer) {
                Object.keys(this.dxfData.tables.layer.layers).forEach((layerName) => {
                    const layer = this.dxfData.tables.layer.layers[layerName];
                    this.layersMap.set(layerName, {
                        name: layerName,
                        displayName: layerName,
                        color: layer.color || 7,
                        visible: true
                    });
                });
            }

            if (this.dxfData.entities && this.dxfData.entities.length > 0) {
                this.dxfData.entities.forEach((entity) => {
                    const object = this.createEntityObject(entity);
                    if (object) {
                        this.dxfGroup.add(object);
                    }
                });
            }

            this.add(this.dxfGroup);
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

    createPolyline(entity) {
        const points = [];
        entity.vertices.forEach((vertex) => {
            points.push(new THREE.Vector3(vertex.x, vertex.y, vertex.z || 0));
        });

        if (entity.shape && points.length > 0) {
            points.push(points[0].clone());
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.getEntityColor(entity)
        });

        return new THREE.Line(geometry, material);
    }

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

    getEntityColor(entity) {
        const autocadColors = {
            1: 0xff0000,
            2: 0xffff00,
            3: 0x00ff00,
            4: 0x00ffff,
            5: 0x0000ff,
            6: 0xff00ff,
            7: 0xffffff,
            8: 0x808080,
            9: 0xc0c0c0
        };

        if (entity.color !== undefined && entity.color !== 256) {
            return autocadColors[entity.color] || 0xffffff;
        }

        if (entity.layer && this.layersMap.has(entity.layer)) {
            const layerColor = this.layersMap.get(entity.layer).color;
            return autocadColors[layerColor] || 0xffffff;
        }

        return 0xffffff;
    }

    applyTransform() {
        if (!this.dxfGroup) {
            return;
        }

        if (this.config.position) {
            const [x, y, z] = this.config.position;
            this.dxfGroup.position.set(x, y, z);
        }

        if (this.config.rotation) {
            const [x, y, z] = this.config.rotation;
            this.dxfGroup.rotation.set(x, y, z);
        }

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

    getLayers() {
        return Array.from(this.layersMap.keys());
    }

    getLayersInfo() {
        return Array.from(this.layersMap.values());
    }

    setLayerVisible(layerName, visible) {
        const layerInfo = this.layersMap.get(layerName);
        if (layerInfo) {
            layerInfo.visible = visible;
        }

        if (this.dxfGroup) {
            this.dxfGroup.traverse((object) => {
                if (object.userData && object.userData.layer === layerName) {
                    object.visible = visible;
                }
            });
        }
    }

    setupInteractiveObjects() {
        if (!this.config.enableInteraction || !this.dxfGroup) {
            return;
        }

        this.interactiveObjects = [];
        this.dxfGroup.traverse((object) => {
            if (object.isMesh || object.isLine) {
                this.interactiveObjects.push(object);
            }
        });
    }

    getInteractiveObjects() {
        return this.interactiveObjects;
    }

    onDispose() {
        this.dxfData = null;

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

        this.layersMap.clear();

        this.interactiveObjects = [];
    }
}
