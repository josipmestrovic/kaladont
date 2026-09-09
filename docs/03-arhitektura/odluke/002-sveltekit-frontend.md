# ADR-002: SvelteKit za web klijent

- **Status:** prihvaćen
- **Datum:** 2026-08-20

## Kontekst

Klijent je jedna igraća površina (stol) plus nekoliko jednostavnih stranica (landing, profil, ljestvica). Landing i ljestvica trebaju SSR radi SEO-a na kaladont.hr; stol treba brz, reaktivan prikaz stanja primljenog socketima. Tim je malen, pa količina boilerplatea izravno određuje brzinu razvoja.

## Odluka

**SvelteKit** s TypeScriptom: SSR za javne stranice, klijentska reaktivnost za stol, minimalan boilerplate.

## Razmotrene alternative

- **React + Vite** — najveći ekosustav, ali više koda za isti rezultat; nema SSR bez dodatne infrastrukture.
- **Next.js** — SSR da, ali serverless model se loše slaže s trajnim WebSocket poslužiteljem; teži od potrebe.

## Posljedice

- Manje koda i ovisnosti; Svelte store se prirodno mapira na `partija:stanje` poruke.
- Manja zajednica od Reactove — prihvatljivo jer je UI opseg malen.
