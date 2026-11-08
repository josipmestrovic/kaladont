# HTTP rute

Poslovne HTTP rute Kaladonta imaju namespace `/api`. URL-ovi stranica ostaju bez tog prefiksa:
`/profil`, `/profil/javni/:igracId`, `/ljestvice`, `/admin` i ostali SvelteKit ekrani. Stara stranica `/ljestvica` trajno (308) preusmjerava na `/ljestvice` (`?tab=rijeci` → `?kategorija=rijeci`).

## Pravilo

- frontend poslovne pozive šalje na `/api/...`;
- izgrađeni Fastify proces prvo registrira poslovni API plugin s prefiksom `/api`;
- SvelteKit catch-all poslužuje dokumente stranica tek nakon API fallbacka;
- nepoznate `/api`, `/api/` i `/api/...` putanje vraćaju JSON 404;
- `/zdravlje`, `/socket.io/`, `/zvukovi/*` i statički `/_app/*` ostaju izvan API namespacea;
- stari `GET /racuni/potvrdi-email?token=...` ostaje samo kompatibilni redirect na stranicu potvrde emaila;
- stari JSON API aliasi poput `/profil` i `/ljestvica` ne postoje.

Centralni frontend helper `apiUrl()` dodaje `/api` samo poslovnim pozivima. Socket.IO zadržava postojeću adresu poslužitelja i path.

## Admin botovi

- `GET /api/admin/botovi/postavke`: trenutačni zapis (`revizija`, `konfiguracija`, `azurirano`, `azuriraoId`), zadane vrijednosti i dopuštenje brzog razvoja. Revizija 0 znači da trajni zapis još ne postoji.
- `PUT /api/admin/botovi/postavke`: tijelo `{ revizija, konfiguracija }`, potpuna strogo validirana konfiguracija. Nevaljane vrijednosti vraćaju 400, sukob očekivane revizije 409; ograničeno na 10 zahtjeva u minuti. Audit i postavke spremaju se atomarno. Novu konfiguraciju preuzimaju nove partije i epizode reda.
- `GET /api/admin/botovi/pregled`: vrijeme snapshotova, revizija postavki, sažetak fonda i botovi s rezervacijom/generacijom, stanjem motora, aktualnošću profila i planiranom akcijom. Nema upisa niti izvršavanja naredbi. Vremenski početak stanja koje izvor ne zna prikazuje se kao `null`, ne procjenjuje se iz statistike.
- `POST /api/admin/botovi`: `{ broj: 1..30, tip: 'imenovani' | 'gost' }`; stvaranje je transakcijski zaključano, provjerava konfigurirani aktivni limit/nadimak i zapisuje audit. Rate limit 3/min.
- `PUT /api/admin/botovi/:igracId/aktivacija`: `{ aktivan: boolean }`; deaktivacija sprječava nove rezervacije, oslobađa čekajuće botove i ostavlja aktivnu partiju da se dovrši. Rate limit 20/min; limit aktivnog fonda vraća 409.

Sve rute zahtijevaju admin sesiju (401 bez nje, 403 za običnog igrača) i koriste `Cache-Control: no-store`. Pregled čita memoriju procesa; ponovno pokretanje briše runtime podatke, ne trajnu konfiguraciju. Završena igra zadržana za prikaz spremljenih rezultata nije aktivno zauzeće bota.

Jednokratna zamjena fonda ima CLI samo za održavanje: `pnpm --filter posluzitelj zamijeni-fond-botova` ispisuje read-only preview s postojećim i ciljnim ključevima; `-- --primijeni=DA --posluzitelj-zaustavljen=DA` primjenjuje transakciju. U produkciji treba i `--odrzavanje-produkcije=DA`. Apply odbija uključene javne popune, uključen trening i spremljene aktivne partije. Operater mora zaustaviti poslužitelj prije applya; ne pokreće se automatski.

## Vremenske ljestvice

`GET /api/ljestvice?mod=cetiri_igraca|dva_igraca&metrika=prosjek_bodova|niz_pobjeda&razdoblje=dnevno|tjedno|mjesecno|godisnje|svih_vremena&prikaz=top|oko_mene` (svi parametri opcionalni; neispravna vrijednost vraća `400`). Identifikacija je opcionalna; „moja” pozicija dolazi isključivo iz sesije. Odgovor (tip `OdgovorLjestvice` u `zajednicko`) sadrži najviše 10 redaka s globalnim mjestima, vlastitu poziciju i statuse za svih pet razdoblja, `razdoblje.do` za odbrojavanje do resetiranja i `izracunatoU` (serverski sat). Zaključano svih vremena vraća prazne retke i `otkljucavaSe`. Odgovor ima `Cache-Control: private, no-store`; poslužitelj poredak drži u memoriji najviše 30 s i nikad preko kraja razdoblja.

Stari `GET /api/ljestvica` ostaje privremeno radi kompatibilnosti.

## Prijava riječi i igrača

`POST /api/prijave` zahtijeva identificiranog sudionika partije (`u_tijeku` ili `zavrsena`) i tijelo `{ partijaId, tip: 'za_brisanje'|'za_dodavanje', potezId?, rijec? }`. Za `za_brisanje` treba `potezId` ili `rijec` (lookup u potezima partije); za `za_dodavanje` obavezna je `rijec`. Limit je **3 + 3** po tipu i partiji. Duplikat vraća `409`, limit `429`. Bez email obavijesti.

`POST /api/prijave-igraca` — tijelo `{ partijaId, prijavljeniIgracId, razlog }` (UI šalje `pogrdan_nadimak`). Partija `u_tijeku` ili `zavrsena`; admin lista ne vraća `prijaviteljId`.

Admin (sesija `vrsta=admin`): `GET /api/admin/prijave?status=nova&tip=…`, `POST …/obrisi-rijec|dodaj-rijec|dismiss`; `GET /api/admin/prijave-igraca`, `POST …/obrisi-racun|dismiss`. Izmjene rječnika zovu `ponovoUcitaj()`.

## Sandučic (mailbox)

Autorizirani gost ili registrirani (`zahtijevajIdentifikaciju`). Primatelj je uvijek iz sesije; klijent ne bira tuđi pretinac. Odgovori imaju `Cache-Control: private, no-store`. Poruke starije od 3 dana brišu se periodički.

| Operacija | Ruta | Opis |
|---|---|---|
| Sažetak | `GET /api/sanducic/sazetak` | `brojNeprocitanih` + paket `zaNajavu` (nenajavljene i nepročitane) |
| Lista | `GET /api/sanducic?cursor=…` | Paginacija, najnovije prve; feed prikazuje `naslov` + `tekst` |
| Detalj | `GET /api/sanducic/:id` | Jedna vlastita poruka (deep-link) |
| Pročitaj | `POST /api/sanducic/procitano` | Tijelo `{ ids: string[] }` — idempotentno |
| Pročitaj sve | `POST /api/sanducic/procitano-sve` | Ulazak u `/obavijesti` automatski šalje ovu rutu; granica ne proguta kasnije poruke |
| Potvrdi najavu | `POST /api/sanducic/najavi` | Tijelo `{ ids: string[] }` — samo stvarno prikazani paket |
| Obriši sve | `POST /api/sanducic/obrisi-sve` | Hard-delete svih vlastitih poruka |
| Seed (samo development/test) | `POST /api/sanducic/test` | Ručni/E2E umetak poruke; nije dostupno u staging/production |

UI viewer: `/obavijesti` (feed, auto-pročitano na ulazu). Socket signal `sanducic:promjena` (bez privatnog sadržaja) potiče klijent na ponovni dohvat sažetka.

Periodični tipovi: `forma_10` (javni Dvoboj/Četveroboj, svakih 10 igara toga moda, snapshot forme) i `gost_sazetak_5` (gost, svakih 5 dovršenih igara svih načina). Baseline postojećih igrača troši već dosegnute pragove bez poplave pošte; trening porazi u povijesti nisu pouzdano rekonstruibilni.