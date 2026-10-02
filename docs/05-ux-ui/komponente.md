# Komponente (Figma dizajn-sustav brief)

Ovaj dokument je ulazni brief za Figma agenta u fazi Brandinga i Wireframea — inventar svega što treba postojati kao komponenta prije sastavljanja ekrana iz [ekrani.md](ekrani.md). Vizualni jezik: [vizualni-identitet.md](vizualni-identitet.md).

## Stilovi (postaviti prije komponenti)

- **Boje:** svih 7 uloga iz palete u vizualni-identitet.md kao Figma color styles.
- **Tipografija:** H1/H2/H3, tijelo (regular/bold), sitni tekst, „riječ na stolu" (poseban veliki stil) — kao Figma text styles.
- **Razmaci:** skala 4/8/12/16/24/32/48 px.
- **Zaobljenost:** kartice/paneli 16px, gumbi (pill) 999px, avatari krug.
- **Sjene:** jedna razina suptilne sjene za kartice/modale (nema teških dropshadowa — retro ravni stil).

## Atomi

| Komponenta | Varijante | Stanja |
|---|---|---|
| Gumb | primary (mint), secondary (obrub), danger (crvena) | default, hover, disabled, loading |
| Input tekst | jednoredni | default, focus, error (crveni obrub, blaga podloga, podrhtavanje + poruka ispod) |
| Avatar | prikazuje spremljeni sastavljeni izgled (`avatarConfig`); gost bez vlastite konfiguracije prikazuje oznaku GOST umjesto statičnog avatara, a gost s konfiguracijom zadržava oznaku GOST i nema rang-border | s borderom (10 varijanti po rangu), bez bordera |
| RangBadge | 10 rangova + „Piskaralo" | — |
| WordChip | riječ + istaknuta zadnja dva grafema (žuta krema) | — |
| Ikona | sat, pošalji, ne-znam, izlaz, prijavi, zatvori, postavke, provjeri | 24px, jedna boja (nasljeđuje tekst boju) |

## Molekule

| Komponenta | Opis |
|---|---|
| IzbornikBrzihPoruka | Mali animirani izbornik sidren uz vlastito sjedalo; 4 okomite varijante: 👋 Prijatno, 😅 Nemoj zamjerit, 👏 Bravo!, 😎 Hvala; odabrana reakcija prikazuje se ispod imena |
| WordBubble | Jedan bubble za zadnju prihvaćenu igračku riječ, sidren neposredno iznad avatara autora; veći tekst, narančasto istaknuta zadnja dva grafema, stabilan prikaz i manji font za duge riječi |
| CountdownRing | SVG prsten oko avatara, prazni se 30s, prikazuje preostale sekunde u kontrastnoj sredini, prati zelenu shemu aktivnog sjedala, jače se oglasi pri dolasku reda i pulsira zadnjih 5 s |
| SjedaloKartica | avatar + rang bedž + ime + status; aktivno sjedalo ima debeli zeleni okvir i label „Na redu!”, reakcija je sidrena neposredno iznad avatara s visokim slojem, vlastito sjedalo jedna je klikabilna cjelina, a primljena reakcija nakratko podigne avatar |
| GlobalneObavijesti | plutajući stupac s VezaObavijest i CitanjeNaglasObavijest; poruke ostaju zasebne, jedna ispod druge, a govorna obavijest prikazuje procjenu platforme, dostupnost hrvatskog glasa, poveznicu na pomoć i akciju „Razumijem” |
| Toast/Alert | uspjeh (mint), greška (crvena), info (neutralno) — auto-nestaje 2s ili traje dok se ne zatvori |
| Modal/Dijalog | naslov + tijelo + 2 akcije (potvrdi/odustani) — koristi se za potvrdu izlaska i prijavu greške |
| EliminacijaKartica | poruka + tko dobiva bod + gumb Prijavi |

## Organizmi

| Komponenta | Opis |
|---|---|
| Header | ne prikazuje se na naslovnici, čekaonici ni ruti partije; drugdje prikazuje akcije „Nazad” i uvjetno „Početna”, a desno horizontalni profilni blok. Admin dodatno vidi zasebnu navigaciju Rječnik, Prijave i Mišljenja korisnika. |
| Stol | ovalni vektorski stol + 4 SjedaloKartica u luku + WordChip u sredini + CountdownRing na aktivnom; klijent vlastito sjedalo prikazuje prvo, a sjedalo igrača na potezu neposredno desno od njega |
| RedCekanjaPrikaz | 4 kružna mjesta, tekst stanja, prosjek čekanja |
| PovijestLista | redak po potezu: runda, igrač, riječ/razlog, trajanje, gumb Prijavi |
| AvatarEditor | jedini editor avatara, na `/profil/avatar`. Lijevo lijepljiv stupac: avatar, osam nativnih biračâ boja i akcije (Nasumični avatar, Odustani, Spremi). Desno kategorije dijelova s brojačem i mrežica izbora u kojoj svaka kartica prikazuje cijeli avatar s tim dijelom; kartice nemaju vidljiv tekst, naziv ide u `aria-label` i tooltip. Neobavezne kategorije imaju karticu „Bez dodatka”, a Naušnice nestaju dok su uši „Odvojene”. Uz `?registracija=1` nosi naslov „Stvori avatar” i gumb „Završi registraciju”. |

## Asseti (van standardnih Figma shapeova)

- Vektorski stol (pozadina) — ovalni oblik + tekstura.
- Logotip + motiv tube paste.
- 8 avatar dizajna (apstraktni oblici/simboli, dosljedna paleta).
- 10 border dizajna (prsten/okvir oko avatara, eskalacija Prvopisac→Kaladont, zadnji s motivom tube).

## Redoslijed sastavljanja u Figmi

1. Stilovi (boje, tipografija, razmaci).
2. Atomi.
3. Molekule.
4. Organizmi.
5. Screens (vidi ekrani.md za redoslijed po prioritetu).
