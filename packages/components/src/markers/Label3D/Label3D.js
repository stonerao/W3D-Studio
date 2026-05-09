import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Marker module component that places HTML or sprite-based labels in 3D space.
 */
export class Label3D extends Component {
    static defaultConfig = {
        labels: [],
        globalConfig: {
            renderMode: 'sprite', // sprite | plane
            fontSize: 32,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            textColor: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderColor: '#ffffff',
            borderWidth: 2,
            padding: 10,
            borderRadius: 5,
            backgroundImage: null,
            billboard: true,
            scale: 1,
            size: 1,
            width: 2,
            height: 1,
            autoSize: true,
            center: { x: 0.5, y: 0 },
            depthTest: true,
            sizeAttenuation: true,
            parent: null,
            useLocalPosition: false,
            autoConvertToLocal: false
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        this.labelSprites = new Map();

        this.labelDataMap = new Map();

        this.parentMap = new Map();
        this.alarmHighlightConfigMap = new Map();

        this.canvasCache = new Map();

        this.imageCache = new Map();

        this._measureCanvas = document.createElement('canvas');
        this._measureCtx = this._measureCanvas.getContext('2d');

        this._lastBillboardCameraPos = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
        this._billboardEpsilon = 1e-6;
    }

    async onMounted() {
        this.globalConfig = {
            ...this.constructor.defaultConfig.globalConfig,
            ...this.config.globalConfig
        };

        if (this.config.labels && this.config.labels.length > 0) {
            await this.createLabels(this.config.labels);
        }
    }

    async createLabels(labels) {
        for (const labelData of labels) {
            await this.createLabel(labelData);
        }
    }

    async createLabel(labelData) {
        const { id, label, position, userData, config, parent } = labelData;

        if (!id || !label) {
            console.warn('Label3D: id and label are required');
            return;
        }

        const labelConfig = {
            ...this.globalConfig,
            ...config
        };

        const parentObject = parent || labelConfig.parent;

        let backgroundImage = null;
        if (labelConfig.backgroundImage) {
            backgroundImage = await this.loadImage(labelConfig.backgroundImage);
        }

        const { canvas, width, height } = this.createCanvasTexture(
            label,
            labelConfig,
            backgroundImage
        );

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const labelObject = this.createLabelObject(texture, labelConfig, width, height);

        if (position) {
            const pos = new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);

            if (parentObject && labelConfig.autoConvertToLocal) {
                const localPos = parentObject.worldToLocal(pos.clone());
                labelObject.position.copy(localPos);
            } else if (parentObject && labelConfig.useLocalPosition) {
                labelObject.position.copy(pos);
            } else {
                labelObject.position.copy(pos);
            }
        }

        this.applyLabelScale(labelObject, labelConfig, width, height);

        labelObject.userData = {
            labelId: id,
            labelText: label,
            customData: userData,
            eventEmitter: this.eventEmitter,
            isLabel3D: true,
            renderMode: this.getRenderMode(labelConfig)
        };

        if (parentObject) {
            parentObject.add(labelObject);
            this.parentMap.set(id, parentObject);
        } else {
            this.add(labelObject);
        }

        this.labelSprites.set(id, labelObject);
        this.labelDataMap.set(id, {
            ...labelData,
            config: { ...(labelData.config || {}) }
        });
    }

    getRenderMode(config = {}) {
        return config?.renderMode === 'plane' ? 'plane' : 'sprite';
    }

    createLabelObject(texture, labelConfig, width, height) {
        const renderMode = this.getRenderMode(labelConfig);

        if (renderMode === 'plane') {
            const geometry = new THREE.PlaneGeometry(1, 1);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                depthTest: labelConfig.depthTest,
                side: THREE.DoubleSide
            });

            const plane = new THREE.Mesh(geometry, material);
            this.applyLabelScale(plane, labelConfig, width, height);
            return plane;
        }

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: labelConfig.depthTest,
            sizeAttenuation: labelConfig.sizeAttenuation
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        this.applyLabelCenter(sprite, labelConfig);
        this.applyLabelScale(sprite, labelConfig, width, height);
        return sprite;
    }

    applyLabelCenter(labelObject, labelConfig) {
        if (!labelObject?.isSprite) return;
        const centerX = Number(labelConfig?.center?.x ?? 0.5);
        const centerY = Number(labelConfig?.center?.y ?? 0);
        labelObject.center.set(
            Number.isFinite(centerX) ? centerX : 0.5,
            Number.isFinite(centerY) ? centerY : 0
        );
    }

    applyLabelScale(labelObject, labelConfig, width, height) {
        if (!labelObject) return;

        const safeWidth = Number(width) > 0 ? Number(width) : 1;
        const safeHeight = Number(height) > 0 ? Number(height) : 1;
        const aspect = safeWidth / safeHeight;
        const renderMode = this.getRenderMode(labelConfig);

        if (renderMode === 'plane') {
            const baseHeight = Number(labelConfig.height ?? labelConfig.size ?? labelConfig.scale ?? 1) || 1;
            const autoSize = labelConfig.autoSize !== false;
            const planeWidth = autoSize
                ? Number(labelConfig.width ?? baseHeight * aspect) || baseHeight * aspect
                : Number(labelConfig.width ?? baseHeight) || baseHeight;
            const planeHeight = Number(labelConfig.height ?? baseHeight) || baseHeight;
            labelObject.scale.set(planeWidth, planeHeight, 1);
            return;
        }

        const spriteSize = Number(labelConfig.size ?? labelConfig.scale ?? 1) || 1;
        const autoSize = labelConfig.autoSize !== false;

        if (autoSize) {
            labelObject.scale.set(aspect * spriteSize, spriteSize, 1);
            return;
        }

        const spriteWidth = Number(labelConfig.width ?? spriteSize) || spriteSize;
        const spriteHeight = Number(labelConfig.height ?? spriteSize) || spriteSize;
        labelObject.scale.set(spriteWidth, spriteHeight, 1);
    }

    createCanvasTexture(text, config, backgroundImage = null) {
        const {
            fontSize,
            fontFamily,
            fontWeight,
            textColor,
            backgroundColor,
            borderColor,
            borderWidth,
            padding,
            borderRadius
        } = config;

        const measureCtx = this._measureCtx;
        measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const metrics = measureCtx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize;

        const canvasWidth = Math.ceil(textWidth + padding * 2 + borderWidth * 2);
        const canvasHeight = Math.ceil(textHeight + padding * 2 + borderWidth * 2);

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        if (backgroundImage) {
            ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
        } else {
            ctx.fillStyle = backgroundColor;
            if (borderRadius > 0) {
                this.drawRoundedRect(
                    ctx,
                    borderWidth / 2,
                    borderWidth / 2,
                    canvasWidth - borderWidth,
                    canvasHeight - borderWidth,
                    borderRadius
                );
                ctx.fill();
            } else {
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }
        }

        if (borderWidth > 0) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = borderWidth;
            if (borderRadius > 0) {
                this.drawRoundedRect(
                    ctx,
                    borderWidth / 2,
                    borderWidth / 2,
                    canvasWidth - borderWidth,
                    canvasHeight - borderWidth,
                    borderRadius
                );
                ctx.stroke();
            } else {
                ctx.strokeRect(
                    borderWidth / 2,
                    borderWidth / 2,
                    canvasWidth - borderWidth,
                    canvasHeight - borderWidth
                );
            }
        }

        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

        return { canvas, width: canvasWidth, height: canvasHeight };
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    loadImage(url) {
        if (this.imageCache.has(url)) {
            return Promise.resolve(this.imageCache.get(url));
        }

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.imageCache.set(url, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Label3D: Failed to load image: ${url}`);
                resolve(null);
            };
            img.src = url;
        });
    }

    async updateLabel(id, updates) {
        const labelObject = this.labelSprites.get(id);
        const labelData = this.labelDataMap.get(id);

        if (!labelObject || !labelData) {
            console.warn(`Label3D: Label with id "${id}" not found`);
            return;
        }

        Object.assign(labelData, updates);

        const mergedConfig = {
            ...this.globalConfig,
            ...labelData.config
        };
        const targetRenderMode = this.getRenderMode(mergedConfig);
        const currentRenderMode = labelObject?.userData?.renderMode || this.getRenderMode(this.globalConfig);

        if (targetRenderMode !== currentRenderMode) {
            const snapshot = {
                ...labelData,
                config: { ...(labelData.config || {}) }
            };
            this.removeLabel(id);
            await this.createLabel(snapshot);
            return;
        }

        if (updates.label || updates.config) {
            const labelConfig = mergedConfig;

            let backgroundImage = null;
            if (labelConfig.backgroundImage) {
                backgroundImage = await this.loadImage(labelConfig.backgroundImage);
            }

            const { canvas, width, height } = this.createCanvasTexture(
                labelData.label,
                labelConfig,
                backgroundImage
            );

            if (labelObject.material?.map) {
                labelObject.material.map.image = canvas;
                labelObject.material.map.needsUpdate = true;
            } else {
                const newTexture = new THREE.CanvasTexture(canvas);
                newTexture.needsUpdate = true;
                labelObject.material.map = newTexture;
            }
            labelObject.material.needsUpdate = true;

            this.applyLabelScale(labelObject, labelConfig, width, height);
            this.applyLabelCenter(labelObject, labelConfig);
            labelObject.userData.renderMode = targetRenderMode;
        }

        if (updates.position) {
            const labelConfig = {
                ...this.globalConfig,
                ...labelData.config
            };
            const parentObject = this.parentMap.get(id) || labelConfig.parent;
            const pos = new THREE.Vector3(
                updates.position.x ?? labelObject.position.x,
                updates.position.y ?? labelObject.position.y,
                updates.position.z ?? labelObject.position.z
            );

            if (parentObject && labelConfig.autoConvertToLocal) {
                const localPos = parentObject.worldToLocal(pos.clone());
                labelObject.position.copy(localPos);
            } else if (parentObject && labelConfig.useLocalPosition) {
                labelObject.position.copy(pos);
            } else {
                labelObject.position.copy(pos);
            }
        }

        if (updates.parent !== undefined) {
            const oldParent = this.parentMap.get(id);
            const newParent = updates.parent;

            if (oldParent) {
                oldParent.remove(labelObject);
            } else {
                this.remove(labelObject);
            }

            if (newParent) {
                newParent.add(labelObject);
                this.parentMap.set(id, newParent);
            } else {
                this.add(labelObject);
                this.parentMap.delete(id);
            }
        }

        if (updates.userData) {
            labelObject.userData.customData = updates.userData;
        }
    }

    removeLabel(id) {
        const labelObject = this.labelSprites.get(id);

        if (!labelObject) {
            console.warn(`Label3D: Label with id "${id}" not found`);
            return;
        }

        if (labelObject.material?.map) {
            labelObject.material.map.dispose();
        }
        if (labelObject.material) {
            labelObject.material.dispose();
        }
        if (labelObject.geometry) {
            labelObject.geometry.dispose();
        }

        const parentObject = this.parentMap.get(id);
        if (parentObject) {
            parentObject.remove(labelObject);
            this.parentMap.delete(id);
        } else {
            this.remove(labelObject);
        }

        this.labelSprites.delete(id);
        this.labelDataMap.delete(id);
    }

    getLabel(id) {
        return this.labelDataMap.get(id);
    }

    getAllLabels() {
        return Array.from(this.labelDataMap.values());
    }

    async highlightLabel(id, options = {}) {
        const labelData = this.labelDataMap.get(id);
        if (!labelData) return;

        if (!this.alarmHighlightConfigMap.has(id)) {
            this.alarmHighlightConfigMap.set(id, {
                ...(labelData.config || {})
            });
        }

        const nextConfig = {
            ...(labelData.config || {}),
            textColor: options.color || '#ffffff',
            backgroundColor: options.backgroundColor || 'rgba(239, 68, 68, 0.82)',
            borderColor: options.borderColor || '#fecaca',
            borderWidth: Math.max(2, Number(options.borderWidth ?? labelData.config?.borderWidth ?? 2)),
            fontWeight: options.fontWeight || 'bold'
        };

        await this.updateLabel(id, { config: nextConfig });
        const labelObject = this.labelSprites.get(id);
        if (labelObject) {
            labelObject.userData.alarmBlink = {
                enabled: Boolean(options.blink),
                startedAt: performance.now()
            };
        }
    }

    async unhighlightLabel(id) {
        const originalConfig = this.alarmHighlightConfigMap.get(id);
        if (!originalConfig) return;

        const labelObject = this.labelSprites.get(id);
        if (labelObject?.material) {
            labelObject.material.opacity = 1;
        }
        if (labelObject?.userData) {
            delete labelObject.userData.alarmBlink;
        }

        this.alarmHighlightConfigMap.delete(id);
        await this.updateLabel(id, { config: { ...originalConfig } });
    }

    async clearAllHighlightedLabels() {
        for (const id of Array.from(this.alarmHighlightConfigMap.keys())) {
            await this.unhighlightLabel(id);
        }
    }

    clearLabels() {
        const ids = Array.from(this.labelSprites.keys());
        for (const id of ids) {
            this.removeLabel(id);
        }
    }

    showLabel(id) {
        const sprite = this.labelSprites.get(id);
        if (sprite) {
            sprite.visible = true;
        }
    }

    hideLabel(id) {
        const sprite = this.labelSprites.get(id);
        if (sprite) {
            sprite.visible = false;
        }
    }

    getInteractiveObjects() {
        return Array.from(this.labelSprites.values());
    }

    getLabelParent(id) {
        return this.parentMap.get(id) || null;
    }

    async batchSetParents(parentMappings) {
        for (const { id, parent } of parentMappings) {
            await this.updateLabel(id, { parent });
        }
    }

    async updateConfig(newConfig) {
        if (newConfig.globalConfig) {
            Object.assign(this.globalConfig, newConfig.globalConfig);
        }

        if (Array.isArray(newConfig.labels)) {
            const nextLabels = newConfig.labels
                .filter((item) => item && typeof item === 'object' && item.id)
                .map((item) => ({
                    ...item,
                    config: { ...(item.config || {}) }
                }));

            const nextIdSet = new Set(nextLabels.map((item) => item.id));

            for (const existingId of Array.from(this.labelDataMap.keys())) {
                if (!nextIdSet.has(existingId)) {
                    this.removeLabel(existingId);
                }
            }

            const syncTasks = nextLabels.map((nextLabel) => {
                if (this.labelDataMap.has(nextLabel.id)) {
                    return this.updateLabel(nextLabel.id, nextLabel);
                }
                return this.createLabel(nextLabel);
            });
            await Promise.all(syncTasks);

            this.config.labels = nextLabels;
            return;
        }

        const refreshTasks = [];
        for (const [id, labelData] of this.labelDataMap) {
            refreshTasks.push(this.updateLabel(id, {
                config: { ...(labelData.config || {}) }
            }));
        }
        await Promise.all(refreshTasks);
    }

    async updateData(data, options = {}) {
        const patch = options && typeof options === 'object' && options.config && typeof options.config === 'object'
            ? { ...options.config }
            : {};

        if (Array.isArray(data)) {
            patch.labels = data;
        } else if (data && typeof data === 'object') {
            patch.labels = Array.isArray(data.labels) ? data.labels : [];
        } else {
            patch.labels = [];
        }

        await this.updateConfig(patch);
        return {
            success: true,
            count: Array.isArray(patch.labels) ? patch.labels.length : 0
        };
    }

    onUpdate(_delta) {
        if (this.globalConfig.billboard && this.scene.camera) {
            const cameraPosition = this.scene?.camera?.position || this.scene?.camera?.instance?.position;
            if (!cameraPosition || typeof cameraPosition.distanceToSquared !== 'function') {
                return;
            }

            if (!this._lastBillboardCameraPos || typeof this._lastBillboardCameraPos.copy !== 'function') {
                this._lastBillboardCameraPos = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
            }

            if (cameraPosition.distanceToSquared(this._lastBillboardCameraPos) <= this._billboardEpsilon) {
                return;
            }
            this._lastBillboardCameraPos.copy(cameraPosition);

            this.labelSprites.forEach((labelObject) => {
                if (labelObject?.isMesh && labelObject.userData?.renderMode === 'plane') {
                    labelObject.lookAt(cameraPosition);
                }

                const blinkMeta = labelObject?.userData?.alarmBlink;
                if (blinkMeta?.enabled && labelObject?.material) {
                    const elapsed = (_delta || 0) + (performance.now() - blinkMeta.startedAt) / 1000;
                    labelObject.material.opacity = 0.45 + ((Math.sin(elapsed * 7) + 1) * 0.25);
                } else if (labelObject?.material) {
                    labelObject.material.opacity = 1;
                }
            });
        }
    }

    onDispose() {
        this.clearLabels();

        this.canvasCache.clear();
        this.imageCache.clear();

        this._measureCanvas = null;
        this._measureCtx = null;

        this.parentMap.clear();
        this.alarmHighlightConfigMap.clear();
    }
}

export default Label3D;
