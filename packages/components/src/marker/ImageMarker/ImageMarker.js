import { Component } from '@w3d/core';
import * as THREE from 'three';
import { Label3D } from '../../markers/Label3D/Label3D.js';

/**
 * Marker module component that displays image-based markers anchored to scene positions.
 */
export class ImageMarker extends Component {
    static defaultConfig = {
        markers: [],
        globalConfig: {
            type: 'sprite', // 'sprite' | 'plane'
            size: 5,
            opacity: 1.0,
            color: '#ffffff',
            sizeAttenuation: true
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        this.imageMarkers = new Map();

        this.markerDataMap = new Map();

        this.markerLabels = new Map();

        this.textureCache = new Map();

        this.textureLoader = new THREE.TextureLoader();

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Sprite = { threshold: 10 };
        this.mouse = new THREE.Vector2();
        this.hoveredMarker = null;

        this.positionAnimations = new Map(); // markerId -> animationData
    }

    async onMounted() {
        this.globalConfig = {
            ...this.constructor.defaultConfig.globalConfig,
            ...this.config.globalConfig
        };

        if (this.config.markers && this.config.markers.length > 0) {
            for (const markerData of this.config.markers) {
                await this.addMarker(markerData);
            }
        }

        this.setupMouseEvents();
    }


    async loadTexture(url) {
        if (this.textureCache.has(url)) {
            return this.textureCache.get(url);
        }

        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    this.textureCache.set(url, texture);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error(`Failed to load texture: ${url}`, error);
                    reject(error);
                }
            );
        });
    }


    async createMarker(markerData) {
        const {
            id,
            position,
            type = 'sprite',
            state,
            images,
            size = 5,
            scale = { x: 1, y: 1 },
            offset = { x: 0, y: 0, z: 0 },
            color = '#ffffff',
            opacity = 1.0,
            sizeAttenuation = true,
            userData = {}
        } = markerData;

        if (!id || !position || !images) {
            console.warn('ImageMarker: id, position, and images are required');
            return null;
        }

        const currentState = state || Object.keys(images)[0];
        const imageUrl = images[currentState];

        if (!imageUrl) {
            console.warn(`ImageMarker: No image found for state "${currentState}"`);
            return null;
        }

        let texture;
        try {
            texture = await this.loadTexture(imageUrl);
        } catch (error) {
            console.error(`ImageMarker: Failed to load image for marker "${id}"`, error);
            return null;
        }

        let markerObject;

        if (type === 'sprite') {
            const material = new THREE.SpriteMaterial({
                map: texture,
                color: new THREE.Color(color),
                opacity: opacity,
                transparent: true,
                sizeAttenuation: sizeAttenuation
            });

            markerObject = new THREE.Sprite(material);
            markerObject.scale.set(size * scale.x, size * scale.y, 1);
        } else if (type === 'plane') {
            const geometry = new THREE.PlaneGeometry(size * scale.x, size * scale.y);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                color: new THREE.Color(color),
                opacity: opacity,
                transparent: true,
                side: THREE.DoubleSide
            });

            markerObject = new THREE.Mesh(geometry, material);
        } else {
            console.warn(`ImageMarker: Unknown type "${type}", using sprite`);
            const material = new THREE.SpriteMaterial({
                map: texture,
                color: new THREE.Color(color),
                opacity: opacity,
                transparent: true,
                sizeAttenuation: sizeAttenuation
            });

            markerObject = new THREE.Sprite(material);
            markerObject.scale.set(size * scale.x, size * scale.y, 1);
        }

        markerObject.position.set(
            position.x + offset.x,
            position.y + offset.y,
            position.z + offset.z
        );

        markerObject.userData = {
            ...userData,
            markerId: id,
            markerType: type,
            isImageMarker: true
        };

        return markerObject;
    }

    async addMarker(markerData) {
        const { id, label } = markerData;

        if (!id) {
            console.warn('ImageMarker: id is required');
            return;
        }

        if (this.imageMarkers.has(id)) {
            console.warn(`ImageMarker: Marker with id "${id}" already exists`);
            return;
        }

        const markerObject = await this.createMarker(markerData);

        if (!markerObject) {
            return;
        }

        this.add(markerObject);

        this.imageMarkers.set(id, markerObject);

        const currentState = markerData.state || Object.keys(markerData.images)[0];
        this.markerDataMap.set(id, { ...markerData, state: currentState });

        if (label) {
            await this.createLabelForMarker(id, markerObject, label);
        }

        this.emit('markerAdded', { markerId: id, markerData });
    }

    async updateState(id, newState) {
        const markerObject = this.imageMarkers.get(id);
        const markerData = this.markerDataMap.get(id);

        if (!markerObject || !markerData) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        const { images } = markerData;
        const imageUrl = images[newState];

        if (!imageUrl) {
            console.warn(`ImageMarker: No image found for state "${newState}"`);
            return;
        }

        let texture;
        try {
            texture = await this.loadTexture(imageUrl);
        } catch (error) {
            console.error(`ImageMarker: Failed to load image for state "${newState}"`, error);
            return;
        }

        markerObject.material.map = texture;
        markerObject.material.needsUpdate = true;

        const oldState = markerData.state;

        markerData.state = newState;
        this.markerDataMap.set(id, markerData);

        this.emit('markerStateChanged', { markerId: id, oldState, newState });
    }

    updateMarker(id, updates) {
        const markerObject = this.imageMarkers.get(id);
        const markerData = this.markerDataMap.get(id);

        if (!markerObject || !markerData) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        if (updates.position) {
            const offset = markerData.offset || { x: 0, y: 0, z: 0 };
            markerObject.position.set(
                updates.position.x + offset.x,
                updates.position.y + offset.y,
                updates.position.z + offset.z
            );
        }

        if (updates.size !== undefined) {
            const scale = markerData.scale || { x: 1, y: 1 };
            if (markerObject.isSprite) {
                markerObject.scale.set(updates.size * scale.x, updates.size * scale.y, 1);
            } else {
                markerObject.scale.set(updates.size * scale.x, updates.size * scale.y, 1);
            }
        }

        if (updates.color) {
            markerObject.material.color.set(updates.color);
        }

        if (updates.opacity !== undefined) {
            markerObject.material.opacity = updates.opacity;
        }

        Object.assign(markerData, updates);
        this.markerDataMap.set(id, markerData);
    }

    removeMarker(id) {
        const markerObject = this.imageMarkers.get(id);

        if (!markerObject) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        this.removeLabelForMarker(id);

        if (this.positionAnimations.has(id)) {
            this.positionAnimations.delete(id);
        }

        this.remove(markerObject);

        if (markerObject.geometry) {
            markerObject.geometry.dispose();
        }
        if (markerObject.material) {
            markerObject.material.dispose();
        }

        this.imageMarkers.delete(id);
        this.markerDataMap.delete(id);

        this.emit('markerRemoved', { markerId: id });
    }

    getMarker(id) {
        return this.markerDataMap.get(id) || null;
    }

    getAllMarkers() {
        return Array.from(this.markerDataMap.values());
    }

    clearMarkers() {
        const ids = Array.from(this.imageMarkers.keys());
        ids.forEach((id) => this.removeMarker(id));
    }


    setupMouseEvents() {
        if (!this.scene || !this.scene.renderer || !this.scene.renderer.domElement) {
            console.warn(
                '[ImageMarker] Cannot setup mouse events: scene/renderer/domElement not ready'
            );
            return;
        }

        const domElement = this.scene.renderer.domElement;

        this.onMouseClick = this.handleMouseClick.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);

        domElement.addEventListener('click', this.onMouseClick);
        domElement.addEventListener('mousemove', this.onMouseMove);

        console.log('[ImageMarker] Mouse events setup successfully');
    }

    removeMouseEvents() {
        if (!this.scene || !this.scene.renderer || !this.scene.renderer.domElement) {
            return;
        }

        const domElement = this.scene.renderer.domElement;

        if (this.onMouseClick) {
            domElement.removeEventListener('click', this.onMouseClick);
        }
        if (this.onMouseMove) {
            domElement.removeEventListener('mousemove', this.onMouseMove);
        }
    }

    handleMouseClick(event) {
        console.log('[ImageMarker] handleMouseClick called', {
            clientX: event.clientX,
            clientY: event.clientY
        });

        const intersectedMarker = this.getIntersectedMarker(event);

        console.log('[ImageMarker] Intersected marker:', intersectedMarker);

        if (intersectedMarker) {
            const markerId = intersectedMarker.userData.markerId;
            const markerData = this.markerDataMap.get(markerId);

            console.log('[ImageMarker] Emitting markerClick event:', { markerId, markerData });

            this.emit('markerClick', {
                markerId,
                markerData,
                markerObject: intersectedMarker
            });
        } else {
            console.log('[ImageMarker] No marker intersected');
        }
    }

    handleMouseMove(event) {
        const intersectedMarker = this.getIntersectedMarker(event);

        if (intersectedMarker) {
            const markerId = intersectedMarker.userData.markerId;

            if (!this.hoveredMarker || this.hoveredMarker.userData.markerId !== markerId) {
                if (this.hoveredMarker) {
                    const prevMarkerId = this.hoveredMarker.userData.markerId;
                    const prevMarkerData = this.markerDataMap.get(prevMarkerId);

                    this.emit('markerMouseLeave', {
                        markerId: prevMarkerId,
                        markerData: prevMarkerData,
                        markerObject: this.hoveredMarker
                    });
                }

                const markerData = this.markerDataMap.get(markerId);
                this.emit('markerMouseEnter', {
                    markerId,
                    markerData,
                    markerObject: intersectedMarker
                });

                this.hoveredMarker = intersectedMarker;
            }
        } else {
            if (this.hoveredMarker) {
                const markerId = this.hoveredMarker.userData.markerId;
                const markerData = this.markerDataMap.get(markerId);

                this.emit('markerMouseLeave', {
                    markerId,
                    markerData,
                    markerObject: this.hoveredMarker
                });

                this.hoveredMarker = null;
            }
        }
    }

    getIntersectedMarker(event) {
        if (!this.scene || !this.scene.camera || !this.scene.renderer) {
            console.warn('[ImageMarker] getIntersectedMarker: scene/camera/renderer not ready');
            return null;
        }

        const domElement = this.scene.renderer.domElement;
        const rect = domElement.getBoundingClientRect();

        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        console.log('[ImageMarker] Mouse position:', {
            normalized: { x: this.mouse.x, y: this.mouse.y },
            client: { x: event.clientX, y: event.clientY },
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        });

        this.raycaster.setFromCamera(this.mouse, this.scene.camera);

        const markerObjects = Array.from(this.imageMarkers.values());

        console.log('[ImageMarker] Marker objects count:', markerObjects.length);
        console.log('[ImageMarker] Marker objects:', markerObjects);

        if (markerObjects.length === 0) {
            console.warn('[ImageMarker] No marker objects to intersect');
            return null;
        }

        const intersects = this.raycaster.intersectObjects(markerObjects, false);

        console.log('[ImageMarker] Intersects:', intersects);
        console.log('[ImageMarker] Raycaster params:', this.raycaster.params);

        if (intersects.length > 0) {
            console.log('[ImageMarker] Found intersection:', intersects[0]);
            return intersects[0].object;
        }

        console.log('[ImageMarker] No intersection found');
        return null;
    }


    updatePosition(id, newPosition, options = {}) {
        const markerObject = this.imageMarkers.get(id);
        const markerData = this.markerDataMap.get(id);

        if (!markerObject || !markerData) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        const { duration = 0, easing = 'linear' } = options;

        if (duration > 0) {
            this.animatePosition(id, markerObject, newPosition, duration, easing);
        } else {
            markerObject.position.set(newPosition.x, newPosition.y, newPosition.z);

            this.updateLabelPosition(id, markerObject);

            markerData.position = { ...newPosition };

            this.emit('positionUpdated', {
                markerId: id,
                newPosition,
                markerData
            });
        }
    }

    animatePosition(id, markerObject, targetPosition, duration, easing) {
        const startPosition = {
            x: markerObject.position.x,
            y: markerObject.position.y,
            z: markerObject.position.z
        };

        const startTime = Date.now();

        this.positionAnimations.set(id, {
            startPosition,
            targetPosition,
            startTime,
            duration,
            easing
        });
    }

    easeFunction(t, type) {
        switch (type) {
            case 'easeIn':
                return t * t;
            case 'easeOut':
                return t * (2 - t);
            case 'easeInOut':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            case 'linear':
            default:
                return t;
        }
    }


    async createLabelForMarker(markerId, markerObject, labelConfig) {
        const {
            text,
            offset = { x: 0, y: 2, z: 0 },
            fontSize = 16,
            color = '#ffffff',
            backgroundColor = 'rgba(0, 0, 0, 0.6)',
            borderColor = '#ffffff',
            borderWidth = 1,
            padding = 8,
            borderRadius = 4,
            visible = true
        } = labelConfig;

        if (!text) {
            console.warn('ImageMarker: Label text is required');
            return;
        }

        if (!this.labelComponent) {
            this.labelComponent = new Label3D(this.scene, {
                globalConfig: {
                    fontSize,
                    textColor: color,
                    backgroundColor,
                    borderColor,
                    borderWidth,
                    padding,
                    borderRadius,
                    scale: 0.05,
                    billboard: true,
                    depthTest: true,
                    sizeAttenuation: true
                }
            });
            this.add(this.labelComponent);
        }

        const labelPosition = {
            x: markerObject.position.x + offset.x,
            y: markerObject.position.y + offset.y,
            z: markerObject.position.z + offset.z
        };

        await this.labelComponent.createLabel({
            id: `marker-label-${markerId}`,
            label: text,
            position: labelPosition,
            userData: { markerId },
            config: {
                fontSize,
                textColor: color,
                backgroundColor,
                borderColor,
                borderWidth,
                padding,
                borderRadius
            }
        });

        this.markerLabels.set(markerId, {
            labelId: `marker-label-${markerId}`,
            offset,
            visible
        });

        if (!visible) {
            this.labelComponent.hideLabel(`marker-label-${markerId}`);
        }
    }

    async updateLabel(markerId, updates) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            console.warn(`ImageMarker: No label found for marker "${markerId}"`);
            return;
        }

        const { labelId } = labelInfo;

        await this.labelComponent.updateLabel(labelId, updates);

        if (updates.offset) {
            labelInfo.offset = updates.offset;
            const markerObject = this.imageMarkers.get(markerId);
            if (markerObject) {
                this.updateLabelPosition(markerId, markerObject);
            }
        }
    }

    updateLabelPosition(markerId, markerObject) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            return;
        }

        const { labelId, offset } = labelInfo;

        const newPosition = {
            x: markerObject.position.x + offset.x,
            y: markerObject.position.y + offset.y,
            z: markerObject.position.z + offset.z
        };

        this.labelComponent.updateLabel(labelId, { position: newPosition });
    }

    showLabel(markerId) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            console.warn(`ImageMarker: No label found for marker "${markerId}"`);
            return;
        }

        this.labelComponent.showLabel(labelInfo.labelId);
        labelInfo.visible = true;
    }

    hideLabel(markerId) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            console.warn(`ImageMarker: No label found for marker "${markerId}"`);
            return;
        }

        this.labelComponent.hideLabel(labelInfo.labelId);
        labelInfo.visible = false;
    }

    removeLabelForMarker(markerId) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            return;
        }

        this.labelComponent.removeLabel(labelInfo.labelId);
        this.markerLabels.delete(markerId);
    }


    onUpdate(delta) {
        const now = Date.now();
        const completedAnimations = [];

        this.positionAnimations.forEach((animData, markerId) => {
            const { startPosition, targetPosition, startTime, duration, easing } = animData;
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easedProgress = this.easeFunction(progress, easing);

            const markerObject = this.imageMarkers.get(markerId);
            if (markerObject) {
                markerObject.position.x =
                    startPosition.x + (targetPosition.x - startPosition.x) * easedProgress;
                markerObject.position.y =
                    startPosition.y + (targetPosition.y - startPosition.y) * easedProgress;
                markerObject.position.z =
                    startPosition.z + (targetPosition.z - startPosition.z) * easedProgress;

                this.updateLabelPosition(markerId, markerObject);

                if (progress >= 1) {
                    completedAnimations.push(markerId);

                    const markerData = this.markerDataMap.get(markerId);
                    if (markerData) {
                        markerData.position = { ...targetPosition };
                    }

                    this.emit('positionUpdated', {
                        markerId,
                        newPosition: targetPosition,
                        markerData
                    });
                }
            }
        });

        completedAnimations.forEach((markerId) => {
            this.positionAnimations.delete(markerId);
        });

        if (this.labelComponent && this.labelComponent.onUpdate) {
            this.labelComponent.onUpdate(delta);
        }
    }

    onDispose() {
        this.removeMouseEvents();

        this.clearMarkers();

        if (this.labelComponent) {
            this.labelComponent.onDispose();
            this.remove(this.labelComponent);
            this.labelComponent = null;
        }

        this.textureCache.forEach((texture) => {
            texture.dispose();
        });
        this.textureCache.clear();

        this.positionAnimations.clear();
    }
}

export default ImageMarker;
