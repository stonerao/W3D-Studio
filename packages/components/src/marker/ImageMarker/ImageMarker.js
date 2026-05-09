import { Component } from '@w3d/core';
import * as THREE from 'three';
import { Label3D } from '../../markers/Label3D/Label3D.js';

/**
 * English comment.
 */
export class ImageMarker extends Component {
    static defaultConfig = {
        markers: [], // English comment.
        globalConfig: {
            // English comment.
            type: 'sprite', // 'sprite' | 'plane'
            size: 5,
            opacity: 1.0,
            color: '#ffffff',
            sizeAttenuation: true // English comment.
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        // English comment.
        this.imageMarkers = new Map();

        // English comment.
        this.markerDataMap = new Map();

        // English comment.
        this.markerLabels = new Map();

        // English comment.
        this.textureCache = new Map();

        // English comment.
        this.textureLoader = new THREE.TextureLoader();

        // English comment.
        this.raycaster = new THREE.Raycaster();
        // English comment.
        this.raycaster.params.Sprite = { threshold: 10 };
        this.mouse = new THREE.Vector2();
        this.hoveredMarker = null;

        // English comment.
        this.positionAnimations = new Map(); // markerId -> animationData
    }

    /**
     * English comment.
     */
    async onMounted() {
        // English comment.
        this.globalConfig = {
            ...this.constructor.defaultConfig.globalConfig,
            ...this.config.globalConfig
        };

        // English comment.
        if (this.config.markers && this.config.markers.length > 0) {
            for (const markerData of this.config.markers) {
                await this.addMarker(markerData);
            }
        }

        // English comment.
        this.setupMouseEvents();
    }

    // English comment.

    /**
     * English comment.
     */
    async loadTexture(url) {
        // English comment.
        if (this.textureCache.has(url)) {
            return this.textureCache.get(url);
        }

        // English comment.
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    // English comment.
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

    // English comment.

    /**
     * English comment.
     */
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

        // English comment.
        if (!id || !position || !images) {
            console.warn('ImageMarker: id, position, and images are required');
            return null;
        }

        // English comment.
        const currentState = state || Object.keys(images)[0];
        const imageUrl = images[currentState];

        if (!imageUrl) {
            console.warn(`ImageMarker: No image found for state "${currentState}"`);
            return null;
        }

        // English comment.
        let texture;
        try {
            texture = await this.loadTexture(imageUrl);
        } catch (error) {
            console.error(`ImageMarker: Failed to load image for marker "${id}"`, error);
            return null;
        }

        let markerObject;

        if (type === 'sprite') {
            // English comment.
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
            // English comment.
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
            // English comment.
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

        // English comment.
        markerObject.position.set(
            position.x + offset.x,
            position.y + offset.y,
            position.z + offset.z
        );

        // English comment.
        markerObject.userData = {
            ...userData,
            markerId: id,
            markerType: type,
            isImageMarker: true
        };

        return markerObject;
    }

    /**
     * English comment.
     */
    async addMarker(markerData) {
        const { id, label } = markerData;

        if (!id) {
            console.warn('ImageMarker: id is required');
            return;
        }

        // English comment.
        if (this.imageMarkers.has(id)) {
            console.warn(`ImageMarker: Marker with id "${id}" already exists`);
            return;
        }

        // English comment.
        const markerObject = await this.createMarker(markerData);

        if (!markerObject) {
            return;
        }

        // English comment.
        this.add(markerObject);

        // English comment.
        this.imageMarkers.set(id, markerObject);

        // English comment.
        const currentState = markerData.state || Object.keys(markerData.images)[0];
        this.markerDataMap.set(id, { ...markerData, state: currentState });

        // English comment.
        if (label) {
            await this.createLabelForMarker(id, markerObject, label);
        }

        // English comment.
        this.emit('markerAdded', { markerId: id, markerData });
    }

    /**
     * English comment.
     */
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

        // English comment.
        let texture;
        try {
            texture = await this.loadTexture(imageUrl);
        } catch (error) {
            console.error(`ImageMarker: Failed to load image for state "${newState}"`, error);
            return;
        }

        // English comment.
        markerObject.material.map = texture;
        markerObject.material.needsUpdate = true;

        // English comment.
        const oldState = markerData.state;

        // English comment.
        markerData.state = newState;
        this.markerDataMap.set(id, markerData);

        // English comment.
        this.emit('markerStateChanged', { markerId: id, oldState, newState });
    }

    /**
     * English comment.
     */
    updateMarker(id, updates) {
        const markerObject = this.imageMarkers.get(id);
        const markerData = this.markerDataMap.get(id);

        if (!markerObject || !markerData) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        // English comment.
        if (updates.position) {
            const offset = markerData.offset || { x: 0, y: 0, z: 0 };
            markerObject.position.set(
                updates.position.x + offset.x,
                updates.position.y + offset.y,
                updates.position.z + offset.z
            );
        }

        // English comment.
        if (updates.size !== undefined) {
            const scale = markerData.scale || { x: 1, y: 1 };
            if (markerObject.isSprite) {
                markerObject.scale.set(updates.size * scale.x, updates.size * scale.y, 1);
            } else {
                markerObject.scale.set(updates.size * scale.x, updates.size * scale.y, 1);
            }
        }

        // English comment.
        if (updates.color) {
            markerObject.material.color.set(updates.color);
        }

        // English comment.
        if (updates.opacity !== undefined) {
            markerObject.material.opacity = updates.opacity;
        }

        // English comment.
        Object.assign(markerData, updates);
        this.markerDataMap.set(id, markerData);
    }

    /**
     * English comment.
     */
    removeMarker(id) {
        const markerObject = this.imageMarkers.get(id);

        if (!markerObject) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        // English comment.
        this.removeLabelForMarker(id);

        // English comment.
        if (this.positionAnimations.has(id)) {
            this.positionAnimations.delete(id);
        }

        // English comment.
        this.remove(markerObject);

        // English comment.
        if (markerObject.geometry) {
            markerObject.geometry.dispose();
        }
        if (markerObject.material) {
            markerObject.material.dispose();
        }

        // English comment.
        this.imageMarkers.delete(id);
        this.markerDataMap.delete(id);

        // English comment.
        this.emit('markerRemoved', { markerId: id });
    }

    /**
     * English comment.
     */
    getMarker(id) {
        return this.markerDataMap.get(id) || null;
    }

    /**
     * English comment.
     */
    getAllMarkers() {
        return Array.from(this.markerDataMap.values());
    }

    /**
     * English comment.
     */
    clearMarkers() {
        const ids = Array.from(this.imageMarkers.keys());
        ids.forEach((id) => this.removeMarker(id));
    }

    // English comment.

    /**
     * English comment.
     */
    setupMouseEvents() {
        if (!this.scene || !this.scene.renderer || !this.scene.renderer.domElement) {
            console.warn(
                '[ImageMarker] Cannot setup mouse events: scene/renderer/domElement not ready'
            );
            return;
        }

        const domElement = this.scene.renderer.domElement;

        // English comment.
        this.onMouseClick = this.handleMouseClick.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);

        // English comment.
        domElement.addEventListener('click', this.onMouseClick);
        domElement.addEventListener('mousemove', this.onMouseMove);

        console.log('[ImageMarker] Mouse events setup successfully');
    }

    /**
     * English comment.
     */
    removeMouseEvents() {
        if (!this.scene || !this.scene.renderer || !this.scene.renderer.domElement) {
            return;
        }

        const domElement = this.scene.renderer.domElement;

        // English comment.
        if (this.onMouseClick) {
            domElement.removeEventListener('click', this.onMouseClick);
        }
        if (this.onMouseMove) {
            domElement.removeEventListener('mousemove', this.onMouseMove);
        }
    }

    /**
     * English comment.
     */
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

            // English comment.
            this.emit('markerClick', {
                markerId,
                markerData,
                markerObject: intersectedMarker
            });
        } else {
            console.log('[ImageMarker] No marker intersected');
        }
    }

    /**
     * English comment.
     */
    handleMouseMove(event) {
        const intersectedMarker = this.getIntersectedMarker(event);

        // English comment.
        if (intersectedMarker) {
            const markerId = intersectedMarker.userData.markerId;

            // English comment.
            if (!this.hoveredMarker || this.hoveredMarker.userData.markerId !== markerId) {
                // English comment.
                if (this.hoveredMarker) {
                    const prevMarkerId = this.hoveredMarker.userData.markerId;
                    const prevMarkerData = this.markerDataMap.get(prevMarkerId);

                    this.emit('markerMouseLeave', {
                        markerId: prevMarkerId,
                        markerData: prevMarkerData,
                        markerObject: this.hoveredMarker
                    });
                }

                // English comment.
                const markerData = this.markerDataMap.get(markerId);
                this.emit('markerMouseEnter', {
                    markerId,
                    markerData,
                    markerObject: intersectedMarker
                });

                this.hoveredMarker = intersectedMarker;
            }
        } else {
            // English comment.
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

    /**
     * English comment.
     */
    getIntersectedMarker(event) {
        if (!this.scene || !this.scene.camera || !this.scene.renderer) {
            console.warn('[ImageMarker] getIntersectedMarker: scene/camera/renderer not ready');
            return null;
        }

        const domElement = this.scene.renderer.domElement;
        const rect = domElement.getBoundingClientRect();

        // English comment.
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        console.log('[ImageMarker] Mouse position:', {
            normalized: { x: this.mouse.x, y: this.mouse.y },
            client: { x: event.clientX, y: event.clientY },
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        });

        // English comment.
        this.raycaster.setFromCamera(this.mouse, this.scene.camera);

        // English comment.
        const markerObjects = Array.from(this.imageMarkers.values());

        console.log('[ImageMarker] Marker objects count:', markerObjects.length);
        console.log('[ImageMarker] Marker objects:', markerObjects);

        if (markerObjects.length === 0) {
            console.warn('[ImageMarker] No marker objects to intersect');
            return null;
        }

        // English comment.
        const intersects = this.raycaster.intersectObjects(markerObjects, false);

        console.log('[ImageMarker] Intersects:', intersects);
        console.log('[ImageMarker] Raycaster params:', this.raycaster.params);

        if (intersects.length > 0) {
            console.log('[ImageMarker] Found intersection:', intersects[0]);
            // English comment.
            return intersects[0].object;
        }

        console.log('[ImageMarker] No intersection found');
        return null;
    }

    // English comment.

    /**
     * English comment.
     */
    updatePosition(id, newPosition, options = {}) {
        const markerObject = this.imageMarkers.get(id);
        const markerData = this.markerDataMap.get(id);

        if (!markerObject || !markerData) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        const { duration = 0, easing = 'linear' } = options;

        if (duration > 0) {
            // English comment.
            this.animatePosition(id, markerObject, newPosition, duration, easing);
        } else {
            // English comment.
            markerObject.position.set(newPosition.x, newPosition.y, newPosition.z);

            // English comment.
            this.updateLabelPosition(id, markerObject);

            // English comment.
            markerData.position = { ...newPosition };

            // English comment.
            this.emit('positionUpdated', {
                markerId: id,
                newPosition,
                markerData
            });
        }
    }

    /**
     * English comment.
     */
    animatePosition(id, markerObject, targetPosition, duration, easing) {
        const startPosition = {
            x: markerObject.position.x,
            y: markerObject.position.y,
            z: markerObject.position.z
        };

        const startTime = Date.now();

        // English comment.
        this.positionAnimations.set(id, {
            startPosition,
            targetPosition,
            startTime,
            duration,
            easing
        });
    }

    /**
     * English comment.
     */
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

    // English comment.

    /**
     * English comment.
     */
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

        // English comment.
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
                    scale: 0.05, // English comment.
                    billboard: true,
                    depthTest: true,
                    sizeAttenuation: true
                }
            });
            // English comment.
            this.add(this.labelComponent);
        }

        // English comment.
        const labelPosition = {
            x: markerObject.position.x + offset.x,
            y: markerObject.position.y + offset.y,
            z: markerObject.position.z + offset.z
        };

        // English comment.
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

        // English comment.
        this.markerLabels.set(markerId, {
            labelId: `marker-label-${markerId}`,
            offset,
            visible
        });

        // English comment.
        if (!visible) {
            this.labelComponent.hideLabel(`marker-label-${markerId}`);
        }
    }

    /**
     * English comment.
     */
    async updateLabel(markerId, updates) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            console.warn(`ImageMarker: No label found for marker "${markerId}"`);
            return;
        }

        const { labelId } = labelInfo;

        // English comment.
        await this.labelComponent.updateLabel(labelId, updates);

        // English comment.
        if (updates.offset) {
            labelInfo.offset = updates.offset;
            const markerObject = this.imageMarkers.get(markerId);
            if (markerObject) {
                this.updateLabelPosition(markerId, markerObject);
            }
        }
    }

    /**
     * English comment.
     */
    updateLabelPosition(markerId, markerObject) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            return;
        }

        const { labelId, offset } = labelInfo;

        // English comment.
        const newPosition = {
            x: markerObject.position.x + offset.x,
            y: markerObject.position.y + offset.y,
            z: markerObject.position.z + offset.z
        };

        // English comment.
        this.labelComponent.updateLabel(labelId, { position: newPosition });
    }

    /**
     * English comment.
     */
    showLabel(markerId) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            console.warn(`ImageMarker: No label found for marker "${markerId}"`);
            return;
        }

        this.labelComponent.showLabel(labelInfo.labelId);
        labelInfo.visible = true;
    }

    /**
     * English comment.
     */
    hideLabel(markerId) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            console.warn(`ImageMarker: No label found for marker "${markerId}"`);
            return;
        }

        this.labelComponent.hideLabel(labelInfo.labelId);
        labelInfo.visible = false;
    }

    /**
     * English comment.
     */
    removeLabelForMarker(markerId) {
        const labelInfo = this.markerLabels.get(markerId);

        if (!labelInfo || !this.labelComponent) {
            return;
        }

        this.labelComponent.removeLabel(labelInfo.labelId);
        this.markerLabels.delete(markerId);
    }

    // English comment.

    /**
     * English comment.
     */
    onUpdate(delta) {
        // English comment.
        const now = Date.now();
        const completedAnimations = [];

        this.positionAnimations.forEach((animData, markerId) => {
            const { startPosition, targetPosition, startTime, duration, easing } = animData;
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // English comment.
            const easedProgress = this.easeFunction(progress, easing);

            // English comment.
            const markerObject = this.imageMarkers.get(markerId);
            if (markerObject) {
                markerObject.position.x =
                    startPosition.x + (targetPosition.x - startPosition.x) * easedProgress;
                markerObject.position.y =
                    startPosition.y + (targetPosition.y - startPosition.y) * easedProgress;
                markerObject.position.z =
                    startPosition.z + (targetPosition.z - startPosition.z) * easedProgress;

                // English comment.
                this.updateLabelPosition(markerId, markerObject);

                // English comment.
                if (progress >= 1) {
                    completedAnimations.push(markerId);

                    // English comment.
                    const markerData = this.markerDataMap.get(markerId);
                    if (markerData) {
                        markerData.position = { ...targetPosition };
                    }

                    // English comment.
                    this.emit('positionUpdated', {
                        markerId,
                        newPosition: targetPosition,
                        markerData
                    });
                }
            }
        });

        // English comment.
        completedAnimations.forEach((markerId) => {
            this.positionAnimations.delete(markerId);
        });

        // English comment.
        if (this.labelComponent && this.labelComponent.onUpdate) {
            this.labelComponent.onUpdate(delta);
        }
    }

    /**
     * English comment.
     */
    onDispose() {
        // English comment.
        this.removeMouseEvents();

        // English comment.
        this.clearMarkers();

        // English comment.
        if (this.labelComponent) {
            this.labelComponent.onDispose();
            this.remove(this.labelComponent);
            this.labelComponent = null;
        }

        // English comment.
        this.textureCache.forEach((texture) => {
            texture.dispose();
        });
        this.textureCache.clear();

        // English comment.
        this.positionAnimations.clear();
    }
}

export default ImageMarker;
