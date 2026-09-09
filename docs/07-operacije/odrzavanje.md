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

| UTC datum/vrijeme            | Vrsta               | Digest / kopija / partija                          | Trajanje | Rezultat i napomena                                 |
| ---------------------------- | ------------------- | -------------------------------------------------- | -------- | --------------------------------------------------- |
| _(primjer)_ 2026-09-20 04:30 | DB restore drill    | `backup-PLACEHOLDER.dump.age`                      | 12 min   | OK; sve provjere prošle; privremeni volume uklonjen |
| _(primjer)_ 2026-09-21 06:00 | Produkcijska objava | `sha256:PLACEHOLDER`; probna partija `PLACEHOLDER` | 4 min    | Health, stranice i cijela partija prošli            |

U evidenciju ulaze: svaka produkcijska promocija i rollback, produkcijska probna partija, DB restore drill, potpuni recovery drill, rotacija ključeva, veća OS/PostgreSQL nadogradnja i incident. Stvarne tajne, email adrese i privatni ključevi nikad se ne zapisuju.
