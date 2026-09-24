# ADR-015: Pojedinačne serverske sesije i logout

- **Status:** prihvaćen
- **Datum:** 2026-09-17

## Kontekst

Dosadašnji registrirani session token bio je stateless HMAC vrijednost s rokom od 30 dana. Poslužitelj zato nije mogao poništiti samo trenutačnu prijavu: logout je brisao cookie i lokalnu kopiju, ali bi već kopirani token ostao valjan do isteka.

MVP ne treba popis uređaja, odjavu svih uređaja ni opoziv nakon promjene ili reseta lozinke. Treba samo stvaran logout jedne prijave, uz zadržavanje postojećeg HTTP i Socket.IO toka.

## Odluka

Svaka uspješna registracija i prijava stvara jedan zapis u tablici `sesije`. Klijentu se vraća kriptografski nasumičan token s prefiksom `sesija.`. U bazi se sprema samo SHA-256 hash tokena, nikad sirova vrijednost.

Sesija sadrži:

- UUID sesije;
- ID igrača;
- vrijeme stvaranja;
- fiksni rok isteka od 30 dana;
- hash tokena.

`POST /racuni/odjava` briše samo sesiju čiji token dolazi iz trenutačnog zahtjeva. Ponovljeni logout je uspješan i briše cookie, čak i ako je token već istekao ili opozvan.

Socket.IO handshake provjerava istu sesiju u bazi. Aktivni socket pamti ID sesije, a logout prekida samo socket te sesije. Ograničenje RS-18 i dalje dopušta samo jednu aktivnu Socket.IO vezu po igraču.

Reset lozinke, promjena lozinke i promjena emaila ne opozivaju postojeće sesije. Prijava na drugom uređaju stvara zasebnu sesiju.

Gost u `localStorage` čuva opaque token oblika `gost.<tajna>`. Server u `sesije` sprema samo njegov hash; javni `igrac_id` nikad nije bearer token.

## Posljedice

- Logout stvarno onemogućuje ponovnu upotrebu opozvanog tokena.
- Prijave na drugim uređajima ostaju neovisne.
- Ne prikupljamo IP, user-agent, lokaciju ni naziv uređaja.
- Svaka provjera registriranog zahtjeva radi jedan dohvat aktivne sesije iz PostgreSQL-a.
- Itekle sesije mogu se uklanjati pri izdavanju novih sesija; zaseban scheduler nije potreban za MVP.

## Izvan opsega

- odjava sa svih uređaja;
- popis ili imenovanje uređaja;
- opoziv sesija nakon reseta/promjene lozinke ili promjene emaila;
- rotacija, osvježavanje ili klizno produljenje tokena;
- premještanje tokena isključivo u httpOnly cookie.
