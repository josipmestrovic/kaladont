# Digrafi i grafemi

Hrvatska abeceda ima 30 slova, od čega su tri **digrafi** — jedno slovo zapisano dvama znakovima: **dž**, **lj**, **nj**. Kaladont se igra na **grafeme** (slova), ne na znakove. Ovo je temeljna jezična odluka projekta (vidi [ADR-006](../03-arhitektura/odluke/006-digrafi-kao-jedno-slovo.md)).

## Pravilo

Riječ se parsira u niz grafema; uspoređuju se **zadnja dva grafema** prethodne riječi i **prva dva grafema** nove riječi.

### Primjeri na kraju riječi

| Riječ | Grafemi | Zadnja dva | Traži se riječ na |
|---|---|---|---|
| konj | k-o-nj | o, nj | „onj" (ne postoji → automatska pobjeda) |
| kralj | k-r-a-lj | a, lj | „alj" (npr. aljkavost) |
| bedž | b-e-dž | e, dž | „edž" (ne postoji → automatska pobjeda) |
| ulje | u-lj-e | lj, e | „lje" (npr. ljepota — lj-e-p…) |
| kaladont | k-a-l-a-d-o-n-t | n, t | „nt" (ne postoji → automatska pobjeda) |

### Primjeri na početku riječi

| Traži se | Valjana riječ | Grafemi |
|---|---|---|
| dža | džamija | dž-a-m-i-j-a |
| lju | ljubav | lj-u-b-a-v |
| nje | njegovatelj | nj-e-g-o-v-a-t-e-lj |

## Algoritam parsiranja (pohlepni + iznimke)

1. Prolazi se kroz riječ slijeva; kad se naiđe na sljedove `dž`, `lj`, `nj`, tretiraju se kao **jedan grafem** (pohlepno).
2. Iznimke — riječi kod kojih slijed **nije** digraf nego dva zasebna slova — drže se u **listi iznimaka** i parsiraju ručno zadanim rastavom.

### Poznate iznimke (početna lista)

| Riječ | Ispravan rastav | Pohlepno bi dalo | Ispravna prva dva |
|---|---|---|---|
| injekcija | i-n-j-e-k-c-i-j-a | i-nj-e… | „in" (ne „inj") |
| konjunkcija | k-o-n-j-u-n-k-c-i-j-a | k-o-nj-u… | — (bitno za sredinu/kraj) |
| injektor | i-n-j-e-k-t-o-r | i-nj-e… | „in" |
| nadživljavanje | n-a-d-ž-i-v… | n-a-dž-i… | — |
| odžvakavanje | o-d-ž-v-a… | o-dž-v… | — |

Lista nije konačna — **širi se kroz prijave igrača** i jezičnu provjeru pri uvozu. Iznimka je bitna samo ako sporni slijed upada u **prva dva ili zadnja dva grafema** riječi; u sredini riječi ne utječe na igru.

## Implementacijske posljedice

- Parsiranje se izvodi **jednom, pri uvozu rječnika**: svaka riječ u bazi dobiva predizračunate stupce `prva_dva` i `zadnja_dva`. U igri je provjera O(1) usporedba stringova.
- **Mrtvi parovi** (kombinacije dvaju grafema na koje ne počinje nijedna riječ, poput „nt", „onj", „edž") izvode se iz baze pri učitavanju rječnika u memoriju poslužitelja.
- Upis igrača se pri validaciji uspoređuje s `prva_dva` tražene kombinacije — igrač upisuje normalne znakove („nj" tipka kao n+j), a grafemska logika je nevidljiva.

## Testni slučajevi (obavezni u paketu `zajednicko`)

| Ulaz | Očekivano |
|---|---|
| `grafemi("konj")` | `["k","o","nj"]` |
| `grafemi("injekcija")` | `["i","n","j","e","k","c","i","j","a"]` (iznimka) |
| `zadnjaDva("kaladont")` | `"nt"` |
| `zadnjaDva("kralj")` | `"alj"` → čeka se usporedba s `prvaDva("aljkavost") === "alj"` ✓ |
| `prvaDva("džamija")` | `"dža"` kao grafemi dž+a |
| `prvaDva("ljubav")` | `"lju"` kao grafemi lj+u |
