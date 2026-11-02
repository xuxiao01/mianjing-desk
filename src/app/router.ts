import { createRouter, createWebHistory } from 'vue-router';
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/questions' },
    {
      path: '/questions/:id?',
      component: () => import('@/modules/questions/QuestionsPage.vue'),
      meta: { title: '我的题库' },
    },
    {
      path: '/reading/:id?',
      component: () => import('@/modules/questions/QuestionsPage.vue'),
      meta: { title: '沉浸题库', immersive: true },
    },
    // Keep old bookmarks usable without exposing the removed pages.
    { path: '/experiences', redirect: () => ({ path: '/questions', query: {}, hash: '' }) },
    { path: '/reviews', redirect: () => ({ path: '/questions', query: {}, hash: '' }) },
    {
      path: '/settings',
      component: () => import('@/modules/settings/SettingsPage.vue'),
      meta: { title: '数据管理' },
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
