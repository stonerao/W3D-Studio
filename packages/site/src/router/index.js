import { createRouter, createWebHistory } from 'vue-router'

import HomePage from '../views/HomePage.vue'
import ComponentsPage from '../views/ComponentsPage.vue'
import RoadmapPage from '../views/RoadmapPage.vue'
import VfdPage from '../views/VfdPage.vue'
import EntryPage from '../views/EntryPage.vue'

const routes = [
    {
        path: '/',
        name: 'home',
        component: HomePage,
        meta: { title: '可视化平台' }
    },
    {
        path: '/product',
        alias: ['/sdk', '/view', '/vfd'],
        name: 'product',
        component: VfdPage,
        meta: { title: '产品能力 - 可视化平台' }
    },
    {
        path: '/scenarios',
        alias: ['/roadmap'],
        name: 'scenarios',
        component: RoadmapPage,
        meta: { title: '行业场景 - 可视化平台' }
    },
    {
        path: '/ecosystem',
        alias: ['/components'],
        name: 'ecosystem',
        component: ComponentsPage,
        meta: { title: '生态扩展 - 可视化平台' }
    },
    {
        path: '/experience',
        alias: ['/go/:target(vfd|config)'],
        name: 'experience',
        component: EntryPage,
        meta: { title: '立即体验 - 可视化平台' }
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.afterEach((to) => {
    if (to.meta?.title) {
        document.title = to.meta.title
    }
})

export default router
