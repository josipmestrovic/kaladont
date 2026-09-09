# Dimenzioniranje poslužitelja

Procjena resursa po ulozi i pragovi na kojima se mijenja veličina servera ili arhitektura. Cjenik je provjeren 2026-09-08, ali Hetzner mijenja cijene i raspoloživost: **konačan iznos i dostupnost u odabranoj lokaciji uvijek se provjeravaju u konzoli neposredno prije kupnje**.

Početni cilj je cost-optimized **x86/amd64 CX23** (2 vCPU, 4 GB RAM-a, 40 GB NVMe). Objavljena cijena je 5,99 EUR mjesečno bez PDV-a i uključuje Primary IPv4. Hetzner ga u trenutku provjere označava ograničeno dostupnim/nedostupnim. Ako CX23 nije dostupan u istoj lokaciji kao postojeći forum, postava staje radi nove odluke o lokaciji, planu i budžetu; ne kupuje se automatski skuplji CPX22 niti ARM instanca.

## Zašto je igra lagana po potezu (činjenice iz arhitekture)

- Rječnik (≈ 1,2 milijuna oblika, [ADR-013](../03-arhitektura/odluke/013-sve-vrste-rijeci-leksemske-grupe.md)) živi u memoriji poslužitelja: **validacija poteza ne dira bazu**, sve provjere su O(1) ([ADR-007](../03-arhitektura/odluke/007-rjecnik-u-memoriji.md)). Zauzeće: ~150–200 MB RAM-a (izmjereno analizom uvoza).
- Po prihvaćenom potezu ide **točno 1 INSERT** u `potezi`; odbijeni pokušaji se ne zapisuju. Kraj partije je jedna transakcija (rezultati + agregati).
- Po stolu postoji **jedan aktivni timer** (timeout), ne tick po sekundi — odbrojavanje renderira klijent iz `istekPotezaIso`.
- Partija ide isključivo preko WebSocketa; SSR opterećuje samo statične stranice i landing.
- Jedina skupa točka u v1: „Top riječi" na ljestvici radi `GROUP BY` nad `potezi` **bez keša** — prvi kandidat za optimizaciju kad tablica naraste.

## Matematika opterećenja

Pretpostavke: ~80 % istovremenih korisnika sjedi za stolom (4 po stolu), prosječan potez ~10 s, svaki potez = 1 upis u bazu + poruka četvorici.

| Vršno istovremenih | Stolova  | Poteza/s | Upisa u bazu/s | Socket poruka/s | RAM aplikacije | Procjena CPU-a             |
| ------------------ | -------- | -------- | -------------- | --------------- | -------------- | -------------------------- |
| 100                | ~20–25   | ~2–3     | ~3             | ~10–15          | ~0,3–0,4 GB    | < 15 % od 2 vCPU           |
| 1 000              | ~200–250 | ~20–25   | ~25–30         | ~100–150        | ~0,5–0,8 GB    | ~50 % od 2 vCPU — rub      |
| 10 000             | ~2 000+  | ~200+    | ~250+          | ~1 000+         | ~2–3 GB        | jedan proces nije dovoljan |

Za mjerilo: 100 vršno istovremenih odgovara redu veličine nekoliko tisuća posjeta dnevno — daleko iznad MVP praga uspjeha (30 partija/dan).

## Preporuka po ulozi

| Uloga                           | Server                                                 | Mjesečno                        | Obrazloženje                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Igra (produkcija)**           | CX23 (2 vCPU / 4 GB, x86)                              | 5,99 € + 20 % backup, bez PDV-a | Nosi početni Compose: Node aplikacija, PostgreSQL i Caddy. RAM procjena: rječnik/Node ~0,5–0,8 GB, Postgres ~0,5–1 GB, Caddy + OS/Docker ~0,5–0,8 GB; ostaje rezerva za kratke špice. Umami nije dio početnog stacka. |
| **Staging**                     | CX23 (stalni, x86)                                     | 5,99 € bez PDV-a                | Iste verzije aplikacije/PostgreSQL-a/Caddyja i vlastita baza, bez stvarnog prometa i bez Hetzner backup opcije. Stalni staging dokazuje deploy i migracije, ne nosivost.                                              |
| **Forum (postojeći Discourse)** | postojeći CX23 ili provjereni ekvivalent               | 5,99 € + 20 % backup, bez PDV-a | Zaseban VPS s vlastitim Postgresom/Redisom. Njegov stvarni plan i lokacija provjeravaju se u Hetzner konzoli; vodič ih ne mijenja napamet.                                                                            |
| **Igra nakon mjerene granice**  | CX33 (4 vCPU / 8 GB, x86) ili tada aktualni ekvivalent | provjeriti pri odluci           | Rezerva kada nadzor pokaže trajno visok CPU/RAM, reconnect špice ili spor SSR. Vertikalni rescale prethodi izdvojenoj bazi.                                                                                           |
| **Umami nakon stabilizacije**   | bez vlastitog VPS-a                                    | bez dodatnog VPS troška         | Naknadni kontejner na produkcijskom VPS-u (~0,2 GB RAM prema početnoj procjeni); prije uključivanja ponovno provjeriti stvarnu memorijsku rezervu.                                                                    |

## Početni mjesečni budžet

Ako su sva tri VPS-a CX23 po 5,99 EUR i Hetzner backup je uključen za produkciju i forum:

| Stavka                                                         |   Bez PDV-a |
| -------------------------------------------------------------- | ----------: |
| 3 × CX23, Primary IPv4 uključene                               |     17,97 € |
| produkcijski + forumski Hetzner backup (2 × 20 % cijene VPS-a) |      2,40 € |
| Storage Box BX11                                               |      3,20 € |
| **Ukupno**                                                     | **23,57 €** |

Uz hrvatski PDV od 25 % to je približno **29,46 EUR mjesečno**, ako ga Hetzner obračunava na tom korisničkom računu. Planirani okvir **30–35 EUR mjesečno** zato je razuman samo uz dostupan CX23 i bez dodatnih plaćenih email/monitoring kapaciteta. Domena, eventualni višak prometa, privremeni recovery VPS/snapshoti i budući Umami nisu uključeni.

Ako se kupuje samo nova infrastruktura igre, a postojeći forum već se plaća, inkrementalni trošak su staging + produkcija + produkcijski backup + Storage Box; forumski VPS/backup ostaju dio ukupnog operativnog troška sustava.

Regular-performance CPX22 (2 vCPU / 4 GB) u trenutku provjere ima objavljenu cijenu 19,99 EUR mjesečno bez PDV-a. Zamjena dvaju ili triju CX23 tim planom značajno prelazi dogovoreni budžet i traži novu odluku, ne tihi fallback.

## Odgovori na konkretna pitanja

**Je li 2 vCPU / 4 GB dovoljno za forum?** Za sada je postojeći forum mjerodavan. Discourse VPS se ne mijenja samo radi ujednačavanja naziva plana. Prije novih servera zabilježe se njegova stvarna lokacija, plan, RAM/swap, disk i opterećenje.

**Mora li staging imati iste resurse kao produkcija?** Ne mora radi performansi, ali u početku koristi isti mali plan radi jednostavnosti i iste arhitekture. Jednaki moraju biti operativni uvjeti koji se testiraju: amd64 image, verzije PostgreSQL-a/Caddyja, TLS, migracije i vlastita baza. Staging je stalno uključen dok se aktivno razvija; ugašeni postojeći server i dalje se naplaćuje.

**Treba li Umami poseban server?** Ne prema sadašnjem planu, ali ne ulazi u prvi launch. Prije naknadnog uključivanja provjerava se stvarna slobodna memorija produkcijskog VPS-a i backup obuhvat. Pad Umamija ne smije rušiti igru.

**Treba li baza zaseban VPS?** Ne za MVP. Izdvajanje sada uvodi privatno umrežavanje, dodatni firewall, zaseban oporavak i još jednu točku kvara bez mjerene potrebe. Prvo se vertikalno povećava produkcijski VPS. Postgres se izdvaja kada nadzor pokaže trajnu resursnu konkurenciju ili kada se promijeni cilj dostupnosti, okvirno prije horizontalnog skaliranja na više Node procesa.

**Koliko brzo raste baza?** Partija je ~30 poteza ≈ 5 KB s indeksima. Tisuću partija dnevno ≈ 5 GB godišnje — 40 GB diska traje godinama. Tek na razini od ~10 000 istovremenih (desetci tisuća partija dnevno) treba particioniranje tablice `potezi` i arhiviranje starih partija.

## Put prema 10 000 istovremenih (redoslijed zahvata)

Deset tisuća istovremenih nije „veći server" nego druga arhitektura. Redoslijed kojim se isplati raditi:

1. **Keš za „Top riječi"** i provjera indeksa — već pri ~1 milijun redaka u `potezi`.
2. **Odvojiti Postgres** na vlastiti server kada mjerenje pokaže konkurenciju za CPU/RAM/IO ili prije više aplikacijskih čvorova; broj od ~2 000 vršno istovremenih samo je signal za novu procjenu, ne automatski okidač.
3. **Više Node procesa** + Socket.IO Redis adapter + sticky sessions — jedan event loop realno nosi nekoliko tisuća aktivnih veza uz naš SSR; ovo je najveći zahvat i traži izmjene u kodu (svaki proces drži vlastitu read-only kopiju rječnika, što ADR-007 već predviđa).
4. **Dedicirani vCPU** (CCX linija) umjesto shared — tek kad „CPU steal" na shared instancama postane mjerljiv u nadzoru.
5. **Particioniranje `potezi`** po mjesecima + arhiva.

Do tada vrijedi pravilo: **ne kupovati resurse unaprijed** — rescale na Hetzneru traje minute, a MVP pragovi odluke ([metrike-uspjeha.md](../01-proizvod/metrike-uspjeha.md)) mjere stotine, ne tisuće partija dnevno.

## Sitne uštede i napomene

- **Arm64 (CAX linija)** nije početna alternativa za nestašicu CX23. Zahtijeva provjeru native Node ovisnosti, svih upstream slika, build platforme i recovery kompatibilnosti; odluka bi mijenjala ADR-014.
- Hetzner **backup opcija (+20 % cijene servera)** uključuje 7 dnevnih kopija — uzeti za produkciju igre i za forum; staging ne treba.
- Zaštićena Primary IPv4 naplaćuje se kao dio odabranog plana dok je dodijeljena; ako ostane samostalna nakon brisanja servera, Hetzner je nastavlja naplaćivati. Konzola je konačni izvor iznosa.
- Storage Box BX11 je u trenutku provjere 3,20 EUR mjesečno bez PDV-a i dovoljan je za početne šifrirane dumpove; zauzeće snapshotova prati se mjesečno.
- Promet (20 TB po serveru) nije ograničenje: WebSocket poruke su sitne, čak i 10 000 istovremenih ne prilazi toj granici.
