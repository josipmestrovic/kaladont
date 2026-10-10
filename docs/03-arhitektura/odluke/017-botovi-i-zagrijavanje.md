# ADR-017: Serverski botovi za popunu reda i trening „Zagrijavanje”

- **Status:** prihvaćen
- **Datum:** 2026-10-09
- **Mijenja:** [ADR-008](008-bez-matchmakinga-u-mvp.md) (djelomično: ukida odluku „čeka se isključivo ljude”; zajednički red i strategija uparivanja ostaju)

## Kontekst

ADR-008 odbio je botove zbog rizika povjerenja male zajednice. Zatvorena alfa pokazala je drugi problem: u rijetko posjećenim satima igrač čeka beskonačno i odlazi. Partija bez protivnika najveći je pojedinačni ubojica retencije. Igrači su tražili i način da nauče igru bez pritiska javnog reda.

## Odluka

1. **Popuna reda botovima s prednošću ljudi.** Dvoboj: ako nakon 30 s čekanja nema drugog čovjeka, bot popunjava mjesto. Četveroboj: od ulaska najstarijeg čovjeka u grupu prvi bot ulazi nakon 20 s, drugi nakon 30 s, treći nakon 40 s, samo koliko mjesta nedostaje. Čovjek koji stigne prije konačnog pokretanja zamjenjuje rezerviranog bota. Nova javna partija nikada ne nastaje bez barem jednog čovjeka.
2. **Isti obračun.** Javna partija s botovima je javna partija: ljudima vrijede ista pravila, bodovi, rangovi, forma, dostignuća i nagrade kao i bez botova. Nema skrivenog umanjenja.
3. **Bot je domenski sudionik u motoru, ne klijent.** Potezi ljudi i botova prolaze istu autoritativnu obradu. Politika v2 (10. 10. 2026.) preferira uobičajene osnovne oblike: 90 % imenice, 10 % glagole/pridjeve; leme su aproksimacija morfoloških osnovnih oblika. Računalo u treningu odgovara nakon 3 s, javni botovi nakon 5–14 s; pri fallbacku imaju 10 % šanse za „Ne znam”. Samo javni botovi imaju 0,5 % šanse namjernog čekanja redovnog isteka, koji se u motoru i nadzoru razlikuje od tehničkog zastoja. Detalji su u [pravilima botova](../../02-pravila-igre/botovi.md). **Nenapadačka politika:** bot nikada ne traži mrtve nastavke niti ocjenjuje riječ prema protivnikovim mogućnostima; slučajan mrtvi nastavak je dopušten.

Trening nema timer poteza: motor postavlja trajanje na 0, ne zakazuje istek i šalje prazan `istekPotezaIso`. Računalo odgovara nakon 3 s i bez timera; javne partije zadržavaju redovni rok. Klijenti i simulator ne smiju prazan rok zamijeniti za pauzu igre.
4. **Trajni identiteti.** Javni botovi imaju trajan profil, nadimak, avatar i stvarnu statistiku odigranih partija. Administrator vidi oznaku bota; običan igrač ne. Botovi se ne prikazuju na javnim ljestvicama. Bot identitet ne može dobiti sesiju, lozinku, reset ni preuzimanje. Početni fond: 40 aktivnih, tvrdi maksimum 100.
5. **Zagrijavanje.** Novi način „Igraj dvoboj protiv računala” za goste i registrirane (uključujući nepotvrđen e-mail). Protivnik je privremeno „Računalo” s jednim stalnim avatarom, izvan javnog fonda. Trening ne stvara **nikakav** trajni zapis igre ni napredak: bez partije u povijesti, bez poteza, XP-a, ranga, forme, nizova, dostignuća i kolekcija. Dopušteni su samo anonimni tehnički brojači.
6. **Mjerljivost za podešavanje.** Vrijeme čekanja ljudi i broj botova po partiji bilježe se i prikazuju administratoru.
7. **Kontrolirano uključivanje.** Tri zasebne zastavice: trening, botovi u Dvoboju, botovi u Četveroboju. Na stagingu se uključuju tim redom. Isključivanje zaustavlja nove rezervacije; započete partije normalno završavaju.

## Razmotrene alternative

- **Bot kao Socket.IO klijent** — sliči stvarnom klijentu, ali uvodi sesije, mrežne kvarove i sigurnosne iznimke; odbačeno.
- **Vanjski jezični model** — ne jamči legalnu riječ, dodaje trošak i kašnjenje; odbačeno.
- **Trening preko postojećih privatnih soba** — privatna partija i dalje zapisuje povijest i statistiku; nije dovoljno za „ništa se ne bilježi”.
- **Vidljiva oznaka bota svim igračima** — iskreniji prikaz, ali vlasnik je odabrao skrivenu oznaku; rizik odbijanja ako korisnici naknadno prepoznaju automatizirane protivnike prihvaćen je svjesno.
- **Umanjeni bodovi protiv botova** — jednostavniji balans, ali u suprotnosti s odlukom „sve identično”. Učinak se prati, ne mijenja potajno.

## Posljedice

- Motor dobiva dimenziju `kontekst: javna | privatna | trening` i politiku učinaka partije; sve trajne upise i nagrade kontrolira ta politika.
- Shema dobiva `igraci.upravljac` (`covjek` | `bot`), tablicu `botovi` i `partije.broj_botova`; migracije su aditivne.
- Jedan proces ([ADR-012](012-jedan-proces-same-origin.md)) dopušta koordinaciju rezervacija u memoriji; raspodijeljeni koordinator uvodi se tek ako se arhitektura promijeni.
- Slabiji botovi mogu se iskorištavati za bodove; mjeri se udio pobjeda ljudi po sastavu stola i parametri se podešavaju kroz verzioniranu konfiguraciju.
- [opseg-mvp.md](../../01-proizvod/opseg-mvp.md), [pravila-igre.md](../../02-pravila-igre/pravila-igre.md) i [botovi.md](../../02-pravila-igre/botovi.md) ažurirani su u skladu s ovom odlukom.
