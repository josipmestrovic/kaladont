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

## Prijava riječi

`POST /api/prijave` zahtijeva identificiranog sudionika završene partije i tijelo `{ partijaId, potezId }`. Server provjerava da potez pripada partiji i da je riječ o odigranoj riječi. Jedan igrač može prijaviti najviše tri različita poteza u istoj partiji, a ponovljena prijava istog poteza vraća `409`. Dosegnut limit vraća `429`. Email obavijest administratoru šalje se best-effort nakon spremanja i ne blokira HTTP odgovor. Gosti imaju ista prava kao registrirani korisnici.