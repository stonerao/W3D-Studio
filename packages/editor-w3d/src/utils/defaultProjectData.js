export function createDefaultProjectData(name = '未命名项目') {
    return {
        schemaVersion: 1,
        version: '1.0.0',
        name,
        apiBaseUrl: 'http://localhost:3000/',
        savedAt: new Date().toISOString(),
        scene: {
            renderer: {
                antialias: true,
                outputColorSpace: 'srgb',
                shadowEnabled: true
            },
            camera: {
                type: 'perspective',
                fov: 45,
                near: 0.1,
                far: 10000,
                position: [10, 8, 15],
                lookAt: [0, 0, 0]
            },
            controls: {
                enableDamping: true,
                dampingFactor: 0.05,
                enableZoom: true,
                enableRotate: true,
                enablePan: true,
                autoRotate: false,
                autoRotateSpeed: 2,
                minDistance: 1,
                maxDistance: 1000
            },
            lighting: {
                ambient: {
                    enabled: true,
                    color: '#ffffff',
                    intensity: 0.6
                },
                directional: {
                    enabled: true,
                    color: '#ffffff',
                    intensity: 0.8,
                    position: [10, 10, 5],
                    castShadow: true
                }
            },
            background: {
                type: 'color',
                color: '#151a2b',
                gradientTop: '#87ceeb',
                gradientBottom: '#ffffff',
                imageUrl: '',
                hdrUrl: '/textures/blouberg_sunrise_2_1k.hdr'
            },
            helpers: {
                grid: {
                    enabled: true,
                    size: 200,
                    divisions: 30,
                    color: '#888888',
                    hideInPreview: true
                },
                axes: {
                    enabled: false,
                    size: 5
                }
            },
            loading: {
                enabled: true,
                effect: 'spinner'
            }
        },
        components: [],
        variables: [],
        dataSourceConfig: null,
        alarmRules: [],
        trendState: null,
        ui: {
            cameraViews: [],
            currentCameraViewId: null,
            buildingPoints: [],
            buildingPointCoordinateSystem: {
                mode: 'xyz',
                originLngLatAlt: [0, 0, 0],
                axis: 'xEast_yUp_zNorth',
                fitting: {
                    method: 'none',
                    controlPoints: []
                }
            },
            largeSceneGovernance: {}
        }
    };
}
