import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { createTerraChronApi } from './api.js';
import 'ol/ol.css';
import './assets/styles.css';

const pinia = createPinia();
const api = createTerraChronApi(pinia);
createApp(App).use(pinia).provide('terrachron', api).mount('#app');
// Documented host-page integration point; no secret or authenticated credentials attached.
window.terrachron = api;
