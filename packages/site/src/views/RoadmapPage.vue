<script setup>
const scenarios = [
    {
        title: '工业制造',
        text: '统一查看设备、产线和告警状态。'
    },
    {
        title: '智慧园区',
        text: '汇聚空间、环境、设备和安防数据。'
    },
    {
        title: '能源电力',
        text: '展示能耗、负载和异常趋势。'
    },
    {
        title: '指挥调度',
        text: '汇聚多系统数据与调度信息。'
    },
    {
        title: '经营驾驶舱',
        text: '集中呈现经营指标和趋势变化。'
    }
]
</script>

<template>
  <section class="section page-hero">
    <p class="eyebrow">Scenarios</p>
    <h1>覆盖展示、监控、分析与调度的核心场景</h1>
    <p class="lead">
      面向多种业务环境，组织页面、场景和交互表达。
    </p>
  </section>

  <section class="section">
    <div class="scenario-grid">
      <article v-for="item in scenarios" :key="item.title" class="scenario-item scenario-item-wide">
        <h2>{{ item.title }}</h2>
        <p>{{ item.text }}</p>
      </article>
    </div>
  </section>

  <section class="section dual-panel">
    <article class="panel">
      <p class="eyebrow">Use Case</p>
      <h2>适合需要持续迭代的项目</h2>
      <p>
        适合需要长期运行、持续扩展和多角色协作的项目。
      </p>
    </article>
    <article class="panel">
      <p class="eyebrow">Delivery</p>
      <h2>既能快速上线，也能沉淀行业模板</h2>
      <p>
        在交付过程中沉淀模板、组件和配置资产。
      </p>
    </article>
  </section>
</template>
