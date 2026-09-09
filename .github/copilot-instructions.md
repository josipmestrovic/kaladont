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
- PostgreSQL + Drizzle; nazivi tablica i stupaca na hrvatskom bez dijakritika (`rijeci.prva_dva`).
- Popis riječi (derivat hrLexa, CC BY-SA 4.0) **ne commita se** u repozitorij.
