# ADR-018: CalVer izdanja i tiha ažuriranja

- **Status:** prihvaćen
- **Datum:** 2026-11-17
- **Dopunjuje:** [ADR-011](011-staging-promocija-digesta.md) i [ADR-014](014-operativni-model-mvp-a.md) (promocija istog digesta i ručna produkcijska promocija ostaju nepromijenjene)

## Kontekst

Produkcija se ažurira često: od 6. do 14. studenoga 2026. bilo je jedanaest promocija. Većina su popravci i sitnice, a tek poneka donosi nešto što igrači trebaju znati. Dotadašnje oznake nisu pratile tu stvarnost:

- GitHub Releaseovi `v0.1.0-closed-alpha.1` do `v0.3.0-closed-alpha.1` opisivali su zatvorene testove i nisu imali vezu s produkcijom;
- stranica Novosti nosila je oznake „Kaladont 0.1.0” i „Kaladont 0.2.0” s ručno upisanim datumima koji nisu odgovarali stvarnim objavama;
- nije postojao način da se igraču pokaže kada je igra zadnji put ažurirana.

Uz to, staging i produkcija dobivaju isti nepromjenjivi Docker image ([ADR-011](011-staging-promocija-digesta.md)). Sve što je u slici, pa i datum izdanja, nastaje prije nego što operater odluči kada će promovirati. Datum u Novostima, datum u Git oznaci i stvarni dan objave mogu se zato lako razići.

## Odluka

1. **Objava nije isto što i izdanje.** Objava je svaka uspješna promocija digesta na produkciju. Izdanje je objava koja na produkciju prvi put donosi novi datirani zapis iz `aplikacije/web/src/lib/izdanja.json`. Sve ostale objave su tiha ažuriranja: nemaju oznaku, GitHub Release ni unos u Novostima, a datum „Zadnje ažuriranje” na naslovnici ostaje isti.
2. **Izdanja se označavaju kalendarski (CalVer).** Git oznaka je `vYYYY.MM.DD`, a drugo i svako sljedeće izdanje istoga dana dobiva nastavak `.1`, `.2`… Datum se određuje u zoni Europe/Zagreb. Igrači vide samo hrvatski datum (`23. 11. 2026.`); javno sučelje ne prikazuje SemVer, CalVer oznake ni commit SHA.
3. **Jedan izvor istine.** `izdanja.json` čitaju stranica Novosti i naslovnica, a skripte u `skripte/izdanja/` iz istih podataka izvode oznaku, naslov i bilješke GitHub Releasea. Zapis s `objavljeno: null` je nacrt i nigdje se ne prikazuje.
4. **Datum živi u repozitoriju, a čuva ga workflow.** U `izdanja.json` se upisuje dan produkcijske objave. Workflow „Promoviraj produkciju” prepoznaje izdanje po tome što oznaka najnovijeg datiranog zapisa još ne postoji. Tada datum zapisa mora biti jednak današnjem; inače promocija staje prije backupa i prije nego što dirne produkciju. Postojeća oznaka znači „već objavljeno”, pa su ponovna promocija i rollback tiha ažuriranja.
5. **Oznaku i GitHub Release stvara workflow.** Nakon uspješne produkcijske provjere zaseban job potvrdi da produkcija prikazuje izdanje i tek tada stvori oznaku na commitu promovirane slike i GitHub Release. Pisanje u repozitorij dopušteno je samo tom jobu.
6. **Nema hitne grane.** Produkcija dobiva samo ono što je na `main`. Brzi popravak ide istim putem kao i sve drugo (PR, CI, staging, ručna promocija), samo bez novog datiranog zapisa.

CalVer je oznaka izdanja, a ne identitet artefakta: za deploy, migracije i rollback i dalje vrijede isključivo puni image digest i commit SHA.

## Razmotrene alternative

- **SemVer** — broj verzije igračima ne govori ništa, a traži odluku „je li ovo major, minor ili patch” koja kod igre s čestim objavama nema smisla.
- **Svaka objava je izdanje** — uz desetak objava tjedno Novosti bi postale popis popravaka, a brzi popravak tražio bi pisanje bilješki.
- **Datum bez čuvara** — najmanje posla, ali kad objava sklizne za dan ili se datum zaboravi ispraviti, Novosti i oznaka tiho lažu.
- **Datum koji workflow zapiše na server pri promociji** — uvijek točan, ali živi izvan gita: treba ga čuvati u backupu, ista slika prikazuje različito na stagingu i produkciji, a rollback postaje zamršeniji.
- **Hitna grana odvojena od produkcijskog commita** — omogućila bi popravak dok `main` nosi neobjavljen paket, ali traži izmjene u tri workflowa i put koji se rijetko koristi. Odbačeno dok promet ne opravda tu složenost.
- **Dohvat GitHub Releaseova pri otvaranju stranice** — uvodi vanjsku ovisnost u prikaz naslovnice i ne rješava pitanje datuma.

## Posljedice

- Datum u Novostima, datum u oznaci i stvarni dan objave ne mogu se razići: prvi dolazi iz slike, drugi se računa iz prvoga, a treći jamči čuvar.
- Ako objava izdanja sklizne na sutra, potreban je novi PR s novim datumom i novi prolaz kroz CI i staging. To je cijena točnog datuma.
- Dok je `main` ispred produkcije s neobjavljenim paketom, hitan popravak može izaći samo zajedno s paketom. Veliki paket zato se spaja na `main` tek kad je blizu objave.
- Tiha promocija dok u `izdanja.json` postoji nacrt objavljuje kod bez unosa u Novostima. Sažeci staging i produkcijskog workflowa na to upozoravaju, ali ne blokiraju.
- Web (TypeScript) i skripte (bash/jq) neovisno izvode sidro i oznaku iz istih podataka. Usklađenost provjerava CI nad izgrađenom slikom, istom provjerom koju produkcijski job radi prije stvaranja oznake.
- Format `izdanja.json` smije se mijenjati samo tako da skripte i dalje čitaju starije datoteke, jer se pri rollbacku podaci čitaju sa starog commita, a skripte s `main`.
- Operativni postupak opisuju [release shema](../../07-operacije/release-shema.md), [CI/CD](../../07-operacije/ci-cd.md) i [runbook objave i rollbacka](../../07-operacije/runbook-objava-i-rollback.md).
