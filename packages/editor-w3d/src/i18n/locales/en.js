export default {
    common: {
        language: 'Language',
        english: 'English',
        chinese: 'Chinese',
        cancel: 'Cancel',
        save: 'Save',
        close: 'Close',
        delete: 'Delete',
        confirm: 'Confirm',
        warning: 'Warning',
        prompt: 'Prompt',
        dangerOperation: 'Dangerous operation',
        apply: 'Apply',
        rename: 'Rename',
        perspective: 'Perspective',
        orthographic: 'Orthographic'
    },
    routes: {
        editorTitle: '3D Editor',
        previewTitle: 'Preview'
    },
    project: {
        untitledName: 'Untitled project',
        savedLocal: 'Project saved locally.',
        saveFailed: 'Save failed: {message}',
        noSavedProject: 'No saved project found.',
        loaded: 'Project loaded.',
        loadFailed: 'Load failed: {message}'
    },
    panels: {
        inspector: 'Inspector',
        components: 'Components',
        sceneTree: 'Scene tree',
        variables: 'Variables',
        properties: 'Properties',
        events: 'Events',
        data: 'Data',
        settings: 'Settings',
        ai: 'AI'
    },
    tabs: {
        scrollPrev: 'Scroll backward',
        scrollNext: 'Scroll forward'
    },
    canvas: {
        releaseToAdd: 'Release to add',
        cancel: 'Cancel',
        repick: 'Pick again',
        finish: 'Finish',
        trajectoryPickingTitle: 'Trajectory picking: {name}',
        trajectoryPickingSub: 'Click the scene to pick points. Press Esc to cancel. {count} point(s) added.',
        alarmPrompt: 'Alarm',
        severity: 'Severity: {severity}',
        close: 'Close',
        sceneInitFailed: 'Scene initialization failed',
        retry: 'Retry',
        moveTitle: 'Move (W)',
        rotateTitle: 'Rotate (E)',
        scaleTitle: 'Scale (R)',
        componentsCount: 'Components {count}',
        lockedCannotAddPoint: 'The component is locked. Cannot add points.',
        lockedCannotDeletePoint: 'The component is locked. Cannot delete points.',
        sceneNotReadyDrop: 'The scene is not initialized. Cannot place a component on the canvas.',
        componentAdded: 'Component added: {name}',
        dataCityAdded: 'Data city added: {name}',
        modelFallbackName: 'Model'
        ,
        sceneLoading: 'Loading scene...',
        modelLoadingCount: 'Loading models ({count})...{progress}',
        modelLoadingNamed: '{name} loading...{progress}',
        localModelFiles: 'Local model files',
        localModelFilesCount: 'Local model files ({count} files)',
        localModelDropHint: 'Release to detect model files (GLB / GLTF / FBX)',
        modelAsset: 'Model: {url}',
        splatAsset: 'Splat: {url}',
        resourceAsset: 'Asset: {url}',
        selectMesh: 'Select Mesh',
        selectMeshNamed: 'Select Mesh: {name}',
        quickAddPoint: 'Quick add point',
        deletePoint: 'Delete point',
        meshSelected: 'Selected Mesh: {name}',
        pickMeshHint: 'Click a model Mesh in the scene to select it.',
        invalidPoint: 'No valid coordinate was found. Cannot add point.',
        pointAdded: 'Point added.',
        selectPointFirst: 'Right-click or select a point first.',
        pointNotFound: 'The point does not exist or has been deleted.',
        pointDeleted: 'Point deleted.',
        quickActionFailed: 'Quick action failed.',
        unsupportedLocalModelFile: 'Drop a .glb, .gltf, or .fbx model file.',
        localModelName: 'Local model',
        localModelLoaded: 'Local model loaded: {name}',
        modelAdded: 'Model added: {name}',
        splatAdded: 'Gaussian splat added: {name}',
        unsupportedDropAsset: 'Only model, splat, or GeoJSON assets can be dropped onto the canvas.',
        dropCreateFailed: 'Drop creation failed: {message}',
        trafficPickingTitle: 'Picking: {name}',
        trafficPickedTitle: 'Picked: {name}',
        trafficPickSurfaceHint: 'Click a model or Gaussian splat surface to pick a point. Press Esc to cancel.',
        trafficPickConfirmHint: 'Waiting to confirm coordinate write. You can pick again.',
        meshPickEventTarget: 'Picking event target',
        meshPickEyedropper: 'Eyedropper picking',
        meshPickSub: 'Click a model Mesh in the scene to select it. Press Esc to cancel.'
    },
    propertyEditor: {
        selectComponent: 'Select a component to edit properties'
    },
    toolbar: {
        historyActions: 'History actions',
        undoTitle: 'Undo (Ctrl+Z)',
        redoTitle: 'Redo (Ctrl+Y)',
        saveProjectTitle: 'Save project (Ctrl+S)',
        closeEditorTitle: 'Close editor',
        unsavedChanges: 'Unsaved changes',
        savedAt: 'Saved {time}',
        waitingSave: 'Waiting to save',
        cameraManager: 'Camera manager',
        buildingManager: 'Point manager',
        camera: 'Camera',
        points: 'Points',
        panelDisplay: 'Panel display',
        toggleLeftPanel: 'Toggle left panel',
        toggleRightPanel: 'Toggle right panel',
        leftPanel: 'Left',
        rightPanel: 'Right',
        previewProject: 'Preview project',
        preview: 'Preview',
        projectSettings: 'Project settings',
        projectName: 'Project name',
        projectNamePlaceholder: 'Enter project name',
        apiBaseUrl: 'API base URL prefix',
        apiBaseUrlHint: 'Relative paths in data access are automatically prefixed with this value.',
        sceneInteractionEvents: 'Scene interaction events',
        enableSceneInteractions: 'Enable click, hover, and other interaction events inside the 3D scene.',
        sceneInteractionHint: 'When disabled, clicks or hovers on 3D models will not trigger interaction effects.',
        saveCurrentView: 'Save current view',
        noCameraViews: 'No camera views yet. Adjust the scene camera, then click "Save current view".',
        viewName: 'View {index}',
        cameraNotReady: 'The current scene camera is not ready, so the view cannot be saved.',
        viewSaved: 'Saved {name}',
        viewApplied: 'Applied {name}',
        renameViewPrompt: 'Enter a new camera view name',
        emptyViewName: 'Camera view name cannot be empty.',
        viewNameUpdated: 'Camera view name updated.',
        deleteViewTitle: 'Delete camera view',
        deleteViewMessage: 'Delete camera view "{name}"?',
        viewDeleted: 'Camera view deleted.',
        settingsSaved: 'Project settings saved.',
        undoFailed: 'Undo failed. Check the console.',
        redoFailed: 'Redo failed. Check the console.',
        projectSaved: 'Project saved.',
        closeUnsavedTitle: 'Close editor',
        closeUnsavedMessage: 'There are unsaved changes. Close anyway?',
        reloadUnsavedTitle: 'Reload project',
        reloadUnsavedMessage: 'There are unsaved changes. Reload the project anyway?',
        projectReloaded: 'Project reloaded.',
        importUnsavedTitle: 'Import project',
        importUnsavedMessage: 'There are unsaved changes. Import a project anyway?',
        projectImported: 'Project imported.',
        importFailed: 'Import failed. Check the JSON file format.',
        exportSuccess: 'Project exported as a JSON file.',
        exportFailed: 'Export failed. Check the console.',
        justNow: 'just now',
        minutesAgo: '{count} min ago',
        hoursAgo: '{count} hr ago'
    },
    componentLibrary: {
        searchPlaceholder: 'Search components...',
        empty: 'No components',
        all: 'All',
        exists: 'Exists',
        alreadyExistsTitle: '{name} already exists in the scene',
        alreadyExistsWarning: '{name} already exists in the scene. This component can only have one instance.',
        addFailed: 'Failed to add component: {message}',
        addToScene: 'Add to scene',
        viewDetails: 'View details',
        detailsTitle: 'Component details',
        detailsMessage: 'Name: {name}\nType: {type}\nDescription: {description}',
        categories: {
            loaders: 'Loaders',
            helpers: 'Helpers',
            lights: 'Lights',
            effects: 'Effects',
            animations: 'Animations',
            controls: 'Camera controls',
            markers: 'Markers',
            traffic: 'Traffic'
        },
        components: {
            ModelLoader: {
                name: 'Model loader',
                description: 'Load 3D models in GLTF, GLB, or FBX format.'
            },
            GaussianSplatLoader: {
                name: 'Gaussian splat',
                description: 'Load PLY, SPLAT, KSPLAT, or SPZ Gaussian splat assets.'
            },
            GeoJSONLoader: {
                name: 'Data city',
                description: 'Load GeoJSON city or administrative boundaries and generate an interactive 3D data city.'
            },
            GridHelper: {
                name: 'Grid helper',
                description: 'Display a grid helper in the scene.'
            },
            HDRLoader: {
                name: 'HDR environment map',
                description: 'Load an HDR environment map for the scene environment or background.'
            },
            ParticleSystem: {
                name: 'Particle system',
                description: 'Advanced particle system with dynamic emission and physics effects.'
            },
            Heatmap: {
                name: 'Heatmap',
                description: 'Render a soft glowing heat distribution from point data.'
            },
            AreaBlock: {
                name: 'Area block',
                description: 'Display 3D area blocks with walls, bases, borders, and cloud shader effects.'
            },
            PathAnimation: {
                name: 'Path animation',
                description: 'Move objects along a path with loop, ping-pong, and easing support.'
            },
            MultiPathAnimation: {
                name: 'Multi-path animation',
                description: 'Load models and render instances moving along multiple paths.'
            },
            CameraTour: {
                name: 'Camera tour',
                description: 'Run automated camera tours from multiple view presets.'
            },
            DeviceExplodedView: {
                name: 'Device exploded view',
                description: 'Explode device structures outward from a center point.'
            },
            PostProcessing: {
                name: 'Post processing',
                description: 'Manage Bloom, SSR, GTAO, SAO, SSAO, Pixel, DOF, Sobel, FXAA, and other effects.'
            },
            WeatherClouds: {
                name: 'Weather clouds',
                description: 'Dynamic sky cloud effects with volumetric and multi-layer mesh cloud modes.'
            },
            FlyControls: {
                name: 'Fly controls',
                description: 'Free-flight camera control mode.'
            },
            FirstPersonControls: {
                name: 'First-person controls',
                description: 'First-person camera control mode.'
            },
            CameraJump: {
                name: 'Camera jump',
                description: 'Jump the camera to a specified mesh, label, or point.'
            },
            ModelAnimation: {
                name: 'Model animation',
                description: 'Play animations embedded in a model.'
            },
            MigrationLine: {
                name: 'Migration line',
                description: 'Display animated migration effects between points in 3D space.'
            },
            Label3D: {
                name: '3D label',
                description: 'Render text as Canvas textures and display them as sprites in the 3D scene.'
            },
            MarkArea: {
                name: 'Marked area',
                description: 'Display a planar marked area in 3D space.'
            },
            MarkLine: {
                name: 'Marked line',
                description: 'Display a line connecting multiple points in 3D space.'
            },
            MarkPoint: {
                name: 'Marked point',
                description: 'Display point markers in 3D space.'
            },
            PointTypeMarkerManager: {
                name: 'Multi-type point manager',
                description: 'Manage model and image point types with instanced rendering optimization.'
            },
            CameraPointManager: {
                name: 'Camera point',
                description: 'Manage camera points in the scene with externally configured point styles.'
            },
            ExplodedView: {
                name: 'Floor exploded view',
                description: 'Floor exploded-view effect with floor selection, highlighting, and animation.'
            },
            WeatherLighting: {
                name: 'Weather and lighting',
                description: 'Online weather, manual weather switching, sun-position lighting, and night road-light linkage.'
            },
            TrafficRoadsideDeviceManager: {
                name: 'Roadside device manager',
                description: 'Manage road networks, road facilities, poles, and mounted roadside devices.'
            }
        }
    }
};
