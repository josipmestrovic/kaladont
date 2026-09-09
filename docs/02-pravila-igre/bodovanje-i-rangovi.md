# Bodovanje i rangovi

## Bodovi po partiji

Igrač u jednoj partiji zarađuje bodove iz tri izvora:

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
- Pobjednik uvijek ima najmanje 5 bodova (3 + 1 + barem završna eliminacija), no 2. mjesto s više eliminacija može zaraditi blizu pobjednika — bodovanje svjesno nagrađuje napadačku igru.

### Primjer

Partija: Ana eliminira Borisa (4. mjesto), Cvita eliminira Anu (3. mjesto), Cvita eliminira Damira (2. mjesto) i pobjeđuje.

| Igrač | Plasman | Bodovi plasmana | Eliminacije | Bonus | Ukupno |
|---|---|---|---|---|---|
| Cvita | 1. | 3 | 2 | 1 | **6** |
| Damir | 2. | 2 | 0 | — | **2** |
| Ana | 3. | 1 | 1 | — | **2** |
| Boris | 4. | 0 | 0 | — | **0** |

## Metrike igrača

Za svakog igrača (uključujući goste) vodi se:

- **odigrane partije**, **pobjede** (1. mjesta), **ukupne eliminacije**, **ukupni bodovi**;
- izvedeno: **postotak pobjeda**, **prosjek eliminacija po partiji** i — glavna metrika — **prosjek bodova po partiji** (0–7).

Prosjek bodova po partiji jedina je metrika ranga jer već objedinjuje plasmane i eliminacije u omjeru s brojem odigranih partija. Očekivani prosjek preko svih igrača je **2,5**.

## Rangovi

Rang je u MVP-u isključivo **prikazni status** — ne utječe na uparivanje (vidi [ADR-008](../03-arhitektura/odluke/008-bez-matchmakinga-u-mvp.md)).

- Prvih **10 partija** igrač nosi oznaku **Piskaralo** (kalibracija) i ne prikazuje mu se rang.
- Od 11. partije rang se određuje prema prosjeku bodova po partiji.

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

- Gosti imaju identičnu statistiku (vode se u istoj tablici), ali im se rang prikazuje tek nakon registracije.
- Registracijom se gostov zapis **pretvara** u račun — statistika i kalibracijski napredak ostaju sačuvani.

## Ljestvica

Javna stranica prikazuje **top 100** igrača po prosjeku bodova (minimalno 10 odigranih partija). Prikazuje: mjesto, nadimak, rang, prosjek bodova, broj partija, postotak pobjeda.
