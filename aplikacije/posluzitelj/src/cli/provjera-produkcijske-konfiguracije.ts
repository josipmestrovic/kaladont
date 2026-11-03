/**
 * Jeftina provjera produkcijskih pravila iz konfiguracija.ts sa sintetičkim envom.
 * Ne digže bazu ni HTTP — samo validacija pri učitavanju modula.
 */
const sintetika: Record<string, string> = {
  NODE_ENV: 'production',
  BAZA_URL: 'postgresql://kaladont:ci-sintetika@127.0.0.1:5432/kaladont_prod',
  SESIJA_TAJNA: 'ci-produkcijska-sesija-tajna-ne-promijeni-me',
  EMAIL_API_KLJUC: 're_ci_sinteticki_kljuc',
  EMAIL_POSILJATELJ: 'noreply@kaladont.hr',
  JAVNA_ADRESA: 'https://kaladont.hr',
  DEV_MAIL: 'ops@example.com',
  ONEMOGUCI_TIMER_POTEZA: 'false',
  TOLERANCIJA_PREKIDA_MS: '10000',
  ODGODA_POCETKA_PARTIJE_MS: '10000',
  ADMIN_TAJNI_KLJUC: 'ci-admin-secret',
  LJESTVICE_POCETAK: '2026-01-01T00:00:00+01:00',
  VERZIJA: 'ci-provjera',
  DIGEST: 'ci-provjera',
};

for (const [kljuc, vrijednost] of Object.entries(sintetika)) {
  process.env[kljuc] = vrijednost;
}

try {
  await import('../konfiguracija.js');
  console.log('Produkcijska konfiguracija (sintetika) je valjana.');
} catch (greska) {
  console.error(greska instanceof Error ? greska.message : greska);
  process.exitCode = 1;
}
