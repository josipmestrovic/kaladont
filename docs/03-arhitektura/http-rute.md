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

## Vremenske ljestvice

`GET /api/ljestvice?mod=cetiri_igraca|dva_igraca&metrika=prosjek_bodova|niz_pobjeda&razdoblje=dnevno|tjedno|mjesecno|godisnje|svih_vremena&prikaz=top|oko_mene` (svi parametri opcionalni; neispravna vrijednost vraća `400`). Identifikacija je opcionalna; „moja” pozicija dolazi isključivo iz sesije. Odgovor (tip `OdgovorLjestvice` u `zajednicko`) sadrži najviše 10 redaka s globalnim mjestima, vlastitu poziciju i statuse za svih pet razdoblja, `razdoblje.do` za odbrojavanje do resetiranja i `izracunatoU` (serverski sat). Zaključano svih vremena vraća prazne retke i `otkljucavaSe`. Odgovor ima `Cache-Control: private, no-store`; poslužitelj poredak drži u memoriji najviše 30 s i nikad preko kraja razdoblja.

Stari `GET /api/ljestvica` ostaje privremeno radi kompatibilnosti.

## Prijava riječi

`POST /api/prijave` zahtijeva identificiranog sudionika završene partije i tijelo `{ partijaId, potezId }`. Server provjerava da potez pripada partiji i da je riječ o odigranoj riječi. Jedan igrač može prijaviti najviše tri različita poteza u istoj partiji, a ponovljena prijava istog poteza vraća `409`. Dosegnut limit vraća `429`. Email obavijest administratoru šalje se best-effort nakon spremanja i ne blokira HTTP odgovor. Gosti imaju ista prava kao registrirani korisnici.