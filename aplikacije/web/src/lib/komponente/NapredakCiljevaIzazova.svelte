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
    PRAG_DUGE_RIJECI_IZAZOVA,
  } from 'zajednicko';
  import { nazivPravilnika } from '$lib/igraj-rute.js';

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
          <span class="pravila">Pravila: {nazivPravilnika(efektivnaPravila)}</span>
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
      {/if}
      {#if napredak?.bezZavrsavanjaNaKa?.required}
        <span data-testid="izazov-uvjet-bez-ka">
          {#if napredak.bezZavrsavanjaNaKa.met}
            Ne završi na ka — zasad ispunjeno
          {:else}
            Ne završi na ka
          {/if}
        </span>
      {/if}
      {#if napredak && napredak.dugeRijeci.required > 0}
        <span data-testid="izazov-uvjet-duge">
          Duge (≥{PRAG_DUGE_RIJECI_IZAZOVA}): {napredak.dugeRijeci.current}/{napredak.dugeRijeci.required}
        </span>
      {/if}
      {#if napredak && !napredak.bezPogreske.required && !napredak.bezZavrsavanjaNaKa?.required && napredak.dugeRijeci.required === 0}
        <span>Pobijedi</span>
      {:else if !napredak}
        <span>Pobijedi</span>
      {/if}
    </p>

    {#if napredak}
      <p class="napomena">
        {#if napredak.bezPogreske.required && napredak.bezZavrsavanjaNaKa?.required}
          Za prolaz moraš pobijediti. Prva pogrešna riječ ili završetak na ka završava izazov.
        {:else if napredak.bezPogreske.required}
          Za prolaz moraš pobijediti. Prva pogrešna riječ završava izazov.
        {:else if napredak.bezZavrsavanjaNaKa?.required}
          Za prolaz moraš pobijediti. Završetak riječi na ka završava izazov.
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
    width: 100vw;
    margin: 0 0 10px;
    margin-left: calc(50% - 50vw);
    padding: 10px max(16px, calc(50vw - 50%));
    border: 1px solid var(--boja-obrub);
    border-radius: 0 0 8px 8px;
    background: var(--boja-povrsina-2);
    font-size: var(--tekst-mali);
    box-sizing: border-box;
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
