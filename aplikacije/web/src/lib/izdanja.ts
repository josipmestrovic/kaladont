export interface IzdanjeBiljeske {
  verzija: string;
  naslov: string;
  datum: string;
  uvod: string;
  novo: { naslov: string; stavke: string[] }[];
}

export const IZDANJA: IzdanjeBiljeske[] = [
  {
    verzija: 'v0.3.0-closed-alpha.1',
    naslov: 'Kaladont Multiplayer v0.3.0 – Closed Alpha 1',
    datum: '15. rujna 2026.',
    uvod: 'Treće zatvoreno izdanje objedinjuje trajni XP, dostignuća, mode-aware rangove i Kaladont DNK profil. Javni modovi sada imaju odvojene agregate, a završetak igre jasno prikazuje ostvareni napredak.',
    novo: [
      {
        naslov: 'Dostignuća i kolekcija',
        stavke: [
          'Dodano je devet dostignuća s ukupno 45 zvjezdica i jasnim pragovima napretka.',
          'Dostignuća se prikazuju unutar vlastitog i javnog profila, uz razinu i sljedeći cilj.',
          'Rijetke riječi, duge riječi i streak mogu napredovati i u privatnim sobama.',
          'Nova dostignuća obračunavaju se server-side i spremaju transakcijski na kraju igre.',
        ],
      },
      {
        naslov: 'Kaladont DNK',
        stavke: [
          'Nakon 10 javnih igara otključava se profil igre kroz šest osi: Vještina, Taktika, Fokus, Brzina, Duge riječi i Rijetke riječi.',
          'Četiri igrača i 1v1 imaju odvojene statistike, pragove, rangove i DNK profile.',
          'Brzina koristi stvarni prosjek trajanja prihvaćenih poteza, spremljen po modu; povijesni potezi su backfillani.',
          'Na kraju igre prikazuje se kompaktni graf s delta promjenama, starim vrijednostima i strelicama prema novim vrijednostima.',
        ],
      },
      {
        naslov: 'Profil i privatne sobe',
        stavke: [
          'Profil sada ima poglede Statistika, Dostignuća, Riječi i Povijest.',
          'Gornji rang i border uvijek koriste viši rang između 4-player i 1v1 moda.',
          'Dodani su stil igre, detaljniji profilni sažetak i šira integracijska pokrivenost privatnih soba.',
          'Završni ekran prikazuje DNK napredak, nova dostignuća, XP obračun, plasmane i povijest poteza.',
          'Red čekanja ima eksplicitnu sinkronizaciju stanja za 2-player i 4-player mod.',
        ],
      },
    ],
  },
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
          'Konfeti i završni efekti ne mijenjaju bodove ni ishod igre.',
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
          'Registrirani igrači imaju javni profil dostupan s ljestvice i završetka igre.',
        ],
      },
      {
        naslov: 'Gamifikacija i u privatnoj sobi',
        stavke: [
          'Privatne sobe također otključavaju riječi, rewarde i streak dostignuća.',
          'Privatne igre ne utječu na klasične bodove, pobjede, rang ni javnu ljestvicu.',
          'Pobjednik svake igre dobiva završnu proslavu s konfetima.',
        ],
      },
    ],
  },
  {
    verzija: 'v0.1.0-closed-alpha.1',
    naslov: 'Kaladont Multiplayer v0.1.0 – Closed Alpha 1',
    datum: 'Prvo zatvoreno izdanje',
    uvod: 'Prvi zatvoreni multiplayer test Kaladonta. Ovo izdanje služi za provjeru cijelog toka igre s manjom grupom testera: od registracije i ulaska u red do završetka igre, ljestvice i privatnih soba.',
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
          'Registrirani korisnik kroz profil vidi svoju statistiku i povijest igara.',
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
  },
];
