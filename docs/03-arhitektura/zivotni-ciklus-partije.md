# Životni ciklus partije

## Dijagram stanja

```mermaid
stateDiagram-v2
    [*] --> URedu : red-udji
    URedu --> URedu : mjesta se pune / prazne (real-time)
    URedu --> StolPopunjen : 4 igrača
    StolPopunjen --> SustavBiraRijec : partija:pocetak
    SustavBiraRijec --> CekanjePoteza : 5s isteklo, riječ objavljena (partija:runda-otvorena)
    CekanjePoteza --> CekanjePoteza : valjana riječ, sljedeći igrač
    CekanjePoteza --> CekaPovratak : detektiran prekid veze
    CekaPovratak --> CekanjePoteza : ista veza identiteta obnovljena unutar 10s
    CekaPovratak --> Eliminacija : tolerancija istekla
    CekanjePoteza --> Eliminacija : ne znam / istek / dobrovoljni izlazak / mrtva slova
    Eliminacija --> SustavBiraRijec : ostalo ≥ 2 igrača (sustav ponovno bira riječ)
    Eliminacija --> KrajPartije : ostao 1 igrač
    KrajPartije --> SpremanjeRezultata : igra završena, upis u bazu
    SpremanjeRezultata --> SpremanjeRezultata : prolazna greška, ponovni pokušaj
    SpremanjeRezultata --> [*] : upis potvrđen, partija:kraj
    StolPopunjen --> Ponistena : restart ili kontrolirano gašenje
    CekanjePoteza --> Ponistena : restart ili kontrolirano gašenje
    Ponistena --> [*] : zapis ponisten, obavijest igračima
```

Napomene:

- **SustavBiraRijec:** traje 10 sekundi; nitko ne može igrati. Server prvo nasumično bira iz skupa sigurnih riječi uz aktualne kategorije i potrošene grupe, a zatim po potrebi koristi rezervni odabir riječi sa slobodnim nastavkom. Isti tok vrijedi za 1. rundu partije i nakon svake eliminacije/kaladont-efekta (RS-01). Klijent prikazuje obrazloženje zadnje eliminacije (ako postoji) i brojač. 30-sekundni timer poteza kreće tek kad ovo stanje završi.
- **Mrtva slova** eliminiraju sljedećeg igrača trenutno, bez ulaska u njegovo `CekanjePoteza` (RS-02/RS-03).
- **CekaPovratak:** mrežni prekid pokreće 10-sekundnu toleranciju samo za prekinutog igrača. Timer poteza ne pauzira se; istek poteza ima prednost ako nastupi prije isteka tolerancije. Dobrovoljni izlazak ne ulazi u ovo stanje.
- Eliminirani igrač prelazi u ulogu **promatrača** istog stola do `KrajPartije`.

## Slijed poruka za tipičan potez

```mermaid
sequenceDiagram
    participant A as Igrač A (na potezu)
    participant S as Poslužitelj
    participant O as Ostali za stolom
    A->>S: potez:rijec { rijec: "kralj" }
    S->>S: validacija (rječnik, prefiks, neiskorištenost)
    S->>S: provjera nastavka za "alj"
    alt nastavak postoji
        S->>A: potez:prihvacen
        S->>O: potez:prihvacen (isti payload)
        Note over S: timer 30 s za sljedećeg igrača
    else nastavka nema
        S->>O: partija:eliminacija (sljedeći igrač, razlog mrtva_slova_*)
        S->>O: partija:sustav-bira-rijec, zatim (10s) partija:runda-otvorena, ili partija:kraj
    end
```

## Timeri

- Jedini mjerodavni timer je na poslužitelju; 30s timer poteza pokreće se u trenutku emitiranja `potez:prihvacen` / `partija:runda-otvorena` (ne dok sustav bira riječ).
- Klijent dobiva apsolutni `istekPotezaIso` pa ni kašnjenje mreže ne pomiče prikaz.
- Istek na poslužitelju okida eliminaciju čak i ako klijent šuti ili je privremeno odspojen. Ponovno spajanje ne resetira niti pomiče `istekPotezaIso`.

## Kontekst partije i politika učinaka (ADR-017)

Stol pri stvaranju dobiva `kontekst: javna | privatna | trening` i iz njega izvedenu `PolitikaUcinkaPartije` (`zapisujePovijest`, `dajeNapredak`, `dajeDostignucaIKolekcije`). Javna partija piše sve; privatna piše povijest i dostignuća, ali ne XP/bodove; trening ne piše ništa i ne emitira nagrade. Svaki upis u bazu i svaka obavijest o napretku prolazi kroz tu politiku, uključujući rani upis poraza i napredak usred igre. Trening završava bez transakcije: rezultat je odmah „spremljen” i `partija:kraj` nosi samo plasmane.

Potezi ljudi i botova prolaze iste autoritativne naredbe `odigrajRijec` / `odustani` (turnToken, red na potezu, faza izbora sustava, validacija). Socket handleri su tanki omotači koji identitet uzimaju iz sesije; `naredbaBota` prihvaća samo sudionike s `upravljac = bot`. Pokretanje partije vraća eksplicitan rezultat (`pokrenuta`, `limit`, `zaustavljanje`, `greska`), pa servis reda vraća u red samo ljude koji još čekaju, s izvornim `usaoU`.

Bot kontroler sluša `naPromjenuPoteza` i za bota na potezu planira točno jednu akciju po `(partijaId, igracId, turnToken)`. Pri buđenju ponovno provjerava token, verziju rječnika i legalnost; zakaanjeli callback ne igra u novoj rundi. Namjerni propust ide kroz redovnu naredbu „ne znam”; odbijena riječ je tehnička greška i broji se zasebno. Fond javnih botova drži rezervacije s generacijom; bot se oslobađa tek kad motor više ne drži njegovu partiju (`imaNezavrsenuObradu` = false), ne pri eliminaciji.

## Kraj partije — transakcija

Završetak igre i spremanje rezultata su dva odvojena stanja. Motor prvo zaustavlja poteze i računa konačne plasmane, ali zadržava partiju u memoriji sa statusom `spremanje_rezultata`. Dok traje prolazni problem s bazom, ponavlja isti završni upis s eksponencijalnim odmakom i igračima šalje `partija:spremanje-rezultata`.

U jednoj transakciji: upis `plasman/bodovi/eliminacije/iskustvo/nacin_ispadanja` u `sudionici_partije` → ažuriranje agregata u `igraci`, uključujući trajni XP → status partije `zavrsena`. Završni upis mora biti idempotentan za isti `partijaId`, jer pokušaj može biti ponovljen nakon prekida veze s bazom. Tek nakon potvrđene transakcije motor sprema personalizirane rezultate, emitira `partija:kraj`, zatvara privatnu sobu i zakazuje brisanje memorijskog stanja.

`partija:kraj` je potvrda da su rezultati trajno spremljeni, a ne samo da je igra završila. Oporavak vrijedi dok proces radi; otpornost na restart procesa zahtijevala bi trajni outbox.

## Restart i kontrolirano gašenje

Pri podizanju poslužitelja svi redovi `partije` sa statusom `u_tijeku` prelaze u `ponistena`. To su partije čije je memorijsko stanje izgubljeno restartom i ne smiju ponovno izgledati kao aktivne.

Pri `SIGTERM`/`SIGINT` poslužitelj prvo prestaje prihvaćati nova uparivanja i pokretanja privatnih partija, zatim aktivnim klijentima šalje `partija:ponistena`, označava njihove zapise kao `ponistena`, zaustavlja timere i tek onda zatvara Socket.IO/HTTP poslužitelj. Igrač dobiva jasnu poruku da rezultat nije dodijeljen i može se vratiti na naslovnicu.

Igrač eliminiran bez dobrovoljnog izlaska može prije toga dobiti privatni `iskustvo:obracun` za konačne poteze i streak; taj prikaz ne obavlja isplatu. Stvarni zapis XP-a ostaje dio završne transakcije, pa se ne može dodijeliti dvaput reconnectom.
