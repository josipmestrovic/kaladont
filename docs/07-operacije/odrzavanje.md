# Održavanje: rutine i checkliste

Redovito, dosadno i kratko — tako se izbjegavaju noćna iznenađenja. Alarmi ([nadzor-i-dnevnici.md](nadzor-i-dnevnici.md#alarmi-minimalni-skup)) hvataju akutno; ove rutine hvataju ono što tiho truli.

> **Status:** raspored opisuje ciljano produkcijsko stanje. Počinje se primjenjivati tek kada pripadajući workflowi, systemd poslovi, Storage Box i monitori postoje. Sve vrijeme servera i evidencije zapisuje se u UTC-u; korisničke najave koriste Europe/Zagreb.

## Dnevno (2 min)

- [ ] Ima li neobrađenog UptimeRobot, Healthchecks.io, GitHub ili Hetzner email alarma?
- [ ] Je li zadnji očekivani backup heartbeat zelen i postoji li recovery poruka za svaki jučerašnji incident?
- [ ] Je li zadnji workflow na `main` zelen; ako je staging deploy crven, je li uzrok zabilježen prije ponavljanja?

## Tjedno (10 min)

- [ ] Dependabot PR-ovi: razumjeti promjenu, pustiti CI i staging; ne spajati automatski produkcijske ovisnosti samo zato što je PR zelen.
- [ ] `warn`/`error` u aplikacijskim i Caddy logovima: postoji li novi obrazac, bez preuzimanja cijelih logova s osobnim podacima?
- [ ] Svježina, veličina, SHA-256, retencija i snapshot produkcijskog i forumskog backupa na Storage Boxu ([backup runbook](runbook-backup-i-vracanje.md#brza-provjera-da-backup-živi)).
- [ ] Disk na sva tri VPS-a i Storage Boxu: `df -h`/provider pregled — pratiti trend, ne samo današnju vrijednost.
- [ ] `docker system df`: raste li prostor slika, build cachea ili volumena; ne čistiti dok nisu zabilježeni aktivni i prethodni rollback digest.
- [ ] Forum: prijave sadržaja i novi članovi (detaljnije u [zajednica-i-rani-pristup.md](../08-plan-razvoja/zajednica-i-rani-pristup.md#moderiranje)).

## Mjesečno (60–90 min)

- [ ] **Produkcijski DB restore drill** u praznu izoliranu bazu na produkcijskom VPS-u ([backup runbook](runbook-backup-i-vracanje.md#mjesečni-drill-vraćanja-30-min)); zabilježiti trajanje, kopiju i provjere.
- [ ] Forumski backup/restore provjera prema Discourse postupku i rasporedu; najmanje potvrditi da off-server kopija obuhvaća bazu i uploadove.
- [ ] OS zakrpe na stagingu pa produkciji/forum VPS-u. `unattended-upgrades` pokriva hitne sigurnosne zakrpe; ostale prolaze svjesno. Reboot izvesti u slabom prometu, a očekivani prekid >5 min najaviti 24 h unaprijed.
- [ ] PostgreSQL, Caddy, Node base image i ostale pinane slike: nadogradnja ide kroz zaseban PR → CI → staging → produkcija. Ne mijenjati digest/tag izravno na VPS-u.
- [ ] Očistiti stare Docker slike tek nakon bilježenja aktivnog i prethodnog rollback digesta. Koristiti ciljano uklanjanje; `docker image prune -a` bez pregleda nije redovna slijepa naredba.
- [ ] Discourse: pregledati sigurnosne/stabilne nadogradnje i prvo potvrditi svjež backup ([vodič Discoursea](vodic-postava-discourse.md#nadogradnje)).
- [ ] Provjeriti GitHub/Hetzner/Resend/monitoring račune, neuspjele prijave i potrošnju kvota.

## Kvartalno (1–2 h)

- [ ] Test rollbacka na stagingu: promocija starijeg digesta i povratak ([runbook-objava-i-rollback.md](runbook-objava-i-rollback.md)).
- [ ] Pregled pristupa: osobni/deploy SSH ključevi, `authorized_keys`, GitHub Environment tajne, Storage Box podračuni i Bitwarden zapisi. Ukloniti sve što nema stvarnog vlasnika ili svrhu.
- [ ] Rotirati deploy ključ po okruženju jedan po jedan: dodati novi, dokazati ga, promijeniti GitHub tajnu, zatim opozvati stari. Nikad prvo ne brisati jedini potvrđeni pristup.
- [ ] Node/PostgreSQL verzije: planira li se nadogradnja glavne verzije (Postgres nadogradnja = zaseban plan s backupom).
- [ ] Pregled ovog dokumenta i runbookova: odgovara li stvarnosti? (Dokumentacija koja laže gora je od nikakve.)

## Svakih šest mjeseci (do 4 h)

- [ ] **Potpuni recovery drill** na privremenom zamjenskom VPS-u: bootstrap Ubuntu 24.04 x86, ponovno dodjeljivanje testne/zaštićene Primary IPv4, vraćanje šifriranog dumpa, zadnjeg zdravog digesta, TLS-a, healtha, partije, backupa i alarma.
- [ ] Izmjeriti stvarno vrijeme i usporediti s RTO ciljem od 4 sata. Svaki nedokumentirani ručni korak postaje dokumentacijski ili automatizacijski zadatak.
- [ ] Privremeni recovery resurs ukloniti tek nakon provjere da produkcija i zaštićena Primary IPv4 nisu pogođeni.

## Godišnje

- [ ] Obnova domene kaladont.hr (provjeriti auto-renew kod registrara).
- [ ] Napraviti šifrirani Bitwarden izvoz na odvojeni offline medij te dokazati otvaranje bez mijenjanja živog vaulta. Provjeriti 2FA recovery kodove i privatni `age` ključ.
- [ ] Provjera DPA/uvjeta, EU obrade, cijena i kontaktnih podataka pružatelja (Hetzner, Storage Box, Resend, UptimeRobot, Healthchecks.io, XHosting).
- [ ] Procijeniti je li i dalje prihvatljiv rizik da su VPS i udaljeni backup kod istog pružatelja.
- [ ] Velika revizija dokumentacije `docs/07-operacije/`.

## Evidencija drillova, objava i većih zahvata

Release identitet, statusi i obavezna polja definirani su u [release shemi](release-shema.md#predložak-zapisa-releasea). U evidenciju ulazi svaki staging closed test kandidat, produkcijska promocija, rollback, produkcijska probna partija, DB restore drill, potpuni recovery drill, rotacija ključeva, veća OS/PostgreSQL nadogradnja i incident.

| UTC datum/vrijeme            | Vrsta                       | Digest / commit / kopija / partija                 | Trajanje | Rezultat i napomena                                 |
| ---------------------------- | --------------------------- | -------------------------------------------------- | -------- | --------------------------------------------------- |
| _(primjer)_ 2026-09-20 04:30 | DB restore drill            | `backup-PLACEHOLDER.dump.age`                      | 12 min   | OK; sve provjere prošle; privremeni volume uklonjen |
| _(primjer)_ 2026-09-21 06:00 | Staging closed test release | `sha256:PLACEHOLDER`; commit `PLACEHOLDER`         | 18 min   | `staging-provjereno`; četiri sesije i login prošli  |
| _(primjer)_ 2026-09-22 06:00 | Produkcijska objava         | `sha256:PLACEHOLDER`; probna partija `PLACEHOLDER` | 4 min    | `promovirano`; health, stranice i cijela partija prošli |

Stvarne tajne, email adrese, privatni ključevi i popisi testera nikad se ne zapisuju u repozitorij.

## PR09: univerzalni rang (backfill)

Nakon deploya koji uključuje migraciju `0065_univerzalni_rang`, **odmah** pokreni CLI prije nego što se osloniš na prikaz ranga na stagingu/produkciji.

```bash
# 1) Migracije (ako pipeline već nije)
pnpm --filter posluzitelj migracije

# 2) Usporedba legacy max(2p,4p) vs univerzalni agregat (bez PII)
pnpm --filter posluzitelj backfill-univerzalni-rang -- --usporedi

# 3) Upis doprinosa + agregata (gostovi se ne agregiraju; nema sandučić obavijesti)
pnpm --filter posluzitelj backfill-univerzalni-rang -- --primijeni=DA

# Produkcija dodatno:
pnpm --filter posluzitelj backfill-univerzalni-rang -- --primijeni=DA --odrzavanje-produkcije=DA

# 4) Ponovna usporedba + drugi prolaz (mora biti no-op / samo „već upisano”)
pnpm --filter posluzitelj backfill-univerzalni-rang -- --usporedi
pnpm --filter posluzitelj backfill-univerzalni-rang -- --primijeni=DA

# Opcionalno: deterministički rebuild agregata iz već upisanih doprinosa
pnpm --filter posluzitelj backfill-univerzalni-rang -- --obnovi-agregate=DA
```

- Restart tijekom rada je siguran: nastavi s `--od=<zadnji-partija-uuid>`.
- Nepotpune partije (bez plasmana) idu samo u report (`brojNepotpunihPartija`) — ne ruše CI.
- Legacy stupci `odigrane` / `bodovi_*` ostaju za formatne statistike i rollback starog bina; rang se više ne čita iz njih.

## PR11: prijelaz ljestvica (otvorene tablice / Top10)

Nakon deploya builda koji sadrži PR11 (pragovi 5/10 + Troboj ljestvica), **odmah** pokreni CLI da se upravo kvalificirani igrači u **otvorenim** dnevnim/tjednim/mjesečnim Top10 upišu postojećim idempotentnim putem. Javno čitanje ljestvica već koristi nove minimume bez CLI-ja; CLI je potreban za Top10 dokaze/dostignuća.

```bash
# 1) Usporedba: tko je u Top10 pod novim minom, a još nema dokaz (bez PII)
pnpm --filter posluzitelj prijelaz-ljestvice-pr11 -- --usporedi

# 2) Upis snimke za sva tri formata (2/3/4)
pnpm --filter posluzitelj prijelaz-ljestvice-pr11 -- --primijeni=DA

# Produkcija dodatno:
pnpm --filter posluzitelj prijelaz-ljestvice-pr11 -- --primijeni=DA --odrzavanje-produkcije=DA

# 3) Ponovna usporedba + drugi prolaz (noviDokazi mora biti 0)
pnpm --filter posluzitelj prijelaz-ljestvice-pr11 -- --usporedi
pnpm --filter posluzitelj prijelaz-ljestvice-pr11 -- --primijeni=DA
```

- Ne skenirati zatvorena razdoblja; ne izmišljati povijesne Top10 ulaske.
- Dist-only container (isti obrazac kao PR09): `node /tmp/pokreni-prijelaz-ljestvice-pr11.mjs --usporedi` (skopiraj `tmp-ci/pokreni-prijelaz-ljestvice-pr11.mjs`).
- HINT za produkcijski checklist 0.2.0: uz PR09 backfill (ako još nije) + ovaj PR11 prijelaz.
