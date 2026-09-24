# Kaladont — izrada avatara iz Figma SVG izvoza

Datum: 18. rujna 2026. Dokument za implementacijskog agenta. Ovo su upute; implementacija još nije napravljena.

## 1. Cilj i potvrđene odluke

Implementiraj editor u kojem registrirani igrač sastavlja avatar od originalnih dijelova sustava Avatar Illustration System. Izgled, proporcije, geometrija, slojevi i dostupne varijante moraju odgovarati dostavljenom Figma izvoru. Korisnik će agentu dostaviti jedan SVG izvoz.

Potvrđeno s vlasnikom projekta:

- Izvor su originalni SVG dijelovi iz Figma datoteke. Ne zamjenjuj ih DiceBearom, sličnim crtežima, AI slikama ni ručno nacrtanim aproksimacijama.
- Sve površine koje izvor predviđa za promjenu boje mogu dobiti proizvoljnu boju. Izvorna paleta je ponuda, a ne ograničenje.
- Avatar dobivaš tek registracijom. Gost nema personalizirani avatar ni mogućnost njegova uređivanja u sučelju.
- Postojeća backend podrška za gostov stari numerički avatar i test koji je pokriva ostaju. Ne provodi prethodno predloženu opću zabranu na cijelom starom endpointu.
- U registracijskom wizardu postoji poseban ekran za avatar. Nema gumba Preskoči. Valjani zadani avatar je odmah odabran; korisnik može nastaviti bez promjena ili pritisnuti Nasumično.
- Profilna ikona za uređivanje otvara isti editor, s istom logikom i istim komponentama.
- Promjene se javno primjenjuju tek nakon uspješnog spremanja. Nakon spremanja vide se odmah, bez ručnog ili automatskog reloada cijele stranice.
- Nije potrebno očuvati stare avatare. Ovo nije dopuštenje za brisanje korisničkih računa, statistika, povijesti, sesija ili drugih podataka.
- Kombinacije ne moraju biti jedinstvene među igračima. Nema provjere globalne jedinstvenosti.
- U O igri dodati zasluge, izvor i licencu.
- Izvor za atribuciju: https://www.figma.com/community/file/829741575478342595/avatar-illustration-system

## 2. Što je provjereno, a što još treba provjeriti

Repo je u prethodnom pregledu pročitan na main commitu `29dfd877d60edb471eb183f9295af26f6397b455`. Prije izmjena provjeri aktualni HEAD, lokalne upute i stvarne putanje. Nemoj pretpostaviti da se kod od tada nije promijenio.

Figma kopija je sada izravno pregledana:

- Datoteka: `qMJBK2RIWpbBSgnseq2Uw0`.
- Stranica Library: `0:1`.
- Frame s katalogom Library: `48:39`, 3659 × 7848 px.
- Sastavljeni referentni Avatar: `65:1440`, 380 × 380 px.
- Pročitana je struktura cijele stranice te kontekst i slika sastavljenog avatara.
- Nije pregledan budući korisnikov SVG izvoz. Nije još dovršeno mapiranje svih pojedinačnih fill/stroke površina, maski i položaja svih dodataka.

Ne predstavljaj raniji DiceBear katalog kao katalog ove Figma datoteke. U ovoj datoteci potvrđene su ČETIRI varijante očiju. DiceBearov pregled imao je pet.

### Potvrđeni inventar — 40 komponenti

| Kategorija | Nazivi u Figmi | Broj |
| --- | --- | ---: |
| Baza | Base/1 | 1 |
| Uši | Ear/Attached, Ear/Detached | 2 |
| Naušnice | Ear Ring/Hoop, Ear Ring/Stud | 2 |
| Usta | Mouth/Surprised, Laughing, Smile, Smirk, Sad, Frown, Pucker, Nervous | 8 |
| Kosa / pokrivalo | Hair/Fonze, Mr T, Doug Funny, Mr Clean, Danny Phantom, Full, Turban, Pixie | 8 |
| Oči | Eyes/Eyes, Smiling, Eyeshadow, Round | 4 |
| Obrve | Eyebrows/Up, Down, Eyelashes Up, Eyelashes Down | 4 |
| Nos | Nose/Curve, Pointed, Round | 3 |
| Naočale | Glasses/Round, Square | 2 |
| Brada | Facial Hair/Beard, Scruff | 2 |
| Majica | Shirt/Open, Crew, Collared | 3 |
| Pozadina | Background | 1 |
| Ukupno | Komponente izvora, bez dodatnih UI opcija Bez | 40 |

Katalog sadrži i naslove, uzorke boja te tri skrivena pomoćna objekta. Nemoj ih automatski pretvoriti u opcije avatara. Provjeri skrivene objekte i njihove ovisnosti prije isključivanja. Izvorne uzorke boja iskoristi kao početnu paletu.

Referentni sastavljeni avatar koristi Base/1, Mouth/Laughing, Eyebrows/Up, Hair/Mr T, Eyes/Smiling, Nose/Round, Ear/Attached i Shirt/Collared. U tom primjeru nisu prikazani naočale, naušnice ni brada. Njihove pozicije zato nemoj izmišljati ako se ne mogu pouzdano izvesti iz strukture izvora.

## 3. Priprema jednog SVG izvoza

Jedan SVG može biti ulazni paket, ali mora sadržavati SVE dijelove. Izvoz samo jednog sastavljenog lika sadrži samo njegove odabrane varijante i nije dovoljan za editor.

Za korisnika koji radi izvoz:

1. U kopiji Figma datoteke obuhvati cijeli Library frame i sastavljeni Avatar u jednom zajedničkom frameu ili grupi za izvoz. Sačuvaj njihove unutarnje grupe i nazive.
2. Export format postavi na SVG. U dodatnim opcijama uključi Include “id” attribute.
3. Nemoj prije izvoza pretvarati cijelu kolekciju u jednu sliku, flattenati sve oblike u jedan path ni brisati grupe optimizacijom.
4. Sačuvaj maske, clipping, opacity, transformacije i odnose slojeva. Izvoz treba biti vektorski.
5. Otvori dobiveni SVG i potvrdi da su u njemu svi prikazani dijelovi i sastavljeni primjer. Sačuvaj i Figma poveznicu kao referencu.

Nazivi/ID-jevi olakšavaju izdvajanje, ali SVG ne čuva sve Figma informacije o komponentama, stilovima i mogućim zamjenama. Ako izvoz izgubi važnu informaciju, agent treba zatražiti ciljani dopunski izvoz ili referencu te nastaviti ostali posao. Ne smije tvrditi da je podudaranje potpuno ako mora nagađati položaj ili bojenje.

Figma dokumentacija o izvozu: https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings-for-static-designs

## 4. Izdvajanje i priprema asseta

Najprije sačuvaj originalni SVG neizmijenjen u repozitoriju na primjerenoj putanji za izvore dizajna. Veliki izvorni katalog ne smije se učitavati kao produkcijski asset pri svakom otvaranju igre.

Napravi ponovljiv postupak izdvajanja, primjerice skriptu u `skripte/avatari/`. Parsiraj XML/SVG strukturno. Nemoj izdvajati pathove ili mijenjati boje običnim globalnim regex zamjenama.

Za svaki asset:

- Sačuvaj izvorni naziv i stabilni interni ID u manifestu.
- Izvezi zaseban SVG s lokalnim koordinatama; ne ostavljaj koordinatu njegove pozicije na velikoj Library ploči kao koordinatu u avataru.
- Prenesi potrebne definicije iz `defs`, maske, clipPathove, gradijente i reference iz `use`/`href`.
- Sačuvaj relevantne parent transformacije, stroke širine, opacity, fill-rule, clip-rule i blend ponašanje.
- Ne reži oblike prema uskom bounding boxu ako stroke, kosa ili drugi dio izlazi iz njega. Ne uvodi nenamjerni clipping.
- Sačuvaj međusobni redoslijed unutarnjih slojeva i ponašanje poluprozirnih sjena.
- Ukloni skripte, event handlere, vanjske reference i nepotrebne metapodatke pri pripremi pouzdanih produkcijskih asseta. To ne smije ukloniti vizualno potrebne SVG elemente.
- Optimiziraj tek nakon provjere izgleda. Smanjenje veličine ne smije promijeniti oblik ili zaokružiti koordinate toliko da je razlika vidljiva.

Manifest treba opisivati najmanje: ID, izvorni naziv, kategoriju, izvorni node ako je poznat, datoteku, dimenzije/viewBox, transformaciju u avataru, redoslijed slojeva, opcionalnost, podržane uloge boja, zadane boje i posebne kompatibilnosti.

Nemoj pretpostaviti jedan univerzalni z-index po kategoriji ako izvor zahtijeva dio kose iza glave i dio ispred nje. U tom slučaju manifest neka opiše više render slojeva istog odabira, a korisniku i dalje pokaži jednu frizuru.

Napravi preglednu kontaktnu tablicu izdvojenih dijelova. Usporedi je s inventarom od 40 komponenti. Postojeći ponovljeni primjerci istih komponenti u sastavljenom avataru nisu dodatne varijante.

## 5. Geometrija i zajednički renderer

Koristi referentni koordinatni sustav 380 × 380 iz stvarnog Avatar framea, odnosno njegov točan ekvivalent nakon dokumentirane normalizacije. Zadrži kružni prikaz.

Ne kopiraj koordinate komponenti na Library ploči. Izračunaj transformacije u zajednički koordinatni sustav avatara iz referentnog sastavljenog primjera i strukture komponenti. Sačuvaj rotaciju nosa i ostale transformacije; nemoj svaki dio zasebno centrirati jer to mijenja lice.

Osiguraj jedan renderer koji koriste:

- veliki preview u editoru;
- thumbnails varijanti;
- header;
- vlastiti i javni profil;
- red čekanja za 2 i 4 igrača;
- privatna soba;
- aktivna partija i završni sažetak gdje se avatar već prikazuje;
- svaki drugi postojeći prikaz avatara pronađen pretragom repozitorija.

Ne dodaj nove avatare na ekrane koji ih nemaju samo zato što je renderer dostupan.

Preporuka: iz sigurnih lokalnih asseta i validirane konfiguracije sastavi SVG te ga prikaži kao sliku kroz lokalni data URL. To izolira ID-jeve maski između više avatara. Ako koristiš inline SVG, svi ID-jevi i reference moraju biti jedinstveni za svaku instancu, uključujući thumbnails i SSR/hydration. Nemoj unositi korisnički HTML kroz `@html`.

Boje postavi unutar sastavljenog SVG-a. CSS na vanjskom `<img>` elementu ne može izravno mijenjati fillove unutar odvojene SVG slike.

Prikaz mora biti determinističan: ista konfiguracija i ista verzija asseta daju isti izgled. Renderer ne smije randomizirati pri mountanju ili nakon navigacije. Zadrži postojeći rang-border kao zaseban automatski okvir izvan artworka.

Nemoj parsirati veliki izvorni katalog pri svakom renderu. Pripremu napravi u build/izvoz fazi. Eventualni cache generiranih SVG-ova mora biti ograničen i ključan po konfiguraciji + verziji asseta; ne stvaraj neograničeni globalni cache.

## 6. Bojenje

Napravi inventar površina koje se u originalu mogu bojati. Semantičke uloge mogu biti koža, kosa, majica, naočale, naušnice, brada, obrve, oči, sjenilo, usta, jezik ili drugi detalj — konačan popis izvedi iz stvarnog izvora, ne iz pretpostavke.

- Svaka podržana uloga ima vlastiti kontrolirani fill/stroke ili skup povezanih površina.
- Omogući paletu i unos proizvoljnog HEX-a kroz color picker. Početni format: neprozirni `#RRGGBB`.
- Ne ograničavaj korisnika na realistične boje kože/kose ili Kaladont paletu.
- Nemoj sve crne pathove pretvoriti u jednu boju: ista početna crna može predstavljati konturu, kosu, oko ili usta.
- Površine koje izvor tretira kao jednu ulogu, primjerice kožu lica/uha/vrata, mijenjaju se dosljedno. Ne uvodi odvojene kontrole za svaki path bez stvarne potrebe.
- Sačuvaj sjene, njihove opacity vrijednosti i način stapanja. Ako je sjena vezana uz osnovnu boju, prenesi tu vezu; nemoj proizvoljno izmisliti novu formulu sjenčanja.
- Pri promjeni varijante zadrži odabrane boje za uloge koje ta varijanta koristi. Za novu ulogu koristi dokumentirani default.
- Kontrole boje prikazuj prema odabranom dijelu; skriven dodatak ne treba pokazivati neaktivne kontrole kao da nešto mijenjaju.
- Fiksne strukturalne konture ostaju fiksne samo ako izvor ne predviđa njihovu promjenu. Ne zaključavaj ih unaprijed ako su u izvoru predviđene za bojenje.

Važno: običan SVG sam po sebi ne govori koja je površina zamišljena kao korisnička opcija. Mapiranje uloga provjeri prema Figmi ili potvrdi s korisnikom ako je nejasno. Ne obećavaj sve moguće kontrole na temelju samog broja različitih HEX vrijednosti.

## 7. UX editora

Predloženi naslovi su Stvori avatar i Uredi avatar. Koristi postojeće fontove, boje sučelja, gumbe, razmake i stil Kaladonta. Ne uvodi React, Tailwind ni drugi UI sustav.

Organiziraj kontrole u Lice, Kosa, Odjeća, Dodaci i Pozadina ili usporediv broj jasnih kategorija. Dijelove biraš vizualnim thumbnailsima. UI nazivi su hrvatski; stabilni interni ID-jevi ne ovise o prijevodu.

Veliki preview stalno pokazuje trenutačni draft. Na mobitelu preview i donja akcija trebaju ostati dostupni bez zauzimanja cijelog ekrana; na maloj visini ili otvorenoj tipkovnici ne smiju prekriti kontrole. Thumbnails i kontrole moraju biti pristupačni tipkovnicom, imati labelu i vidljivo selected stanje koje ne ovisi samo o boji.

Naočale, naušnice i brada imaju opciju Bez. Za kosu već postoji Mr Clean; ne stvaraj dodatnu vizualnu varijantu bez potrebe. Baza i pozadina imaju po jednu geometriju pa za njih ne treba lažni grid s jednim izborom.

Akcije:

- Nasumično: generira potpunu valjanu konfiguraciju i mijenja samo draft. Ne sprema i ne šalje socket događaj.
- Registracija: Natrag i Registriraj se, odnosno odgovarajući završni CTA. Nema Preskoči; default je valjan odmah.
- Profil: Odustani i Spremi. Spremi je onemogućen bez izmjena ili tijekom zahtjeva.
- Tijekom spremanja pokaži Spremanje… i spriječi dvostruki submit.
- Nakon uspjeha vrati korisnika na odredište i kratko potvrdi spremanje.
- Kod greške ostani u editoru, sačuvaj draft i pokaži razumljivu mogućnost ponovnog pokušaja.

Randomizacija: predloženo je birati iz postojećih dijelova i izvorne/kurirane palete radi čitljivih kombinacija, dok ručni picker ostaje potpuno slobodan. Sve opcionalne kategorije uključuju mogućnost Bez. Distribuciju odabira dokumentiraj; ne obećavaj jedinstven rezultat ili potpuno različit rezultat na baš svaki klik. Otvoren je proizvodni izbor želi li korisnik i potpuno nasumični RGB.

Za profilno uređivanje napravi zaštitu izlaska samo kad postoji izmijenjen draft. Ne prikazuj upozorenje nakon uspješnog spremanja ili eksplicitnog Odustani. Refresh prije Save nije spremanje; u prvom opsegu draft ne mora preživjeti refresh.

## 8. Registracijski wizard i pravilo gostiju

Preporučeni osnovni tok radi najmanje složenosti:

1. Nadimak.
2. Email i lozinka.
3. Poseban ekran izrade avatara s već valjanim defaultom i gumbom Nasumično.
4. Završni POST registracije šalje podatke računa i avatar konfiguraciju zajedno.
5. Tek nakon uspješne registracije avatar postaje spremljen identitet registriranog igrača.

Editor je zajednička komponenta. Treći korak je zaseban ekran unutar registracijskog wizarda, ali ne mora biti zaseban URL. Za postojeće račune ista komponenta živi na `/profil/avatar`. Ovo izbjegava prenošenje lozinke između ruta i dupliciranje editora. Ako vlasnik želi doslovno isti URL i tijekom registracije, najprije dogovori je li račun već kreiran i kako se pamti nedovršen onboarding; nemoj to prešutno dodati.

Podaci registracije ostaju samo u memoriji. Ne spremaj lozinku u localStorage, sessionStorage, URL ili analitiku. Natrag između koraka čuva draft u memoriji.

Pregled avatara tijekom registracije jest privremeni editor preview. Nije gostov javni avatar. Do uspješnog završnog POST-a ne mijenjaj gostov profil, sobu, socket identitet ili avatar u bazi.

Sačuvaj postojeći prijelaz gost → registrirani račun i njegove statistike. Konfiguraciju validiraj prije upisa/promjene vrste računa. Ako registracija ne uspije, ne smije ostati djelomično promijenjen gostov avatar.

Nakon registracije token/promjenu identiteta obradi postojećim auth tokom. Ako taj tok treba reconnect zato što se promijenio auth token, to je odvojeno od običnog uređivanja avatara. Za samo spremanje izgleda postojećeg računa reconnect nije potreban.

Gostima u svim prikazima proslijedi eksplicitni `jeGost` ili `vrsta` iz servera. Nemoj zaključivati gost status iz ranga, nedostatka konfiguracije, nadimka ili javno slanog emaila. Registrirani početnik bez ranga i dalje ima avatar. Za goste koristi postojeći neutralni Gost prikaz; ne prikazuj generirani ili stari personalizirani portret. Ukloni olovku za uređivanje uz gostov avatar; link prema registraciji može ostati drugdje u profilu.

## 9. Model podataka i API kompatibilnost

Zadrži postojeći `avatar_id` i njegov numerički API ugovor radi izričito tražene kompatibilnosti s backendom i gostovim testom. Dodaj nullable `avatar_config` JSONB i `avatar_revision` integer s defaultom 0 ili ekvivalentna polja prema konvencijama projekta.

Predloženi sadržaj konfiguracije:

```ts
type AvatarConfigV1 = {
  schemaVersion: 1;
  assetVersion: 'micah-figma-v1';
  parts: {
    base: string;
    ears: string;
    mouth: string;
    hair: string;
    eyes: string;
    eyebrows: string;
    nose: string;
    shirt: string;
    glasses: string | null;
    earrings: string | null;
    facialHair: string | null;
    background: string;
  };
  colors: Record<string, string>;
};
```

Ovo je ilustrativni oblik. U produkciji ID-jevi dijelova moraju biti ograničeni na manifest, a ključevi `colors` na potvrđene uloge. Nemoj prihvatiti proizvoljni `Record` kao sigurnosnu validaciju. `assetVersion` označava točno ovaj izvor i geometriju; nije oznaka DiceBear biblioteke.

U zajedničkom paketu definiraj tipove, default, manifest metapodatke i validaciju bez nepotrebnog uvoza svih SVG stringova u server. SVG asseti pripadaju web/build sloju.

Backend API izvana ima `/api` prefiks. Postojeći frontend helper ga dodaje, pa pozivaj `api('/profil/avatar', ...)`, a ne `api('/api/profil/avatar', ...)`.

### PUT /api/profil/avatar

Zadrži stari payload `{ avatarId: number }`, postojeću validaciju raspona i postojeću dozvolu gostima. Test koji potvrđuje gostov odabir ostaje valjan.

Dodaj novu granu `{ avatarConfig: AvatarConfigV1 }`:

- Samo valjana sesija registriranog/admin računa smije spremiti custom konfiguraciju. Gostov pokušaj ove nove grane odbija se.
- Ne postavljaj `zahtijevajPrijavu` preko cijelog endpointa jer bi time slomio traženu staru granu. Zadrži identifikaciju na ulazu, a jaču provjeru provedi u custom grani ili zajedničkom servisu.
- Ne dopuštaj da korisnik payloadom odabere tuđi igracId ili vrstu računa.
- Tijelo s oba oblika, nepoznatom verzijom, nepostojećim assetom, nevaljanom bojom ili prevelikim sadržajem mora biti odbijeno bez djelomičnog upisa.
- Validiraj isključivo poznate part ID-jeve, dopuštene ključeve boja i normalizirani HEX. Bez URL-ova, CSS izraza, raw SVG-a ili HTML-a.
- Vrati kanonski spremljeni avatar i revision. Klijent ne smije zaključiti uspjeh samo iz lokalnog drafta.

Stara numerička promjena može nastaviti ažurirati `avatar_id`, ali ne smije implicitno obrisati spremljeni custom avatar. Registrirani prikaz daje prednost custom konfiguraciji, a zatim novom defaultu. Gostov prikaz uvijek ostaje neutralan bez obzira na stari avatar_id.

Registracijski endpoint proširi konfiguracijom, uz očuvanje postojeće kompatibilnosti gdje je potrebna. Novi web wizard uvijek šalje valjanu konfiguraciju; eventualni stari klijent bez nje dobiva serverom zadani novi default. Ne uvodi uvjet potvrđenog emaila za avatar ako ga postojeći proizvod ne traži.

## 10. Postojeći računi i stare slike

Nema potrebe za očuvanjem izgleda starih avatara. Svaki postojeći registrirani račun bez custom konfiguracije prikazuje novi zajednički default. Time nije potrebna složena migracija devet starih slika u nove likove.

Možeš napraviti uski backfill konfiguracije registriranima ili koristiti deterministični default u serializeru. Preferiraj jednostavniji pristup koji radi jednako u profilu, socket payloadima i editoru. Nemoj generirati novi slučajni default pri svakom čitanju.

Gostima se custom konfiguracija ne dodjeljuje. Njihov stari avatar_id ostaje samo kompatibilni podatak. Pri naknadnoj registraciji primjenjuje se konfiguracija potvrđena u wizardu.

Stare statičke slike mogu biti uklonjene kad se potvrdi da nema njihovih potrošača. Nemoj zbog toga ukloniti numerički API raspon ili postojeći gostov test. Ne briši račune, statistike ni stare migracije.

Kod brisanja računa očisti avatar_config i omogući neutralni prikaz Obrisani igrač prema postojećem ponašanju aplikacije. Ne dopusti da default za registrirane ponovno personalizira obrisanog igrača.

## 11. Spremanje bez reloada i reconnecta

U trenutno pregledanom kodu PostavkeProfila nakon PUT-a poziva `osvjeziSocketIdentitet()`. Ta funkcija disconnecta vezu. Disconnect uklanja igrača iz javnog reda i pokreće izlazak iz privatne sobe. Ne koristi taj postupak za novu custom promjenu izgleda.

Implementiraj slijed:

1. Editor drži odvojeni draft i snapshot zadnjeg spremljenog avatara.
2. Spremi šalje jedan HTTP zahtjev. Promjene pojedinih boja/slajdera ne šalju zahtjeve.
3. Server validira i atomarno sprema config + povećanu revision vrijednost.
4. Nakon uspješnog upisa server usklađuje postojeće in-memory kopije izgleda.
5. HTTP odgovor vraća kanonsku konfiguraciju. Klijent njome ažurira zajedničko reaktivno stanje.
6. Header i profil koriste to stanje ili isti centralni sloj za avatar po igracId i odmah se osvježavaju.
7. Server šalje mali događaj promjene izgleda relevantnim povezanim klijentima. Ne emitira cijelu bazu ni cijeli SVG.

Primjer novog server → client događaja: `igrac:avatar-promijenjen` s `{ igracId, avatarConfig, avatarRevision }`. Konačan naziv prilagodi konvencijama projekta.

Promjena mora zahvatiti socket.data, već postojeću stavku reda, članstvo privatne sobe, sudionika aktivne partije i payload budućeg reconnecta. Server trenutno čuva kopije na više mjesta. Ako ažuriraš samo DB i header, avatar će se pri sljedećem stanju partije vratiti na staru vrijednost.

U relevantne servise dodaj usku funkciju za promjenu izgleda, bez ponovnog ulaska/izlaska igrača. Aktivna partija mijenja samo vizualne metapodatke: ne resetira timer, potez, runda state, bodove, spremnost, sjedalo ili članstvo. HTTP spremanje mora raditi i ako korisnik trenutačno nema aktivan socket.

Revision uspoređuj na klijentu i u asinkronim in-memory ažuriranjima: stariji event/response ne smije pregaziti noviji avatar. Povećanje revision mora biti atomsko u bazi. Za paralelne editore početna politika je zadnje uspješno spremljeno stanje pobjeđuje; to nije zaštita od svih sukoba, nego namjerno jednostavan proizvodni izbor.

Nakon prekida veze ili novog otvaranja stranice učitaj kanonsko stanje iz servera. Ne oslanjaj se samo na prolazni DOM event. Ne uvodi Redis, globalni pub/sub ili promjenu pravila jedne aktivne veze radi ove značajke.

Ako spremanje uspije, a naknadna socket obavijest ne stigne, to nije razlog da UI lažno prijavi da DB spremanje nije uspjelo. Odvoji potvrđeni rezultat HTTP upisa od eventualnog osvježavanja drugih klijenata; ponovno dohvaćanje/reconnect popravlja propuštene obavijesti.

Kod izmjene postojećeg queue fingerprinta provjeri da promjena avatara ne pušta zvuk kao da je ušao novi igrač. Identitet ulaska treba vezati uz igracId, ne uz promjenjivi avatar.

## 12. Datoteke i integracijske točke

Ovo je karta prethodno pregledanog koda, ne zamjena za aktualnu pretragu. Pretraži `avatarId`, `avatar_id`, `AVATARI`, `BROJ_AVATARA`, `<Avatar`, `gost=`, `kaladont:avatar-promijenjen`, `osvjeziSocketIdentitet` i sve tipove koji serijaliziraju igrače. Pregledaj i `AGENTS.md` ako postoji.

| Područje | Poznate putanje / posao |
| --- | --- |
| Prikaz avatara | `aplikacije/web/src/lib/komponente/Avatar.svelte`; zadržati rang-border, dodati custom renderer i eksplicitnog gosta |
| Stari katalog | `aplikacije/web/src/lib/avatari.ts`; odvojiti eventualne rang funkcije od starog kataloga slika |
| Novi editor | nova zajednička komponenta i `aplikacije/web/src/routes/profil/avatar/+page.svelte` |
| Registracija | `aplikacije/web/src/routes/registracija/+page.svelte`; izdvojeni korak, default, draft i završni payload |
| Profil / header | `routes/profil/+page.svelte`, `lib/komponente/Header.svelte`; isti saved state, nova poveznica za edit, bez gostove olovke |
| Postavke | `lib/komponente/PostavkeProfila.svelte`; zamijeniti stari grid poveznicom u editor, bez promjena email/lozinka logike |
| Stare ulazne rute | `routes/postavke/+page.ts`, `routes/postavke/+page.svelte`, `routes/dobrodoslica/+page.svelte`; ukloniti aktivni stari avatar picker, sačuvati smislen redirect |
| Javni profil | `routes/profil/javni/[igracId]/+page.svelte`; koristiti javni avatar DTO, bez privatnih podataka |
| Red / soba / partija | `routes/red/+page.svelte`, `routes/soba/[kod]/+page.svelte`, `routes/partija/[id]/+page.svelte` |
| Stanje igre / socket | `lib/stanje-igre.svelte.ts`, `lib/socket.ts`; registracija i cleanup listenera, usklađivanje prikaza bez reconnecta |
| URL helper | `lib/api.ts`, `lib/api-url.ts`; sačuvati jedinstveno dodavanje /api |
| Baza | `aplikacije/posluzitelj/src/baza/shema.ts`, nova Drizzle migracija i pripadni metapodaci |
| Profilni API | `aplikacije/posluzitelj/src/profil/rute.ts`; privatni/javni DTO, backward-compatible PUT grane |
| Registracija | `aplikacije/posluzitelj/src/racuni/rute.ts`; validacija i spremanje konfiguracije pri stvaranju/pretvorbi računa |
| Autentikacija / identitet | `racuni/autentikacija.ts`, `identitet/identitet.ts`, `server.ts`; vrsta, config, revision i callback na promjenu |
| Red na serveru | `red/red-cekanja.ts`, `red/servis-reda.ts`; proširiti tip i ažurirati već postojeće stavke |
| Privatne sobe | `soba/servis-soba.ts`; članovi, emit stanja, prijelaz u partiju |
| Motor partije | `igra/motor-partije.ts`; sudionici, početno stanje, reconnect i promjene vizualnog identiteta |
| Protokol | `paketi/zajednicko/src/protokol.ts`, exporti i nova avatar shema/manifest; guest flag, konfiguracija i revision na potrebnim payloadima |
| Brisanje računa | `racuni/brisanje.ts`; ukloniti personalizirani avatar obrisanog igrača |
| Pomoć / zasluge | `routes/o-igri/+page.svelte`, `routes/o-igri/+page.ts`, `routes/pomoc/+page.svelte`, postojeće poveznice/podnožje |
| Licenca / dokumentacija | `LICENCA.md`, dokument o assetima, model podataka, protokol, UX tokovi prema potrebi |
| Testovi | `aplikacije/posluzitelj/test/profil.test.ts`, `racuni.test.ts`, odgovarajući socket testovi i `e2e` |

Ljestvica u pregledanoj verziji ne prikazuje avatar. Provjeri je li se to promijenilo; ne dodaj ga kao novu funkcionalnost bez potrebe. Pregledaj prikaze povijesti i završetka partije za eventualne dodatne potrošače.

## 13. O igri, zasluge i licenca

Autor originala: Micah Lanier. Original: Avatar Illustration System. Službena DiceBear stranica identificira taj izvor kao CC BY 4.0; pri preuzimanju izvornog izvoza sačuvaj i eventualne napomene o autorstvu/licenci iz same Community datoteke.

Na stvarno dostupnu stranicu O igri dodaj sekciju Zasluge i licence. U pregledanom repozitoriju `/o-igri/+page.ts` preusmjerava na `/pomoc?tema=pravila`, pa samo dodavanje HTML-a u preusmjeravanu stranicu nije dovoljno. Preporuka je vratiti funkcionalan `/o-igri` s postojećim sadržajem i zaslugama te dostupnom poveznicom. Nemoj izgubiti postojeću pomoć ili atribuciju hrLexa.

Predloženi tekst nakon implementacije:

> Avatari koriste Avatar Illustration System autora Micaha Laniera, dostupan pod licencom Creative Commons Attribution 4.0 International (CC BY 4.0). Za Kaladont sustav je prilagođen razdvajanjem SVG dijelova, povezivanjem slojeva i omogućavanjem promjene boja.

Poveži naziv djela na https://www.figma.com/community/file/829741575478342595/avatar-illustration-system i naziv licence na https://creativecommons.org/licenses/by/4.0/ . Opis izmjena prilagodi onome što je stvarno napravljeno. Sačuvaj postojeće obavijesti o autorstvu, licenci i prethodnim izmjenama ako ih izvor sadrži; ne sugeriraj da autor podržava Kaladont.

U repozitorij dodaj obavijest uz assete s autorom, izvorom, licencom i izmjenama. U `LICENCA.md` izričito izdvoji ove third-party assete iz opće odredbe sva prava pridržana. Licenca avatara ne mijenja automatski licencu ostatka vlastitog koda. Ne nameći dodatna ograničenja na materijal koja bi poništila dopuštenja CC BY 4.0.

Ovaj opseg koristi izravni Figma izvoz. DiceBear se ne ugrađuje pa mu nemoj pripisati implementaciju niti dodavati njegovu MIT licencu kao da se koristi njegov kod. Licenciraj samo stvarno uključene ovisnosti.

## 14. Provjera i kriteriji prihvata

### Vizualna vjernost

- Inventar sadrži svih 40 komponenti iz potvrđenog izvora, bez izmišljenih varijanti.
- Zadani lik odgovara referentnom Avatar frameu na 380 × 380: isti dijelovi, boje, geometrija, maske, redoslijed i kružni izrez.
- Renderiraj referencu i implementaciju na istoj veličini; napravi overlay/diff. Sitne razlike rasterizacije mogu postojati, ali pomaknuti nos, rastegnuta kosa, nestala sjena ili drugačiji clipping nisu prihvatljivi.
- Provjeri svaku varijantu na barem jednom sastavljenom liku; posebno bradu preko usta, naočale preko očiju, naušnice uz obje uši, velike frizure, turban i rub majice.
- Prikaži više različitih avatara istodobno; nema kolizija SVG maski/ID-jeva ni prelijevanja boja između instanci.
- Provjeri male avatare u headeru i partiji, veći profil te mobile/desktop editor.
- Ne testiraj iscrpno milijune kombinacija. Pokrij svaku varijantu, svaku ulogu boje i rizična preklapanja.

### API i podaci

- Postojeći test gostovog numeričkog odabira i numeričkog raspona i dalje prolazi.
- Gost ne može spremiti novu custom konfiguraciju. Registrirani i admin mogu spremiti samo svoj avatar.
- Nevaljani dijelovi, boje, verzije i miješani payloadi odbijaju se bez djelomičnog upisa.
- Registracija iz gosta čuva statistike i sprema odabrani avatar tek nakon uspješnog završetka.
- Registracija bez ručne izmjene defaulta radi; Nasumično proizvodi konfiguraciju koju server prihvaća.
- Postojeći registrirani račun bez konfiguracije dobiva isti novi default u svim prikazima.
- Običan refresh/relogin/drugi uređaj prikazuje zadnji spremljeni avatar.
- Brisanje računa uklanja njegov personalizirani prikaz.

### UX i sinkronizacija

- Nema Preskoči u avatar koraku. Default omogućuje nastavak bez obveznog klikanja po dijelovima.
- Registracijski i profilni editor koriste isti kod.
- Preview reagira odmah; header i drugi igrači ne vide nespremljeni draft.
- Save ažurira header, profil i relevantne otvorene prikaze bez reloadanja i reconnecta.
- Otvoreni peer u privatnoj sobi vidi novu verziju; sljedeći snapshot ne vraća stari avatar.
- Serverovo usklađivanje avatara ne izbacuje iz reda/sobe niti utječe na partiju. Ako UI zabranjuje uređivanje tijekom igre, ovaj integritet i dalje provjeri backend testom.
- Stari event ne prepisuje noviju revision vrijednost.
- Greška spremanja čuva draft; dupli klik ne šalje više paralelnih zahtjeva.
- Odustani ne zapisuje promjene; povratak nakon spremanja prikazuje spremljeni avatar.
- Registrirani igrač bez ranga nije prikazan kao gost. Gost nema personalizirani avatar ni u redu, ni sobi, ni partiji.
- Promjena avatara ne pušta zvuk ulaska u red i ne registrira novog sudionika.

### Isporuka

Pokreni relevantne postojeće provjere, typecheck/build i ciljane testove prema uputama repozitorija. Dodaj testove za nove ugovore i stvarne rizike iznad; ne piši test koji samo provjerava doslovno kopirani implementacijski detalj.

Na kraju dostavi popis promjena, migraciju, inventar asseta i uloga boja, rezultate stvarno pokrenutih provjera, vizualne usporedbe i sve preostale razlike. Ne tvrdi da je testirano nešto što nije pokrenuto. Ne objavljuj na produkciju niti resetiraj podatke radi ove implementacije. Slijedi postojeći dogovor rada s granama i deployem; prije pushanja uzmi u obzir postojeći automatski deploy.

## 15. Predloženi redoslijed rada

1. Pročitaj repo upute i aktualni kod; potvrdi potrošače avatar podataka i staru kompatibilnu granu.
2. Pregledaj dostavljeni SVG, inventar i referentni lik. Prijavi samo konkretne nedostatke izvora.
3. Izdvoji assete i manifest. Dovrši mapiranje boja i transformacija.
4. Napravi renderer i vizualno ga usporedi s Figmom prije gradnje ostatka UI-ja.
5. Dodaj zajedničku konfiguraciju, validaciju, migraciju i API grane.
6. Napravi zajednički editor, wizard i profilnu rutu.
7. Uskladi guest prikaz, sve HTTP/socket DTO-ove i in-memory kopije, bez reconnecta pri Save.
8. Dodaj O igri, atribuciju i repozitorijske licence.
9. Izvedi ciljane provjere i pripremi izvještaj za review.

## 16. Otvorene odluke za vlasnika i početne preporuke

Potvrđene odluke iz odjeljka 1 ne otvaraj ponovno. Sljedeće nisu još izričito dogovorene; preporuke daju početni opseg bez zastoja na sitnim izborima.

| Pitanje | Preporučeni početni izbor | Posljedica |
| --- | --- | --- |
| Kreira li se račun prije ili nakon avatar ekrana? | Nakon potvrde avatara, u završnom POST-u | Nema djelomično dovršenog računa ni guest zapisa avatara; jedan dodatni wizard korak |
| Mora li wizard koristiti doslovno isti URL kao profilni editor? | Ne; isti editor kao posebni wizard ekran, profil na /profil/avatar | Manje složeno rukovanje registracijskim podacima |
| Koji je zadani lik? | Točan sastavljeni Avatar iz Figma datoteke | Imamo provjerljivu vizualnu referencu |
| Randomizira li Nasumično i boje? | Da, dijelove i boje iz kurirane/izvorne palete; manual picker slobodan | Dobri početni rezultati bez ograničavanja ručnog izbora |
| Smije li se uređivati dok si u redu ili aktivnoj partiji? | U UI-ju izvan reda/aktivne partije; u privatnom lobbyju može | Manje ometanja igre; server i dalje ne smije prekinuti članstvo pri Save |
| Trebaju li transparentnost, gradijenti ili posebne boje kontura? | HEX bez alpha za potvrđene bojne uloge; izvorne maske/sjene ostaju | Proizvoljan ton boje podržan, bez novog naprednog grafičkog editora |
| Trebaju li Undo/Redo i zaključavanje dijelova pri randomizaciji? | Ne u prvom izdanju; Odustani vraća spremljeni avatar | Manji opseg; može se naknadno dodati Vrati prethodno za Randomize |
| Trebaju li više spremljenih avatara ili download PNG/SVG? | Jedan aktivni avatar, bez izvoza | Nema dodatne galerije, upload/download toka ni novih korisničkih licenci pri izvozu |
| Treba li vraćanje nespremljenog drafta nakon refresha? | Ne; unutar wizarda i obične interakcije ostaje u memoriji | Jednostavnije stanje, bez spremanja osjetljivih registracijskih podataka |
| Gdje točno živi O igri? | Stvarna ruta /o-igri, zasluge u njoj, vidljiva poveznica | Ispunjava zahtjev i uklanja problem postojećeg redirecta |

Ne dodavati upload vlastitih fotografija, plaćene dodatke, otključavanje po rangu, animirane avatare, novu valutu, globalnu jedinstvenost kombinacija ili javnu galeriju kao dio ovog zadatka.

## 17. Izvori

- [Originalni Community sustav](https://www.figma.com/community/file/829741575478342595/avatar-illustration-system)
- [Pregledana Figma kopija — Library](https://www.figma.com/design/qMJBK2RIWpbBSgnseq2Uw0/Avatar-Illustration-System--Community-?node-id=48-39)
- [Pregledani referentni Avatar](https://www.figma.com/design/qMJBK2RIWpbBSgnseq2Uw0/Avatar-Illustration-System--Community-?node-id=65-1440)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- [DiceBearova identifikacija izvora i licence, samo kao provjera provenijencije](https://www.dicebear.com/styles/micah/)
- [Repo na pregledanom commitu](https://github.com/josipmestrovic/kaladont/tree/29dfd877d60edb471eb183f9295af26f6397b455)
