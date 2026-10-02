# Kaladont Multiplayer v0.5.0 – Closed Alpha 1

Peto zatvoreno izdanje pretvara profil u kratak, činjeničan prikaz igračeva puta. Donosi preglednija dostignuća, pouzdanije praćenje partije te opcionalno prilagođavanje fonta i čitanje novih riječi naglas.

## Novo

### Biografski profil Kaladont

- Vlastiti i javni profil prikazuju isti dvorečenični uvod: broj javnih partija u Dvoboju i Četveroboju te najvišu trenutačnu titulu i način na kojem je ostvarena.
- Pored uvoda se prikazuju provjerljive istaknutosti, odvojeno od biografskog teksta. Popis ima dvije ili tri stavke i skriva se ako nema barem dvije pouzdane činjenice.
- Staž registracije prikazuje se samo registriranim igračima; gost vidi svoje dostupne statistike i zaseban poziv na registraciju, bez registracijskog staža.
- Javni profil i dalje je dostupan samo registriranim igračima; privatni podaci poput emaila ne postaju javni.

### Istaknuta dostignuća i forma

- U zaglavlju profila prikazuju se najviše tri istaknuta dostignuća s najmanje dvije zvjezdice; klikom ili tipkovnicom možeš otvoriti opis i napredak do sljedeće razine.
- Izbor daje prednost dostignućima viših razina, a za jednake razine koristi unaprijed određen redoslijed.
- Forma i nizovi pobjeda prikazuju se zasebno za Dvoboj i Četveroboj; istaknutosti se biraju iz postojećih javnih rezultata, rekorda i kolekcije riječi.

### Nova ocjena partije

- Ocjena se dodjeljuje javnoj partiji samo kada igrač dobije osnovni XP; minimalni broj prihvaćenih poteza više nije uvjet.
- Partija s XP-om dobiva najmanje dvije zvjezdice, pobjeda dodaje dvije, a maksimum je pet zvjezdica.
- Ocjena utječe na XP bonus, ali ne mijenja bodove ni rang. Već spremljene ocjene ne preračunavaju se.

### Prijavi igrača

- Sudionik može nakon završene javne partije prijaviti drugog igrača na provjeru.
- Prijave se pregledavaju u administratorskom sučelju; ne možeš prijaviti sebe, a privatne gamifikacijske partije nisu obuhvaćene.

### Stabilniji red poteza

- Sjedala se nasumično dodjeljuju na početku partije i nakon toga ostaju fiksna.
- Svaki igrač vidi isti red iz svoje perspektive, sa svojim sjedalom prvim; promjena poteza ne premješta avatare.
- Eliminirani igrači ostaju na mjestu do kraja partije, uključujući nakon ponovnog spajanja.

### Pristupačnost po izboru

- Prekidač **Font za disleksiju** primjenjuje OpenDyslexic na sučelje.
- Prekidač **Čitanje naglas** izgovara samo novu riječ na stolu, ne poruke sučelja; glas je zadano isključen.
- Obje su opcije dostupne gostima i registriranim igračima na naslovnici i u grupi Pristupačnost u Postavkama. Odabir se pamti lokalno u pregledniku, ne na računu.
- Čitanje traži hrvatski glas `hr-HR`; raspoloživost glasa ovisi o pregledniku i uređaju.

## Što testirati

1. Usporedi vlastiti i javni profil registriranog igrača te provjeri dvorečenični uvod i istaknute činjenice.
2. Provjeri prikaz gosta bez registracijskog staža i bez izmišljenih istaknutosti.
3. Otvori dostignuće mišem, dodirom i tipkovnicom te provjeri opis i napredak.
4. U javnoj partiji provjeri ocjenu uz dodijeljeni XP, pobjednički bonus i postojeću ocjenu koja se ne mijenja retroaktivno.
5. Nakon javne partije prijavi drugog igrača i provjeri administratorski pregled; potvrdi da se ista prijava ne može ponoviti.
6. U partiji prati red sjedala kroz poteze, eliminaciju i ponovno spajanje.
7. Uključi font i čitanje naglas odvojeno; provjeri dijakritike, pohranu u pregledniku i da TTS ne čita poruke sučelja.

## Poznata ograničenja

- OpenDyslexic i glasovne postavke vezane su uz preglednik/uređaj i ne sinkroniziraju se s računom.
- Web Speech API ne jamči hrvatski glas na svakom pregledniku ili uređaju; igra ostaje uporabiva i bez njega.
- Postojeće ocjene partija zadržavaju vrijednosti izračunate po tada važećem pravilu.
- Ova bilješka ne potvrđuje staging provjeru ni produkcijsku objavu; operativni status vodi se zasebno prema release-shemi.

## Tehnički podaci

Puni commit SHA, GHCR digest i workflow unose se nakon odabira i provjere službenog kandidata. Operativni status se vodi odvojeno prema [release shemi](release-shema.md); ovaj dokument ne stvara GitHub tag ni objavu.