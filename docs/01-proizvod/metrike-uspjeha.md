# Metrike uspjeha

MVP je test tržišta — bez brojki nema zaključka. Od prvog dana mjerimo **vlastite metrike** izvedene iz tablica igre. Self-hosted Umami dodaje se nakon stabilizacije javnog ranog pristupa; ne blokira lansiranje ([ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md)).

## Sjevernjača

**Broj odigranih partija po danu.** Sve ostalo je dijagnostika oko te brojke.

## Ljevak (put korisnika)

| Korak         | Metrika                                                           | Izvor                           |
| ------------- | ----------------------------------------------------------------- | ------------------------------- |
| 1. Dolazak    | Jedinstveni posjetitelji, izvori prometa                          | Umami, nakon uključivanja       |
| 2. Namjera    | Klik na IGRAJ (event `igraj-klik`)                                | Umami event, nakon uključivanja |
| 3. Strpljenje | Postotak koji dočeka stol; prosjek/medijan čekanja                | baza (`cekanje_ms`)             |
| 4. Igra       | Završene partije / započete; trajanje partije                     | baza                            |
| 5. Povratak   | Retencija D1 / D7 (gost ID omogućuje mjerenje i bez registracije) | baza (`zadnja_aktivnost`)       |
| 6. Ulog       | Registracije; postotak gostiju koji se registriraju               | baza                            |

## Zdravlje igre

| Metrika                                                                        | Zašto                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Prosječno čekanje u redu (zadnjih 100 partija)                                 | Ista brojka koju vide igrači; ključni rizik MVP-a                     |
| Distribucija načina ispadanja (`ne_znam` / `istek` / `mrtva_slova` / `prekid`) | Previše `istek` = timer prestrog; previše `prekid` = tehnički problem |
| Prijave po 100 partija + vrijeme do rješenja                                   | Kvaliteta rječnika i naše discipline                                  |
| Distribucija prosjeka bodova                                                   | Podloga za kalibraciju pragova rangova                                |
| Udio partija s ≥ 1 emoji reakcijom                                             | Signal društvenog života stola                                        |

## Faze mjerenja

**Od prvog dana:** broj započetih i završenih partija, čekanje, razlozi ispadanja, D1/D7 povratak, registracije, prijave i reakcije računaju se iz baze. Na tim podacima temelje se početne odluke o kvaliteti igre.

**Nakon uključivanja Umamija:** dobivamo broj jedinstvenih posjetitelja, izvore dolazaka te klikove na „IGRAJ” i forum. Do tada te metrike nisu dostupne i ne procjenjuju se iz serverskih logova.

## Pragovi odluke (nakon 4 tjedna od lansiranja)

- **Nastavljamo punom parom:** ≥ 30 partija/dan organski i D7 ≥ 10 % — kreće rad na v2 značajkama.
- **Prilagođavamo:** ljudi dolaze ali ne ostaju (D1 < 20 %) — fokus na balans igre i čekanje, ne na nove značajke.
- **Preispitujemo:** < 5 partija/dan unatoč promociji — razgovor o kanalima akvizicije prije daljnjeg razvoja.

Pragovi su namjerno skromni: cilj MVP-a je učenje, ne vanity brojke.

## Higijena podataka

- Nakon uključivanja Umami ne koristi kolačiće i ne profilira — bez cookie bannera (vidi [sigurnost-i-privatnost.md](../07-operacije/sigurnost-i-privatnost.md)).
- Vlastite metrike računaju se iz podataka koje igra ionako bilježi — bez dodatnog praćenja igrača.
