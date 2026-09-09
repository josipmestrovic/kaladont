# Zajednica i javni rani pristup

## Odluka

Kaladont se otvara kao **javni rani pristup**: svatko može odmah ući u red i igrati, a igra se jasno označava kao aktivno testirana. Ovo nije zatvorena beta jer pristup igri nije tehnički ograničen.

Forum na adresi `forum.kaladont.hr` središnje je mjesto zajednice: okuplja igrače, omogućuje dogovor za partije te daje prostor za raspravu o rječniku, pravilima i razvoju. Forum ne zamjenjuje strukturiranu prijavu greške unutar igre.

## Ciljevi

1. Dovesti prve stvarne igrače do dovršenih partija bez kupnje oglasa.
2. Smanjiti prazna čekanja tako da se igrači mogu javno dogovoriti za partiju.
3. Brzo prikupiti kvalitetne prijave rječničkih pogrešaka i povratne informacije.
4. Validirati organsku potražnju prema pragovima u [metrike-uspjeha.md](../01-proizvod/metrike-uspjeha.md).

## Publika i poruka

Primarna publika su nostalgičari koji pamte Kaladont iz auta, učenici i studenti koji žele kratko nadmetanje te jezični entuzijasti. U vanjskim objavama polazna poruka je: „Kaladont iz auta, sada kao hrvatska igra riječi za četvero. Imaš 30 sekundi da smisliš nastavak.”

Ton ostaje prijateljski, kratak i na hrvatskom, prema [vizualni-identitet.md](../05-ux-ui/vizualni-identitet.md). Ne stvaramo umjetnu hitnost i ne obećavamo pun red: stvarno stanje čekanja uvijek je vidljivo u aplikaciji.

## Forum

### Pristup i identiteti

- Forum je javno čitljiv; za otvaranje tema i odgovaranje potreban je potvrđen Discourse račun.
- Račun foruma i račun igre su odvojeni. Ne uvodimo SSO i ne prenosimo podatke između sustava.
- Ne šaljemo newsletter ni beta-obavijesti emailom. Važne promjene objavljuju se na forumu.
- Javne teme ne smiju sadržavati email adrese, osobne podatke ni osjetljive pojedinosti o prijavama.

### Početne kategorije

| Kategorija          | Namjena                                     | Prava objave         |
| ------------------- | ------------------------------------------- | -------------------- |
| Obavijesti          | Verzije, status igre i važne promjene       | Samo osoblje         |
| Dogovori za igru    | Pronalaženje preostala tri igrača           | Registrirani članovi |
| Rječnik i pravila   | Rasprava o riječima, grafemima i pravilima  | Registrirani članovi |
| Prijedlozi i greške | Opće povratne informacije o iskustvu        | Registrirani članovi |
| Ostalo o riječima   | Jezične zanimljivosti i neformalna rasprava | Registrirani članovi |

Prvog dana objavljuju se i prikvače: dobrodošlica s pravilima ponašanja, uputa za dogovor partije, uputa za prijavu pogrešne presude, status ranog pristupa i dnevnik promjena.

### Moderiranje

Za forum se izdvaja najmanje pet sati tjedno:

- svaki dan pregledati prijave sadržaja i nove članove;
- dvaput tjedno odgovoriti na otvorena pitanja i povratne informacije;
- jednom tjedno objaviti kratak razvojni sažetak;
- prijave koje trebaju identifikator partije, poteza ili osobne podatke preusmjeriti na postojeći gumb „Prijavi” u igri;
- odluke koje mijenjaju pravila igre ili arhitekturu zapisati u `docs/` prije implementacije.

## Infrastruktura i zaštita

Discourse radi na zasebnom VPS-u s vlastitim volumenima, bazom, dnevnim backupom i nadzorom. DNS zapis `forum.kaladont.hr` pokazuje na taj VPS, a reverse proxy izdaje i obnavlja TLS certifikat. Prekid foruma ne smije ugroziti igru na `kaladont.hr`.

Prije javnog otvaranja uključiti Discourseovu potvrdu emaila, zaštitu protiv spama, ograničenja za nove članove, prijavu sadržaja, razine povjerenja i dvofaktorsku prijavu za administratore. Testirati obnovu backupa prije lansiranja.

## Kanali dolaska

1. **Poznanici i osobne mreže:** prvi poziv na forumsku dobrodošlicu i nekoliko odigranih partija.
2. **Reddit i Forum.hr:** tek nakon stabilnog prvog vala; svaka zajednica dobiva izvornu objavu koja poštuje pravila samopromocije.
3. **Lokalne Discord i Facebook zajednice:** zajednice za kvizove, društvene igre i studente, samo uz dopuštenje moderatora.

Ne koristimo masovne privatne poruke, identične kopirane objave, plaćene oglase ni globalne launch platforme dok lokalni organski promet ne pokaže stvarnu potražnju.

## Tok korisnika

1. Posjetitelj dolazi na naslovnicu i vidi da je Kaladont u ranom pristupu.
2. Može odmah kliknuti „IGRAJ” i ući u red.
3. Poziv „Pridruži se zajednici” vodi na `https://forum.kaladont.hr`.
4. Na forumu može čitati bez računa; račun otvara tek kada želi sudjelovati.
5. Dogovara partiju, raspravlja ili daje povratnu informaciju.
6. Grešku u presudi prijavljuje kroz igru, gdje se automatski vežu partija i potez.

## Mjerenje i odluke

Javni rani pristup počinje s podacima igre: završene partije, čekanje u redu, D1/D7 povratak i prijave po 100 partija. Aktivnost foruma promatra se zasebno. Ti su podaci dovoljni za prve odluke o kvaliteti i zadržavanju igrača.

Nakon stabilizacije uključuje se Umami bez kolačića. Tada dodatno mjerimo izvore prometa, klikove na „IGRAJ” te anonimne događaje `forum-klik-landing` i `forum-klik-o-igri`. Ne šalju se identifikatori korisnika, emailovi ni sadržaj objava. Umami nije preduvjet javnog starta ([ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md)).

Prije šireg javnog poziva prvi val mora odigrati najmanje 20 partija bez kritične greške. Nakon četiri tjedna javnog ranog pristupa koristimo postojeće pragove:

- najmanje 30 organskih partija dnevno i D7 najmanje 10 %: nastavljamo prema v2;
- D1 ispod 20 %: popravljamo čekanje i balans prije novih značajki;
- manje od 5 partija dnevno unatoč promociji: preispitujemo akvizicijske kanale.

## Izvan opsega

- SSO između foruma i igre.
- Newsletter i email kampanje.
- Tehničko ograničavanje pristupa igri.
- Botovi u redu čekanja.
- Plaćeno oglašavanje.
- Slobodni tekstualni chat tijekom partije.
