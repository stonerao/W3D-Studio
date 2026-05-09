import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Label3D 三维标签组件
 *
 * @class Label3D
 * @extends Component
 * @description 使用 Canvas 生成文字纹理，通过 Sprite 渲染到三维场景中
 */
export class Label3D extends Component {
    static defaultConfig = {
        labels: [], // 标签数据数组
        globalConfig: {
            // 全局默认配置
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
            backgroundImage: null, // 背景图片 URL
            billboard: true, // 是否始终面向相机
            scale: 1, // 整体缩放
            size: 1, // 标签基础尺寸
            width: 2, // 标签宽度（plane 或 sprite 非自适应时）
            height: 1, // 标签高度（plane 或 sprite 非自适应时）
            autoSize: true, // sprite 默认按文本宽高比自适应
            center: { x: 0.5, y: 0 }, // 仅 sprite：锚点中心
            depthTest: true, // 是否进行深度测试
            sizeAttenuation: true, // 是否随距离缩放
            parent: null, // 父对象（THREE.Object3D），如果指定则挂载到父对象而非组件自身
            useLocalPosition: false, // 是否使用父对象的局部坐标系
            autoConvertToLocal: false // 是否自动将世界坐标转换为局部坐标
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        // 标签对象映射表 (id -> sprite)
        this.labelSprites = new Map();

        // 标签数据映射表 (id -> labelData)
        this.labelDataMap = new Map();

        // 父对象映射表 (id -> parent)
        this.parentMap = new Map();
        this.alarmHighlightConfigMap = new Map();

        // Canvas 缓存
        this.canvasCache = new Map();

        // 图片加载缓存
        this.imageCache = new Map();

        // 复用文字测量 Canvas，减少频繁创建临时对象
        this._measureCanvas = document.createElement('canvas');
        this._measureCtx = this._measureCanvas.getContext('2d');

        // Plane billboard 优化：仅当相机位置变化时刷新朝向
        this._lastBillboardCameraPos = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
        this._billboardEpsilon = 1e-6;
    }

    /**
     * 组件挂载完成
     */
    async onMounted() {
        // 合并全局配置
        this.globalConfig = {
            ...this.constructor.defaultConfig.globalConfig,
            ...this.config.globalConfig
        };

        // 创建所有标签
        if (this.config.labels && this.config.labels.length > 0) {
            await this.createLabels(this.config.labels);
        }
    }

    /**
     * 创建标签
     * @param {Array} labels - 标签数据数组
     */
    async createLabels(labels) {
        for (const labelData of labels) {
            await this.createLabel(labelData);
        }
    }

    /**
     * 创建单个标签
     * @param {Object} labelData - 标签数据
     */
    async createLabel(labelData) {
        const { id, label, position, userData, config, parent } = labelData;

        if (!id || !label) {
            console.warn('Label3D: id and label are required');
            return;
        }

        // 合并配置
        const labelConfig = {
            ...this.globalConfig,
            ...config
        };

        // 确定父对象（优先使用标签自己的 parent，其次使用全局 parent）
        const parentObject = parent || labelConfig.parent;

        // 加载背景图片（如果有）
        let backgroundImage = null;
        if (labelConfig.backgroundImage) {
            backgroundImage = await this.loadImage(labelConfig.backgroundImage);
        }

        // 创建 Canvas 纹理
        const { canvas, width, height } = this.createCanvasTexture(
            label,
            labelConfig,
            backgroundImage
        );

        // 创建 Sprite 材质
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // 创建渲染对象（Sprite / Plane）
        const labelObject = this.createLabelObject(texture, labelConfig, width, height);

        // 设置位置
        if (position) {
            const pos = new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);

            // 如果有父对象且需要转换坐标系
            if (parentObject && labelConfig.autoConvertToLocal) {
                // 将世界坐标转换为父对象的局部坐标
                const localPos = parentObject.worldToLocal(pos.clone());
                labelObject.position.copy(localPos);
            } else if (parentObject && labelConfig.useLocalPosition) {
                // 直接使用局部坐标
                labelObject.position.copy(pos);
            } else {
                // 使用世界坐标
                labelObject.position.copy(pos);
            }
        }

        // 设置缩放（根据 Canvas 实际尺寸）
        this.applyLabelScale(labelObject, labelConfig, width, height);

        // 设置 userData
        labelObject.userData = {
            labelId: id,
            labelText: label,
            customData: userData,
            eventEmitter: this.eventEmitter,
            isLabel3D: true,
            renderMode: this.getRenderMode(labelConfig)
        };

        // 添加到场景或父对象
        if (parentObject) {
            parentObject.add(labelObject);
            this.parentMap.set(id, parentObject);
        } else {
            this.add(labelObject);
        }

        // 保存到映射表
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

    /**
     * 创建 Canvas 纹理
     * @param {string} text - 文字内容
     * @param {Object} config - 配置
     * @param {Image} backgroundImage - 背景图片
     * @returns {Object} { canvas, width, height }
     */
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

        // 复用测量上下文，减少临时 Canvas 分配
        const measureCtx = this._measureCtx;
        measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const metrics = measureCtx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize;

        // 计算 Canvas 尺寸（包含 padding 和 border）
        const canvasWidth = Math.ceil(textWidth + padding * 2 + borderWidth * 2);
        const canvasHeight = Math.ceil(textHeight + padding * 2 + borderWidth * 2);

        // 创建实际 Canvas
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        // 绘制背景图片
        if (backgroundImage) {
            ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
        } else {
            // 绘制背景
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

        // 绘制边框
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

        // 绘制文字
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

        return { canvas, width: canvasWidth, height: canvasHeight };
    }

    /**
     * 绘制圆角矩形路径
     */
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

    /**
     * 加载图片
     * @param {string} url - 图片 URL
     * @returns {Promise<Image>}
     */
    loadImage(url) {
        // 检查缓存
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

    /**
     * 更新标签
     * @param {string} id - 标签 ID
     * @param {Object} updates - 更新数据
     */
    async updateLabel(id, updates) {
        const labelObject = this.labelSprites.get(id);
        const labelData = this.labelDataMap.get(id);

        if (!labelObject || !labelData) {
            console.warn(`Label3D: Label with id "${id}" not found`);
            return;
        }

        // 更新标签数据
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

        // 如果更新了文字或配置，重新创建纹理
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

            // 优先复用现有纹理，避免频繁创建/销毁 GPU 资源
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

        // 如果更新了位置
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

            // 如果有父对象且需要转换坐标系
            if (parentObject && labelConfig.autoConvertToLocal) {
                const localPos = parentObject.worldToLocal(pos.clone());
                labelObject.position.copy(localPos);
            } else if (parentObject && labelConfig.useLocalPosition) {
                labelObject.position.copy(pos);
            } else {
                labelObject.position.copy(pos);
            }
        }

        // 如果更新了父对象
        if (updates.parent !== undefined) {
            const oldParent = this.parentMap.get(id);
            const newParent = updates.parent;

            // 从旧父对象移除
            if (oldParent) {
                oldParent.remove(labelObject);
            } else {
                this.remove(labelObject);
            }

            // 添加到新父对象
            if (newParent) {
                newParent.add(labelObject);
                this.parentMap.set(id, newParent);
            } else {
                this.add(labelObject);
                this.parentMap.delete(id);
            }
        }

        // 如果更新了 userData
        if (updates.userData) {
            labelObject.userData.customData = updates.userData;
        }
    }

    /**
     * 移除标签
     * @param {string} id - 标签 ID
     */
    removeLabel(id) {
        const labelObject = this.labelSprites.get(id);

        if (!labelObject) {
            console.warn(`Label3D: Label with id "${id}" not found`);
            return;
        }

        // 清理资源
        if (labelObject.material?.map) {
            labelObject.material.map.dispose();
        }
        if (labelObject.material) {
            labelObject.material.dispose();
        }
        if (labelObject.geometry) {
            labelObject.geometry.dispose();
        }

        // 从场景或父对象移除
        const parentObject = this.parentMap.get(id);
        if (parentObject) {
            parentObject.remove(labelObject);
            this.parentMap.delete(id);
        } else {
            this.remove(labelObject);
        }

        // 从映射表移除
        this.labelSprites.delete(id);
        this.labelDataMap.delete(id);
    }

    /**
     * 获取标签
     * @param {string} id - 标签 ID
     * @returns {Object} 标签数据
     */
    getLabel(id) {
        return this.labelDataMap.get(id);
    }

    /**
     * 获取所有标签
     * @returns {Array} 标签数据数组
     */
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

    /**
     * 清除所有标签
     */
    clearLabels() {
        const ids = Array.from(this.labelSprites.keys());
        for (const id of ids) {
            this.removeLabel(id);
        }
    }

    /**
     * 显示标签
     * @param {string} id - 标签 ID
     */
    showLabel(id) {
        const sprite = this.labelSprites.get(id);
        if (sprite) {
            sprite.visible = true;
        }
    }

    /**
     * 隐藏标签
     * @param {string} id - 标签 ID
     */
    hideLabel(id) {
        const sprite = this.labelSprites.get(id);
        if (sprite) {
            sprite.visible = false;
        }
    }

    /**
     * 获取可交互对象（用于事件系统）
     * @returns {Array<THREE.Object3D>}
     */
    getInteractiveObjects() {
        return Array.from(this.labelSprites.values());
    }

    /**
     * 获取标签的父对象
     * @param {string} id - 标签 ID
     * @returns {THREE.Object3D|null} 父对象
     */
    getLabelParent(id) {
        return this.parentMap.get(id) || null;
    }

    /**
     * 批量设置标签的父对象
     * @param {Array<{id: string, parent: THREE.Object3D}>} parentMappings - 父对象映射数组
     */
    async batchSetParents(parentMappings) {
        for (const { id, parent } of parentMappings) {
            await this.updateLabel(id, { parent });
        }
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    async updateConfig(newConfig) {
        // 更新全局配置
        if (newConfig.globalConfig) {
            Object.assign(this.globalConfig, newConfig.globalConfig);
        }

        // 标签列表整体同步：增、删、改
        if (Array.isArray(newConfig.labels)) {
            const nextLabels = newConfig.labels
                .filter((item) => item && typeof item === 'object' && item.id)
                .map((item) => ({
                    ...item,
                    config: { ...(item.config || {}) }
                }));

            const nextIdSet = new Set(nextLabels.map((item) => item.id));

            // 删除已不存在的标签
            for (const existingId of Array.from(this.labelDataMap.keys())) {
                if (!nextIdSet.has(existingId)) {
                    this.removeLabel(existingId);
                }
            }

            // 新增/更新标签（并行），避免大列表串行阻塞
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

        // 仅全局配置变化时，刷新所有现存标签（并行）
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

    /**
     * 每帧更新
     * @param {number} delta - 时间增量
     */
    onUpdate(_delta) {
        // 如果启用了 billboard 效果，让标签始终面向相机
        if (this.globalConfig.billboard && this.scene.camera) {
            const cameraPosition = this.scene?.camera?.position || this.scene?.camera?.instance?.position;
            if (!cameraPosition || typeof cameraPosition.distanceToSquared !== 'function') {
                return;
            }

            if (!this._lastBillboardCameraPos || typeof this._lastBillboardCameraPos.copy !== 'function') {
                this._lastBillboardCameraPos = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
            }

            // 相机位置未变化时跳过 Plane 朝向计算
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

    /**
     * 组件销毁
     */
    onDispose() {
        // 清除所有标签
        this.clearLabels();

        // 清除缓存
        this.canvasCache.clear();
        this.imageCache.clear();

        this._measureCanvas = null;
        this._measureCtx = null;

        // 清除父对象映射
        this.parentMap.clear();
        this.alarmHighlightConfigMap.clear();
    }
}

export default Label3D;
