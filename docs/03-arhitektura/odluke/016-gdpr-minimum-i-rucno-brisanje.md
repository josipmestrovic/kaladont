# ADR-016: GDPR minimum i ručno brisanje računa

- **Status:** prihvaćen
- **Datum:** 2026-09-17

## Odluka

Kaladont objavljuje kratku obavijest o privatnosti na `/privatnost`. Zahtjevi za brisanje, pristup i ispravak podataka šalju se na `info@kaladont.hr` s registrirane email adrese. Operater zahtjev obrađuje ručno u roku do 7 dana.

Pri brisanju se uklanjaju email, hash lozinke, potvrda emaila, aktivne sesije i privatni napredak računa. Zapis igrača ostaje zbog stranih ključeva i zajedničke povijesti igre, ali se anonimizira neutralnim nadimkom `Obrisani igrač`, neutralnim avatarom i oznakom `obrisan_at`.

Zajedničke partije, potezi, plasmani i prijave ne brišu se jer bi njihovo brisanje promijenilo povijest i podatke drugih igrača. Obrisani igrač više ne može pristupiti računu, javnom profilu, HTTP zaštićenim rutama ni Socket.IO vezi.

## Podaci i rokovi

- sesijski tokeni: najviše 30 dana;
- IP i sigurnosni logovi: 30 dana;
- email komunikacija o zahtjevu: 12 mjeseci;
- anonimizirana povijest partija: dok je potrebna za integritet igre;
- backup kopije: prema redovnoj operativnoj retenciji.

Ne pohranjuju se IP, user-agent ili naziv uređaja u računu. Backup se ne mijenja pojedinačnim ručnim zahtjevom, nego se podaci uklanjaju kroz redovnu rotaciju kopija.

## Voditelj obrade

Voditelj obrade je **piši farmaceut, obrt za računalno programiranje, vl. Josip Meštrović**, Braće Radić 25, 31550 Bizovac, Hrvatska, OIB 21287408231, MBS 99294702. Kontakt za zahtjeve je `info@kaladont.hr`.

## Posljedice

Zahtjev nije samoposlužan i ne postoji javni endpoint za brisanje. Operater nakon provjere pošiljatelja pokreće zaštićeni CLI s eksplicitnom potvrdom. Operacija je ponovljiva i ne smije ispisivati lozinke, tokene ni nepotrebne osobne podatke.
