import { createRouter, createWebHistory } from 'vue-router';
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      component: () => import('@/modules/auth/LoginPage.vue'),
      meta: { title: '登录', public: true },
    },
    { path: '/', redirect: '/questions' },
    {
      path: '/questions/:id?',
      component: () => import('@/modules/cloud/QuestionsPage.vue'),
      meta: { title: '我的题库' },
    },
    {
      path: '/reading/:id?',
      component: () => import('@/modules/cloud/QuestionsPage.vue'),
      meta: { title: '沉浸题库', immersive: true },
    },
    // Keep old bookmarks usable without exposing the removed pages.
    { path: '/experiences', redirect: () => ({ path: '/questions', query: {}, hash: '' }) },
    { path: '/reviews', redirect: () => ({ path: '/questions', query: {}, hash: '' }) },
    {
      path: '/settings',
      component: () => import('@/modules/cloud/SettingsPage.vue'),
      meta: { title: '数据管理', admin: true },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/shared/components/NotFoundPage.vue'),
      meta: { title: '页面不存在' },
    },
  ],
  scrollBehavior: (to, from) =>
    ['/questions', '/reading'].some(
      (base) => to.path.startsWith(base) && from.path.startsWith(base),
    )
      ? undefined
      : { top: 0 },
});
router.afterEach((to) => {
  document.title = String(to.meta.title || '面经台') + ' · Mianjing Desk';
});
