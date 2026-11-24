<script lang="ts">
  import { izracunajPrikazXp } from '$lib/naslovnica-napredak.js';
  import { stanjeProfila } from '$lib/stanje-profila.svelte.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';

  const prikaz = $derived(izracunajPrikazXp(stanjeProfila.profil, stanjeProfila.status));
</script>

<a
  href="/profil"
  class="naslovnica-napredak"
  data-testid="naslovnica-napredak"
  aria-label={prikaz.vrsta === 'napredak'
    ? `${prikaz.rang}, razina ${prikaz.razina}`
    : prikaz.natpis}
  onclick={() => zabiljeziUmamiDogadjaj('naslovnica-profil-klik')}
>
  {#if prikaz.vrsta === 'napredak'}
    <p class="naslovnica-napredak__identitet">
      <span class="naslovnica-napredak__rang">{prikaz.rang}</span>
      <span class="naslovnica-napredak__razdjelnik" aria-hidden="true">·</span>
      <span class="naslovnica-napredak__lvl">LVL {prikaz.razina}</span>
    </p>
    {#if prikaz.maksimalna}
      <p class="naslovnica-napredak__xp">Maksimalna razina</p>
      <div
        class="naslovnica-napredak__traka"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={100}
        aria-label="Maksimalna razina"
      >
        <span style="width: 100%"></span>
      </div>
    {:else if prikaz.doIduceTekst !== null && prikaz.postotak !== null}
      <div
        class="naslovnica-napredak__traka"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(prikaz.postotak)}
        aria-label={`Napredak do sljedeće razine: ${prikaz.uRaziniTekst} od ${prikaz.doIduceTekst} XP`}
      >
        <span style={`width: ${prikaz.postotak}%`}></span>
      </div>
      <p class="naslovnica-napredak__xp">{prikaz.uRaziniTekst} / {prikaz.doIduceTekst} XP</p>
    {/if}
  {:else}
    <p class="naslovnica-napredak__identitet">{prikaz.natpis}</p>
  {/if}
</a>

<style>
  .naslovnica-napredak {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: min(100%, 320px);
    margin: 0 auto 4px;
    padding: 4px 8px;
    color: var(--boja-tekst-sekundarni);
    text-decoration: none;
  }

  .naslovnica-napredak:hover {
    color: var(--boja-akcent-tekst);
  }

  .naslovnica-napredak__identitet {
    margin: 0;
    font-family: var(--font-naslov);
    font-size: clamp(15px, 2dvh, 17px);
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
  }

  .naslovnica-napredak__razdjelnik {
    margin-inline: 0.35em;
    opacity: 0.7;
  }

  .naslovnica-napredak__traka {
    width: min(100%, 220px);
    height: 8px;
    overflow: hidden;
    border-radius: var(--radijus-pill);
    background: color-mix(in srgb, var(--boja-tekst-sekundarni) 28%, transparent);
  }

  .naslovnica-napredak__traka span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--boja-zuta-krema);
  }

  .naslovnica-napredak__xp {
    margin: 0;
    font-family: var(--font-tijelo);
    font-size: var(--tekst-sitni);
    line-height: 1.2;
    text-align: center;
  }
</style>
