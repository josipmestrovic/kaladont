# Kaladont

Hrvatska višeigračka igra riječi — reci riječ koja počinje na posljednja dva slova prethodne. Četvero igrača za stolom, 30 sekundi po potezu, ispadanje do posljednjeg. Produkcija još nije javno objavljena.

## Status

Lokalna MVP jezgra igre, HTTP API i web sučelje implementirani su i testirani. Docker/Compose/Caddy runtime, CI Docker smoke test, prošireni health check i GHCR objava su implementirani. Staging radi na `staging.kaladont.hr` s HTTPS-om, vlastitom PostgreSQL bazom i stvarnim hrLex rječnikom; aplikacijski deploy na staging trenutno se radi ručno punim GHCR digestom.

Produkcija još nije postavljena. Preostali production blokatori su automatski staging i produkcijski deploy workflowi, `trustProxy` i restriktivni CORS, prvi-admin CLI, automatizirani off-server backup/restore te produkcijski recovery drill. Staging je privremeno javno dostupan uz `noindex` jer je Caddy Basic Auth uklonjen zbog ponavljajućih promptova na Socket.IO prometu.

Kompletan opis proizvoda, pravila, arhitekture i plana razvoja nalazi se u [docs/README.md](docs/README.md). Stvarni operativni status i preostali blokatori opisani su u [produkcija-i-objava.md](docs/07-operacije/produkcija-i-objava.md), a arhitekturni model u [ADR-014](docs/03-arhitektura/odluke/014-operativni-model-mvp-a.md).

## Brzi pregled

- **Igra:** 4 igrača, riječ na zadnja dva grafema (nj/lj/dž = jedno slovo), eliminacija onoga tko ne zna odgovor
- **Stack:** TypeScript monorepo — SvelteKit (web), Fastify + Socket.IO (poslužitelj), PostgreSQL + Drizzle
- **Rječnik:** izveden iz leksikona [hrLex 1.3](http://hdl.handle.net/11356/1232) (CLARIN.SI, CC BY-SA 4.0)
- **Jezik projekta:** sve je na hrvatskom — kod, komentari, dokumentacija, commitovi i sučelje

## Licenca

Izvorni kod je javno vidljiv radi transparentnosti i dijeljenja, ali **nije open source** — sva prava pridržana. Detalji u [LICENCA.md](LICENCA.md).
