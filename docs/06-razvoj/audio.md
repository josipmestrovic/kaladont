# Razvoj zvukova

> **Status:** implementirano. UX ugovor je u [zvukovi.md](../05-ux-ui/zvukovi.md).

## Vlasništvo nad reprodukcijom

Buduća implementacija koristi jedan browser-only modul:

```text
aplikacije/web/src/lib/audio-manager.ts
```

Komponente ne stvaraju vlastite `Audio` objekte i ne pozivaju reprodukciju izravno. Audio manager je jedini vlasnik:

- učitavanja i cacheiranja asseta;
- mute i volume postavke;
- `localStorage` ključa `kaladont_audio_postavke_v1`;
- aktivacije nakon korisničke akcije (bilo koji klik/tipka bilo gdje u appu naoružava zvuk, ne samo dodir audio kontrole — `aktiviran` flag je in-memory i resetira se na svaki refresh);
- hvatanja `HTMLAudioElement.play()`/autoplay grešaka;
- cooldowna i deduplikacije događaja;
- SSR-safe ponašanja.

Predloženi javni API:

```text
inicijaliziraj()
aktiviraj()
pusti(zvuk)
postaviVolumen(vrijednost)
postaviGlasnocu(vrijednost) — kao postaviVolumen, ali dodatno skida mute (npr. pomak slidera dok je utišano)
postaviUtišano(utišano)
dohvatiVolumen()
jeUtišano()
```

Audio manager ne smije rušiti UI ako browser nema dostupan audio uređaj ili odbije reprodukciju.

## Asseti

Planirana lokacija je:

```text
aplikacije/web/static/zvukovi/
```

Imena trebaju biti semantička i bez vezanja uz osobu ili biblioteku, primjerice:

```text
ulazak-u-sobu.wav
izlazak-iz-sobe.wav
odbrojavanje-single-count-sound.wav
pocetak-partije.wav
pred-istek-vremena.wav
potez-prihvacen.wav
potez-odbijen-1.wav
potez-odbijen-2.wav
potez-odbijen-3.wav
tvoj-red.mp3
eliminacija.wav
nova-runda.wav
partija-kraj.mp3
klik-misa.wav
hover-efekt.wav
```

Svaki asset mora imati poznatu licencu ili biti izrađen za Kaladont. Ne kopirati prepoznatljive zvukove iz drugih igara, filmova ili aplikacija. Za svaki vanjski asset zapisati izvor, licencu i datum provjere izvan koda ili u kratkoj audio licenci uz assete.

Asseti trebaju biti kratki, normalizirane glasnoće i dovoljno mali za web. Ne dodavati pozadinsku glazbu bez nove UX odluke.

## Mjesta integracije

- `Header.svelte`: mute i volume kontrola.
- `AudioKontrola.svelte`: inicijalizira postavke i globalne UI klik/hover listenere (jednom, idempotentno) za sve gumbe i linkove u aplikaciji (`app.css` dodaje prateći hover opacity).
- `red/+page.svelte`: ulazak/izlazak, odbrojavanje po sekundi i početak partije.
- `partija/[id]/+page.svelte`: Socket.IO događaji za potez, eliminaciju, novu rundu; kraj partije pušta se tek na prikazu konačnih rezultata.
- `TimerPrsten.svelte`: upozorenje pred istek poteza kad prsten uđe u zadnjih 5s.
- `stanje-igre.svelte.ts`: semantičko stanje i zaštita od ponovnog okidanja.
- `socket.ts`: lifecycle veze; ne stavljati rasute audio pozive ovdje.
- `paketi/zajednicko/src/protokol.ts`: izvor tipiziranih događaja, bez promjene protokola ako postojeći događaji nose dovoljno podataka.

## Testiranje

Unit testovi audio managera trebaju pokriti:

- zadanu glasnoću i učitavanje iz `localStoragea`;
- spremanje promjene volumea i mutea;
- volume 0;
- odbijeni `play()` bez rušenja aplikacije;
- cooldown;
- deduplikaciju istog semantičkog događaja;
- SSR okruženje bez `window`, `document` i `localStorage`.

Integracijski testovi trebaju potvrditi:

- dva ista `red:stanje` događaja daju jedan ulazni/izlazni signal;
- reconnect ne proizvodi lažni ulazak;
- odbijena riječ svira samo autoru poteza;
- prihvaćena riječ svira samo autoru poteza;
- `tvoj-red` svira samo jednom pri prijelazu;
- eliminacija i nova runda sviraju svima jednom;
- kraj partije ne svira više puta.

Ručno na desktopu i mobitelu provjeriti prvi klik, mute, refresh postavke, ulazak/izlazak, countdown, prihvaćenu i odbijenu riječ, red, eliminaciju, novu rundu i kraj partije u više sesija.

Ne testirati samo postoji li zvuk; testirati i kome se zvuk reproducira.
