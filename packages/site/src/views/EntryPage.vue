<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const targetConfig = {
    vfd: {
        label: '平台体验环境',
        desc: '体验页面搭建、数据绑定与发布链路。',
        url: 'http://editor.mogl.top/'
    },
    config: {
        label: '组态编辑器',
        desc: '面向工业场景的流程与设备搭建入口。',
        url: 'http://mogl.top:8003/'
    }
}

const target = computed(() => targetConfig[route.params.target] || targetConfig.vfd)
</script>

<template>
  <div v-if="target" class="entry-page">
    <p class="eyebrow">Experience</p>
    <h1>{{ target.label }}</h1>
    <p class="desc">{{ target.desc }}</p>

    <div class="experience-card">
      <div>
        <p class="experience-label">体验账号</p>
        <p>用户名：<code>editor</code></p>
        <p>密码：<code>editor</code></p>
      </div>

      <div class="experience-actions">
        <a :href="target.url" target="_blank" rel="noreferrer" class="btn btn-primary">立即打开</a>
        <p class="experience-link">
          访问地址：
          <a :href="target.url" target="_blank" rel="noreferrer">{{ target.url }}</a>
        </p>
      </div>
    </div>
  </div>
</template>
