import { createRouter, createWebHistory } from 'vue-router';
import TimesheetView from '../views/TimesheetView.vue';
import FatturaView from '../views/FatturaView.vue';
import ImportaStoricoView from '../views/ImportaStoricoView.vue';
import ImpostazioniView from '../views/ImpostazioniView.vue';
import CronologiaPecView from '../views/CronologiaPecView.vue';
import DashboardView from '../views/DashboardView.vue';
import VersamentiF24View from '../views/VersamentiF24View.vue';
import PrivacyView from '../views/PrivacyView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/timesheet', name: 'timesheet', component: TimesheetView },
    { path: '/fattura', name: 'fattura', component: FatturaView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView },
    { path: '/versamenti-f24', name: 'versamenti-f24', component: VersamentiF24View },
    { path: '/importa-storico', name: 'importa-storico', component: ImportaStoricoView },
    { path: '/impostazioni', name: 'impostazioni', component: ImpostazioniView },
    { path: '/impostazioni/pec-cronologia', name: 'pec-cronologia', component: CronologiaPecView },
    { path: '/privacy', name: 'privacy', component: PrivacyView },
  ],
});
