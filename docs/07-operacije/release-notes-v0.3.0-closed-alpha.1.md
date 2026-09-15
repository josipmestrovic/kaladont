# Kaladont Multiplayer v0.3.0 – Closed Alpha 1

Treće zatvoreno izdanje objedinjuje trajni XP, dostignuća, mode-aware rangove i Kaladont DNK profil. Javni modovi za četiri i dva igrača sada imaju odvojene agregate, a završetak partije jasno prikazuje ostvareni napredak.

## Novo

### XP, razine i dostignuća

- Svaka prihvaćena riječ, duga ili rijetka riječ, izazvana eliminacija i pobjeda donose XP.
- Kaladont donosi posebnih 100 XP, a najbolji streak povećava osvojeni XP.
- Dodano je devet trajnih dostignuća s ukupno 45 razina/zvjezdica.
- Dostignuća se obračunavaju server-side i spremaju transakcijski na kraju partije.
- Vlastiti i javni profil imaju poglede Statistika, Dostignuća, Riječi i Povijest.
- Privatne sobe ne dodjeljuju XP ni javne bodove, ali podržavaju napredak dostignuća riječi gdje je to dopušteno.

### Kaladont DNK

- Nakon 10 javnih igara otključava se profil igre Kaladont DNK.
- DNK prikazuje šest osi: Vještina, Taktika, Fokus, Brzina, Duge riječi i Rijetke riječi.
- Četiri igrača i 1v1 imaju odvojene statistike, pragove, rangove i DNK profile.
- Taktika koristi ocjene Pacifist, Dobrica, Taktičar, Napadač i Agresivac.
- Brzina koristi stvarni prosjek trajanja prihvaćenih poteza, spremljen odvojeno po modu.
- Na kraju partije se za igrača prikazuje kompaktni DNK graf i samo promjene osi, sa starom vrijednošću, strelicom i novom vrijednošću.
- `n / 10` napredak prikazuje se samo dok DNK nije otključan; nakon otključavanja prikazuje se potvrda bez brojača.
- Povijesne vrijednosti trajanja poteza backfillane su iz postojećih zapisa poteza.

### Završetak partije i UX

- Nakon završnog countdowna prikazuje se aplikacijski header i konačni rezultati.
- Završni ekran prikazuje DNK napredak, novo otključana dostignuća, XP obračun, plasmane i povijest poteza.
- DNK delta prikaz je responsivan: graf je lijevo na desktopu, a iznad popisa promjena na mobitelu.
- Red čekanja ima eksplicitnu sinkronizaciju stanja za 2-player i 4-player mod, što sprječava prazan ekran nakon navigacije bez refresha.
- Dodani su pomoćni ekrani i poboljšani javni/vlastiti profil, privatne sobe i ekran „Što je novo“.

## Što testirati

1. Odigraj javnu partiju i provjeri XP obračun, plasmane i nova dostignuća nakon countdowna.
2. Otvori profil nakon nekoliko igara i provjeri da se Brzina puni stvarnim prosjekom trajanja poteza.
3. Provjeri odvojene DNK/rang statistike za 4 igrača i 1v1.
4. Odigraj desetu javnu partiju i provjeri da se DNK otključava bez prikaza `n / 10` brojača.
5. Nakon otključavanja provjeri kompaktni radar i delta vrijednosti na desktopu i mobitelu.
6. Uđi u oba reda čekanja nakon završetka partije i provjeri da sadržaj nije prazan bez refresha.
7. Otvori vlastiti i javni profil te provjeri LVL, dostignuća, DNK graf i povijest.
8. Pokreni privatnu sobu i provjeri da se javni XP, rangovi i javni agregati ne mijenjaju.

## Poznata ograničenja

- XP i dostignuća vrijede prema pravilima javnog/privatnog moda; privatne sobe ne daju javne bodove ni XP.
- Razina 100 je trenutačni maksimum.
- Ograničenja closed alpha izdanja i dalje vrijede; staging treba provjeriti prije dijeljenja testerima.

Status: `kandidat`