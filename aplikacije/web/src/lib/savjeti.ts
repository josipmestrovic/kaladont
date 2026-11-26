const SAVJETI_ZAJEDNICKI = [
  // PR09: jedan univerzalni rang nakon 10 javnih partija.
  'Nakon 10 završenih javnih igara dobivaš rang prema univerzalnom učinku. Do tada si Piskaralo.',
  'Igrač koji ne zna riječ ispada, osim kod Kaladonta: tada ispada onaj tko je omogućio „ka”.',
  'Radi pravednosti, sustav uvijek određuje prvu riječ i bira samo riječ koja ima slobodan nastavak.',
  'Sustav ne bira riječ koja bi mogla postaviti klopku bez nastavka — osim ako su sve riječi već potrošene.',
  'U Kaladontu igraju isključivo ljudi — nema botova i ne planiramo ih dodavati.',
  'Kaladont je multiplayer igra koja je besplatna i uvijek će biti besplatna.',
  'Posjeti forum.kaladont.hr i sudjeluj u razvoju igre, raspravama i prijedlozima novih funkcionalnosti.',
  'Igra je u ranom pristupu, zato molimo za razumijevanje i malo strpljenja dok aktivno radimo na novim funkcionalnostima.',
] as const;

const SAVJETI_CETIRI_IGRACA = [
  'U Četveroboju plasman, eliminacije i pobjednički bonus ulaze u bodovanje.',
  'Savršena igra u Četveroboju nosi 7 bodova: pobjeda, bonus i sve 3 eliminacije.',
  'Najviši rang zove se Kaladont i traži univerzalni učinak 178 ili više.',
] as const;

const SAVJETI_DVA_IGRACA = [
  'U dvoboju pobjeda donosi 1 bod, a poraz 0 bodova.',
  'Rang je zajednički za sve javne formate — Dvoboj, Brza igra i Četveroboj grade isti učinak.',
  'Najviši rang zove se Kaladont i traži univerzalni učinak 178 ili više.',
] as const;

export function dohvatiSavjete(mod: import('zajednicko').ModPartije): readonly string[] {
  if (mod === 'dva_igraca') return [...SAVJETI_DVA_IGRACA, ...SAVJETI_ZAJEDNICKI];
  if (mod === 'cetiri_igraca') return [...SAVJETI_CETIRI_IGRACA, ...SAVJETI_ZAJEDNICKI];
  // Troboj savjeti dolaze u PR14; do tada samo zajednički.
  return [...SAVJETI_ZAJEDNICKI];
}
