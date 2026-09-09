# Zapisi arhitektonskih odluka (ADR)

ADR (engl. _Architecture Decision Record_) je kratak zapis jedne značajne odluke: zašto je donesena, što je odbačeno i koje posljedice nosi. ADR se **ne briše i ne prepravlja** — ako se odluka promijeni, piše se novi ADR koji stari označava potpuno ili djelomično zamijenjenim.

## Format

```markdown
# ADR-xxx: Naslov

- **Status:** prihvaćen | djelomično zamijenjen ADR-om yyy | zamijenjen ADR-om yyy
- **Datum:** GGGG-MM-DD

## Kontekst

## Odluka

## Razmotrene alternative

## Posljedice
```

## Popis

| ADR                                            | Naslov                                                      |
| ---------------------------------------------- | ----------------------------------------------------------- |
| [001](001-typescript-monorepo.md)              | TypeScript monorepo                                         |
| [002](002-sveltekit-frontend.md)               | SvelteKit za web klijent                                    |
| [003](003-fastify-socket-io.md)                | Fastify + Socket.IO na poslužitelju                         |
| [004](004-postgresql-drizzle.md)               | PostgreSQL + Drizzle ORM                                    |
| [005](005-hrlex-izvor-rjecnika.md)             | hrLex kao izvor rječnika                                    |
| [006](006-digrafi-kao-jedno-slovo.md)          | Digrafi nj/lj/dž kao jedno slovo                            |
| [007](007-rjecnik-u-memoriji.md)               | Rječnik u memoriji poslužitelja                             |
| [008](008-bez-matchmakinga-u-mvp.md)           | Bez matchmakinga u MVP-u                                    |
| [009](009-hetzner-docker-caddy.md)             | Hetzner VPS + Docker + Caddy                                |
| [010](010-javni-repo-sva-prava-pridrzana.md)   | Javni repozitorij, sva prava pridržana                      |
| [011](011-staging-promocija-digesta.md)        | Staging okruženje i promocija istog image digesta           |
| [012](012-jedan-proces-same-origin.md)         | Jedan Node proces i same-origin klijent u produkciji        |
| [013](013-sve-vrste-rijeci-leksemske-grupe.md) | Sve vrste riječi u rječniku i potrošnja po leksemskoj grupi |
| [014](014-operativni-model-mvp-a.md)           | Operativni model MVP-a                                      |
