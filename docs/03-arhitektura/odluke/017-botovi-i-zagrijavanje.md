# ADR-017: Serverski botovi za popunu reda i trening „Zagrijavanje”

- **Status:** prihvaćen (djelomično nadograđen 2026-11-11: botovi više nisu na ljestvicama/javnim profilima; aktivni fond bez gost-botova; vizualna transparentnost namjenskim avatarima)
- **Datum:** 2026-10-09
- **Mijenja:** [ADR-008](008-bez-matchmakinga-u-mvp.md) (djelomično: ukida odluku „čeka se isključivo ljude”; zajednički red i strategija uparivanja ostaju)

## Kontekst

ADR-008 odbio je botove zbog rizika povjerenja male zajednice. Zatvorena alfa pokazala je drugi problem: u rijetko posjećenim satima igrač čeka beskonačno i odlazi. Partija bez protivnika najveći je pojedinačni ubojica retencije. Igrači su tražili i način da nauče igru bez pritiska javnog reda.

## Odluka

1. **Popuna reda botovima s prednošću ljudi.** Dvoboj: ako nakon 30 s čekanja nema drugog čovjeka, bot popunjava mjesto. Četveroboj: od ulaska najstarijeg čovjeka u grupu prvi bot ulazi nakon 20 s, drugi nakon 30 s, treći nakon 40 s, samo koliko mjesta nedostaje. Čovjek koji stigne prije konačnog pokretanja zamjenjuje rezerviranog bota. Nova javna partija nikada ne nastaje bez barem jednog čovjeka.
2. **Isti obračun.** Javna partija s botovima je javna partija: ljudima vrijede ista pravila, bodovi, rangovi, forma, dostignuća i nagrade kao i bez botova. Nema skrivenog umanjenja.
3. **Bot je domenski sudionik u motoru, ne klijent.** Potezi ljudi i botova prolaze istu autoritativnu obradu. Politika v3 preferira uobičajene osnovne oblike: 90 % imenice, 10 % glagole/pridjeve; leme su aproksimacija morfoloških osnovnih oblika. Računalo u treningu odgovara nakon 1–3 s. Javni tempo računa se od početka punog poteza, kategorijama 20 % brzih / 65 % uobičajenih / 15 % sporih odgovora. Neznanje (20 %) i javni namjerni istek (2 %) predstavljaju najviše jednu priliku po sudjelovanju, ne po potezu. Konfiguracija partije i odluka za isti token ostaju stabilne; tehnički kvar nije ljudski propust. Detalji su u [pravilima botova](../../02-pravila-igre/botovi.md). **Nenapadačka politika:** bot nikada ne traži mrtve nastavke niti ocjenjuje riječ prema protivnikovim mogućnostima; slučajan mrtvi nastavak je dopušten.

Trening nema timer poteza: motor postavlja trajanje na 0, ne zakazuje istek i šalje prazan `istekPotezaIso`. Računalo odgovara nakon 1–3 s i bez timera; javne partije zadržavaju redovni rok. Klijenti i simulator ne smiju prazan rok zamijeniti za pauzu igre.
4. **Trajni identiteti (nadograđeno 2026-11-11).** Javni botovi imaju trajni nadimak i namjenski avatar. **Ne** ulaze na ljudske ljestvice, **nemaju** javni profil i **ne** primaju korisnički XP/rang/dostignuća. Administrator i dalje vidi interne bot zapise. Bot identitet ne može dobiti sesiju, lozinku, reset ni preuzimanje. Aktivni fond: 80 imenovanih + 0 gost-botova (povijesni gost-botovi deaktivirani). U javnim partijama botovi smiju slati brze poruke (pozdrav / sorry / bravo / hvala) prema globalnim frekvencijama u admin postavkama, s odgodom 2–5 s; nije per-bot osobnost.
5. **Zagrijavanje.** Novi način „Igraj dvoboj protiv računala” za goste i registrirane (uključujući nepotvrđen e-mail). Protivnik je privremeno „Računalo” s jednim stalnim avatarom, izvan javnog fonda. Trening ne stvara trajni zapis partije/poteza ni natjecateljski XP, rang, formu, nizove ni kolekciju riječi. Prirodna pobjeda registriranog čovjeka može otključati samo Zagrijan (1/5/20/50/100); poraz, izlazak, neaktivnost i tehnički prekid ne dodjeljuju ga. Gost i privremeno Računalo ne ostavljaju trajne trening zapise.
6. **Mjerljivost za podešavanje.** Vrijeme čekanja ljudi i broj botova po partiji bilježe se i prikazuju administratoru.
7. **Kontrolirano uključivanje.** Tri zasebne zastavice: trening, botovi u Dvoboju, botovi u Četveroboju. Na stagingu se uključuju tim redom. Isključivanje zaustavlja nove rezervacije; započete partije normalno završavaju.

## Razmotrene alternative

- **Bot kao Socket.IO klijent** — sliči stvarnom klijentu, ali uvodi sesije, mrežne kvarove i sigurnosne iznimke; odbačeno.
- **Vanjski jezični model** — ne jamči legalnu riječ, dodaje trošak i kašnjenje; odbačeno.
- **Trening preko postojećih privatnih soba** — privatna partija i dalje zapisuje povijest i statistiku; nije dovoljno za „ništa se ne bilježi”.
- **Vidljiva oznaka bota svim igračima** — ranije odbačeno; od 2026-11-11 transparentnost ide putem namjenskih avatara i oznake „Bot” na završnom poretku, bez bedža tijekom igre.
- **Umanjeni bodovi protiv botova** — jednostavniji balans, ali u suprotnosti s odlukom „sve identično”. Učinak se prati, ne mijenja potajno.

## Posljedice

- Motor dobiva dimenziju `kontekst: javna | privatna | trening` i politiku učinaka partije; sve trajne upise i nagrade kontrolira ta politika.
- Trening potez se potvrđuje kao i u drugim kontekstima, bez upisa kolekcije. Pobjede treninga imaju zaseban idempotentni zapis po UUID-u treninga, bez FK-a na `partije`.
- Shema dobiva `igraci.upravljac` (`covjek` | `bot`), tablicu `botovi` i `partije.broj_botova`; migracije su aditivne.
- Jedan proces ([ADR-012](012-jedan-proces-same-origin.md)) dopušta koordinaciju rezervacija u memoriji; raspodijeljeni koordinator uvodi se tek ako se arhitektura promijeni.
- Slabiji botovi mogu se iskorištavati za bodove; mjeri se udio pobjeda ljudi po sastavu stola i parametri se podešavaju kroz verzioniranu konfiguraciju.
- [opseg-mvp.md](../../01-proizvod/opseg-mvp.md), [pravila-igre.md](../../02-pravila-igre/pravila-igre.md) i [botovi.md](../../02-pravila-igre/botovi.md) ažurirani su u skladu s ovom odlukom.
