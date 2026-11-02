<script setup lang="ts">
import { computed, provide, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { NConfigProvider, NDialogProvider, NMessageProvider, zhCN, dateZhCN } from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';
import DeskLayout from '@/layouts/DeskLayout.vue';
import ReadingLayout from '@/layouts/ReadingLayout.vue';
import { useCatalog } from '@/modules/cloud/queries';
import { syncSession } from '@/modules/auth/session';

import { companyCatalogKey } from '@/shared/composables/useCompanyCatalog';
const { data } = useCatalog();
const route = useRoute();
provide(
  companyCatalogKey,
  computed(() => ({
    revision: 0,
    items: (data.value?.items || []).map((item) => ({ ...item, aliases: [] })),
  })),
);

const theme: GlobalThemeOverrides = {
  common: {
    primaryColor: '#0d7d78',
    primaryColorHover: '#0a635f',
    primaryColorPressed: '#075c58',
    primaryColorSuppl: '#0a635f',
    infoColor: '#0d7d78',
    infoColorHover: '#0a635f',
    infoColorPressed: '#075c58',
    infoColorSuppl: '#0a635f',
    successColor: '#15803d',
    successColorHover: '#166534',
    successColorPressed: '#14532d',
    successColorSuppl: '#166534',
    warningColor: '#b45309',
    warningColorHover: '#92400e',
    warningColorPressed: '#78350f',
    warningColorSuppl: '#92400e',
    errorColor: '#b42318',
    errorColorHover: '#912018',
    errorColorPressed: '#7a271a',
    errorColorSuppl: '#912018',
    borderRadius: '8px',
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    textColorBase: '#26334a',
    textColor1: '#0b1220',
    textColor2: '#26334a',
    textColor3: '#56657f',
    textColorDisabled: '#94a3b8',
    placeholderColor: '#56657f',
    placeholderColorDisabled: '#94a3b8',
    iconColor: '#56657f',
    iconColorHover: '#26334a',
    iconColorPressed: '#0b1220',
    iconColorDisabled: '#94a3b8',
    borderColor: '#dde4ee',
    dividerColor: '#dde4ee',
    bodyColor: '#eff3f8',
    baseColor: '#ffffff',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    inputColor: '#ffffff',
    inputColorDisabled: '#f5f8fc',
    tableColor: '#ffffff',
    tableHeaderColor: '#f5f8fc',
    tableColorHover: '#f5f8fc',
    tableColorStriped: '#f5f8fc',
    tagColor: '#f5f8fc',
    avatarColor: '#eaf0f8',
    codeColor: '#f5f8fc',
    actionColor: '#f5f8fc',
    hoverColor: '#e2f4f2',
    pressedColor: '#e2f4f2',
    fontSize: '13px',
  },
  Button: { fontWeight: '500' },
  Input: { boxShadowFocus: '0 0 0 2px rgb(13 125 120 / 20%)' },
  DataTable: {
    thColor: '#f5f8fc',
    thTextColor: '#56657f',
    tdTextColor: '#26334a',
    tdColorHover: '#f5f8fc',
    borderColor: '#dde4ee',
  },
};
onMounted(() => window.addEventListener('storage', syncSession));
onUnmounted(() => window.removeEventListener('storage', syncSession));
</script>

<template>
  <NConfigProvider :theme-overrides="theme" :locale="zhCN" :date-locale="dateZhCN">
    <NDialogProvider
      ><NMessageProvider
        ><RouterView v-if="route.meta.public" /><ReadingLayout
          v-else-if="route.meta.immersive" /><DeskLayout v-else /></NMessageProvider
    ></NDialogProvider>
  </NConfigProvider>
</template>
