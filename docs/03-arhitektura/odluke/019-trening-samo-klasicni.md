# ADR-019: Trening isključivo s Klasičnim pravilnikom

- **Status:** prihvaćen
- **Datum:** 2026-11-27
- **Djelomično zamjenjuje:** [ADR-017](017-botovi-i-zagrijavanje.md) (dio o odabiru pravilnika u Zagrijavanju)

## Kontekst

Zagrijavanje (Trening) iz ADR-017 dopuštao je sva tri pravilnika (`klasicni`, `ka_zna`, `dokazi_nastavak`). Pred Botove V8 (zajednička inteligencija, težine i optimizacija) odabir pravilnika u Treningu dodaje površinu za balansiranje i zbunjuje ugovor o pravilima: botovi i posebni uvjeti Izazova već igraju prema Klasičnom, a Brza igra je Troboj + Klasični. Privatne sobe i dalje trebaju sva tri pravilnika za ljudske partije.

## Odluka

1. **Trening koristi isključivo Klasični pravilnik.** UI nudi samo težinu bota (Početnik / Iskusni / Majstor / Velemajstor) i broj botova (1–3). Zadani profil je Iskusni.
2. **Poslužitelj je autoritet.** Svaki `trening:zapocni` forsira `pravila = klasicni`, neovisno o payloadu, URL queryju ili starom klijentu. Poznati stari pravilnici `ka_zna` i `dokazi_nastavak` normaliziraju se na `klasicni`; nepoznati payload i dalje pada na `NEVALJAN_PAYLOAD`.
3. **Broj botova ne ovisi o pravilniku.** Izostanak `brojRacunala` = 1 (više nije mapiranje klasicni→2 / ostalo→1).
4. **Izazovi i Brza igra** ostaju na Klasičnom (bez promjene kataloga). **Privatne sobe** zadržavaju sva tri pravilnika za ljude, bez botova.
5. Bot algoritmi za KA-ZNA i Dokaži nastavak ostaju u kodu do zasebnog refaktora; u Treningu se više ne pokreću.

## Razmotrene alternative

- Odbacivanje starog `ka_zna`/`dokazi` payloada kao greške — odbačeno radi kompatibilnosti bookmarkova i starih klijenata.
- Zadržavanje odabira pravilnika samo u UI-ju — odbačeno jer bi backend i dalje mogao pokretati druge pravilnike.

## Posljedice

- Pojednostavljen ugovor za Botove V8: jedna matrica težina × broj botova na Klasičnom.
- Stari URL-ovi `/zagrijavanje?pravila=ka_zna` i slični i dalje rade, ali pokreću Klasični.
- Legacy `/zagrijavanje?pravila=klasicni` bez `botovi` sada daje 1 bota umjesto 2.
