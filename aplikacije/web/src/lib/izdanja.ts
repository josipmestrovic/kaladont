export interface IzdanjeBiljeske {
  verzija: string;
  naslov: string;
  datum: string;
  uvod: string;
  novo: { naslov: string; stavke: string[] }[];
  testirati: string[];
  ogranicenja: string[];
}

export const IZDANJA: IzdanjeBiljeske[] = [
  {
    verzija: 'v0.2.0-closed-alpha.1',
    naslov: 'Kaladont Multiplayer v0.2.0 – Closed Alpha 1',
    datum: '14. rujna 2026.',
    uvod: 'Drugo zatvoreno izdanje donosi prve trenutke u kojima igra slavi tvoje jezične pothvate. Pronađi dugu ili rijetku riječ, izgradi streak bez odbijanja i otključaj riječi koje ostaju zabilježene na tvom profilu.',
    novo: [
      {
        naslov: 'Riječi koje donose nagradu',
        stavke: [
          'Duga riječ donosi konfete, zvuk i poruku u igri.',
          'Rijetka riječ donosi jaču proslavu; riječ koja je i duga i rijetka dobiva jedan zajednički, veći efekt.',
          'Nagrada se dobiva samo prvi put kada igrač otključa leksemsku grupu.',
          'Konfeti i završni efekti ne mijenjaju bodove ni ishod partije.',
        ],
      },
      {
        naslov: 'Streak bez odbijanja',
        stavke: [
          'Svaka uzastopno prihvaćena riječ povećava tvoj trenutni streak.',
          'Odbijena riječ ga vraća na nulu.',
          'Vatre pokazuju koliko je niz velik, a najduži streak ostaje zapisan na profilu.',
        ],
      },
      {
        naslov: 'Otključaj svoj rječnik',
        stavke: [
          'Otključane leksemske grupe pamte se kroz cijeli život igrača.',
          'Ista riječ ili drugi oblik iste leksemske grupe ne daje novu nagradu u kasnijoj partiji.',
          'Na profilu možeš otvoriti popis dugih i rijetkih riječi po razinama.',
        ],
      },
      {
        naslov: 'Profil koji pamti tvoje pothvate',
        stavke: [
          'Profil sada prikazuje napredak kroz duge i rijetke riječi.',
          'Prikazane su najduža i najrjeđa odigrana riječ te najduži streak.',
          'Registrirani igrači imaju javni profil dostupan s ljestvice i završetka partije.',
        ],
      },
      {
        naslov: 'Gamifikacija i u privatnoj sobi',
        stavke: [
          'Privatne sobe također otključavaju riječi, rewarde i streak dostignuća.',
          'Privatne partije ne utječu na klasične bodove, pobjede, rang ni javnu ljestvicu.',
          'Pobjednik svake partije dobiva završnu proslavu s konfetima.',
        ],
      },
    ],
    testirati: [
      'Odigraj dugu riječ, rijetku riječ i riječ koja je istovremeno duga i rijetka.',
      'Napravi nekoliko prihvaćenih poteza, zatim namjerno pogriješi i provjeri reset streaka.',
      'Odigraj istu leksemsku grupu u dvije partije i provjeri da se reward ne ponavlja.',
      'U privatnoj sobi otključaj riječ i provjeri da se dostignuće vidi na profilu, bez promjene ranga.',
      'Na profilu otvori odvojene popise dugih i rijetkih riječi.',
      'Provjeri završne konfete kao pobjednik javne i privatne partije.',
    ],
    ogranicenja: [
      'Ovo je i dalje closed alpha izdanje namijenjeno ograničenoj grupi testera.',
      'Partije odigrane prije ovog izdanja nemaju retroaktivno spremljene konkretne popise otključanih riječi.',
      'Reward zvukovi rade kada su pripadajući audio asseti dostupni u klijentu.',
      'Produkcija nije dio ovog izdanja; staging se provjerava odvojeno.',
    ],
  },
  {
    verzija: 'v0.1.0-closed-alpha.1',
    naslov: 'Kaladont Multiplayer v0.1.0 – Closed Alpha 1',
    datum: 'Prvo zatvoreno izdanje',
    uvod: 'Prvi zatvoreni multiplayer test Kaladonta. Ovo izdanje služi za provjeru cijelog toka igre s manjom grupom testera: od registracije i ulaska u red do završetka partije, ljestvice i privatnih soba.',
    novo: [
      {
        naslov: 'Javni modovi igre',
        stavke: [
          'Dodan je Klasični mod za 4 igrača.',
          'Dodan je mod za 2 igrača, jedan protiv jednog.',
          'Svaki mod ima zasebne statistike, bodovanje, rangove i ljestvicu.',
          'U Klasičnom modu bodovi ovise o plasmanu i izazvanim eliminacijama.',
          'U modu za 2 igrača pobjednik dobiva 1 bod, a poraženi 0 bodova.',
        ],
      },
      {
        naslov: 'Privatne sobe',
        stavke: [
          'Možeš stvoriti privatnu sobu i podijeliti pozivnu poveznicu s ekipom.',
          'Soba podržava od 2 do 8 igrača.',
          'Vlasnik sobe može prilagoditi tajmer, bodove za eliminacije, dopuštene vrste riječi, osnovne oblike i minimalnu duljinu riječi.',
          'Privatna soba vodi privremenu ljestvicu po bodovima i pobjedama.',
          'Rezultati privatnih soba ne utječu na globalni rang ni javne ljestvice.',
        ],
      },
      {
        naslov: 'Računi i profil',
        stavke: [
          'Gosti koriste naziv Gost i zajednički gost avatar.',
          'Registracija uključuje odabir nadimka i avatara.',
          'Registrirani korisnik kroz profil vidi svoju statistiku i povijest partija.',
        ],
      },
      {
        naslov: 'Pravila i sučelje',
        stavke: [
          'Pravila igre ažurirana su za oba javna moda, grafeme, leksemske grupe i privatne sobe.',
          'Dodane su stranice Uvjeti korištenja i Pravila privatnosti.',
          'Naslovnica prikazuje oznaku closed alpha izdanja.',
        ],
      },
    ],
    testirati: [
      'Registraciju novog računa, nadimak i avatar.',
      'Prijavu i odjavu kroz izbornik avatara.',
      'Ulazak četvero igrača u mod za 4 igrača.',
      'Ulazak dvoje igrača u mod za 2 igrača.',
      'Prihvaćanje i odbijanje riječi, timer, predaju poteza i eliminacije.',
      'Bodove, statistiku i ljestvicu za oba javna moda.',
      'Stvaranje privatne sobe, dijeljenje poveznice, prilagodbu pravila i više uzastopnih partija.',
      'Stranice Pravila, O igri, Uvjeti korištenja i Pravila privatnosti.',
    ],
    ogranicenja: [
      'Ovo je closed alpha izdanje namijenjeno ograničenoj grupi testera.',
      'Privatne sobe i njihove ljestvice žive samo dok je soba aktivna.',
      'Uvjeti korištenja i Pravila privatnosti bit će dopunjeni prije šireg otvaranja igre.',
      'Produkcijsko okruženje još nije objavljeno.',
    ],
  },
];
