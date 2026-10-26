import { createRouter, createWebHistory } from 'vue-router';
import TimesheetView from '../views/TimesheetView.vue';
import FatturaView from '../views/FatturaView.vue';
import ImportaStoricoView from '../views/ImportaStoricoView.vue';
import ImpostazioniView from '../views/ImpostazioniView.vue';
import CronologiaPecView from '../views/CronologiaPecView.vue';
import ClientiView from '../views/ClientiView.vue';
import DashboardView from '../views/DashboardView.vue';
import BitcoinView from '../views/BitcoinView.vue';
import VersamentiF24View from '../views/VersamentiF24View.vue';
import PrivacyView from '../views/PrivacyView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/timesheet', name: 'timesheet', component: TimesheetView, meta: { titolo: 'Timesheet mensile' } },
    { path: '/fattura', name: 'fattura', component: FatturaView, meta: { titolo: 'Fattura Pro-Forma' } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { titolo: 'Dashboard forfettario' } },
    { path: '/bitcoin', name: 'bitcoin', component: BitcoinView, meta: { titolo: 'Bitcoin' } },
    { path: '/versamenti-f24', name: 'versamenti-f24', component: VersamentiF24View, meta: { titolo: 'Versamenti F24' } },
    { path: '/clienti', name: 'clienti', component: ClientiView, meta: { titolo: 'Clienti' } },
    { path: '/pec-cronologia', name: 'pec-cronologia', component: CronologiaPecView, meta: { titolo: 'Cronologia PEC' } },
    { path: '/importa-storico', name: 'importa-storico', component: ImportaStoricoView, meta: { titolo: 'Importa storico' } },
    { path: '/impostazioni', name: 'impostazioni', component: ImpostazioniView, meta: { titolo: 'Impostazioni' } },
    { path: '/impostazioni/pec-cronologia', redirect: '/pec-cronologia' },
    { path: '/privacy', name: 'privacy', component: PrivacyView, meta: { titolo: 'Privacy' } },
  ],
});
