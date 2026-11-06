<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { BookOpen, Settings2, Menu, X } from 'lucide-vue-next';

const route = useRoute();
const mobileOpen = ref(false);
const brandIcon = `${import.meta.env.BASE_URL}favicon.svg?v=mono`;
import { canEdit } from '@/modules/auth/session';
import SessionActions from '@/modules/auth/SessionActions.vue';
const links = computed(() => [
  { to: '/questions', label: '我的题库', icon: BookOpen },
  ...(canEdit.value ? [{ to: '/settings', label: '数据管理', icon: Settings2 }] : []),
]);
</script>

<template>
  <div class="desk-shell">
    <button
      v-if="mobileOpen"
      class="mobile-mask"
      aria-label="关闭导航"
      @click="mobileOpen = false"
    ></button>
    <aside class="sidebar" :class="{ 'is-open': mobileOpen }">
      <RouterLink class="brand" to="/questions" @click="mobileOpen = false">
        <img :src="brandIcon" width="37" height="37" alt="" />
        <span>面经台</span>
      </RouterLink>
      <nav id="primary-navigation" class="primary-nav" aria-label="主导航">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :class="{ active: route.path.startsWith(link.to) }"
          @click="mobileOpen = false"
        >
          <component :is="link.icon" :size="18" :stroke-width="1.7" />
          <span>{{ link.label }}</span>
        </RouterLink>
      </nav>
      <SessionActions style="margin: auto 20px 24px" />
    </aside>
    <main class="main-shell">
      <header class="mobile-topbar">
        <button
          class="icon-button"
          :aria-label="mobileOpen ? '关闭导航' : '打开导航'"
          :aria-expanded="mobileOpen"
          aria-controls="primary-navigation"
          @click="mobileOpen = !mobileOpen"
        >
          <Menu v-if="!mobileOpen" :size="20" /><X v-else :size="20" />
        </button>
        <span>面经台</span>
      </header>
      <div class="page-container"><RouterView /></div>
    </main>
  </div>
</template>
