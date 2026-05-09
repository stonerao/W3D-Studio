/**
 * @w3d/components - W3D 内置组件库
 *
 * @version 2.0.0
 * @author W3D Team
 * @license MIT
 */

// 加载器组件
export { ModelLoader } from './loaders/ModelLoader/index.js';
export { GeoJSONLoader } from './loaders/GeoJSONLoader/index.js';
export { GaussianSplatLoader } from './loaders/GaussianSplatLoader/index.js';
export { TextureLoader } from './loaders/TextureLoader/index.js';
export { HDRLoader } from './loaders/HDRLoader/index.js';
export { DXFLoader } from './loaders/DXFLoader/index.js';

// 动画组件
export { PathAnimation } from './animation/PathAnimation/index.js';
export { MultiPathAnimation } from './animation/MultiPathAnimation/index.js';
export { TrajectoryMove } from './animation/TrajectoryMove/index.js';
export { CameraAnimation } from './animation/CameraAnimation/index.js';
export { CameraTour } from './animation/CameraTour/index.js';
export { CameraJump } from './animation/CameraJump/index.js';
export { ModelAnimation } from './animation/ModelAnimation/index.js';
export { MigrationLine } from './animation/MigrationLine/index.js';

// 标注组件
export { MarkPoint } from './markers/MarkPoint/index.js';
export { MarkLine } from './markers/MarkLine/index.js';
export { MarkArea } from './markers/MarkArea/index.js';
export { Label3D } from './markers/Label3D/index.js';
export { PointTypeMarkerManager } from './markers/PointTypeMarkerManager/index.js';
export { CameraPointManager } from './markers/CameraPointManager/index.js';

// 点位组件
export { ImageMarker } from './marker/ImageMarker/index.js';

// 区域组件
export { AreaBlock } from './area/AreaBlock/index.js';

// 特效组件
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

// 控制组件
export { FirstPersonControls } from './controls/FirstPersonControls/index.js';
export { FlyControls } from './controls/FlyControls/index.js';
export { TransformControls } from './controls/TransformControls/index.js';
export { DeviceFocusController } from './controls/DeviceFocusController/index.js';

// 辅助组件
export { GridHelper } from './helpers/GridHelper/index.js';
export { AxesHelper } from './helpers/AxesHelper/index.js';
export { BoundingBoxHelper } from './helpers/BoundingBoxHelper/index.js';

// 空间查询组件
export { BVHQuery } from './spatial/BVHQuery/index.js';

// 几何体组件
export { ExtrudedPolygon } from './geometry/ExtrudedPolygon/index.js';
export { InstancedModel } from './geometry/InstancedModel/index.js';
export { Mesh } from './geometry/Mesh/index.js';

// 材质组件
export { ShaderMaterial } from './material/ShaderMaterial/index.js';

// 编辑器组件
export { BuildingEditor } from './editors/BuildingEditor/index.js';

// 交通组件
export { TrafficRoadsideDeviceManager } from './traffic/TrafficRoadsideDeviceManager/index.js';
export {
    GEO_FIT_METHODS,
    createTrafficGeoCoordinateTransformer,
    getGeoFitMethodLabel,
    normalizeGeoControlPoint,
    normalizeTrafficCoordinateSystemConfig,
    solveTrafficGeoCoordinateFit
} from './traffic/TrafficRoadsideDeviceManager/index.js';

// 组件可调用方法元数据
export {
    DEFAULT_COMPONENT_METHOD_DEFINITIONS,
    normalizeComponentMethodDefinitions,
    extractComponentMethodDefinitions
} from './utils/componentMethods.js';
