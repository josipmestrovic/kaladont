const SAVJETI_ZAJEDNICKI = [
  'Nakon 10 završenih partija dobivaš rang prema prosjeku bodova. Do tada si Piskaralo.',
  'Igrač koji ne zna riječ ispada, osim kod Kaladonta: tada ispada onaj tko je omogućio „ka”.',
  'Radi pravednosti, sustav uvijek određuje prvu riječ i bira samo riječ koja ima slobodan nastavak.',
  'Sustav ne bira riječ koja bi mogla postaviti klopku bez nastavka — osim ako su sve riječi već potrošene.',
  'U Kaladontu igraju isključivo ljudi — nema botova i ne planiramo ih dodavati.',
  'Kaladont je multiplayer igra koja je besplatna i uvijek će biti besplatna.',
  'Posjeti forum.kaladont.hr i sudjeluj u razvoju igre, raspravama i prijedlozima novih funkcionalnosti.',
  'Igra je u ranom pristupu, zato molimo za razumijevanje i malo strpljenja dok aktivno radimo na novim funkcionalnostima.',
] as const;

const SAVJETI_CETIRI_IGRACA = [
  'U igri za četiri igrača plasman, eliminacije i pobjednički bonus ulaze u bodovanje.',
  'Savršena partija za četiri igrača nosi 7 bodova: pobjeda, bonus i sve 3 eliminacije.',
  'Najviši rang za četiri igrača zove se Kaladont i traži prosjek 5,70 ili više.',
] as const;

const SAVJETI_DVA_IGRACA = [
  'U dvoboju pobjeda donosi 1 bod, a poraz 0 bodova.',
  'Dvoboj ima vlastiti rang i statistiku, odvojene od igre za četiri igrača.',
  'Najviši rang u dvoboju zove se Kaladont i traži prosjek 0,89 ili više.',
] as const;

export function dohvatiSavjete(mod: 'cetiri_igraca' | 'dva_igraca'): readonly string[] {
  return mod === 'dva_igraca'
    ? [...SAVJETI_DVA_IGRACA, ...SAVJETI_ZAJEDNICKI]
    : [...SAVJETI_CETIRI_IGRACA, ...SAVJETI_ZAJEDNICKI];
}
