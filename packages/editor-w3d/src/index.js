/**
 * W3D Editor 组件导出
 *
 * @description 导出编辑器与预览组件，供外部集成使用
 */

// 组件样式入口（供外部项目引入时生效）
import './styles/main.css';

export { default as W3DEditor } from './components/layout/EditorLayout.vue';
export { default as W3DViewer } from './views/Preview.vue';
export { getComponentMethodDefinitions } from './utils/componentRegistry';

// 兼容默认导出
import App from './App.vue';
export default App;
