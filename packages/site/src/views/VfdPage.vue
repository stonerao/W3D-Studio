<script setup>
const capabilityGroups = [
    {
        title: '页面编排',
        text: '支持大屏、驾驶舱和多页面组织。'
    },
    {
        title: '三维表达',
        text: '构建设备、空间和园区三维场景。'
    },
    {
        title: '组态展示',
        text: '配置流程画面与设备状态展示。'
    },
    {
        title: '数据绑定',
        text: '接入接口、实时流和业务数据。'
    },
    {
        title: '联动控制',
        text: '支持跳转、弹窗、筛选和联动。'
    },
    {
        title: '发布部署',
        text: '支持预览、发布、嵌入和部署。'
    }
]

const highlights = [
    '拖拽式搭建，降低制作成本',
    '2D、3D、组态一体化',
    '支持多页面项目组织和跨页面联动',
    '适合展示、监控、分析与调度',
    '支持模板、组件和自定义扩展',
    '支持和现有系统协同部署'
]
</script>

<template>
  <section class="section page-hero">
    <p class="eyebrow">Product</p>
    <h1>为复杂业务场景准备的一体化可视化能力</h1>
    <p class="lead">
      平台把页面、场景、数据和联动组织在同一工作流中，适合长期演进的可视化项目。
    </p>
  </section>

  <section class="section">
    <div class="section-head">
      <p class="eyebrow">Modules</p>
      <h2>核心能力模块</h2>
    </div>
    <div class="capability-grid">
      <article v-for="item in capabilityGroups" :key="item.title" class="capability-item">
        <h3>{{ item.title }}</h3>
        <p>{{ item.text }}</p>
      </article>
    </div>
  </section>

  <section class="section dual-panel">
    <article class="panel">
      <p class="eyebrow">Workflow</p>
      <h2>把搭建过程压缩成更短的交付路径</h2>
      <p>
        从布局到发布集中在同一界面内完成，减少切换成本。
      </p>
    </article>
    <article class="panel">
      <p class="eyebrow">Advantage</p>
      <h2>适合标准化沉淀，也保留扩展空间</h2>
      <p>
        既适合模板复用，也保留自定义扩展空间。
      </p>
    </article>
  </section>

  <section class="section">
    <div class="section-head">
      <p class="eyebrow">Highlights</p>
      <h2>适合平台化建设的能力特征</h2>
    </div>
    <ul class="feature-list">
      <li v-for="item in highlights" :key="item">{{ item }}</li>
    </ul>
  </section>

  <section class="section final-cta">
    <p class="eyebrow">Experience</p>
    <h2>直接进入体验环境，查看搭建与发布链路</h2>
    <div class="hero-actions">
      <RouterLink to="/experience" class="btn btn-primary">前往体验</RouterLink>
    </div>
  </section>
</template>
