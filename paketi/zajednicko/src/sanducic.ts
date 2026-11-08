/** Tipovi i predlošci za trajni sandučic (mailbox) igrača. */

export const TIP_SANDUCIC_TEST = 'test' as const;
export const TIP_SANDUCIC_DOBRODOSLICA = 'dobrodoslica' as const;
export const TIP_SANDUCIC_EMAIL_POTVRDEN = 'email_potvrden' as const;
export const TIP_SANDUCIC_PRVA_IGRA = 'prva_igra' as const;
export const TIP_SANDUCIC_FEEDBACK = 'feedback' as const;
export const TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA = 'prijava_rijec_dodana' as const;
export const TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA = 'prijava_rijec_uklonjena' as const;
export const TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA = 'prijava_igraca_uvazena' as const;
export const TIP_SANDUCIC_NOVA_XP_RAZINA = 'nova_xp_razina' as const;
export const TIP_SANDUCIC_NOVA_ZVJEZDICA = 'nova_zvjezdica' as const;
export const TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA = 'nova_kolekcionarska_razina' as const;
export const TIP_SANDUCIC_PROMJENA_RANGA = 'promjena_ranga' as const;
export const TIP_SANDUCIC_FORMA_10 = 'forma_10' as const;
export const TIP_SANDUCIC_GOST_SAZETAK_5 = 'gost_sazetak_5' as const;

export const KLJUC_PREKRETNICE_PRVA_IGRA = 'prva_igra' as const;

export type TipSanducicPoruke =
  | typeof TIP_SANDUCIC_TEST
  | typeof TIP_SANDUCIC_DOBRODOSLICA
  | typeof TIP_SANDUCIC_EMAIL_POTVRDEN
  | typeof TIP_SANDUCIC_PRVA_IGRA
  | typeof TIP_SANDUCIC_FEEDBACK
  | typeof TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA
  | typeof TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA
  | typeof TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA
  | typeof TIP_SANDUCIC_NOVA_XP_RAZINA
  | typeof TIP_SANDUCIC_NOVA_ZVJEZDICA
  | typeof TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA
  | typeof TIP_SANDUCIC_PROMJENA_RANGA
  | typeof TIP_SANDUCIC_FORMA_10
  | typeof TIP_SANDUCIC_GOST_SAZETAK_5
  | (string & {});

export function kljucPrekretniceForme10(mod: string, prag: number): string {
  return `forma_10:${mod}:${prag}`;
}

export function kljucPrekretniceGostSazetak(prag: number): string {
  return `gost_sazetak:${prag}`;
}

export function kljucPrekretniceDovrseneIgre(izvorTip: string, izvorId: string): string {
  return `dovrsena:${izvorTip}:${izvorId}`;
}

export interface SanducicPorukaSazetak {
  id: string;
  tip: string;
  naslov: string;
  stvorenaAt: string;
  procitano: boolean;
}

export interface SanducicPorukaDetalj extends SanducicPorukaSazetak {
  tekst: string;
  podaci: Record<string, unknown>;
  poveznica: string | null;
}

export interface SanducicSazetakOdgovor {
  ok: true;
  brojNeprocitanih: number;
  zaNajavu: SanducicPorukaSazetak[];
}

export interface SanducicPromjena {
  /** Signal da klijent osvježi sažetak; bez privatnog sadržaja. */
  razlog: 'nova' | 'stanje';
}

export function hrvatskiBrojObavijesti(n: number): string {
  if (n === 1) return '1 novu obavijest';
  if (n >= 2 && n <= 4) return `${n} nove obavijesti`;
  return `${n} novih obavijesti`;
}

export function tekstSanducicToasta(broj: number): string {
  return `Imaš ${hrvatskiBrojObavijesti(broj)}.`;
}

export function tekstZavrsnogSazetka(broj: number): string {
  return `Imaš ${hrvatskiBrojObavijesti(broj)}`;
}

function tekstPolje(podaci: Record<string, unknown>, kljuc: string): string {
  const vrijednost = podaci[kljuc];
  return typeof vrijednost === 'string' ? vrijednost : '';
}

type Predlozak = {
  naslov: string | ((podaci: Record<string, unknown>) => string);
  tekst: (podaci: Record<string, unknown>) => string;
  poveznica: (podaci: Record<string, unknown>) => string | null;
};

const PREDLOSCI: Record<string, Predlozak> = {
  [TIP_SANDUCIC_TEST]: {
    naslov: 'Testna obavijest',
    tekst: (podaci) => (typeof podaci.tekst === 'string' && podaci.tekst.trim()
      ? podaci.tekst
      : 'Ovo je testna poruka sandučica.'),
    poveznica: () => null,
  },
  [TIP_SANDUCIC_DOBRODOSLICA]: {
    naslov: 'Dobrodošao/la u Kaladont!',
    tekst: (podaci) => {
      if (podaci.emailPotvrdjen === true) {
        return 'Hvala na registraciji! Email je potvrđen — možeš igrati. Uživaj! :)';
      }
      const email = tekstPolje(podaci, 'email') || 'tvoju adresu';
      return `Hvala na registraciji! Još samo potvrdi email: ${email}. Pogrešna adresa? Promijeni je ili zatraži novu potvrdu.`;
    },
    poveznica: (podaci) => (podaci.emailPotvrdjen === true ? null : '/potvrdi-email'),
  },
  [TIP_SANDUCIC_EMAIL_POTVRDEN]: {
    naslov: 'Email je potvrđen',
    tekst: () => 'Email je uspješno potvrđen i sada možeš igrati! Uživaj i sretno! :)',
    poveznica: () => null,
  },
  [TIP_SANDUCIC_PRVA_IGRA]: {
    naslov: 'Hvala što igraš!',
    tekst: () => 'Kaladont je u ranom razvoju pa su greške moguće. Podijeli mišljenje i prijavljuj sporne riječi — svaka pomoć nam puno znači! :)',
    poveznica: (podaci) => (podaci.gost === true ? '/registracija' : '/povratne-informacije'),
  },
  [TIP_SANDUCIC_FEEDBACK]: {
    naslov: 'Hvala na mišljenju!',
    tekst: () => 'Hvala što pomažeš poboljšati Kaladont! :)',
    poveznica: () => null,
  },
  [TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA]: {
    naslov: 'Riječ je dodana',
    tekst: (podaci) => {
      const rijec = tekstPolje(podaci, 'rijec') || 'prijavljena riječ';
      return `Riječ „${rijec}” koju si prijavio/la dodana je u rječnik. Hvala na pomoći! :)`;
    },
    poveznica: () => null,
  },
  [TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA]: {
    naslov: 'Riječ je uklonjena',
    tekst: (podaci) => {
      const rijec = tekstPolje(podaci, 'rijec') || 'prijavljena riječ';
      return `Riječ „${rijec}” koju si prijavio/la uklonjena je iz rječnika. Hvala na pomoći! :)`;
    },
    poveznica: () => null,
  },
  [TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA]: {
    naslov: 'Prijava je uvažena',
    tekst: (podaci) => (podaci.razlog === 'pogrdan_nadimak'
      ? 'Tvoja prijava za vulgarni nadimak je uvažena. Hvala ti što pomažeš poboljšati Kaladont! :)'
      : 'Tvoja prijava igrača je uvažena. Hvala ti što pomažeš poboljšati Kaladont! :)'),
    poveznica: () => null,
  },
  [TIP_SANDUCIC_NOVA_XP_RAZINA]: {
    naslov: 'Novi level!',
    tekst: (podaci) => {
      const razina = typeof podaci.razina === 'number' ? podaci.razina : Number(podaci.razina);
      return `Bravo! Dosegnuo/la si LVL ${Number.isFinite(razina) ? razina : '?'}!`;
    },
    poveznica: () => '/profil',
  },
  [TIP_SANDUCIC_NOVA_ZVJEZDICA]: {
    naslov: (podaci) => {
      const zvjezdice = typeof podaci.zvjezdice === 'number' ? podaci.zvjezdice : Number(podaci.zvjezdice);
      return Number.isFinite(zvjezdice) && zvjezdice > 1 ? 'Nova zvjezdica!' : 'Novo dostignuće!';
    },
    tekst: (podaci) => {
      const naziv = tekstPolje(podaci, 'naziv') || 'dostignuće';
      const zvjezdice = typeof podaci.zvjezdice === 'number' ? podaci.zvjezdice : Number(podaci.zvjezdice);
      const broj = Number.isFinite(zvjezdice) ? zvjezdice : 1;
      if (broj <= 1) return `Bravo! Otključano dostignuće ${naziv}: ${broj}.`;
      return `Bravo! Dostignuće ${naziv} sada ima ${broj} ${oblikZvjezdice(broj)}!`;
    },
    poveznica: () => '/profil',
  },
  [TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA]: {
    naslov: 'Nova kolekcionarska razina!',
    tekst: (podaci) => {
      const naziv = tekstPolje(podaci, 'naziv') || 'nova razina';
      return `Bravo! Otključana kolekcionarska razina ${naziv}!`;
    },
    poveznica: () => '/profil',
  },
  [TIP_SANDUCIC_PROMJENA_RANGA]: {
    naslov: (podaci) => (podaci.napredak === true ? 'Novi rang!' : 'Promjena ranga'),
    tekst: (podaci) => {
      const mod = tekstPolje(podaci, 'mod') || 'Igra';
      const rang = tekstPolje(podaci, 'rang') || 'novi rang';
      if (podaci.napredak === true) {
        return `${mod}: tvoj novi rang je ${rang}. Bravo!`;
      }
      return `${mod}: tvoj rang sada je ${rang}. Sretno u sljedećoj igri!`;
    },
    poveznica: () => '/profil',
  },
  [TIP_SANDUCIC_FORMA_10]: {
    naslov: 'Komentar forme',
    tekst: (podaci) => tekstForme10(podaci),
    poveznica: () => '/profil#statistika',
  },
  [TIP_SANDUCIC_GOST_SAZETAK_5]: {
    naslov: 'Tvoj sažetak',
    tekst: (podaci) => {
      if (podaci.registriran === true) {
        return 'Napredak je sačuvan registracijom. Hvala što igraš Kaladont! :)';
      }
      const odigrano = brojPolje(podaci, 'odigrano');
      const pobjede = brojPolje(podaci, 'pobjede');
      const razina = brojPolje(podaci, 'razina');
      const brojDostignuca = brojPolje(podaci, 'brojDostignuca');
      const brojZvjezdica = brojPolje(podaci, 'brojZvjezdica');
      const redovi = [
        `Odigrano: ${odigrano ?? '?'} · Pobjede: ${pobjede ?? '?'} · LVL: ${razina ?? '?'}`,
        `Dostignuća: ${brojDostignuca ?? 0}, ukupno ${brojZvjezdica ?? 0} ${oblikZvjezdice(brojZvjezdica ?? 0)}.`,
        'Registriraj se da sačuvaš napredak i pristupaš mu s različitih uređaja. Kao gost možeš izgubiti pristup napretku.',
      ];
      return redovi.join('\n');
    },
    poveznica: (podaci) => (podaci.registriran === true ? null : '/registracija'),
  },
};

function brojPolje(podaci: Record<string, unknown>, kljuc: string): number | null {
  const vrijednost = podaci[kljuc];
  const broj = typeof vrijednost === 'number' ? vrijednost : Number(vrijednost);
  return Number.isFinite(broj) ? broj : null;
}

function oblikPobjede(broj: number): string {
  if (broj === 1) return 'pobjeda';
  if (broj >= 2 && broj <= 4) return 'pobjede';
  return 'pobjeda';
}

function komentarForme(naziv: string | null): string {
  switch (naziv) {
    case 'Dobra':
    case 'Odlična':
    case 'Izvanredna':
    case 'Sjajna':
    case 'Top forma':
      return 'Bravo, samo tako nastavi! Hvala što igraš Kaladont! :)';
    case 'Prolazna':
      return 'Sljedeći niz počinje jednom pobjedom. Hvala što igraš Kaladont! :)';
    case 'Slaba':
    case 'Loša':
      return 'Nova igra, nova prilika — samo hrabro! Hvala što igraš Kaladont! :)';
    default:
      return 'Hvala što igraš Kaladont! :)';
  }
}

function tekstForme10(podaci: Record<string, unknown>): string {
  const mod = tekstPolje(podaci, 'mod') || 'Igra';
  const forma = tekstPolje(podaci, 'nazivForme') || 'nepoznata';
  const pobjede = brojPolje(podaci, 'pobjede') ?? 0;
  const trenutniNiz = brojPolje(podaci, 'trenutniNiz') ?? 0;
  return [
    `${mod} · zadnjih 10: ${pobjede} ${oblikPobjede(pobjede)}. Forma: ${forma}. Trenutni niz: ${trenutniNiz}.`,
    komentarForme(tekstPolje(podaci, 'nazivForme') || null),
  ].join(' ');
}

function oblikZvjezdice(broj: number): string {
  if (broj === 1) return 'zvjezdicu';
  if (broj >= 2 && broj <= 4) return 'zvjezdice';
  return 'zvjezdica';
}

export function renderirajSanducicPoruku(
  tip: string,
  podaci: Record<string, unknown> = {},
): { naslov: string; tekst: string; poveznica: string | null } {
  const predlozak = PREDLOSCI[tip] ?? {
    naslov: 'Obavijest',
    tekst: () => 'Nova obavijest u sandučicu.',
    poveznica: () => null,
  };
  return {
    naslov: typeof predlozak.naslov === 'function' ? predlozak.naslov(podaci) : predlozak.naslov,
    tekst: predlozak.tekst(podaci),
    poveznica: predlozak.poveznica(podaci),
  };
}
