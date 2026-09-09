# Katalog rubnih slučajeva

Svaki rubni slučaj ima oznaku (RS-xx), odluku i obrazloženje. Ovaj katalog je **obavezan izvor** za implementaciju i testove — svaki RS mora imati barem jedan automatski test.

## Pravila igre

**RS-01 — Otvaranje runde: sustav bira riječ, ne igrač.**
Prijašnja verzija pravila dopuštala je napadaču da sam upiše početnu riječ runde, što je omogućavalo namještanje ishoda (namjerno odabrana nejasna riječ kako bi sljedeći igrač zagarantirano ispao).
**Odluka:** igrač nikad ne bira otvarajuću riječ. Sustav je nasumično bira (funkcija `nasumicnaValjanaRijec`, garantirano sa slobodnim nastavkom) prilikom 1. runde, nakon svake eliminacije i nakon kaladont-efekta — vidi [pravila-igre.md](pravila-igre.md#otvaranje-runde-sustav-bira-rije%C4%8D). Time je klopka u otvaranju runde strukturno nemoguća, a `KLOPKA_U_OTVARANJU` kod odbijanja poteza više ne postoji jer igrač nikad ne šalje otvarajuću riječ.
*Obrazloženje: bez ovog pravila napadač lančano eliminira sve za stolom bez igre.*

**RS-02 — Mrtva slova (baza nema riječ).**
Igrač A kaže valjanu riječ čija zadnja dva grafema nemaju nijednu riječ u bazi.
**Odluka:** igrač B (sljedeći na potezu) automatski ispada, odmah, bez čekanja. Poruka: „Trenutno u bazi nemamo riječ na 'XY'." + gumb **Prijavi**. Igrač A dobiva bod.
*Obrazloženje: generalizacija klasične klopke „ka" → „kaladont".*

**RS-03 — Sva slova potrošena ponavljanjem.**
Riječi na 'XY' postoje u bazi, ali svaka pripada leksemskoj grupi koja je već potrošena u partiji (ADR-013).
**Odluka:** isto kao RS-02, ali poruka: „Sve riječi na 'XY' već su iskorištene u ovoj partiji." — **bez** gumba za prijavu.
*Obrazloženje: to je regularna taktička pobjeda, ne rupa u bazi; različita poruka sprječava lažne prijave.*

**RS-04 — Neispravan upis.**
Riječ ne postoji / ne počinje na tražena slova / već je iskorištena / dijakritici pogrešni.
**Odluka:** potez se odbija s razlogom, timer teče dalje, igrač pokušava ponovno. Nema kazne osim potrošenog vremena.

**RS-05 — Dvografemska riječ.**
Riječ ima točno dva grafema (npr. „uš": u-š). Zadnja dva grafema = cijela riječ.
**Odluka:** potpuno valjano; sljedeća riječ počinje na cijelu prethodnu riječ.

**RS-06 — Tražena kombinacija jednaka cijeloj riječi.**
Traži se „uš" i igrač upiše upravo „uš".
**Odluka:** valjano ako riječ postoji i nije iskorištena — riječ „počinje" sama sobom.

**RS-07 — Riječ s crticom, razmakom ili brojkom.**
**Odluka:** takve riječi ne postoje u bazi (isključene pri uvozu) → odbijaju se kao nepostojeće.

**RS-08 — Digraf na granici riječi (iznimke).**
Riječi poput „injekcija" gdje n+j nije digraf.
**Odluka:** lista iznimaka pri uvozu određuje ispravan rastav; pogrešno svrstane riječi ispravljaju se kroz prijave. Vidi [digrafi-i-grafemi.md](digrafi-i-grafemi.md).

## Mreža i prekidi

**RS-09 — Prekid veze na svom potezu.**
**Odluka:** trenutna eliminacija; **napadač dobiva bod** (ekvivalent isteka vremena). Plasman prema trenutku ispadanja.

**RS-10 — Prekid veze izvan svog poteza.**
**Odluka:** trenutna eliminacija bez ičijeg boda (samoeliminacija). Krug se nastavlja preskačući prazno mjesto; ako je eliminirani bio sljedeći na redu, red prelazi na idućeg preživjelog.

**RS-11 — Dobrovoljni izlazak iz partije (gumb izlaza tijekom igre).**
**Odluka:** identično prekidu veze (RS-09/RS-10, ovisno je li igrač bio na potezu).

**RS-12 — Detekcija prekida nije trenutna.**
Socket.IO heartbeat otkriva prekid s odgodom od nekoliko sekundi.
**Odluka:** prihvatljivo; eliminacija nastupa u trenutku detekcije. Ako je u međuvremenu istekao timer, primjenjuje se istek (RS-09 svodi se na isto — bod napadaču).

**RS-13 — Svi preostali igrači prekinu vezu istovremeno.**
**Odluka:** eliminacije se obrađuju redoslijedom detekcije (deterministički na serveru); posljednji preostali je pobjednik. Ako server ne može utvrditi redoslijed unutar istog ticka, prednost ima igrač koji NIJE bio na potezu.

**RS-14 — Utrka poteza i isteka vremena.**
Riječ stigne u istom trenutku kad timer istekne.
**Odluka:** odlučuje serversko vrijeme primitka: potez primljen prije isteka vrijedi; sve poslije se ignorira. Klijentski prikaz timera je informativan.

**RS-15 — Igrač šalje potez kad nije na redu.**
**Odluka:** server odbija s kodom `NIJE_TVOJ_POTEZ`; bez kazne (može biti zaostala poruka s lošom vezom).

## Red čekanja

**RS-16 — Igrač zatvori preglednik u redu čekanja.**
**Odluka:** heartbeat ga uklanja iz reda; ostalima se mjesto oslobađa u real-timeu.

**RS-17 — Pet igrača uđe „istovremeno".**
**Odluka:** server atomarno puni stol redoslijedom prijave; peti ostaje prvi u redu za sljedeći stol.

**RS-18 — Isti igrač (isti token) pokuša ući u red iz dvije kartice.**
**Odluka:** dopuštena je samo jedna aktivna veza po identitetu; nova veza zamjenjuje staru (stara kartica dobiva poruku o odjavi).

## Identitet i podaci

**RS-19 — Gost obriše localStorage / promijeni uređaj.**
**Odluka:** dobiva novi identitet i novu statistiku; stara ostaje siroče u bazi (prihvatljivo — trajnost je pogodnost registracije, što UI komunicira).

**RS-20 — Registracija gosta s postojećom statistikom.**
**Odluka:** gostov zapis u tablici `igraci` postaje registriran račun (UPDATE, ne INSERT) — statistika i kalibracija sačuvani.

**RS-21 — Admin ukloni riječ dok traje partija koja ju je već upotrijebila.**
**Odluka:** rječnik u memoriji mijenja se tek na eksplicitni signal ponovnog učitavanja; aktivne partije nastavljaju sa snapshotom s početka partije. Odigrani potezi se nikad retroaktivno ne poništavaju.

## Zaštita

**RS-22 — Spam emoji reakcija.**
**Odluka:** najviše 1 reakcija svake 2 sekunde po igraču; višak server tiho ignorira.

**RS-23 — Spam neispravnih poteza.**
**Odluka:** najviše 3 pokušaja u sekundi; iznad toga server odbija s kodom `PREBRZO`. Štiti od skriptiranog pogađanja riječi.

**RS-24 — Automatizirano igranje (bot igrača).**
**Odluka za MVP:** bez aktivne detekcije; bilježi se `trajanje_ms` svakog poteza pa su sumnjivi obrasci (stalno < 500 ms) vidljivi u podacima za kasniju analizu.

**RS-25 — Igrač izgovori "kaladont"/"kalodont".**
Riječ završava na mrtav par „nt" — po standardnom pravilu bi to eliminiralo sljedećeg igrača (RS-02 generalizacija).
**Odluka:** posebno pravilo preuzima prednost — umjesto sljedećeg igrača ispada igrač koji je omogućio otvaranje na „ka“ (dohvaćen iz `napadacId` prije ažuriranja u `obradiPrihvacenPotez`), bod ide igraču koji je izgovorio riječ. Ove dvije riječi izuzete su od zabrane ponavljanja (mogu se odigrati više puta u partiji). Nakon eliminacije **sustav** (ne sayer) bira riječ za otvaranje nastavka runde (vidi RS-01), a red potom prelazi na sljedećeg aktivnog igrača nakon onoga tko je izgovorio Kaladont. Ako je eliminirani bio pretposljednji preostali, partija odmah završava.
*Obrazloženje: tematska posebnost imena igre — vidi [pravila-igre.md](pravila-igre.md#posebno-pravilo-kaladont-i-kalodont).*

**RS-26 — "Kaladont"/"kalodont" omogućen sustavovom riječi (nitko nije kriv).**
Sustav nasumično odabere riječ za otvaranje runde čija zadnja dva grafema ispadaju baš „ka", pa sljedeći igrač odgovori s „kaladont"/„kalodont".
**Odluka:** ne primjenjuje se posebno pravilo (RS-25) jer ne postoji igrač koji je "omogućio ka" — sustavovu riječ nitko nije odigrao. Nitko ne ispada niti dobiva bod; sustav odmah ponovno bira novu riječ za otvaranje runde s istim igračem kao usidrenom točkom (sljedeći aktivni nakon njega dolazi na potez).
*Obrazloženje: otkad riječ runde uvijek bira sustav (RS-01), ovaj rubni slučaj zamjenjuje stari "slobodna otvarajuća riječ" scenarij koji više nije moguć jer igrač ne bira riječi.*

**RS-27 — Rječnik iscrpljen tijekom automatskog biranja riječi.**
Sustav pokuša odabrati nasumičnu riječ za otvaranje runde (`nasumicnaValjanaRijec`), ali nijedna neiskorištena riječ sa slobodnim nastavkom više ne postoji.
**Odluka:** ekstremni rubni slučaj — server sigurnosno završava partiju istog trenutka (kao da je preostali aktivni igrač pobjednik), bez dodatne poruke igračima o razlogu.
*Obrazloženje: praktički nedostižno s rječnikom realne veličine, ali sustav mora imati siguran izlaz umjesto da zapne bez ijedne valjane riječi.*

## Leksemske grupe (ADR-013)

**RS-28 — Drugi oblik potrošene leksemske grupe.**
U partiji je odigrano „dobar"; igrač kasnije pokuša „dobra" (ili „dobrome", „dobrih"…).
**Odluka:** potez se odbija kodom `RIJEC_ISKORISTENA` uz poruku koja navodi oblik koji je grupu potrošio: „Već je iskorišten oblik te riječi: 'dobar'." Vrijedi i za grupe koje je potrošila sustavski odabrana riječ. Stupnjevi su zasebne grupe („bolji" je i dalje dopušten), a glagolski vid razdvaja grupe („napisati" nakon „pisati" je dopušteno).
*Obrazloženje: paradigma jedne riječi ne smije biti neiscrpan izvor poteza; poruka s konkretnim oblikom objašnjava igraču zašto je odbijen.*

**RS-29 — Višekategorijski oblik troši sve svoje grupe.**
„Dobro" je istovremeno imenica (dobro), pridjev (dobar) i prilog (dobro).
**Odluka:** prihvaćanjem „dobro" troše se **sve** grupe kojima oblik pripada — kasnije se odbijaju i „dobra" (pridjev) i svi drugi oblici svih triju leksema. Provjera dostupnosti nastavka (RS-02/RS-03) također radi po grupama: nastavak postoji samo ako postoji oblik čija **nijedna** grupa nije potrošena.
*Obrazloženje: igračima su „dobro" i „dobra" ista riječ; dopuštanje obojega osjeća se kao ponavljanje.*

