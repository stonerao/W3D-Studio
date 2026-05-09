import { createRouter, createWebHistory } from 'vue-router';

const EditorPage = () => import('../views/EditorPage.vue');
const PreviewPage = () => import('../views/PreviewPage.vue');

const routes = [
    {
        path: '/',
        redirect: '/editor'
    },
    {
        path: '/editor',
        name: 'Editor',
        component: EditorPage,
        meta: {
            title: '三维编辑器'
        }
    },
    {
        path: '/preview',
        name: 'Preview',
        component: PreviewPage,
        meta: {
            title: '预览'
        }
    },
    {
        path: '/:pathMatch(.*)*',
        redirect: '/editor'
    }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
});

router.beforeEach((to) => {
    if (to.meta.title) {
        document.title = `${to.meta.title} - W3D Editor`;
    }
});

export default router;
