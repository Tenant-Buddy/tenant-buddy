import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import ChecklistView from '@/views/ChecklistView.vue';

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/checklist/:id', component: ChecklistView, props: true },
  ],
});
