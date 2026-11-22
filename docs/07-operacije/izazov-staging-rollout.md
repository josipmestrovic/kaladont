# Izazov — staging rollout i rollback (PR07)

Suženi enablement: **flag on samo na stagingu**. Produkcija ostaje `IZAZOV_OMOGUCEN=false` dok ne prođe kasniji gate nakon redesigna razina. Nema seed scenarija ni balansa kataloga u ovom koraku — vidi [izazov-balans-workflow.md](../06-razvoj/izazov-balans-workflow.md) nakon novih lvl-a.

## Rollout

1. Spoji PR06 (analitika) + ovaj PR07 u `main`.
2. Objaví staging digestom (postojeći postupak: [objava-staginga-za-pocetnike.md](objava-staginga-za-pocetnike.md)).
3. Compose staging zadano ima `IZAZOV_OMOGUCEN=true` (`docker-compose.staging.yml`). Override u `.env` samo ako treba privremeno ugasiti.
4. Potvrdi flag on:
   - UI: naslovnica → **Izazovi** (katalog nije disabled).
   - Ili `GET /api/izazovi` s valjanom sesijom — `omogucen: true`.
5. Prođi smoke checklist ispod.
6. Perf smoke: `GET /zdravlje` (i postojeći nadzor) nakon nekoliko Izazov partija; nema zasebnog load harnessa u ovom PR-u.

## Rollback

1. Na stagingu postavi `IZAZOV_OMOGUCEN=false` (Compose override ili `.env`) i restartaj aplikaciju.
2. Novi startovi se odbijaju (`IZAZOV_NEDOSTUPAN`).
3. Aktivni pokušaji: neka se uredno dovrše, ili pri sljedećem bootu postaju `tehnicki_prekinuto` (postojeći job).
4. **Ne** brisati `zavrseci_izazova` ni dodijeljeni XP.

Produkcijski rollback nije potreban dok je flag off.

## Smoke checklist (staging)

Ne traži „svih 24 ostvarivo“ — katalog se ionako mijenja. Fokus na ugovore:

- [ ] Naslovnica → Izazovi; zaključane kartice vidljive, IZ01 dostupan
- [ ] Start IZ01; timer 15/30 s stvarno otkucava (staging ima `ONEMOGUCI_TIMER_POTEZA=true`, ali Izazov forsira timer)
- [ ] Neuspjeh (eliminacija ili odustajanje) prikazuje završni ekran bez kampanjskog XP-a
- [ ] Uspjeh path: XP / otključavanje / Izazivač prema postojećim pravilima
- [ ] Refresh / reconnect usred pokušaja — bez duplog XP-a
- [ ] Gost → registracija zadržava progres Izazova
- [ ] Rani stop kad čovjek ispadne — botovi ne igraju ostatak partije
- [ ] Ranked / Zagrijavanje (trening) / privatna soba nepromijenjeni
- [ ] Admin → Analitika → sekcija **Izazovi** vidi pokušaje nakon igre

Dokumentiraj nalaze u PR-u ili issueu; ne blokiraj lvl redesign zbog težine pojedinih razina.

## Produkcija

Ostaje `IZAZOV_OMOGUCEN=false` (`docker-compose.prod.yml` default). Uključivanje je **zaseban** korak nakon redesigna razina + balans QA — nije dio ovog rollouta.
