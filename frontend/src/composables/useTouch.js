// Dito come puntatore primario dentro la shell dell'app. Fuori dalla shell è sempre falso (portatili 2-in-1, tablet che aprono
// la pagina nel browser): `data-shell` lo imposta solo un host con shell propria (assente sul desktop).
import { ref } from 'vue';

const coarse = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;
const conShell = () => Boolean(document.documentElement.dataset.shell) && Boolean(coarse?.matches);

export const isTouch = ref(conShell());
coarse?.addEventListener('change', () => { isTouch.value = conShell(); });

// Rilegge a ogni uso: `data-shell` può comparire dopo il caricamento del modulo.
export const useTouch = () => { isTouch.value = conShell(); return { isTouch }; };
