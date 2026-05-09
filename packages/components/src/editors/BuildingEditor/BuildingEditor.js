import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * BuildingEditor 楼宇点位编辑器组件
 *
 * @class BuildingEditor
 * @extends Component
 * @description 用于在 3D 场景中管理楼宇点位，支持点位的增删改查、筛选和交互
 *
 * @example
 * const editor = await scene.add('BuildingEditor', {
 *     name: 'building-editor',
 *     points: [],
 *     pointTypes: POINT_TYPES,
 *     enableRightClick: true
 * });
 *
 * // 添加点位
 * editor.addPoint({ id: 'p1', name: '摄像头1', type: 'camera', floor: '1F', position: { x: 0, y: 1, z: 0 } });
 *
 * // 筛选点位
 * editor.filterByFloor('2F');
 * editor.filterByType('camera');
 */
export class BuildingEditor extends Component {
    /**
     * 默认配置
     */
    static defaultConfig = {
        points: [],              // 初始点位数据数组
        pointTypes: [],          // 点位类型配置
        selectedFloor: 'all',    // 当前选中楼层
        selectedType: 'all',     // 当前选中类型
        enableRightClick: true,  // 是否启用右键添加
        pointSize: 1.0,          // 点位标记大小
        highlightColor: 0xFFFF00,// 高亮颜色
        defaultIcon: null,       // 默认图标
        labelOffset: { x: 0, y: 1.5, z: 0 } // 标签偏移
    };

    normalizePosition(position, fallback = { x: 0, y: 0, z: 0 }) {
        if (Array.isArray(position)) {
            return {
                x: Number(position[0]) || fallback.x,
                y: Number(position[1]) || fallback.y,
                z: Number(position[2]) || fallback.z
            };
        }

        if (position && typeof position === 'object') {
            return {
                x: Number(position.x) || fallback.x,
                y: Number(position.y) || fallback.y,
                z: Number(position.z) || fallback.z
            };
        }

        return { ...fallback };
    }

    normalizePointData(pointData = {}, index = 0) {
        const id = pointData.id || this.generateId();
        const name = (pointData.name || '').trim() || `点位${index + 1}`;
        const position = this.normalizePosition(pointData.position, { x: 0, y: 0, z: 0 });

        return {
            ...pointData,
            id,
            name,
            position
        };
    }

    /**
     * 组件挂载完成
     */
    async onMounted() {
        // 点位对象映射表 (id -> THREE.Object3D)
        this.pointObjects = new Map();

        // 点位数据映射表 (id -> pointData)
        this.pointDataMap = new Map();

        // 点位类型映射表 (typeId -> typeConfig)
        this.typeConfigMap = new Map();

        // 当前选中的点位 ID
        this.selectedPointId = null;

        // 当前筛选条件
        this.currentFloorFilter = this.config.selectedFloor;
        this.currentTypeFilter = this.config.selectedType;

        // 纹理加载器
        this.textureLoader = new THREE.TextureLoader();

        // 纹理缓存
        this.textureCache = new Map();

        // 射线检测器
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Sprite = { threshold: 10 };
        this.mouse = new THREE.Vector2();

        // 初始化点位类型配置
        this.initPointTypes();

        // 创建初始点位
        await this.createInitialPoints();

        // 设置鼠标事件
        this.setupMouseEvents();

        console.log('[BuildingEditor] 组件初始化完成');
    }

    /**
     * 初始化点位类型配置
     */
    initPointTypes() {
        const { pointTypes } = this.config;

        if (pointTypes && pointTypes.length > 0) {
            pointTypes.forEach(typeConfig => {
                this.typeConfigMap.set(typeConfig.id, typeConfig);
            });
        }

        console.log('[BuildingEditor] 点位类型配置:', this.typeConfigMap);
    }

    /**
     * 创建初始点位
     */
    async createInitialPoints() {
        const { points } = this.config;

        if (points && points.length > 0) {
            for (let index = 0; index < points.length; index += 1) {
                const pointData = this.normalizePointData(points[index], index);
                await this.addPoint(pointData, false); // 不触发事件
            }
        }

        console.log('[BuildingEditor] 初始点位创建完成，共', this.pointObjects.size, '个');
    }

    /**
     * 加载纹理（带缓存）
     */
    async loadTexture(url) {
        if (!url) return null;

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
                    console.error(`[BuildingEditor] 纹理加载失败: ${url}`, error);
                    reject(error);
                }
            );
        });
    }

    /**
     * 生成唯一 ID
     */
    generateId() {
        return 'point_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 获取点位类型配置
     */
    getTypeConfig(typeId) {
        return this.typeConfigMap.get(typeId) || null;
    }

    /**
     * 获取可交互对象（供事件系统使用）
     */
    getInteractiveObjects() {
        // 返回所有可见的点位对象
        return Array.from(this.pointObjects.values()).filter(obj => obj.visible);
    }

    // ==================== 点位创建和管理方法 ====================

    /**
     * 创建点位 3D 对象
     */
    async createPointObject(pointData) {
        const { id, type } = pointData;
        const position = this.normalizePosition(pointData.position, { x: 0, y: 0, z: 0 });
        const typeConfig = this.getTypeConfig(type);
        const { pointSize } = this.config;

        let markerObject;

        // 如果有图标，使用 Sprite
        if (typeConfig && typeConfig.icon) {
            try {
                const texture = await this.loadTexture(typeConfig.icon);
                const material = new THREE.SpriteMaterial({
                    map: texture,
                    color: new THREE.Color(typeConfig.color || '#ffffff'),
                    transparent: true,
                    opacity: 1.0,
                    sizeAttenuation: true
                });
                markerObject = new THREE.Sprite(material);
                markerObject.scale.set(pointSize * 2, pointSize * 2, 1);
            } catch (error) {
                // 纹理加载失败，使用默认球体
                markerObject = this.createDefaultMarker(typeConfig, pointSize);
            }
        } else {
            // 没有图标，使用默认球体
            markerObject = this.createDefaultMarker(typeConfig, pointSize);
        }

        // 设置位置
        markerObject.position.set(position.x, position.y, position.z);

        // 存储用户数据
        markerObject.userData = {
            pointId: id,
            pointType: type,
            isBuildingPoint: true
        };

        return markerObject;
    }

    /**
     * 创建默认点位标记（球体）
     */
    createDefaultMarker(typeConfig, size) {
        const color = typeConfig ? typeConfig.color : '#07A6FF';
        const geometry = new THREE.SphereGeometry(size * 0.5, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.9
        });
        return new THREE.Mesh(geometry, material);
    }

    /**
     * 添加点位
     */
    async addPoint(pointData, triggerEvent = true) {
        const normalizedData = this.normalizePointData(pointData, this.pointObjects.size);
        const { id } = normalizedData;

        // 检查是否已存在
        if (this.pointObjects.has(id)) {
            console.warn(`[BuildingEditor] 点位 ${id} 已存在`);
            return null;
        }

        // 创建 3D 对象
        const pointObject = await this.createPointObject(normalizedData);

        if (!pointObject) {
            console.error(`[BuildingEditor] 创建点位 ${id} 失败`);
            return null;
        }

        // 添加到场景
        this.add(pointObject);

        // 保存到映射表
        this.pointObjects.set(id, pointObject);
        this.pointDataMap.set(id, { ...normalizedData });

        // 应用筛选
        this.applyFiltersToPoint(id);

        // 触发事件
        if (triggerEvent) {
            this.emit('pointAdded', { pointId: id, pointData: normalizedData });
        }

        console.log(`[BuildingEditor] 添加点位: ${id}`);
        return normalizedData;
    }

    /**
     * 更新点位
     */
    async updatePoint(id, updates) {
        const pointObject = this.pointObjects.get(id);
        const pointData = this.pointDataMap.get(id);

        if (!pointObject || !pointData) {
            console.warn(`[BuildingEditor] 点位 ${id} 不存在`);
            return false;
        }

        // 更新位置
        if (updates.position) {
            const nextPosition = this.normalizePosition(updates.position, pointData.position || { x: 0, y: 0, z: 0 });
            pointObject.position.set(
                nextPosition.x,
                nextPosition.y,
                nextPosition.z
            );
            updates.position = nextPosition;
        }

        // 更新类型（需要重新创建对象）
        if (updates.type && updates.type !== pointData.type) {
            const newPointData = { ...pointData, ...updates };
            await this.removePoint(id, false);
            await this.addPoint(newPointData, false);
        }

        // 更新数据
        Object.assign(pointData, updates);
        this.pointDataMap.set(id, pointData);

        // 应用筛选
        this.applyFiltersToPoint(id);

        // 触发事件
        this.emit('pointUpdated', { pointId: id, pointData, updates });

        console.log(`[BuildingEditor] 更新点位: ${id}`);
        return true;
    }

    /**
     * 删除点位
     */
    removePoint(id, triggerEvent = true) {
        const pointObject = this.pointObjects.get(id);
        const pointData = this.pointDataMap.get(id);

        if (!pointObject) {
            console.warn(`[BuildingEditor] 点位 ${id} 不存在`);
            return false;
        }

        // 如果是选中状态，先取消选中
        if (this.selectedPointId === id) {
            this.deselectPoint();
        }

        // 从场景移除
        this.remove(pointObject);

        // 释放资源
        if (pointObject.geometry) {
            pointObject.geometry.dispose();
        }
        if (pointObject.material) {
            if (pointObject.material.map) {
                // 不释放纹理，因为可能被其他点位使用
            }
            pointObject.material.dispose();
        }

        // 从映射表移除
        this.pointObjects.delete(id);
        this.pointDataMap.delete(id);

        // 触发事件
        if (triggerEvent) {
            this.emit('pointRemoved', { pointId: id, pointData });
        }

        console.log(`[BuildingEditor] 删除点位: ${id}`);
        return true;
    }

    /**
     * 获取点位数据
     */
    getPoint(id) {
        return this.pointDataMap.get(id) || null;
    }

    /**
     * 获取所有点位数据
     */
    getAllPoints() {
        return Array.from(this.pointDataMap.values());
    }

    /**
     * 获取筛选后的点位
     */
    getFilteredPoints() {
        return this.getAllPoints().filter(point => {
            const floorMatch = this.currentFloorFilter === 'all' || point.floor === this.currentFloorFilter;
            const typeMatch = this.currentTypeFilter === 'all' || point.type === this.currentTypeFilter;
            return floorMatch && typeMatch;
        });
    }

    /**
     * 清除所有点位
     */
    clearPoints() {
        const ids = Array.from(this.pointObjects.keys());
        ids.forEach(id => this.removePoint(id, false));
        this.emit('pointsCleared');
    }

    // ==================== 筛选方法 ====================

    /**
     * 按楼层筛选
     */
    filterByFloor(floor) {
        this.currentFloorFilter = floor;
        this.applyFilters();
        this.emit('filterChanged', { floor, type: this.currentTypeFilter });
    }

    /**
     * 按类型筛选
     */
    filterByType(type) {
        this.currentTypeFilter = type;
        this.applyFilters();
        this.emit('filterChanged', { floor: this.currentFloorFilter, type });
    }

    /**
     * 设置筛选条件
     */
    setFilters(floor, type) {
        this.currentFloorFilter = floor;
        this.currentTypeFilter = type;
        this.applyFilters();
        this.emit('filterChanged', { floor, type });
    }

    /**
     * 应用筛选到所有点位
     */
    applyFilters() {
        this.pointObjects.forEach((_, id) => {
            this.applyFiltersToPoint(id);
        });
    }

    /**
     * 应用筛选到单个点位
     */
    applyFiltersToPoint(id) {
        const pointObject = this.pointObjects.get(id);
        const pointData = this.pointDataMap.get(id);

        if (!pointObject || !pointData) return;

        const floorMatch = this.currentFloorFilter === 'all' || pointData.floor === this.currentFloorFilter;
        const typeMatch = this.currentTypeFilter === 'all' || pointData.type === this.currentTypeFilter;

        pointObject.visible = floorMatch && typeMatch;
    }

    // ==================== 选中和高亮方法 ====================

    /**
     * 选中点位
     */
    selectPoint(id) {
        const pointObject = this.pointObjects.get(id);
        const pointData = this.pointDataMap.get(id);

        if (!pointObject || !pointData) {
            console.warn(`[BuildingEditor] 点位 ${id} 不存在`);
            return;
        }

        // 如果已有选中，先取消
        if (this.selectedPointId && this.selectedPointId !== id) {
            this.deselectPoint();
        }

        this.selectedPointId = id;
        this.highlightPoint(pointObject);

        this.emit('pointClicked', { pointId: id, pointData });
        console.log(`[BuildingEditor] 选中点位: ${id}`);
    }

    /**
     * 取消选中
     */
    deselectPoint() {
        if (!this.selectedPointId) return;

        const pointObject = this.pointObjects.get(this.selectedPointId);
        if (pointObject) {
            this.unhighlightPoint(pointObject, this.selectedPointId);
        }

        this.selectedPointId = null;
        this.emit('pointDeselected');
    }

    /**
     * 高亮点位
     */
    highlightPoint(pointObject) {
        const { highlightColor } = this.config;

        // 保存原始颜色
        if (!pointObject.userData.originalColor && pointObject.material) {
            pointObject.userData.originalColor = pointObject.material.color.getHex();
        }

        // 设置高亮颜色
        if (pointObject.material) {
            pointObject.material.color.setHex(highlightColor);
        }

        // 放大效果
        if (!pointObject.userData.originalScale) {
            pointObject.userData.originalScale = pointObject.scale.clone();
        }
        pointObject.scale.multiplyScalar(1.3);
    }

    /**
     * 取消高亮
     */
    unhighlightPoint(pointObject, id) {
        // 恢复原始颜色
        if (pointObject.userData.originalColor !== undefined && pointObject.material) {
            pointObject.material.color.setHex(pointObject.userData.originalColor);
            delete pointObject.userData.originalColor;
        }

        // 恢复原始大小
        if (pointObject.userData.originalScale) {
            pointObject.scale.copy(pointObject.userData.originalScale);
            delete pointObject.userData.originalScale;
        }
    }

    // ==================== 鼠标事件方法 ====================

    /**
     * 设置鼠标事件
     */
    setupMouseEvents() {
        if (!this.scene || !this.scene.eventSystem) {
            console.warn('[BuildingEditor] 无法设置鼠标事件：场景/事件系统未就绪');
            return;
        }

        // 绑定事件处理函数
        this.onSceneClick = this.handleSceneClick.bind(this);
        this.onSceneContextMenu = this.handleSceneContextMenu.bind(this);

        // 监听场景事件系统的事件
        this.scene.eventSystem.on('click', this.onSceneClick);
        this.scene.eventSystem.on('contextmenu', this.onSceneContextMenu);

        console.log('[BuildingEditor] 鼠标事件设置完成');
    }

    /**
     * 移除鼠标事件
     */
    removeMouseEvents() {
        if (!this.scene || !this.scene.eventSystem) return;

        if (this.onSceneClick) {
            this.scene.eventSystem.off('click', this.onSceneClick);
        }
        if (this.onSceneContextMenu) {
            this.scene.eventSystem.off('contextmenu', this.onSceneContextMenu);
        }
    }

    /**
     * 处理场景点击事件
     */
    handleSceneClick(eventData) {
        // 检查点击的是否是点位对象
        if (eventData.object && eventData.object.userData.isBuildingPoint) {
            const pointId = eventData.object.userData.pointId;
            this.selectPoint(pointId);
        }
    }

    /**
     * 处理场景右键菜单事件
     */
    handleSceneContextMenu(eventData) {
        if (!this.config.enableRightClick) return;

        // 检查点击的是否是点位对象，如果是则忽略
        if (eventData.object && eventData.object.userData.isBuildingPoint) {
            return;
        }

        // 触发右键点击事件，传递 3D 坐标
        if (eventData.point) {
            this.emit('rightClick', {
                position: {
                    x: eventData.point.x,
                    y: eventData.point.y,
                    z: eventData.point.z
                },
                screenX: eventData.event.clientX,
                screenY: eventData.event.clientY
            });
            console.log('[BuildingEditor] 右键点击位置:', eventData.point);
        }
    }

    // ==================== 数据导入导出方法 ====================

    /**
     * 导出点位数据为 JSON
     */
    exportToJSON() {
        const points = this.getAllPoints();
        return JSON.stringify(points, null, 2);
    }

    /**
     * 从 JSON 导入点位数据
     */
    async importFromJSON(jsonString) {
        try {
            const points = JSON.parse(jsonString);

            if (!Array.isArray(points)) {
                throw new Error('数据格式错误：需要数组');
            }

            // 清除现有点位
            this.clearPoints();

            // 导入新点位
            for (const pointData of points) {
                await this.addPoint(pointData, false);
            }

            this.emit('pointsImported', { count: points.length });
            console.log(`[BuildingEditor] 导入了 ${points.length} 个点位`);
            return true;
        } catch (error) {
            console.error('[BuildingEditor] 导入失败:', error);
            this.emit('importError', { error: error.message });
            return false;
        }
    }

    /**
     * 获取点位统计信息
     */
    getStatistics() {
        const points = this.getAllPoints();
        const stats = {
            total: points.length,
            byFloor: {},
            byType: {}
        };

        points.forEach(point => {
            // 按楼层统计
            if (!stats.byFloor[point.floor]) {
                stats.byFloor[point.floor] = 0;
            }
            stats.byFloor[point.floor]++;

            // 按类型统计
            if (!stats.byType[point.type]) {
                stats.byType[point.type] = 0;
            }
            stats.byType[point.type]++;
        });

        return stats;
    }

    // ==================== 生命周期方法 ====================

    /**
     * 每帧更新
     */
    onUpdate(delta) {
        // 可以添加动画效果
    }

    async updateConfig(newConfig = {}) {
        const oldPoints = this.config?.points || [];
        const oldPointSize = this.config?.pointSize;
        const oldHighlightColor = this.config?.highlightColor;
        const oldFilters = {
            floor: this.currentFloorFilter,
            type: this.currentTypeFilter
        };

        this.config = {
            ...this.config,
            ...newConfig
        };

        const pointsChanged = newConfig.points !== undefined;
        const styleChanged = newConfig.pointSize !== undefined || newConfig.highlightColor !== undefined;

        if (pointsChanged || styleChanged) {
            this.clearPoints();
            await this.createInitialPoints();
            this.currentFloorFilter = oldFilters.floor;
            this.currentTypeFilter = oldFilters.type;
            this.applyFilters();
        }

        if (
            newConfig.selectedFloor !== undefined ||
            newConfig.selectedType !== undefined
        ) {
            this.currentFloorFilter = newConfig.selectedFloor ?? this.currentFloorFilter;
            this.currentTypeFilter = newConfig.selectedType ?? this.currentTypeFilter;
            this.applyFilters();
        }

        this.emit('configUpdated', {
            oldPoints,
            points: this.config.points,
            oldPointSize,
            pointSize: this.config.pointSize,
            oldHighlightColor,
            highlightColor: this.config.highlightColor
        });
    }

    async updateData(data, options = {}) {
        const patch = options && typeof options === 'object' && options.config && typeof options.config === 'object'
            ? { ...options.config }
            : {};

        if (Array.isArray(data)) {
            patch.points = data;
        } else if (data && typeof data === 'object') {
            patch.points = Array.isArray(data.points) ? data.points : [];
        } else {
            patch.points = [];
        }

        await this.updateConfig(patch);
        return {
            success: true,
            count: Array.isArray(patch.points) ? patch.points.length : 0
        };
    }

    /**
     * 组件销毁
     */
    onDispose() {
        console.log('[BuildingEditor] 销毁组件');

        // 移除鼠标事件
        this.removeMouseEvents();

        // 清除所有点位
        this.clearPoints();

        // 清除纹理缓存
        this.textureCache.forEach(texture => {
            texture.dispose();
        });
        this.textureCache.clear();

        // 清空映射表
        this.pointObjects.clear();
        this.pointDataMap.clear();
        this.typeConfigMap.clear();
    }
}

export default BuildingEditor;
