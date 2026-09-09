/** Adapter za razvojni log ili Resend slanje, ovisno o okruženju. */
import type { FastifyBaseLogger } from 'fastify';
import { konfiguracija, stagingEmailAllowlista } from './konfiguracija.js';

export async function posaljiEmail(log: FastifyBaseLogger, prima: string, sadrzaj: string): Promise<void> {
  if (!konfiguracija.EMAIL_API_KLJUC) {
    log.info(`[dev-email] Za: ${prima} | ${sadrzaj}`);
    return;
  }

  const primatelj = prima.trim().toLowerCase();
  if (konfiguracija.NODE_ENV === 'staging' && !stagingEmailAllowlista.includes(primatelj)) {
    log.warn({ primatelj }, 'Staging email odbijen: adresa nije na allowlisti');
    return;
  }

  const odgovor = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${konfiguracija.EMAIL_API_KLJUC}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: konfiguracija.EMAIL_POSILJATELJ,
      to: [primatelj],
      subject: 'Kaladont obavijest',
      text: sadrzaj,
    }),
  });

  if (!odgovor.ok) {
    const detalji = await odgovor.text();
    log.error({ status: odgovor.status }, 'Resend nije prihvatio email');
    throw new Error(`Resend slanje nije uspjelo (HTTP ${odgovor.status}): ${detalji}`);
  }
}
