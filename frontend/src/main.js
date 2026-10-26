import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { router } from './router'

// Moduli opzionali: se la cartella `estensioni/` manca, il glob è vuoto.
import.meta.glob('./estensioni/*.{js,css}', { eager: true })

createApp(App).use(router).mount('#app')
