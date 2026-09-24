# Avatar asseti — faza 1

Izvorni avatar dijelovi premješteni su u:

`skripte/avatari/izvor/avatar-assets/`

Premještene produkcijske kategorije:

- `Base/`
- `Ear/`
- `Ear Ring/`
- `Eyebrows/`
- `Eyes/`
- `Facial Hair/`
- `Glasses/`
- `Hair/`
- `Mouth/`
- `Nose/`
- `Shirt/`
- `Background.svg`

Top-level katalog/label SVG-ovi iz izvornog foldera namjerno nisu premješteni niti se koriste kao avatar komponente. To uključuje `Library.svg`, `Base.svg`, `Mouth.svg`, `Color.svg`, `Tops.svg`, grupne exporte i `Ellipse` pomoćne objekte.

## Inventory

Validator:

```powershell
node skripte/avatari/provjeri-inventory.mjs
```

Rezultat faze 1: 39 avatar komponenti + `Background.svg`.

Kontaktna tabla svih asseta:

`contact-sheet.svg`

Generiranje:

```powershell
node skripte/avatari/generiraj-kontaktnu-tablu.mjs
```

## Renderer dokaz

Puni referentni export `Avatar (1).svg` kopiran je u web statiku kao:

`aplikacije/web/static/avatari/dokaz/avatar-referenca.svg`

Vizualni dokaz dostupan je na razvojnoj ruti `/avatar-dokaz`. Koristi točan referentni SVG na 380 x 380 i postojeći rang-border, ali još nije zamjena za modularni `Avatar.svelte` renderer.

## Trenutno ograničenje

Pojedinačni asseti imaju različite lokalne viewBoxe, što je očekivano za kompozicijski sustav. Za konačni avatar renderer još treba potvrditi zajedničke transformacije, redoslijed slojeva i referentnu pozadinu iz punog Figma/reference exporta.

Trenutni `Background.svg` u dostavljenom folderu ima viewBox `0 0 277 46` i path koji izgleda kao katalog/label export, a ne kružna 380 x 380 pozadina. Za dokaz renderera koristi se puni referentni `Avatar (1).svg`, dok se modularna kompozicija iz pojedinačnih dijelova odgađa dok se ne potvrdi mapiranje transformacija i boja.

Rang-border ostaje odgovornost postojećeg `Avatar.svelte` sloja i nije dio SVG asseta.
