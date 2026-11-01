import { MAKSIMALNA_DULJINA_NADIMKA, MINIMALNA_DULJINA_NADIMKA, UZORAK_NADIMKA } from 'zajednicko';

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
function velikaPocetna(tekst: string): string { return tekst[0]!.toLocaleUpperCase('hr-HR') + tekst.slice(1); }
function malaPocetna(tekst: string): string { return tekst[0]!.toLocaleLowerCase('hr-HR') + tekst.slice(1); }

const JEZGRI = new Set<string>();
for (const nadimak of NADIMCI_BOTOVA) JEZGRI.add(nadimak.toLocaleLowerCase('hr-HR'));
for (const korijen of KORIJENI_NADIMAKA) {
  for (const nastavak of NASTAVCI_NADIMAKA) JEZGRI.add(`${korijen}${nastavak}`.toLocaleLowerCase('hr-HR'));
}

/** Stabilan skup budućih imenovanih botova, dedupliciran bez obzira na velika/mala slova. */
export const KANDIDATI_NADIMAKA_BOTOVA: readonly string[] = [...JEZGRI].filter((nadimak) =>
  nadimak.length >= MINIMALNA_DULJINA_NADIMKA && nadimak.length <= MAKSIMALNA_DULJINA_NADIMKA && UZORAK_NADIMKA.test(nadimak),
);

export const NADIMCI_POCETNOG_FONDA_V3: readonly { nadimak: string; pocetnoSlovo: 'malo' | 'veliko' }[] = [
  ...KORIJENI_NADIMAKA.slice(0, 20).map((korijen) => ({ nadimak: malaPocetna(`${korijen}ko`), pocetnoSlovo: 'malo' as const })),
  ...KORIJENI_NADIMAKA.slice(20, 40).map((korijen) => ({ nadimak: velikaPocetna(`${korijen}ka`), pocetnoSlovo: 'veliko' as const })),
];

if (KANDIDATI_NADIMAKA_BOTOVA.length < 200) throw new Error('Fond nadimaka botova mora imati najmanje 200 različitih kandidata.');
if (new Set(NADIMCI_POCETNOG_FONDA_V3.map(({ nadimak }) => nadimak.toLocaleLowerCase('hr-HR'))).size !== 40) throw new Error('Početni fond v3 mora imati 40 različitih nadimaka.');
