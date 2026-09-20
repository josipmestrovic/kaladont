<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';

  type Status = 'nova' | 'pregledana' | 'arhivirana';
  interface PovratnaInformacija {
    id: number;
    poruka: string;
    pravila: number | null;
    rjecnik: number | null;
    vrijemePoteza: number | null;
    snalazenjeUAplikaciji: number | null;
    brzinaUcitavanja: number | null;
    gamifikacija: number | null;
    status: Status;
    vrijeme: string;
    nadimak: string;
    email: string | null;
  }
  const naziviOcjena: [keyof Pick<PovratnaInformacija, 'pravila' | 'rjecnik' | 'vrijemePoteza' | 'snalazenjeUAplikaciji' | 'brzinaUcitavanja' | 'gamifikacija'>, string][] = [
    ['pravila', 'Pravila'], ['rjecnik', 'Rječnik'], ['vrijemePoteza', 'Vrijeme za potez'],
    ['snalazenjeUAplikaciji', 'Snalaženje u aplikaciji'], ['brzinaUcitavanja', 'Brzina učitavanja'], ['gamifikacija', 'Gamifikacija'],
  ];

  let povratneInformacije = $state<PovratnaInformacija[]>([]);
  let status = $state<Status | 'sve'>('nova');
  let odabrana = $state<PovratnaInformacija | null>(null);
  let greska = $state<string | null>(null);

  async function ucitaj() {
    try {
      const putanja = status === 'sve' ? '/admin/povratne-informacije' : `/admin/povratne-informacije?status=${status}`;
      const odgovor = await api<{ povratneInformacije: PovratnaInformacija[] }>(putanja);
      povratneInformacije = odgovor.povratneInformacije;
      odabrana = povratneInformacije.find((redak) => redak.id === odabrana?.id) ?? povratneInformacije[0] ?? null;
    } catch (razlog) {
      const porukaGreske = razlog instanceof Error ? razlog.message : 'Mišljenja nisu dostupna.';
      if (porukaGreske.includes('admin ovlasti') || porukaGreske.includes('Potrebna je prijava')) {
        await goto('/');
        return;
      }
      greska = porukaGreske;
    }
  }

  async function promijeniStatus(id: number, noviStatus: Exclude<Status, 'nova'>) {
    await api(`/admin/povratne-informacije/${id}/status`, { method: 'POST', body: JSON.stringify({ status: noviStatus }) });
    await ucitaj();
  }

  onMount(ucitaj);
</script>

<svelte:head><title>Mišljenja korisnika | Kaladont</title></svelte:head>

<main class="misljenja">
  <header><p class="nadnaslov">Administracija</p><h1>Mišljenja korisnika</h1></header>
  {#if greska}
    <p role="alert" class="greska">{greska}</p>
  {:else}
    <nav aria-label="Status mišljenja" class="filteri">
      {#each ['sve', 'nova', 'pregledana', 'arhivirana'] as opcija}
        <button class:aktivno={status === opcija} onclick={() => { status = opcija as Status | 'sve'; void ucitaj(); }}>{opcija === 'sve' ? 'Sve' : opcija}</button>
      {/each}
    </nav>
    <div class="sadrzaj">
      <section class="popis" aria-label="Popis mišljenja">
        {#if povratneInformacije.length === 0}<p>Nema mišljenja za odabrani status.</p>{/if}
        {#each povratneInformacije as misljenje (misljenje.id)}
          <button class:odabrano={odabrana?.id === misljenje.id} onclick={() => (odabrana = misljenje)}>
            <strong>{misljenje.nadimak}</strong><span>{misljenje.status}</span><small>{new Date(misljenje.vrijeme).toLocaleString('hr-HR')}</small>
          </button>
        {/each}
      </section>
      {#if odabrana}
        <article class="detalj">
          <p class="meta">{odabrana.nadimak} · {odabrana.email ?? 'bez emaila'} · {new Date(odabrana.vrijeme).toLocaleString('hr-HR')}</p>
          <p class="poruka">{odabrana.poruka}</p>
          {#if odabrana.pravila !== null}
            <dl>
              {#each naziviOcjena as [kljuc, naziv]}<div><dt>{naziv}</dt><dd>{odabrana[kljuc]} / 5</dd></div>{/each}
            </dl>
          {/if}
          {#if odabrana.status !== 'pregledana'}<button onclick={() => promijeniStatus(odabrana!.id, 'pregledana')}>Označi pregledano</button>{/if}
          {#if odabrana.status !== 'arhivirana'}<button onclick={() => promijeniStatus(odabrana!.id, 'arhivirana')}>Arhiviraj</button>{/if}
        </article>
      {/if}
    </div>
  {/if}
</main>

<style>
  .misljenja { width: min(960px, 100%); margin: 0 auto; padding: 36px 0 64px; }
  h1 { margin: 0; } .nadnaslov { color: var(--boja-akcent); font-size: var(--tekst-sitni); font-weight: 800; text-transform: uppercase; }
  .filteri { display: flex; gap: 8px; margin: 24px 0; } .filteri button, .popis button, .detalj button { font: inherit; cursor: pointer; }
  .filteri button { padding: 7px 11px; border: 1px solid #d8cfb8; border-radius: 6px; background: white; } .filteri button.aktivno { background: var(--boja-mint); border-color: var(--boja-mint); color: white; }
  .sadrzaj { display: grid; grid-template-columns: minmax(230px, .8fr) minmax(0, 1.6fr); gap: 18px; } .popis { display: grid; align-content: start; gap: 7px; }
  .popis button { display: grid; gap: 3px; padding: 12px; border: 1px solid #d8cfb8; border-radius: 6px; background: white; text-align: left; } .popis button.odabrano { border-color: var(--boja-mint); }
  .popis span, .popis small, .meta { color: var(--boja-tekst-sekundarni); } .detalj { padding: 18px; border: 1px solid #d8cfb8; border-radius: 6px; } .poruka { white-space: pre-wrap; line-height: 1.6; }
  dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } dt { font-weight: 700; } dd { margin: 2px 0 0; color: var(--boja-akcent); } .detalj button { margin: 10px 8px 0 0; padding: 8px 11px; border: 1px solid var(--boja-mint); border-radius: 6px; background: white; }
  .greska { color: #b3261e; font-weight: 700; } @media (max-width: 699px) { .sadrzaj { grid-template-columns: 1fr; } }
</style>
