import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { installaFormatoImporti } from './composables/useFormatoImporti.js'
import { registro } from './registroEstensioni.js'

// Moduli opzionali: se la cartella `estensioni/` manca, il glob è vuoto.
import.meta.glob('./estensioni/*.{js,css}', { eager: true })

installaFormatoImporti()

// La shell si sceglie una sola volta all'avvio: un'estensione può registrarne una sua ({ componente, router }).
createApp(registro.shell?.componente || App).use(registro.shell?.router || router).mount('#app')
