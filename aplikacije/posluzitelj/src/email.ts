/**
 * "Slanje" emaila - u razvoju (EMAIL_API_KLJUC prazan) samo ispisuje u konzolu (postavljanje-okoline.md).
 */
import type { FastifyBaseLogger } from 'fastify';

export function posaljiEmail(log: FastifyBaseLogger, prima: string, sadrzaj: string): void {
  if (!process.env.EMAIL_API_KLJUC) {
    log.info(`[dev-email] Za: ${prima} | ${sadrzaj}`);
    return;
  }
  // TODO: stvarno slanje preko Resend/Brevo kad EMAIL_API_KLJUC postoji.
  log.info(`[email] Za: ${prima} | ${sadrzaj}`);
}
