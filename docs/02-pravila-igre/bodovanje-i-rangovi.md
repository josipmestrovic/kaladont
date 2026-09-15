# Bodovanje i rangovi

## Bodovi po partiji

Igrač zarađuje bodove ovisno o modu igre:

### 1. Mod za 4 igrača (Klasični mod)

| Izvor | Bodovi |
|---|---|
| Plasman: 4. mjesto | 0 |
| Plasman: 3. mjesto | 1 |
| Plasman: 2. mjesto | 2 |
| Plasman: 1. mjesto | 3 |
| Svaka izazvana eliminacija (napadač) | +1 |
| Bonus za 1. mjesto | +1 |

- **Napadač** je igrač čija je riječ ostala bez odgovora (protivnik kliknuo „Ne znam", isteklo mu vrijeme, nastupila mrtva slova ili prekinuo vezu **na svom potezu**). Prekid veze izvan poteza je samoeliminacija — bod ne dobiva nitko.
- Stol ukupno dijeli **10 bodova** (plasmani 0+1+2+3 = 6, eliminacije 3, bonus 1), osim kad je neka eliminacija samoeliminacija prekidom (tada manje).
- **Maksimum po igraču: 7** (plasman 3 + bonus 1 + sve 3 eliminacije) — „savršena partija".

### 2. Mod za 2 igrača (1v1 Dvoboj)

- **Pobjednik (1. mjesto):** **1 bod**
- **Poraženi (2. mjesto):** **0 bodova**
- Bodovanje je fiksno i ne utječe na 4p rang niti se miješa sa statistikama stola od 4 igrača.

### 3. Privatne sobe

- Svaka pokrenuta privatna igra zasebna je partija. Njezin rezultat **ne donosi globalne bodove** niti mijenja agregate ili rang igrača.
- Rezultati partija zbrajaju se samo u memorijskoj ljestvici te sobe: bodovi su primarni kriterij, a broj pobjeda razrješava izjednačenje. Vodeći igrač označen je krunom.
- Ljestvica vrijedi dok je soba aktivna i nije trajno spremljena u bazu.
- U privatnoj sobi igraču se prikazuje **onaj rang koji je viši** (između njegovog 4p i 1v1 ranga).

## Metrike igrača

Za svakog igrača (uključujući goste) vode se **dva neovisna skupa statistika**:

- **4p mod:** `odigrane`, `pobjede`, `eliminacije_ukupno`, `bodovi_ukupno`;
- **1v1 mod:** `odigrane_1v1`, `pobjede_1v1`, `eliminacije_1v1`, `bodovi_1v1`.

Prosjek bodova po partiji računa se odvojeno za svaki mod i predstavlja temelj pojedine ljestvice i ranga.

## Iskustvo i razine

Iskustvo (XP) je trajni napredak odvojen od bodova, ranga i ljestvice. Dodjeljuje se samo za uredno završene javne partije 4p i 1v1; privatne sobe ne dodjeljuju XP. Valjana riječ donosi 5 XP, duljina 10–11 / 12–14 / 15+ grafema dodatnih 10 / 20 / 35 XP, a frekvencija 10–99 / 1–9 / 0 (uz najmanje 4 grafema) dodatnih 15 / 30 / 50 XP. Izazvana eliminacija vrijedi 25 XP, pobjeda 50 XP, a Kaladont je zasebna fiksna nagrada od 100 XP.

Najbolji streak iz partije množi cijeli subtotal: 0–2 ×1,00; 3 ×1,10; 4 ×1,25; 5 ×1,40; 6 ×1,60; 7 ×1,75; 8 ×1,90; 9+ ×2,00. Razina 100 je maksimum i daljnji XP se ne sprema. Dobrovoljni izlazak i istek tolerancije prekida poništavaju XP igrača koji je napustio partiju.

## Rangovi

Rang je u MVP-u isključivo **prikazni status** — ne utječe na uparivanje (vidi [ADR-008](../03-arhitektura/odluke/008-bez-matchmakinga-u-mvp.md)).

- Prvih **10 partija** u pojedinom modu igrač nosi oznaku **Piskaralo** (kalibracija) i ne prikazuje mu se rang za taj mod.
- Od 11. partije rang se određuje prema prosjeku bodova po partiji u tom modu.

| Rang | Prosjek bodova po partiji |
|---|---|
| Prvopisac | < 1,50 |
| Riječarac | 1,50 – 2,09 |
| Jezičar | 2,10 – 2,49 |
| Lektor | 2,50 – 2,89 |
| Književnik | 2,90 – 3,29 |
| Jezikoslovac | 3,30 – 3,79 |
| Doktor riječi | 3,80 – 4,39 |
| Jezični maestro | 4,40 – 4,99 |
| Gospodar rječnika | 5,00 – 5,69 |
| **Kaladont** | ≥ 5,70 |

> **Napomena o kalibraciji pragova:** vrijednosti u tablici su početne procjene oko očekivanja 2,5. Pragovi su **regulator balansa** — mijenjaju se na temelju stvarne distribucije nakon lansiranja, bez utjecaja na kod igre (rang se računa pri prikazu). Najviši rang namjerno nosi ime igre: doseći **Kaladont** cilj je svake ljestvice.

## Gosti i prijenos statistike

- Gosti imaju identičnu statistiku (vode se u istoj tablici), ali im se rang prikazuje tek nakon registracije (gost avatar nosi tekstualnu oznaku `GOST`).
- Registracijom se gostov zapis **pretvara** u račun — statistika i kalibracijski napredak ostaju sačuvani.

## Ljestvice

Javna stranica `/ljestvica` prikazuje **top 100** igrača po prosjeku bodova (minimalno 10 odigranih partija) uz preklopnik između tabova:
- **4 igrača**
- **2 igrača (1v1)**
