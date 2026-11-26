import {
  BROJ_JAVNIH_BOTOVA_V5,
  NADIMCI_JAVNIH_BOTOVA_V5,
  REZERVNI_NADIMAK_JAVNOG_FONDA_V5,
  jeValjanNadimak,
  MAKSIMALNA_DULJINA_NADIMKA,
  MINIMALNA_DULJINA_NADIMKA,
  UZORAK_NADIMKA,
} from 'zajednicko';

/**
 * Povijesni generički kandidati (admin fallback prije V5). Novi V5 fond ih ne koristi.
 * Zadržano samo radi kompatibilnosti starih testova / dokumentacije.
 */
export const NADIMCI_BOTOVA: readonly string[] = [
  'Slovko', 'Riječnik', 'Vokalko', 'Konsonanta', 'Grafem', 'Digraf', 'Lektorka', 'Tipkalo', 'Pisanko', 'Čitanka',
  'Abecedar', 'Slogić', 'Zarezko', 'Točkica', 'Bukvar', 'Rječica', 'Nastavak', 'Prefiksa', 'Sufiksko', 'Akcent',
  'Glagoljaš', 'Ćirilko', 'Latinka', 'Dijakritik', 'Kvačica', 'Crtica', 'Upitnik', 'Uskličnik', 'Navodnik', 'Zagradić',
  'Rimoljub', 'Stihić', 'Kitica', 'Pjesmuljak', 'Pričalo', 'Bajkić', 'Zagonetko', 'Rebusić', 'Križaljka', 'Osmosmjer',
  'Anagramka', 'Palindrom', 'Sinonimka', 'Antonimko', 'Homonim', 'Deminutiv', 'Augmentiv', 'Infinitiv', 'Imperativ', 'Vokativ',
  'Nominativ', 'Genitivka', 'Dativko', 'Akuzativ', 'Lokativka', 'Instrumen', 'Padežić', 'Rodić', 'Brojnik', 'Zamjenko',
  'Pridjevka', 'Prilogić', 'Veznica', 'Česticko', 'Uzvičić', 'Prijedlog', 'Imenko', 'Glagolka', 'Leksem', 'Morfemka',
  'Fonemko', 'Semantika', 'Sintaksa', 'Etimolog', 'Pravopis', 'Gramatik', 'Jezikoslov', 'Štokavka', 'Kajkavko', 'Čakavica',
  'Ikavko', 'Ekavica', 'Ijekavko', 'Dubrovko', 'Zagorka', 'Slavonko', 'Istranka', 'Ličanko', 'Dalmatinka', 'Međimurko',
  'Posavko', 'Podravka', 'Baranjko', 'Kordunka', 'Banijko', 'Moslavka', 'Žumberko', 'Gorštakinja', 'Primorko', 'Otočanka',
];

const KORIJENI_NADIMAKA = [
  'Slov', 'Rijec', 'Vokal', 'Slog', 'Graf', 'Knjig', 'Pis', 'Cit', 'Znak', 'Rima',
  'Pjes', 'Lema', 'Leksem', 'Morf', 'Fonem', 'Glas', 'Jezik', 'Stih', 'Slovo', 'Karta',
  'Pismo', 'Poez', 'Staza', 'Iskra', 'Traga', 'Most', 'Kljuc', 'Zora', 'Luna', 'Oblak',
  'Val', 'Ton', 'Ritm', 'Tinta', 'Citat', 'Smijeh', 'Krug', 'Tocak', 'Put', 'Stoper',
  'Igra', 'Mreza', 'Misa', 'Potez', 'Runda', 'Red', 'Ping', 'Bajt', 'Kod', 'Token',
  'Server', 'Paket', 'Tipk', 'Zvuk', 'Zmaj', 'Sova', 'Bura', 'Kap', 'Vjetar', 'Kamen',
  'More', 'Brod', 'Kist', 'Boja', 'Oblik', 'Kut', 'Trokut', 'Krug', 'Zvijezd', 'Sunce',
];

const NASTAVCI_NADIMAKA = ['ko', 'ka', 'ac', 'ica'] as const;

const JEZGRI = new Set<string>();
for (const nadimak of NADIMCI_BOTOVA) JEZGRI.add(nadimak.toLocaleLowerCase('hr-HR'));
for (const korijen of KORIJENI_NADIMAKA) {
  for (const nastavak of NASTAVCI_NADIMAKA) JEZGRI.add(`${korijen}${nastavak}`.toLocaleLowerCase('hr-HR'));
}

/** @deprecated Generički kandidati; novi botovi koriste samo odobreni V5 katalog. */
export const KANDIDATI_NADIMAKA_BOTOVA: readonly string[] = [...JEZGRI].filter((nadimak) =>
  nadimak.length >= MINIMALNA_DULJINA_NADIMKA && nadimak.length <= MAKSIMALNA_DULJINA_NADIMKA && UZORAK_NADIMKA.test(nadimak),
);

/** @deprecated Zamijenjeno fondom V5. */
export const NADIMCI_POCETNOG_FONDA_V4: readonly { nadimak: string; pocetnoSlovo: 'malo' | 'veliko' }[] = [
  'kaladontaš', 'Lik33', 'Mare', 'burek', 'Nika_7', 'jos5min', 'Fićo', 'iva_k', 'Gogo82', 'šogi',
  'TinaM', 'samo_gledam', 'Žućo', 'kokica', 'Bero', 'katastrofica', 'TetaVesna', 'nabrzinu', 'Maya', 'silver',
  'ginosaji', 'armanoGoku', 'fl0ky', 'lucijas', 'brunchy1', 'woole', 'Hrvoje', 'Kile', 'Ivan_emil', 'Agramer',
  'Diavolo_CRO', 'Majstor', 'Mladomud', 'hanhinaamat', 'ćelavimajmun', 'IceAge', 'richmondAFC', 'sstefan', '-aldo-', 'Lemez',
  'kautokeino', 'MihaelH2005', 'melo18', 'Peluketa', 'panter4o', 'Yamal', 'Vicinho', 'andrej', 'mymoon', 'aaaaaaaaa',
  '1235346', 'zoki', 'Miki87', 'periš', 'Lara', 'brusli', 'Dado', 'Roki', 'tea_m', 'pajo',
  'Cuki', 'markec', 'šuki', 'dzej', 'Vjeko', 'keks', 'AnaB', 'tošo', 'Luka_9', 'nene',
  'Boki', 'crni', 'Iva2', 'dule', 'Pegla', 'maki', 'Tonči', 'riba', 'Jura', 'sova',
].map((nadimak) => ({
  nadimak,
  pocetnoSlovo: nadimak[0] === nadimak[0]!.toLocaleLowerCase('hr-HR') ? 'malo' as const : 'veliko' as const,
}));

/** @deprecated Koristi NADIMCI_POCETNOG_FONDA_V4. */
export const NADIMCI_POCETNOG_FONDA_V3 = NADIMCI_POCETNOG_FONDA_V4;

export const BROJ_IMENOVANIH_FONDA_V4 = 80;
export const BROJ_GOSTIJU_FONDA_V4 = 0;
export const CILJ_AKTIVNIH_FONDA_V4 = BROJ_IMENOVANIH_FONDA_V4;

export const NADIMCI_POCETNOG_FONDA_V5: readonly { nadimak: string; pocetnoSlovo: 'veliko' }[] =
  NADIMCI_JAVNIH_BOTOVA_V5.map((nadimak) => ({ nadimak, pocetnoSlovo: 'veliko' as const }));

export const BROJ_IMENOVANIH_FONDA_V5 = BROJ_JAVNIH_BOTOVA_V5;
export const BROJ_GOSTIJU_FONDA_V5 = 0;
export const CILJ_AKTIVNIH_FONDA_V5 = BROJ_IMENOVANIH_FONDA_V5;

/** Odobreni nadimci za nove bot identitete (javni katalog + rezervni). */
export const ODOBRENI_NADIMCI_NOVIH_BOTOVA: readonly string[] = [
  ...NADIMCI_JAVNIH_BOTOVA_V5,
  REZERVNI_NADIMAK_JAVNOG_FONDA_V5,
];

if (NADIMCI_POCETNOG_FONDA_V5.length !== BROJ_IMENOVANIH_FONDA_V5) {
  throw new Error(`Početni fond v5 mora imati ${BROJ_IMENOVANIH_FONDA_V5} nadimaka.`);
}
if (new Set(NADIMCI_POCETNOG_FONDA_V5.map(({ nadimak }) => nadimak.toLocaleLowerCase('hr-HR'))).size !== BROJ_IMENOVANIH_FONDA_V5) {
  throw new Error(`Početni fond v5 mora imati ${BROJ_IMENOVANIH_FONDA_V5} različitih nadimaka.`);
}
for (const { nadimak } of NADIMCI_POCETNOG_FONDA_V5) {
  if (!jeValjanNadimak(nadimak)) throw new Error(`Nadimak fonda v5 nije valjan: ${nadimak}`);
}
for (const nadimak of ODOBRENI_NADIMCI_NOVIH_BOTOVA) {
  if (!jeValjanNadimak(nadimak)) throw new Error(`Odobreni nadimak bota nije valjan: ${nadimak}`);
}
