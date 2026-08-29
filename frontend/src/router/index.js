import { createRouter, createWebHistory } from 'vue-router';
import TimesheetView from '../views/TimesheetView.vue';
import FatturaView from '../views/FatturaView.vue';
import ImportaStoricoView from '../views/ImportaStoricoView.vue';
import ImpostazioniView from '../views/ImpostazioniView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/timesheet' },
    { path: '/timesheet', name: 'timesheet', component: TimesheetView },
    { path: '/fattura', name: 'fattura', component: FatturaView },
    { path: '/importa-storico', name: 'importa-storico', component: ImportaStoricoView },
    { path: '/impostazioni', name: 'impostazioni', component: ImpostazioniView },
  ],
});
