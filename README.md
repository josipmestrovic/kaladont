# Kaladont

Hrvatska višeigračka igra riječi — reci riječ koja počinje na posljednja dva slova prethodne. Četvero igrača za stolom, 30 sekundi po potezu, ispadanje do posljednjeg. Uskoro na **kaladont.hr**.

## Status

Lokalna MVP jezgra igre, HTTP API i web sučelje implementirani su i testirani. Produkcijska Faza 8 još nije dovršena: nedostaju objedinjeni produkcijski proces, Docker/Compose/Caddy artefakti, GitHub Actions deployment, stvarno slanje emaila, operativni CLI alati te automatizirani backup i recovery postupci. Kaladont zato još nije spreman za VPS objavu.

Kompletan opis proizvoda, pravila, arhitekture i plana razvoja nalazi se u [docs/README.md](docs/README.md). Ciljani operativni model definira [ADR-014](docs/03-arhitektura/odluke/014-operativni-model-mvp-a.md).

## Brzi pregled

- **Igra:** 4 igrača, riječ na zadnja dva grafema (nj/lj/dž = jedno slovo), eliminacija onoga tko ne zna odgovor
- **Stack:** TypeScript monorepo — SvelteKit (web), Fastify + Socket.IO (poslužitelj), PostgreSQL + Drizzle
- **Rječnik:** izveden iz leksikona [hrLex 1.3](http://hdl.handle.net/11356/1232) (CLARIN.SI, CC BY-SA 4.0)
- **Jezik projekta:** sve je na hrvatskom — kod, komentari, dokumentacija, commitovi i sučelje

## Licenca

Izvorni kod je javno vidljiv radi transparentnosti i dijeljenja, ali **nije open source** — sva prava pridržana. Detalji u [LICENCA.md](LICENCA.md).
