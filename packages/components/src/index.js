/**
 * Public component module exports grouped by W3D feature area.
 */

// Loader components for importing scene assets and external resource formats.
export { ModelLoader } from './loaders/ModelLoader/index.js';
export { GeoJSONLoader } from './loaders/GeoJSONLoader/index.js';
export { GaussianSplatLoader } from './loaders/GaussianSplatLoader/index.js';
export { TextureLoader } from './loaders/TextureLoader/index.js';
export { HDRLoader } from './loaders/HDRLoader/index.js';
export { DXFLoader } from './loaders/DXFLoader/index.js';

// Animation components for camera, model, route, and timeline-driven scene motion.
export { PathAnimation } from './animation/PathAnimation/index.js';
export { MultiPathAnimation } from './animation/MultiPathAnimation/index.js';
export { TrajectoryMove } from './animation/TrajectoryMove/index.js';
export { CameraAnimation } from './animation/CameraAnimation/index.js';
export { CameraTour } from './animation/CameraTour/index.js';
export { CameraJump } from './animation/CameraJump/index.js';
export { ModelAnimation } from './animation/ModelAnimation/index.js';
export { MigrationLine } from './animation/MigrationLine/index.js';

// Marker components for points, lines, areas, labels, and camera-position annotations.
export { MarkPoint } from './markers/MarkPoint/index.js';
export { MarkLine } from './markers/MarkLine/index.js';
export { MarkArea } from './markers/MarkArea/index.js';
export { Label3D } from './markers/Label3D/index.js';
export { PointTypeMarkerManager } from './markers/PointTypeMarkerManager/index.js';
export { CameraPointManager } from './markers/CameraPointManager/index.js';

// Image marker components for billboard-style visual anchors.
export { ImageMarker } from './marker/ImageMarker/index.js';

// Area components for polygonal regions and extruded business blocks.
export { AreaBlock } from './area/AreaBlock/index.js';

// Effects components for environmental, rendering, weather, model, and visual feedback effects.
export { ParticleSystem } from './effects/ParticleSystem/index.js';
export { Heatmap } from './effects/Heatmap/index.js';
export { WaterEffect } from './effects/WaterEffect/index.js';
export { Ocean } from './effects/Ocean/index.js';
export { FireEffect } from './effects/FireEffect/index.js';
export { Pipeline } from './effects/Pipeline/index.js';
export { PathTracer } from './effects/PathTracer/index.js';
export { PostProcessing } from './effects/PostProcessing/index.js';
export { Weather } from './effects/Weather/index.js';
export { WeatherClouds } from './effects/WeatherClouds/index.js';
export { ExplodedView } from './effects/ExplodedView/index.js';
export { DeviceExplodedView } from './effects/DeviceExplodedView/index.js';
export { EnvironmentEffect } from './effects/EnvironmentEffect/index.js';
export { ModelEffect } from './effects/ModelEffect/index.js';
export { WeatherLighting } from './effects/WeatherLighting/index.js';

// Control components for camera navigation, transform handles, and device focus.
export { FirstPersonControls } from './controls/FirstPersonControls/index.js';
export { FlyControls } from './controls/FlyControls/index.js';
export { TransformControls } from './controls/TransformControls/index.js';
export { DeviceFocusController } from './controls/DeviceFocusController/index.js';

// Helper components for scene orientation and object inspection.
export { GridHelper } from './helpers/GridHelper/index.js';
export { AxesHelper } from './helpers/AxesHelper/index.js';
export { BoundingBoxHelper } from './helpers/BoundingBoxHelper/index.js';

// Spatial query components for accelerated picking and collision workflows.
export { BVHQuery } from './spatial/BVHQuery/index.js';

// Geometry components for generated meshes and high-volume model instances.
export { ExtrudedPolygon } from './geometry/ExtrudedPolygon/index.js';
export { InstancedModel } from './geometry/InstancedModel/index.js';
export { Mesh } from './geometry/Mesh/index.js';

// Material components for shader-driven rendering presets.
export { ShaderMaterial } from './material/ShaderMaterial/index.js';

// Editor components for building-point editing workflows.
export { BuildingEditor } from './editors/BuildingEditor/index.js';

// Traffic components for roadside devices and geospatial alignment helpers.
export { TrafficRoadsideDeviceManager } from './traffic/TrafficRoadsideDeviceManager/index.js';
export {
    GEO_FIT_METHODS,
    createTrafficGeoCoordinateTransformer,
    getGeoFitMethodLabel,
    normalizeGeoControlPoint,
    normalizeTrafficCoordinateSystemConfig,
    solveTrafficGeoCoordinateFit
} from './traffic/TrafficRoadsideDeviceManager/index.js';

// Component utility exports shared by SDK component metadata and method definitions.
export {
    DEFAULT_COMPONENT_METHOD_DEFINITIONS,
    normalizeComponentMethodDefinitions,
    extractComponentMethodDefinitions
} from './utils/componentMethods.js';
