// Parsing e validazione di una stringa multi-email separata da virgola.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmails(str) {
  return String(str ?? '').split(',').map(e => e.trim()).filter(e => e && REGEX_EMAIL.test(e));
}
