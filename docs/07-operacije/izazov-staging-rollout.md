# Izazov — staging rollout i rollback (redizajn levela)

Suženi enablement: **flag on samo na stagingu**. Produkcija ostaje `IZAZOV_OMOGUCEN=false` dok ne prođe QA novog kataloga 4×3×5. Stari IZ01–IZ24 progres se **ne migrira** — QA na svježoj sesiji / novom gostu.

## Rollout

1. Spoji PR redizajna levela u `main`.
2. Objaví staging digestom (postojeći postupak: [objava-staginga-za-pocetnike.md](objava-staginga-za-pocetnike.md)).
3. Compose staging zadano ima `IZAZOV_OMOGUCEN=true` (`docker-compose.staging.yml`). Override u `.env` samo ako treba privremeno ugasiti.
4. Potvrdi flag on:
   - UI: naslovnica → **Izazovi** (katalog nije disabled).
   - Ili `GET /api/izazovi` s valjanom sesijom — `omogucen: true`, `definitionVersion: 3`, 60 kartica.
5. Prođi smoke checklist ispod.
6. Perf smoke: `GET /zdravlje` nakon nekoliko Izazov partija.

## Rollback

1. Na stagingu postavi `IZAZOV_OMOGUCEN=false` (Compose override ili `.env`) i restartaj aplikaciju.
2. Novi startovi se odbijaju (`IZAZOV_NEDOSTUPAN`).
3. Aktivni pokušaji: neka se uredno dovrše, ili pri sljedećem bootu postaju `tehnicki_prekinuto` (postojeći job).
4. **Ne** brisati `zavrseci_izazova` ni dodijeljeni XP.

Produkcijski rollback nije potreban dok je flag off.

## Smoke checklist (staging)

Fokus na ugovore novog kataloga (ne „svih 60 odmah“):

- [ ] Naslovnica → Izazovi; 4 level togglea; L1 ima 12 dostupnih (varijante 1–4 × 3 formata); finale `…-05` zaključano
- [ ] `?level=4` na svježoj sesiji → fallback + obavijest; sadržaj L1
- [ ] Start `IZ-L1-DV-01`; panel uvjeta (level · format · varijanta); **Tvoj potez** statičan (30 s)
- [ ] Brzi (`IZ-L1-*-02`): ljudski rok 15 s, bot i dalje ~30 s na svom potezu
- [ ] Staging `ONEMOGUCI_TIMER_POTEZA=true` **ne gasi** Izazov timer
- [ ] Neuspjeh prikazuje završni ekran; CTA **Odaberi izazov** → `?level=` odigranog
- [ ] Uspjeh path: XP / otključavanje formata/levela / Izazivač (1★ na prvi novi uspjeh)
- [ ] Refresh / reconnect usred pokušaja — bez duplog XP-a
- [ ] Gost → registracija zadržava novi progres; stari IZ* ID-jevi ne otključavaju L2
- [ ] Ranked / Trening / privatna soba nepromijenjeni
- [ ] Admin → Analitika → **Izazovi** vidi nove ID-jeve (`IZ-L…`)

Dokumentiraj nalaze u PR-u.

## Produkcija

Ostaje `IZAZOV_OMOGUCEN=false` (`docker-compose.prod.yml` default). Uključivanje je **zaseban** korak nakon staging smoke + balans pregleda.
