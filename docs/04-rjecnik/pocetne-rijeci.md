# Početne riječi sustava

Sustav otvara svaku rundu riječju koju igrač nije birao. Primarni izvor je **skup sigurnih riječi**: odobreni početni kandidati iz kojih se u trenutačnom stanju partije može nastaviti najmanje dva poteza — početna riječ ima valjani odgovor, a svaki mogući valjani prvi odgovor ima barem jedan slobodan nastavak.

## Održavanje skupa

Skup živi u tablici `sigurne_pocetne_rijeci` i učitava se u memoriju pri pokretanju poslužitelja. Administratori ga mijenjaju iz **Admin → Rječnik → Sigurni skup** (dodaj / izbaci) ili akcijom **Izbaci iz sigurnog skupa** na ranim incidentima u Analitici. Promjena odmah vrijedi bez restarta.

Početni seed (52 riječi) dolazi iz migracije i konstante `POCETNI_SEED_SIGURNIH_RIJECI`. Popis ispod opisuje taj seed; stvarni runtime skup može biti veći ili manji nakon admin izmjena.

## Početni seed (52 riječi)

38 imenica, 6 pridjeva i 8 priloga.

### Imenice

šećer, biser, bager, bunker, laser, trener, frizer, jezik, učenik, radnik, dnevnik, putnik, med, led, sladoled, ured, razred, pogled, raspored, rep, džep, čep, zid, papir, sir, krumpir, leptir, šešir, orah, okvir, svemir, klavir, mir, automobil, krokodil, miš, slatkiš i nož.

### Pridjevi

velik, lijep, loš, suh, gluh i duhovit.

### Prilozi

jučer, navečer, prekjučer, naprijed, unaprijed, još, blizu i noću.

„Kruh” i „sluh” nisu u seedu jer u igri samo s imenicama dopuštaju odgovor „uhoboljo”, nakon kojeg nema nastavka. To pokazuje zašto nije dovoljno provjeriti samo postoji li prvi odgovor: moraju se provjeriti svi dopušteni prvi odgovori.

## Pravilo odabira

Pri svakom otvaranju runde sustav nasumičnim redoslijedom provjerava riječi iz trenutačnog skupa. Kandidat je siguran u trenutačnom stanju partije samo ako:

1. aktivan je, pripada barem jednoj dopuštenoj vrsti riječi i njegove leksemske grupe nisu potrošene;
2. nakon trošenja njegovih grupa postoji barem jedan dopušten odgovor;
3. svaki tada dopušten odgovor, nakon trošenja svih svojih grupa, ostavlja barem jedan dopušten nastavak.

Provjera poštuje vrste riječi dopuštene u privatnoj sobi i sve leksemske grupe potrošene u ranijim rundama iste partije. Riječi iz skupa nemaju ograničenje od šest znakova.

Ako trenutačno nema sigurnog kandidata iz skupa, sustav koristi rezervni odabir: kratku aktivnu riječ koja ima barem jedan slobodan nastavak. Za razliku od sigurnog kandidata, rezervna riječ ne jamči da će svaki mogući odgovor imati vlastiti nastavak; sljedeći igrač ipak dobiva barem jedan valjan potez. Ako ni rezervni odabir nema kandidata, primjenjuje se RS-27 i partija se sigurnosno završava.

Skup se primjenjuje u javnim i privatnim partijama, pri početku partije te nakon eliminacije ili Kaladont efekta.

## Analitika ranih incidenata

Nakon sustavske početne riječi analitika prati prva **tri** odgovora. Mrtva slova na poziciji 1, 2 ili 3 bilježe se kao rani incident. Uspješno zatvaranje prozora je `tri_odgovora_ok` (stariji zapisi mogu imati `dva_odgovora_ok`). Pravilo odabira sigurne riječi ostaje 2-ply; treći krug je samo dijagnostika kvalitete skupa.
