import { ref } from 'vue';
import { createI18n } from 'vue-i18n';
import en from './locales/en';
import zh from './locales/zh';

export const DEFAULT_LOCALE = 'en';
export const SUPPORT_LOCALES = ['en', 'zh'];
export const LOCALE_STORAGE_KEY = 'w3d_editor_locale';

const messages = { en, zh };

const normalizeLocale = (locale) => {
    const value = String(locale || '').toLowerCase();
    if (value.startsWith('zh')) return 'zh';
    if (value.startsWith('en')) return 'en';
    return DEFAULT_LOCALE;
};

const getStoredLocale = () => {
    if (typeof localStorage === 'undefined') return DEFAULT_LOCALE;
    return normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
};

export const currentLocale = ref(getStoredLocale());

export const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: currentLocale.value,
    fallbackLocale: DEFAULT_LOCALE,
    missingWarn: false,
    fallbackWarn: false,
    messages
});

const syncDocumentLocale = (locale) => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
};

export const setLocale = (locale) => {
    const normalized = normalizeLocale(locale);
    currentLocale.value = normalized;
    i18n.global.locale.value = normalized;

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
    }

    syncDocumentLocale(normalized);
    if (typeof document !== 'undefined') {
        requestAnimationFrame(() => applyStaticTextTranslations(document.body));
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('w3d:locale-change', {
            detail: { locale: normalized }
        }));
    }
};

export const t = (key, params = {}) => {
    currentLocale.value;
    return i18n.global.t(key, params);
};

export const te = (key) => {
    currentLocale.value;
    return i18n.global.te(key);
};

export const getDateTimeLocale = () => currentLocale.value === 'zh' ? 'zh-CN' : 'en-US';

const staticTextMap = {
    场景结构: 'Scene structure',
    场景: 'Scene',
    暂无组件: 'No components',
    从左侧组件库添加组件: 'Add components from the component library.',
    展开全部: 'Expand all',
    折叠全部: 'Collapse all',
    清空场景: 'Clear scene',
    '搜索名称、分组或描述': 'Search name, group, or description',
    '例如：添加一个模型加载器并放到原点': 'Example: add a model loader and place it at the origin',
    '例如：Add一个模型加载器并放到原点': 'Example: add a model loader and place it at the origin',
    模型加载器: 'Model loader',
    热力图: 'Heatmap',
    定点漫游: 'Camera tour',
    '3D 标签': '3D label',
    多轨迹路径动画: 'Multi-path animation',
    后期处理: 'Post processing',
    热力数据: 'Heat data',
    热力点: 'heat points',
    标签列表: 'Label list',
    路径数据列表: 'Path data list',
    视角列表: 'View list',
    视角来源: 'View source',
    视角: 'View',
    视角管理器: 'view manager',
    组件配置视角: 'Component-configured views',
    场景视角管理数据: 'Scene view manager data',
    名称: 'Name',
    '调用 ID': 'Callable ID',
    复制: 'Copy',
    变换: 'Transform',
    位置: 'Position',
    统一缩放: 'Uniform scale',
    锁: 'Lock',
    显示控制: 'Visibility controls',
    '全显示 · 未锁': 'All visible · unlocked',
    编辑: 'Edit',
    预览: 'Preview',
    锁定: 'Lock',
    未锁: 'Unlocked',
    '模型 URL': 'Model URL',
    选: 'Pick',
    投射阴影: 'Cast shadows',
    接收阴影: 'Receive shadows',
    启用动画: 'Enable animation',
    自动播放动画: 'Autoplay animation',
    启用: 'Enable',
    交互模式: 'Interaction mode',
    禁用: 'Disabled',
    全部启用: 'Enable all',
    '指定 Mesh': 'Specific mesh',
    高级功能: 'Advanced features',
    更多操作: 'More actions',
    本地模型文件: 'Local model file',
    未选择模型文件: 'No model file selected',
    选择文件: 'Choose file',
    '支持 GLB / GLTF / FBX；文件只在浏览器本地读取，不上传服务器。GLTF 如有外部 .bin 或贴图，请一并选择。': 'Supports GLB / GLTF / FBX. Files are read locally in the browser and are not uploaded. If a GLTF uses external .bin files or textures, select them together.',
    尺寸适配: 'Size fitting',
    缩放模式: 'Scale mode',
    普通缩放: 'Normal scale',
    按最长边适配: 'Fit by longest side',
    当前尺寸: 'Current size',
    当前最长边: 'Current longest side',
    '适配模式会按模型包围盒最长边自动缩放，最终缩放 = 自动适配结果 × 通用 Transform 中的 scale。': 'Fit mode scales automatically by the model bounding box longest side. Final scale = auto-fit result × the scale in Transform.',
    性能优化模式: 'Performance optimization mode',
    未启用: 'Disabled',
    启用优化: 'Enable optimization',
    网格统计: 'Mesh statistics',
    '0 个 Mesh': '0 meshes',
    批处理结果: 'Batch result',
    'Mesh（共 0 个）': 'Meshes (0 total)',
    '-- 请选择 --': '-- Select --',
    吸管拾取: 'Eyedropper pick',
    '选择一个 Mesh 开始编辑': 'Select a mesh to start editing',
    最大点数: 'Max points',
    渲染模式: 'Render mode',
    平面热力: 'Planar heatmap',
    模型表面: 'Model surface',
    投射平面: 'Projection plane',
    自动: 'Auto',
    'XZ 平面': 'XZ plane',
    'XY 平面': 'XY plane',
    'YZ 平面': 'YZ plane',
    纹理分辨率: 'Texture resolution',
    平面边距: 'Plane padding',
    表面偏移: 'Surface offset',
    基础半径: 'Base radius',
    按值缩放: 'Scale by value',
    最小半径: 'Min radius',
    最大半径: 'Max radius',
    衰减曲线: 'Falloff curve',
    高斯: 'Gaussian',
    线性: 'Linear',
    显示阈值: 'Display threshold',
    '最小值（归一化）': 'Min value (normalized)',
    '最大值（归一化）': 'Max value (normalized)',
    默认高度: 'Default height',
    透明度: 'Opacity',
    混合模式: 'Blend mode',
    叠加: 'Additive',
    正常: 'Normal',
    相乘: 'Multiply',
    滤色: 'Screen',
    边缘柔化: 'Edge softness',
    整体强度: 'Overall intensity',
    核心增强: 'Core boost',
    低值裁剪: 'Low-value cutoff',
    等值分层: 'Contour bands',
    显示点位标记: 'Show point markers',
    颜色梯度: 'Color gradient',
    阈值颜色映射: 'Threshold color mapping',
    'Array项支持 { x, y, z, value, size } 或 [x, y, z, value]': 'Array items support { x, y, z, value, size } or [x, y, z, value].',
    '支持纯颜色Array，或 [{ stop, color }] 形式的Gradient定义': 'Supports a plain color array or gradient definitions in the form [{ stop, color }].',
    '按值分段着色，格式：[{ value, color }]；存在时优先于Gradient色带': 'Segment colors by value in the format [{ value, color }]. Takes precedence over the gradient ramp when present.',
    编辑热力图数据: 'Edit heatmap data',
    编辑热力图颜色映射: 'Edit heatmap color mapping',
    编辑热力图阈值映射: 'Edit heatmap threshold mapping',
    循环次数: 'Loop count',
    '每段时长(ms)': 'Segment duration (ms)',
    缓动函数: 'Easing function',
    自动开始: 'Auto start',
    起始视角索引: 'Start view index',
    按视角切相机类型: 'Switch camera type by view',
    '同步 near/far': 'Sync near/far',
    '视角列表 (JSON)': 'View list (JSON)',
    '结构参考视角管理器：[{position,target,cameraType,fov|zoom}]': 'Structure reference: view manager [{position,target,cameraType,fov|zoom}]',
    编辑视角列表: 'Edit view list',
    '通过弹窗统一管理标签（新增/编辑/删除），点击保存后整体更新场景标签。': 'Manage labels in the dialog (add/edit/delete). Save to update all scene labels.',
    默认渲染类型: 'Default render type',
    默认自适应尺寸: 'Default auto size',
    默认基础尺寸: 'Default base size',
    默认宽度: 'Default width',
    默认高度: 'Default height',
    字体大小: 'Font size',
    边框颜色: 'Border color',
    边框宽度: 'Border width',
    面向相机: 'Face camera',
    深度测试: 'Depth test',
    编辑标签列表: 'Edit label list',
    '通过弹窗统一管理路径与点位，点击保存后整体更新路径数据。': 'Manage paths and points in the dialog. Save to update all path data.',
    实例模型缩放: 'Instance model scale',
    每条路径车辆数: 'Vehicles per path',
    移动速度: 'Move speed',
    朝向模式: 'Orientation mode',
    前进方向: 'Forward',
    后退方向: 'Backward',
    固定朝向: 'Fixed orientation',
    循环: 'Loop',
    显示路径: 'Show path',
    路径颜色: 'Path color',
    编辑多轨迹数据与模型: 'Edit multi-path data and model',
    启用后期处理: 'Enable post processing',
    半径: 'Radius',
    距离指数: 'Distance exponent',
    厚度: 'Thickness',
    强度: 'Intensity',
    采样数: 'Samples',
    衰减: 'Falloff',
    输出: 'Output',
    材质: 'Material',
    混合: 'Blend',
    仅: 'Only',
    漫反射: 'diffuse',
    默认: 'Default',
    模糊: 'Blur',
    深度: 'Depth',
    法线: 'Normal',
    偏移: 'Bias',
    最小分辨率: 'Min resolution',
    标准差: 'standard deviation',
    深度裁切: 'depth cut',
    分辨率缩放: 'Resolution scale',
    无限厚度: 'Infinite thickness',
    菲涅尔: 'Fresnel',
    距离衰减: 'Distance attenuation',
    多次反射: 'Multiple reflection',
    不透明度: 'Opacity',
    阈值: 'Threshold',
    曝光: 'Exposure',
    焦点距离: 'Focus distance',
    光圈: 'Aperture',
    最大模糊: 'Max blur',
    像素化: 'Pixelation',
    像素尺寸: 'Pixel size',
    后期处理配置: 'Post-processing configuration',
    调整顺序: 'Adjust order',
    恢复默认: 'Restore defaults',
    整体开关: 'Main switch',
    已启用: 'Enabled',
    后期列表: 'Effects list',
    关闭: 'Off',
    泛光: 'Bloom',
    景深虚化: 'Depth of field blur',
    边缘检测: 'Edge detection',
    快速抗锯齿: 'Fast antialiasing',
    '关闭后期处理后，将回退为普通渲染，但会保留每个效果的参数和启用状态。': 'When post processing is disabled, rendering falls back to the normal pipeline while preserving each effect parameter and enabled state.',
    '高质量环境光遮蔽，层次感更强': 'High-quality ambient occlusion with stronger depth.',
    '轻量环境光遮蔽，成本低于 GTAO / SAO': 'Lightweight ambient occlusion with lower cost than GTAO / SAO.',
    '屏幕空间环境光遮蔽，效果更厚重': 'Screen-space ambient occlusion with a heavier look.',
    '屏幕空间反射，适合地面和金属反射': 'Screen-space reflections for floors and metallic reflections.',
    '泛光，高亮区域发光扩散': 'Bloom, spreading glow from bright areas.',
    '景深虚化，基于焦点距离控制清晰范围': 'Depth-of-field blur controlled by focus distance.',
    '边缘检测，适合轮廓强化': 'Edge detection for stronger outlines.',
    '像素化，降低采样精度形成颗粒风格': 'Pixelation for a coarse sampled style.',
    '快速抗锯齿，适合作为尾部平滑': 'Fast antialiasing for final smoothing.',
    'RenderPass 固定在最前，OutputPass 固定在最后。AO 类效果可以叠加，但更建议一次只启用一个。': 'RenderPass is fixed first and OutputPass is fixed last. AO effects can be stacked, but enabling only one at a time is recommended.',
    烘焙光照: 'Baked lighting',
    已禁用: 'Disabled',
    已配置贴图: 'Texture configured',
    '0 个': '0',
    管理烘焙贴图: 'Manage baked textures',
    模型结构: 'Model structure',
    弹窗展示: 'Show dialog',
    全部收起: 'Collapse all',
    全部显示: 'Show all',
    全部隐藏: 'Hide all',
    '当前显示 0 个': 'Currently showing 0',
    当前选中: 'Current selection',
    未选中: 'None selected',
    隐藏其他物体: 'Hide other objects',
    当前模型没有可展示的节点: 'The current model has no displayable nodes.',
    大场景治理: 'Large scene governance',
    模型规模: 'Model scale',
    未获取: 'Not available',
    边界尺寸: 'Bounds size',
    当前距离: 'Current distance',
    运行状态: 'Runtime status',
    未诊断: 'Not diagnosed',
    'LOD 级别': 'LOD level',
    加载状态: 'Load status',
    已加载: 'Loaded',
    启用治理: 'Enable governance',
    距离裁剪: 'Distance culling',
    区域标签: 'Area tag',
    楼层标签: 'Floor tag',
    分块标签: 'Chunk tag',
    '最大可见距离（m）': 'Max visible distance (m)',
    '启用 LOD': 'Enable LOD',
    '保留交互 Mesh': 'Keep interactive meshes',
    参与分块流式: 'Use chunk streaming',
    'LOD 中距离（m）': 'LOD mid distance (m)',
    'LOD 远距离（m）': 'LOD far distance (m)',
    中距离隐藏比例: 'Mid-distance hide ratio',
    远距离隐藏比例: 'Far-distance hide ratio',
    单模型三角面预警: 'Single-model triangle warning',
    '单模型 Mesh 预警': 'Single-model mesh warning',
    当前组件: 'Current component',
    '0 个事件入口': '0 event entries',
    事件编排: 'Event orchestration',
    蓝图事件流: 'Blueprint event flow',
    '统一配置入口、判断条件和执行动作。': 'Configure triggers, conditions, and actions in one place.',
    配置蓝图: 'Configure blueprint',
    事件入口: 'Event entries',
    暂无事件入口: 'No event entries',
    '进入蓝图后添加点击、悬停、数据更新等触发入口。': 'Open the blueprint to add click, hover, data update, and other triggers.',
    打开蓝图: 'Open blueprint',
    '0 个数据源': '0 data sources',
    数据接入: 'Data access',
    开启后可绑定接口或实时消息: 'Enable to bind APIs or real-time messages',
    查看结构: 'View structure',
    数据接入未启用: 'Data access is disabled',
    '开启后可以为当前组件添加接口、公共数据源或实时连接。': 'Enable it to add APIs, public data sources, or real-time connections to the current component.',
    组件名称: 'Component name',
    绑定位置变量: 'Bind position variable',
    绑定旋转变量: 'Bind rotation variable',
    绑定缩放变量: 'Bind scale variable',
    锁定比例: 'Lock aspect ratio',
    编辑变量绑定: 'Edit variable binding',
    预览变量绑定: 'Preview variable binding',
    锁定变量绑定: 'Lock variable binding',
    从资源库选择: 'Choose from asset library',
    '搜索 Mesh / Group': 'Search Mesh / Group',
    如: 'Example',
    '如：A区': 'Example: Area A',
    '如：F3': 'Example: F3',
    '如：chunk-01': 'Example: chunk-01',
    添加: 'Add',
    导入: 'Import',
    导出: 'Export',
    变量: 'Variables',
    全部类型: 'All types',
    数值: 'Number',
    布尔: 'Boolean',
    文本: 'Text',
    数组: 'Array',
    对象: 'Object',
    二维向量: 'Vector2',
    三维向量: 'Vector3',
    全部分组: 'All groups',
    暂无变量: 'No variables',
    '点击"添加变量"创建第一个变量': 'Click "Add variable" to create the first variable.',
    未选择组件: 'No component selected',
    选择画布中的组件后: 'After selecting a component on the canvas',
    可以在这里配置交互事件: 'you can configure interaction events here.',
    可以在这里配置数据接入: 'you can configure data access here.',
    '选择画布中的组件后，可以在这里配置交互事件。': 'After selecting a component on the canvas, you can configure interaction events here.',
    '选择画布中的组件后，可以在这里配置数据接入。': 'After selecting a component on the canvas, you can configure data access here.',
    渲染器: 'Renderer',
    抗锯齿: 'Antialias',
    阴影: 'Shadows',
    输出色彩空间: 'Output color space',
    相机: 'Camera',
    投影类型: 'Projection type',
    透视相机: 'Perspective camera',
    正交相机: 'Orthographic camera',
    视野角度: 'Field of view',
    近裁剪面: 'Near clipping plane',
    相机位置: 'Camera position',
    目标点: 'Target',
    背景: 'Background',
    背景类型: 'Background type',
    纯色: 'Solid color',
    渐变: 'Gradient',
    图片: 'Image',
    背景颜色: 'Background color',
    类型: 'Type',
    颜色: 'Color',
    天空盒: 'Skybox',
    控制器: 'Controls',
    阻尼: 'Damping',
    阻尼系数: 'Damping factor',
    缩放: 'Scale',
    旋转: 'Rotate',
    平移: 'Pan',
    启用阻尼: 'Enable damping',
    启用缩放: 'Enable zoom',
    启用旋转: 'Enable rotation',
    启用平移: 'Enable pan',
    自动旋转: 'Auto rotate',
    自动旋转速度: 'Auto-rotate speed',
    最小距离: 'Minimum distance',
    最大距离: 'Maximum distance',
    灯光: 'Lighting',
    环境光: 'Ambient light',
    平行光: 'Directional light',
    辅助: 'Helpers',
    辅助显示: 'Helper display',
    当前预览模式会自动隐藏网格: 'The current preview mode automatically hides the grid.',
    重置默认值: 'Reset defaults',
    '编辑器内默认显示网格辅助。预览模式是否显示由“预览时隐藏”控制。': 'The editor shows the grid helper by default. Preview visibility is controlled by "Hide in preview".',
    编辑网格: 'Edit grid',
    预览时隐藏: 'Hide in preview',
    网格大小: 'Grid size',
    分割数量: 'Divisions',
    网格颜色: 'Grid color',
    网格: 'Grid',
    坐标轴: 'Axes',
    坐标轴大小: 'Axes size',
    'Loading 开关': 'Loading switch',
    'Loading 效果': 'Loading effect',
    旋转圈: 'Spinner',
    跳动点: 'Dots',
    脉冲条: 'Pulse bars',
    点位坐标转换: 'Point coordinate conversion',
    拟合方式: 'Fitting method',
    有效参考点: 'Valid reference points',
    当前还未应用点位坐标转换参数: 'Point coordinate conversion parameters have not been applied yet.',
    编辑参数: 'Edit parameters',
    重算已有点位: 'Recalculate existing points',
    三维: '3D',
    '三维 AI': '3D AI',
    未配置: 'Not configured',
    '未配置 API Key': 'API key not configured',
    清空: 'Clear',
    供应商: 'Provider',
    兼容: 'Compatible',
    'OpenAI 兼容': 'OpenAI compatible',
    自定义: 'Custom',
    显示: 'Show',
    隐藏: 'Hide',
    清除: 'Clear',
    概括当前场景: 'Summarize current scene',
    添加模型加载器: 'Add model loader',
    把选中组件移动到原点: 'Move selected component to origin',
    '输入需求后，AI 会结合当前场景组件给出回复；低风险操作会自动执行，需要确认的操作会停留等待。': 'After you enter a request, AI responds using current scene components. Low-risk actions run automatically, while actions requiring confirmation wait for approval.',
    '请先配置供应商、Model 和 API Key': 'Configure Provider, Model, and API Key first.',
    发送: 'Send',
    输入需求后: 'After entering a request',
    会结合当前场景组件给出回复: 'the assistant will respond using the current scene components.',
    低风险操作会自动执行: 'Low-risk actions run automatically',
    需要确认的操作会停留等待: 'actions requiring confirmation wait for approval',
    属性: 'Properties',
    事件: 'Events',
    数据: 'Data',
    设置: 'Settings',
    检查器: 'Inspector',
    组件库: 'Components',
    结构树: 'Scene tree'
};

const staticRegexRules = [
    [/^变量\s+(\d+)$/, 'Variables $1'],
    [/^当前\s+(\d+)$/, 'Current $1'],
    [/^已配置\s+(\d+)\s+个热力点$/, '$1 heat points configured'],
    [/^已配置\s+(\d+)\s+个颜色节点$/, '$1 color nodes configured'],
    [/^已配置\s+(\d+)\s+条阈值映射$/, '$1 threshold mappings configured'],
    [/^已配置\s+(\d+)\s+条视角$/, '$1 views configured'],
    [/^已配置\s+(\d+)\s+条标签$/, '$1 labels configured'],
    [/^已配置\s+(\d+)\s+条路径$/, '$1 paths configured'],
    [/^(\d+)\/(\d+)\s+已启用$/, '$1/$2 enabled'],
    [/^成功导入\s+(\d+)\s+个变量$/, 'Imported $1 variables'],
    [/^已导入\s+(\d+)\s+个点位$/, 'Imported $1 points'],
    [/^已追加\s+(\d+)\s+个点位$/, 'Appended $1 points']
];

let staticTextObserver = null;
let isApplyingStaticTranslation = false;
const originalTextNodes = new WeakMap();
const originalAttributes = new WeakMap();

const shouldSkipStaticNode = (node) => {
    const parent = node?.parentElement;
    if (!parent) return true;
    return Boolean(parent.closest('script, style, textarea, input, code, pre'));
};

const translateStaticString = (value) => {
    const raw = String(value ?? '');
    const trimmed = raw.trim();
    if (!trimmed) return raw;

    const mapped = staticTextMap[trimmed];
    if (mapped) {
        return raw.replace(trimmed, mapped);
    }

    for (const [pattern, replacement] of staticRegexRules) {
        if (pattern.test(trimmed)) {
            return raw.replace(trimmed, trimmed.replace(pattern, replacement));
        }
    }

    if (/[\u4e00-\u9fff]/.test(raw)) {
        const replaced = Object.entries(staticTextMap)
            .sort((left, right) => right[0].length - left[0].length)
            .reduce((text, [source, target]) => text.split(source).join(target), raw);
        if (replaced !== raw) {
            return replaced;
        }
    }

    return raw;
};

export const translateDisplayText = (value) => {
    currentLocale.value;
    return currentLocale.value === 'en' ? translateStaticString(value) : String(value ?? '');
};

const translateStaticTextNode = (node) => {
    if (shouldSkipStaticNode(node)) return;
    const original = originalTextNodes.get(node) ?? node.nodeValue;
    if (!originalTextNodes.has(node)) {
        originalTextNodes.set(node, original);
    }

    const next = currentLocale.value === 'en' ? translateStaticString(original) : original;
    if (node.nodeValue !== next) {
        node.nodeValue = next;
    }
};

const translateStaticElementAttributes = (element) => {
    if (!element || element.closest?.('script, style')) return;
    const attrs = ['title', 'placeholder', 'aria-label'];
    let originals = originalAttributes.get(element);
    if (!originals) {
        originals = {};
        originalAttributes.set(element, originals);
    }

    attrs.forEach((attr) => {
        if (!element.hasAttribute(attr)) return;
        if (!Object.prototype.hasOwnProperty.call(originals, attr)) {
            originals[attr] = element.getAttribute(attr);
        }
        const original = originals[attr];
        const next = currentLocale.value === 'en' ? translateStaticString(original) : original;
        if (element.getAttribute(attr) !== next) {
            element.setAttribute(attr, next);
        }
    });
};

const applyStaticTextTranslations = (root = document.body) => {
    if (typeof document === 'undefined' || !root || isApplyingStaticTranslation) return;
    isApplyingStaticTranslation = true;
    try {
        if (root.nodeType === Node.TEXT_NODE) {
            translateStaticTextNode(root);
        } else if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            if (root.nodeType === Node.ELEMENT_NODE) {
                translateStaticElementAttributes(root);
            }

            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                translateStaticTextNode(walker.currentNode);
            }

            root.querySelectorAll?.('[title], [placeholder], [aria-label]').forEach(translateStaticElementAttributes);
        }
    } finally {
        isApplyingStaticTranslation = false;
    }
};

const ensureStaticTextTranslator = () => {
    if (typeof document === 'undefined' || staticTextObserver) return;

    staticTextObserver = new MutationObserver((mutations) => {
        if (isApplyingStaticTranslation) return;
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => applyStaticTextTranslations(node));
            if (mutation.type === 'characterData') {
                applyStaticTextTranslations(mutation.target);
            }
            if (mutation.type === 'attributes') {
                translateStaticElementAttributes(mutation.target);
            }
        });
    });

    const start = () => {
        if (!document.body) return;
        applyStaticTextTranslations(document.body);
        staticTextObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['title', 'placeholder', 'aria-label']
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
};

export const formatDateTime = (value, options = {}) => {
    if (!value) return '';
    return new Date(value).toLocaleString(getDateTimeLocale(), options);
};

export const useEditorI18n = () => ({
    locale: currentLocale,
    locales: SUPPORT_LOCALES,
    setLocale,
    t,
    te,
    formatDateTime,
    getDateTimeLocale
});

setLocale(currentLocale.value);
ensureStaticTextTranslator();
