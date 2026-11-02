import type { Router } from 'vue-router';
import { checkSession, identity, onSessionLost } from './session';
export function installAuthGuards(router: Router) {
  router.beforeEach(async (to) => {
    if (to.meta.public) return true;
    try {
      await checkSession();
    } catch {
      /* A failed verification returns to login. */
    }
    if (!identity.value) return { path: '/login', query: { returnTo: to.fullPath } };
    if (to.meta.admin && !identity.value.canEdit) return '/questions';
    return true;
  });
  onSessionLost(() => {
    const route = router.currentRoute.value;
    if (!identity.value && !route.meta.public)
      void router.replace({ path: '/login', query: { returnTo: route.fullPath } });
    else if (identity.value && route.meta.admin && !identity.value.canEdit)
      void router.replace('/questions');
  });
}
