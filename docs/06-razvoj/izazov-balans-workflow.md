# Izazov — balans workflow (ručno)

Kratki postupak za usporedbu težine izazova nakon promjene. **Nema automatske težine** — admin gleda kohorte i odlučuje.

## Katalog v2 (referenca)

- Matrica **4×3×5 = 60** ID-jeva: `IZ-L{1-4}-{DV|TR|CE}-{01-05}`.
- Nominalni fond challenge XP = **106.540** (2× starog).
- `definitionVersion = 2`. Stari `IZ01`–`IZ24` se ne migriraju u napredak.
- Ljudski rok po varijanti (15/30 s); bot uvijek 30 s. Uspjeh = pobjeda (+ `bezPogreske` gdje treba).

## Tijek

1. **Problem** — npr. attempt success prenizak / first-try previsok na `IZ-L…` u admin analitici (sekcija Izazovi).
2. **Jedna promjena** — timer, bot profil (level), cilj ili XP ćelija; ne miješati više neovisnih promjena u istoj verziji.
3. **Bump verzije** — `definitionVersion` (sadržaj izazova) i/ili `botProfileVersion` (ponašanje bota). Stara i nova verzija ostaju odvojene u agregatu (default ne stapaju se).
4. **Usporedba kohorti** — u `/admin/analitika` filtrirati `od`/`do` (max 90 dana, Zagreb), po želji `challengeId` / vrstu računa; usporediti redove stare vs nove verzije (attempt success, unique success + Wilson, first-try, trajanje).
5. **Stare nagrade ostaju** — `zavrseci_izazova` se ne brišu retencijom; pokušaji referencirani kao prvi uspjeh ostaju zbog FK. Soft-delete računa i dalje čisti attempts/completions tog igrača.

## Retencija

Terminalni `pokusaji_izazova` stariji od **90 dana** (`terminal_at`) brišu se dnevnim jobom. `zavrseci_izazova` se ne dira. Live admin izvještaji koriste isti max raspon od 90 dana.

## Granice

- Staging: flag on. Produkcija ostaje off do releasea — vidi [izazov-staging-rollout.md](../07-operacije/izazov-staging-rollout.md).
- CSV i API ne sadrže email, IP ni nadimak — samo id-eve izazova/verzija i brojeve.
