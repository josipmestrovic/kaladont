import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Trend } from 'k6/metrics';

const adresa = __ENV.CILJNA_ADRESA;
const brojVus = Number(__ENV.BROJ_POSJETITELJA);
const rampaMs = Number(__ENV.RAMPA_MS);
const drzanjeMs = Number(__ENV.DRZANJE_MS);
const lokalniSmoke = __ENV.LOKALNI_SMOKE === 'DA';
const aktivniHttpDrzanje = new Trend('kaladont_aktivni_http_drzanje');
const zahtjeviDrzanje = new Counter('kaladont_http_zahtjevi_drzanje');

if (!lokalniSmoke && adresa !== 'https://staging.kaladont.hr') {
  throw new Error('HTTP test dopušten je samo na https://staging.kaladont.hr.');
}
if (lokalniSmoke && ![
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:5174', 'http://127.0.0.1:5174',
  'http://[::1]:5173', 'http://[::1]:5174',
].includes(adresa)) {
  throw new Error('Lokalni k6 smoke dopušta samo razvojni Vite na localhostu.');
}
if (!Number.isSafeInteger(brojVus) || brojVus < 1) {
  throw new Error('BROJ_POSJETITELJA mora biti pozitivan cijeli broj.');
}
if (!Number.isSafeInteger(rampaMs) || rampaMs < 1 || !Number.isSafeInteger(drzanjeMs) || drzanjeMs < 1) {
  throw new Error('RAMPA_MS i DRZANJE_MS moraju biti pozitivni cijeli brojevi.');
}
if (brojVus > (lokalniSmoke ? 3 : 3_000) ||
    rampaMs + drzanjeMs + 5_000 > (lokalniSmoke ? 130_000 : 7_200_000) ||
    (lokalniSmoke && (rampaMs > 5_000 || drzanjeMs > 120_000))) {
  throw new Error('Broj korisnika ili trajanje premašuju dopušteni HTTP test.');
}

const stranice = [
  { putanja: '/', udio: 60 },
  { putanja: '/ljestvice', udio: 20 },
  { putanja: '/novosti', udio: 10 },
  { putanja: '/pravila-kaladonta?tema=pravila', udio: 10 },
];

export const options = {
  scenarios: {
    javniPosjetitelji: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { target: brojVus, duration: `${rampaMs}ms` },
        { target: brojVus, duration: `${drzanjeMs}ms` },
        { target: 0, duration: '5s' },
      ],
      gracefulRampDown: '0s',
      gracefulStop: '0s',
      tags: { runId: __ENV.RUN_ID ?? 'lokalno' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.005'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate==1'],
    kaladont_aktivni_http_drzanje: [`min>=${brojVus}`],
    kaladont_http_zahtjevi_drzanje: ['count>0'],
  },
};

function odaberiStranicu() {
  const vrijednost = Math.random() * 100;
  let granica = 0;
  for (const stranica of stranice) {
    granica += stranica.udio;
    if (vrijednost < granica) return stranica;
  }
  return stranice[stranice.length - 1];
}

export default function () {
  const protekloMs = exec.instance.currentTestRunDuration;
  if (protekloMs >= rampaMs && protekloMs < rampaMs + drzanjeMs) {
    aktivniHttpDrzanje.add(exec.instance.vusActive);
    zahtjeviDrzanje.add(1);
  }
  const stranica = odaberiStranicu();
  const odgovor = http.get(`${adresa}${stranica.putanja}`, {
    redirects: 0,
    timeout: '3s',
    headers: { Accept: 'text/html' },
    tags: { stranica: stranica.putanja, runId: __ENV.RUN_ID ?? 'lokalno' },
  });

  check(odgovor, {
    'javna stranica vraća HTTP 200': (vrijednost) => vrijednost.status === 200,
  });
  sleep(3 + Math.random() * 4);
}