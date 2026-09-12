# Tijek korisnika

## Glavni tok: od dolaska do partije (gost)

```mermaid
flowchart TD
    A[Landing kaladont.hr] -->|klik IGRAJ| B{Ima li gost ID?}
    B -->|ne| C[Stvori gosta: UUID + generirano ime]
    B -->|da| D[Učitaj identitet]
    C --> Z{Prošao onboarding?}
    D --> Z
    Z -->|ne, gost prvi put| W[Dobrodošlica: ime → avatar]
    W --> E[Red čekanja]
    Z -->|da / registriran| E
    E -->|4 igrača| F[Stol — partija]
    E -->|odustani| A
    F -->|eliminacija| G[Promatranje stola]
    F -->|pobjeda ili kraj| H[Ekran kraja partije]
    G -->|kraj partije| H
    G -->|izlaz| A
    H -->|Igraj opet| E
    H -->|Povijest partije| I[Povijest poteza]
    I -->|Prijavi grešku na potezu| J[Obrazac prijave]
```

Ključna svojstva:

- **Jedan klik do reda:** bez lobbyja, bez odabira sobe, bez postavki.
- Gost ID stvara se tiho — igrač ne ispunjava ništa za to. Ime i avatar bira jednom, pri prvom ulasku (`/dobrodoslica`), prije prvog reda čekanja.
- „Igraj opet" vraća u red čekanja s istim identitetom.

## Registracija (u bilo kojem trenutku)

```mermaid
flowchart LR
    A[Gost sa statistikom] -->|Registriraj se| B[Email + lozinka + nadimak]
    B --> C[Potvrdni email]
    C --> D[Račun — ista statistika, isti ID]
```

- Poziv na registraciju prikazuje se **nakon partije** (najjača motivacija: „Sačuvaj svojih X bodova — registriraj se"), nikad kao prepreka prije igre.
- Registracija je `UPDATE` gostova zapisa — statistika, kalibracija i povijest ostaju (RS-20).
- Prijava na drugom uređaju: standardni email + lozinka.

## Prijava greške

```mermaid
flowchart LR
    A[Potez u povijesti] -->|Prijavi| B[Obrazac: poruka igrača]
    B --> C[Spremljeno + email nama]
    C --> D[Zahvala igraču]
```

Dostupno svima (i gostima) — prijave su dar, ne privilegija računa.

## Rukovanje prekidima

- Pad veze u **redu čekanja**: mjesto se oslobađa, ostali vide promjenu u real-timeu (RS-16).
- Pad veze u **partiji**: poslužitelj čeka povratak istog identiteta 10 sekundi, bez zaustavljanja timera poteza (RS-09/RS-10); nakon isteka tolerancije igrač ispada i po povratku vidi stol kao promatrač.
- Povratak na otvorenu karticu nakon spavanja mobitela: klijent traži `partija:stanje` i obnavlja prikaz iz jedne poruke.
