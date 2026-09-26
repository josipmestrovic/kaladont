export interface IzdanjeBiljeske {
  verzija: string;
  naslov: string;
  datum: string;
  uvod: string;
  novo: { naslov: string; stavke: string[] }[];
}

export const IZDANJA: IzdanjeBiljeske[] = [
  {
    verzija: 'v0.5.0-closed-alpha',
    naslov: 'Kaladont Multiplayer v0.5.0 – Closed Alpha',
    datum: '26. rujna 2026.',
    uvod: 'Peto zatvoreno izdanje završava profilni CV i biografsko razmišljanje o igraču, uvodi stabilnije prikaze staza i formi te dodatno usklađuje javni i privatni profil s novim sadržajem.',
    novo: [
      {
        naslov: 'CV profil je sada čisti biografski odlomak',
        stavke: [
          'U sažetku profila ostaje samo jedan biografski paragraf bez naslova, rangova, razina, forme i rezultata.',
          'Staž se prikazuje kao završna rečenica na kraju teksta, a ne kao zaseban blok u headeru.',
          'Kod gostiju i nekompletnog profila prikazuje se samo odgovarajuća poruka bez dodatnog sadržaja.',
          'Dodana je i pravilna logika razvrstavanja 28+ dana, s tjednima i 30-dnevnim mjesečnim prijelazima.',
        ],
      },
      {
        naslov: 'Jasnije i sigurnije poslovanje s profilom',
        stavke: [
          'Poboljšan je javni i privatni prikaz CV-a, uključujući ispravno poravnanje i responzivno ponašanje na mobilu.',
          'Rijetka riječ ostaje podržana kao fallback, a najduža riječ i dalje je primarni dokaz u biografiji.',
          'Odbacene su poslovne i “CV” reference u opisima: tekst više zvuči kao biografija igrača nego kao poslovni profil.',
        ],
      },
      {
        naslov: 'Dodatni stabilizacijski i sigurnosni rad',
        stavke: [
          'Ažurirane su migracije, validacije i profilni endpointi uz novi model podataka i dodatna provjera registriranog staža.',
          'Pojačana je stabilnost reda čekanja, privatnih soba i load-bot tokova.',
          'Dodane su i dopunske testne pokrivenosti za CV, formu, DNK, profil i rječnik.',
        ],
      },
    ],
  },
  {
    verzija: 'v0.4.0-closed-alpha.1',
    naslov: 'Kaladont Multiplayer v0.4.0 – Closed Alpha 1',
    datum: '25. rujna 2026.',
    uvod: 'Četvrto zatvoreno izdanje donosi osobnije avatare, dodatni XP za pobjednički niz i pravednije početke rundi. Sada možeš poslati i svoje mišljenje o igri te napredovati kroz novo dostignuće Glas zajednice.',
    novo: [
      {
        naslov: 'Avatar po tvojoj mjeri',
        stavke: [
          'Pri registraciji možeš sastaviti vlastiti avatar birajući izgled i boje.',
          'Avatar možeš uređivati i kasnije u profilu.',
          'Gumb Nasumično predlaže novu kombinaciju.',
        ],
      },
      {
        naslov: 'Niz pobjeda donosi dodatni XP',
        stavke: [
          'Uzastopne pobjede donose sve veći postotni bonus na XP za pobjedničku partiju.',
          'Bonus počinje od druge pobjede zaredom: +10% u igri za četiri igrača i +5% u dvoboju.',
          'Nizovi se prate zasebno za svaki način igre, a bonus može narasti do +100%.',
          'U profilu i redu možeš vidjeti svoj niz i bonus koji donosi sljedeća pobjeda.',
          'Ovaj bonus vrijedi za niz pobjeda i odvojen je od niza prihvaćenih riječi tijekom partije.',
        ],
      },
      {
        naslov: 'Lakši povratak u račun',
        stavke: [
          'Ako zaboraviš lozinku, možeš zatražiti poveznicu za njezinu promjenu.',
          'Lozinku tijekom upisa možeš privremeno prikazati ili sakriti.',
          'Potvrda emaila dovršava se kroz jasnu stranicu u igri.',
        ],
      },
      {
        naslov: 'Pošteniji početak runde',
        stavke: [
          'Od 52 odobrene početne riječi bira se ona čiji svaki dopušteni prvi odgovor ima barem jedan slobodan nastavak.',
          'Ako nijedna nije dostupna, pričuvna riječ jamči barem jedan valjani odgovor, ali ne i nastavak nakon svakog odgovora.',
          'Provjera uzima u obzir već odigrane oblike i vrijedi i u privatnim partijama.',
        ],
      },
      {
        naslov: 'Pošalji svoje mišljenje',
        stavke: [
          'Registrirani igrači mogu poslati povratnu informaciju iz igre.',
          'Pri prvom slanju mogu ocijeniti pravila, rječnik, vrijeme za potez, snalaženje, brzinu učitavanja i gamifikaciju.',
          'Svaka poslana povratna informacija napreduje dostignuće Glas zajednice, koje ima pet razina.',
        ],
      },
    ],
  },
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
