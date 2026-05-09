<script setup>
const ecoItems = [
    {
        title: '模板体系',
        text: '沉淀行业页面、布局和场景模板。'
    },
    {
        title: '组件扩展',
        text: '接入自定义组件和交互模块。'
    },
    {
        title: '场景资产',
        text: '统一管理模型、贴图和流程资产。'
    },
    {
        title: '脚本能力',
        text: '补充业务逻辑和联动规则。'
    },
    {
        title: '系统嵌入',
        text: '可独立使用，也可嵌入现有系统。'
    },
    {
        title: '交付协同',
        text: '适合实施、开发和业务团队协同。'
    }
]
</script>

<template>
  <section class="section page-hero">
    <p class="eyebrow">Ecosystem</p>
    <h1>在标准化平台之上，保留项目级扩展能力</h1>
    <p class="lead">
      平台支持模板化复用，也保留业务级扩展空间。
    </p>
  </section>

  <section class="section">
    <div class="capability-grid">
      <article v-for="item in ecoItems" :key="item.title" class="capability-item">
        <h3>{{ item.title }}</h3>
        <p>{{ item.text }}</p>
      </article>
    </div>
  </section>

  <section class="section dual-panel">
    <article class="panel">
      <p class="eyebrow">Standardization</p>
      <h2>先建立通用能力，再覆盖业务差异</h2>
      <p>
        先稳定通用能力，再用扩展机制覆盖业务差异。
      </p>
    </article>
    <article class="panel">
      <p class="eyebrow">Integration</p>
      <h2>避免成为孤立的展示层</h2>
      <p>
        与接口、业务系统和运行环境协同工作。
      </p>
    </article>
  </section>
</template>
