/** Produkcijski kanonski origin — staging ionako šalje X-Robots-Tag: noindex. */
export const SEO_BAZA = 'https://kaladont.hr';

export const SEO_OG_SLIKA = `${SEO_BAZA}/slike/og-dijeljenje.png`;
export const SEO_OG_SIRINA = 1200;
export const SEO_OG_VISINA = 630;
export const SEO_OG_ALT = 'Kaladont — online hrvatska igra riječi';

export const PRAVILA_TEME = [
  'kako-igrati',
  'nacini',
  'bodovi',
  'napredak',
  'dnk',
  'pristupacnost',
  'pitanja',
] as const;

export type PravilaTema = (typeof PRAVILA_TEME)[number];

export const PRAVILA_TEME_META: {
  id: PravilaTema;
  naziv: string;
  title: string;
  description: string;
}[] = [
  {
    id: 'kako-igrati',
    naziv: 'Kako igrati',
    title: 'Pravila - Kaladont Online',
    description:
      'Pročitajte pravila igre kaladont koja se odnose na našu online multiplayer verziju. Kaladont možete besplatno igrati bez potrebe za registracijom.',
  },
  {
    id: 'nacini',
    naziv: 'Kako sve možeš igrati?',
    title: 'Načini igre Kaladont — Dvoboj, Četveroboj i sobe',
    description:
      'Usporedi načine igre Kaladonta: Dvoboj, Četveroboj, Zagrijavanje i privatne sobe — što nude i kada ih birati.',
  },
  {
    id: 'bodovi',
    naziv: 'Bodovi i rangovi',
    title: 'Bodovi i rangovi u Kaladontu',
    description:
      'Saznaj kako funkcioniraju bodovi, pobjede, rangovi i ljestvice u online igri riječi Kaladont.',
  },
  {
    id: 'napredak',
    naziv: 'Iskustvo',
    title: 'Iskustvo u Kaladontu — XP, nizovi i ocjena igre',
    description:
      'Saznaj kako se u Kaladontu dobiva iskustvo (XP), kako se množi nizovima i kako se ocjenjuje partija.',
  },
  {
    id: 'dnk',
    naziv: 'Kaladont DNK',
    title: 'Kaladont DNK — što mjeri i kako ga razvijati',
    description:
      'Saznaj što mjeri šest osi Kaladont DNK-a i kako načinom igre — brzina, rječnik, rizik — utječeš na njih.',
  },
  {
    id: 'pristupacnost',
    naziv: 'Pristupačnost',
    title: 'Pristupačnost i čitanje naglas — Kaladont',
    description:
      'Font za disleksiju, čitanje naglas i igra bez tajmera: kako Kaladont olakšava čitanje i igranje svima.',
  },
  {
    id: 'pitanja',
    naziv: 'Pitanja i problemi',
    title: 'Pitanja i problemi — Kaladont',
    description:
      'Odgovori na najčešća pitanja o riječima, čitanju naglas, disleksiji, rangu i igranju Kaladonta online.',
  },
];

export const FAQ_PITANJA: { pitanje: string; odgovor: string }[] = [
  {
    pitanje: 'Kako olakšati čitanje kod disleksije?',
    odgovor:
      'Uključi font za disleksiju i čitanje naglas na naslovnici ili u Postavkama. Za igru bez odbrojavanja otvori Zagrijavanje ili privatnu sobu bez tajmera.',
  },
  {
    pitanje: 'Zašto čitanje zvuči engleski ili čudno?',
    odgovor:
      'Uređaj nema hrvatski glas, pa preglednik koristi engleski. Dodaj glas hr-HR prema uputama za pristupačnost i osvježi stranicu.',
  },
  {
    pitanje: 'Zašto se čitanje uopće ne čuje?',
    odgovor:
      'Provjeri glasnoću, da preglednik dopušta govor i da je glas instaliran. Zatim ponovno učitaj Kaladont.',
  },
  {
    pitanje: 'Zašto su kod „kralj” i „konj” istaknuta tri znaka?',
    odgovor:
      'lj, nj i dž jedno su slovo. Zadnja dva slova od „konj” su o + nj, dakle onj. Od „kralj” su a + lj, dakle alj.',
  },
  {
    pitanje: 'Kako igrati bez tajmera?',
    odgovor:
      'Zagrijavanje nema tajmer. U privatnoj sobi domaćin bira „Bez tajmera”. Javni Dvoboj i Četveroboj imaju 30 sekundi.',
  },
  {
    pitanje: 'Vide li drugi moj font i čitanje naglas?',
    odgovor: 'Ne. Spremaju se na ovom uređaju i vrijede samo tebi.',
  },
  {
    pitanje: 'Zašto riječ nije prihvaćena?',
    odgovor:
      'Provjeri početna slova, kvačice, vrstu riječi i je li oblik već odigran. Pokušaj drugu dok vrijeme traje.',
  },
  {
    pitanje: 'Zašto drugi oblik iste riječi ne prolazi?',
    odgovor:
      'Povezani oblici troše se zajedno do kraja igre. Nakon „dobar” ne prolaze „dobra” ni „dobro”.',
  },
  {
    pitanje: 'Zašto sam odmah ispao?',
    odgovor:
      '„Ne znam”, istek vremena, mrtva slova, Kaladont na tvoje „ka”, ili prekid veze dulji od 10 sekundi.',
  },
  {
    pitanje: 'Kako prijaviti riječ ili problem?',
    odgovor: 'Na kraju igre otvori poteze i uz spornu riječ odaberi Prijavi.',
  },
  {
    pitanje: 'Dobivam li u Zagrijavanju bodove i XP?',
    odgovor:
      'Ne. Trening ne dira rang, XP, DNK ni formu. Registriranima pobjeda broji dostignuće Zagrijan.',
  },
  {
    pitanje: 'Zašto piše Piskaralo?',
    odgovor:
      'Rang i DNK stižu nakon 10 javnih igara u tom načinu. Dvoboj i Četveroboj broje se odvojeno.',
  },
  {
    pitanje: 'Zašto nisam na ljestvici?',
    odgovor:
      'Dnevno treba 10 javnih igara tog dana, a tjedno, mjesečno, godišnje i ukupno 20 u tom razdoblju. Igra pripada danu završetka, po hrvatskom vremenu.',
  },
  {
    pitanje: 'Kada dobivam zvjezdicu za Top 10?',
    odgovor:
      'Čim dosegneš mjesto od 1 do 10 na dnevnoj, tjednoj ili mjesečnoj ljestvici. Ne treba ostati do kraja razdoblja niti otvoriti ljestvice.',
  },
  {
    pitanje: 'Zašto privatna soba ne daje XP?',
    odgovor:
      'Ima svoju ljestvicu. XP, rang i DNK ostaju za javne igre. U sobi napreduju Rijetkolovac, Dugometraš i Jezik u plamenu.',
  },
  {
    pitanje: 'Kako prenijeti napredak ili promijeniti avatar?',
    odgovor:
      'Gost ima napredak samo na ovom uređaju. Registracijom ga zadržavaš. Avatar i zvuk su u postavkama profila.',
  },
];

export function jePravilaTema(vrijednost: string): vrijednost is PravilaTema {
  return (PRAVILA_TEME as readonly string[]).includes(vrijednost);
}

/** Alias `pravila` i prazan ulaz mapiraju na `kako-igrati`. */
export function normalizirajTemu(ulaz: string | null | undefined): PravilaTema | null {
  if (!ulaz || ulaz === 'pravila') return 'kako-igrati';
  return jePravilaTema(ulaz) ? ulaz : null;
}

export function putanjaPravilaTeme(tema: PravilaTema): string {
  return tema === 'kako-igrati' ? '/pravila-kaladonta' : `/pravila-kaladonta/${tema}`;
}

export function kanonskiUrl(putanja: string): string {
  if (putanja.startsWith('http://') || putanja.startsWith('https://')) return putanja;
  const normalizirana = putanja.startsWith('/') ? putanja : `/${putanja}`;
  return `${SEO_BAZA}${normalizirana === '/' ? '/' : normalizirana}`;
}

export function metaPravilaTeme(tema: PravilaTema) {
  return PRAVILA_TEME_META.find((t) => t.id === tema)!;
}

export function jsonLdSkripta(podaci: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(podaci);
}

export function breadcrumbPravila(tema: PravilaTema) {
  const meta = metaPravilaTeme(tema);
  const itemListElement: {
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Naslovnica',
      item: kanonskiUrl('/'),
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Pravila Kaladonta',
      item: kanonskiUrl('/pravila-kaladonta'),
    },
  ];
  // Hub (`kako-igrati`) je `/pravila-kaladonta` — ne dupliciraj isti URL kao treću stavku.
  if (tema !== 'kako-igrati') {
    itemListElement.push({
      '@type': 'ListItem',
      position: 3,
      name: meta.naziv,
      item: kanonskiUrl(putanjaPravilaTeme(tema)),
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };
}

export function faqPageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_PITANJA.map((stavka) => ({
      '@type': 'Question',
      name: stavka.pitanje,
      acceptedAnswer: {
        '@type': 'Answer',
        text: stavka.odgovor,
      },
    })),
  };
}

export const NASLOVNICA_SEO_TITLE = 'Kaladont Online - Multiplayer igra riječi';
export const NASLOVNICA_SEO_DESCRIPTION =
  'Zaigraj kaladont i pokušaj ostati zadnji za stolom! Testiraj svoje znanje jezika, osvajaj nagrade, rangiraj se na ljestvicama i još mnogo toga.';

export function naslovnicaJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Kaladont',
      url: kanonskiUrl('/'),
      inLanguage: 'hr',
      description: NASLOVNICA_SEO_DESCRIPTION,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Kaladont',
      url: kanonskiUrl('/'),
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      inLanguage: 'hr',
      isAccessibleForFree: true,
      description: NASLOVNICA_SEO_DESCRIPTION,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
      },
    },
  ];
}

/** Jedini indeksabilni HTML putovi: naslovnica i hub pravila (teme su noindex, follow). */
export function jeIndeksabilnaPutanja(pathname: string): boolean {
  return pathname === '/' || pathname === '/pravila-kaladonta';
}
