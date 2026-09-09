# Istraživanje (UX research zapis)

Kratak referentni zapis prije Figma faze Brandinga — ne mijenja pravila igre, samo prikuplja kontekst za dizajn odluke.

## Konkurencija / referentni proizvodi

- **Riječoslagalica** i slične hrvatske igre riječima — referenca za ton i jednostavnost, ali nemaju real-time multiplayer napetost koju Kaladont ima (30s timer, eliminacija).
- Skribbl.io / slične brzinske multiplayer igre riječima (engleski govorno područje) — referenca za "soba se puni" UX (naš `/red`) i emoji/brzu-poruku komunikaciju bez punog chata.
- Kartaška online iskustva (npr. Briskula/Belot aplikacije) — referenca za avatar+rang prikaz oko stola u luku.

## Ton i jezik

Potvrđeno u [vizualni-identitet.md](vizualni-identitet.md): prijateljski, kratak, bez anglizama, poruke sustava ljudske a ne tehničke. Ovo se ne mijenja ovim istraživanjem.

## Poznate rizične UX točke (iz postojećih testova/simulacije)

- **RS-02 / mrtva slova:** igrač eliminiran jer u bazi nema riječi na tražena dva grafema — mora odmah vidjeti gumb Prijavi (već u ekrani.md §3).
- **RS-09 / RS-10 (prekid veze):** igrač koji izgubi vezu na potezu eliminira se i bod ide protivniku; izvan poteza je samoeliminacija bez boda. Novi UI gumb izlaska mora vizualno komunicirati ovu razliku (potvrda objašnjava posljedicu prije klika).
- **RS-17 (peti igrač):** red čekanja mora jasno pokazivati da postoji čekanje za sljedeći stol, ne samo "puni se ovaj".
- **RS-18 (jedna aktivna veza):** ako se igrač spoji s drugog uređaja, stari se prekida — treba li poruka na starom uređaju? (Otvoreno pitanje za kasniju UX iteraciju, izvan MVP dizajna.)

## Zaključci za Brand/Wireframe fazu

- Avatari i borderi trebaju biti dovoljno različiti da se prepoznaju "s druge strane stola" u malom mobilnom prikazu (ne previše detalja u 8 dizajna).
- Header mora raditi i za gosta (bez imena/ranga) i za registriranog (puni prikaz) bez da izgleda "prazno" u gost varijanti.
- 4 brze poruke moraju stati u jedan red na mobitelu bez skrolanja — kratki tekstovi presudni.
