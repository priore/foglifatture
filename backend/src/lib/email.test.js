import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEmails } from './email.js';

test('stringa vuota', () => assert.deepEqual(parseEmails(''), []));
test('undefined', () => assert.deepEqual(parseEmails(undefined), []));
test('un indirizzo valido', () => assert.deepEqual(parseEmails('a@b.it'), ['a@b.it']));
test('più indirizzi validi', () => assert.deepEqual(parseEmails('a@b.it, c@d.com'), ['a@b.it', 'c@d.com']));
test('spazi attorno alle virgole', () => assert.deepEqual(parseEmails('  a@b.it  ,  c@d.com  '), ['a@b.it', 'c@d.com']));
test('indirizzi non validi scartati', () => assert.deepEqual(parseEmails('ok@x.it, non-email, anche-no'), ['ok@x.it']));
test('tutti non validi', () => assert.deepEqual(parseEmails('niente, zerochiocciola'), []));
