# Metrike uspjeha

MVP je test tržišta — bez brojki nema zaključka. Od prvog dana mjerimo **vlastite metrike** izvedene iz tablica igre. Self-hosted Umami (cookieless) dodaje se nakon stabilizacije stacka na `analitika.kaladont.hr`; tracker je isključen dok `UMAMI_URL` i `UMAMI_WEBSITE_ID` nisu postavljeni ([ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md)).

## Sjevernjača

**Broj odigranih partija po danu.** Sve ostalo je dijagnostika oko te brojke.

## Ljevak (put korisnika)

| Korak         | Metrika                                                           | Izvor                           |
| ------------- | ----------------------------------------------------------------- | ------------------------------- |
| 1. Dolazak    | Jedinstveni posjetitelji, izvori prometa                          | Umami, nakon uključivanja       |
| 2. Namjera    | Klik na Brzu igru (`mod-klik`, `mod=brza_igra`)                   | Umami event, nakon uključivanja |
| 3. Strpljenje | Postotak koji dočeka stol; prosjek/medijan čekanja                | baza (`analitika_cekanja`)      |
| 4. Igra       | Završene/započete; načini, formati, pravila; trajanje             | baza (`analitika_igre`)         |
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

## Partije, načini, formati i pravila

Admin: `/admin/analitika` → **Partije i načini igranja** (`GET /api/admin/analitika/partije`). Kohorta = igre s `pocetak_u` u odabranom rasponu (Europe/Zagreb). Ishodi su **trenutačno poznati** (igra započeta u rasponu može završiti nakon ponoći i i dalje ulazi u kohortu).

| Metrika | Definicija |
| --- | --- |
| **Način igranja (kontekst)** | `javna` (Brza igra), `privatna`, `trening`, `izazov`. Jedna igra broji se jednom. |
| **Format** | `mod` iz `analitika_igre`: `dva_igraca` / `tri_igraca` / `cetiri_igraca` (Dvoboj / Troboj / Četveroboj). Nije isto što i način igranja. Privatne sobe trenutačno u motoru bilježe `cetiri_igraca`. |
| **Pravila** | `klasicni` / `ka_zna` / `dokazi_nastavak` iz `analitika_igre.pravila` (nullable). Read-path: `COALESCE(analitika_igre.pravila, partije.pravila)` po ID-u; inače **Nepoznato**. Bez masovnog backfilla. |
| **Stopa završavanja** | `zavrsene / (zavrsene + prekinute + nepotpuno)` unutar kohorte početaka. Igre bez ishoda nisu prekinute; zasebno se prikazuje pokrivenost terminalnih ishoda. |
| **Trajanje** | `kraj_u − pocetak_u` samo za `ishod = zavrsena` s valjanim vremenima. Prosjek, medijan, P90; prazan uzorak → `null` (ne 0). Prekinute isključene. Bez vremena čekanja. |
| **Jedinstveni igrači** | Distinct `igrac_id` iz sudjelovanja u **završenim** igrama kohorte. Ukupno ≠ zbroj po kontekstima. Botovi nisu u `analitika_sudjelovanja`. |

Dnevna statistika započetih/završenih po kalendarskom danu (`/dnevno`) ostaje zasebna i nije zamijenjena ovom kohortom.

## Javna čekaonica (uparivanje i napuštanje)

Admin: `/admin/analitika` → **Čekaonica (javna)** (`GET /api/admin/analitika/cekanje`). Samo javni red (Brza igra). Kohorta = terminalni pokušaji s `kraj_u` u odabranom rasponu (Europe/Zagreb). Jedan INSERT po završetku pokušaja (`analitika_cekanja`); bez `igrac_id` / PII. Ulazak u red ne piše red. Operativna statistika po stolu (`/admin/statistike/cekanje`, `cekanje_ms`) ostaje zasebna.

| Metrika | Definicija |
| --- | --- |
| **Terminalni pokušaj** | Memorijski pokušaj zatvoren ishodom `uparivanje` / `napustanje` / `prekid_veze` / `promjena_reda` / `uklonjen`. Broj nije egzaktan broj svih ikad započetih čekanja (npr. pad procesa). |
| **Uparivanje** | Stol uspješno pokrenut za taj pokušaj. |
| **Napuštanje** | `red:izadji` dok pokušaj nije u tijeku pokretanja stola. Nije nužno klik „Odustani” u UI-ju. |
| **Prekid veze** | Disconnect dok je igrač u redu. |
| **Promjena reda** | Novi ulazak zatvara stari pokušaj (drugi ključ/pravila). |
| **Uklonjen** | Steal/shutdown/neuspjeli start bez povratka u red. |
| **Trajanje** | `kraj_u − pocetak_u` u sekundama; prosjek/medijan/P90/P95 za uparivanje i napuštanje zasebno. |
| **Distribucija napuštanja** | Kantice 0–5 … 60+ s samo za ishod `napustanje`. |
| **Gost / registriran** | Snimka `vrsta_racuna_na_pocetku` u trenutku ulaska. |

Za kontekst filter ≠ `javna` (npr. privatna/trening/izazov) API/UI vraćaju N/A — čekaonica ne postoji izvan javnog reda.

## Botovi i balans

Admin: `/admin/analitika` → **Botovi i balans** (`GET /api/admin/analitika/botovi`). Kohorta = igre s `pocetak_u` u rasponu (Europe/Zagreb). Detaljna analitika pokušaja Izazova ostaje zasebna.

| Metrika | Definicija |
| --- | --- |
| **Snimka pri startu** | `broj_ljudi`, `broj_botova`, `profil_botova`, `verzija_bot_politike`, `verzija_profila_bota` na `analitika_igre`. Null = povijesno nepoznato; `broj_botova = 0` = pouzdano bez botova. Profil: `pocetnik` / `iskusni` / `majstor` / `velemajstor` / `prilagodeno`. Brza forsira Iskusni; Trening/Izazov šalju odabrani profil; privatna bez overlaya → klasifikacija poluga ili `prilagodeno`. |
| **Pobjeda čovjeka vs bota** | Vrsta pobjednika (`covjek`/`bot`) na završenoj igri. Nije individualna stopa pobjeda po igraču. Prekinuta igra nema pobjednika. |
| **Uspješnost protiv botova** | Samo `broj_botova > 0`, `ishod = zavrsena`, poznata `vrsta_pobjednika`. Segmenti: profil, format, pravilnik, verzije, sastav. Mali uzorak &lt; 30; Wilson 95 % kad postoji uzorak. |
| **Sastav javnih stolova** | Stvarni `(broj_ljudi, broj_botova)`, ne pretpostavka iz moda. |
| **Eliminacije** | JSONB brojači stvarnih ispadanja ljudi/botova (`ne_znam`/`istek`/`mrtva_slova`/`prekid`/`kaladont`/`nepoznato`) iz `razloziEliminacije`. Pobjednik nije eliminiran. Eliminacija ≠ završni plasman: fiktivni unos u `eliminirani` pri ranom stopu treninga/izazova (`sabijPreostaleZaRaniStop`, terminal izazova bez standardnog razloga) **ne** ulazi u brojače. |
| **Trajanje** | `kraj_u − pocetak_u` za završene igre s botovima; prosjek/medijan/P90 (nearest-rank). |

Verzija politike/profila bilježi set poluga pri startu; nije dokaz da su svi admin parametri kroz povijest identični. Bez masovnog backfilla; read-path može dopuniti sastav/pobjednika iz `partije`/`igraci` kad je pouzdano.

## Gamifikacija i napredak

Admin: `/admin/analitika` → **Gamifikacija** (`GET /api/admin/analitika/gamifikacija`). Bez novih upisa tijekom igre — samo čitanje postojećih tablica. Odgovor dijeli **razdoblje** (Europe/Zagreb `od`/`do`) i **trenutačni presjek** (stanje sada; filter datuma ga ne rekonstruira unatrag).

| Metrika | Izvor / definicija |
| --- | --- |
| **Kohorta dodjela misija** | `dodjele_misija.stvoreno_u` u rasponu; zasebno `dnevna` / `tjedna`. Statusi: `aktivna`, `dovrsena`, `zamijenjena`, `istekla`. Dnevne **nemaju** kalendarski istek (`istjece_u` NULL). |
| **Udio trenutno dovršenih** | `dovrsene / sve_dodjele_kohorte`. |
| **Terminalna stopa** | `dovrsene / (dovrsene + zamijenjene + istekle)`. Aktivne nisu neuspjeh; prazan nazivnik → `null`. Nije konačna vjerojatnost da će sve dnevne biti dovršene. |
| **Predlošci** | Grupiranje `(predlozak_id, vrsta, verzija_definicije)`; naziv iz `snapshot.naziv` (fallback ID). Mali uzorak &lt; 30. |
| **Zamjene** | `zamjene_misija.stvoreno_u`; stopa po predlošku = zamijenjene dodjele / dodjele **iste kohorte**. |
| **Dotok dnevnih** | `dotok_dnevnih_misija.lokalni_datum`: `dodijeljeno` / `preskoceno`. Preskočeno ≠ svjesno odustajanje. |
| **Doprinosi** | `doprinosi_misijama` po `javna`/`trening`/`izazov`; distinct `izvor_id` ≠ broj igara s napretkom. |
| **XP misija** | `nagrade_misija.xp_stvarno` (ne nominalno), filter `dodijeljena_u`. |
| **XP izazova** | `zavrseci_izazova.awarded_xp` na prvim uspjesima (`vrijeme`). |
| **XP razine (presjek)** | `igraci.iskustvo_ukupno` + `stanjeIskustva`; raspani 1–5 … 71–100. Nije XP zarađen u filteru. |
| **Dostignuća (presjek)** | `max(spremljena, dinamička)` kao profil/`izracunajSazetakZvjezdicaDostignuca`. `prvo_otkljucano` samo za broj prvih otključavanja u razdoblju. |
| **Kolekcija (presjek)** | `otkljucane_rijeci_igraca`; veličina = broj redova (riječ se ne broji dvaput). Period: broj otključavanja po `otkljucano`. |

**Obuhvat:** botovi isključeni. Baza za postotke/presjeke = ljudski igrači s ≥1 završenom igrom u analitici, `obrisan_at IS NULL`. Misije/nagrade ionako samo registrirani. Soft-obrisani ostaju u povijesnim redovima razdoblja.

## Zdravlje igre

| Metrika                                                                        | Zašto                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Prosječno čekanje u redu (zadnjih 100 partija)                                 | Ista brojka koju vide igrači; ključni rizik MVP-a                     |
| Distribucija načina ispadanja (`ne_znam` / `istek` / `mrtva_slova` / `prekid`) | Previše `istek` = timer prestrog; previše `prekid` = tehnički problem |
| Prijave po 100 partija + vrijeme do rješenja                                   | Kvaliteta rječnika i naše discipline                                  |
| Distribucija prosjeka bodova                                                   | Podloga za kalibraciju pragova rangova                                |
| Udio partija s ≥ 1 emoji reakcijom                                             | Signal društvenog života stola                                        |

## Faze mjerenja

**Od prvog dana:** broj započetih i završenih partija, načini/formati/pravila, trajanje, čekanje, razlozi ispadanja, DAU/WAU/MAU, D1/D7/D30, registracije, konverzija 30d, prijave i reakcije računaju se iz baze. Na tim podacima temelje se početne odluke o kvaliteti igre.

**Nakon uključivanja Umamija** (`UMAMI_WEBSITE_ID` + DNS `analitika.kaladont.hr`): jedinstveni posjetitelji, izvori dolazaka te prilagođeni događaji (`mod-klik`, `navigacija-klik`, auth CTA, privatna soba, avatar, povratne informacije). Katalog: [runbook-umami.md](../07-operacije/runbook-umami.md#katalog-prilagođenih-događaja). Stari `igraj-klik` / forum događaji više se ne šalju. Dok website ID nije postavljen, te metrike nisu dostupne i ne procjenjuju se iz serverskih logova.

## Pragovi odluke (nakon 4 tjedna od lansiranja)

- **Nastavljamo punom parom:** ≥ 30 partija/dan organski i D7 ≥ 10 % — kreće rad na v2 značajkama.
- **Prilagođavamo:** ljudi dolaze ali ne ostaju (D1 < 20 %) — fokus na balans igre i čekanje, ne na nove značajke.
- **Preispitujemo:** < 5 partija/dan unatoč promociji — razgovor o kanalima akvizicije prije daljnjeg razvoja.

Pragovi su namjerno skromni: cilj MVP-a je učenje, ne vanity brojke.

## Higijena podataka

- Nakon uključivanja Umami ne koristi kolačiće i ne profilira — bez cookie bannera (vidi [sigurnost-i-privatnost.md](../07-operacije/sigurnost-i-privatnost.md)).
- Vlastite metrike računaju se iz podataka koje igra ionako bilježi — bez dodatnog praćenja igrača.
