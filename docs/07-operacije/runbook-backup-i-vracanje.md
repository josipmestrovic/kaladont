# Runbook: sigurnosne kopije i vraćanje

Ovo je autoritativni postupak za backup i oporavak baze igre. Vrijedi pravilo: **kopija koja nije testirana vraćanjem ne postoji.** Nadzor poslova opisan je u [nadzoru i dnevnicima](nadzor-i-dnevnici.md), a potpuna početnička izvedba u [Operacije for dummies](operacije-for-dummies.md).

> **Status: ciljano stanje, još nije implementirano.** Verzionirane backup/restore skripte, systemd service/timer jedinice, `age` ključevi, Storage Box i Healthchecks provjere još ne postoje. Naredbe u ovom dokumentu predstavljaju ugovor budućih artefakata, ne današnju funkcionalnost.

## Ciljevi i izvori oporavka

| Cilj                    | Vrijednost        | Značenje                                                                             |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| RPO produkcijske baze   | najviše 24 sata   | nakon potpunog gubitka baze smije nedostajati najviše jedan dnevni interval podataka |
| RTO produkcijske usluge | najviše 4 sata    | od potvrđenog potpunog kvara do zdrave igre na istoj domeni                          |
| Rollback loše objave    | najviše 15 minuta | povrat prethodnog aplikacijskog digesta; nije vraćanje baze                          |

**Autoritativni DB backup** je šifrirani PostgreSQL dump na Storage Boxu. **Hetzner daily backup** je pomoćna snimka cijelog diska za bržu obnovu stroja: backup aktivnog diska nema zajamčenu konzistentnost baze i briše se zajedno sa serverom. Ne zamjenjuje `pg_dump`.

VPS i Storage Box nalaze se kod istog pružatelja. To štiti od kvara ili brisanja pojedinog VPS-a, ali ne i od potpunog gubitka Hetzner računa ili pružatelja; taj rizik svjesno je prihvaćen za MVP.

## Kako backup radi

Na produkcijskom VPS-u systemd timer oko 04:00 UTC pokreće verzionirani backup service. Service:

1. šalje `/start` signal zasebnom Healthchecks.io checku;
2. provjerava dostupnost baze, slobodan lokalni prostor i sve obvezne varijable;
3. radi `pg_dump` u PostgreSQL custom formatu (`-Fc`) u lokalni privremeni direktorij;
4. šifrira dump javnim `age` recipientom **prije** napuštanja VPS-a;
5. računa SHA-256 šifrirane datoteke;
6. prenosi samo `.age` datoteku na produkcijski Storage Box podračun preko SSH ključa/SFTP-a;
7. na udaljenoj strani provjerava postojanje, očekivanu veličinu i SHA-256;
8. provodi retenciju 7 dnevnih + 4 tjedne kopije;
9. briše lokalni plaintext dump i stare lokalne šifrirane kopije;
10. šalje success ping tek kada su svi koraci uspjeli, odnosno `/fail` pri bilo kojem neuspjehu.

Privatni `age` ključ **nije na VPS-u**. Nalazi se u Bitwardenu i šifriranom offline izvozu. Dnevna automatika zato može stvarati šifrirane kopije, ali ih ne može sama dešifrirati; mjesečni ljudski restore drill dokazuje uporabljivost.

Jedan Storage Box ima zasebne podračune za produkciju igre i forum. Svaki VPS dobiva samo ključ vlastitog podračuna i ne može čitati direktorij drugog sustava. Glavni Storage Box pristup ostaje u Bitwardenu. Automatski dnevni Storage Box snapshotovi daju dodatnu točku oporavka ako kompromitirani VPS izbriše datoteke iz svojeg podračuna.

Systemd timer i service koriste UTC, `Persistent=true` i nasumičnu malu odgodu kako bi se propušteni posao izvršio nakon ponovnog paljenja bez istodobnog udara svih poslova. Točan naziv jedinice i naredba moraju odgovarati budućim verzioniranim skriptama.

## Backup prije produkcijske migracije

Produkcijski workflow prije **svake** migracije poziva isti backup mehanizam i čeka potvrdu svih koraka, uključujući udaljenu SHA-256 provjeru. Ako backup ne uspije, migracija i deploy ne počinju. U GitHub Deployment zapis sprema se samo vrijeme/identifikator kopije i rezultat, nikad tajna ili sadržaj dumpa.

Ovaj backup ne mijenja dnevnu retenciju: migracijska kopija dobiva prepoznatljivu oznaku i čuva se najmanje dok nova verzija ne prođe produkcijsku provjeru i sljedeći redovni dnevni backup.

## Forum i početni staging dokaz

Postojeći Discourse trenutno ima lokalni Discourse backup i Hetzner daily backup, ali nema kopiju izvan forumskog VPS-a. Prvi infrastrukturni zadatak je:

1. stvoriti forumski Storage Box podračun i zaseban SSH ključ;
2. pronaći najnoviji ugrađeni Discourse backup baze i uploadova;
3. šifrirati ga javnim `age` recipientom i prenijeti na forumski podračun;
4. uključiti Healthchecks heartbeat;
5. vratiti kopiju na izoliranu testnu Discourse instancu prema službenom postupku.

Prije kupnje produkcijskog VPS-a staging dobiva **privremeni** Storage Box podračun. Istim budućim skriptama radi se dump sintetičke staging baze, prijenos i restore u praznu izoliranu bazu. Time se dokazuje cijeli put igre bez prijenosa produkcijskih podataka na staging. Nakon dokaza staging periodični backup nije potreban; podračun se uklanja ili onemogućuje prema evidentiranom postupku.

## Brza provjera da backup živi

Automatski Healthchecks alarm nije zamjena za ljudsku provjeru. Tjedno operater potvrđuje:

- zadnji systemd service završio je s `success` i nije preskočen;
- današnja `.age` datoteka postoji na pravom Storage Box podračunu;
- veličina i trend nisu sumnjivo mali ili naglo veliki;
- zabilježeni SHA-256 odgovara udaljenoj datoteci;
- postoje očekivane dnevne i tjedne generacije, bez nekontroliranog rasta;
- Storage Box snapshot za zadnji dan postoji;
- lokalni privremeni direktorij ne sadrži plaintext dump.

Ne otvarati, preuzimati ni dešifrirati produkcijski dump samo radi tjedne provjere. To radi mjesečni drill.

## Mjesečni drill vraćanja (30 min)

Vraća se **u izoliranu, praznu PostgreSQL instancu na produkcijskom VPS-u**, nikad preko žive baze i nikad na staging. Termin je vrijeme slabog prometa jer privremena baza koristi CPU, RAM i disk.

1. Provjeri da ima dovoljno slobodnog diska i memorije te zabilježi ciljnu backup datoteku i SHA-256.
2. Preuzmi šifriranu kopiju sa Storage Boxa i ponovno provjeri SHA-256.
3. Privatni `age` ključ prenesi iz Bitwardena u root-only datoteku na memorijskom filesystemu (`/dev/shm`), bez lijepljenja u naredbu ili shell history; ukloni je čim dešifriranje završi.
4. Podigni zaseban privremeni PostgreSQL kontejner/volume na internoj mreži bez javnog porta, s očitim nazivom koji nije `baza`.
5. Dešifriraj u privremenu datoteku, provjeri `pg_restore --list`, zatim vrati u praznu bazu.
6. Provjeri broj redaka ključnih tablica (`igraci`, `partije`, `rijeci`), strane ključeve i uzorak zadnje završene partije sa sudionicima/potezima; `rijeci` mora biti > 0.
7. Zapiši početak, kraj, trajanje, digest aplikacije, naziv kopije i rezultat u [evidenciju održavanja](odrzavanje.md).
8. Sruši **isključivo očito imenovan privremeni** kontejner i volume, ukloni dešifrirani dump i privatni ključ iz `/dev/shm`, pa potvrdi da živa baza i aplikacija i dalje rade.

Destruktivni dio buduće restore skripte mora zahtijevati eksplicitno ime cilja i odbiti produkcijski naziv/URL. Nikad ne koristi zadanu `BAZA_URL` za drill.

Forumski restore dokaz izvodi se prije nego se njegov off-server backup proglasi gotovim, a zatim prema rasporedu održavanja. Ne koristi bazu ni Compose mrežu igre.

## Stvarno vraćanje nakon incidenta

1. **Stani i procijeni** prema [incidentnom postupku](incidentni-postupak.md). Spremi logove i utvrdi je li baza doista neupotrebljiva; rollback aplikacije nije razlog za restore baze.
2. Utvrdi vrijeme zadnje zdrave kopije i očekivani gubitak. Restore znači gubitak svih novijih računa, partija i statistike, najviše do dogovorenog RPO-a od 24 sata.
3. Zaustavi aplikaciju kako se stanje ne bi dalje mijenjalo, ali ne briši postojeći volume.
4. Vrati odabranu kopiju u **novu** bazu/volume i izvrši iste provjere kao u mjesečnom drillu.
5. Tek nakon provjera promijeni produkcijsku konfiguraciju prema novoj bazi, pokreni zadnji poznato-zdravi aplikacijski digest i provjeri `/zdravlje` te cijelu partiju.
6. Obavijesti igrače na forumu o prekidu i potvrđenom razdoblju gubitka podataka. Ne nagađaj.
7. Sačuvaj staru oštećenu bazu do završetka analize i kapacitetskog roka, zatim je ukloni dokumentiranim postupkom.
8. Zapiši incident i konkretnu preventivnu promjenu.

## Potpuni oporavak VPS-a (RTO 4 sata)

Ovaj drill izvodi se prije javnog lansiranja i svakih šest mjeseci na privremenom zamjenskom VPS-u. Tijekom pravog incidenta cilj je isti:

1. Pokreni mjerenje RTO-a i sačuvaj dokaze. Ako je stari VPS dostupan, ugasi ga; ne dopusti da dva stroja koriste istu bazu ili IP.
2. U Hetzneru stvori zamjenski Ubuntu 24.04 x86 VPS u **istoj lokaciji** kao zaštićena produkcijska Primary IPv4.
3. Primijeni verzionirani bootstrap/checklist: Cloud Firewall, korisnici, SSH, UFW, fail2ban, Docker, direktoriji i konfiguracija.
4. Odvoji Primary IPv4 od ugašenog stroja i dodijeli je zamjenskom. XHosting DNS ostaje nepromijenjen.
5. Ako valjani Hetzner backup ubrzava obnovu, stvori novi server iz njega, ali bazu i dalje provjeri; pri sumnji koristi autoritativni Storage Box dump.
6. Preuzmi zadnji poznato-zdravi aplikacijski digest i odabrani šifrirani dump. Vrati bazu u novi volume.
7. Pokreni Caddy, bazu i aplikaciju, provjeri portove, TLS, `/zdravlje`, Resend, admin i cijelu partiju.
8. Ponovno uključi/provjeri systemd timere, UptimeRobot i Healthchecks; izvedi novi backup s obnovljenog stroja.
9. Zaustavi sat tek kada je javna domena zdrava i provjere prolaze. Zapiši trajanje i svako ručno odstupanje od vodiča.

Ako je zaštićena Primary IPv4 izgubljena ili zamjenski VPS mora biti u drugoj lokaciji, RTO ovisi o XHosting podršci i DNS propagaciji; to je iznimni put, ne osnovni recovery plan.

## Ako backup NE radi (alarm ili prazan direktorij)

1. Healthchecks alarm potvrdi kao aktivan, ne pauziraj ga radi utišavanja simptoma.
2. Pregledaj `systemctl status` i `journalctl` za točan backup service; spremi izlaz prije ponavljanja.
3. Provjeri disk, dostupnost baze, `age` recipient, Storage Box DNS/SSH fingerprint, podračun/ključ, udaljeni prostor i retenciju.
4. Ispravi samo utvrđeni uzrok. Ne briši udaljene generacije niti resetiraj Storage Box glavni račun naslijepo.
5. Ručno pokreni isti systemd service, potvrdi udaljenu veličinu/SHA-256 i success heartbeat. Ne čekaj sljedeću noć.
6. Ako nema potvrđenog produkcijskog backupa, odgodi svaku migraciju i zabilježi razdoblje povećanog rizika.
