/**
 * 可用组件配置
 * 定义编辑器中可以使用的所有组件
 */

export const availableComponents = [
    {
        type: 'ModelLoader',
        displayName: '模型加载器',
        description: '加载 GLTF/GLB/FBX 格式的 3D 模型',
        // icon: '🎨',
        category: 'loaders',
        enabled: true
    },
    {
        type: 'GaussianSplatLoader',
        displayName: '高斯泼溅',
        description: '加载 PLY / SPLAT / KSPLAT / SPZ 高斯泼溅资源',
        category: 'loaders',
        enabled: false
    },
    {
        type: 'GeoJSONLoader',
        displayName: '数据城市',
        description: '加载 GeoJSON 城市或行政区边界并生成可交互的 3D 数据城市',
        category: 'loaders',
        enabled: true
    },
    {
        type: 'GridHelper',
        displayName: '网格辅助',
        description: '显示网格辅助线',
        // icon: '📐',
        category: 'helpers',
        enabled: true
    },
    {
        type: 'HDRLoader',
        displayName: 'HDR 环境贴图',
        description: '加载 HDR 环境贴图，可作为 environment/background',
        // icon: '🌅',
        category: 'loaders',
        enabled: true
    },
    {
        type: 'ParticleSystem',
        displayName: '粒子系统',
        description: '高级粒子系统，支持动态发射、物理效果',
        // icon: '✨',
        category: 'effects',
        enabled: true
    },
    {
        type: 'Heatmap',
        displayName: '热力图',
        description: '基于点位数据渲染软边发光热力分布，可配置大小、阈值、混合模式与颜色',
        category: 'effects',
        enabled: true
    },
    // 区域组件
    {
        type: 'AreaBlock',
        displayName: '区域块',
        description: '在三维空间中展示区域块，支持墙壁、底部和边框渲染，带云雾 Shader 效果',
        // icon: '🏢',
        category: 'markers',
        enabled: true
    },
    // 动画组件
    {
        type: 'PathAnimation',
        displayName: '路径动画',
        description: '沿路径移动的动画组件，支持循环、往返、缓动等',
        // icon: '🛤️',
        category: 'animations',
        enabled: true
    },
    {
        type: 'MultiPathAnimation',
        displayName: '多轨迹路径动画',
        description: '支持加载模型并在多条路径上进行实例化渲染的动画组件',
        // icon: '🚗',
        category: 'animations',
        enabled: true
    },
    {
        type: 'CameraTour',
        displayName: '定点漫游',
        description: '基于多个视角配置自动巡游相机，支持循环、暂停、恢复与动态更新视角列表',
        category: 'animations',
        enabled: true
    },
    {
        type: 'DeviceExplodedView',
        displayName: '设备爆炸图',
        description: '按设备树结构从中心点向外爆炸，距离中心越远偏移越大',
        category: 'effects',
        enabled: true
    },
    {
        type: 'PostProcessing',
        displayName: '后期处理',
        description: '统一管理 Bloom、SSR、GTAO、SAO、SSAO、Pixel、DOF、Sobel、FXAA 等后期效果',
        category: 'effects',
        enabled: true
    },
    {
        type: 'WeatherClouds',
        displayName: '天气云层',
        description: '动态天空云层效果，内置后期体积云和多层网格云层两种模式',
        category: 'effects',
        enabled: true
    },
    {
        type: 'FlyControls',
        displayName: '飞行相机',
        description: '自由飞行相机控制模式',
        category: 'controls',
        enabled: true
    },
    {
        type: 'FirstPersonControls',
        displayName: '第一人称',
        description: '第一人称视角控制模式',
        category: 'controls',
        enabled: true
    },
    {
        type: 'CameraJump',
        displayName: '视角跳转',
        description: '视角跳转到指定 Mesh、标签或点位，支持距离、方向、速度与缓动函数',
        category: 'animations',
        enabled: true
    },
    {
        type: 'ModelAnimation',
        displayName: '模型动画',
        description: '播放模型自带的动画',
        // icon: '🎬',
        category: 'animations',
        enabled: true
    },
    {
        type: 'MigrationLine',
        displayName: '迁移线',
        description: '在三维空间中展示从一个点到另一个点的动态迁移效果',
        // icon: '➡️',
        category: 'animations',
        enabled: true
    },
    // 标注组件
    {
        type: 'Label3D',
        displayName: '3D 标签',
        description: '使用 Canvas 生成文字纹理，通过 Sprite 渲染到三维场景中',
        // icon: '🏷️',
        category: 'markers',
        enabled: true
    },
    {
        type: 'MarkArea',
        displayName: '标注区域',
        description: '在三维空间中显示平面标注区域',
        // icon: '⬜',
        category: 'markers',
        enabled: true
    },
    {
        type: 'MarkLine',
        displayName: '标注线',
        description: '在三维空间中显示连接多点的线条',
        // icon: '📏',
        category: 'markers',
        enabled: true
    },
    {
        type: 'MarkPoint',
        displayName: '标注点',
        description: '在三维空间中显示点位标记',
        // icon: '📍',
        category: 'markers',
        enabled: true
    },
    // 爆炸图组件
    {
        type: 'PointTypeMarkerManager',
        displayName: '多类型点位管理',
        description: '支持模型/静态图类型点位管理，采用实例化渲染优化性能',
        category: 'markers',
        enabled: true
    },
    {
        type: 'CameraPointManager',
        displayName: '摄像头点位',
        description: '在场景中管理摄像头点位，点位保存业务字段，样式由 type 外部配置',
        category: 'markers',
        enabled: true
    },
    {
        type: 'ExplodedView',
        displayName: '楼层爆炸图',
        description: '楼层爆炸视图效果，支持楼层选中、高亮、动画等功能',
        // icon: '🏗️',
        category: 'effects',
        enabled: true
    },
    // 区域气象与光照
    {
        type: 'WeatherLighting',
        displayName: '气象与光照',
        description: '在线天气（≤30min）+ 手动天气切换 + 太阳位置光照 + 夜间路灯联动',
        category: 'effects',
        enabled: true
    },
    // 智能交通组件
    {
        type: 'TrafficRoadsideDeviceManager',
        displayName: '路侧设备管理',
        description: '路网及道路设施、杆件与挂载设备管理（支持资源URL、拾取与拖拽）',
        category: 'traffic',
        enabled: true
    }
    // BuildingEditor 已移除：点位管理器现在作为项目级别的数据管理功能，不再是场景组件
];

/**
 * 组件分类
 */
export const componentCategories = [
    {
        key: 'loaders',
        label: '加载器',
        icon: '📁',
        description: '模型和资源加载组件'
    },
    {
        key: 'helpers',
        label: '辅助工具',
        icon: '🛠️',
        description: '场景辅助显示组件'
    },
    {
        key: 'lights',
        label: '光源',
        icon: '💡',
        description: '场景光照组件'
    },
    {
        key: 'effects',
        label: '特效',
        icon: '✨',
        description: '视觉特效组件'
    },
    {
        key: 'animations',
        label: '动画',
        icon: '🎬',
        description: '动画和路径组件'
    },
    {
        key: 'controls',
        label: '相机控制',
        icon: '🎮',
        description: '飞行相机与第一人称控制组件'
    },
    {
        key: 'markers',
        label: '标注',
        icon: '📍',
        description: '点线面标注组件'
    },
    {
        key: 'traffic',
        label: '交通',
        icon: '🚦',
        description: '智能交通路侧设备与设施组件'
    }
];

/**
 * 根据分类获取组件
 * @param {string} category - 分类 key
 * @returns {Array} 组件列表
 */
export function getComponentsByCategory(category) {
    return availableComponents.filter((comp) => comp.category === category && comp.enabled && comp.type !== 'PathAnimation');
}

/**
 * 获取所有启用的组件
 * @returns {Array} 组件列表
 */
export function getEnabledComponents() {
    return availableComponents.filter((comp) => comp.enabled && comp.type !== 'PathAnimation');
}

/**
 * 根据类型获取组件配置
 * @param {string} type - 组件类型
 * @returns {Object|null} 组件配置
 */
export function getComponentConfig(type) {
    return availableComponents.find((comp) => comp.type === type) || null;
}

