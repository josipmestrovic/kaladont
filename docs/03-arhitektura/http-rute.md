# HTTP rute

Poslovne HTTP rute Kaladonta imaju namespace `/api`. URL-ovi stranica ostaju bez tog prefiksa:
`/profil`, `/profil/javni/:igracId`, `/ljestvica`, `/admin` i ostali SvelteKit ekrani.

## Pravilo

- frontend poslovne pozive šalje na `/api/...`;
- izgrađeni Fastify proces prvo registrira poslovni API plugin s prefiksom `/api`;
- SvelteKit catch-all poslužuje dokumente stranica tek nakon API fallbacka;
- nepoznate `/api`, `/api/` i `/api/...` putanje vraćaju JSON 404;
- `/zdravlje`, `/socket.io/`, `/zvukovi/*` i statički `/_app/*` ostaju izvan API namespacea;
- stari `GET /racuni/potvrdi-email?token=...` ostaje samo kompatibilni redirect na stranicu potvrde emaila;
- stari JSON API aliasi poput `/profil` i `/ljestvica` ne postoje.

Centralni frontend helper `apiUrl()` dodaje `/api` samo poslovnim pozivima. Socket.IO zadržava postojeću adresu poslužitelja i path.