<script lang="ts">
  import { onMount } from 'svelte';
  import { RefreshCw, Mail } from 'lucide-svelte';
  import type { PregledNadzora } from 'zajednicko';
  import { api } from '$lib/api.js';

  let pregled = $state<PregledNadzora | null>(null);
  let greska = $state<string | null>(null);
  let ucitavanje = $state(false);
  let slanje = $state(false);
  let poruka = $state<string | null>(null);
  let sada = $state(Date.now());
  let aktivan = true;
  const uzorak = $derived(pregled?.trenutno);
  const zastarjelo = $derived(uzorak ? sada - Date.parse(uzorak.vrijeme) > 15_000 : true);
  const broj = (vrijednost: number | null | undefined, jedinica = '') => vrijednost == null ? 'Nije dostupno' : `${vrijednost.toLocaleString('hr-HR', { maximumFractionDigits: 1 })}${jedinica}`;
  const memorija = (bajtovi: number | undefined) => broj(bajtovi == null ? null : bajtovi / 1_048_576, ' MiB');
  const vrijeme = (datum: string | null | undefined) => datum ? new Date(datum).toLocaleTimeString('hr-HR') : 'Nije dostupno';

  async function osvjezi() {
    if (ucitavanje || !aktivan) return;
    ucitavanje = true;
    try {
      const odgovor = await api<PregledNadzora>('/admin/statistike/posluzitelj');
      if (aktivan) { pregled = odgovor; greska = null; }
    } catch (pogreska) {
      if (aktivan) greska = pogreska instanceof Error ? pogreska.message : 'Nadzor nije dostupan.';
    } finally { if (aktivan) ucitavanje = false; }
  }

  async function probnaObavijest() {
    if (slanje) return;
    slanje = true;
    poruka = null;
    try {
      const odgovor = await api<{ poruka: string }>('/admin/nadzor/probna-obavijest', { method: 'POST' });
      if (aktivan) poruka = odgovor.poruka;
    } catch (pogreska) {
      if (aktivan) poruka = pogreska instanceof Error ? pogreska.message : 'Slanje nije uspjelo.';
    } finally { if (aktivan) slanje = false; }
  }

  onMount(() => {
    aktivan = true;
    void osvjezi();
    const priVidljivosti = () => { if (!document.hidden) void osvjezi(); };
    document.addEventListener('visibilitychange', priVidljivosti);
    const timer = setInterval(() => {
      sada = Date.now();
      if (!document.hidden) void osvjezi();
    }, 5_000);
    return () => { aktivan = false; clearInterval(timer); document.removeEventListener('visibilitychange', priVidljivosti); };
  });
</script>

<section class="nadzor" aria-labelledby="nadzor-naslov">
  <div class="zaglavlje">
    <h2 id="nadzor-naslov">Nadzor poslužitelja</h2>
    <button type="button" class="alat" aria-label="Osvježi nadzor" title="Osvježi nadzor" onclick={() => void osvjezi()} disabled={ucitavanje}><RefreshCw size={18} /></button>
  </div>
  {#if greska}<p role="alert">{greska}</p>{/if}
  {#if pregled && uzorak}
    <p class="stanje" class:upozorenje={zastarjelo}>Uzorak {vrijeme(uzorak.vrijeme)} · {zastarjelo ? 'Podaci zastarjeli' : 'Podaci aktualni'} · Proces aktivan {broj(pregled.uptimeSekunde / 3600, ' h')}</p>
    <dl class="metrike">
      <div><dt>CPU aplikacije (jedna jezgra)</dt><dd>{broj(uzorak.cpuPostotak, ' %')}</dd></div>
      <div><dt>RAM aplikacije (RSS)</dt><dd>{memorija(uzorak.rssBajtovi)}</dd></div>
      <div><dt>Heap / vanjska memorija</dt><dd>{memorija(uzorak.heapBajtovi)} / {memorija(uzorak.vanjskaMemorijaBajtovi)}</dd></div>
      <div><dt>Event-loop p95</dt><dd>{broj(uzorak.eventLoopP95Ms, ' ms')}</dd></div>
      <div><dt>HTTP p95 / zahtjevi u 5 s</dt><dd>{broj(uzorak.http.p95Ms, ' ms')} / {uzorak.http.zahtjevi}</dd></div>
      <div><dt>HTTP 4xx / 5xx u 5 s</dt><dd>{uzorak.http.greske4xx} / {uzorak.http.greske5xx}</dd></div>
      <div><dt>Veze / partije / treninzi</dt><dd>{uzorak.igra.veze} / {uzorak.igra.partije} / {uzorak.igra.treninzi}</dd></div>
      <div><dt>Slobodni botovi / u partiji</dt><dd>{uzorak.igra.slobodniBotovi} / {uzorak.igra.botoviUPartiji}</dd></div>
      <div><dt>Botovi isteci / greške od pokretanja</dt><dd>{uzorak.igra.isteciBotova} / {uzorak.igra.greskeBotova}</dd></div>
      <div><dt>Baza / trajanje provjere</dt><dd>{uzorak.baza.dostupna === null ? 'Čeka provjeru' : uzorak.baza.dostupna ? 'Dostupna' : 'Nedostupna'} / {broj(uzorak.baza.trajanjeMs, ' ms')}</dd><small>Provjereno {vrijeme(uzorak.baza.provjerenoU)}</small></div>
      <div><dt>Socket.IO pokušaji / odbijeni od pokretanja</dt><dd>{uzorak.socket.pokusaji} / {uzorak.socket.odbijeni}</dd><small>Origin {uzorak.socket.odbijeniOrigin} · IP limit {uzorak.socket.odbijeniIp} · Kapacitet {uzorak.socket.odbijeniLimit}</small></div>
      <div><dt>Autorizirani / greške / prekidi od pokretanja</dt><dd>{uzorak.socket.autorizirani} / {uzorak.socket.greskeAutorizacije} / {uzorak.socket.prekidi}</dd><small>Autorizacija p95 u 5 s: {broj(uzorak.socket.p95AutorizacijeMs, ' ms')}</small></div>
    </dl>
    <div class="trendovi">
      <figure><figcaption>CPU aplikacije · posljednjih 15 min · vrh {broj(Math.max(...pregled.povijest.map((zapis) => zapis.cpuPostotak)), ' %')}</figcaption><div class="trend" role="img" aria-label="Trend CPU-a aplikacije tijekom posljednjih 15 minuta">{#each pregled.povijest as zapis}<span style:height={`${Math.max(2, Math.min(100, zapis.cpuPostotak))}%`} title={`${vrijeme(zapis.vrijeme)}: ${broj(zapis.cpuPostotak, ' %')}`}></span>{/each}</div></figure>
      <figure><figcaption>RAM aplikacije · posljednjih 15 min · vrh {memorija(Math.max(...pregled.povijest.map((zapis) => zapis.rssBajtovi)))}</figcaption><div class="trend memorija" role="img" aria-label="Trend RAM-a aplikacije tijekom posljednjih 15 minuta">{#each pregled.povijest as zapis}<span style:height={`${Math.max(2, zapis.rssBajtovi / Math.max(1, ...pregled.povijest.map((zapis) => zapis.rssBajtovi)) * 100)}%`} title={`${vrijeme(zapis.vrijeme)}: ${memorija(zapis.rssBajtovi)}`}></span>{/each}</div></figure>
    </div>
    <h3>Alarmi</h3>
    <p>Email obavijesti: {pregled.emailOmogucen ? 'uključene' : 'isključene'}</p>
    <ul class="alarmi">{#each pregled.alarmi as alarm}<li class:upozorenje={alarm.aktivan || alarm.greskaSlanja}><strong>{alarm.naziv}</strong>: {alarm.aktivan ? 'Aktivan alarm' : 'Uredno'} · Obavijest {vrijeme(alarm.zadnjaObavijest)}{alarm.greskaSlanja ? ' · Slanje nije uspjelo' : ''}</li>{/each}</ul>
    <button type="button" class="probna" disabled={!pregled.emailOmogucen || slanje} onclick={() => void probnaObavijest()}><Mail size={18} />{slanje ? 'Slanje' : 'Poslati probnu obavijest'}</button>
    {#if poruka}<p role="status">{poruka}</p>{/if}
    <details><summary>Izdanje</summary><p class="izdanje">{pregled.verzija}<br />{pregled.digest}</p></details>
  {:else if !greska}<p role="status">Učitavanje nadzora...</p>{/if}
</section>

<style>
  .nadzor { border-bottom: 1px solid #ddd; padding-bottom: 24px; margin-bottom: 24px; color: #252525; }
  .zaglavlje { display: flex; align-items: center; gap: 12px; }
  h2 { font-size: 24px; margin: 16px 0; }
  h3 { font-size: 18px; }
  .alat { width: 36px; height: 36px; display: grid; place-items: center; }
  button { border: 1px solid #bbb; border-radius: 4px; background: #fff; color: #252525; cursor: pointer; padding: 8px; font: inherit; }
  button:disabled { opacity: 0.55; cursor: default; }
  .metrike { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  dt, small, .stanje, figcaption { font-size: 13px; color: #555; }
  dd { margin: 4px 0; font-size: 18px; font-weight: 600; overflow-wrap: anywhere; }
  small { display: block; }
  .trendovi { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
  figure { margin: 16px 0; min-width: 0; }
  .trend { display: flex; align-items: flex-end; gap: 1px; height: 80px; margin-top: 8px; background: #f4f4f4; border-bottom: 1px solid #bbb; }
  .trend span { background: #16846c; flex: 1; min-width: 0; }
  .memorija span { background: #386fa4; }
  .upozorenje { color: #a03020; }
  .alarmi { padding-left: 20px; font-size: 14px; line-height: 1.8; }
  .probna { display: inline-flex; align-items: center; gap: 8px; }
  details { margin-top: 16px; font-size: 13px; }
  .izdanje { overflow-wrap: anywhere; }
  @media (max-width: 800px) { .metrike { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 480px) { .metrike, .trendovi { grid-template-columns: 1fr; } }
</style>