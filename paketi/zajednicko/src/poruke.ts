/**
 * Svi UI/serverski tekstovi na hrvatskom - jedno mjesto (konvencije.md).
 * Klijent ne izmišlja tekstove pravila; sve poruke dolaze odavde ili s poslužitelja.
 */

export const PORUKE = {
  rijecNePostoji: 'Ta riječ ne postoji u našoj bazi.',
  rijecIskoristena: 'Ta riječ je već iskorištena.',
  rijecIskoristenaOblik: (oblik: string) => `Već je iskorišten oblik te riječi: '${oblik}'.`,
  nedopustenaVrsta: 'Ta vrsta riječi nije dopuštena u ovoj privatnoj sobi.',
  nijeOsnovniOblik: 'U ovoj privatnoj sobi dopušteni su samo osnovni oblici (nominativ imenica, infinitiv glagola).',
  prekratkaRijec: (minGrafema: number) => `Riječ mora imati najmanje ${minGrafema} slova u ovoj sobi.`,
  krivaSlova: (dvaGrafema: string) => `Riječ mora početi na '${dvaGrafema}'.`,
  mrtvaSlovaBaza: (dvaGrafema: string) =>
    `Trenutno u bazi nemamo riječ na '${dvaGrafema}'.`,
  mrtvaSlovaIskoristeno: (dvaGrafema: string) =>
    `Sve riječi na '${dvaGrafema}' već su iskorištene u ovoj partiji.`,
  nijeTvojPotez: 'Nisi na potezu.',
  sustavBiraRijec: 'Sustav bira novu riječ. Pričekaj trenutak.',
  prebrzo: 'Usporeni, molimo pričekaj trenutak.',
  vecURedu: 'Već si u redu čekanja.',
} as const;
