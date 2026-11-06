<script setup lang="ts">
import { computed, provide, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { NConfigProvider, NDialogProvider, NMessageProvider, zhCN, dateZhCN } from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';
import { palette } from '@/styles/palette';
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
    primaryColor: palette['primary'],
    primaryColorHover: palette['primary-hover'],
    primaryColorPressed: palette['primary-pressed'],
    primaryColorSuppl: palette['primary-hover'],
    infoColor: palette['primary'],
    infoColorHover: palette['primary-hover'],
    infoColorPressed: palette['primary-pressed'],
    infoColorSuppl: palette['primary-hover'],
    successColor: palette['success'],
    successColorHover: '#166534',
    successColorPressed: '#14532d',
    successColorSuppl: '#166534',
    warningColor: palette['warning'],
    warningColorHover: '#92400e',
    warningColorPressed: '#78350f',
    warningColorSuppl: '#92400e',
    errorColor: palette['danger'],
    errorColorHover: '#912018',
    errorColorPressed: '#7a271a',
    errorColorSuppl: '#912018',
    borderRadius: '6px',
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    textColorBase: palette['text'],
    textColor1: palette['heading'],
    textColor2: palette['text'],
    textColor3: palette['muted'],
    textColorDisabled: palette['disabled'],
    placeholderColor: palette['muted'],
    placeholderColorDisabled: palette['disabled'],
    iconColor: palette['muted'],
    iconColorHover: palette['text'],
    iconColorPressed: palette['heading'],
    iconColorDisabled: palette['disabled'],
    borderColor: palette['line-strong'],
    dividerColor: palette['line'],
    bodyColor: palette['bg'],
    baseColor: palette['surface'],
    cardColor: palette['surface'],
    modalColor: palette['surface'],
    popoverColor: palette['surface'],
    inputColor: palette['surface'],
    inputColorDisabled: palette['surface-2'],
    tableColor: palette['surface'],
    tableHeaderColor: palette['surface-2'],
    tableColorHover: palette['surface-2'],
    tableColorStriped: palette['surface-2'],
    tagColor: palette['surface-2'],
    avatarColor: palette['surface-3'],
    codeColor: palette['surface-2'],
    actionColor: palette['surface-2'],
    hoverColor: palette['primary-soft'],
    pressedColor: palette['primary-soft'],
    fontSize: '13px',
  },
  Button: { fontWeight: '500' },
  Dialog: { borderRadius: '12px' },
  Card: { borderRadius: '8px' },
  Input: { boxShadowFocus: `0 0 0 2px ${palette['focus-ring']}` },
  DataTable: {
    thColor: palette['surface-2'],
    thTextColor: palette['muted'],
    tdTextColor: palette['text'],
    tdColorHover: palette['surface-2'],
    borderColor: palette['line'],
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
