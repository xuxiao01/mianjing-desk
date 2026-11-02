import { createApp } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import { router } from './router';
import { queryClient } from './query-client';
import '@/styles/global.css';

createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app');
