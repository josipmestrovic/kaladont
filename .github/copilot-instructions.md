# Upute za AI-asistirani razvoj — Kaladont

## Jezik: sve na hrvatskom

- **Kod:** identifikatori (varijable, funkcije, klase, tablice, Socket.IO događaji) na hrvatskom, ali **bez dijakritika**: `rijec`, `igrac`, `zadnjaDvaGrafema`, `potez:ne-znam`.
- **Komentari, dokumentacija, commit poruke, UI tekstovi:** puni hrvatski **s dijakriticima**.
- Commit poruke: glagol u infinitivu + kratak opis („Dodati validaciju grafema pri uvozu").

## Izvor istine

Sve odluke o pravilima, bodovanju, arhitekturi i UX-u zapisane su u `docs/` — konzultiraj ih prije implementacije. Ne mijenjaj pravila igre u kodu bez izmjene dokumentacije.

## Ključna pravila domene (ne krši ih)

- nj, lj i dž su **jedno slovo** (grafem); igra se na zadnja/prva **dva grafema**, uz listu iznimaka (npr. „injekcija" počinje na „in").
- Partija ima **točno 4 igrača**, ispadanje do posljednjeg, **30 s** po potezu.
- Server je **jedini autoritet** za validaciju poteza; klijent ništa ne presuđuje.
- Bodovi: plasman (0/1/2/3) + 1 po eliminaciji + 1 bonus za 1. mjesto; maksimalno 7 po igraču.
- Rječnik sadrži **sve vrste riječi u svim oblicima** (ADR-013); zabrana ponavljanja vrijedi **cijelu partiju** na razini **leksemske grupe** (`vrsta:lema[:stupanj]`) — odigrani oblik troši sve svoje grupe. Dijakritici se upisuju **strogo**.

## Tehničke konvencije

- Monorepo: `aplikacije/web` (SvelteKit), `aplikacije/posluzitelj` (Fastify + Socket.IO), `paketi/zajednicko` (pravila, grafemi, tipovi protokola), `skripte/` (uvoz rječnika).
- TypeScript strict svugdje; logika pravila igre živi u `paketi/zajednicko` i mora biti pokrivena Vitest testovima.
- Veliki test opterećenja staginga ne pokretati samoinicijativno, ni tijekom provjere izmjena. Pokrenuti ga samo kada korisnik izričito zatraži test opterećenja.
- PostgreSQL + Drizzle; nazivi tablica i stupaca na hrvatskom bez dijakritika (`rijeci.prva_dva`).
- Popis riječi (derivat hrLexa, CC BY-SA 4.0) **ne commita se** u repozitorij.
- Nove HTML tablice moraju imati semantička zaglavlja i mobilni prikaz bez vodoravnog pomicanja. Za presložene retke koristi hrvatski `data-label` na svakoj vrijednosnoj ćeliji prema obrascu u `docs/05-ux-ui/ekrani.md#html-tablice-na-mobitelu`; pregledne dvostupčane tablice mogu ostati vodoravne tek nakon provjere na uskom zaslonu.

## Izdanja i Novosti

- `aplikacije/web/src/lib/izdanja.json` jedini je izvor istine za stranicu Novosti, datum „Zadnje ažuriranje” na naslovnici te Git oznaku i GitHub Release (ADR-018, `docs/07-operacije/release-shema.md`).
- Značajku koju igrači trebaju primijetiti dopiši kao stavku u nacrt (`"objavljeno": null`); ako nacrta nema, dodaj novi zapis na vrh. Popravke i sitnice ne upisuj: one izlaze kao tiho ažuriranje.
- Datum u `objavljeno` upisuje se tek na dan produkcijske objave, zasebnim PR-om i na izričit zahtjev vlasnika. Ne upisuj ga samoinicijativno i ne mijenjaj datum već objavljenog izdanja.
- Git oznake `vYYYY.MM.DD` i GitHub Releaseove stvara workflow „Promoviraj produkciju”. Ne stvaraj ih i ne briši ručno, osim po postupku iz `docs/07-operacije/runbook-objava-i-rollback.md`, i ne pokreći taj workflow bez izričitog zahtjeva.
- Javno sučelje prikazuje samo hrvatski datum izdanja; bez oznaka verzija i commit SHA-a.
