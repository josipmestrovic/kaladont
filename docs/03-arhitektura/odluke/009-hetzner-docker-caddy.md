# ADR-009: Hetzner VPS + Docker + Caddy

- **Status:** djelomično zamijenjen [ADR-om 014](014-operativni-model-mvp-a.md)
- **Datum:** 2026-08-20

## Kontekst

Trajni WebSocket proces isključuje serverless hosting. Publika je u Hrvatskoj (latencija!), proračun je skroman, a produkcija mora biti reproducibilna i identična lokalnom okruženju.

## Odluka

**Hetzner VPS** (Njemačka, ~20–30 ms do Hrvatske, ~5 €/mj) s **Docker Compose** stackom: aplikacija (web + poslužitelj), PostgreSQL, **Caddy** (reverse proxy s automatskim HTTPS-om za kaladont.hr) i Umami. Deploy preko GitHub Actions (SSH + `docker compose pull && up`).

## Razmotrene alternative

- **Railway / Fly.io** — jednostavniji deploy, ali skuplji s rastom i manje kontrole; Postgres i Umami dodatno naplaćuju.
- **Vercel/Netlify** — ne podržavaju trajne WebSocket procese; otpada tehnički.
- **Domaći hosting** — cjenovno i tehnički nekonkurentan VPS-ima.

## Posljedice

- Puna kontrola i predvidljiv fiksni trošak; sve komponente na jednom stroju u MVP-u.
- Održavanje (nadogradnje, sigurnost) je naša odgovornost — ublaženo Dockerom i minimalnom površinom (samo 80/443 + SSH).
- Vertikalno skaliranje (veći VPS) pokriva dugo razdoblje rasta prije potrebe za više strojeva.
