# Botovi i Zagrijavanje — pravila ponašanja

Dopuna [pravila igre](pravila-igre.md) prema [ADR-017](../03-arhitektura/odluke/017-botovi-i-zagrijavanje.md). Vrijedi za javne partije s botovima i za trening.

## Popuna javnog reda

Vrijeme se računa na poslužitelju od `usaoU` **najstarijeg prisutnog čovjeka** u nepotpunoj grupi. Bot nikada nije vremensko polazište; dolazak novog čovjeka ne resetira čekanje ostalih.

U redovnom radu jedini aktivan javni red je **Brza igra** (Troboj + Klasični): pragovi **10 s / 20 s** bez jittera. Ostali formati ostaju u katalogu za Trening/privatno i kasnije uključivanje; njihovi pragovi (Dvoboj ~30 s, Četveroboj 20/30/40 s s odstupanjem) vrijede tek ako se ponovno aktiviraju.

<!-- HINT: Brza igra = 10/20 s Troboj; katalog 8 redova ostaje. -->

| Situacija | Ponašanje |
| --- | --- |
| Dvoboj, jedan čovjek | Čeka do 30 s; na 30 s slobodan bot popunjava mjesto. |
| Dvoboj, drugi čovjek stigne prije pokretanja | Igraju dva čovjeka; rezervirani bot se oslobađa. |
| Troboj, 2 čovjeka | Jedan bot na 10 s i početak. |
| Troboj, 1 čovjek | Bot na 10 s; drugi na 20 s i početak. |
| Troboj, 3 čovjeka | Početak odmah. |
| Četveroboj, 3 čovjeka | Jedan bot na 20 s i početak. |
| Četveroboj, 2 čovjeka | Bot na 20 s; drugi na 30 s i početak. |
| Četveroboj, 1 čovjek | Botovi na 20 s, 30 s i 40 s; početak na 40 s. |
| Četveroboj, 4 čovjeka | Početak odmah. |
| Novi ljudi između pragova | Popune mjesta; početak čim je grupa puna. |
| Najstariji čovjek ode | Rokovi se računaju prema sljedećem najstarijem; višak rezerviranih botova se oslobađa. |
| Posljednji čovjek ode | Sve rezervacije grupe se oslobađaju. |
| Nema slobodnog bota | Čeka se dalje; ponovno se razmatra kad se bot oslobodi. |

Pragovi daju kumulativno najviše 1/2/3 bota u Četveroboju, 1/2 u Troboju i 1 u Dvoboju, uz fond. Nova javna partija ne nastaje bez barem jednog čovjeka. Nakon pokretanja partije nema zamjene sudionika.

Rezervirani bot prikazuje se u čekaonici kao sudionik koji čeka od trenutka rezervacije. Pri početku partije čekaonica preuzima puna sjedala iz serverske poruke početka, tako da tijekom odbrojavanja prikazuje i konačne botove. Prikaz ne mijenja autoritativne rokove.

Namjera čovjeka da čeka prati se odvojeno od članstva u socket sobi. Neuspješan početak vraća samo još povezane ljude s istom generacijom ulaska, bez promjene izvornog vremena čekanja. Izlazak ili promjena konteksta poništava namjeru; ponavljanje neuspjelog početka ima ograničen odmak, ne trenutačnu petlju.

## Pravila za bota u partiji

Tehnički oporavak dopušta najviše dva ponovna pokušaja nakon početnog pokušaja za isti token. Svaki pokušaj provjerava aktualno stanje motora; uspješan potez ne ponavlja se. Odbijena riječ izuzima se iz sljedećeg izbora. Trajni kvar prekida igru bez dodjele pobjede ili natjecateljskih nagrada, ne pretvara se u „Ne znam”.

Samo u lokalnom razvojnom okruženju (`NODE_ENV=development`), radi bržeg testiranja javnog Dvoboja i Četveroboja, sva potrebna mjesta popunjavaju se botovima nakon 1 s čekanja. `BOTOVI_BRZI_RAZVOJ` ubrzava **samo popunu reda**; tempo poteza bota ostaje ~4 s (±0,3 s) i u developmentu. Staging i produkcija zadržavaju redovne pragove popune; `test` ne koristi slučajna odstupanja popune. Eksplicitni pragovi pojedinačnih testova imaju prednost.

- Bot igra po **istim pravilima** kao čovjek: isti potez, timer, validacija, leksemske grupe, eliminacija, Kaladont-efekt i faza **dokaza** (Dokaži nastavak). Broj aktivnih utječe na rizik završetka „ka”. Potezi ljudi i botova prolaze istu obradu na poslužitelju.
- Bot bira riječ iz **zajedničkog ograničenog repertoara** (do 256 glavnih + 256 rezervnih po početnom prefiksu), s prednošću osnovnog oblika i jednim predstavnikom po leksičkoj grupi. Legalnost i validacija i dalje prolaze puni autoritativni rječnik; riječ izvan repertoara može čovjeku biti valjana, ali je bot ne „zna”.
- **Ograničena taktika (politika v7):** u zadano 25 % poteza bot ponderirano uzorkuje najviše 12 poznatih kandidata u radnom uzorku (do 100) i ocjenjuje najviše jedan nastavak unaprijed (samo iz repertoara). Preferira izbjegavanje vlastite eliminacije, ponekad teže završetke (uključujući poznate „opasne” završetke) i, u Klasičnom/KA-ZNI, ponekad teži završetak na „ka”. Procjena je ista neovisno o tome je li sljedeći igrač čovjek ili bot; bot ne cilja identitet protivnika.
- **Izbor riječi (politika v7):** prvo se filtriraju „poznate” riječi iz repertoara (isključene su jako rijetke i one od 15+ grafema; duljine 10–14 imaju jači soft ponder). Opcije se broje po **leksemskim grupama** (padeži iste riječi = jedna opcija). Među poznatim uobičajenim osnovnim oblicima zadano 90 % bira imenicu, a 10 % glagol ili pridjev. U Dokaži na **običnom potezu** bot (javni default) igra samo riječ za koju u budžetu (12+12 detaljnih provjera) pronađe legalan poznat nastavak; inače „Ne znam”. Sve izabrane riječi prolaze postojeću serversku validaciju i leksemske zabrane ponavljanja.
- **Dokaži profili (Trening/Izazov, profil v2):** uz zajedničke poluge (taktika, neznanje, KA) profili skaliraju Dokaži budžet potvrde, širinu „malog” skupa, šansu preskoka potvrde i faktor propusta potvrde. Propust: ako postoji `n` neovisnih poznatih nastavaka, `P(fail) = min(0.95, faktor / n)` (manje nastavaka → veća šansa da potvrda padne). Početnik: neznanje 40 %, mali skup do 8, budžet 4+4, preskok 28 %, faktor 0.55. Iskusni: 18 % / 5 / 8+8 / 12 % / 0.30. Majstor: 8 % / 3 / 12+12 / 4 % / 0.12. Velemajstor: 3 % / 2 / 12+16 / 0 % / 0.05. Javni botovi zadržavaju strogi default (preskok 0, faktor 0, budžet 12+12).
- **Tempo (politika v5):** svi botovi (javna, privatna, trening) ciljaju **4 s** od početka poteza, s prezentacijskim jitterom ±0,3 s. Isti ugovor vrijedi za riječ, `kaladont`, dokaz i „Ne znam”. Vrijeme oduzima već proteklo; rok motora i sigurnosna margina imaju prednost. Zakašnjeli događaj ne pokreće novo razmišljanje. Već istekao rok ne zakazuje novu normalnu akciju. Identitet, duljina riječi i kontekst ne mijenjaju cilj.
- **Propust (kontekstualno, v7):** prazan poznati skup → „Ne znam”. Mali skup (1–N neovisne opcije bez česte ≥100; N po konfiguraciji/profilu, javno zadano 3) ima šansu za „Ne znam” **po turnTokenu** (uključujući fazu dokaza). Česta poznata opcija ili više od N neovisnih → uvijek odigra (osim Dokaži potvrde/preskoka). Isto izvlačenje ne ponavlja se pri oporavku ni refreshu rječnika za isti token. Tehnička greška poslužitelja nikad se ne prikazuje kao namjerni propust.
- **Namjerni istek:** uklonjen (politika v5). Botovi uvijek odigravaju unutar tempa; health polje `botNamjerniIsteci` ostaje 0.
- **KA:** bot prepoznaje KA i odigrava `kaladont` kad to pravila dopuštaju; u zadano 8 % slučajeva propusti tuđi „ka” i pokuša običnu riječ. Pri vlastitom izboru, tek među poznatim, u zadano 1,5 % slučajeva ostavlja riječ na „ka” ako postoji obična alternativa; ako su poznate samo na „ka”, odigra takvu riječ. U duelu/KA-ZNI preferira poznatu sigurniju (nije potvrđeno mrtva) pred čestom na „ka”. U **Dokaži nastavak** na običnom potezu bot **nikad** ne igra `kaladont` i **nikad** ne ostavlja riječ na „ka”; u fazi dokaza `kaladont` može biti valjan dokaz. Preferira riječ s poznatim legalnim nastavkom pred potvrđenom samoeliminacijom.
- Bot nikada ne dogovara igru s drugim botom niti namješta ishod čovjeku.
- **Brze poruke (svi konteksti):** obvezne. Na početku svaki bot jednom bira iz poola pozdrava (`Bok!` / `Ćao!` / `Hej!`). Kad bot eliminira nekoga — pool isprike (`Nemoj zamjerit` / `Oprosti!`). Kad bota eliminira zaslužni protivnik — pool pohvale (`Bravo!` / `Hvala` / `Svaka čast!`). Samoeliminacija i prekid bez zaslužnog protivnika → tišina. Odgoda je najmanje 2 s plus nasumično 0–1 s; cooldown 2 s po igraču (RS-22) redoslijedom pomiče preklapajuće poruke. Ljudski picker zadržava samo četiri klasične poruke.
- Nakon eliminacije čovjeka preostali botovi normalno dovršavaju javnu partiju; eliminirani čovjek može gledati.

Postoci su početne vrijednosti verzionirane konfiguracije i mijenjaju se nakon mjerenja, ne skrivenim promjenama u kodu.

Konfiguracija se snima za cijelu partiju pri prvom događaju motora. Kasnija izmjena ne mijenja postojeću partiju ni odluku za isti token. Promjena rječnika zadržava odabranu riječ ako je još legalna i ne izvlači novo kontekstualno neznanje za isti token. Stari env ključevi `BOT_VJEROJATNOST_NE_ZNAM`, `BOT_VJEROJATNOST_ISTEKA` i `BOT_NEZNANJE_PO_SUDJELOVANJU` više se ne čitaju.

Svi oblici odabrane skupine imaju pozitivan ponder `(1 + log1p(frekvencija)) × ponder duljine`. Najprije se filtriraju poznate riječi i klasificira veličina skupa po grupama, zatim među njima ide izbor KA/bez KA, oprez nastavka, pa preferencije vrste ili taktički uzorak. Dobrovoljni KA postotak vrijedi kada su obje skupine dostupne i bot igra riječ.

## Trajne admin postavke

Admin zapis sadrži samo podržane parametre ponašanja: pragove popune i odstupanja, gateove, fiksni tempo/jitter/odgodu reakcije (read-only u UI-ju uz marginu), ponder frekvencije/duljine/vrste, KA/propust, kontekstualno neznanje i taktiku, Dokaži budžet/preskok/propust potvrde (javni default), aktivni limit, oporavke, refresh retry, povijest protivnika i 4/5-minutnu neaktivnost. Stara polja tempa/izostanka/reakcija/neznanja po sudjelovanju (v3–v5) se pri učitavanju migriraju na politiku v6. Ne prihvaća proizvoljne env vrijednosti ili tajne. Spremanje zahtijeva očekivanu reviziju; neaktualna revizija vraća 409. Promjena i audit (revizija, postavke, administrator i vrijeme) zapisuju se u jednoj transakciji. Čitanje i pisanje zahtijevaju admin sesiju i koriste `Cache-Control: no-store`.

Postavke se učitavaju jednom pri pokretanju procesa. Ako trajni zapis još ne postoji, vrijede provjereni env zadani parametri; nedostupna baza nije povod za ignoriranje spremljenih postavki. Nakon uspješnog spremanja novi snapshot koristi se za nove partije, nove epizode reda i nove trening-aktivnosti; odluka, rok ili timer postojeće aktivnosti ne mijenjaju se. Isključivanje popune može odmah osloboditi rezervacije, ali ne prekida započetu igru. Brzi razvoj nije dopušten izvan `development`.

## Identitet javnog bota

- Dvoboj i Četveroboj dijele jednu promiješanu vrećicu identiteta. U osnovnom krugu svaki slobodan bot dobiva jednu priliku. Zauzeti ostaju u vrećici dok se ne oslobode; ako su svi preostali zauzeti, pomoćni promiješani izbor koristi druge slobodne botove bez dodatnog čekanja. Osvježavanje profila ne resetira krug ni generacije rezervacija. Na granici kruga izbjegava se isti posljednji bot kad postoji druga slobodna opcija.
- Među dostupnim kandidatima istog prioriteta izbjegavaju se posljednja dva različita bot-protivnika čovjeka, zajednički za oba moda, bez dodatnog čekanja. Povijest nastaje samo nakon uspješnog početka, istječe nakon 24 h, ograničena je na 50.000 zapisa i ne preživljava restart.
- Trajan profil, nadimak i avatar; statistika nastaje stvarnim odigranim javnim partijama.
- Prije sljedeće rezervacije nakon spremljene igre osvježavaju se agregati i stvarni nizovi za oba javna moda. Bot sa zastarjelim profilom ostaje nedostupan dok osvježavanje ne uspije; neuspjeh ne zaustavlja druge slobodne botove.
- Botovi nemaju javni profil, ne ulaze na ljudske ljestvice i ne dobivaju korisnički rang, XP, dostignuća ni misije. Ljudski rezultat u partiji s botovima ostaje valjan. Na završnom poretku bot ima nadimak i oznaku „Bot” (bez linka na profil); u čekaonici i tijekom partije nema bedža „Bot”, već namjenski avatar.
- Jedan identitet igra najviše jednu partiju istodobno. Aktivni fond ima 80 imenovanih botova i 0 gost-botova; povijesni gost-botovi ostaju u bazi deaktivirani. Tvrdi maksimum aktivnog fonda ostaje 100. Stari identiteti se deaktiviraju, ne preimenuju niti brišu.
- Administrator može stvarati samo imenovane botove, aktivirati/deaktivirati ih te mijenjati validirane postavke. Deaktivacija odmah sprječava nove rezervacije i oslobađa čekajuće rezervacije; već započete partije se dovršavaju. Sve promjene identiteta bilježe se s administratorom i vremenom.
- Bot identitet ne može se prijaviti, resetirati lozinku ni biti preuzet.

## Zagrijavanje

- Trening odabranog pravilnika: **Klasični** = čovjek + 2 Računala; **KA-zna** i **Dokaži nastavak** = čovjek + 1 Računalo. Avatar „Računalo” je stalan. Dostupno gostima i registriranima.
- Pokreće se odmah, bez javnog reda i bez trošenja javnog fonda botova. Igrač može imati samo jedan aktivni kontekst igranja (red, soba, partija ili trening).
- Pravila valjanosti i eliminacije prate odabrani pravilnik; trening nema timer poteza. Računalo odigrava nakon ~4 s (±0,3 s), kao i ostali botovi (tempo v5).
- Trening ne bilježi partiju, poteze ni natjecateljski napredak: nema bodova, XP-a, ranga, forme, nizova, kolekcije riječi ni općih dostignuća. Gostu i privremenom „Računalu” ne sprema se ništa.
- Registrirani čovjek koji prirodno pobijedi dobiva napredak dostignuća **Zagrijan** na 1, 5, 20, 50 i 100 trening pobjeda. Ne dodjeljuje se pri izlasku, porazu, tehničkom prekidu ili neaktivnosti. Gosti nemaju dostignuće Zagrijan.
- Neaktivni trening upozorava nakon 4 minute i tehnički se zatvara nakon 5 minuta bez ljudskog prihvaćenog poteza ili izričitog nastavka. Otkucaji veze i potezi Računala ne resetiraju neaktivnost. Zatvaranje nije pobjeda ni poraz.
- Završni ekran jasno navodi da se trening ne bilježi kao partija i ne utječe na natjecateljske statistike, XP, rang, formu ni kolekciju; može prikazati novu razinu dostignuća Zagrijanog.
- Poslužitelj ograničava broj aktivnih treninga odvojeno od javnih partija; pri zauzeću prikazuje jasnu poruku.

## Provjera pod opterećenjem

Pravila iznad provjeravaju se i na stagingu: predtest popune reda mjeri pragove 30 s / 20–30–40 s i sastav 1 odnosno 3 bota; namjerni javni istek nije tehnička greška. Miješani stres test (profil v5) uključuje do 100 istodobnih treninga protiv Računala i traži da računalni protivnik nikad ne bude eliminiran istekom vremena ni zahvaćen tehničkom greškom. Postupak i kriteriji: [testiranje.md](../06-razvoj/testiranje.md#profil-v5-računalni-protivnici-u-stres-testu).
