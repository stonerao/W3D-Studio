/**
 * 组件注册表
 * 管理所有可用的 W3D 组件
 */

import {
    ModelLoader,
    GeoJSONLoader,
    GaussianSplatLoader,
    GridHelper,
    HDRLoader,
    TransformControls,
    FlyControls,
    FirstPersonControls,
    BoundingBoxHelper,
    ParticleSystem,
    Heatmap,
    AreaBlock,
    PathAnimation,
    MultiPathAnimation,
    TrajectoryMove,
    CameraTour,
    CameraJump,
    ModelAnimation,
    MigrationLine,
    Label3D,
    MarkArea,
    MarkLine,
    MarkPoint,
    PointTypeMarkerManager,
    CameraPointManager,
    ExplodedView,
    DeviceExplodedView,
    PostProcessing,
    TrafficRoadsideDeviceManager,
    WeatherLighting,
    WeatherClouds,
    BuildingEditor,
    normalizeComponentMethodDefinitions,
    extractComponentMethodDefinitions
} from '@w3d/components';
import { cloneGeojsonCityDemo } from '../mocks/geojsonCityDemo';

// 组件注册表
const componentRegistry = new Map();

const STOP_PROTOTYPE_CLASS_NAMES = new Set([
    'Object3D',
    'Group',
    'EventDispatcher',
    'Object'
]);

const BUSINESS_METHOD_WHITELIST = new Set([
    'updateconfig',
    'updatedata',
    'setdata',
    'start',
    'stop',
    'pause',
    'resume',
    'reset',
    'play',
    'playall',
    'startall',
    'stopall',
    'reload',
    'enable',
    'disable',
    'open',
    'close',
    'focus',
    'blur',
    'flyto',
    'jumpto',
    'setweatherpreset',
    'settimepreset'
]);

const BUSINESS_METHOD_META_MAP = Object.freeze({
    updateconfig: Object.freeze({
        title: '更新配置',
        description: '更新组件配置参数',
        params: Object.freeze([
            Object.freeze({ name: 'newConfig', title: '配置对象', type: 'object', required: true })
        ])
    }),
    updatedata: Object.freeze({
        title: '更新数据',
        description: '更新组件业务数据',
        params: Object.freeze([
            Object.freeze({ name: 'data', title: '数据对象', type: 'object', required: true })
        ])
    }),
    setdata: Object.freeze({
        title: '设置数据',
        description: '设置组件业务数据',
        params: Object.freeze([
            Object.freeze({ name: 'data', title: '数据对象', type: 'object', required: true })
        ])
    }),
    start: Object.freeze({ title: '开始', description: '启动组件逻辑' }),
    stop: Object.freeze({ title: '停止', description: '停止组件逻辑' }),
    pause: Object.freeze({ title: '暂停', description: '暂停组件逻辑' }),
    resume: Object.freeze({ title: '恢复', description: '恢复组件逻辑' }),
    reset: Object.freeze({ title: '重置', description: '重置组件状态' }),
    play: Object.freeze({ title: '播放', description: '开始播放' }),
    playall: Object.freeze({ title: '全部播放', description: '播放全部内容' }),
    startall: Object.freeze({ title: '全部开始', description: '开始全部任务' }),
    stopall: Object.freeze({ title: '全部停止', description: '停止全部任务' }),
    reload: Object.freeze({ title: '重新加载', description: '重新加载资源或状态' }),
    enable: Object.freeze({ title: '启用', description: '启用组件能力' }),
    disable: Object.freeze({ title: '禁用', description: '禁用组件能力' }),
    open: Object.freeze({ title: '打开', description: '打开组件状态' }),
    close: Object.freeze({ title: '关闭', description: '关闭组件状态' }),
    focus: Object.freeze({ title: '聚焦', description: '聚焦到目标对象或状态' }),
    blur: Object.freeze({ title: '失焦', description: '取消当前聚焦状态' }),
    flyto: Object.freeze({ title: '飞行到目标', description: '相机飞行到目标位置' }),
    jumpto: Object.freeze({ title: '跳转到目标', description: '相机直接跳转到目标位置' }),
    setweatherpreset: Object.freeze({ title: '设置天气预设', description: '设置天气效果预设' }),
    settimepreset: Object.freeze({ title: '设置时间预设', description: '设置昼夜时间预设' })
});

const VISIBILITY_METHOD_DEFINITIONS = Object.freeze([
    Object.freeze({
        name: 'show',
        title: '显示',
        description: '显示组件',
        params: Object.freeze([])
    }),
    Object.freeze({
        name: 'hide',
        title: '隐藏',
        description: '隐藏组件',
        params: Object.freeze([])
    }),
    Object.freeze({
        name: 'toggle',
        title: '显示/隐藏',
        description: '切换组件显示状态',
        params: Object.freeze([])
    }),
    Object.freeze({
        name: 'setVisible',
        title: '设置显示',
        description: '按布尔值设置组件显示状态',
        params: Object.freeze([
            Object.freeze({ name: 'visible', title: '是否显示', type: 'boolean', required: true })
        ])
    })
]);

function extractWhitelistedBusinessMethods(ComponentClass) {
    if (!ComponentClass || !ComponentClass.prototype) return [];

    const methods = [];
    const seen = new Set();
    let proto = ComponentClass.prototype;

    while (proto && proto !== Object.prototype) {
        const className = proto.constructor?.name || '';
        if (STOP_PROTOTYPE_CLASS_NAMES.has(className)) break;

        Object.getOwnPropertyNames(proto).forEach((key) => {
            if (!key || key === 'constructor' || key.startsWith('_')) return;
            const normalizedKey = key.toLowerCase();
            if (!BUSINESS_METHOD_WHITELIST.has(normalizedKey) || seen.has(normalizedKey)) return;
            const descriptor = Object.getOwnPropertyDescriptor(proto, key);
            if (!descriptor || typeof descriptor.value !== 'function') return;

            seen.add(normalizedKey);
            const meta = BUSINESS_METHOD_META_MAP[normalizedKey] || null;
            methods.push({
                name: key,
                title: meta?.title || key,
                description: meta?.description || '',
                params: Array.isArray(meta?.params) ? meta.params : []
            });
        });

        proto = Object.getPrototypeOf(proto);
    }

    return methods;
}

/**
 * 注册组件
 * @param {string} name - 组件名称
 * @param {Class} ComponentClass - 组件类
 * @param {Object} metadata - 组件元数据
 */
export function registerComponent(name, ComponentClass, metadata = {}) {
    const explicitMethodDefinitions = [
        ...(Array.isArray(metadata.methods) ? metadata.methods : (metadata.methods ? [metadata.methods] : [])),
        ...(Array.isArray(ComponentClass?.methodDefinitions)
            ? ComponentClass.methodDefinitions
            : (ComponentClass?.methodDefinitions ? [ComponentClass.methodDefinitions] : [])),
        ...(Array.isArray(metadata.events) ? metadata.events : (metadata.events ? [metadata.events] : []))
    ];

    const shouldExtractMethods = metadata.autoExtractMethods === true;
    const whitelistedBusinessMethods = extractWhitelistedBusinessMethods(ComponentClass);
    const rawMethodDefinitions = [
        ...VISIBILITY_METHOD_DEFINITIONS,
        ...explicitMethodDefinitions,
        ...whitelistedBusinessMethods,
        ...(shouldExtractMethods ? extractComponentMethodDefinitions(ComponentClass) : [])
    ];

    const methods = normalizeComponentMethodDefinitions(
        rawMethodDefinitions,
        {
            includeDefaults: metadata.includeDefaultMethods !== false
        }
    );

    componentRegistry.set(name, {
        name,
        class: ComponentClass,
        metadata: {
            displayName: metadata.displayName || name,
            description: metadata.description || '',
            icon: metadata.icon || '📦',
            category: metadata.category || 'general',
            defaultConfig: metadata.defaultConfig || {},
            configSchema: metadata.configSchema || [],
            methods, // 组件支持的可调用方法元数据
            events: methods.map((item) => item.name) // 兼容旧逻辑
        }
    });
}

/**
 * 获取组件
 * @param {string} name - 组件名称
 * @returns {Object|null} 组件信息
 */
export function getComponent(name) {
    return componentRegistry.get(name) || null;
}

export function getComponentMethodDefinitions(name) {
    const component = getComponent(name);
    return component?.metadata?.methods || [];
}

/**
 * 获取所有组件
 * @returns {Array} 组件列表
 */
export function getAllComponents() {
    return Array.from(componentRegistry.values());
}

/**
 * 根据分类获取组件
 * @param {string} category - 分类名称
 * @returns {Array} 组件列表
 */
export function getComponentsByCategory(category) {
    return Array.from(componentRegistry.values()).filter(
        (comp) => comp.metadata.category === category
    );
}

/**
 * 检查组件是否已注册
 * @param {string} name - 组件名称
 * @returns {boolean}
 */
export function hasComponent(name) {
    return componentRegistry.has(name);
}

/**
 * 注销组件
 * @param {string} name - 组件名称
 */
export function unregisterComponent(name) {
    componentRegistry.delete(name);
}

/**
 * 清空注册表
 */
export function clearRegistry() {
    componentRegistry.clear();
}

// 初始化默认组件
export function initializeDefaultComponents() {
    // 注册 ModelLoader
    registerComponent('ModelLoader', ModelLoader, {
        displayName: '模型加载器',
        description: '加载 GLTF/GLB/FBX 格式的 3D 模型，支持动画和交互',
        icon: '🎨',
        category: 'loaders',
        defaultConfig: {
            url: '',
            scale: 1,
            sizeMode: 'scale',
            targetSize: 1,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            castShadow: false,
            receiveShadow: false,
            animations: true,
            autoPlayAnimation: false,
            interactiveMeshes: false,
            eventInteractiveMeshes: false,
            performanceMode: false,
            bakedLighting: {
                enabled: false,
                textureMapping: {},
                mode: 'bake',
                intensity: 3.5,
                autoApply: true,
                disableInEditor: false,
                channel: 1,
                flipY: false,
                IndependentMaterial: true
            },
            largeScene: {
                enabled: false,
                organization: {
                    zone: '',
                    floor: '',
                    chunk: ''
                },
                distanceCulling: {
                    enabled: false,
                    maxVisibleDistance: 800
                },
                lod: {
                    enabled: false,
                    midDistance: 280,
                    farDistance: 560,
                    mediumMeshRatio: 0.015,
                    lowMeshRatio: 0.04,
                    preserveInteractiveMeshes: true
                },
                streaming: {
                    enabled: false
                },
                thresholds: {
                    trianglesWarning: 250000,
                    meshesWarning: 300
                }
            }
        },
        configSchema: [
            {
                key: 'url',
                label: '模型 URL',
                type: 'asset',
                category: 'model',
                required: true,
                placeholder: '/models/example.glb',
                description: '支持 GLTF、GLB、FBX 格式，可从资源库选择'
            },
            {
                key: 'position',
                label: '位置',
                type: 'vector3',
                default: [0, 0, 0]
            },
            {
                key: 'rotation',
                label: '旋转',
                type: 'vector3',
                default: [0, 0, 0]
            },
            {
                key: 'scale',
                label: '缩放',
                type: 'number',
                default: 1,
                min: 0.01,
                max: 10,
                step: 0.1
            },
            {
                key: 'castShadow',
                label: '投射阴影',
                type: 'boolean',
                default: false
            },
            {
                key: 'receiveShadow',
                label: '接收阴影',
                type: 'boolean',
                default: false
            },
            {
                key: 'animations',
                label: '启用动画',
                type: 'boolean',
                default: true,
                description: '是否加载模型动画'
            },
            {
                key: 'autoPlayAnimation',
                label: '自动播放动画',
                type: 'boolean',
                default: false,
                description: '加载完成后自动播放第一个动画'
            },
            {
                key: 'interactiveMeshes',
                label: '交互模式',
                type: 'select',
                default: false,
                options: [
                    { label: '禁用', value: false },
                    { label: '全部启用', value: '*' },
                    { label: '指定 Mesh', value: 'custom' }
                ],
                description: '配置哪些 Mesh 可以响应交互事件'
            }
        ],
        methods: [
            {
                name: 'playAnimation',
                title: '播放动画',
                description: '按索引播放模型动画',
                params: [
                    { name: 'index', title: '动画索引', type: 'number', required: false },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            },
            { name: 'pauseAnimation', title: '暂停动画', description: '暂停当前模型动画' },
            { name: 'resumeAnimation', title: '继续动画', description: '继续播放当前模型动画' },
            { name: 'stopAnimation', title: '停止动画', description: '停止当前模型动画' },
            { name: 'getAnimationNames', title: '获取动画列表', description: '返回模型可用动画名称列表' },
            {
                name: 'setMeshVisibility',
                title: '设置网格显隐',
                description: '按网格名称设置显示或隐藏',
                params: [
                    { name: 'meshName', title: '网格名称', type: 'string', required: true },
                    { name: 'visible', title: '是否显示', type: 'boolean', required: true }
                ]
            },
            {
                name: 'hideMeshesExcept',
                title: '隐藏其他物体',
                description: '只显示指定物体，隐藏模型加载器内其余物体',
                params: [
                    {
                        name: 'targets',
                        title: '保留显示的物体',
                        type: 'object',
                        required: true,
                        defaultValue: { mode: 'target', meshNames: [], nodePaths: [], includeChildren: true }
                    }
                ]
            },
            {
                name: 'showOnlyMeshes',
                title: '只显示指定物体',
                description: '只显示指定物体，等同于隐藏其他物体',
                params: [
                    {
                        name: 'targets',
                        title: '保留显示的物体',
                        type: 'object',
                        required: true,
                        defaultValue: { mode: 'target', meshNames: [], nodePaths: [], includeChildren: true }
                    }
                ]
            },
            {
                name: 'setMeshPosition',
                title: '设置物体位置',
                description: '批量设置或增量移动模型内多个物体的位置',
                params: [
                    {
                        name: 'targets',
                        title: '物体(多选)',
                        type: 'object',
                        required: true,
                        defaultValue: { mode: 'target', meshNames: [], nodePaths: [], includeChildren: true }
                    },
                    { name: 'value', title: '位置', type: 'object', required: true, defaultValue: { x: 0, y: 0, z: 0 } },
                    { name: 'operation', title: '操作模式', type: 'string', required: false, defaultValue: 'set' }
                ]
            },
            {
                name: 'setMeshRotation',
                title: '设置物体旋转',
                description: '批量设置或增量旋转模型内多个物体，默认角度单位为度',
                params: [
                    {
                        name: 'targets',
                        title: '物体(多选)',
                        type: 'object',
                        required: true,
                        defaultValue: { mode: 'target', meshNames: [], nodePaths: [], includeChildren: true }
                    },
                    { name: 'value', title: '旋转', type: 'object', required: true, defaultValue: { x: 0, y: 0, z: 0 } },
                    { name: 'operation', title: '操作模式', type: 'string', required: false, defaultValue: 'set' },
                    { name: 'unit', title: '角度单位', type: 'string', required: false, defaultValue: 'deg' }
                ]
            },
            {
                name: 'setMeshScale',
                title: '设置物体缩放',
                description: '批量设置、增量或倍乘模型内多个物体的缩放',
                params: [
                    {
                        name: 'targets',
                        title: '物体(多选)',
                        type: 'object',
                        required: true,
                        defaultValue: { mode: 'target', meshNames: [], nodePaths: [], includeChildren: true }
                    },
                    { name: 'value', title: '缩放', type: 'object', required: true, defaultValue: { x: 1, y: 1, z: 1 } },
                    { name: 'operation', title: '操作模式', type: 'string', required: false, defaultValue: 'set' }
                ]
            },
            {
                name: 'setMeshTransform',
                title: '设置物体变换',
                description: '批量设置或增量更新物体的位置、旋转和缩放',
                params: [
                    {
                        name: 'targets',
                        title: '物体(多选)',
                        type: 'object',
                        required: true,
                        defaultValue: { mode: 'target', meshNames: [], nodePaths: [], includeChildren: true }
                    },
                    { name: 'position', title: '位置', type: 'object', required: false },
                    { name: 'rotation', title: '旋转', type: 'object', required: false },
                    { name: 'scale', title: '缩放', type: 'object', required: false },
                    { name: 'operation', title: '操作模式', type: 'string', required: false, defaultValue: 'set' },
                    { name: 'rotationUnit', title: '旋转单位', type: 'string', required: false, defaultValue: 'deg' }
                ]
            },
            {
                name: 'setMeshesMaterial',
                title: '设置物体材质属性',
                description: '批量更新多个物体的材质属性，例如透明度、颜色、金属度和粗糙度',
                params: [
                    {
                        name: 'targets',
                        title: '物体(多选)',
                        type: 'object',
                        required: true,
                        defaultValue: { mode: 'target', meshNames: [], nodePaths: [], includeChildren: true }
                    },
                    {
                        name: 'materialProps',
                        title: '材质属性',
                        type: 'object',
                        required: true,
                        defaultValue: { opacity: 0.5, transparent: true }
                    }
                ]
            }
        ]
    });

    registerComponent('GaussianSplatLoader', GaussianSplatLoader, {
        displayName: '高斯泼溅',
        description: '加载 PLY / SPLAT / KSPLAT / SPZ 高斯泼溅资源',
        icon: '☁',
        category: 'loaders',
        defaultConfig: {
            url: '',
            format: '',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1,
            splatScale: 1,
            pointCloudMode: false,
            antialiased: false,
            kernel2DSize: 0.3,
            gpuAcceleratedSort: false,
            sharedMemoryForWorkers: false,
            integerBasedSort: true,
            progressiveLoad: false,
            freeIntermediateSplatData: false,
            optimizeSplatData: true,
            focalAdjustment: 1.0,
            splatAlphaRemovalThreshold: 1,
            renderMode: '3d',
            sphericalHarmonicsDegree: 0
        },
        methods: [
            { name: 'reload', title: '重新加载', description: '重新加载高斯泼溅资源' },
            { name: 'diagnose', title: '诊断', description: '输出当前加载状态诊断信息' },
            { name: 'getSplatCount', title: '获取点数量', description: '返回当前泼溅点数量' },
            { name: 'getBounds', title: '获取包围盒', description: '返回当前资源包围盒信息' }
        ],
        configSchema: [
            {
                key: 'url',
                label: '资源 URL',
                type: 'asset',
                category: 'splat',
                required: true,
                placeholder: '/assets/demo.ksplat',
                description: '支持 PLY、SPLAT、KSPLAT、SPZ'
            },
            {
                key: 'format',
                label: '格式提示',
                type: 'select',
                default: '',
                options: [
                    { label: '自动识别', value: '' },
                    { label: 'PLY', value: 'ply' },
                    { label: 'SPLAT', value: 'splat' },
                    { label: 'KSPLAT', value: 'ksplat' },
                    { label: 'SPZ', value: 'spz' }
                ]
            },
            {
                key: 'position',
                label: '位置',
                type: 'vector3',
                default: [0, 0, 0]
            },
            {
                key: 'rotation',
                label: '旋转',
                type: 'vector3',
                default: [0, 0, 0]
            },
            {
                key: 'scale',
                label: '缩放',
                type: 'number',
                default: 1,
                min: 0.01,
                max: 100,
                step: 0.01
            },
            {
                key: 'splatScale',
                label: '泼溅缩放',
                type: 'number',
                default: 1,
                min: 0.01,
                max: 10,
                step: 0.01
            },
            {
                key: 'pointCloudMode',
                label: '点云模式',
                type: 'boolean',
                default: false
            },
            {
                key: 'renderMode',
                label: '渲染模式',
                type: 'select',
                default: '3d',
                options: [
                    { label: '3D', value: '3d' },
                    { label: '2D', value: '2d' }
                ]
            },
            {
                key: 'antialiased',
                label: '抗锯齿补偿',
                type: 'boolean',
                default: false
            },
            {
                key: 'kernel2DSize',
                label: '2D Kernel',
                type: 'number',
                default: 0.3,
                min: 0,
                max: 2,
                step: 0.01
            },
            {
                key: 'focalAdjustment',
                label: '焦距修正',
                type: 'number',
                default: 1,
                min: 0.1,
                max: 5,
                step: 0.01
            },
            {
                key: 'sphericalHarmonicsDegree',
                label: '球谐阶数',
                type: 'select',
                default: 0,
                options: [
                    { label: '0', value: 0 },
                    { label: '1', value: 1 },
                    { label: '2', value: 2 }
                ]
            },
            {
                key: 'splatAlphaRemovalThreshold',
                label: 'Alpha 阈值',
                type: 'number',
                default: 1,
                min: 0,
                max: 255,
                step: 1
            },
            {
                key: 'progressiveLoad',
                label: '渐进加载',
                type: 'boolean',
                default: false
            },
            {
                key: 'gpuAcceleratedSort',
                label: 'GPU 排序',
                type: 'boolean',
                default: false
            },
            {
                key: 'sharedMemoryForWorkers',
                label: '共享内存排序',
                type: 'boolean',
                default: false
            }
        ]
    });

    registerComponent('GeoJSONLoader', GeoJSONLoader, {
        displayName: '数据城市',
        description: '加载 GeoJSON 城市或行政区边界并生成可交互的 3D 数据城市',
        icon: '🗺️',
        category: 'loaders',
        defaultConfig: {
            url: '',
            data: cloneGeojsonCityDemo(),
            sourceType: 'inline',
            coordinateSystem: {
                center: [121.4737, 31.2304],
                scale: 1,
                fitSize: 240,
                flipY: true
            },
            regionKey: 'adcode',
            regionNameKey: 'name',
            geometry: {
                height: 8
            },
            style: {
                fillColor: '#1f6fff',
                topColor: '#49d3ff',
                sideColor: '#0d3f8f',
                lineColor: '#9fefff',
                opacity: 0.95
            },
            visualMapping: {
                enabled: true,
                field: 'value',
                colorRange: ['#2446ff', '#49f3ff'],
                heightRange: [4, 18],
                nullColor: '#1f2a44'
            },
            label: {
                enabled: true,
                field: 'name',
                color: '#ffffff',
                fontSize: 22,
                offsetY: 3
            },
            interaction: {
                hoverEnabled: true,
                selectEnabled: true,
                multiSelect: false,
                focusOnClick: false,
                hoverColor: '#ffffff',
                selectedColor: '#00ffd0'
            },
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
        },
        methods: [
            { name: 'reload', title: '重新加载', description: '重新加载 GeoJSON 数据源' },
            {
                name: 'setData',
                title: '设置 GeoJSON 数据',
                description: '直接用 GeoJSON FeatureCollection 替换当前区域数据',
                params: [{ name: 'featureCollection', title: 'GeoJSON 数据', type: 'object', required: true }]
            },
            {
                name: 'updateData',
                title: '更新区域指标',
                description: '按区域 ID 更新颜色、高度或业务数值',
                params: [{ name: 'dataList', title: '指标列表', type: 'array', required: true }]
            },
            {
                name: 'focusRegion',
                title: '聚焦区域',
                description: '相机聚焦到指定城市/区域',
                params: [{ name: 'regionId', title: '区域 ID', type: 'string', required: true }]
            },
            {
                name: 'setSelectedRegions',
                title: '设置选中区域',
                description: '设置当前选中的区域 ID 列表',
                params: [{ name: 'ids', title: '区域 ID 列表', type: 'array', required: true }]
            },
            { name: 'clearSelection', title: '清空选中', description: '清空当前选中区域' }
        ],
        configSchema: [
            {
                key: 'url',
                label: 'GeoJSON URL',
                type: 'text',
                placeholder: '/mock/geojson-city-demo.json',
                description: 'sourceType=url 时生效'
            },
            {
                key: 'sourceType',
                label: '数据源类型',
                type: 'select',
                default: 'inline',
                options: [
                    { label: 'URL', value: 'url' },
                    { label: '内联 JSON', value: 'inline' }
                ]
            },
            {
                key: 'regionKey',
                label: '区域主键字段',
                type: 'text',
                placeholder: 'adcode'
            },
            {
                key: 'regionNameKey',
                label: '区域名称字段',
                type: 'text',
                placeholder: 'name'
            },
            {
                key: 'coordinateSystem.center',
                label: '坐标中心',
                type: 'vector2',
                default: [0, 0],
                labels: ['经度', '纬度'],
                step: 0.000001,
                description: '设置 GeoJSON 投影中心点'
            },
            {
                key: 'coordinateSystem.scale',
                label: '坐标缩放',
                type: 'number',
                default: 1,
                min: 0.1,
                max: 20,
                step: 0.1
            },
            {
                key: 'coordinateSystem.fitSize',
                label: '适配尺寸',
                type: 'number',
                default: 240,
                min: 20,
                max: 2000,
                step: 10
            },
            {
                key: 'geometry.height',
                label: '默认高度',
                type: 'number',
                default: 8,
                min: 0.5,
                max: 50,
                step: 0.5
            },
            {
                key: 'style.topColor',
                label: '顶面颜色',
                type: 'color',
                default: '#49d3ff'
            },
            {
                key: 'style.sideColor',
                label: '侧面颜色',
                type: 'color',
                default: '#0d3f8f'
            },
            {
                key: 'style.lineColor',
                label: '描边颜色',
                type: 'color',
                default: '#9fefff'
            },
            {
                key: 'style.opacity',
                label: '透明度',
                type: 'number',
                default: 0.95,
                min: 0.1,
                max: 1,
                step: 0.01
            },
            {
                key: 'visualMapping.enabled',
                label: '启用指标映射',
                type: 'boolean',
                default: true
            },
            {
                key: 'visualMapping.field',
                label: '指标字段',
                type: 'text',
                placeholder: 'value'
            },
            {
                key: 'visualMapping.colorRange',
                label: '颜色映射',
                type: 'colorRange',
                default: ['#1d4ed8', '#ef4444'],
                labels: ['低值颜色', '高值颜色'],
                description: '根据指标值在两个颜色之间插值'
            },
            {
                key: 'visualMapping.heightRange',
                label: '高度映射',
                type: 'numberRange',
                default: [4, 40],
                labels: ['最小高度', '最大高度'],
                step: 0.5,
                description: '根据指标值在最小/最大高度之间插值'
            },
            {
                key: 'label.enabled',
                label: '显示标签',
                type: 'boolean',
                default: true
            },
            {
                key: 'label.field',
                label: '标签字段',
                type: 'text',
                placeholder: 'name'
            },
            {
                key: 'interaction.focusOnClick',
                label: '点击后聚焦',
                type: 'boolean',
                default: false
            }
        ]
    });

    // 注册 GridHelper
    registerComponent('GridHelper', GridHelper, {
        displayName: '网格辅助',
        description: '显示网格辅助线',
        icon: '📐',
        category: 'helpers',
        defaultConfig: {
            size: 20,
            divisions: 20,
            color: '#888888'
        },
        methods: [
            {
                name: 'updateConfig',
                title: '更新网格参数',
                description: '更新网格尺寸、分割和颜色',
                params: [
                    { name: 'newConfig', title: '配置对象', type: 'object', required: true }
                ]
            }
        ],
        configSchema: [
            {
                key: 'size',
                label: '网格大小',
                type: 'number',
                default: 20,
                min: 1,
                max: 100
            },
            {
                key: 'divisions',
                label: '分割数',
                type: 'number',
                default: 20,
                min: 1,
                max: 100
            },
            {
                key: 'color',
                label: '颜色',
                type: 'color',
                default: '#888888'
            }
        ]
    });

    // 注册 HDRLoader（主要用于全局背景/环境）
    registerComponent('HDRLoader', HDRLoader, {
        displayName: 'HDR 环境贴图',
        description: '加载 HDR 环境贴图，可作为 environment/background',
        icon: '🌅',
        category: 'loaders',
        defaultConfig: {
            url: '',
            asEnvironment: true,
            asBackground: true,
            intensity: 1.0,
            backgroundIntensity: 1.0
        },
        methods: [
            { name: 'setIntensity', title: '设置环境强度', description: '设置 HDR 环境强度' },
            { name: 'setBackgroundIntensity', title: '设置背景强度', description: '设置 HDR 背景强度' },
            { name: 'setAsEnvironment', title: '环境开关', description: '是否作为环境贴图使用' },
            { name: 'setAsBackground', title: '背景开关', description: '是否作为背景使用' },
            { name: 'getTexture', title: '获取纹理', description: '返回当前 HDR 纹理对象' }
        ],
        configSchema: [
            {
                key: 'url',
                label: 'HDR URL',
                type: 'asset',
                category: 'hdr',
                required: true,
                placeholder: '/textures/studio.hdr',
                description: '点击选择资源库中的 HDR 文件'
            },
            {
                key: 'asEnvironment',
                label: '作为环境贴图',
                type: 'boolean',
                default: true
            },
            {
                key: 'asBackground',
                label: '作为背景',
                type: 'boolean',
                default: true
            },
            {
                key: 'intensity',
                label: '环境强度',
                type: 'number',
                default: 1.0,
                min: 0,
                max: 5,
                step: 0.1
            },
            {
                key: 'backgroundIntensity',
                label: '背景强度',
                type: 'number',
                default: 1.0,
                min: 0,
                max: 5,
                step: 0.1
            }
        ]
    });

    // 注册 TransformControls（编辑器变换 gizmo）
    registerComponent('TransformControls', TransformControls, {
        displayName: '变换控制器',
        description: '对选中的 3D 物体进行平移/旋转/缩放操作',
        icon: '🧭',
        category: 'controls',
        defaultConfig: {
            mode: 'translate',
            size: 1,
            space: 'world',
            enabled: true,
            disableOrbitOnDrag: true
        },
        methods: [
            {
                name: 'attach',
                title: '附加对象',
                description: '将控制器附加到目标对象',
                params: [
                    { name: 'object', title: '目标对象', type: 'object', required: true }
                ]
            },
            { name: 'detach', title: '取消附加', description: '取消当前附加对象' },
            { name: 'setMode', title: '设置模式', description: '设置 translate/rotate/scale 模式' },
            { name: 'setEnabled', title: '启用开关', description: '启用或禁用控制器' },
            { name: 'setSpace', title: '设置空间', description: '设置 world/local 空间模式' },
            { name: 'reset', title: '重置', description: '重置控制器状态' }
        ]
    });

    // 注册 BoundingBoxHelper（选中高亮）
    registerComponent('FlyControls', FlyControls, {
        displayName: '飞行相机',
        description: '自由飞行控制，相机激活后会自动关闭 Orbit 与其他相机模式',
        icon: '🛩️',
        category: 'controls',
        defaultConfig: {
            enabled: true,
            moveSpeed: 12,
            rollSpeed: 1.0,
            dragToLook: true,
            autoForward: false
        },
        configSchema: [
            { key: 'enabled', label: '启用', type: 'boolean', default: true },
            { key: 'moveSpeed', label: '移动速度', type: 'number', default: 12, min: 0.1, max: 200, step: 0.1 },
            { key: 'rollSpeed', label: '转向速度', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1 },
            { key: 'dragToLook', label: '按住拖拽转向', type: 'boolean', default: true },
            { key: 'autoForward', label: '自动前进', type: 'boolean', default: false }
        ],
        methods: [
            { name: 'setEnabled', title: '启用开关', description: '启用或禁用飞行控制' },
            { name: 'activate', title: '激活控制', description: '激活飞行控制模式' },
            { name: 'deactivate', title: '退出控制', description: '退出飞行控制模式' }
        ],
        events: ['activate', 'deactivate', 'setEnabled']
    });

    registerComponent('FirstPersonControls', FirstPersonControls, {
        displayName: '第一人称',
        description: 'WASD + 鼠标视角控制，激活后会自动关闭 Orbit 与其他相机模式',
        icon: '🧍',
        category: 'controls',
        defaultConfig: {
            enabled: true,
            moveSpeed: 5,
            lookSpeed: 0.002,
            runSpeedMultiplier: 2,
            autoPointerLock: true
        },
        configSchema: [
            { key: 'enabled', label: '启用', type: 'boolean', default: true },
            { key: 'moveSpeed', label: '移动速度', type: 'number', default: 5, min: 0.1, max: 50, step: 0.1 },
            { key: 'lookSpeed', label: '视角速度', type: 'number', default: 0.002, min: 0.0001, max: 0.02, step: 0.0001 },
            { key: 'runSpeedMultiplier', label: '疾跑倍率', type: 'number', default: 2, min: 1, max: 5, step: 0.1 },
            { key: 'autoPointerLock', label: '自动锁定鼠标', type: 'boolean', default: true }
        ],
        methods: [
            { name: 'setEnabled', title: '启用开关', description: '启用或禁用第一人称控制' },
            { name: 'activate', title: '激活控制', description: '激活第一人称控制模式' },
            { name: 'deactivate', title: '退出控制', description: '退出第一人称控制模式' },
            { name: 'lockPointer', title: '锁定鼠标', description: '请求锁定鼠标指针' },
            { name: 'unlockPointer', title: '解锁鼠标', description: '释放鼠标指针锁定' }
        ],
        events: ['activate', 'deactivate', 'setEnabled', 'lockPointer', 'unlockPointer']
    });

    registerComponent('BoundingBoxHelper', BoundingBoxHelper, {
        displayName: '包围盒辅助',
        description: '显示目标对象的包围盒（用于选中高亮）',
        icon: '🟨',
        category: 'helpers',
        defaultConfig: {
            target: null,
            color: '#ffff00',
            autoUpdate: true
        },
        methods: [
            {
                name: 'updateConfig',
                title: '更新包围盒配置',
                description: '更新目标对象、颜色和自动更新参数',
                params: [
                    { name: 'newConfig', title: '配置对象', type: 'object', required: true }
                ]
            }
        ]
    });

    // 注册 ParticleSystem
    registerComponent('ParticleSystem', ParticleSystem, {
        displayName: '粒子系统',
        description: '高级粒子系统，支持动态发射、物理效果、多种发射器形状',
        icon: '✨',
        category: 'effects',
        defaultConfig: {
            preset: '',
            count: 500,
            size: 0.3,
            color: '#ffaa00',
            colorEnd: '',
            opacity: 0.9,
            opacityEnd: 0,
            sizeEnd: 0,
            lifetime: 3.0,
            position: [0, 0, 0],
            speedCoefficient: 1.0,
            texture: '',
            emitter: {
                shape: 'point',
                position: [0, 0, 0],
                range: 0.5,
                width: null,
                height: null,
                depth: null,
                rate: 50,
                autoStart: true,
                direction: [0, 1, 0],
                spread: 90
            },
            physics: {
                gravity: -2.0,
                damping: 0.98,
                velocity: { min: 1, max: 3 },
                rotationSpeed: { min: 0, max: 0 }
            },
            blending: 'additive',
            transparent: true
        },
        methods: [
            { name: 'startEmission', title: '开始发射', description: '开始粒子发射' },
            { name: 'stopEmission', title: '停止发射', description: '停止粒子发射' },
            { name: 'toggleEmission', title: '切换发射', description: '切换粒子发射状态' },
            { name: 'clearParticles', title: '清空粒子', description: '清空当前粒子' },
            { name: 'reset', title: '重置系统', description: '重置粒子系统状态' },
            { name: 'setPreset', title: '设置预设', description: '应用预设参数' },
            { name: 'getStats', title: '获取统计', description: '返回粒子系统统计信息' }
        ],
        configSchema: [
            // ━━ 预设 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            {
                key: 'preset',
                label: '效果预设',
                type: 'select',
                group: '预设',
                default: '',
                description: '选择后自动覆盖相关参数，再可二次微调',
                options: [
                    { label: '无（自定义）',   value: '' },
                    { label: '🔥 火焰',        value: 'fire' },
                    { label: '🏕️ 篝火',        value: 'campfire' },
                    { label: '🌋 岩浆',        value: 'lava' },
                    { label: '💨 烟雾',        value: 'smoke' },
                    { label: '💨 蒸汽',        value: 'steam' },
                    { label: '💥 爆炸',        value: 'explosion' },
                    { label: '🌧️ 下雨',        value: 'rain' },
                    { label: '🌧️ 雨滴',        value: 'raindrops' },
                    { label: '❄️ 下雪',        value: 'snow' },
                    { label: '❄️ 雪花',        value: 'snowflakes' },
                    { label: '⛲ 喷泉',        value: 'fountain' },
                    { label: '🌊 瀑布',        value: 'waterfall' },
                    { label: '💦 水花',        value: 'splash' },
                    { label: '🍃 落叶',        value: 'leaves' },
                    { label: '☁️ 云雾',        value: 'cloud' },
                    { label: '⭐ 星星',        value: 'stars' },
                    { label: '🌌 星域',        value: 'starfield' },
                    { label: '🌌 星云',        value: 'nebula' }
                ]
            },

            // ━━ 基础 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            {
                key: 'position',
                label: '位置',
                type: 'vector3',
                group: '基础',
                default: [0, 0, 0]
            },
            {
                key: 'count',
                label: '粒子数量',
                type: 'number',
                group: '基础',
                default: 500,
                min: 10,
                max: 50000,
                step: 50,
                description: '池中总粒子数，影响内存占用'
            },
            {
                key: 'lifetime',
                label: '生命周期(秒)',
                type: 'number',
                group: '基础',
                default: 3.0,
                min: 0.1,
                max: 60,
                step: 0.1
            },

            // ━━ 发射器 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            {
                key: 'emitter.shape',
                label: '发射器形状',
                type: 'select',
                group: '发射器',
                default: 'point',
                options: [
                    { label: '点', value: 'point' },
                    { label: '球体', value: 'sphere' },
                    { label: '盒子', value: 'box' },
                    { label: '锥形', value: 'cone' }
                ]
            },
            {
                key: 'emitter.rate',
                label: '发射速率(个/秒)',
                type: 'number',
                group: '发射器',
                default: 50,
                min: 1,
                max: 2000,
                step: 10
            },
            {
                key: 'emitter.range',
                label: '发射半径',
                type: 'number',
                group: '发射器',
                default: 0.5,
                min: 0.01,
                max: 50,
                step: 0.1,
                description: '球体/锥形发射器使用此半径'
            },
            {
                key: 'emitter.width',
                label: '范围宽度(X)',
                type: 'number',
                group: '发射器',
                default: null,
                min: 0.1,
                max: 200,
                step: 0.5,
                description: '盒子发射器 X 轴宽度，留空则使用半径×2'
            },
            {
                key: 'emitter.height',
                label: '范围高度(Y)',
                type: 'number',
                group: '发射器',
                default: null,
                min: 0.1,
                max: 200,
                step: 0.5,
                description: '盒子发射器 Y 轴高度，留空则使用半径×2'
            },
            {
                key: 'emitter.depth',
                label: '范围深度(Z)',
                type: 'number',
                group: '发射器',
                default: null,
                min: 0.1,
                max: 200,
                step: 0.5,
                description: '盒子发射器 Z 轴深度，留空则使用半径×2'
            },
            {
                key: 'emitter.direction',
                label: '发射方向',
                type: 'vector3',
                group: '发射器',
                default: [0, 1, 0],
                description: '归一化方向向量，决定粒子主飞行方向'
            },
            {
                key: 'emitter.spread',
                label: '扩散角度(°)',
                type: 'number',
                group: '发射器',
                default: 90,
                min: 0,
                max: 180,
                step: 1,
                description: '0=全部沿方向飞出，90=半球，180=全球'
            },

            // ━━ 外观 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            {
                key: 'size',
                label: '起始大小',
                type: 'number',
                group: '外观',
                default: 0.3,
                min: 0.01,
                max: 20,
                step: 0.05
            },
            {
                key: 'color',
                label: '起始颜色',
                type: 'color',
                group: '外观',
                default: '#ffaa00'
            },
            {
                key: 'opacity',
                label: '起始透明度',
                type: 'number',
                group: '外观',
                default: 0.9,
                min: 0,
                max: 1,
                step: 0.05
            },

            // ━━ 生命周期渐变 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            {
                key: 'sizeEnd',
                label: '结束大小',
                type: 'number',
                group: '生命周期渐变',
                default: 0,
                min: 0,
                max: 20,
                step: 0.05,
                description: '粒子消亡时的大小，0=逐渐消失'
            },
            {
                key: 'colorEnd',
                label: '结束颜色',
                type: 'color',
                group: '生命周期渐变',
                default: '',
                description: '留空则颜色不渐变'
            },
            {
                key: 'opacityEnd',
                label: '结束透明度',
                type: 'number',
                group: '生命周期渐变',
                default: 0,
                min: 0,
                max: 1,
                step: 0.05
            },

            // ━━ 物理 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            {
                key: 'speedCoefficient',
                label: '速度系数',
                type: 'number',
                group: '物理',
                default: 1.0,
                min: 0.1,
                max: 10,
                step: 0.1
            },
            {
                key: 'physics.velocity.min',
                label: '最小速度',
                type: 'number',
                group: '物理',
                default: 1,
                min: 0,
                max: 100,
                step: 0.5
            },
            {
                key: 'physics.velocity.max',
                label: '最大速度',
                type: 'number',
                group: '物理',
                default: 3,
                min: 0,
                max: 100,
                step: 0.5
            },
            {
                key: 'physics.gravity',
                label: '重力',
                type: 'number',
                group: '物理',
                default: -2.0,
                min: -50,
                max: 50,
                step: 0.5,
                description: '负值向下，0=无重力，正值向上'
            },
            {
                key: 'physics.damping',
                label: '阻力系数',
                type: 'number',
                group: '物理',
                default: 0.98,
                min: 0.5,
                max: 1.0,
                step: 0.01,
                description: '每帧速度衰减倍率，1=无阻力'
            },
            {
                key: 'physics.rotationSpeed.min',
                label: '最小自转速度(°/s)',
                type: 'number',
                group: '物理',
                default: 0,
                min: -720,
                max: 720,
                step: 10
            },
            {
                key: 'physics.rotationSpeed.max',
                label: '最大自转速度(°/s)',
                type: 'number',
                group: '物理',
                default: 0,
                min: -720,
                max: 720,
                step: 10
            },

            // ━━ 渲染 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            {
                key: 'blending',
                label: '混合模式',
                type: 'select',
                group: '渲染',
                default: 'additive',
                options: [
                    { label: '正常', value: 'normal' },
                    { label: '加法（发光）', value: 'additive' },
                    { label: '正片叠底', value: 'multiply' },
                    { label: '滤色', value: 'screen' }
                ]
            },

            // ━━ 纹理 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            {
                key: 'texture',
                label: '粒子纹理',
                type: 'asset',
                group: '纹理',
                default: '',
                category: 'texture',
                description: '从资源库选择图片作为粒子形状'
            }
        ]
    });

    // 注册 Heatmap
    registerComponent('Heatmap', Heatmap, {
        displayName: '热力图',
        description: '基于点位数据生成平面或模型表面热力贴图，支持颜色梯度、阈值和点位辅助显示',
        icon: '🔥',
        category: 'effects',
        defaultConfig: {
            data: [
                { x: -6, z: -3, value: 10 },
                { x: -2, z: 1, value: 35 },
                { x: 1, z: -2, value: 55 },
                { x: 4, z: 3, value: 80 },
                { x: 7, z: -1, value: 95 }
            ],
            renderMode: 'plane',
            projectionAxis: 'auto',
            surfaceTarget: {
                componentId: '',
                meshName: ''
            },
            size: 2,
            sizeByValue: true,
            minSize: 0.5,
            maxSize: 6,
            threshold: 0,
            minValue: null,
            maxValue: null,
            resolution: 256,
            maxHeatPoints: 1024,
            padding: 1.5,
            opacity: 0.78,
            blending: 'additive',
            softness: 0.72,
            intensity: 1.15,
            coreIntensity: 0.55,
            lowCutoff: 0.02,
            contourSteps: 0,
            falloff: 'gaussian',
            height: 0,
            overlayOffset: 0.04,
            showPointMarkers: false,
            pointMarkerSize: 0.35,
            pointMarkerOpacity: 0.92,
            colors: ['#102a6b', '#00b8ff', '#29f0b4', '#ffe066', '#ff8c42', '#ff3b30'],
            thresholds: []
        },
        methods: [
            {
                name: 'updateData',
                title: '更新热力数据',
                description: '批量更新热力图数据',
                params: [
                    { name: 'data', title: '热力数据数组', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            },
            {
                name: 'sampleHeatAtWorldPosition',
                title: '采样热力值',
                description: '按世界坐标采样当前热力值',
                params: [
                    { name: 'worldPosition', title: '世界坐标', type: 'object', required: true }
                ]
            },
            { name: 'getLegendStops', title: '获取图例', description: '获取热力图图例色带数据' },
            { name: 'getLastRenderInfo', title: '获取渲染信息', description: '获取最近一次渲染统计信息' }
        ],
        configSchema: [
            {
                key: 'data',
                label: '热力数据',
                type: 'json',
                default: [],
                group: '数据',
                description: '数组项支持 { x, y, z, value, size } 或 [x, y, z, value]'
            },
            {
                key: 'maxHeatPoints',
                label: '最大点数',
                type: 'number',
                group: '数据',
                default: 1024,
                min: 1,
                max: 4096,
                step: 1,
                description: '超出上限时仅保留前 N 个点，避免大数据量时编辑器卡顿'
            },
            {
                key: 'renderMode',
                label: '渲染模式',
                type: 'select',
                group: '渲染',
                default: 'plane',
                options: [
                    { label: '平面热力', value: 'plane' },
                    { label: '模型表面', value: 'surface' }
                ]
            },
            {
                key: 'projectionAxis',
                label: '投射平面',
                type: 'select',
                group: '渲染',
                default: 'auto',
                options: [
                    { label: '自动', value: 'auto' },
                    { label: 'XZ 平面', value: 'xz' },
                    { label: 'XY 平面', value: 'xy' },
                    { label: 'YZ 平面', value: 'yz' }
                ],
                description: '平面模式下决定热力图铺设方向；模型表面模式下用于生成投射坐标'
            },
            {
                key: 'surfaceTarget.componentId',
                label: '目标模型',
                type: 'select',
                group: '投射',
                default: '',
                options: [],
                description: '选择要贴附热力图的模型组件'
            },
            {
                key: 'surfaceTarget.meshName',
                label: '目标 Mesh',
                type: 'select',
                group: '投射',
                default: '',
                options: [],
                description: '可选，指定模型中的单个 Mesh'
            },
            {
                key: 'resolution',
                label: '纹理分辨率',
                type: 'number',
                group: '渲染',
                default: 256,
                min: 32,
                max: 1024,
                step: 32,
                description: '分辨率越高边缘越平滑，但会增加计算和显存开销'
            },
            {
                key: 'padding',
                label: '平面边距',
                type: 'number',
                group: '渲染',
                default: 1.5,
                min: 0,
                max: 100,
                step: 0.1,
                description: '仅平面模式使用，在点位包围盒外额外扩展热力范围'
            },
            {
                key: 'overlayOffset',
                label: '表面偏移',
                type: 'number',
                group: '投射',
                default: 0.04,
                min: -5,
                max: 5,
                step: 0.01,
                description: '模型表面模式下沿法线偏移，避免与原模型出现 Z-fighting'
            },
            {
                key: 'size',
                label: '基础半径',
                type: 'number',
                group: '大小',
                default: 2,
                min: 0.1,
                max: 20,
                step: 0.1
            },
            {
                key: 'sizeByValue',
                label: '按值缩放',
                type: 'boolean',
                group: '大小',
                default: true,
                description: '开启后根据 value 在最小/最大半径之间插值'
            },
            {
                key: 'minSize',
                label: '最小半径',
                type: 'number',
                group: '大小',
                default: 0.5,
                min: 0.05,
                max: 20,
                step: 0.05
            },
            {
                key: 'maxSize',
                label: '最大半径',
                type: 'number',
                group: '大小',
                default: 6,
                min: 0.1,
                max: 50,
                step: 0.1
            },
            {
                key: 'falloff',
                label: '衰减曲线',
                type: 'select',
                group: '大小',
                default: 'gaussian',
                options: [
                    { label: '高斯', value: 'gaussian' },
                    { label: '线性', value: 'linear' }
                ]
            },
            {
                key: 'threshold',
                label: '显示阈值',
                type: 'number',
                group: '阈值',
                default: 0,
                min: -10000,
                max: 10000,
                step: 0.1,
                description: '低于该 value 的点将被过滤'
            },
            {
                key: 'minValue',
                label: '最小值（归一化）',
                type: 'number',
                group: '阈值',
                default: 0,
                min: -10000,
                max: 10000,
                step: 0.1
            },
            {
                key: 'maxValue',
                label: '最大值（归一化）',
                type: 'number',
                group: '阈值',
                default: 100,
                min: -10000,
                max: 10000,
                step: 0.1
            },
            {
                key: 'height',
                label: '默认高度',
                type: 'number',
                group: '外观',
                default: 0,
                min: -1000,
                max: 1000,
                step: 0.1,
                description: '当数据点未提供 y 值时使用该高度'
            },
            {
                key: 'opacity',
                label: '透明度',
                type: 'number',
                group: '外观',
                default: 0.78,
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                key: 'blending',
                label: '混合模式',
                type: 'select',
                group: '外观',
                default: 'additive',
                options: [
                    { label: '叠加', value: 'additive' },
                    { label: '正常', value: 'normal' },
                    { label: '相乘', value: 'multiply' },
                    { label: '滤色', value: 'screen' }
                ]
            },
            {
                key: 'softness',
                label: '边缘柔化',
                type: 'number',
                group: '外观',
                default: 0.72,
                min: 0.05,
                max: 1,
                step: 0.01
            },
            {
                key: 'intensity',
                label: '整体强度',
                type: 'number',
                group: '外观',
                default: 1.15,
                min: 0.1,
                max: 3,
                step: 0.05
            },
            {
                key: 'coreIntensity',
                label: '核心增强',
                type: 'number',
                group: '外观',
                default: 0.55,
                min: 0,
                max: 2,
                step: 0.05
            },
            {
                key: 'lowCutoff',
                label: '低值裁剪',
                type: 'number',
                group: '外观',
                default: 0.02,
                min: 0,
                max: 1,
                step: 0.01,
                description: '小于该归一化值的像素直接透明'
            },
            {
                key: 'contourSteps',
                label: '等值分层',
                type: 'number',
                group: '外观',
                default: 0,
                min: 0,
                max: 32,
                step: 1,
                description: '大于 1 时启用阶梯式等值分层效果'
            },
            {
                key: 'showPointMarkers',
                label: '显示点位标记',
                type: 'boolean',
                group: '辅助',
                default: false
            },
            {
                key: 'pointMarkerSize',
                label: '点位尺寸',
                type: 'number',
                group: '辅助',
                default: 0.35,
                min: 0.05,
                max: 10,
                step: 0.05
            },
            {
                key: 'pointMarkerOpacity',
                label: '点位透明度',
                type: 'number',
                group: '辅助',
                default: 0.92,
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                key: 'colors',
                label: '颜色梯度',
                type: 'json',
                group: '颜色',
                default: ['#102a6b', '#00b8ff', '#29f0b4', '#ffe066', '#ff8c42', '#ff3b30'],
                description: '支持纯颜色数组，或 [{ stop, color }] 形式的渐变定义'
            },
            {
                key: 'thresholds',
                label: '阈值颜色映射',
                type: 'json',
                group: '颜色',
                default: [],
                description: '按值分段着色，格式：[{ value, color }]；存在时优先于渐变色带'
            }
        ]
    });

    // 注册 AreaBlock
    registerComponent('AreaBlock', AreaBlock, {
        displayName: '区域块',
        description: '在三维空间中展示区域块，支持墙壁、底部和边框渲染，带云雾 Shader 效果',
        icon: '🏢',
        category: 'markers',
        defaultConfig: {
            areas: [
                {
                    id: 'area_default',
                    points: [
                        [-5, 0, -5],
                        [5, 0, -5],
                        [5, 0, 5],
                        [-5, 0, 5]
                    ]
                }
            ],
            globalConfig: {
                color: '#00ff00',
                showWall: true,
                showBottom: true,
                showBorder: true,
                wallHeight: 5,
                wallOpacity: 0.5,
                bottomOpacity: 0.5,
                borderWidth: 2,
                borderGlow: true,
                animationSpeed: 1.0,
                opacity: 0.5
            }
        },
        methods: [
            {
                name: 'addArea',
                title: '添加区域',
                description: '新增一个区域块',
                params: [
                    { name: 'areaData', title: '区域数据', type: 'object', required: true }
                ]
            },
            {
                name: 'removeArea',
                title: '删除区域',
                description: '按区域ID删除区域块',
                params: [
                    { name: 'id', title: '区域ID', type: 'string', required: true }
                ]
            },
            { name: 'getAllAreas', title: '获取全部区域', description: '返回全部区域块数据' },
            { name: 'clearAreas', title: '清空区域', description: '删除全部区域块' },
            {
                name: 'updateData',
                title: '更新区域数据',
                description: '批量更新区域块数据',
                params: [
                    { name: 'data', title: '区域数组', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            }
        ],
        configSchema: [
            {
                key: 'areas',
                label: '区域块列表',
                type: 'json',
                default: [],
                description: '通过弹窗统一管理区域块与点位，点击保存后整体更新区域块。'
            },
            {
                key: 'globalConfig.color',
                label: '主颜色',
                type: 'color',
                default: '#00ff00',
                group: '外观'
            },
            {
                key: 'globalConfig.wallHeight',
                label: '墙壁高度',
                type: 'number',
                default: 5,
                min: 0,
                max: 100,
                step: 1,
                group: '墙壁'
            },
            {
                key: 'globalConfig.showWall',
                label: '显示墙壁',
                type: 'boolean',
                default: true,
                group: '墙壁'
            },
            {
                key: 'globalConfig.wallOpacity',
                label: '墙壁透明度',
                type: 'number',
                default: 0.5,
                min: 0,
                max: 1,
                step: 0.05,
                group: '墙壁'
            },
            {
                key: 'globalConfig.showBottom',
                label: '显示底部',
                type: 'boolean',
                default: true,
                group: '底部'
            },
            {
                key: 'globalConfig.bottomOpacity',
                label: '底部透明度',
                type: 'number',
                default: 0.5,
                min: 0,
                max: 1,
                step: 0.05,
                group: '底部'
            },
            {
                key: 'globalConfig.showBorder',
                label: '显示边框',
                type: 'boolean',
                default: true,
                group: '边框'
            },
            {
                key: 'globalConfig.borderWidth',
                label: '边框宽度',
                type: 'number',
                default: 2,
                min: 0.5,
                max: 10,
                step: 0.5,
                group: '边框'
            },
            {
                key: 'globalConfig.borderGlow',
                label: '边框发光',
                type: 'boolean',
                default: true,
                group: '边框'
            },
            {
                key: 'globalConfig.animationSpeed',
                label: '动画速度',
                type: 'number',
                default: 1.0,
                min: 0,
                max: 5,
                step: 0.1,
                group: '动画'
            },
            {
                key: 'globalConfig.opacity',
                label: '整体透明度',
                type: 'number',
                default: 0.5,
                min: 0,
                max: 1,
                step: 0.05,
                group: '外观'
            }
        ]
    });

    // 注册 PathAnimation
    registerComponent('PathAnimation', PathAnimation, {
        displayName: '路径动画',
        description: '沿路径移动的动画组件，支持循环、往返、缓动等',
        icon: '🛤️',
        category: 'animations',
        defaultConfig: {
            modelUrl: '',
            path: [
                { x: -5, y: 0, z: 0 },
                { x: 0, y: 2, z: -3 },
                { x: 5, y: 0, z: 0 },
                { x: 0, y: 2, z: 3 }
            ],
            speed: 2.0,
            loop: true,
            pingPong: false,
            autoStart: true,
            lookAtDirection: 'forward',
            showPath: true,
            pathColor: '#00ff88',
            pathWidth: 2
        },
        methods: [
            { name: 'play', title: '开始播放', description: '开始路径动画' },
            { name: 'pause', title: '暂停播放', description: '暂停路径动画' },
            { name: 'stop', title: '停止播放', description: '停止并重置路径动画' },
            {
                name: 'jumpToProgress',
                title: '跳转进度',
                description: '按进度跳转到路径位置',
                params: [
                    { name: 'progress', title: '进度(0-1)', type: 'number', required: true }
                ]
            },
            {
                name: 'jumpToPoint',
                title: '跳转点位',
                description: '跳转到指定路径点',
                params: [
                    { name: 'pointIndex', title: '点位索引', type: 'number', required: true }
                ]
            },
            {
                name: 'updateData',
                title: '更新路径数据',
                description: '批量更新路径点位数组',
                params: [
                    { name: 'data', title: '路径数组', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            }
        ],
        configSchema: [
            {
                key: 'modelUrl',
                label: '模型 URL',
                type: 'asset',
                category: 'model',
                placeholder: '/models/xxx.glb',
                description: '沿路径移动的模型，支持 GLB/GLTF 格式，可从资源库选择'
            },
            {
                key: 'speed',
                label: '移动速度',
                type: 'number',
                default: 1.0,
                min: 0.1,
                max: 50,
                step: 0.1
            },
            {
                key: 'loop',
                label: '循环播放',
                type: 'boolean',
                default: true
            },
            {
                key: 'pingPong',
                label: '往返模式',
                type: 'boolean',
                default: false
            },
            {
                key: 'autoStart',
                label: '自动开始',
                type: 'boolean',
                default: false
            },
            {
                key: 'lookAtDirection',
                label: '朝向模式',
                type: 'select',
                default: 'forward',
                options: [
                    { label: '向前', value: 'forward' },
                    { label: '向后', value: 'backward' },
                    { label: '向上', value: 'up' },
                    { label: '向下', value: 'down' },
                    { label: '固定', value: 'fixed' }
                ]
            },
            {
                key: 'showPath',
                label: '显示路径',
                type: 'boolean',
                default: true
            },
            {
                key: 'pathColor',
                label: '路径颜色',
                type: 'color',
                default: '#00ff88'
            }
        ]
    });

    // 注册 TrajectoryMove
    registerComponent('TrajectoryMove', TrajectoryMove, {
        displayName: '轨迹移动',
        description: '在编辑器中拾取点位作为路线，驱动物体（模型/图片）沿路线前进并始终朝向前方',
        icon: '🚶',
        category: 'animations',
        defaultConfig: {
            assetType: 'model',
            modelUrl: '',
            imageUrl: '',
            fitEnabled: true,
            fitSize: 1,
            modelScale: 1,
            points: [
                { x: 0, y: 0, z: 0 },
                { x: -50, y: 50, z: 100 }
            ],
            speed: 2.0,
            loop: true,
            autoStart: true,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
        },
        methods: [
            { name: 'play', title: '开始移动', description: '开始轨迹移动' },
            { name: 'stop', title: '停止移动', description: '停止轨迹移动并复位' },
            {
                name: 'updateData',
                title: '更新轨迹点位',
                description: '批量更新轨迹点位数据',
                params: [
                    { name: 'data', title: '轨迹点位数组', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            }
        ],
        configSchema: [
            {
                key: 'assetType',
                label: '移动对象类型',
                type: 'select',
                default: 'model',
                options: [
                    { label: '模型', value: 'model' },
                    { label: '图片', value: 'image' }
                ]
            },
            {
                key: 'modelUrl',
                label: '模型 URL',
                type: 'asset',
                category: 'model',
                placeholder: '/models/xxx.glb',
                description: 'assetType=model 时生效，支持 GLB/GLTF，可从资源库选择'
            },
            {
                key: 'imageUrl',
                label: '图片 URL',
                type: 'asset',
                category: 'image',
                placeholder: '/images/xxx.png',
                description: 'assetType=image 时生效，可从资源库选择'
            },
            {
                key: 'fitEnabled',
                label: '模型自适应大小',
                type: 'boolean',
                default: true,
                description: 'assetType=model 时生效：按包围盒最大边将模型适配到目标尺寸'
            },
            {
                key: 'fitSize',
                label: '目标尺寸（最大边）',
                type: 'number',
                default: 1,
                min: 0.01,
                max: 1000,
                step: 0.01,
                description: '默认 1：模型最大边会被缩放到 1 个世界单位'
            },
            {
                key: 'modelScale',
                label: '模型缩放（额外）',
                type: 'number',
                default: 1,
                min: 0.01,
                max: 1000,
                step: 0.01,
                description: '在自适应之后再额外乘以该缩放倍数；默认 1'
            },
            {
                key: 'points',
                label: '路线点位 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '支持 [[x,y,z], ...] 或 [{"x":0,"y":0,"z":0}, ...]；也可在画布中拾取追加',
                placeholder: '[\n  [0, 0, 0],\n  [5, 0, 0],\n  [5, 0, 5]\n]'
            },
            {
                key: 'speed',
                label: '移动速度',
                type: 'number',
                default: 2.0,
                min: 0,
                max: 100,
                step: 0.1
            },
            {
                key: 'loop',
                label: '循环',
                type: 'boolean',
                default: true
            },
            {
                key: 'autoStart',
                label: '自动开始',
                type: 'boolean',
                default: true
            }
        ]
    });

    // 注册 MultiPathAnimation
    registerComponent('MultiPathAnimation', MultiPathAnimation, {
        displayName: '多轨迹路径动画',
        description: '支持加载模型并在多条路径上进行实例化渲染的动画组件',
        icon: '🚗',
        category: 'animations',
        defaultConfig: {
            modelUrl: '',
            paths: [
                {
                    id: 'path_1',
                    data: [
                        [-10, 0, -5],
                        [0, 0, -5],
                        [10, 0, -5]
                    ]
                },
                {
                    id: 'path_2',
                    data: [
                        [-10, 0, 5],
                        [0, 0, 5],
                        [10, 0, 5]
                    ]
                }
            ],
            vehiclesPerPath: 3,
            scale: [1, 1, 1],
            instancedScale: [2, 2, 2],
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            speed: 5,
            loop: true,
            autoStart: true,
            lookAtDirection: 'forward',
            showPath: true,
            pathColor: '#ffaa00'
        },
        methods: [
            { name: 'play', title: '开始播放', description: '开始多路径动画' },
            { name: 'pause', title: '暂停播放', description: '暂停多路径动画' },
            { name: 'stop', title: '停止播放', description: '停止多路径动画' },
            {
                name: 'updateData',
                title: '更新路径数据',
                description: '批量更新多路径数据',
                params: [
                    { name: 'data', title: '路径数组', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            }
        ],
        configSchema: [
            {
                key: 'modelUrl',
                label: '模型 URL',
                type: 'asset',
                category: 'model',
                required: true,
                placeholder: '/models/vehicle.glb',
                description: '支持 GLB/GLTF 格式模型，可从资源库选择'
            },
            {
                key: 'paths',
                label: '路径数据列表',
                type: 'json',
                description: '通过弹窗统一管理路径与点位，点击保存后整体更新路径数据。',
                placeholder: '{\n  "points": [\n    {"id": 1, "name": "点位0", "position": {"x": 0, "y": 0, "z": 0}}\n  ]\n}'
            },
            {
                key: 'instancedScale',
                label: '实例模型缩放',
                type: 'vector3',
                default: [2, 2, 2]
            },
            {
                key: 'vehiclesPerPath',
                label: '每条路径车辆数',
                type: 'number',
                default: 5,
                min: 1,
                max: 50,
                step: 1
            },
            {
                key: 'speed',
                label: '移动速度',
                type: 'number',
                default: 10,
                min: 0.1,
                max: 100,
                step: 1
            },
            {
                key: 'lookAtDirection',
                label: '朝向模式',
                type: 'select',
                default: 'forward',
                options: [
                    { label: '前进方向', value: 'forward' },
                    { label: '后退方向', value: 'backward' },
                    { label: '固定朝向', value: 'fixed' }
                ]
            },
            {
                key: 'loop',
                label: '循环',
                type: 'boolean',
                default: true
            },
            {
                key: 'autoStart',
                label: '自动开始',
                type: 'boolean',
                default: true
            },
            {
                key: 'showPath',
                label: '显示路径',
                type: 'boolean',
                default: true
            },
            {
                key: 'pathColor',
                label: '路径颜色',
                type: 'color',
                default: '#ffaa00'
            }
        ]
    });

    // 注册 CameraTour
    registerComponent('CameraTour', CameraTour, {
        displayName: '定点漫游',
        description: '基于多个视角配置自动进行相机巡游，支持循环、暂停、恢复与动态切换视角列表',
        icon: '🎥',
        category: 'animations',
        defaultConfig: {
            enabled: false,
            views: [],
            loop: 1,
            duration: 2000,
            easing: 'easeInOutQuad',
            autoStart: false,
            startIndex: 0,
            useViewType: true,
            syncNearFar: false,
            viewSource: 'sceneUserData'
        },
        configSchema: [
            {
                key: 'enabled',
                label: '启用',
                type: 'boolean',
                default: false
            },
            {
                key: 'views',
                label: '视角列表 (JSON)',
                type: 'json',
                description: '结构参考视角管理器：[{position,target,cameraType,fov|zoom}]'
            },
            {
                key: 'viewSource',
                label: '视角来源',
                type: 'select',
                default: 'sceneUserData',
                options: [
                    { label: '场景视角管理数据', value: 'sceneUserData' },
                    { label: '组件配置视角', value: 'config' }
                ]
            },
            {
                key: 'loop',
                label: '循环次数',
                type: 'number',
                default: 1,
                min: 0,
                max: 5,
                step: 1,
                description: '0 表示无限循环，1-5 表示固定循环次数'
            },
            {
                key: 'duration',
                label: '每段时长(ms)',
                type: 'number',
                default: 2000,
                min: 0,
                max: 600000,
                step: 100
            },
            {
                key: 'easing',
                label: '缓动函数',
                type: 'select',
                default: 'easeInOutQuad',
                options: [
                    { label: 'linear', value: 'linear' },
                    { label: 'easeInQuad', value: 'easeInQuad' },
                    { label: 'easeOutQuad', value: 'easeOutQuad' },
                    { label: 'easeInOutQuad', value: 'easeInOutQuad' },
                    { label: 'easeInCubic', value: 'easeInCubic' },
                    { label: 'easeOutCubic', value: 'easeOutCubic' },
                    { label: 'easeInOutCubic', value: 'easeInOutCubic' }
                ]
            },
            {
                key: 'autoStart',
                label: '自动开始',
                type: 'boolean',
                default: false
            },
            {
                key: 'startIndex',
                label: '起始视角索引',
                type: 'number',
                default: 0,
                min: 0,
                max: 999,
                step: 1
            },
            {
                key: 'useViewType',
                label: '按视角切相机类型',
                type: 'boolean',
                default: true
            },
            {
                key: 'syncNearFar',
                label: '同步 near/far',
                type: 'boolean',
                default: false
            }
        ],
        methods: [
            { name: 'start', title: '开始漫游', description: '启动定点漫游' },
            { name: 'pause', title: '暂停漫游', description: '暂停当前漫游进度' },
            { name: 'resume', title: '继续漫游', description: '从暂停位置继续漫游' },
            {
                name: 'stop',
                title: '停止漫游',
                description: '停止漫游，可选复位到起始视角',
                params: [
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            },
            {
                name: 'setViews',
                title: '设置视角列表',
                description: '更新漫游视角数据',
                params: [
                    { name: 'views', title: '视角列表', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            },
            {
                name: 'setEnabled',
                title: '启用/禁用漫游',
                description: '控制组件是否可用',
                params: [
                    { name: 'enabled', title: '启用状态', type: 'boolean', required: false }
                ]
            },
            { name: 'activate', title: '激活漫游模式', description: '切换到漫游控制模式' },
            { name: 'deactivate', title: '退出漫游模式', description: '退出漫游控制模式' }
        ],
        events: [
            'start',
            'pause',
            'resume',
            'stop',
            'setViews',
            'activate',
            'deactivate',
            'setEnabled'
        ]
    });

    // 注册 CameraJump
    registerComponent('CameraJump', CameraJump, {
        displayName: '视角跳转',
        description: '将相机跳转到指定 Mesh、标签或点位，支持距离、方向、速度与缓动配置',
        icon: '🎯',
        category: 'animations',
        defaultConfig: {
            targetType: 'mesh',
            distance: 8,
            direction: { x: 1, y: 0.35, z: 1 },
            duration: 1200,
            speed: 1,
            easing: 'easeInOutQuad',
            autoLookAt: true,
            autoStart: false,
            meshTarget: {
                componentId: '',
                meshName: '',
                nodePath: '',
                includeChildren: true
            },
            labelTarget: {
                componentId: '',
                labelId: ''
            },
            pointTarget: {
                source: 'manual',
                pointId: '',
                position: { x: 0, y: 0, z: 0 }
            }
        },
        configSchema: [
            {
                key: 'targetType',
                label: '跳转目标',
                type: 'select',
                default: 'mesh',
                options: [
                    { label: 'Mesh', value: 'mesh' },
                    { label: '标签', value: 'label' },
                    { label: '点位', value: 'point' }
                ]
            },
            {
                key: 'meshTarget.componentId',
                label: 'Mesh 绑定组件',
                type: 'select',
                default: '',
                options: []
            },
            {
                key: 'meshTarget.meshName',
                label: '目标 Mesh',
                type: 'select',
                default: '',
                options: []
            },
            {
                key: 'labelTarget.componentId',
                label: '标签绑定组件',
                type: 'select',
                default: '',
                options: []
            },
            {
                key: 'labelTarget.labelId',
                label: '目标标签',
                type: 'select',
                default: '',
                options: []
            },
            {
                key: 'pointTarget.source',
                label: '点位来源',
                type: 'select',
                default: 'manual',
                options: [
                    { label: '手动填写', value: 'manual' },
                    { label: '点位管理器', value: 'manager' }
                ]
            },
            {
                key: 'pointTarget.pointId',
                label: '管理器点位',
                type: 'select',
                default: '',
                options: []
            },
            {
                key: 'pointTarget.position.x',
                label: '手动点位 X',
                type: 'number',
                default: 0,
                step: 0.1
            },
            {
                key: 'pointTarget.position.y',
                label: '手动点位 Y',
                type: 'number',
                default: 0,
                step: 0.1
            },
            {
                key: 'pointTarget.position.z',
                label: '手动点位 Z',
                type: 'number',
                default: 0,
                step: 0.1
            },
            {
                key: 'distance',
                label: '相机距离',
                type: 'number',
                default: 8,
                min: 0.1,
                max: 2000,
                step: 0.1
            },
            {
                key: 'direction.x',
                label: '方向 X',
                type: 'number',
                default: 1,
                step: 0.1
            },
            {
                key: 'direction.y',
                label: '方向 Y',
                type: 'number',
                default: 0.35,
                step: 0.1
            },
            {
                key: 'direction.z',
                label: '方向 Z',
                type: 'number',
                default: 1,
                step: 0.1
            },
            {
                key: 'duration',
                label: '时长(ms)',
                type: 'number',
                default: 1200,
                min: 0,
                max: 600000,
                step: 100
            },
            {
                key: 'speed',
                label: '速度(单位/秒)',
                type: 'number',
                default: 1,
                min: 0,
                max: 1000,
                step: 0.1,
                description: '大于 0 时按速度计算时长；为 0 时使用固定时长'
            },
            {
                key: 'easing',
                label: '缓动函数',
                type: 'select',
                default: 'easeInOutQuad',
                options: [
                    { label: 'linear', value: 'linear' },
                    { label: 'easeInQuad', value: 'easeInQuad' },
                    { label: 'easeOutQuad', value: 'easeOutQuad' },
                    { label: 'easeInOutQuad', value: 'easeInOutQuad' },
                    { label: 'easeInCubic', value: 'easeInCubic' },
                    { label: 'easeOutCubic', value: 'easeOutCubic' },
                    { label: 'easeInOutCubic', value: 'easeInOutCubic' }
                ]
            },
            {
                key: 'autoLookAt',
                label: '自动看向目标',
                type: 'boolean',
                default: true
            },
            {
                key: 'autoStart',
                label: '自动执行',
                type: 'boolean',
                default: false
            }
        ],
        methods: [
            {
                name: 'jump',
                title: '执行跳转',
                description: '按当前配置或传入配置执行相机跳转',
                params: [
                    { name: 'customConfig', title: '跳转配置', type: 'object', required: false }
                ]
            },
            {
                name: 'jumpToMesh',
                title: '跳转到模型节点',
                description: '按模型组件和网格名称执行跳转',
                params: [
                    { name: 'payload', title: '目标参数', type: 'object', required: false, defaultValue: {} }
                ]
            },
            {
                name: 'jumpToLabel',
                title: '跳转到标签',
                description: '按标签组件和标签ID执行跳转',
                params: [
                    { name: 'payload', title: '目标参数', type: 'object', required: false, defaultValue: {} }
                ]
            },
            {
                name: 'jumpToPoint',
                title: '跳转到点位',
                description: '按点位参数执行跳转',
                params: [
                    { name: 'payload', title: '目标参数', type: 'object', required: false, defaultValue: {} }
                ]
            },
            { name: 'stop', title: '停止跳转', description: '停止当前跳转动画' },
            { name: 'getLastJumpError', title: '获取最后错误', description: '读取最近一次跳转错误信息' }
        ],
        events: [
            'jump',
            'jumpToMesh',
            'jumpToLabel',
            'jumpToPoint',
            'stop'
        ]
    });

    // 注册 ModelAnimation
    registerComponent('ModelAnimation', ModelAnimation, {
        displayName: '模型动画',
        description: '播放模型自带的动画',
        icon: '🎬',
        category: 'animations',
        defaultConfig: {
            target: null,
            clipIndex: 0,
            loop: true,
            timeScale: 1.0
        },
        methods: [
            { name: 'playAnimation', title: '播放模型动画', description: '播放目标模型动画' },
            { name: 'stop', title: '停止动画', description: '停止当前模型动画播放' }
        ],
        configSchema: [
            {
                key: 'clipIndex',
                label: '动画索引',
                type: 'number',
                default: 0,
                min: 0,
                step: 1
            },
            {
                key: 'loop',
                label: '循环播放',
                type: 'boolean',
                default: true
            },
            {
                key: 'timeScale',
                label: '播放速度',
                type: 'number',
                default: 1.0,
                min: 0.1,
                max: 5,
                step: 0.1
            }
        ]
    });

    // 注册 MigrationLine
    registerComponent('MigrationLine', MigrationLine, {
        displayName: '迁移线',
        description: '在三维空间中展示从一个点到另一个点的动态迁移效果，支持纹理贴图和虚线流动',
        icon: '➡️',
        category: 'animations',
        defaultConfig: {
            lines: [
                {
                    id: 'line_1',
                    points: [
                        { x: -5, y: 0, z: 0 },
                        { x: 0, y: 5, z: 0 },
                        { x: 5, y: 0, z: 0 }
                    ]
                },
                {
                    id: 'line_2',
                    points: [
                        { x: 0, y: 0, z: -5 },
                        { x: 0, y: 5, z: 0 },
                        { x: 0, y: 0, z: 5 }
                    ]
                }
            ],
            areas: [],
            markers: [],
            globalConfig: {
                color: '#00ff00',
                size: 2,
                speed: 1,
                duration: 3000,
                loop: true,
                autoStart: true,
                lineWidth: 2,
                texture: '',
                alphaTexture: '',
                textureRepeat: 4,
                dashArray: 0.1,
                dashRatio: 0.5,
                direction: 1,
                sizeAttenuation: true,
                segments: 200,
                widthMode: 'constant',
                taperRatio: 0.5,
                depthTest: true,
                blending: 'normal'
            }
        },
        methods: [
            { name: 'startAll', title: '全部开始', description: '开始所有迁移线动画' },
            { name: 'pauseAll', title: '全部暂停', description: '暂停所有迁移线动画' },
            { name: 'stopAll', title: '全部停止', description: '停止所有迁移线动画' },
            {
                name: 'updateData',
                title: '更新迁移线数据',
                description: '批量更新迁移线/区域/点位数据',
                params: [
                    { name: 'data', title: '数据数组', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            }
        ],
        configSchema: [
            {
                key: 'lines',
                label: '线条列表',
                type: 'json',
                default: [],
                description: '通过弹窗统一管理线条与点位，点击保存后整体更新场景线条。'
            },
            {
                key: 'globalConfig.color',
                label: '颜色',
                type: 'color',
                default: '#00ff00'
            },
            {
                key: 'globalConfig.lineWidth',
                label: '线宽',
                type: 'number',
                default: 2,
                min: 0.1,
                max: 20,
                step: 0.1,
                description: '线条粗细（meshline 类型有效）'
            },
            {
                key: 'globalConfig.speed',
                label: '动画流动速度',
                type: 'number',
                default: 1,
                min: 0.1,
                max: 10,
                step: 0.1,
                description: '控制虚线/纹理流动的整体速度'
            },
            {
                key: 'globalConfig.duration',
                label: '单轮循环时间(ms)',
                type: 'number',
                default: 3000,
                min: 500,
                max: 30000,
                step: 100
            },
            {
                key: 'globalConfig.loop',
                label: '循环',
                type: 'boolean',
                default: true
            },
            {
                key: 'globalConfig.autoStart',
                label: '自动开始',
                type: 'boolean',
                default: true
            },
            {
                key: 'globalConfig.texture',
                label: '流动纹理',
                type: 'asset',
                category: 'texture',
                default: '',
                description: '沿线条流动的纹理（箭头/流光等），从资源库选择'
            },
            {
                key: 'globalConfig.alphaTexture',
                label: '透明度纹理',
                type: 'asset',
                category: 'texture',
                default: '',
                description: '控制线条透明度的纹理，从资源库选择'
            },
            {
                key: 'globalConfig.textureRepeat',
                label: '纹理重复次数',
                type: 'number',
                default: 4,
                min: 1,
                max: 50,
                step: 1,
                description: '纹理沿线方向重复次数'
            },
            {
                key: 'globalConfig.direction',
                label: '流动方向',
                type: 'select',
                default: 1,
                options: [
                    { label: '正向（起点→终点）', value: 1 },
                    { label: '反向（终点→起点）', value: -1 }
                ]
            },
            {
                key: 'globalConfig.dashArray',
                label: '虚线周期',
                type: 'number',
                default: 0.1,
                min: 0,
                max: 1,
                step: 0.01,
                description: '0=实线，默认0.1（每10%一段可见dash）'
            },
            {
                key: 'globalConfig.dashRatio',
                label: '可见比例',
                type: 'number',
                default: 0.5,
                min: 0,
                max: 0.99,
                step: 0.05,
                description: '0=全实线，0.9=小圆点流动效果'
            },
            {
                key: 'globalConfig.widthMode',
                label: '宽度模式',
                type: 'select',
                default: 'constant',
                options: [
                    { label: '等宽', value: 'constant' },
                    { label: '渐细', value: 'taper' },
                    { label: '波浪', value: 'wave' }
                ],
                description: '线条宽度沿路径的变化方式（meshline 类型有效）'
            },
            {
                key: 'globalConfig.taperRatio',
                label: '收窄比例',
                type: 'number',
                default: 0.5,
                min: 0,
                max: 1,
                step: 0.05,
                description: '渐细模式下末端宽度与起始宽度的比（0=完全收尖）'
            },
            {
                key: 'globalConfig.sizeAttenuation',
                label: '远近缩放',
                type: 'boolean',
                default: true,
                description: '线宽是否随相机距离缩放'
            },
            {
                key: 'globalConfig.blending',
                label: '混合模式',
                type: 'select',
                default: 'normal',
                options: [
                    { label: '正常', value: 'normal' },
                    { label: '叠加发光', value: 'additive' }
                ]
            },
            {
                key: 'globalConfig.depthTest',
                label: '深度测试',
                type: 'boolean',
                default: true,
                description: '关闭后线条始终可见（不被模型遮挡）'
            },
            {
                key: 'globalConfig.glowIntensity',
                label: '发光强度',
                type: 'number',
                default: 1.5,
                min: 0,
                max: 5,
                step: 0.1,
                description: 'Shader 旧版类型有效'
            }
        ]
    });

    // 注册 Label3D
    registerComponent('Label3D', Label3D, {
        displayName: '3D 标签',
        description: '在场景中通过 Sprite / Plane 渲染文字标签，支持弹窗列表管理',
        icon: '🏷️',
        category: 'markers',
        defaultConfig: {
            labels: [
                {
                    id: 'label_default',
                    label: '示例标签',
                    position: { x: 0, y: 3, z: 0 },
                    config: {
                        renderMode: 'sprite',
                        autoSize: true,
                        size: 1,
                        textColor: '#ffffff'
                    }
                }
            ],
            globalConfig: {
                renderMode: 'sprite',
                fontSize: 32,
                fontFamily: 'Arial, sans-serif',
                textColor: '#ffffff',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderColor: '#ffffff',
                borderWidth: 2,
                padding: 10,
                borderRadius: 5,
                autoSize: true,
                size: 1,
                width: 2,
                height: 1,
                billboard: true,
                scale: 1,
                depthTest: true,
                sizeAttenuation: true
            }
        },
        methods: [
            {
                name: 'updateLabel',
                title: '更新标签',
                description: '按标签ID更新标签配置',
                params: [
                    { name: 'id', title: '标签ID', type: 'string', required: true },
                    { name: 'updates', title: '更新对象', type: 'object', required: true }
                ]
            },
            {
                name: 'removeLabel',
                title: '删除标签',
                description: '按标签ID删除标签',
                params: [
                    { name: 'id', title: '标签ID', type: 'string', required: true }
                ]
            },
            { name: 'getAllLabels', title: '获取全部标签', description: '返回当前全部标签数据' },
            {
                name: 'showLabel',
                title: '显示标签',
                description: '显示指定标签',
                params: [
                    { name: 'id', title: '标签ID', type: 'string', required: true }
                ]
            },
            {
                name: 'hideLabel',
                title: '隐藏标签',
                description: '隐藏指定标签',
                params: [
                    { name: 'id', title: '标签ID', type: 'string', required: true }
                ]
            },
            {
                name: 'updateData',
                title: '更新标签数据',
                description: '批量更新标签数据',
                params: [
                    { name: 'data', title: '标签数组', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            }
        ],
        configSchema: [
            {
                key: 'labels',
                label: '标签列表',
                type: 'json',
                default: [],
                description: '通过弹窗统一管理标签（新增/编辑/删除），点击保存后整体更新场景标签。'
            },
            {
                key: 'globalConfig.renderMode',
                label: '默认渲染类型',
                type: 'select',
                default: 'sprite',
                options: [
                    { label: 'Sprite', value: 'sprite' },
                    { label: 'Plane', value: 'plane' }
                ]
            },
            {
                key: 'globalConfig.autoSize',
                label: '默认自适应尺寸',
                type: 'boolean',
                default: true
            },
            {
                key: 'globalConfig.size',
                label: '默认基础尺寸',
                type: 'number',
                default: 1,
                min: 0.1,
                max: 20,
                step: 0.1
            },
            {
                key: 'globalConfig.width',
                label: '默认宽度',
                type: 'number',
                default: 2,
                min: 0.1,
                max: 50,
                step: 0.1
            },
            {
                key: 'globalConfig.height',
                label: '默认高度',
                type: 'number',
                default: 1,
                min: 0.1,
                max: 50,
                step: 0.1
            },
            {
                key: 'globalConfig.fontSize',
                label: '字体大小',
                type: 'number',
                default: 32,
                min: 8,
                max: 128,
                step: 2
            },
            {
                key: 'globalConfig.borderColor',
                label: '边框颜色',
                type: 'color',
                default: '#ffffff'
            },
            {
                key: 'globalConfig.borderWidth',
                label: '边框宽度',
                type: 'number',
                default: 2,
                min: 0,
                max: 10,
                step: 1
            },
            {
                key: 'globalConfig.scale',
                label: '缩放',
                type: 'number',
                default: 1,
                min: 0.1,
                max: 10,
                step: 0.1
            },
            {
                key: 'globalConfig.billboard',
                label: '面向相机',
                type: 'boolean',
                default: true
            },
            {
                key: 'globalConfig.depthTest',
                label: '深度测试',
                type: 'boolean',
                default: true
            }
        ]
    });

    // 注册 MarkArea
    registerComponent('MarkArea', MarkArea, {
        displayName: '标注区域',
        description: '在三维空间中显示平面标注区域',
        icon: '⬜',
        category: 'markers',
        defaultConfig: {
            width: 10,
            height: 10,
            color: '#0000ff',
            opacity: 0.3
        },
        methods: [
            {
                name: 'updateConfig',
                title: '更新区域配置',
                description: '更新标注区域参数',
                params: [
                    { name: 'newConfig', title: '配置对象', type: 'object', required: true }
                ]
            }
        ],
        configSchema: [
            {
                key: 'width',
                label: '宽度',
                type: 'number',
                default: 10,
                min: 0.1,
                max: 1000,
                step: 1
            },
            {
                key: 'height',
                label: '高度',
                type: 'number',
                default: 10,
                min: 0.1,
                max: 1000,
                step: 1
            },
            {
                key: 'color',
                label: '颜色',
                type: 'color',
                default: '#0000ff'
            },
            {
                key: 'opacity',
                label: '透明度',
                type: 'number',
                default: 0.3,
                min: 0,
                max: 1,
                step: 0.1
            }
        ]
    });

    // 注册 MarkLine
    registerComponent('MarkLine', MarkLine, {
        displayName: '标注线',
        description: '在三维空间中显示连接多点的线条',
        icon: '📏',
        category: 'markers',
        defaultConfig: {
            points: [
                { x: -5, y: 0, z: 0 },
                { x: 0, y: 3, z: 0 },
                { x: 5, y: 0, z: 0 }
            ],
            color: '#00ff00',
            lineWidth: 2
        },
        methods: [
            {
                name: 'updateConfig',
                title: '更新线配置',
                description: '更新标注线参数',
                params: [
                    { name: 'newConfig', title: '配置对象', type: 'object', required: true }
                ]
            }
        ],
        configSchema: [
            {
                key: 'color',
                label: '颜色',
                type: 'color',
                default: '#00ff00'
            },
            {
                key: 'lineWidth',
                label: '线宽',
                type: 'number',
                default: 2,
                min: 1,
                max: 10,
                step: 1
            }
        ]
    });

    // 注册 MarkPoint
    registerComponent('MarkPoint', MarkPoint, {
        displayName: '标注点',
        description: '在三维空间中显示点位标记',
        icon: '📍',
        category: 'markers',
        defaultConfig: {
            position: [0, 1, 0],
            color: '#ff0000',
            size: 0.5,
            label: '标注点'
        },
        methods: [
            {
                name: 'updateConfig',
                title: '更新点配置',
                description: '更新标注点参数',
                params: [
                    { name: 'newConfig', title: '配置对象', type: 'object', required: true }
                ]
            }
        ],
        configSchema: [
            {
                key: 'position',
                label: '位置',
                type: 'vector3',
                default: [0, 0, 0]
            },
            {
                key: 'color',
                label: '颜色',
                type: 'color',
                default: '#ff0000'
            },
            {
                key: 'size',
                label: '大小',
                type: 'number',
                default: 1,
                min: 0.1,
                max: 50,
                step: 0.1
            },
            {
                key: 'label',
                label: '标签',
                type: 'text',
                default: ''
            }
        ]
    });

    registerComponent('PointTypeMarkerManager', PointTypeMarkerManager, {
        displayName: '多类型点位管理',
        description: '支持多类型点位展示与管理，类型可绑定模型或静态图并使用实例化渲染',
        icon: '🧭',
        category: 'markers',
        defaultConfig: {
            maxPoints: 1000,
            imageSize: 1,
            imageTintEnabled: false,
            modelFitSize: 1,
            imageBillboard: true,
            enableInteraction: true,
            types: [
                {
                    id: 'default',
                    name: '默认类型',
                    resourceType: 'image',
                    resourceUrl: '',
                    color: '#07a6ff',
                    size: 2,
                    scale: 1,
                    offset: [0, 0, 0],
                    visible: true
                }
            ],
            points: [],
            dataSnapshot: null,
            dataMapping: {
                enabled: false,
                template: 'separate',
                paths: {
                    types: 'types',
                    points: 'points',
                    list: 'list',
                    groupedPoints: 'points'
                },
                typeFields: {
                    id: 'id',
                    name: 'name',
                    resourceType: 'resourceType',
                    resourceUrl: 'resourceUrl',
                    color: 'color',
                    size: 'size',
                    scale: 'scale',
                    offset: 'offset',
                    visible: 'visible'
                },
                pointFields: {
                    id: 'id',
                    name: 'name',
                    typeId: 'typeId',
                    position: 'position',
                    x: 'x',
                    y: 'y',
                    z: 'z',
                    scale: 'scale',
                    offset: 'offset',
                    color: 'color',
                    visible: 'visible',
                    data: 'data'
                }
            },
            stateStyles: {
                normal: {
                    color: null,
                    scaleMultiplier: 1,
                    opacity: 1,
                    offset: [0, 0, 0]
                },
                hover: {
                    color: '#1d4ed8',
                    scaleMultiplier: 1.1,
                    opacity: 1,
                    offset: [0, 0, 0]
                },
                click: {
                    color: '#ef4444',
                    scaleMultiplier: 1.2,
                    opacity: 1,
                    offset: [0, 0, 0]
                },
                highlight: {
                    color: '#facc15',
                    scaleMultiplier: 1.25,
                    opacity: 1,
                    offset: [0, 0, 0]
                }
            }
        },
        methods: PointTypeMarkerManager.methodDefinitions,
        configSchema: [
            {
                key: 'maxPoints',
                label: '最大点位数',
                type: 'number',
                default: 1000,
                min: 1,
                max: 100000,
                step: 1
            },
            {
                key: 'imageSize',
                label: '图片基础尺寸',
                type: 'number',
                default: 1,
                min: 0.01,
                max: 100,
                step: 0.01
            },
            {
                key: 'imageTintEnabled',
                label: '图片启用颜色着色',
                type: 'boolean',
                default: false
            },
            {
                key: 'modelFitSize',
                label: '模型拟合尺寸',
                type: 'number',
                default: 1,
                min: 0.01,
                max: 100,
                step: 0.01
            },
            {
                key: 'imageBillboard',
                label: '图片始终朝向相机',
                type: 'boolean',
                default: true
            },
            {
                key: 'enableInteraction',
                label: '启用鼠标交互',
                type: 'boolean',
                default: true
            },
            {
                key: 'types',
                label: '类型配置 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '类型数组，支持 image/model、颜色、缩放、偏移等配置'
            },
            {
                key: 'points',
                label: '点位数据 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '点位数组，支持 typeId、position、data 与点位级覆盖字段'
            },
            {
                key: 'dataSnapshot',
                label: '映射数据快照 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '由数据绑定写入的原始数据，结合 dataMapping 自动映射到 types/points'
            },
            {
                key: 'dataMapping',
                label: '数据映射配置 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '配置 separate/list/grouped 模板、路径与字段映射规则'
            },
            {
                key: 'stateStyles',
                label: '状态样式 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '支持 normal/hover/click/highlight 状态样式'
            }
        ]
    });

    registerComponent('CameraPointManager', CameraPointManager, {
        displayName: '摄像头点位',
        description: '管理摄像头点位，支持图片、模型、标签展示与视频信息',
        icon: '📷',
        category: 'markers',
        defaultConfig: {
            enableInteraction: true,
            imageSize: 1,
            modelFitSize: 1,
            labelScale: 0.012,
            types: [],
            typeStyles: {},
            eventConfig: {
                click: { enabled: true, action: 'openVideo' },
                dblclick: { enabled: false, action: 'openVideo' }
            },
            videoModalStyle: {
                preset: 'dark',
                placement: 'center',
                left: 120,
                top: 120,
                width: 920,
                height: 0
            },
            points: []
        },
        methods: CameraPointManager.methodDefinitions,
        configSchema: [
            {
                key: 'enableInteraction',
                label: '启用鼠标交互',
                type: 'boolean',
                default: true
            },
            {
                key: 'imageSize',
                label: '默认图片尺寸',
                type: 'number',
                default: 1,
                min: 0.01,
                max: 100,
                step: 0.01
            },
            {
                key: 'modelFitSize',
                label: '默认模型拟合尺寸',
                type: 'number',
                default: 1,
                min: 0.01,
                max: 100,
                step: 0.01
            },
            {
                key: 'labelScale',
                label: '标签缩放系数',
                type: 'number',
                default: 0.012,
                min: 0.001,
                max: 1,
                step: 0.001
            },
            {
                key: 'types',
                label: '外部类型样式数组 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '按 type/id 配置图片、模型、标签、颜色等样式，点位编辑器只保存 type'
            },
            {
                key: 'typeStyles',
                label: '外部类型样式映射 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '以 type 为 key 的样式映射，优先用于摄像头点位渲染'
            },
            {
                key: 'eventConfig',
                label: '事件配置 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '配置 click/dblclick 是否触发视频弹窗'
            },
            {
                key: 'videoModalStyle',
                label: '视频弹窗样式 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '支持 preset、placement(center/cursor/fixed)、left/top、width/height'
            },
            {
                key: 'points',
                label: '摄像头点位数据 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '建议通过“摄像头点位管理”面板维护'
            }
        ]
    });

    // 注册 ExplodedView
    registerComponent('ExplodedView', ExplodedView, {
        displayName: '楼层爆炸图',
        description: '楼层爆炸视图效果，支持楼层选中、高亮、动画等功能',
        icon: '🏗️',
        category: 'effects',
        defaultConfig: {
            floorMap: {},
            floorOrder: [],
            gap: 5,
            animate: true,
            time: 2,
            start: 1,
            offset: { x: 0, y: 1, z: 0 },
            direction: 'up',
            delayStep: 100,
            easingPreset: 'quadratic-out',
            highlightColor: 0x07a6ff,
            highlightIntensity: 1.5,
            selectedLoaderId: null
        },
        methods: [
            { name: 'start', title: '开始爆炸', description: '执行楼层爆炸动画' },
            { name: 'reset', title: '恢复原位', description: '恢复楼层到初始位置' },
            {
                name: 'selectFloor',
                title: '选择楼层',
                description: '选择指定楼层并高亮',
                params: [
                    { name: 'floorIndex', title: '楼层索引', type: 'number', required: true }
                ]
            },
            { name: 'deselectFloor', title: '取消楼层选择', description: '取消当前楼层高亮' },
            {
                name: 'setFloorVisible',
                title: '设置楼层显隐',
                description: '控制指定楼层是否显示',
                params: [
                    { name: 'floorIndex', title: '楼层索引', type: 'number', required: true },
                    { name: 'visible', title: '是否显示', type: 'boolean', required: true }
                ]
            },
            {
                name: 'setFloorOffset',
                title: '设置楼层偏移',
                description: '设置指定楼层偏移向量',
                params: [
                    { name: 'floorIndex', title: '楼层索引', type: 'number', required: true },
                    { name: 'offset', title: '偏移向量', type: 'object', required: true }
                ]
            },
            { name: 'getFloorIndices', title: '获取楼层索引', description: '返回当前可用楼层索引列表' }
        ],
        events: ['start', 'reset', 'selectFloor', 'deselectFloor', 'highlightFloor', 'unhighlightFloor'],
        configSchema: [
            {
                key: 'floorMap',
                label: '楼层配置',
                type: 'text',
                default: '{}',
                hidden: true,
                readonly: true
            },
            {
                key: 'floorOrder',
                label: '楼层顺序',
                type: 'text',
                default: '[]',
                hidden: true,
                readonly: true
            },
            {
                key: 'gap',
                label: '楼层间隔',
                type: 'number',
                default: 5,
                min: 0.1,
                max: 200,
                step: 0.5
            },
            {
                key: 'animate',
                label: '开启动画',
                type: 'boolean',
                default: true
            },
            {
                key: 'time',
                label: '动画时长(秒)',
                type: 'number',
                default: 2,
                min: 0.1,
                max: 10,
                step: 0.1
            },
            {
                key: 'easingPreset',
                label: '缓动曲线',
                type: 'select',
                default: 'quadratic-out',
                description: '动画缓动曲线类型，影响爆炸/复位的加速感',
                options: [
                    { label: '线性（匀速）', value: 'linear' },
                    { label: '二次方 - 渐入', value: 'quadratic-in' },
                    { label: '二次方 - 渐出（默认）', value: 'quadratic-out' },
                    { label: '二次方 - 渐入渐出', value: 'quadratic-inout' },
                    { label: '三次方 - 渐出（更强）', value: 'cubic-out' },
                    { label: '三次方 - 渐入渐出', value: 'cubic-inout' },
                    { label: '弹性 - 渐出', value: 'elastic-out' },
                    { label: '弹跳 - 渐出', value: 'bounce-out' },
                    { label: '回弹 - 渐出（轻微超出）', value: 'back-out' }
                ]
            },
            {
                key: 'start',
                label: '基准层索引',
                type: 'number',
                default: 1,
                min: 0,
                step: 1,
                description: '以哪一层为基准（该层不移动，其余层相对它偏移）'
            },
            {
                key: 'direction',
                label: '爆炸方向',
                type: 'select',
                default: 'up',
                description: '选择预设轴向，或选"自定义"后手动填写 offset 向量',
                options: [
                    { label: '向上 (Y+)', value: 'up' },
                    { label: '向下 (Y−)', value: 'down' },
                    { label: '向左 (X−)', value: 'left' },
                    { label: '向右 (X+)', value: 'right' },
                    { label: '向前 (Z+)', value: 'forward' },
                    { label: '向后 (Z−)', value: 'back' },
                    { label: '自定义向量', value: 'custom' }
                ]
            },
            {
                key: 'offset.x',
                label: '自定义方向 X',
                type: 'number',
                default: 0,
                step: 0.1,
                description: '当爆炸方向为"自定义向量"时生效'
            },
            {
                key: 'offset.y',
                label: '自定义方向 Y',
                type: 'number',
                default: 1,
                step: 0.1,
                description: '当爆炸方向为"自定义向量"时生效'
            },
            {
                key: 'offset.z',
                label: '自定义方向 Z',
                type: 'number',
                default: 0,
                step: 0.1,
                description: '当爆炸方向为"自定义向量"时生效'
            },
            {
                key: 'delayStep',
                label: '延迟步长(ms)',
                type: 'number',
                default: 100,
                min: 0,
                max: 1000,
                step: 10,
                description: '每层动画之间的延迟间隔，设为 0 则所有层同时爆炸'
            },
            {
                key: 'highlightColor',
                label: '高亮颜色',
                type: 'color',
                default: '#07A6FF'
            },
            {
                key: 'highlightIntensity',
                label: '高亮强度',
                type: 'number',
                default: 1.5,
                min: 0,
                max: 5,
                step: 0.1
            }
        ]
    });

    // 注册 TrafficRoadsideDeviceManager
    registerComponent('DeviceExplodedView', DeviceExplodedView, {
        displayName: '设备爆炸图',
        description: '按设备树结构从中心点向外爆炸，距离中心越远偏移越大',
        icon: '⚙️',
        category: 'effects',
        defaultConfig: {
            selectedLoaderId: '',
            selectionMode: 'level',
            explodeLevel: 1,
            selectedNodeKeys: [],
            originMode: 'sceneOrigin',
            origin: [0, 0, 0],
            baseOffset: 0,
            distanceFactor: 0.18,
            distanceExponent: 1,
            maxOffset: 30,
            axisMask: {
                x: true,
                y: true,
                z: true
            },
            animate: true,
            time: 1.2,
            delayStep: 0,
            delayMode: 'byDistance',
            easingPreset: 'quadratic-out'
        },
        methods: [
            { name: 'start', title: '开始爆炸', description: '执行设备爆炸动画' },
            { name: 'reset', title: '恢复原位', description: '恢复设备节点到初始位置' },
            { name: 'getNodeSummary', title: '获取节点摘要', description: '获取当前节点数量及状态信息' }
        ],
        events: ['start', 'reset'],
        configSchema: [
            {
                key: 'selectedLoaderId',
                label: '关联模型',
                type: 'text',
                default: '',
                hidden: true,
                readonly: true
            },
            {
                key: 'selectedNodeKeys',
                label: '节点选择',
                type: 'text',
                default: '[]',
                hidden: true,
                readonly: true
            },
            {
                key: 'selectionMode',
                label: '选择模式',
                type: 'select',
                default: 'level',
                options: [
                    { label: '按层级', value: 'level' },
                    { label: '叶子节点', value: 'leaf' },
                    { label: '自定义', value: 'custom' }
                ]
            },
            {
                key: 'explodeLevel',
                label: '爆炸层级',
                type: 'number',
                default: 1,
                min: 1,
                max: 12,
                step: 1
            },
            {
                key: 'originMode',
                label: '中心点模式',
                type: 'select',
                default: 'sceneOrigin',
                options: [
                    { label: '场景原点', value: 'sceneOrigin' },
                    { label: '模型中心', value: 'modelCenter' },
                    { label: '自定义点', value: 'custom' }
                ]
            },
            {
                key: 'origin',
                label: '中心点',
                type: 'vector3',
                default: [0, 0, 0]
            },
            {
                key: 'baseOffset',
                label: '基础偏移',
                type: 'number',
                default: 0,
                min: 0,
                max: 100,
                step: 0.1
            },
            {
                key: 'distanceFactor',
                label: '距离系数',
                type: 'number',
                default: 0.18,
                min: 0,
                max: 10,
                step: 0.01
            },
            {
                key: 'distanceExponent',
                label: '距离指数',
                type: 'number',
                default: 1,
                min: 0.1,
                max: 4,
                step: 0.1
            },
            {
                key: 'maxOffset',
                label: '最大偏移',
                type: 'number',
                default: 30,
                min: 0,
                max: 500,
                step: 0.5
            },
            {
                key: 'axisMask.x',
                label: '允许 X 轴',
                type: 'boolean',
                default: true
            },
            {
                key: 'axisMask.y',
                label: '允许 Y 轴',
                type: 'boolean',
                default: true
            },
            {
                key: 'axisMask.z',
                label: '允许 Z 轴',
                type: 'boolean',
                default: true
            },
            {
                key: 'animate',
                label: '启用动画',
                type: 'boolean',
                default: true
            },
            {
                key: 'time',
                label: '动画时长(秒)',
                type: 'number',
                default: 1.2,
                min: 0.1,
                max: 10,
                step: 0.1
            },
            {
                key: 'delayMode',
                label: '延迟模式',
                type: 'select',
                default: 'byDistance',
                options: [
                    { label: '无延迟', value: 'none' },
                    { label: '按距离', value: 'byDistance' },
                    { label: '按层级', value: 'byDepth' }
                ]
            },
            {
                key: 'delayStep',
                label: '延迟步长(ms)',
                type: 'number',
                default: 0,
                min: 0,
                max: 1000,
                step: 10
            },
            {
                key: 'easingPreset',
                label: '缓动曲线',
                type: 'select',
                default: 'quadratic-out',
                options: [
                    { label: '线性', value: 'linear' },
                    { label: '二次缓入', value: 'quadratic-in' },
                    { label: '二次缓出', value: 'quadratic-out' },
                    { label: '二次缓入缓出', value: 'quadratic-inout' },
                    { label: '三次缓出', value: 'cubic-out' },
                    { label: '三次缓入缓出', value: 'cubic-inout' },
                    { label: '弹性缓出', value: 'elastic-out' },
                    { label: '弹跳缓出', value: 'bounce-out' },
                    { label: '回弹缓出', value: 'back-out' }
                ]
            }
        ]
    });

    registerComponent('PostProcessing', PostProcessing, {
        displayName: '后期处理',
        description: '统一管理 Bloom、SSR、GTAO、SAO、SSAO、Pixel、DOF、Sobel、FXAA 等后期效果',
        icon: '✨',
        category: 'effects',
        defaultConfig: {
            enabled: true,
            pipeline: ['render', 'gtao', 'ssao', 'sao', 'ssr', 'bloom', 'dof', 'sobel', 'pixel', 'fxaa', 'output'],
            sobel: {
                enabled: false
            },
            ssr: {
                enabled: false,
                resolutionScale: 0.5,
                thickness: 0.018,
                infiniteThick: false,
                fresnel: true,
                distanceAttenuation: true,
                maxDistance: 0.1,
                bouncing: false,
                output: 0,
                opacity: 1,
                blur: true,
                groundReflector: null,
                selects: null
            },
            bloom: {
                enabled: false,
                threshold: 0,
                strength: 1,
                radius: 0,
                exposure: 1
            },
            gtao: {
                enabled: false,
                radius: 0.5,
                distanceExponent: 2,
                thickness: 10,
                scale: 1,
                samples: 16,
                distanceFallOff: 1,
                output: 0
            },
            sao: {
                enabled: false,
                output: 0,
                saoBias: 0.5,
                saoIntensity: 0.18,
                saoScale: 1,
                saoKernelRadius: 100,
                saoMinResolution: 0,
                saoBlur: true,
                saoBlurRadius: 8,
                saoBlurStdDev: 4,
                saoBlurDepthCutoff: 0.01
            },
            ssao: {
                enabled: false,
                kernelRadius: 8,
                minDistance: 0.005,
                maxDistance: 0.1,
                output: 0
            },
            dof: {
                enabled: false,
                focus: 1,
                aperture: 0.025,
                maxblur: 0.01
            },
            pixel: {
                enabled: false,
                pixelSize: 6
            },
            fxaa: {
                enabled: false
            }
        },
        methods: [
            { name: 'enable', title: '启用后期', description: '启用后期处理' },
            { name: 'disable', title: '禁用后期', description: '禁用后期处理' },
            { name: 'toggleEnabled', title: '切换后期开关', description: '切换后期处理开关' },
            { name: 'setEnabled', title: '设置后期开关', description: '设置后期处理启用状态' },
            { name: 'toggleBloom', title: 'Bloom 开关', description: '切换 Bloom 效果' },
            { name: 'toggleSSR', title: 'SSR 开关', description: '切换 SSR 效果' },
            { name: 'toggleGTAO', title: 'GTAO 开关', description: '切换 GTAO 效果' },
            { name: 'toggleSAO', title: 'SAO 开关', description: '切换 SAO 效果' },
            { name: 'toggleSSAO', title: 'SSAO 开关', description: '切换 SSAO 效果' },
            { name: 'toggleDOF', title: '景深开关', description: '切换景深效果' },
            { name: 'toggleSobel', title: '描边开关', description: '切换 Sobel 描边效果' },
            { name: 'togglePixel', title: '像素化开关', description: '切换像素化效果' },
            { name: 'toggleFXAA', title: 'FXAA 开关', description: '切换 FXAA 抗锯齿效果' }
        ],
        events: [
            'enable',
            'disable',
            'toggleEnabled',
            'setEnabled',
            'toggleBloom',
            'toggleSSR',
            'toggleGTAO',
            'toggleSAO',
            'toggleSSAO',
            'toggleDOF',
            'toggleSobel',
            'togglePixel',
            'toggleFXAA'
        ],
        configSchema: [
            {
                key: 'pipeline',
                label: '后期链路',
                type: 'text',
                default: '[]',
                hidden: true,
                readonly: true
            },
            {
                key: 'enabled',
                label: '启用后期处理',
                type: 'boolean',
                default: true
            },
            {
                key: 'gtao.enabled',
                label: '启用 GTAO',
                type: 'boolean',
                default: false
            },
            {
                key: 'gtao.radius',
                label: 'GTAO 半径',
                type: 'number',
                default: 0.5,
                min: 0,
                max: 5,
                step: 0.05
            },
            {
                key: 'gtao.distanceExponent',
                label: 'GTAO 距离指数',
                type: 'number',
                default: 2,
                min: 0.1,
                max: 8,
                step: 0.1
            },
            {
                key: 'gtao.thickness',
                label: 'GTAO 厚度',
                type: 'number',
                default: 10,
                min: 0,
                max: 50,
                step: 0.5
            },
            {
                key: 'gtao.scale',
                label: 'GTAO 强度',
                type: 'number',
                default: 1,
                min: 0,
                max: 5,
                step: 0.1
            },
            {
                key: 'gtao.samples',
                label: 'GTAO 采样数',
                type: 'number',
                default: 16,
                min: 1,
                max: 64,
                step: 1
            },
            {
                key: 'gtao.distanceFallOff',
                label: 'GTAO 衰减',
                type: 'number',
                default: 1,
                min: 0,
                max: 5,
                step: 0.1
            },
            {
                key: 'gtao.output',
                label: 'GTAO 输出',
                type: 'select',
                default: 0,
                options: [
                    { label: '材质 AO', value: 0 },
                    { label: '混合 AO', value: 1 },
                    { label: '仅漫反射', value: 2 },
                    { label: '仅 AO', value: 3 }
                ]
            },
            {
                key: 'ssao.enabled',
                label: '启用 SSAO',
                type: 'boolean',
                default: false
            },
            {
                key: 'ssao.kernelRadius',
                label: 'SSAO 半径',
                type: 'number',
                default: 8,
                min: 1,
                max: 32,
                step: 1
            },
            {
                key: 'ssao.minDistance',
                label: 'SSAO 最小距离',
                type: 'number',
                default: 0.005,
                min: 0,
                max: 1,
                step: 0.001
            },
            {
                key: 'ssao.maxDistance',
                label: 'SSAO 最大距离',
                type: 'number',
                default: 0.1,
                min: 0,
                max: 5,
                step: 0.01
            },
            {
                key: 'ssao.output',
                label: 'SSAO 输出',
                type: 'select',
                default: 0,
                options: [
                    { label: '默认', value: 0 },
                    { label: '仅 SSAO', value: 1 },
                    { label: '仅模糊', value: 2 },
                    { label: '深度', value: 3 },
                    { label: '法线', value: 4 }
                ]
            },
            {
                key: 'sao.enabled',
                label: '启用 SAO',
                type: 'boolean',
                default: false
            },
            {
                key: 'sao.output',
                label: 'SAO 输出',
                type: 'select',
                default: 0,
                options: [
                    { label: '默认', value: 0 },
                    { label: '仅 SAO', value: 1 },
                    { label: '法线', value: 2 }
                ]
            },
            {
                key: 'sao.saoBias',
                label: 'SAO 偏移',
                type: 'number',
                default: 0.5,
                min: 0,
                max: 5,
                step: 0.01
            },
            {
                key: 'sao.saoIntensity',
                label: 'SAO 强度',
                type: 'number',
                default: 0.18,
                min: 0,
                max: 2,
                step: 0.01
            },
            {
                key: 'sao.saoScale',
                label: 'SAO 缩放',
                type: 'number',
                default: 1,
                min: 0,
                max: 5,
                step: 0.1
            },
            {
                key: 'sao.saoKernelRadius',
                label: 'SAO 半径',
                type: 'number',
                default: 100,
                min: 1,
                max: 256,
                step: 1
            },
            {
                key: 'sao.saoMinResolution',
                label: 'SAO 最小分辨率',
                type: 'number',
                default: 0,
                min: 0,
                max: 1,
                step: 0.001
            },
            {
                key: 'sao.saoBlur',
                label: 'SAO 模糊',
                type: 'boolean',
                default: true
            },
            {
                key: 'sao.saoBlurRadius',
                label: 'SAO 模糊半径',
                type: 'number',
                default: 8,
                min: 0,
                max: 32,
                step: 1
            },
            {
                key: 'sao.saoBlurStdDev',
                label: 'SAO 模糊标准差',
                type: 'number',
                default: 4,
                min: 0,
                max: 32,
                step: 0.1
            },
            {
                key: 'sao.saoBlurDepthCutoff',
                label: 'SAO 深度裁切',
                type: 'number',
                default: 0.01,
                min: 0,
                max: 1,
                step: 0.001
            },
            {
                key: 'ssr.enabled',
                label: '启用 SSR',
                type: 'boolean',
                default: false
            },
            {
                key: 'ssr.resolutionScale',
                label: 'SSR 分辨率缩放',
                type: 'number',
                default: 0.5,
                min: 0.1,
                max: 1,
                step: 0.05
            },
            {
                key: 'ssr.thickness',
                label: 'SSR 厚度',
                type: 'number',
                default: 0.018,
                min: 0,
                max: 1,
                step: 0.001
            },
            {
                key: 'ssr.infiniteThick',
                label: 'SSR 无限厚度',
                type: 'boolean',
                default: false
            },
            {
                key: 'ssr.fresnel',
                label: 'SSR 菲涅尔',
                type: 'boolean',
                default: true
            },
            {
                key: 'ssr.distanceAttenuation',
                label: 'SSR 距离衰减',
                type: 'boolean',
                default: true
            },
            {
                key: 'ssr.maxDistance',
                label: 'SSR 最大距离',
                type: 'number',
                default: 0.1,
                min: 0,
                max: 5,
                step: 0.01
            },
            {
                key: 'ssr.bouncing',
                label: 'SSR 多次反射',
                type: 'boolean',
                default: false
            },
            {
                key: 'ssr.output',
                label: 'SSR 输出',
                type: 'select',
                default: 0,
                options: [
                    { label: '默认', value: 0 },
                    { label: '仅 SSR', value: 1 },
                    { label: 'Beauty', value: 3 },
                    { label: 'Depth', value: 4 },
                    { label: 'Normal', value: 5 },
                    { label: 'Metalness', value: 7 }
                ]
            },
            {
                key: 'ssr.opacity',
                label: 'SSR 不透明度',
                type: 'number',
                default: 1,
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                key: 'ssr.blur',
                label: 'SSR 模糊',
                type: 'boolean',
                default: true
            },
            {
                key: 'bloom.enabled',
                label: '启用 Bloom',
                type: 'boolean',
                default: false
            },
            {
                key: 'bloom.threshold',
                label: 'Bloom 阈值',
                type: 'number',
                default: 0,
                min: 0,
                max: 2,
                step: 0.01
            },
            {
                key: 'bloom.strength',
                label: 'Bloom 强度',
                type: 'number',
                default: 1,
                min: 0,
                max: 10,
                step: 0.1
            },
            {
                key: 'bloom.radius',
                label: 'Bloom 半径',
                type: 'number',
                default: 0,
                min: 0,
                max: 2,
                step: 0.01
            },
            {
                key: 'bloom.exposure',
                label: 'Bloom 曝光',
                type: 'number',
                default: 1,
                min: 0,
                max: 3,
                step: 0.05
            },
            {
                key: 'dof.enabled',
                label: '启用 DOF',
                type: 'boolean',
                default: false
            },
            {
                key: 'dof.focus',
                label: 'DOF 焦点距离',
                type: 'number',
                default: 1,
                min: 0,
                max: 5000,
                step: 0.1
            },
            {
                key: 'dof.aperture',
                label: 'DOF 光圈',
                type: 'number',
                default: 0.025,
                min: 0,
                max: 0.2,
                step: 0.001
            },
            {
                key: 'dof.maxblur',
                label: 'DOF 最大模糊',
                type: 'number',
                default: 0.01,
                min: 0,
                max: 0.1,
                step: 0.001
            },
            {
                key: 'sobel.enabled',
                label: '启用 Sobel',
                type: 'boolean',
                default: false
            },
            {
                key: 'pixel.enabled',
                label: '启用像素化',
                type: 'boolean',
                default: false
            },
            {
                key: 'pixel.pixelSize',
                label: '像素尺寸',
                type: 'number',
                default: 6,
                min: 1,
                max: 64,
                step: 1
            },
            {
                key: 'fxaa.enabled',
                label: '启用 FXAA',
                type: 'boolean',
                default: false
            }
        ]
    });

    registerComponent('TrafficRoadsideDeviceManager', TrafficRoadsideDeviceManager, {
        displayName: '路侧设备管理',
        description: '路网及道路设施与挂载设备管理（支持资源URL、拾取与拖拽）',
        icon: '🚦',
        category: 'traffic',
        defaultConfig: {
            coordinateSystem: {
                mode: 'xyz',
                originLngLatAlt: [0, 0, 0],
                axis: 'xEast_yUp_zNorth',
                fitting: {
                    method: 'none',
                    controlPoints: []
                }
            },
            devices: [],
            dracoDecoderPath: '/draco/',
            imageSize: 2,
            modelFitBoxSize: 5
        },
        methods: [
            {
                name: 'updateData',
                title: '更新设备数据',
                description: '批量更新设备列表；当传入 [{id/name,x,y,z}] 时按已有设备 ID 或名称更新位置',
                params: [
                    { name: 'data', title: '设备数组', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            },
            {
                name: 'updateDevicePositions',
                title: '更新设备位置',
                description: '按设备 ID 或名称批量更新位置，数据格式 [{ id, name, x, y, z }]',
                params: [
                    { name: 'data', title: '位置数组', type: 'array', required: true }
                ]
            },
            {
                name: 'getDeviceObject',
                title: '获取设备对象',
                description: '按设备ID获取三维对象',
                params: [
                    { name: 'deviceId', title: '设备ID', type: 'string', required: true }
                ]
            }
        ],
        configSchema: [
            {
                key: 'coordinateSystem.mode',
                label: '坐标模式',
                type: 'select',
                default: 'xyz',
                options: [
                    { label: '三维坐标 (XYZ)', value: 'xyz' },
                    { label: '经纬度备注 (Geo)→最终保存XYZ', value: 'geo' }
                ]
            },
            {
                key: 'coordinateSystem.originLngLatAlt',
                label: 'ENU 原点 (lng/lat/alt)',
                type: 'vector3',
                default: [0, 0, 0]
            },
            {
                key: 'dracoDecoderPath',
                label: 'Draco 解码器路径',
                type: 'text',
                default: '/draco/',
                placeholder: '/draco/'
            },
            {
                key: 'imageSize',
                label: '图片尺寸',
                type: 'number',
                default: 2,
                min: 0.1,
                max: 100,
                step: 0.1
            },
            {
                key: 'modelFitBoxSize',
                label: '模型自适应盒子大小',
                type: 'number',
                default: 5,
                min: 0.1,
                max: 1000,
                step: 0.1,
                description: '将加载的模型整体缩放进该大小的立方体内（世界单位）'
            }
        ]
    });

    // 注册 BuildingEditor（点位管理器）
    registerComponent('BuildingEditor', BuildingEditor, {
        displayName: '点位管理器',
        description: '管理三维空间点位，支持手动添加、拾取添加、批量删除与坐标编辑',
        icon: '📍',
        category: 'markers',
        defaultConfig: {
            points: [],
            pointSize: 1,
            highlightColor: 0xffff00,
            enableRightClick: false,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1
        },
        configSchema: [
            {
                key: 'points',
                label: '点位数据 (JSON)',
                type: 'json',
                editor: 'manager',
                hiddenInBasicPanel: true,
                advancedRaw: true,
                description: '支持 [{id,name,position:[x,y,z]}] 或 [{id,name,position:{x,y,z}}]'
            },
            {
                key: 'pointSize',
                label: '点位尺寸',
                type: 'number',
                default: 1,
                min: 0.1,
                max: 50,
                step: 0.1
            },
            {
                key: 'highlightColor',
                label: '高亮颜色',
                type: 'color',
                default: '#ffff00'
            },
            {
                key: 'enableRightClick',
                label: '启用右键添加事件',
                type: 'boolean',
                default: false
            }
        ],
        methods: [
            {
                name: 'addPoint',
                title: '添加点位',
                description: '新增一个点位',
                params: [
                    { name: 'pointData', title: '点位数据', type: 'object', required: true },
                    { name: 'triggerEvent', title: '触发事件', type: 'boolean', required: false }
                ]
            },
            {
                name: 'updatePoint',
                title: '更新点位',
                description: '按点位ID更新点位',
                params: [
                    { name: 'id', title: '点位ID', type: 'string', required: true },
                    { name: 'updates', title: '更新数据', type: 'object', required: true }
                ]
            },
            {
                name: 'removePoint',
                title: '删除点位',
                description: '按点位ID删除点位',
                params: [
                    { name: 'id', title: '点位ID', type: 'string', required: true },
                    { name: 'triggerEvent', title: '触发事件', type: 'boolean', required: false }
                ]
            },
            { name: 'getAllPoints', title: '获取全部点位', description: '返回全部点位数据' },
            { name: 'clearPoints', title: '清空点位', description: '删除全部点位' },
            {
                name: 'updateData',
                title: '更新点位数据',
                description: '批量更新点位数据',
                params: [
                    { name: 'data', title: '点位数组', type: 'array', required: true },
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            }
        ],
        events: [
            'addPoint',
            'updatePoint',
            'removePoint',
            'getAllPoints',
            'clearPoints'
        ]
    });

    // 注册 WeatherClouds（天气云层）
    registerComponent('WeatherClouds', WeatherClouds, {
        displayName: '天气云层',
        description: '基于程序噪声的动态天空云层，内置后期体积云和多层网格云层两种模式',
        icon: '☁️',
        category: 'effects',
        defaultConfig: {
            name: 'weather-clouds',
            enabled: true,
            preset: 'cloudy',
            renderMode: 'mesh',
            followCamera: false,
            followCameraY: false,
            height: 120,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1,
            radius: 480,
            thickness: 60,
            layerCount: 8,
            segments: 96,
            coverage: 0.58,
            opacity: 0.82,
            density: 1.0,
            softness: 0.22,
            noiseScale: 155,
            horizonFade: 0.2,
            evolutionSpeed: 0.04,
            shapeContrast: 1.05,
            lightIntensity: 1.0,
            cloudColor: '#f2f6fb',
            shadowColor: '#8795aa',
            sunColor: '#fff2ce',
            sunDirection: [0.35, 0.76, 0.25],
            wind: {
                direction: [1, 0.2],
                speed: 0.052
            },
            postProcessing: {
                enabled: false,
                maxDistance: 3000,
                steps: 18
            }
        },
        methods: [
            { name: 'setPreset', title: '设置云层预设', description: '设置 clear/scattered/cloudy/overcast/storm 云层预设' },
            { name: 'setCoverage', title: '设置云量', description: '设置云层覆盖率 0-1' },
            { name: 'setWindSpeed', title: '设置风速', description: '设置云层流动速度' },
            { name: 'setSunDirection', title: '设置太阳方向', description: '设置云层高光方向' },
            { name: 'enable', title: '启用云层', description: '显示并更新云层效果' },
            { name: 'disable', title: '禁用云层', description: '隐藏云层效果' },
            { name: 'getCloudInfo', title: '获取云层信息', description: '返回当前云层运行状态' }
        ],
        configSchema: [
            {
                key: 'enabled',
                label: '启用云层',
                type: 'boolean',
                default: true
            },
            {
                key: 'preset',
                label: '云层预设',
                type: 'select',
                default: 'cloudy',
                options: [
                    { label: '晴朗', value: 'clear' },
                    { label: '少云', value: 'scattered' },
                    { label: '多云', value: 'cloudy' },
                    { label: '阴天', value: 'overcast' },
                    { label: '暴风云', value: 'storm' }
                ]
            },
            {
                key: 'renderMode',
                label: '渲染模式',
                type: 'select',
                default: 'mesh',
                options: [
                    { label: '网格云层', value: 'mesh' },
                    { label: '后期体积云', value: 'postprocess' }
                ],
                description: '默认使用网格云层；打开“启用后期体积云”后，会由组件内部后期 pass 渲染'
            },
            {
                key: 'postProcessing.enabled',
                label: '启用后期体积云',
                type: 'boolean',
                default: false,
                description: '默认关闭。开启后体积云效果由本组件内部后期 pass 渲染，不再依赖后期处理组件'
            },
            {
                key: 'followCamera',
                label: '跟随相机',
                type: 'boolean',
                default: false,
                description: '开启后云层水平位置随相机移动，适合大场景天空效果'
            },
            {
                key: 'followCameraY',
                label: '跟随相机高度',
                type: 'boolean',
                default: false,
                description: '默认关闭，避免云层底边被带到相机高度'
            },
            {
                key: 'height',
                label: '云层高度(Y)',
                type: 'number',
                default: 120,
                min: -10000,
                max: 10000,
                step: 1,
                description: '云层底部所在的场景 Y 高度'
            },
            {
                key: 'position',
                label: '位置偏移',
                type: 'vector3',
                default: [0, 0, 0],
                description: 'X/Z 控制水平偏移，Y 会叠加到云层高度'
            },
            {
                key: 'rotation',
                label: '角度校正',
                type: 'vector3',
                default: [0, 0, 0],
                description: '用于微调云层平面与场景地面的夹角'
            },
            {
                key: 'radius',
                label: '云层半径',
                type: 'number',
                default: 480,
                min: 50,
                max: 5000,
                step: 10
            },
            {
                key: 'thickness',
                label: '云层厚度',
                type: 'number',
                default: 60,
                min: 0,
                max: 1000,
                step: 5
            },
            {
                key: 'layerCount',
                label: '体积切片层数',
                type: 'number',
                default: 8,
                min: 1,
                max: 8,
                step: 1
            },
            {
                key: 'segments',
                label: '云层细分',
                type: 'number',
                default: 96,
                min: 16,
                max: 192,
                step: 8
            },
            {
                key: 'coverage',
                label: '云量覆盖',
                type: 'number',
                default: 0.58,
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                key: 'opacity',
                label: '云层透明度',
                type: 'number',
                default: 0.72,
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                key: 'density',
                label: '云体密度',
                type: 'number',
                default: 1,
                min: 0,
                max: 3,
                step: 0.05
            },
            {
                key: 'softness',
                label: '边缘柔和',
                type: 'number',
                default: 0.22,
                min: 0.01,
                max: 0.8,
                step: 0.01
            },
            {
                key: 'noiseScale',
                label: '云团尺度',
                type: 'number',
                default: 155,
                min: 20,
                max: 800,
                step: 5
            },
            {
                key: 'horizonFade',
                label: '地平线淡出',
                type: 'number',
                default: 0.2,
                min: 0.03,
                max: 0.95,
                step: 0.01
            },
            {
                key: 'evolutionSpeed',
                label: '形态演化速度',
                type: 'number',
                default: 0.04,
                min: 0,
                max: 1,
                step: 0.005
            },
            {
                key: 'shapeContrast',
                label: '云体起伏',
                type: 'number',
                default: 1.05,
                min: 0.2,
                max: 3,
                step: 0.05
            },
            {
                key: 'lightIntensity',
                label: '体积受光强度',
                type: 'number',
                default: 1,
                min: 0,
                max: 3,
                step: 0.05
            },
            {
                key: 'postProcessing.steps',
                label: '体积云采样步数',
                type: 'number',
                default: 18,
                min: 4,
                max: 32,
                step: 1
            },
            {
                key: 'postProcessing.maxDistance',
                label: '体积云最远距离',
                type: 'number',
                default: 3000,
                min: 1,
                max: 1000000,
                step: 50
            },
            {
                key: 'cloudColor',
                label: '云层亮部',
                type: 'color',
                default: '#f2f6fb'
            },
            {
                key: 'shadowColor',
                label: '云层暗部',
                type: 'color',
                default: '#8795aa'
            },
            {
                key: 'sunColor',
                label: '太阳高光',
                type: 'color',
                default: '#fff2ce'
            },
            {
                key: 'sunDirection',
                label: '太阳方向',
                type: 'vector3',
                default: [0.35, 0.76, 0.25]
            },
            {
                key: 'wind.direction',
                label: '风向',
                type: 'vector2',
                default: [1, 0.2],
                labels: ['X', 'Z'],
                step: 0.01
            },
            {
                key: 'wind.speed',
                label: '风速',
                type: 'number',
                default: 0.052,
                min: 0,
                max: 1,
                step: 0.001
            }
        ]
    });

    // 注册 WeatherLighting（区域气象与光照）
    registerComponent('WeatherLighting', WeatherLighting, {
        displayName: '气象与光照',
        description: '在线天气（≤30min）+ 手动天气切换 + 太阳位置光照 + 夜间路灯联动',
        icon: '🌦️',
        category: 'effects',
        defaultConfig: {
            name: 'weather-lighting',
            mode: 'manual',
            location: {
                lat: 29.0001,
                lon: 130.0001
            },
            provider: {
                url: '',
                updateIntervalMinutes: 30,
                timeoutMs: 8000
            },
            weather: {
                preset: 'clear',
                enabled: true
            },
            clouds: {
                enabled: true,
                autoByWeather: true,
                renderMode: 'mesh',
                radius: 480,
                thickness: 60,
                height: 120,
                layerCount: 8,
                evolutionSpeed: 0.04,
                shapeContrast: 1.05,
                lightIntensity: 1.0,
                followCamera: false,
                followCameraY: false,
                postProcessing: {
                    enabled: false,
                    maxDistance: 3000,
                    steps: 18
                }
            },
            lighting: {
                timeHour: new Date().getHours(),
                castShadow: true,
                shadowMapSize: 2048,
                autoApplyMeshShadows: true,
                shadowGround: {
                    enabled: true,
                    y: 0,
                    opacity: 0.25
                }
            },
            area: {
                enabled: true,
                followCamera: false,
                center: [0, 0, 0],
                size: [120, 60, 120]
            },
            roadsideLights: {
                enabled: true,
                streetLightType: 'streetLight',
                signalLightType: 'signalLight',
                streetLightIntensity: 2.0,
                signalLightIntensity: 1.2,
                distance: 35,
                decay: 2
            }
        },
        methods: [
            { name: 'setMode', title: '设置模式', description: '设置 manual/auto 模式' },
            { name: 'setWeatherPreset', title: '设置天气', description: '设置天气预设类型' },
            { name: 'setTimePreset', title: '设置时间预设', description: '设置 dawn/day/dusk/night 预设' },
            { name: 'setTimeHour', title: '设置小时', description: '设置手动时间小时数' },
            { name: 'refreshNow', title: '立即刷新', description: '立即刷新天气与光照状态' },
            { name: 'getShadowDebugInfo', title: '获取阴影信息', description: '获取阴影调试信息' },
            {
                name: 'computeShadowFit',
                title: '计算阴影包围',
                description: '计算并返回阴影相机包围建议',
                params: [
                    { name: 'options', title: '参数对象', type: 'object', required: false }
                ]
            }
        ],
        configSchema: [
            {
                key: 'mode',
                label: '模式',
                type: 'select',
                default: 'manual',
                options: [
                    { label: '手动', value: 'manual' },
                    { label: '自动（在线天气）', value: 'auto' }
                ]
            },
            {
                key: 'location.lat',
                label: '纬度 (lat)',
                type: 'text',
                default: '29.0001',
                placeholder: '29.0001'
            },
            {
                key: 'location.lon',
                label: '经度 (lon)',
                type: 'text',
                default: '130.0001',
                placeholder: '130.0001'
            },
            {
                key: 'provider.url',
                label: '天气 API URL',
                type: 'text',
                default: '',
                placeholder: ''
            },
            {
                key: 'provider.updateIntervalMinutes',
                label: '天气更新间隔(分钟)',
                type: 'number',
                default: 30,
                min: 1,
                max: 60,
                step: 1
            },
            {
                key: 'weather.enabled',
                label: '启用天气粒子效果',
                type: 'boolean',
                default: true
            },
            {
                key: 'weather.preset',
                label: '天气（手动）',
                type: 'select',
                default: 'clear',
                options: [
                    { label: '晴天', value: 'clear' },
                    { label: '小雨', value: 'rainLight' },
                    { label: '大雨', value: 'rainHeavy' },
                    { label: '雪', value: 'snow' },
                    { label: '雾（占位）', value: 'fog' },
                    { label: '多云（云层）', value: 'cloudy' }
                ]
            },
            {
                key: 'clouds.enabled',
                label: '启用云层联动',
                type: 'boolean',
                default: true
            },
            {
                key: 'clouds.autoByWeather',
                label: '按天气自动切换云层',
                type: 'boolean',
                default: true
            },
            {
                key: 'clouds.renderMode',
                label: '云层渲染模式',
                type: 'select',
                default: 'mesh',
                options: [
                    { label: '网格云层', value: 'mesh' },
                    { label: '后期体积云', value: 'postprocess' }
                ]
            },
            {
                key: 'clouds.postProcessing.enabled',
                label: '联动后期体积云',
                type: 'boolean',
                default: false
            },
            {
                key: 'clouds.followCamera',
                label: '云层跟随相机',
                type: 'boolean',
                default: false
            },
            {
                key: 'clouds.followCameraY',
                label: '云层跟随相机高度',
                type: 'boolean',
                default: false
            },
            {
                key: 'clouds.height',
                label: '云层高度(Y)',
                type: 'number',
                default: 120,
                min: -10000,
                max: 10000,
                step: 1
            },
            {
                key: 'clouds.radius',
                label: '云层半径',
                type: 'number',
                default: 480,
                min: 50,
                max: 5000,
                step: 10
            },
            {
                key: 'clouds.thickness',
                label: '云层厚度',
                type: 'number',
                default: 60,
                min: 0,
                max: 1000,
                step: 5
            },
            {
                key: 'clouds.layerCount',
                label: '云层体积切片',
                type: 'number',
                default: 8,
                min: 1,
                max: 8,
                step: 1
            },
            {
                key: 'clouds.evolutionSpeed',
                label: '云层形态演化',
                type: 'number',
                default: 0.04,
                min: 0,
                max: 1,
                step: 0.005
            },
            {
                key: 'clouds.shapeContrast',
                label: '云体起伏',
                type: 'number',
                default: 1.05,
                min: 0.2,
                max: 3,
                step: 0.05
            },
            {
                key: 'clouds.lightIntensity',
                label: '云体受光强度',
                type: 'number',
                default: 1,
                min: 0,
                max: 3,
                step: 0.05
            },
            {
                key: 'clouds.postProcessing.steps',
                label: '云层采样步数',
                type: 'number',
                default: 18,
                min: 4,
                max: 32,
                step: 1
            },
            {
                key: 'clouds.postProcessing.maxDistance',
                label: '云层最远距离',
                type: 'number',
                default: 3000,
                min: 1,
                max: 1000000,
                step: 50
            },
            {
                key: 'lighting.timeHour',
                label: '当前时段(小时)',
                type: 'number',
                default: new Date().getHours(),
                min: 0,
                max: 23,
                step: 1,
                description: '0-23。夜间(20-5)自动关闭太阳光与阴影'
            },
            {
                key: 'lighting.castShadow',
                label: '太阳投射阴影',
                type: 'boolean',
                default: true
            },
            {
                key: 'lighting.shadowMapSize',
                label: '阴影贴图尺寸',
                type: 'number',
                default: 2048,
                min: 256,
                max: 8192,
                step: 256
            },
            {
                key: 'lighting.shadowGround.enabled',
                label: '接收阴影地面',
                type: 'boolean',
                default: true
            },
            {
                key: 'lighting.shadowGround.y',
                label: '地面高度(Y)',
                type: 'number',
                default: 0,
                min: -1000,
                max: 1000,
                step: 0.1
            },
            {
                key: 'lighting.shadowGround.opacity',
                label: '阴影深浅(不透明度)',
                type: 'number',
                default: 0.25,
                min: 0,
                max: 1,
                step: 0.05
            },
            {
                key: 'area.followCamera',
                label: '天气区域跟随相机',
                type: 'boolean',
                default: true
            },
            {
                key: 'area.center',
                label: '天气区域中心',
                type: 'vector3',
                default: [0, 0, 0]
            },
            {
                key: 'area.size',
                label: '天气区域尺寸',
                type: 'vector3',
                default: [120, 60, 120]
            },
            {
                key: 'roadsideLights.enabled',
                label: '夜间路灯/信号灯补光',
                type: 'boolean',
                default: true
            },
            {
                key: 'roadsideLights.streetLightIntensity',
                label: '路灯强度',
                type: 'number',
                default: 2.0,
                min: 0,
                max: 10,
                step: 0.1
            },
            {
                key: 'roadsideLights.signalLightIntensity',
                label: '信号灯强度',
                type: 'number',
                default: 1.2,
                min: 0,
                max: 10,
                step: 0.1
            }
        ]
    });
}

// 自动初始化
initializeDefaultComponents();

