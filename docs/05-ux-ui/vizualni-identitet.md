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
- Postoje dvije teme. **Tamna je zadana**: podloga je mint `#1D6F5C`, tekst bijel, padajuća slova u pozadini bijela. Svijetla (krem) tema je opcija koju igrač bira prekidačem u glavnoj navigaciji; izbor se pamti u `localStorage` (`kaladont_tema_v1`).
- Na mint podlozi retro crvena (`#E4572E`) ima kontrast 1,6:1 i nije upotrebljiva. U tamnoj temi akcent je posvijetljen na `#FFB3A0` za grafiku i veći tekst, odnosno `#FFD9CC` za sitni tekst. Isto vrijedi za žutu: `#F4C95D` samo za velik tekst, `#F8DD9A` za sitni.
- Gumb IGRAJ u tamnoj temi ima žutu kremu kao ispunu s tamnim tekstom — mint na mintu nestaje.
- Ikone iz `static/ikone/` crtane su krem i mint paletom i nemaju tamnu varijantu, zato u tamnoj temi stoje na svijetloj „pločici" (`--boja-plocica`).
- Admin sučelje (`/admin`) uvijek se prikazuje u svijetloj temi.

## Tipografija

- **Naslovi i logotip:** zaobljeni geometrijski sans s retro karakterom (npr. *Baloo 2* ili sličan s potpunom podrškom hrvatskih dijakritika — š, đ, č, ć, ž obavezno provjeriti u svim rezovima).
- **Tekst i sučelje:** čitljiv humanistički sans (npr. *Inter*).
- Korisnik može uključiti OpenDyslexic kao opcionalni font za cijelo sučelje. Provjeriti prikaz hrvatskih dijakritika i svih rezova fonta; izbor ne mijenja veličine ni zadanu tipografiju.
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

**Avatari:** igrač slaže avatar iz modularnih SVG dijelova u editoru na `/profil/avatar`. To je **jedini** editor avatara u aplikaciji — na njega vode i zadnji korak registracije i „Uredi avatar" u profilu i postavkama. Konfiguracija se sprema kao `avatarConfig` (`PUT /profil/avatar`) i odmah se vidi u zaglavlju i za stolom. Stari statički katalog JPG slika u `aplikacije/web/static/avatari/` ostaje samo kao zamjena za račune bez konfiguracije.

- **Gost:** ima pristup istom editoru i mijenja avatar kad god želi. Nosi diskretnu oznaku „GOST" preko avatara i **nikad** nema border.
- **Registriran:** isti editor, bez oznake „GOST", s borderom prema rangu.

**Editor:** lijevo je lijepljiv stupac s avatarom, osam biračâ boja (koža, kosa, odjeća, oči, obrve, naočale, naušnice, brada) i akcijama; desno su kategorije dijelova i mrežica izbora u kojoj svaka kartica prikazuje **cijeli avatar** s tim dijelom primijenjenim. Kartice nemaju vidljiv tekst — naziv dijela ide u `aria-label` i tooltip. Neobavezne kategorije imaju karticu „Bez dodatka".

**Borderi:** 10 komada, 1:1 s rang-imenima (Prvopisac/Riječarac/Jezičar/Lektor/Književnik/Jezikoslovac/Doktor riječi/Jezični maestro/Gospodar rječnika/Kaladont — vidi [bodovanje-i-rangovi.md](../02-pravila-igre/bodovanje-i-rangovi.md)). Border se **računa i primjenjuje automatski** prema trenutnom rangu igrača — nikad se ne bira ručno. Igrači u kalibraciji („Piskaralo", < 10 partija) nemaju border. Najviši border (Kaladont) jedini koristi motiv tube paste — vizualna kruna ljestvice.
