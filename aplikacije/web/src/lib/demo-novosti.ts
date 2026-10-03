export interface NovostiStavka {
  tekst: string;
  nastavak?: string;
  istaknuto?: boolean;
}

export interface NovostiOdjeljak {
  naslov: string;
  stavke: NovostiStavka[];
}

export const DEMO_BILJESKE: {
  naslov: string;
  odjeljci: NovostiOdjeljak[];
  zavrsnaPoruka: string;
} = {
  naslov: 'Kaladont DEMO',
  odjeljci: [
    {
      naslov: 'Igraj s ekipom',
      stavke: [
        { tekst: 'igraj Dvoboj jedan na jedan, Četveroboj u četvero ili privatno s 2 do 8 igrača.' },
      ],
    },
    {
      naslov: 'Kako napreduješ u igri',
      stavke: [
        {
          tekst: 'izradi svoj avatar',
          nastavak: ': biraj izgled i boje, a kasnije ga mijenjaj kad god želiš.',
          istaknuto: true,
        },
        { tekst: 'skupljaj iskustvo i prelazi nove razine.' },
        { tekst: 'otključaj značke i skupljaj zvjezdice.' },
        { tekst: 'skupljaj duge i rijetke riječi.' },
        { tekst: 'pobjede zaredom donose ti više iskustva.' },
        { tekst: 'pogledaj svoje pobjede, rekorde i odigrane igre.' },
        { tekst: 'saznaj što ti najbolje ide uz Kaladont DNK.' },
        { tekst: 'osvajaj rangove i penji se na ljestvicama.' },
      ],
    },
    {
      naslov: 'Pristupačnost',
      stavke: [
        { tekst: 'isprobaj font za disleksiju ili poslušaj nove riječi naglas.' },
      ],
    },
  ],
  zavrsnaPoruka:
    'Pošalji prijedlog ili prijavi riječ koju igra pogrešno prihvaća, riječ koju pogrešno odbija ili igrača s uvredljivim nadimkom.',
};