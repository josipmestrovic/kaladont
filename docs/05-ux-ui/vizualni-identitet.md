# Vizualni identitet

## Koncept: retro „pasta za zube"

Kaladont je ime nekadašnje paste za zube — i igra to s ponosom nosi. Identitet je topla retro estetika ambalaže iz 60-ih/70-ih: krem podloge, mint svježina, crveni akcenti, zaobljeni oblici i mrvica nostalgije. Cilj osjećaja: *„ovo je ona igra iz auta, samo ljepša."*

## Paleta

| Uloga | Boja | Hex |
|---|---|---|
| Podloga (svijetla krem) | Krem | `#FAF3E3` |
| Primarna (mint) | Mint zelena | `#2FA98C` |
| Primarna tamna (tekst na mintu, naslovi) | Tamni mint | `#1D6F5C` |
| Akcent (upozorenja, timer, CTA detalji) | Retro crvena | `#E4572E` |
| Tekst | Gotovo crna | `#26221B` |
| Sekundarni tekst | Toplo siva | `#7A7264` |
| Isticanje slova (tražena dva grafema) | Žuta krema | `#F4C95D` |

Pravila upotrebe:

- Crvena je **rezervirana za napetost**: prsten timera, poruke eliminacije, gumb „Ne znam". Nikad za dekoraciju.
- Mint je boja akcije: gumb IGRAJ, potvrde, prihvaćeni potezi.
- Podloga je uvijek krem — jedna svijetla tema u MVP-u (tamna tema u [buduce-znacajke.md](../08-plan-razvoja/buduce-znacajke.md)).

## Tipografija

- **Naslovi i logotip:** zaobljeni geometrijski sans s retro karakterom (npr. *Baloo 2* ili sličan s potpunom podrškom hrvatskih dijakritika — š, đ, č, ć, ž obavezno provjeriti u svim rezovima).
- **Tekst i sučelje:** čitljiv humanistički sans (npr. *Inter*).
- **Riječ na stolu:** najveći element ekrana, verzal, s posljednja dva grafema otisnuta žutom kremom.

## Oblici i motivi

- Sve zaobljeno: kartice, gumbi (pill oblik), avatari (krug).
- Motiv **tube paste**: diskretno u logotipu i praznim stanjima (npr. tuba koja istiskuje slova).
- Stol je topla ovalna ploha (tamniji krem/mint), po uzoru na stolnjak — ne zeleni poker filc.

## Ton komunikacije

- Prijateljski, duhovit, kratak; hrvatski bez anglizama („Ajmo!" da, „Let's go" nikad).
- Poruke sustava su ljudske: umjesto „Greška 403" → „Ovo nije tvoj potez — pričekaj red."
- Eliminacija se priopćava s poštovanjem prema igraču, bez podsmijeha: „Nema riječi na 'nt' — Ana je izvela kaladont!"

## Avatari i borderi

**Avatari:** 8 predefiniranih apstraktnih vektorskih dizajna (oblici/simboli u paleti boja, ne fotografije ni ilustracije životinja) — bez uploada slika (nula moderacije).

- **Gost:** dobiva nasumičan avatar automatski pri stvaranju, bez pitanja i bez mogućnosti promjene; nosi diskretnu oznaku „GOST" i nikad nema border.
- **Registriran:** bira avatar u `/postavke`, promjenjivo u svakom trenutku (`PUT /profil/avatar`).

**Borderi:** 10 komada, 1:1 s rang-imenima (Prvopisac/Riječarac/Jezičar/Lektor/Književnik/Jezikoslovac/Doktor riječi/Jezični maestro/Gospodar riječnika/Kaladont — vidi [bodovanje-i-rangovi.md](../02-pravila-igre/bodovanje-i-rangovi.md)). Border se **računa i primjenjuje automatski** prema trenutnom rangu igrača — nikad se ne bira ručno. Igrači u kalibraciji („Piskaralo", < 10 partija) nemaju border. Najviši border (Kaladont) jedini koristi motiv tube paste — vizualna kruna ljestvice.
