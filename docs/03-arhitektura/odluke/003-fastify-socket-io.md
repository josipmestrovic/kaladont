# ADR-003: Fastify + Socket.IO na poslužitelju

- **Status:** prihvaćen
- **Datum:** 2026-08-20

## Kontekst

Igra treba trajne dvosmjerne veze (potezi, red čekanja, reakcije) i klasični HTTP API (računi, ljestvica, prijave). Serverless platforme (Vercel, Netlify) ne podržavaju trajne WebSocket procese, pa je potreban stalno živ Node proces.

## Odluka

Jedan Node proces: **Fastify** za HTTP API + **Socket.IO** za realno vrijeme, oboje na istom portu.

## Razmotrene alternative

- **Čisti `ws`** — lakši, ali Socket.IO donosi sobe, ponovno spajanje, heartbeat i fallback bez vlastite izgradnje.
- **Express** — sporiji i stariji API od Fastifyja, bez prednosti.
- **Serverless + upravljani WS (Ably/Pusher)** — vanjska ovisnost i trošak; nepotrebno uz vlastiti VPS.

## Posljedice

- Sobe po partiji, heartbeat i detekcija prekida (RS-09/RS-10) dolaze iz kutije.
- Skaliranje na više procesa zahtijeva Socket.IO Redis adapter — svjesno odgođeno (vidi ADR-008 kontekst skromnog starta).
