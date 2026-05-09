import { createRouter, createWebHistory } from 'vue-router';
import { t } from '../i18n';

const EditorPage = () => import('../views/EditorPage.vue');
const PreviewPage = () => import('../views/PreviewPage.vue');
const APP_NAME = 'W3D Studio';

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
            titleKey: 'routes.editorTitle'
        }
    },
    {
        path: '/preview',
        name: 'Preview',
        component: PreviewPage,
        meta: {
            titleKey: 'routes.previewTitle'
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

const updateDocumentTitle = (route) => {
    const titleKey = route?.meta?.titleKey;
    if (titleKey) {
        document.title = `${t(titleKey)} - ${APP_NAME}`;
    }
};

router.beforeEach((to) => {
    updateDocumentTitle(to);
});

if (typeof window !== 'undefined') {
    window.addEventListener('w3d:locale-change', () => {
        updateDocumentTitle(router.currentRoute.value);
    });
}

export default router;
