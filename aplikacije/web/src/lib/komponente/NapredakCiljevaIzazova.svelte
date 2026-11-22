<script lang="ts">
  import type {
    GoalProgressIzazova,
    IzazovPartijaMeta,
    PravilnikPartije,
  } from 'zajednicko';
  import {
    NAZIVI_FORMATA_IZAZOVA,
    NAZIVI_LEVELA_IZAZOVA,
    NAZIVI_PROFILA_BOTA,
    NAZIVI_VARIJANTI_IZAZOVA,
  } from 'zajednicko';
  import { nazivPravilnika } from '$lib/igraj-rute.js';
  import PojamPomoc from '$lib/komponente/PojamPomoc.svelte';

  const OPIS_DOKAZI_NASTAVAK =
    'Ako sljedeći igrač ne zna nastavak ili mu istekne vrijeme, autor prethodne riječi mora dokazati da nastavak postoji tako da ga odigra. Uspije li, ispada igrač koji nije znao nastavak. Ne uspije li, ispada autor prethodne riječi.';

  let {
    napredak,
    meta = null,
    pravila = null,
  }: {
    napredak: GoalProgressIzazova | null;
    meta?: IzazovPartijaMeta | null;
    pravila?: PravilnikPartije | null;
  } = $props();

  const efektivnaPravila = $derived(pravila ?? null);
  const tvojPotezSek = $derived(
    meta ? Math.round(meta.humanTurnDurationMs / 1000) : null,
  );
  const prikaziDokazPomoc = $derived(efektivnaPravila === 'dokazi_nastavak');
</script>

{#if napredak || meta}
  <aside class="ciljevi-izazova" aria-label="Uvjeti izazova" data-testid="izazov-ciljevi">
    {#if meta}
      <p class="naslov-reda" data-testid="izazov-uvjeti-naslov">
        Level {meta.level} · {NAZIVI_FORMATA_IZAZOVA[meta.format]} · {NAZIVI_VARIJANTI_IZAZOVA[meta.varijanta]}
      </p>
      <p class="meta-reda">
        <span>Botovi: {NAZIVI_PROFILA_BOTA[meta.profileId]}</span>
        {#if efektivnaPravila}
          <span class="pravila">
            Pravila: {nazivPravilnika(efektivnaPravila)}
            {#if prikaziDokazPomoc}
              <PojamPomoc
                id="izazov-dokazi-pomoc"
                opis={OPIS_DOKAZI_NASTAVAK}
                ariaLabel="Što znači Dokaži nastavak?"
                pozicioniranje="uz-okidac"
              />
            {/if}
          </span>
        {/if}
      </p>
    {:else if efektivnaPravila}
      <p class="meta-reda">
        <span>{nazivPravilnika(efektivnaPravila)}</span>
      </p>
    {/if}

    <p class="uvjeti-reda">
      {#if tvojPotezSek != null && tvojPotezSek > 0}
        <strong>Tvoj potez: {tvojPotezSek} s</strong>
      {/if}
      {#if napredak?.bezPogreske.required}
        <span data-testid="izazov-uvjet-bez-pogreske">
          {#if napredak.bezPogreske.met}
            Bez pogrešne riječi — zasad ispunjeno
          {:else}
            Bez pogrešne riječi
          {/if}
        </span>
      {:else}
        <span>Pobijedi</span>
      {/if}
    </p>

    {#if napredak}
      <p class="napomena">
        {#if napredak.bezPogreske.required}
          Za prolaz moraš pobijediti. Prva pogrešna riječ završava izazov.
        {:else}
          Za prolaz moraš pobijediti.
        {/if}
      </p>
    {/if}

    {#if meta && !napredak}
      <p class="napomena">Level {NAZIVI_LEVELA_IZAZOVA[meta.level]}</p>
    {/if}
  </aside>
{/if}

<style>
  .ciljevi-izazova {
    margin: 0 0 10px;
    padding: 10px 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
    font-size: var(--tekst-mali);
  }
  .naslov-reda {
    margin: 0 0 4px;
    font-weight: 800;
    line-height: 1.3;
  }
  .meta-reda,
  .uvjeti-reda {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin: 0 0 4px;
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
  }
  .pravila {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .uvjeti-reda strong {
    color: var(--boja-tekst-osnovni);
  }
  .napomena {
    margin: 4px 0 0;
    color: var(--boja-tekst-sekundarni);
    font-weight: 500;
  }
</style>
