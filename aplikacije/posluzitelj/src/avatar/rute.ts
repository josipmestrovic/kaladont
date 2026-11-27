/**
 * Javne generirane slike avatara, izvan /api prefiksa.
 * Hash je sadržajna adresa pa je odgovor nepromjenjiv.
 */
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { jeVelicinaGeneriranogAvatara } from 'zajednicko';
import { konfiguracija } from '../konfiguracija.js';
import { CACHE_HASHIRANIH_ASETA } from '../sigurnost/staticki-aseti.js';

const UZORAK_HASHA = /^[a-f0-9]{64}$/;

export async function registrirajRuteGeneriranihAvatara(
  app: FastifyInstance,
  opcije: { direktorij?: string } = {},
): Promise<void> {
  app.get<{ Params: { hash: string; datoteka: string } }>(
    '/avatari/g/:hash/:datoteka',
    { config: { rateLimit: false } },
    async (zahtjev, odgovor) => {
      const { hash, datoteka } = zahtjev.params;
      const poklapanje = /^(\d+)\.webp$/.exec(datoteka);
      const velicina = poklapanje ? Number(poklapanje[1]) : Number.NaN;
      if (!UZORAK_HASHA.test(hash) || !jeVelicinaGeneriranogAvatara(velicina)) {
        return odgovor.code(404).send();
      }

      const korijen = path.resolve(opcije.direktorij ?? konfiguracija.AVATARI_GENERIRANI_DIR);
      const putanja = path.resolve(korijen, hash, `${velicina}.webp`);
      const relativno = path.relative(korijen, putanja);
      if (relativno.startsWith('..') || path.isAbsolute(relativno)) {
        return odgovor.code(404).send();
      }

      try {
        await access(putanja);
      } catch {
        return odgovor.code(404).send();
      }

      odgovor.header('cache-control', CACHE_HASHIRANIH_ASETA).type('image/webp');
      return odgovor.send(createReadStream(putanja));
    },
  );
}
