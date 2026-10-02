# Kaladont Multiplayer v0.4.0 – Closed Alpha 1

Četvrto zatvoreno izdanje donosi osobnije avatare, dodatni XP za niz pobjeda i pravednije početke rundi. Uvodi i lakši povratak u račun, povratne informacije te sigurniji staging tok.

## Novo

### Avatar po tvojoj mjeri

- Pri registraciji možeš sastaviti avatar birajući izgled i boje.
- Avatar možeš uređivati i kasnije u profilu; Nasumično predlaže novu kombinaciju.
- Novi prikaz zadržava isti avatar u profilu, čekaonici i partiji.

### Niz pobjeda donosi dodatni XP

- Uzastopne pobjede donose sve veći postotni bonus na XP za osvojenu javnu partiju.
- Bonus počinje od druge pobjede zaredom: +10 % u Četveroboju i +5 % u Dvoboju.
- Nizovi se prate zasebno po načinu igre, a bonus raste do najviše +100 %.
- U profilu i redu vidiš trenutačni niz i bonus koji bi donijela sljedeća pobjeda.
- Bonus pobjedničkog niza odvojen je od niza prihvaćenih riječi unutar partije.

### Lakši povratak i sigurniji račun

- Ako zaboraviš lozinku, možeš zatražiti poveznicu za njezinu promjenu; promjenu emaila dovršavaš potvrdom na novoj adresi.
- Odjava poništava samo trenutačnu sesiju. Prijava na drugom uređaju ostaje odvojena.
- Za pristup, ispravak ili brisanje računa možeš se javiti s registrirane email adrese; brisanje obrađuje se ručno, a zajednička povijest partija ostaje očuvana.

### Pošteniji početak runde

- Početna riječ bira se iz odobrenog skupa tako da svaki dopušten prvi odgovor ima barem jedan slobodan nastavak.
- Ako takva riječ nije dostupna, pričuvni odabir jamči barem jedan valjan odgovor.
- Provjera uzima u obzir već odigrane oblike i vrijedi i u privatnim partijama.

### Pošalji svoje mišljenje

- Registrirani igrači mogu poslati povratnu informaciju i pri prvom slanju ocijeniti pravila, rječnik, vrijeme poteza, snalaženje, brzinu učitavanja i gamifikaciju.
- Svaka povratna informacija napreduje dostignuće **Glas zajednice**, koje ima pet razina.

### Pouzdanija objava na staging

- Nakon zelenog CI-ja Docker slika objavljuje se u GHCR-u, a staging workflow postavlja isti digest i provjerava health.
- Operater i dalje ručno provodi staging checklistu; automatizirani deploy sam po sebi ne znači da je izdanje staging-provjereno.

## Što testirati

1. Sastavi avatar pri registraciji, zatim ga promijeni u profilu i provjeri ga u čekaonici i partiji.
2. Ostvari pobjednički niz zasebno u Dvoboju i Četveroboju te usporedi prikazani bonus.
3. Provjeri reset lozinke, potvrdu promjene emaila i odjavu jedne sesije bez odjave drugog uređaja.
4. Zatraži novu rundu i provjeri da odabrana početna riječ ima dopušten nastavak.
5. Pošalji povratnu informaciju kao registrirani igrač i provjeri napredak Glasa zajednice.

## Poznata ograničenja

- Ovo je zatvoreno alpha izdanje namijenjeno ograničenoj grupi testera; produkcijsko okruženje nije dio ove bilješke.
- Zahtjev za brisanje računa obrađuje se ručno, nije samoposlužna radnja u sučelju.
- Povratnu informaciju i početnu anketu mogu slati samo registrirani igrači.

## Tehnički podaci

Oznaka izdanja je ljudska oznaka. Puni commit SHA, GHCR digest, workflow i operativni status dopunjuju se iz službenog CI/GHCR zapisa i release evidencije; ova bilješka ih ne potvrđuje.