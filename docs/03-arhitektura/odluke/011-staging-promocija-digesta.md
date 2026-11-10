# ADR-011: Staging okruženje i promocija istog image digesta

- **Status:** djelomično zamijenjen [ADR-om 014](014-operativni-model-mvp-a.md); dijelovi o ručnom stagingu supersedirani automatskim workflowom
- **Datum:** 2026-09-03

> **Napomena 2026-09-09:** važeći operativni ritam za prve closed testove opisuju [ADR-014](014-operativni-model-mvp-a.md) i [release shema](../../07-operacije/release-shema.md). Staging se tada ažurirao ručno punim GHCR digestom.
>
> **Napomena 2026-11-10:** automatski staging workflow (`objavi-staging.yml`) i ručni produkcijski promotion workflow (`promoviraj-produkciju`) postoje u repozitoriju. Aktualni status okruženja: [produkcija-i-objava.md](../../07-operacije/produkcija-i-objava.md). Izvorni tekst odluke ispod ostaje povijesni.

## Kontekst

ADR-009 definira jedan produkcijski VPS i deploy s `main` grane. Prije javnog lansiranja treba sigurnosna mreža: mjesto gdje se svaka promjena isproba u uvjetima identičnim produkciji (Docker, Caddy, TLS, pravi rječnik) prije nego dođe do igrača. Dodatno ograničenje: razvojno računalo nema virtualizaciju, pa se Docker slika **ne može** testirati lokalno — provjera mora živjeti u CI-ju i na stagingu.

## Odluka

Dva odvojena, jednako konfigurirana Hetzner VPS-a:

- **Staging** (`staging.kaladont.hr`): u izvornom tekstu odluke bio je ručno postavljen i ručno ažuriran nakon zelenog CI-ja i GHCR objave, s vlastitom bazom i stvarnim hrLex rječnikom. *(Aktualno: automatski staging deploy postoji — vidi napomenu 2026-11-10.)*
- **Produkcija** (`kaladont.hr`): objava **isključivo ručnom promocijom** — GitHub Actions workflow s obveznim odobrenjem (GitHub Environment `produkcija`) postavlja **identičan image digest** koji je već prošao staging. Slika se ne builda ponovno i ništa se ne kopira sa staging stroja.

Izvorni ciljani tok ove odluke bio je: `merge u main → CI + smoke test slike → GHCR (tag sha + digest) → auto-deploy staging → ručna provjera → odobrenje → isti digest u produkciju`. Nakon ADR-014 privremeno je vrijedilo ručno ažuriranje staginga punim digestom; automatski staging workflow kasnije je uveden (napomena 2026-11-10).

Rollback = ponovno pokretanje promocije s prethodnim poznato-zdravim digestom. Baza se ne vraća; migracije moraju biti kompatibilne unatrag barem jedan ciklus.

CI dodatno izvodi **smoke test stvarne produkcijske slike**: digne compose stack s Postgresom, izvrši migracije, uveze mali sintetički testni rječnik (ne hrLex — licenca), provjeri `/zdravlje` i odigra cijelu partiju postojećom skriptom `simulacija`. Time je „radi li slika na Linuxu" dokazano prije ijednog VPS-a.

## Razmotrene alternative

- **Push sa staging servera na produkcijski** — odbačeno: deployalo bi se stanje stroja umjesto verzioniranog artefakta, bez git traga, bez garancije da je testirano baš to.
- **Grane `develop` + `main`** — odbačeno za solo razvoj: dodatno mergeanje bez dobiti; promociju artefakta ionako radi digest, ne grana.
- **Automatska produkcija nakon staginga** — odbačeno: gubi se ljudska provjera na stagingu, a objave se namjerno rade u doba niskog prometa (partije su u memoriji).
- **Bez staginga (samo produkcija)** — odbačeno: bez lokalnog Dockera to bi značilo prvi test slike na živoj produkciji.
- **Rebuild slike za produkciju** — odbačeno: novi build ≠ testirani artefakt (druge verzije ovisnosti, drugi trenutak).

## Posljedice

- Dvostruki trošak infrastrukture aplikacije (dva VPS-a) — cijena sigurnosne mreže.
- Ista slika na oba okruženja ⇒ **konfiguracija u build vrijeme je zabranjena**; sve razlike okruženja dolaze iz `.env`/Compose okoline (vidi ADR-012 za posljedice na klijentu).
- Staging mora imati vlastitu bazu, tajne i rječnik; produkcijski podaci nikad na staging. CI koristi sintetički fixture, dok ručno postavljeni staging koristi vlastiti uvoz hrLexa.
- GitHub Deployment zapisi čuvaju tko je, kada i koji digest odobrio — puna sljedivost objava.
