# ADR-008: Bez matchmakinga u MVP-u

- **Status:** prihvaćen
- **Datum:** 2026-08-20

## Kontekst

Partija zahtijeva točno 4 igrača. S malom početnom bazom korisnika, dijeljenje reda čekanja po rangovima drastično bi produljilo čekanje — a dugo čekanje je najveći pojedinačni ubojica novih igara. Istodobno, rangove i statistiku želimo od prvog dana.

## Odluka

MVP ima **jedan zajednički red čekanja** za sve (gosti i registrirani zajedno): prva četvorica ulaze za stol. Čeka se **isključivo ljude** — bez botova i bez fleksibilne veličine stola. Ekran čekanja u real-timeu prikazuje popunjavanje mjesta (s imenima) i prosječno čekanje zadnjih 100 partija. Rang je čisto prikazni status. Uparivanje je izdvojeno kao **zamjenjiva strategija** u modulu reda — buduće rang-uparivanje mijenja samo funkciju izbora, ne shemu ni protokol.

## Razmotrene alternative

- **Rang-uparivanje odmah** — fragmentira premali bazen igrača.
- **Botovi za popunu** — brže partije, ali riskiraju povjerenje male zajednice; odbačeno.
- **Fleksibilan stol 2–4** — mijenja bodovanje i degradira doživljaj „u krug".

## Posljedice

- Iskusni i novi igrači igrat će zajedno — prihvaćeno kao cijena kratkog čekanja.
- Svi podaci za buduće uparivanje (plasmani, bodovi, eliminacije po partiji) skupljaju se od prvog dana u `sudionici_partije`.
- Transparentnost čekanja (imena + prosjek) pretvara čekanje u dio doživljaja umjesto u crnu kutiju.


Što ako nema dovoljno igrača?

Recimo u 03:00 imate:

Josip

i nitko drugi ne dolazi.

Ako nema botova i nema 2-player stola, korisnik može čekati beskonačno.

Zato bih u UX-u imao barem:

Čeka se još 3 igrača


Prosječno čekanje: 18 s


[ Izađi iz reda ]

I možda kasnije:

"Trenutno nema dovoljno igrača. Pokušajte ponovno kasnije."

Ne bih u MVP-u zbog toga uvodio botove ili fleksibilan stol. Samo bih jasno komunicirao stanje.