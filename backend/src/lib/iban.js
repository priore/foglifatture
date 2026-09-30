// Validazione IBAN: formato + controllo mod-97 (ISO 13616). Non verifica la lunghezza per paese.
export function normalizzaIban(iban) {
  return String(iban ?? '').replace(/\s+/g, '').toUpperCase();
}

export function ibanValido(iban) {
  const s = normalizzaIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const numerico = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
  let resto = 0;
  for (const cifra of numerico) resto = (resto * 10 + Number(cifra)) % 97;
  return resto === 1;
}
