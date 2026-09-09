# Opseg MVP-a

Jedina svrha MVP-a: **provjeriti hoće li ljudi igrati**. Sve što tome ne pridonosi izravno — ne ulazi.

## Ulazi u MVP

| Značajka               | Napomena                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Igra kao gost          | Jedan klik s landinga, generirano ime, trajni anonimni ID                                                      |
| Zajednički red čekanja | Samo ljudi, točno 4; real-time popunjavanje s imenima + prosjek čekanja zadnjih 100 partija                    |
| Partija 4 igrača       | 30 s po potezu, ispadanje, bodovi (plasman + eliminacije + bonus), emoji reakcije, promatranje nakon ispadanja |
| Registracija           | Email + lozinka; gost postaje račun bez gubitka statistike                                                     |
| Rangovi                | Prikazni (Prvopisac → Kaladont), nakon 10 kalibracijskih partija                                               |
| Javna ljestvica        | Top 100 po prosjeku bodova                                                                                     |
| Vlastiti profil        | Statistika, zadnje partije                                                                                     |
| Povijest partije       | Svi potezi; dostupna tijekom i nakon igre                                                                      |
| Prijave grešaka        | S poteza u povijesti; baza + email notifikacija                                                                |
| Admin stranica         | Prijave sa statusima, dodavanje/uklanjanje riječi                                                              |
| Mjerenje               | Vlastite metrike izvedene iz podataka igre                                                                     |
| Statične stranice      | Pravila, O igri (atribucija hrLex), Privatnost, Uvjeti                                                         |

## Svjesno NE ulazi u MVP

| Značajka                            | Zašto ne                                                                         | Gdje je zapisano                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Matchmaking po rangu                | Premala baza igrača — fragmentirao bi red                                        | [ADR-008](../03-arhitektura/odluke/008-bez-matchmakinga-u-mvp.md) |
| Botovi                              | Rizik povjerenja zajednice                                                       | ADR-008                                                           |
| Tekstualni chat                     | Trošak moderacije                                                                | [pravila-igre.md](../02-pravila-igre/pravila-igre.md)             |
| Monetizacija                        | Prvo dokaz retencije                                                             | [vizija-proizvoda.md](vizija-proizvoda.md)                        |
| Privatne sobe / igra s prijateljima | Nakon validacije javne igre                                                      | [buduce-znacajke.md](../08-plan-razvoja/buduce-znacajke.md)       |
| Javni profili drugih igrača         | Minimalna vrijednost za test                                                     | —                                                                 |
| Mobilne aplikacije                  | Mobile-first web pokriva potrebu                                                 | —                                                                 |
| Turniri, prijatelji, poruke         | v2+                                                                              | buduce-znacajke.md                                                |
| Oporavak gost-računa                | Trajnost je pogodnost registracije                                               | RS-19                                                             |
| Web analitika (Umami)               | Vlastite metrike dovoljne su za javni start; Umami se dodaje nakon stabilizacije | [ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md) |

## Definicija gotovog MVP-a

MVP je gotov kada nepoznat čovjek na mobitelu može: doći na kaladont.hr → kliknuti IGRAJ → odigrati cijelu partiju s tri druga čovjeka → vidjeti svoj plasman i bodove → registrirati se i zadržati statistiku → prijaviti riječ koja ne treba biti u rječniku ili koja nedostaje u rječniku
