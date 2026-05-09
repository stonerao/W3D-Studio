export default {
    common: {
        language: '语言',
        english: '英文',
        chinese: '中文',
        cancel: '取消',
        save: '保存',
        close: '关闭',
        delete: '删除',
        confirm: '确定',
        warning: '警告',
        prompt: '提示',
        dangerOperation: '危险操作',
        apply: '应用',
        rename: '重命名',
        perspective: '透视',
        orthographic: '正交'
    },
    routes: {
        editorTitle: '三维编辑器',
        previewTitle: '预览'
    },
    project: {
        untitledName: '未命名项目',
        savedLocal: '项目已保存到本地',
        saveFailed: '保存失败: {message}',
        noSavedProject: '未找到已保存的项目',
        loaded: '项目已加载',
        loadFailed: '加载失败: {message}'
    },
    panels: {
        inspector: '检查器',
        components: '组件库',
        sceneTree: '结构树',
        variables: '变量',
        properties: '属性',
        events: '事件',
        data: '数据',
        settings: '设置',
        ai: 'AI'
    },
    tabs: {
        scrollPrev: '向前滚动',
        scrollNext: '向后滚动'
    },
    canvas: {
        releaseToAdd: '释放以添加',
        cancel: '取消',
        repick: '重新拾取',
        finish: '结束',
        trajectoryPickingTitle: '轨迹拾取中：{name}',
        trajectoryPickingSub: '点击场景取点（Esc 可取消），已添加 {count} 个点',
        alarmPrompt: '告警提示',
        severity: '等级：{severity}',
        close: '关闭',
        sceneInitFailed: '场景初始化失败',
        retry: '重试',
        moveTitle: '移动 (W)',
        rotateTitle: '旋转 (E)',
        scaleTitle: '缩放 (R)',
        componentsCount: '组件 {count}',
        lockedCannotAddPoint: '组件已锁定，无法新增点位',
        lockedCannotDeletePoint: '组件已锁定，无法删除点位',
        sceneNotReadyDrop: '场景未初始化，无法在画布中放置组件',
        componentAdded: '已添加组件：{name}',
        dataCityAdded: '已添加数据城市：{name}',
        modelFallbackName: '模型',
        sceneLoading: '场景加载中...',
        modelLoadingCount: '模型加载中（{count} 个）...{progress}',
        modelLoadingNamed: '{name} 加载中...{progress}',
        localModelFiles: '本地模型文件',
        localModelFilesCount: '本地模型文件（{count} 个文件）',
        localModelDropHint: '释放后检测模型文件（GLB / GLTF / FBX）',
        modelAsset: '模型：{url}',
        splatAsset: '泼溅：{url}',
        resourceAsset: '资源：{url}',
        selectMesh: '选择 Mesh',
        selectMeshNamed: '选择 Mesh：{name}',
        quickAddPoint: '快速添加点位',
        deletePoint: '删除点位',
        meshSelected: '已选择 Mesh：{name}',
        pickMeshHint: '请点击场景中的模型 Mesh 进行选择',
        invalidPoint: '未获取到有效坐标，无法新增点位',
        pointAdded: '已新增点位',
        selectPointFirst: '请先右键命中或选中一个点位',
        pointNotFound: '点位不存在或已被删除',
        pointDeleted: '已删除点位',
        quickActionFailed: '快捷操作失败',
        unsupportedLocalModelFile: '请拖入 .glb、.gltf 或 .fbx 模型文件',
        localModelName: '本地模型',
        localModelLoaded: '已加载本地模型：{name}',
        modelAdded: '已添加模型：{name}',
        splatAdded: '已添加高斯泼溅：{name}',
        unsupportedDropAsset: '仅支持拖拽“模型”“泼溅”或“GeoJSON”资源到画布',
        dropCreateFailed: '拖拽创建失败: {message}',
        trafficPickingTitle: '拾取中：{name}',
        trafficPickedTitle: '已拾取：{name}',
        trafficPickSurfaceHint: '点击模型或高斯泼溅表面取点（Esc 可取消）',
        trafficPickConfirmHint: '等待确认写入坐标（可重新拾取）',
        meshPickEventTarget: '事件目标拾取中',
        meshPickEyedropper: '吸管拾取中',
        meshPickSub: '点击场景中的模型 Mesh 进行选择（Esc 可取消）'
    },
    propertyEditor: {
        selectComponent: '请选择一个组件以编辑属性'
    },
    toolbar: {
        historyActions: '历史操作',
        undoTitle: '撤回 (Ctrl+Z)',
        redoTitle: '重做 (Ctrl+Y)',
        saveProjectTitle: '保存项目 (Ctrl+S)',
        closeEditorTitle: '关闭编辑器',
        unsavedChanges: '有未保存更改',
        savedAt: '已保存 {time}',
        waitingSave: '等待保存',
        cameraManager: '视角管理器',
        buildingManager: '点位管理器',
        camera: '视角',
        points: '点位',
        panelDisplay: '面板显示',
        toggleLeftPanel: '切换左侧面板',
        toggleRightPanel: '切换右侧面板',
        leftPanel: '左栏',
        rightPanel: '右栏',
        previewProject: '预览项目',
        preview: '预览',
        projectSettings: '项目设置',
        projectName: '项目名称',
        projectNamePlaceholder: '请输入项目名称',
        apiBaseUrl: 'API 基础 URL 前缀',
        apiBaseUrlHint: '数据接入中使用相对路径时，会自动拼接此前缀',
        sceneInteractionEvents: '场景交互事件',
        enableSceneInteractions: '启用三维场景内的点击、悬停等交互事件',
        sceneInteractionHint: '禁用后，点击或悬停三维模型将不会触发任何交互效果',
        saveCurrentView: '保存当前视角',
        noCameraViews: '暂无视角，请先调整场景相机后点击“保存当前视角”。',
        viewName: '视角 {index}',
        cameraNotReady: '当前场景相机未就绪，无法保存视角',
        viewSaved: '已保存 {name}',
        viewApplied: '已应用 {name}',
        renameViewPrompt: '请输入新的视角名称',
        emptyViewName: '视角名称不能为空',
        viewNameUpdated: '视角名称已更新',
        deleteViewTitle: '删除视角',
        deleteViewMessage: '确定删除视角“{name}”吗？',
        viewDeleted: '视角已删除',
        settingsSaved: '项目设置已保存',
        undoFailed: '撤回失败，请查看控制台',
        redoFailed: '重做失败，请查看控制台',
        projectSaved: '项目已保存',
        closeUnsavedTitle: '关闭编辑器',
        closeUnsavedMessage: '当前有未保存的更改，确定要关闭吗？',
        reloadUnsavedTitle: '重载项目',
        reloadUnsavedMessage: '当前有未保存的更改，确定要重载项目吗？',
        projectReloaded: '项目已重载',
        importUnsavedTitle: '导入项目',
        importUnsavedMessage: '当前有未保存的更改，确定要导入项目吗？',
        projectImported: '项目已导入',
        importFailed: '导入失败，请检查 JSON 文件格式',
        exportSuccess: '项目已导出为 JSON 文件',
        exportFailed: '导出失败，请查看控制台',
        justNow: '刚刚',
        minutesAgo: '{count}分钟前',
        hoursAgo: '{count}小时前'
    },
    componentLibrary: {
        searchPlaceholder: '搜索组件...',
        empty: '暂无组件',
        all: '全部',
        exists: '已存在',
        alreadyExistsTitle: '场景中已存在 {name}',
        alreadyExistsWarning: '场景中已存在 {name}，该组件只能添加一个实例',
        addFailed: '添加组件失败: {message}',
        addToScene: '添加到场景',
        viewDetails: '查看详情',
        detailsTitle: '组件详情',
        detailsMessage: '名称：{name}\n类型：{type}\n描述：{description}',
        categories: {
            loaders: '加载器',
            helpers: '辅助工具',
            lights: '光源',
            effects: '特效',
            animations: '动画',
            controls: '相机控制',
            markers: '标注',
            traffic: '交通'
        },
        components: {
            ModelLoader: {
                name: '模型加载器',
                description: '加载 GLTF/GLB/FBX 格式的 3D 模型'
            },
            GaussianSplatLoader: {
                name: '高斯泼溅',
                description: '加载 PLY / SPLAT / KSPLAT / SPZ 高斯泼溅资源'
            },
            GeoJSONLoader: {
                name: '数据城市',
                description: '加载 GeoJSON 城市或行政区边界并生成可交互的 3D 数据城市'
            },
            GridHelper: {
                name: '网格辅助',
                description: '显示网格辅助线'
            },
            HDRLoader: {
                name: 'HDR 环境贴图',
                description: '加载 HDR 环境贴图，可作为 environment/background'
            },
            ParticleSystem: {
                name: '粒子系统',
                description: '高级粒子系统，支持动态发射和物理效果'
            },
            Heatmap: {
                name: '热力图',
                description: '基于点位数据渲染软边发光热力分布'
            },
            AreaBlock: {
                name: '区域块',
                description: '在三维空间中展示区域块，支持墙体、底部和边框渲染'
            },
            PathAnimation: {
                name: '路径动画',
                description: '沿路径移动的动画组件，支持循环、往返、缓动等'
            },
            MultiPathAnimation: {
                name: '多轨迹路径动画',
                description: '支持加载模型并在多条路径上进行实例化渲染'
            },
            CameraTour: {
                name: '定点漫游',
                description: '基于多个视角配置自动巡游相机'
            },
            DeviceExplodedView: {
                name: '设备爆炸图',
                description: '按设备树结构从中心点向外爆炸展示'
            },
            PostProcessing: {
                name: '后期处理',
                description: '统一管理 Bloom、SSR、GTAO、SAO、SSAO、Pixel、DOF、Sobel、FXAA 等后期效果'
            },
            WeatherClouds: {
                name: '天气云层',
                description: '动态天空云层效果，内置体积云和多层网格云层模式'
            },
            FlyControls: {
                name: '飞行相机',
                description: '自由飞行相机控制模式'
            },
            FirstPersonControls: {
                name: '第一人称',
                description: '第一人称视角控制模式'
            },
            CameraJump: {
                name: '视角跳转',
                description: '视角跳转到指定 Mesh、标签或点位'
            },
            ModelAnimation: {
                name: '模型动画',
                description: '播放模型自带的动画'
            },
            MigrationLine: {
                name: '迁移线',
                description: '在三维空间中展示从一个点到另一个点的动态迁移效果'
            },
            Label3D: {
                name: '3D 标签',
                description: '使用 Canvas 生成文字纹理，通过 Sprite 渲染到三维场景中'
            },
            MarkArea: {
                name: '标注区域',
                description: '在三维空间中显示平面标注区域'
            },
            MarkLine: {
                name: '标注线',
                description: '在三维空间中显示连接多点的线条'
            },
            MarkPoint: {
                name: '标注点',
                description: '在三维空间中显示点位标记'
            },
            PointTypeMarkerManager: {
                name: '多类型点位管理',
                description: '支持模型/静态图类型点位管理，采用实例化渲染优化性能'
            },
            CameraPointManager: {
                name: '摄像头点位',
                description: '在场景中管理摄像头点位，样式由 type 外部配置'
            },
            ExplodedView: {
                name: '楼层爆炸图',
                description: '楼层爆炸视图效果，支持楼层选中、高亮、动画等功能'
            },
            WeatherLighting: {
                name: '气象与光照',
                description: '在线天气、手动天气切换、太阳位置光照和夜间路灯联动'
            },
            TrafficRoadsideDeviceManager: {
                name: '路侧设备管理',
                description: '路网及道路设施、杆件与挂载设备管理'
            }
        }
    }
};
