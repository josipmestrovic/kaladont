# ADR-015: Pojedinačne serverske sesije i logout

- **Status:** prihvaćen (dopuna 2026-11-05: opoziv sesija nakon reseta lozinke)
- **Datum:** 2026-09-17

## Kontekst

Dosadašnji registrirani session token bio je stateless HMAC vrijednost s rokom od 30 dana. Poslužitelj zato nije mogao poništiti samo trenutačnu prijavu: logout je brisao cookie i lokalnu kopiju, ali bi već kopirani token ostao valjan do isteka.

MVP treba stvaran logout jedne prijave te, zbog sigurnosti računa prije javne objave, opoziv svih sesija nakon uspješnog reseta lozinke. Popis uređaja i ručna odjava sa svih uređaja nisu dio MVP-a.

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

Uspješan reset lozinke atomski potroši jednokratni reset token (`igraci.reset_lozinke_verzija`), briše **sve** sesije tog igrača i prekida njihove aktivne Socket.IO veze. Isti link uspije samo jednom, uključujući istodobne zahtjeve. Promjena lozinke ili emaila (kad postoje kao zasebne rute) zasad ne opozivaju sesije. Prijava na drugom uređaju stvara zasebnu sesiju.

Gost u `localStorage` čuva opaque token oblika `gost.<tajna>`. Server u `sesije` sprema samo njegov hash; javni `igrac_id` nikad nije bearer token.

## Posljedice

- Logout stvarno onemogućuje ponovnu upotrebu opozvanog tokena.
- Prijave na drugim uređajima ostaju neovisne, osim nakon reseta lozinke.
- Ne prikupljamo IP, user-agent, lokaciju ni naziv uređaja.
- Svaka provjera registriranog zahtjeva radi jedan dohvat aktivne sesije iz PostgreSQL-a.
- Itekle sesije mogu se uklanjati pri izdavanju novih sesija; zaseban scheduler nije potreban za MVP.

## Izvan opsega

- odjava sa svih uređaja (osim kao nuspojava reseta lozinke);
- popis ili imenovanje uređaja;
- opoziv sesija nakon promjene lozinke ili promjene emaila;
- rotacija, osvježavanje ili klizno produljenje tokena;
- premještanje tokena isključivo u httpOnly cookie.
