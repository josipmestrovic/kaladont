import { jeValjanNadimak, MAKSIMALNA_DULJINA_NADIMKA, MINIMALNA_DULJINA_NADIMKA, UZORAK_NADIMKA } from 'zajednicko';

/**
 * Fond nadimaka za javne botove (ADR-017): usklađen s UZORAK_NADIMKA (3–12 znakova),
 * bez stvarnih osoba i bez tvrdnji o identitetu. Redoslijed je stabilan; seed bira po ključu.
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

/** Stabilan skup budućih imenovanih botova, dedupliciran bez obzira na velika/mala slova. */
export const KANDIDATI_NADIMAKA_BOTOVA: readonly string[] = [...JEZGRI].filter((nadimak) =>
  nadimak.length >= MINIMALNA_DULJINA_NADIMKA && nadimak.length <= MAKSIMALNA_DULJINA_NADIMKA && UZORAK_NADIMKA.test(nadimak),
);

/** Curirani zamjenski fond v4: 80 imenovanih (+ 20 gost u servisu). */
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
export const BROJ_GOSTIJU_FONDA_V4 = 20;
export const CILJ_AKTIVNIH_FONDA_V4 = BROJ_IMENOVANIH_FONDA_V4 + BROJ_GOSTIJU_FONDA_V4;

if (KANDIDATI_NADIMAKA_BOTOVA.length < 200) throw new Error('Fond nadimaka botova mora imati najmanje 200 različitih kandidata.');
if (NADIMCI_POCETNOG_FONDA_V4.length !== BROJ_IMENOVANIH_FONDA_V4) throw new Error(`Početni fond v4 mora imati ${BROJ_IMENOVANIH_FONDA_V4} nadimaka.`);
if (new Set(NADIMCI_POCETNOG_FONDA_V4.map(({ nadimak }) => nadimak.toLocaleLowerCase('hr-HR'))).size !== BROJ_IMENOVANIH_FONDA_V4) {
  throw new Error(`Početni fond v4 mora imati ${BROJ_IMENOVANIH_FONDA_V4} različitih nadimaka.`);
}
for (const { nadimak } of NADIMCI_POCETNOG_FONDA_V4) {
  if (!jeValjanNadimak(nadimak)) throw new Error(`Nadimak fonda v4 nije valjan: ${nadimak}`);
}
