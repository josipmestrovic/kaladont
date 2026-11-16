# Kaladont 0.2.0 — javno izdanje

<!--
HINT PR15: Ovo je JAVNO izdanje 0.2.0 (stranica /novosti#v0-2-0, datum 17. 11. 2026).
Ne miješati s povijesnim tagom/datotekom v0.2.0-closed-alpha.1.
Prod promocija ide tek nakon što batch PR01–15 prođe staging checklistu — ovaj dokument
ne tvrdi da je paket već na produkciji.
-->

**Datum objave (stranica Novosti):** 17. 11. 2026.  
**Javni zapis:** [/novosti#v0-2-0](https://kaladont.hr/novosti#v0-2-0)

## Što dolazi

- **Troboj** (3 igrača) uz postojeći Dvoboj i Četveroboj.
- Tri **pravilnika**: Klasični Kaladont, KA-ZNA, Dokaži nastavak — biraju se prije formata.
- Jedan **univerzalni rang** i jedan **Kaladont DNK** za sve javne formate (kalibracija 10 ukupno).
- Ljestvice po formatu; ulaz **5** dnevno / **10** dulje razdoblje.
- Novi paket misija i dostignuća (Troboj, dokaz, Klasični, KA-ZNA; Dvostruka kruna / Na dvije fronte).

## Prihvat izdanja (staging)

Puna checklista iz PR15 specifikacije (migracije, 9 javnih izbora → 8 redova, Troboj + dokaz, trening/privatno, profil/ljestvice, lint/test/e2e, rollback bilješka). Rezultate upisati ovdje ili u PR komentar nakon staging deploya.

| Stavka | Status |
|---|---|
| Lokalni `web check` + `web build` | OK (0 errors) |
| eslint (izmijenjeni `.ts`) | OK; puni `pnpm lint` pada na lokalnom `tmp-ci/` smeću izvan PR-a |
| `pnpm test` lokalno | flaky/timeout na nekim poslužitelj testovima; CI je izvor istine |
| Playwright lokalno | browser install/mreža; pokriti na CI (`naslovnica` uključuje PR15) |
| Staging migracija + KA-ZNA povijest | (nakon mergea / deploya) |
| Integracijski scenariji igre | (nakon mergea / deploya) |
| `/novosti` 200 + sidro | (nakon mergea / deploya) |
| Prod promocija | **nije u ovom koraku** — batch nakon staginga |

## Rollback

Aditivna shema; nova povijest Troboja i odabiri ostaju. Ne vraćati stari binarni kod bez čitanja novih enum vrijednosti — koristiti kompatibilan build koji gasi novi ulaz dok ispravak ide na staging.
