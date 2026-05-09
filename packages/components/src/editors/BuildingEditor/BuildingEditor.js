import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Editors module component that manages building point editing, filtering, labels, and interaction workflows.
 */
export class BuildingEditor extends Component {
    static defaultConfig = {
        points: [],
        pointTypes: [],
        selectedFloor: 'all',
        selectedType: 'all',
        enableRightClick: true,
        pointSize: 1.0,
        highlightColor: 0xFFFF00,
        defaultIcon: null,
        labelOffset: { x: 0, y: 1.5, z: 0 }
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

    async onMounted() {
        this.pointObjects = new Map();

        this.pointDataMap = new Map();

        this.typeConfigMap = new Map();

        this.selectedPointId = null;

        this.currentFloorFilter = this.config.selectedFloor;
        this.currentTypeFilter = this.config.selectedType;

        this.textureLoader = new THREE.TextureLoader();

        this.textureCache = new Map();

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Sprite = { threshold: 10 };
        this.mouse = new THREE.Vector2();

        this.initPointTypes();

        await this.createInitialPoints();

        this.setupMouseEvents();

        console.log('[BuildingEditor] 组件初始化完成');
    }

    initPointTypes() {
        const { pointTypes } = this.config;

        if (pointTypes && pointTypes.length > 0) {
            pointTypes.forEach(typeConfig => {
                this.typeConfigMap.set(typeConfig.id, typeConfig);
            });
        }

        console.log('[BuildingEditor] 点位类型配置:', this.typeConfigMap);
    }

    async createInitialPoints() {
        const { points } = this.config;

        if (points && points.length > 0) {
            for (let index = 0; index < points.length; index += 1) {
                const pointData = this.normalizePointData(points[index], index);
                await this.addPoint(pointData, false);
            }
        }

        console.log('[BuildingEditor] 初始点位创建完成，共', this.pointObjects.size, '个');
    }

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

    generateId() {
        return 'point_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getTypeConfig(typeId) {
        return this.typeConfigMap.get(typeId) || null;
    }

    getInteractiveObjects() {
        return Array.from(this.pointObjects.values()).filter(obj => obj.visible);
    }


    async createPointObject(pointData) {
        const { id, type } = pointData;
        const position = this.normalizePosition(pointData.position, { x: 0, y: 0, z: 0 });
        const typeConfig = this.getTypeConfig(type);
        const { pointSize } = this.config;

        let markerObject;

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
                markerObject = this.createDefaultMarker(typeConfig, pointSize);
            }
        } else {
            markerObject = this.createDefaultMarker(typeConfig, pointSize);
        }

        markerObject.position.set(position.x, position.y, position.z);

        markerObject.userData = {
            pointId: id,
            pointType: type,
            isBuildingPoint: true
        };

        return markerObject;
    }

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

    async addPoint(pointData, triggerEvent = true) {
        const normalizedData = this.normalizePointData(pointData, this.pointObjects.size);
        const { id } = normalizedData;

        if (this.pointObjects.has(id)) {
            console.warn(`[BuildingEditor] 点位 ${id} 已存在`);
            return null;
        }

        const pointObject = await this.createPointObject(normalizedData);

        if (!pointObject) {
            console.error(`[BuildingEditor] 创建点位 ${id} 失败`);
            return null;
        }

        this.add(pointObject);

        this.pointObjects.set(id, pointObject);
        this.pointDataMap.set(id, { ...normalizedData });

        this.applyFiltersToPoint(id);

        if (triggerEvent) {
            this.emit('pointAdded', { pointId: id, pointData: normalizedData });
        }

        console.log(`[BuildingEditor] 添加点位: ${id}`);
        return normalizedData;
    }

    async updatePoint(id, updates) {
        const pointObject = this.pointObjects.get(id);
        const pointData = this.pointDataMap.get(id);

        if (!pointObject || !pointData) {
            console.warn(`[BuildingEditor] 点位 ${id} 不存在`);
            return false;
        }

        if (updates.position) {
            const nextPosition = this.normalizePosition(updates.position, pointData.position || { x: 0, y: 0, z: 0 });
            pointObject.position.set(
                nextPosition.x,
                nextPosition.y,
                nextPosition.z
            );
            updates.position = nextPosition;
        }

        if (updates.type && updates.type !== pointData.type) {
            const newPointData = { ...pointData, ...updates };
            await this.removePoint(id, false);
            await this.addPoint(newPointData, false);
        }

        Object.assign(pointData, updates);
        this.pointDataMap.set(id, pointData);

        this.applyFiltersToPoint(id);

        this.emit('pointUpdated', { pointId: id, pointData, updates });

        console.log(`[BuildingEditor] 更新点位: ${id}`);
        return true;
    }

    removePoint(id, triggerEvent = true) {
        const pointObject = this.pointObjects.get(id);
        const pointData = this.pointDataMap.get(id);

        if (!pointObject) {
            console.warn(`[BuildingEditor] 点位 ${id} 不存在`);
            return false;
        }

        if (this.selectedPointId === id) {
            this.deselectPoint();
        }

        this.remove(pointObject);

        if (pointObject.geometry) {
            pointObject.geometry.dispose();
        }
        if (pointObject.material) {
            if (pointObject.material.map) {
            }
            pointObject.material.dispose();
        }

        this.pointObjects.delete(id);
        this.pointDataMap.delete(id);

        if (triggerEvent) {
            this.emit('pointRemoved', { pointId: id, pointData });
        }

        console.log(`[BuildingEditor] 删除点位: ${id}`);
        return true;
    }

    getPoint(id) {
        return this.pointDataMap.get(id) || null;
    }

    getAllPoints() {
        return Array.from(this.pointDataMap.values());
    }

    getFilteredPoints() {
        return this.getAllPoints().filter(point => {
            const floorMatch = this.currentFloorFilter === 'all' || point.floor === this.currentFloorFilter;
            const typeMatch = this.currentTypeFilter === 'all' || point.type === this.currentTypeFilter;
            return floorMatch && typeMatch;
        });
    }

    clearPoints() {
        const ids = Array.from(this.pointObjects.keys());
        ids.forEach(id => this.removePoint(id, false));
        this.emit('pointsCleared');
    }


    filterByFloor(floor) {
        this.currentFloorFilter = floor;
        this.applyFilters();
        this.emit('filterChanged', { floor, type: this.currentTypeFilter });
    }

    filterByType(type) {
        this.currentTypeFilter = type;
        this.applyFilters();
        this.emit('filterChanged', { floor: this.currentFloorFilter, type });
    }

    setFilters(floor, type) {
        this.currentFloorFilter = floor;
        this.currentTypeFilter = type;
        this.applyFilters();
        this.emit('filterChanged', { floor, type });
    }

    applyFilters() {
        this.pointObjects.forEach((_, id) => {
            this.applyFiltersToPoint(id);
        });
    }

    applyFiltersToPoint(id) {
        const pointObject = this.pointObjects.get(id);
        const pointData = this.pointDataMap.get(id);

        if (!pointObject || !pointData) return;

        const floorMatch = this.currentFloorFilter === 'all' || pointData.floor === this.currentFloorFilter;
        const typeMatch = this.currentTypeFilter === 'all' || pointData.type === this.currentTypeFilter;

        pointObject.visible = floorMatch && typeMatch;
    }


    selectPoint(id) {
        const pointObject = this.pointObjects.get(id);
        const pointData = this.pointDataMap.get(id);

        if (!pointObject || !pointData) {
            console.warn(`[BuildingEditor] 点位 ${id} 不存在`);
            return;
        }

        if (this.selectedPointId && this.selectedPointId !== id) {
            this.deselectPoint();
        }

        this.selectedPointId = id;
        this.highlightPoint(pointObject);

        this.emit('pointClicked', { pointId: id, pointData });
        console.log(`[BuildingEditor] 选中点位: ${id}`);
    }

    deselectPoint() {
        if (!this.selectedPointId) return;

        const pointObject = this.pointObjects.get(this.selectedPointId);
        if (pointObject) {
            this.unhighlightPoint(pointObject, this.selectedPointId);
        }

        this.selectedPointId = null;
        this.emit('pointDeselected');
    }

    highlightPoint(pointObject) {
        const { highlightColor } = this.config;

        if (!pointObject.userData.originalColor && pointObject.material) {
            pointObject.userData.originalColor = pointObject.material.color.getHex();
        }

        if (pointObject.material) {
            pointObject.material.color.setHex(highlightColor);
        }

        if (!pointObject.userData.originalScale) {
            pointObject.userData.originalScale = pointObject.scale.clone();
        }
        pointObject.scale.multiplyScalar(1.3);
    }

    unhighlightPoint(pointObject, id) {
        if (pointObject.userData.originalColor !== undefined && pointObject.material) {
            pointObject.material.color.setHex(pointObject.userData.originalColor);
            delete pointObject.userData.originalColor;
        }

        if (pointObject.userData.originalScale) {
            pointObject.scale.copy(pointObject.userData.originalScale);
            delete pointObject.userData.originalScale;
        }
    }


    setupMouseEvents() {
        if (!this.scene || !this.scene.eventSystem) {
            console.warn('[BuildingEditor] 无法设置鼠标事件：场景/事件系统未就绪');
            return;
        }

        this.onSceneClick = this.handleSceneClick.bind(this);
        this.onSceneContextMenu = this.handleSceneContextMenu.bind(this);

        this.scene.eventSystem.on('click', this.onSceneClick);
        this.scene.eventSystem.on('contextmenu', this.onSceneContextMenu);

        console.log('[BuildingEditor] 鼠标事件设置完成');
    }

    removeMouseEvents() {
        if (!this.scene || !this.scene.eventSystem) return;

        if (this.onSceneClick) {
            this.scene.eventSystem.off('click', this.onSceneClick);
        }
        if (this.onSceneContextMenu) {
            this.scene.eventSystem.off('contextmenu', this.onSceneContextMenu);
        }
    }

    handleSceneClick(eventData) {
        if (eventData.object && eventData.object.userData.isBuildingPoint) {
            const pointId = eventData.object.userData.pointId;
            this.selectPoint(pointId);
        }
    }

    handleSceneContextMenu(eventData) {
        if (!this.config.enableRightClick) return;

        if (eventData.object && eventData.object.userData.isBuildingPoint) {
            return;
        }

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


    exportToJSON() {
        const points = this.getAllPoints();
        return JSON.stringify(points, null, 2);
    }

    async importFromJSON(jsonString) {
        try {
            const points = JSON.parse(jsonString);

            if (!Array.isArray(points)) {
                throw new Error('数据格式错误：需要数组');
            }

            this.clearPoints();

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

    getStatistics() {
        const points = this.getAllPoints();
        const stats = {
            total: points.length,
            byFloor: {},
            byType: {}
        };

        points.forEach(point => {
            if (!stats.byFloor[point.floor]) {
                stats.byFloor[point.floor] = 0;
            }
            stats.byFloor[point.floor]++;

            if (!stats.byType[point.type]) {
                stats.byType[point.type] = 0;
            }
            stats.byType[point.type]++;
        });

        return stats;
    }


    onUpdate(delta) {
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

    onDispose() {
        console.log('[BuildingEditor] 销毁组件');

        this.removeMouseEvents();

        this.clearPoints();

        this.textureCache.forEach(texture => {
            texture.dispose();
        });
        this.textureCache.clear();

        this.pointObjects.clear();
        this.pointDataMap.clear();
        this.typeConfigMap.clear();
    }
}

export default BuildingEditor;
