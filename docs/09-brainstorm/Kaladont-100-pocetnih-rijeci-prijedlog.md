# Kaladont: 100 kandidata za početne riječi

Prijedlog za pregled i odobrenje • 18. rujna 2026. • Bez izmjena igre ili repozitorija.

## Rezultat

Prikupljeno je **100 različitih riječi iz svih 10 kategorija**, provjerenih u izvornom hrLexu 1.3 nakon rekonstrukcije aktualnih uvoznih filtera. **68 riječi prolazi strožu provjeru uz sve dopuštene vrste riječi; 32 su označene kao rezerva.** Ovo nije tvrdnja da je svih 100 sigurno pustiti u igru.

Ni jedna predložena riječ ne završava na **na** ili **ka**. Sve imaju barem jedan nastavak u provjerenom rječniku uz sve kategorije. Birane su poznate riječi. Poznata početna riječ ipak ne jamči poznate nastavke: primjerice „orah” otvara AH, a „topao” AO. I takve riječi treba procijeniti pri ljudskom odobrenju.

**Odluka nakon pregleda:** za prvi [skup sigurnih riječi](../04-rjecnik/pocetne-rijeci.md) odobrene su 52 riječi: 38 imenica, 6 pridjeva i 8 priloga. Sve su označene s A uz sve vrste i prolaze provjeru unutar svoje kategorije. „Kruh” i „sluh” izostavljeni su zbog odgovora „uhoboljo”. B-riječi nisu odobrene za automatski odabir.

## Što znače oznake

- **A:** uz sve vrste riječi, na početku s praznim skupom potrošenih grupa, nijedan dopušten prvi odgovor iz rekonstruiranog rječnika ne ostavlja sljedećeg igrača bez legalnog nastavka. U provjeri se troše sve grupe početne riječi i odgovora. Nije jamstvo za daljnje poteze, ljudsku lakoću ili kasnije runde.
- **B:** pronađen je barem jedan prvi odgovor koji odmah ostavlja sljedećeg igrača bez nastavka. Naveden je konkretan primjer.
- **Samo ta kategorija — prolazi:** ista provjera prolazi kada je dopuštena samo kategorija pod kojom je kandidat prikazan.
- **Samo ta kategorija — zamka:** nastavak postoji, ali barem jedan odgovor odmah ostavlja sljedećeg igrača bez nastavka.
- **Samo ta kategorija — nema nastavka:** početna riječ u takvoj sobi ne smije biti odabrana.

Brojevi nastavaka broje oblike riječi, **ne** različite leme ili ljudima poznate odgovore. Stotine oblika mogu pripadati mnogo manjem broju leksemskih grupa. Riječ može imati više kategorija; prikazani su stvarni metapodaci iz hrLexa.

## Što je provjereno u kodu

1. Početni odabir prvenstveno koristi aktivne imeničke leme kraće od šest znakova. Provjerava postoji li barem jedan nastavak nakon trošenja grupa početne riječi. Ne provjerava poznatost ni posljedice prvog odgovora.
2. Ako imenice nisu dopuštene ili nema odgovarajuće, rezervni odabir prolazi kratkim riječima redom. Taj dio nije nasumičan; rječnik se učitava abecedno.
3. Privatne sobe nude 10 vrsta riječi, tajmer 15/30/60 sekundi ili bez tajmera i uključivanje bodova za eliminacije. Na izbor riječi od tih postavki utječu dopuštene vrste. Parametri za osnovne oblike i minimalnu duljinu postoje u nižim funkcijama, ali nisu aktivne postavke ovog sučelja i poziva motora.
4. Isti odabir služi za otvaranje prve i sljedećih rundi. Riječi i njihove grupe potrošene ranije u partiji i dalje su bitne. Ovaj pregled ne simulira sve moguće povijesti partije.
5. Aktualni motor ima zaštitu za „ka” koji zada sustav: ako nema prethodnog igrača odgovornog za otvaranje, Kaladont efekt preskače eliminaciju i pokreće novu rundu. To ne potvrđuje da na stagingu nema drugog problema; staging nije testiran.
6. Stvarni slovni filter je `[a-zšđčćž]+`: propušta i q/w/x/y, iako komentar i dokumentacija tvrde suprotno. Uvoz također nema minimalni prag frekvencije. Zato pri provjeri nije pošteno zanemariti riječi poput „timing” ili „jukeboxa”.

Neke predložene riječi dulje su od trenutačnog limita početnog izbora. To je namjerni sadržajni prijedlog, a ne tvrdnja da bi ih postojeći kod već odabrao. O tehničkim promjenama odlučuje se poslije odobrenja sadržaja.

## Zašto nije dovoljno izbaciti NA i KA

- jakna → nakovanj → **a + nj**: nema nastavka u provjerenom rječniku.
- igra → ravnatelj → **e + lj**, dakle **elj**: nema nastavka.
- auto → toranj → **a + nj**: nema nastavka.
- čitati → timing → **ng**: nema nastavka.
- pet → etnopark → **rk**: nema nastavka. Ovo je rijedak, ali stvarno dopušten odgovor u izvornim podacima.

Završeci se računaju kao dva grafema; dž, lj i nj broje se kao jedno slovo.

## Privatne sobe: ograničenja odabira

Sigurnost ovisi o cijelom skupu dopuštenih kategorija, ne samo o kategoriji početne riječi. Oznaka A za miješanu igru nije automatski A za privatnu sobu.

- „Moj” je A uz sve kategorije, ali u sobi samo sa zamjenicama nema nastavka na OJ.
- „Pred” je A uz sve kategorije, ali samo s prijedlozima nema nastavka na ED.
- „Jer” je A uz sve kategorije, ali samo s veznicima nema nastavka na ER.
- „Joj” je A uz sve kategorije, ali samo s uzvicima može slijediti „oj”, nakon čega više nema slobodnog nastavka.
- „Plav” je B uz sve kategorije zbog „avans”, ali prolazi provjeru ako su dopušteni samo pridjevi.

Prema tome, svih 10 kategorija može biti zastupljeno u zajedničkom katalogu, ali to **ne znači** da svaka kategorija samostalno omogućuje dobar početak. Za nepodržanu kombinaciju ne treba izmišljati sigurnu riječ. Konačni skup sigurnih riječi mora biti odobren zajedno s granicama njegove uporabe.

## Pregled raspodjele

| Kategorija | Ukupno | A: sve kategorije | B: rezerva | Prolazi samo vlastitu kategoriju |
|---|---:|---:|---:|---:|
| Imenice | 40 | 40 | 0 | 38 |
| Glagoli | 12 | 0 | 12 | 0 |
| Pridjevi | 15 | 9 | 6 | 15 |
| Prilozi | 13 | 8 | 5 | 13 |
| Zamjenice | 5 | 5 | 0 | 0 |
| Brojevi | 5 | 0 | 5 | 0 |
| Prijedlozi | 3 | 3 | 0 | 0 |
| Veznici | 3 | 2 | 1 | 0 |
| Čestice | 2 | 0 | 2 | 0 |
| Uzvici | 2 | 1 | 1 | 0 |

## Svih 100 kandidata

### Imenice

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 1 | šećer | ER | A | prolazi | — |
| 2 | biser | ER | A | prolazi | — |
| 3 | bager | ER | A | prolazi | — |
| 4 | bunker | ER | A | prolazi | — |
| 5 | laser | ER | A | prolazi | — |
| 6 | trener | ER | A | prolazi | — |
| 7 | frizer | ER | A | prolazi | — |
| 8 | jezik | IK | A | prolazi | — |
| 9 | učenik | IK | A | prolazi | — |
| 10 | radnik | IK | A | prolazi | — |
| 11 | dnevnik | IK | A | prolazi | — |
| 12 | putnik | IK | A | prolazi | — |
| 13 | med | ED | A | prolazi | — |
| 14 | led | ED | A | prolazi | — |
| 15 | sladoled | ED | A | prolazi | — |
| 16 | ured | ED | A | prolazi | — |
| 17 | razred | ED | A | prolazi | — |
| 18 | pogled | ED | A | prolazi | — |
| 19 | raspored | ED | A | prolazi | — |
| 20 | rep | EP | A | prolazi | — |
| 21 | džep | EP | A | prolazi | — |
| 22 | čep | EP | A | prolazi | — |
| 23 | zid | ID | A | prolazi | — |
| 24 | papir | IR | A | prolazi | — |
| 25 | sir | IR | A | prolazi | — |
| 26 | krumpir | IR | A | prolazi | — |
| 27 | leptir | IR | A | prolazi | — |
| 28 | šešir | IR | A | prolazi | — |
| 29 | kruh | UH | A | zamka | Samo ova kategorija: uhoboljo |
| 30 | orah | AH | A | prolazi | — |
| 31 | okvir | IR | A | prolazi | — |
| 32 | svemir | IR | A | prolazi | — |
| 33 | klavir | IR | A | prolazi | — |
| 34 | mir | IR | A | prolazi | — |
| 35 | automobil | IL | A | prolazi | — |
| 36 | krokodil | IL | A | prolazi | — |
| 37 | miš | IŠ | A | prolazi | — |
| 38 | slatkiš | IŠ | A | prolazi | — |
| 39 | sluh | UH | A | zamka | Samo ova kategorija: uhoboljo |
| 40 | nož | OŽ | A | prolazi | — |

### Glagoli

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 41 | čitati | TI | B | zamka | timing |
| 42 | pisati | TI | B | zamka | timing |
| 43 | gledati | TI | B | zamka | timing |
| 44 | igrati | TI | B | zamka | timing |
| 45 | pjevati | TI | B | zamka | timing |
| 46 | plesati | TI | B | zamka | timing |
| 47 | kuhati | TI | B | zamka | timing |
| 48 | crtati | TI | B | zamka | timing |
| 49 | čitaju | JU | B | zamka | jukeboxa; nije osnovni oblik |
| 50 | pjevaju | JU | B | zamka | jukeboxa; nije osnovni oblik |
| 51 | crtaju | JU | B | zamka | jukeboxa; nije osnovni oblik |
| 52 | kuhaju | JU | B | zamka | jukeboxa; nije osnovni oblik |

### Pridjevi

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 53 | velik | IK | A | prolazi | — |
| 54 | lijep | EP | A | prolazi | — |
| 55 | loš | OŠ | A | prolazi | — |
| 56 | suh | UH | A | prolazi | — |
| 57 | gluh | UH | A | prolazi | — |
| 58 | plav | AV | B | prolazi | avans |
| 59 | zdrav | AV | B | prolazi | avans |
| 60 | lukav | AV | B | prolazi | avans |
| 61 | prav | AV | B | prolazi | avans |
| 62 | sretan | AN | B | prolazi | antioksidans |
| 63 | miran | AN | B | prolazi | antioksidans |
| 64 | veseo | EO | A | prolazi | — |
| 65 | debeo | EO | A | prolazi | — |
| 66 | topao | AO | A | prolazi | — |
| 67 | duhovit | IT | A | prolazi | — |

### Prilozi

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 68 | jučer | ER | A | prolazi | — |
| 69 | navečer | ER | A | prolazi | — |
| 70 | prekjučer | ER | A | prolazi | — |
| 71 | naprijed | ED | A | prolazi | — |
| 72 | unaprijed | ED | A | prolazi | — |
| 73 | još | OŠ | A | prolazi | — |
| 74 | blizu | ZU | A | prolazi | — |
| 75 | vani | NI | B | prolazi | nivoe |
| 76 | lani | NI | B | prolazi | nivoe |
| 77 | noću | ĆU | A | prolazi | — |
| 78 | usput | UT | B | prolazi | utemeljitelj |
| 79 | dalje | LJE | B | prolazi | ljevač |
| 80 | dolje | LJE | B | prolazi | ljevač |

### Zamjenice

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 81 | moj | OJ | A | nema nastavka | — |
| 82 | tvoj | OJ | A | nema nastavka | — |
| 83 | svoj | OJ | A | nema nastavka | — |
| 84 | taj | AJ | A | nema nastavka | — |
| 85 | ovaj | AJ | A | nema nastavka | — |

### Brojevi

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 86 | pet | ET | B | nema nastavka | etnopark |
| 87 | deset | ET | B | nema nastavka | etnopark |
| 88 | devet | ET | B | nema nastavka | etnopark |
| 89 | dvadeset | ET | B | nema nastavka | etnopark |
| 90 | trideset | ET | B | nema nastavka | etnopark |

### Prijedlozi

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 91 | pred | ED | A | nema nastavka | — |
| 92 | ispred | ED | A | nema nastavka | — |
| 93 | pored | ED | A | nema nastavka | — |

### Veznici

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 94 | jer | ER | A | nema nastavka | — |
| 95 | kao | AO | A | nema nastavka | — |
| 96 | dok | OK | B | nema nastavka | okidač |

### Čestice

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 97 | čak | AK | B | nema nastavka | akcent |
| 98 | možda | DA | B | zamka | davatelj |

### Uzvici

| # | Riječ | Završetak | Sve vrste | Samo ova kategorija | Napomena / prvi odgovor koji eliminira |
|---:|---|---|---|---|---|
| 99 | joj | OJ | A | zamka | Samo ova kategorija: oj |
| 100 | bum | UM | B | nema nastavka | umanjitelj |

## Evidencija provjere

Svi sljedeći podaci odnose se na izvorni hrLex i aktualne filtre, ne na dohvat aktivne tablice sa staginga ili produkcije. Ručno dodane ili deaktivirane riječi mogu promijeniti rezultat. Nisu mijenjani ni kod, ni baza, ni pravila igre.

| Riječ | Sve kategorije u hrLexu | Osnovni oblik prema logici igre | Broj prvih nastavaka, sve vrste | Broj prvih nastavaka, samo prikazana kategorija |
|---|---|---|---:|---:|
| šećer | imenica | da | 946 | 205 |
| biser | imenica | da | 946 | 205 |
| bager | imenica | da | 946 | 205 |
| bunker | imenica | da | 946 | 205 |
| laser | imenica | da | 946 | 205 |
| trener | imenica | da | 946 | 205 |
| frizer | imenica | da | 946 | 205 |
| jezik | imenica | da | 390 | 115 |
| učenik | imenica | da | 390 | 115 |
| radnik | imenica | da | 390 | 115 |
| dnevnik | imenica | da | 390 | 115 |
| putnik | imenica | da | 390 | 115 |
| med | imenica | da | 404 | 84 |
| led | imenica | da | 404 | 84 |
| sladoled | imenica | da | 404 | 84 |
| ured | imenica | da | 404 | 84 |
| razred | imenica | da | 404 | 84 |
| pogled | imenica | da | 404 | 84 |
| raspored | imenica | da | 404 | 84 |
| rep | imenica | da | 1742 | 446 |
| džep | imenica | da | 1742 | 446 |
| čep | imenica | da | 1742 | 446 |
| zid | imenica | da | 895 | 185 |
| papir | imenica | da | 839 | 150 |
| sir | imenica | da | 839 | 150 |
| krumpir | imenica | da | 839 | 150 |
| leptir | imenica | da | 839 | 150 |
| šešir | imenica | da | 839 | 150 |
| kruh | imenica | da | 590 | 78 |
| orah | imenica, glagol | da | 74 | 14 |
| okvir | imenica | da | 839 | 150 |
| svemir | imenica | da | 839 | 150 |
| klavir | imenica | da | 839 | 150 |
| mir | imenica | da | 839 | 150 |
| automobil | imenica | da | 623 | 125 |
| krokodil | imenica | da | 623 | 125 |
| miš | imenica | da | 830 | 35 |
| slatkiš | imenica | da | 830 | 35 |
| sluh | imenica | da | 590 | 78 |
| nož | imenica | da | 458 | 54 |
| čitati | glagol | da | 2995 | 254 |
| pisati | glagol | da | 2995 | 254 |
| gledati | glagol | da | 2995 | 254 |
| igrati | glagol | da | 2995 | 254 |
| pjevati | glagol | da | 2995 | 254 |
| plesati | glagol | da | 2995 | 254 |
| kuhati | glagol | da | 2995 | 254 |
| crtati | glagol | da | 2995 | 254 |
| čitaju | glagol | ne | 2223 | 103 |
| pjevaju | glagol | ne | 2223 | 103 |
| crtaju | glagol | ne | 2223 | 103 |
| kuhaju | glagol | ne | 2223 | 103 |
| velik | pridjev | da | 390 | 222 |
| lijep | pridjev | da | 1742 | 1300 |
| loš | pridjev | da | 608 | 366 |
| suh | pridjev | da | 590 | 320 |
| gluh | pridjev | da | 590 | 320 |
| plav | pridjev | da | 781 | 552 |
| zdrav | pridjev | da | 781 | 552 |
| lukav | pridjev | da | 781 | 552 |
| prav | pridjev | da | 781 | 552 |
| sretan | pridjev | da | 7513 | 5617 |
| miran | pridjev | da | 7513 | 5617 |
| veseo | pridjev | da | 137 | 115 |
| debeo | pridjev | da | 137 | 115 |
| topao | pridjev | da | 73 | 59 |
| duhovit | pridjev | da | 223 | 159 |
| jučer | prilog | da | 946 | 27 |
| navečer | prilog | da | 946 | 27 |
| prekjučer | prilog | da | 946 | 27 |
| naprijed | prilog | da | 404 | 15 |
| unaprijed | prilog | da | 404 | 15 |
| još | prilog | da | 608 | 20 |
| blizu | prilog, prijedlog | da | 707 | 13 |
| vani | imenica, prilog | da | 2085 | 91 |
| lani | glagol, prilog | da | 2085 | 91 |
| noću | imenica, prilog | da | 322 | 11 |
| usput | prilog | da | 3411 | 101 |
| dalje | imenica, pridjev, prilog | da | 1186 | 31 |
| dolje | prilog | da | 1186 | 31 |
| moj | zamjenica | da | 348 | 0 |
| tvoj | zamjenica | da | 348 | 0 |
| svoj | pridjev, zamjenica | da | 348 | 0 |
| taj | zamjenica | da | 115 | 0 |
| ovaj | zamjenica | da | 115 | 0 |
| pet | broj | da | 1483 | 0 |
| deset | broj | da | 1483 | 0 |
| devet | broj | da | 1483 | 0 |
| dvadeset | broj | da | 1483 | 0 |
| trideset | broj | da | 1483 | 0 |
| pred | prijedlog | da | 404 | 0 |
| ispred | prijedlog | da | 404 | 0 |
| pored | prilog, prijedlog | da | 404 | 0 |
| jer | veznik | da | 946 | 0 |
| kao | prilog, veznik | da | 73 | 0 |
| dok | imenica, prilog, veznik | da | 4204 | 0 |
| čak | prilog, cestica | da | 2694 | 0 |
| možda | prilog, cestica | da | 2549 | 1 |
| joj | zamjenica, uzvik | da | 348 | 1 |
| bum | imenica, uzvik | da | 2670 | 0 |

## Izvori i opseg

- Nikola Ljubešić (2019), [Inflectional lexicon hrLex 1.3](https://www.clarin.si/repository/xmlui/handle/11356/1232), CLARIN.SI. Izvorna datoteka preuzeta; MD5 potvrđen: `e55a21f10bbb4f6c22afe31a65803649`.
- Izvedeni popis riječi i pripadajući podaci iz hrLexa: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Izmjene: odabir 100 kandidata, filtriranje prema igri, izračun grafemskih završetaka i provjera nastavaka.
- Pregledan GitHub main na commitu `29dfd877d60edb471eb183f9295af26f6397b455`.
- [Uvoz i filteri](https://github.com/josipmestrovic/kaladont/blob/29dfd877d60edb471eb183f9295af26f6397b455/skripte/uvoz-rjecnika/src/hrlex.ts)
- [Rječnik i početni odabir](https://github.com/josipmestrovic/kaladont/blob/29dfd877d60edb471eb183f9295af26f6397b455/aplikacije/posluzitelj/src/rjecnik/ucitaj.ts)
- [Validacija poteza i kategorije](https://github.com/josipmestrovic/kaladont/blob/29dfd877d60edb471eb183f9295af26f6397b455/paketi/zajednicko/src/pravila.ts)
- [Grafemi](https://github.com/josipmestrovic/kaladont/blob/29dfd877d60edb471eb183f9295af26f6397b455/paketi/zajednicko/src/grafemi.ts)
- [Otvaranje runde i Kaladont efekt](https://github.com/josipmestrovic/kaladont/blob/29dfd877d60edb471eb183f9295af26f6397b455/aplikacije/posluzitelj/src/igra/motor-partije.ts)
- [Postavke privatnih soba](https://github.com/josipmestrovic/kaladont/blob/29dfd877d60edb471eb183f9295af26f6397b455/aplikacije/posluzitelj/src/soba/servis-soba.ts)
- [Sučelje privatnih soba](https://github.com/josipmestrovic/kaladont/blob/29dfd877d60edb471eb183f9295af26f6397b455/aplikacije/web/src/routes/soba/kreiraj/%2Bpage.svelte)

Prije konačnog odobrenja treba odabrati samo riječi čija je razina sigurnosti prihvatljiva, a ne prihvatiti oznaku „100” kao dokaz kvalitete. Ovaj dokument ostaje sadržajni pregled; ne propisuje tehničku implementaciju.
