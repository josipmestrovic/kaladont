# Metrike uspjeha

MVP je test tržišta — bez brojki nema zaključka. Od prvog dana mjerimo **vlastite metrike** izvedene iz tablica igre. Self-hosted Umami (cookieless) dodaje se nakon stabilizacije stacka na `analitika.kaladont.hr`; tracker je isključen dok `UMAMI_URL` i `UMAMI_WEBSITE_ID` nisu postavljeni ([ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md)).

## Sjevernjača

**Broj odigranih partija po danu.** Sve ostalo je dijagnostika oko te brojke.

## Ljevak (put korisnika)

| Korak         | Metrika                                                           | Izvor                           |
| ------------- | ----------------------------------------------------------------- | ------------------------------- |
| 1. Dolazak    | Jedinstveni posjetitelji, izvori prometa                          | Umami, nakon uključivanja       |
| 2. Namjera    | Klik na Brzu igru (`mod-klik`, `mod=brza_igra`)                   | Umami event, nakon uključivanja |
| 3. Strpljenje | Postotak koji dočeka stol; prosjek/medijan čekanja                | baza (`cekanje_ms`)             |
| 4. Igra       | Završene partije / započete; trajanje partije                     | baza                            |
| 5. Povratak   | DAU/WAU/MAU; novi vs povratni; retencija D1 / D7 / D30            | baza (`analitika_*`)            |
| 6. Ulog       | Registracije; konverzija gost→reg unutar 30 dana                  | baza (`analitika_*`, `igraci`)  |

## Aktivnost, retencija i konverzija (interna analitika)

Admin pregled: `/admin/analitika` → sekcija **Igrači i rast** (`GET /api/admin/analitika/igraci`). Dan je **Europe/Zagreb**. Aktivnost se računa samo iz završenih igara (`analitika_igre.ishod = zavrsena`) po `kraj_u`; botovi nisu u `analitika_sudjelovanja`.

| Metrika | Definicija |
| --- | --- |
| **Aktivan igrač** | Jedinstveni `igrac_id` s barem jednim sudjelovanjem u završenoj igri tog kalendarskog dana. |
| **DAU** | Distinct aktivni na referentni dan (`do` filtera). |
| **WAU** | Distinct aktivni u `[do − 6, do]` (7 dana), ne zbroj DAU. |
| **MAU** | Distinct aktivni u `[do − 29, do]` (30 dana), ne zbroj DAU. |
| **DAU/MAU** | `DAU / MAU`; `null` ako je MAU = 0. |
| **Novi** | Aktivan taj dan i prva ikad završena igra (MIN dan iz cijele povijesti, uz isti kontekst filter) pada na taj dan. |
| **Povratni** | Aktivan taj dan i prva igra strogo prije tog dana. `DAU = novi + povratni`. |
| **D1 / D7 / D30** | Kohorta = igrači s prvim danom D; povratak = aktivan točno N kalendarskih dana kasnije. U ukupni postotak ulaze samo **zrele** kohorte (ciljni dan završen). Ukupno = Σpovratnika / Σkohorte. |
| **Registracije** | `igraci.registriran_at` po danu Zagreb, `upravljac = covjek`. Nisu filtrirane kontekstom igre (nema atribucije po modu). |
| **Konverzija 30d** | Nazivnik: igrači čiji je prvi zabilježeni dan igranja uključivao sudjelovanje kao `gost`. Brojnik: isti `igrac_id` dobije `registriran_at` u prozoru `[prvi dan, prvi dan + 30)`. Samo zrele kohorte u glavnom KPI-ju; nezrele se mogu prikazati odvojeno kao „dosad”. |

**Pouzdani podaci od:** prvi zabilježeni dan završene igre u analitici — ne „nikad ranije u stvarnosti”. Povijest počinje tek od uvođenja `analitika_igre` / sudjelovanja. Obrisani računi: sudjelovanja ostaju po `igrac_id`; `registriran_at` može nestati ako se red igrača briše.

Filter konteksta (`javna` / `privatna` / `trening` / `izazov`) vrijedi za aktivnost, nove/povratne i retenciju; registracije ostaju globalne.

`zadnja_aktivnost` **nije** izvor za retenciju ni DAU (drugo značenje; nije pogodna za goste ni day-N kohorte).

## Zdravlje igre

| Metrika                                                                        | Zašto                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Prosječno čekanje u redu (zadnjih 100 partija)                                 | Ista brojka koju vide igrači; ključni rizik MVP-a                     |
| Distribucija načina ispadanja (`ne_znam` / `istek` / `mrtva_slova` / `prekid`) | Previše `istek` = timer prestrog; previše `prekid` = tehnički problem |
| Prijave po 100 partija + vrijeme do rješenja                                   | Kvaliteta rječnika i naše discipline                                  |
| Distribucija prosjeka bodova                                                   | Podloga za kalibraciju pragova rangova                                |
| Udio partija s ≥ 1 emoji reakcijom                                             | Signal društvenog života stola                                        |

## Faze mjerenja

**Od prvog dana:** broj započetih i završenih partija, čekanje, razlozi ispadanja, DAU/WAU/MAU, D1/D7/D30, registracije, konverzija 30d, prijave i reakcije računaju se iz baze. Na tim podacima temelje se početne odluke o kvaliteti igre.

**Nakon uključivanja Umamija** (`UMAMI_WEBSITE_ID` + DNS `analitika.kaladont.hr`): jedinstveni posjetitelji, izvori dolazaka te prilagođeni događaji (`mod-klik`, `navigacija-klik`, auth CTA, privatna soba, avatar, povratne informacije). Katalog: [runbook-umami.md](../07-operacije/runbook-umami.md#katalog-prilagođenih-događaja). Stari `igraj-klik` / forum događaji više se ne šalju. Dok website ID nije postavljen, te metrike nisu dostupne i ne procjenjuju se iz serverskih logova.

## Pragovi odluke (nakon 4 tjedna od lansiranja)

- **Nastavljamo punom parom:** ≥ 30 partija/dan organski i D7 ≥ 10 % — kreće rad na v2 značajkama.
- **Prilagođavamo:** ljudi dolaze ali ne ostaju (D1 < 20 %) — fokus na balans igre i čekanje, ne na nove značajke.
- **Preispitujemo:** < 5 partija/dan unatoč promociji — razgovor o kanalima akvizicije prije daljnjeg razvoja.

Pragovi su namjerno skromni: cilj MVP-a je učenje, ne vanity brojke.

## Higijena podataka

- Nakon uključivanja Umami ne koristi kolačiće i ne profilira — bez cookie bannera (vidi [sigurnost-i-privatnost.md](../07-operacije/sigurnost-i-privatnost.md)).
- Vlastite metrike računaju se iz podataka koje igra ionako bilježi — bez dodatnog praćenja igrača.
