const fs = require('fs');
const path = require('path');

const categories = [
  { keyName: 'Charts', displayName: '图表', icon: 'chart', sortOrder: 1 },
  { keyName: 'Informations', displayName: '信息', icon: 'info', sortOrder: 2 },
  { keyName: 'Tables', displayName: '表格', icon: 'table', sortOrder: 3 },
  { keyName: 'Decorates', displayName: '装饰', icon: 'decorate', sortOrder: 4 },
  { keyName: 'Icons', displayName: '图标', icon: 'icon', sortOrder: 5 },
  { keyName: 'Webgl', displayName: 'Webgl', icon: 'cube', sortOrder: 6 },
  { keyName: 'Basics', displayName: '基础', icon: 'basic', sortOrder: 7 },
  { keyName: 'WebInteraction', displayName: 'Web交互', icon: 'interaction', sortOrder: 8 },
  { keyName: 'CustomComponents', displayName: '自定义组件', icon: 'custom', sortOrder: 9 },
];

const backendRoot = path.resolve(__dirname, '..');
const componentsRoot = process.env.COMPONENTS_SOURCE_ROOT || path.resolve(backendRoot, '..', 'vfd', 'src', 'packages', 'components');
const outputFile = process.env.COMPONENT_CONFIG_OUT || path.resolve(backendRoot, 'public', 'component-config.json');
const validConfigNames = new Set(['config.ts', 'config.js', 'config.mjs', 'config.cjs']);

function collectConfigFiles(dirPath) {
  const result = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectConfigFiles(fullPath));
      continue;
    }

    if (entry.isFile() && validConfigNames.has(entry.name)) {
      result.push(fullPath);
    }
  }

  return result;
}

function buildPayload() {
  if (!fs.existsSync(componentsRoot)) {
    throw new Error(`组件源码目录不存在: ${componentsRoot}`);
  }

  const components = [];

  for (const category of categories) {
    const categoryPath = path.join(componentsRoot, category.keyName);
    if (!fs.existsSync(categoryPath)) {
      continue;
    }

    const files = collectConfigFiles(categoryPath);
    const keys = [...new Set(files.map((file) => path.basename(path.dirname(file))))].sort();

    keys.forEach((keyName, index) => {
      components.push({
        keyName,
        parentKey: category.keyName,
        displayName: keyName,
        sortOrder: index + 1,
      });
    });
  }

  return {
    categories,
    components,
  };
}

function main() {
  const payload = buildPayload();
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`[component-config] source: ${componentsRoot}`);
  console.log(`[component-config] output: ${outputFile}`);
  console.log(`[component-config] categories: ${payload.categories.length}, components: ${payload.components.length}`);
}

main();
