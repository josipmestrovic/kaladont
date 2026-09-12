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
    KrajPartije --> [*] : plasmani, bodovi, upis u bazu
```

Napomene:

- **SustavBiraRijec:** traje 10 sekundi; nitko ne može igrati. Server nasumično bira valjanu riječ sa slobodnim nastavkom (`nasumicnaValjanaRijec`) - i za 1. rundu partije i nakon svake eliminacije/kaladont-efekta (RS-01). Klijent prikazuje obrazloženje zadnje eliminacije (ako postoji) i brojač. 30-sekundni timer poteza kreće tek kad ovo stanje završi.
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

## Kraj partije — transakcija

U jednoj transakciji: upis `plasman/bodovi/eliminacije/nacin_ispadanja` u `sudionici_partije` → ažuriranje agregata u `igraci` → status partije `zavrsena`. Tek potom se emitira `partija:kraj`. Time podaci u bazi nikad ne zaostaju za onim što su igrači vidjeli.
