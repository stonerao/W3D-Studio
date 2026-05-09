<script setup>
const values = [
    {
        title: '更快搭建',
        text: '拖拽编排与模块复用，缩短交付周期。'
    },
    {
        title: '更强表达',
        text: '统一承载 2D、3D 与组态画面。'
    },
    {
        title: '更稳落地',
        text: '支持发布、嵌入与持续迭代。'
    }
]

const capabilities = [
    {
        title: '页面编排',
        text: '快速搭建大屏、驾驶舱和业务页面。'
    },
    {
        title: '三维场景搭建',
        text: '构建设备、产线和园区三维表达。'
    },
    {
        title: '组态流程展示',
        text: '展示流程、设备状态和控制界面。'
    },
    {
        title: '数据源接入',
        text: '接入接口、实时数据和业务系统。'
    },
    {
        title: '交互与联动',
        text: '配置跳转、告警和组件联动。'
    },
    {
        title: '发布与嵌入',
        text: '支持独立访问和嵌入现有系统。'
    }
]

const workflows = [
    '新建项目或选择模板',
    '拖拽组件并完成页面布局',
    '搭建三维场景或组态画面',
    '接入接口与实时数据',
    '配置联动逻辑和告警规则',
    '预览发布并接入业务系统'
]

const scenarios = [
    {
        title: '智慧园区总览',
        text: '统一查看空间、设备和运行状态。'
    },
    {
        title: '工厂设备监控',
        text: '把产线设备和关键指标放进同一视图。'
    },
    {
        title: '能源运行分析',
        text: '展示能耗趋势和异常波动。'
    },
    {
        title: '指挥调度中心',
        text: '聚合多系统数据与调度信息。'
    }
]
</script>

<template>
  <section class="hero hero-home">
    <div class="hero-copy">
      <p class="eyebrow">Visualization Platform</p>
      <h1>让数据、空间与业务流程在一个界面里协同运行</h1>
      <p class="tagline">
        面向工业、园区、能源与运营场景，快速构建 2D 大屏、3D 场景与组态画面。
      </p>
      <div class="hero-actions">
        <RouterLink to="/experience" class="btn btn-primary">立即体验</RouterLink>
        <RouterLink to="/product" class="btn btn-outline">查看产品能力</RouterLink>
      </div>
      <p class="hero-note">在线搭建、数据接入、联动配置、发布部署</p>
    </div>

    <div class="hero-visual" aria-hidden="true">
      <div class="signal-grid"></div>
      <div class="signal-ring signal-ring-a"></div>
      <div class="signal-ring signal-ring-b"></div>
      <div class="signal-beam"></div>
      <div class="signal-panel">
        <span>Scene</span>
        <span>Flow</span>
        <span>Data</span>
        <span>Control</span>
      </div>
    </div>
  </section>

  <section class="section intro-strip">
    <p>
      从搭建到发布，统一在一个平台完成。
    </p>
  </section>

  <section class="section">
    <div class="section-head">
      <p class="eyebrow">Value</p>
      <h2>从表达复杂业务，到推动实时决策</h2>
    </div>
    <div class="value-grid">
      <article v-for="item in values" :key="item.title" class="value-item">
        <h3>{{ item.title }}</h3>
        <p>{{ item.text }}</p>
      </article>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <p class="eyebrow">Capabilities</p>
      <h2>覆盖可视化项目的完整能力链路</h2>
    </div>
    <div class="capability-grid">
      <article v-for="item in capabilities" :key="item.title" class="capability-item">
        <h3>{{ item.title }}</h3>
        <p>{{ item.text }}</p>
      </article>
    </div>
  </section>

  <section class="section workflow-section">
    <div class="section-head">
      <p class="eyebrow">Workflow</p>
      <h2>用清晰的流程，组织复杂的可视化建设</h2>
    </div>
    <ol class="workflow-list">
      <li v-for="item in workflows" :key="item">{{ item }}</li>
    </ol>
  </section>

  <section class="section">
    <div class="section-head">
      <p class="eyebrow">Scenarios</p>
      <h2>适配多种真实业务场景</h2>
    </div>
    <div class="scenario-grid">
      <article v-for="item in scenarios" :key="item.title" class="scenario-item">
        <h3>{{ item.title }}</h3>
        <p>{{ item.text }}</p>
      </article>
    </div>
  </section>

  <section class="section final-cta">
    <p class="eyebrow">Start Now</p>
    <h2>把业务数据组织成真正可用的可视化界面</h2>
    <p>
      适用于展示、监控、分析和调度场景。
    </p>
    <div class="hero-actions">
      <RouterLink to="/experience" class="btn btn-primary">进入体验环境</RouterLink>
    </div>
  </section>
</template>
