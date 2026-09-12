# Zvukovi u sučelju

> **Status:** implementirano. U prvoj verziji nema pozadinske glazbe.

## Cilj

Zvuk je suptilan signal da se dogodila promjena važna igraču. Ne smije zamijeniti vizualnu informaciju, ometati razmišljanje ili stvarati buku u multiplayeru. Svaki efekt ima jasnu publiku: osobni događaji sviraju samo igraču kojeg se tiču, a zajednički događaji svima u sobi/partiji.

## Kontrola zvuka

Globalna kontrola sastoji se od:

- ikone mute/unmute;
- klizača glasnoće od 0 do 100 %;
- `aria-label` opisa i potpore tipkovnici;
- stabilne širine da se zaglavlje ne pomiče pri promjeni stanja.

Postavka se sprema lokalno po browseru/uređaju u verzionirani ključ, primjerice `kaladont_audio_postavke_v1`. Ne sprema se na poslužitelj i ne veže se uz račun.

Audio se diskretno aktivira nakon prve korisničke akcije. Ako browser blokira reprodukciju, igra nastavlja raditi bez greške; kontrola omogućuje ponovni pokušaj. Ne prikazuje se modal koji bi blokirao ulazak u igru.

Kontrola zvuka prikazuje se na landingu i u `/postavke`; tijekom čekanja i aktivne partije nema kontrole koja bi odvlačila pažnju od igre.

## Matrica događaja

| Događaj | Publika | Signal | Pravilo |
|---|---|---|---|
| Klik na `IGRAJ` i ulazak u sobu | svi u sobi | ulazni signal | Isti zvuk kao za svaki drugi ulazak. Jednom po stvarnom ulasku. |
| Drugi igrač uđe u sobu | svi u sobi | ulazni signal | Ne svirati za ponovljeno stanje ili reconnect. |
| Igrač izađe iz sobe | svi u sobi | izlazni signal | Jednom po stvarnom izlasku; tiši od ulaska. |
| Svaka sekunda odbrojavanja u čekaonici | svi u sobi | `odbrojavanje-single-count-sound` | Svira na svaku cijelu sekundu prikazanog odbrojavanja, ne samo zadnje 3. Najviše jednom po sekundi. |
| Početak partije | svi | `pocetak-partije` | Jednom, točno kad odbrojavanje u čekaonici istekne i partija krene (ne na najavu budućeg početka). |
| Zadnjih 5 sekundi poteza (30s timer) | svi za stolom | `pred-istek-vremena` | Isti prag kao vizualni puls prstena oko igrača na potezu; jednom po potezu koji uđe u tu fazu. |
| Prihvaćena riječ | samo autoru poteza | potvrđujući ton | Ostali ne čuju tu potvrdu; njihov osobni signal dolazi kada je njihov red. |
| Odbijena riječ | samo autoru poteza | neutralni error ton | Nikad ne svirati drugim igračima. |
| `Ne znam` | nitko | nema zvuka | Vizualna potvrda je dovoljna. |
| Red prijeđe na igrača | samo tom igraču | signal `tvoj red` | Jednom po prijelazu na njegov red. Vizualni puls prstena prikazuje se i na prvom potezu, ali bez dodatnog zvuka uz `pocetak-partije`. |
| Eliminacija iz bilo kojeg razloga | svi u partiji | eliminacijski signal | Zajednički događaj; svi ga čuju jednom. |
| Nova runda / otkrivena početna riječ | svi | reveal signal | Jednom kada se otvori nova runda, OSIM 1. runde partije (ta već ima početni signal `pocetak-partije`, ne preklapati). |
| Reakcija igrača | nitko | nema zvuka | Emoji reakcije ostaju vizualne. |
| Kraj partije | svi | kratki završni signal | Ne svira odmah na kraj partije - pušta se tek kad se nakon odbrojavanja rezultata prikažu konačni plasmani, da se ne preklopi sa zvukom zadnje eliminacije. Jednom po završetku. |
| Klik na gumb ili link | samo korisnik koji je kliknuo | `klik-misa` | Lokalni UI feedback, nije Socket.IO događaj; ne čuju ga drugi igrači. Vrijedi za SVE klikabilne elemente (gumbi i linkovi), ne samo unutar partije. |
| Hover preko gumba ili linka | samo korisnik koji hoveraa | `hover-efekt` | Jednom po ulasku u novi klikabilni element; ne ponavlja se dok se miš zadržava unutar istog elementa. Prateći suptilan opacity hover na svemu klikabilnom (bez zvuka za disabled gumbe). |

## Pravila ponašanja

- Zvuk se veže uz semantički prijelaz ili događaj, ne uz renderiranje komponente.
- Reconnect, ponovno montiranje stranice i ponovljeno stanje ne smiju duplicirati efekt.
- Lokalni osobni događaj ne emitira se svim klijentima samo zato što je nastao preko Socketa.
- Mute odmah sprječava nove efekte; već pokrenuti kratki efekt smije završiti.
- Volume 0 ima isto ponašanje kao mute.
- Nema zvuka za događaje koji nisu u matrici dok se ne doda nova odluka.

## Opseg prve verzije

Prva implementacija pokriva ulaz/izlaz, svaku sekundu odbrojavanja u čekaonici, početak partije, upozorenje pred istek poteza, prihvaćenu i odbijenu riječ, red na igraču, eliminaciju, novu rundu, kraj partije te UI klik/hover na gumbima. Asseti za reakcije, pozadinsku glazbu i dodatne ambijentalne efekte nisu dio prve verzije.

## Pristupačnost i privatnost

Zvuk nikad nije jedini način razumijevanja stanja. Sve informacije moraju ostati dostupne kroz postojeći tekst, boju, animaciju ili stanje kontrole. Audio postavke su lokalne i ne šalju se analitici. Stanje „na potezu” dodatno je vidljivo kroz okvir cijelog aktivnog sjedala, label „Na redu!” i numerički prikaz preostalih sekundi; vizualni signal i pristupačna live poruka rade i kada je zvuk utišan ili blokiran.
