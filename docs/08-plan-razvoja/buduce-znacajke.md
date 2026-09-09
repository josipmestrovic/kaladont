# Buduće značajke (nakon MVP-a)

Ništa odavde ne ulazi u MVP. Redoslijed će odrediti stvarni podaci ([metrike-uspjeha.md](../01-proizvod/metrike-uspjeha.md)) i povratne informacije igrača.

## Nakon lansiranja: stabilizacija

| Značajka                        | Bilješka                                                                                                                 | Preduvjet                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Umami analitika**             | Self-hosted, cookieless mjerenje izvora prometa te klikova na „IGRAJ” i forum; dodaje se kao zaseban produkcijski servis | Stabilan javni rani pristup i provjeren backup/nadzor postojećeg stacka |
| **Dinamička najava održavanja** | Admin zada poruku i termin bez posebnog deploya; do tada se banner objavljuje prethodnim redovnim izdanjem               | Dogovoren model administrativnih postavki                               |

## Visok prioritet (kandidati za v2)

| Značajka                         | Bilješka                                                                                | Priprema već postoji                                            |
| -------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Matchmaking po rangu**         | Nova strategija uparivanja: četvorica sličnog prosjeka; širenje raspona s čekanjem      | Sučelje strategije + svi podaci u `sudionici_partije` (ADR-008) |
| **Privatne sobe**                | Igra s prijateljima preko koda/poveznice — najtraženija značajka ovakvih igara          | Sobe već postoje tehnički; treba samo tok stvaranja             |
| **Kalibracija pragova rangova**  | Prva revizija nakon 4 tjedna podataka; možda percentilni rangovi (top 0,5 % = Kaladont) | Rang se računa pri prikazu — promjena bez migracije             |
| **Elegantno gašenje pri objavi** | Novi deployi čekaju kraj aktivnih partija umjesto prekida                               | —                                                               |

## Srednji prioritet

- **Zvukovi** (tik-tak zadnjih 5 s, zvuk eliminacije) s gumbom za isključenje.
- **Tamna tema** — druga paleta identiteta.
- **Statistika riječi** na profilu: najdulja riječ, omiljeni završetci, „kaladont" izvedbe.
- **Oporavak gost-računa** vezanjem emaila bez pune registracije.
- **Brojač odbijenih pokušaja** po potezu (podatak za balans i anti-cheat).

## Nizak prioritet / ideje

- Turniri (večernji, vikend-lige) s posebnim značkama.
- Sezone ljestvice (kvartalne) s resetom i nagradnim značkama.
- Dnevni izazov: jedna zadana početna riječ za sve, ljestvica dana.
- Emoji proširenja, animirani avatari.
- Prijateljstva i pozivnice (tek uz privatne sobe).
- Detekcija botova iz `trajanje_ms` obrazaca (RS-24) ako se pojavi problem.
- Višejezičnost sučelja — `poruke.ts` je već centraliziran, ali igra je po prirodi hrvatska; niska vjerojatnost.

## Eksplicitno odbačeno (da se ne vraćamo bez novog razloga)

- **Botovi u javnom redu** — povjerenje > brzina (ADR-008).
- **Tekstualni chat** — trošak moderacije nadmašuje vrijednost uz emoji reakcije.
- **Oglasi prije dokazane retencije** — ubili bi test tržišta.
