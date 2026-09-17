/** Adapter za razvojni log ili Resend slanje, ovisno o okruženju. */
import type { FastifyBaseLogger } from 'fastify';
import { konfiguracija, stagingEmailAllowlista } from './konfiguracija.js';

export interface PorukaEmaila {
  predmet: string;
  tekst: string;
  html?: string;
}

function osnovniHtml(naslov: string, sadrzaj: string): string {
  return `<!doctype html>
<html lang="hr">
  <body style="margin:0;padding:24px;background:#fdfaf2;color:#1a1815;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5ddc8;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 32px;background:#1d6f5c;color:#ffffff;"><strong style="font-size:28px;line-height:1;">Kaladont</strong><br><span style="font-size:14px;">Hrvatska igra riječi</span></td></tr>
      <tr><td style="padding:32px;font-size:16px;line-height:1.6;">${sadrzaj}</td></tr>
      <tr><td style="padding:20px 32px;background:#fdfaf2;color:#5c554a;font-size:13px;line-height:1.5;">${naslov}<br>Kaladont</td></tr>
    </table>
  </body>
</html>`;
}

export function porukaPotvrdeEmaila(poveznica: string, noviEmail = false): PorukaEmaila {
  const naslov = noviEmail ? 'Potvrdi novu email adresu' : 'Dobro došao/la u Kaladont';
  const uvod = noviEmail
    ? 'Zatražio/la si promjenu email adrese za svoj Kaladont račun.'
    : 'Još jedan korak i spreman/spremna si za igru.';
  return {
    predmet: naslov,
    tekst: `${uvod}\n\nPotvrdi email adresu ovom poveznicom (vrijedi 24 sata):\n${poveznica}\n\nVidimo se u igri,\nKaladont`,
    html: osnovniHtml(
      naslov,
      `<h1 style="margin:0 0 16px;color:#1d6f5c;font-size:26px;">${naslov}</h1><p style="margin:0 0 20px;">${uvod}</p><p style="margin:0 0 24px;">Poveznica vrijedi 24 sata.</p><p style="margin:0 0 28px;"><a href="${poveznica}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#1d6f5c;color:#ffffff;font-weight:700;text-decoration:none;">Potvrdi email adresu</a></p><p style="margin:0;color:#5c554a;font-size:14px;">Ako gumb ne radi, otvori ovu poveznicu:<br><a href="${poveznica}" style="color:#1d6f5c;word-break:break-all;">${poveznica}</a></p>`,
    ),
  };
}

export function porukaResetaLozinke(poveznica: string): PorukaEmaila {
  const naslov = 'Zatražena je promjena lozinke';
  return {
    predmet: naslov,
    tekst: `Bok!\n\nNetko je zatražio promjenu lozinke za ovaj Kaladont račun. Ako si to bio/bila ti, postavi novu lozinku ovom poveznicom (vrijedi 24 sata):\n${poveznica}\n\nAko nisi zatražio/la promjenu, ne trebaš ništa poduzeti. Tvoja trenutačna lozinka ostaje nepromijenjena.\n\nKaladont`,
    html: osnovniHtml(
      naslov,
      `<h1 style="margin:0 0 16px;color:#1d6f5c;font-size:26px;">Promjena lozinke</h1><p style="margin:0 0 20px;">Netko je zatražio promjenu lozinke za ovaj Kaladont račun.</p><p style="margin:0 0 24px;">Ako si to bio/bila ti, postavi novu lozinku. Poveznica vrijedi 24 sata.</p><p style="margin:0 0 28px;"><a href="${poveznica}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#1d6f5c;color:#ffffff;font-weight:700;text-decoration:none;">Postavi novu lozinku</a></p><p style="margin:0 0 16px;color:#5c554a;font-size:14px;">Ako gumb ne radi, otvori ovu poveznicu:<br><a href="${poveznica}" style="color:#1d6f5c;word-break:break-all;">${poveznica}</a></p><p style="margin:0;padding:16px;border-left:4px solid #e4572e;background:#fdfaf2;font-size:14px;">Ako nisi zatražio/la promjenu, ne trebaš ništa poduzeti. Tvoja trenutačna lozinka ostaje nepromijenjena.</p>`,
    ),
  };
}

export async function posaljiEmail(
  log: FastifyBaseLogger,
  prima: string,
  poruka: PorukaEmaila | string,
): Promise<void> {
  const email =
    typeof poruka === 'string' ? { predmet: 'Kaladont obavijest', tekst: poruka } : poruka;
  if (!konfiguracija.EMAIL_API_KLJUC) {
    log.info(`[dev-email] Za: ${prima} | ${email.predmet} | ${email.tekst}`);
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
      subject: email.predmet,
      text: email.tekst,
      ...(email.html ? { html: email.html } : {}),
    }),
  });

  if (!odgovor.ok) {
    const detalji = await odgovor.text();
    log.error({ status: odgovor.status }, 'Resend nije prihvatio email');
    throw new Error(`Resend slanje nije uspjelo (HTTP ${odgovor.status}): ${detalji}`);
  }
}
