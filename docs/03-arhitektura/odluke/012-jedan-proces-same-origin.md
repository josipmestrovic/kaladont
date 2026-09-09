# ADR-012: Jedan Node proces i same-origin klijent u produkciji

- **Status:** prihvaćen
- **Datum:** 2026-09-03

## Kontekst

U razvoju web (SvelteKit, port 5173) i poslužitelj (Fastify + Socket.IO, port 3000) rade kao dva procesa, a klijent adresu poslužitelja čita iz `VITE_ADRESA_POSLUZITELJA`. Vite tu vrijednost **zapeče u JS bundle pri buildu** — slika buildana s adresom staginga zauvijek bi pokazivala na staging, što izravno krši ADR-011 (isti digest na oba okruženja). Dodatno, iza Caddy reverse proxyja poslužitelj mora ispravno vidjeti stvarne IP adrese igrača (rate limiting po IP-u) i raditi bez širokog CORS-a.

## Odluka

U produkciji (i na stagingu) postoji **jedan Node proces**: Fastify uz igru poslužuje i SvelteKit build (adapter-node handler). Posljedično:

- Klijent u produkcijskom buildu koristi **relativne adrese** (same-origin): Socket.IO se spaja bez URL-a, fetch pozivi idu na relativne putanje. `VITE_ADRESA_POSLUZITELJA` ostaje isključivo razvojna pogodnost (5173 → 3000) i ne smije se pojaviti u produkcijskom bundleu kao apsolutna adresa.
- Fastify se konfigurira s `trustProxy` (Caddy je jedini pred njim) kako bi rate limiting i sigurnosni kolačići radili nad stvarnim IP-om igrača.
- CORS se više ne otvara reflektiranjem origina; uz same-origin praktički nije potreban.

## Razmotrene alternative

- **Dva kontejnera (web + poslužitelj) iza Caddyja s usmjeravanjem putanja** — odbačeno: svaka nova API putanja mora se ručno dodati u Caddy (zaboravljena putanja = tihi 404), više procesa za nadzor i RAM, a izmjena klijenta na relativne adrese potrebna je u oba slučaja.
- **Runtime injekcija konfiguracije (server servira `env.js`)** — odbačeno: rješava zapečeni URL, ali dodaje pokretni dio, a ne rješava CORS ni dva procesa.
- **Build po okruženju** — odbačeno: izravno krši promociju istog digesta (ADR-011).

## Posljedice

- Jedan kontejner, jedan port, jedan log — najmanja moguća površina za održavanje na VPS-u.
- Pad procesa ruši i web i igru — svjesno prihvaćeno; na jednom VPS-u odvojeni procesi ionako dijele sudbinu stroja.
- Zahtijeva izmjenu koda (posluživanje handlera u Fastifyju, relativne adrese u klijentu, `trustProxy`); do te izmjene produkcijski deploy nije moguć.
- Razvojni tok (`pnpm dev`, dva procesa, native Postgres) ostaje nepromijenjen.
