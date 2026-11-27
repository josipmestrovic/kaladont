<script lang="ts">
  import type { BotDebugZapis } from 'zajednicko';
  import {
    botDebugKaoTekst,
    botDebugOtvoren,
    botDebugPauza,
    botDebugZapisi,
    ocistiBotDebugZapise,
    postaviBotDebugOtvoren,
    postaviBotDebugPauza,
  } from '$lib/bot-debug-store.svelte.js';

  let {
    vidljiv = false,
  }: {
    vidljiv?: boolean;
  } = $props();

  let prosireni = $state<Record<string, boolean>>({});

  function kljuc(z: BotDebugZapis): string {
    return `${z.turnToken}:${z.pokusaj}:${z.igracId}`;
  }

  function toggle(z: BotDebugZapis): void {
    const k = kljuc(z);
    prosireni = { ...prosireni, [k]: !prosireni[k] };
  }

  async function kopiraj(): Promise<void> {
    try {
      await navigator.clipboard.writeText(botDebugKaoTekst());
    } catch {
      // tiho
    }
  }
</script>

{#if vidljiv}
  <button
    type="button"
    class="bot-debug-gumb"
    class:aktivan={botDebugOtvoren()}
    onclick={() => postaviBotDebugOtvoren(!botDebugOtvoren())}
  >
    Bot debug
  </button>

  {#if botDebugOtvoren()}
    <aside class="bot-debug-panel" aria-label="Bot debug">
      <header class="bot-debug-glava">
        <strong>Bot debug</strong>
        <div class="bot-debug-akcije">
          <button type="button" onclick={() => postaviBotDebugPauza(!botDebugPauza())}>
            {botDebugPauza() ? 'Nastavi' : 'Pauza'}
          </button>
          <button type="button" onclick={() => ocistiBotDebugZapise()}>Obriši</button>
          <button type="button" onclick={() => void kopiraj()}>Kopiraj</button>
          <button type="button" onclick={() => postaviBotDebugOtvoren(false)}>Zatvori</button>
        </div>
      </header>
      <div class="bot-debug-lista">
        {#each botDebugZapisi() as z (kljuc(z))}
          <article class="bot-debug-zapis">
            <button type="button" class="bot-debug-sazetak" onclick={() => toggle(z)}>
              <span class="bot-debug-naslov">{z.nadimak} · {z.profil}</span>
              <span class="bot-debug-meta">
                {z.trazenaSlova}
                {#if z.rezultat.rijec}
                  → {z.rezultat.rijec}
                {:else if z.posebnaOdluka}
                  → {z.posebnaOdluka}
                {/if}
              </span>
            </button>
            {#if prosireni[kljuc(z)]}
              <div class="bot-debug-detalj">
                <p>Aktivnih: {z.brojAktivnih} · pokušaj {z.pokusaj} · token {z.turnToken}</p>
                {#if z.verzijaRjecnika !== undefined}
                  <p>Rječnik v{z.verzijaRjecnika}{#if z.generacijaPoolova !== undefined} · pool gen {z.generacijaPoolova}{/if}</p>
                {/if}
                <ul>
                  {#each z.linije as linija}
                    <li>{linija}</li>
                  {/each}
                </ul>
                {#if z.preskoci?.length}
                  <p>Preskočeni kandidati:</p>
                  <ul>
                    {#each z.preskoci as p}
                      <li>
                        {p.rijec}
                        {#if p.razlog} — {p.razlog}{/if}
                        {#if p.prijetnja} ({p.prijetnja}){/if}
                      </li>
                    {/each}
                  </ul>
                {/if}
                {#if z.rezultat.trajanjeIzracunaMs !== undefined}
                  <p>Izračun: {z.rezultat.trajanjeIzracunaMs} ms · ishod: {z.rezultat.ishodMotora ?? '—'}</p>
                {/if}
              </div>
            {/if}
          </article>
        {:else}
          <p class="bot-debug-prazno">Nema zapisa. Čekaj potez bota.</p>
        {/each}
      </div>
    </aside>
  {/if}
{/if}

<style>
  .bot-debug-gumb {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 25;
    padding: 6px 10px;
    border: 1px solid var(--boja-obrub-jaci);
    border-radius: 6px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-sitni);
    cursor: pointer;
    box-shadow: var(--sjena-modal);
  }
  .bot-debug-gumb.aktivan {
    border-color: var(--boja-naglasak, var(--boja-obrub-jaci));
  }
  .bot-debug-panel {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 24;
    display: flex;
    flex-direction: column;
    width: min(360px, 38vw);
    max-width: 380px;
    min-width: 280px;
    height: 100vh;
    border-left: 1px solid var(--boja-obrub-jaci);
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    box-shadow: var(--sjena-modal);
    pointer-events: auto;
  }
  .bot-debug-glava {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--boja-obrub);
  }
  .bot-debug-akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .bot-debug-akcije button {
    padding: 4px 8px;
    border: 1px solid var(--boja-obrub);
    border-radius: 4px;
    background: var(--boja-povrsina);
    color: inherit;
    font-size: var(--tekst-sitni);
    cursor: pointer;
  }
  .bot-debug-lista {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  .bot-debug-zapis {
    margin-bottom: 8px;
    border: 1px solid var(--boja-obrub);
    border-radius: 6px;
    background: var(--boja-povrsina);
  }
  .bot-debug-sazetak {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 8px 10px;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .bot-debug-naslov {
    font-weight: 600;
    font-size: var(--tekst-sitni);
  }
  .bot-debug-meta {
    font-size: var(--tekst-sitni);
    opacity: 0.85;
  }
  .bot-debug-detalj {
    padding: 0 10px 10px;
    font-size: var(--tekst-sitni);
    line-height: 1.4;
  }
  .bot-debug-detalj ul {
    margin: 6px 0 0;
    padding-left: 1.1em;
  }
  .bot-debug-prazno {
    padding: 16px 8px;
    opacity: 0.7;
    font-size: var(--tekst-sitni);
  }
  @media (max-width: 999px) {
    .bot-debug-gumb,
    .bot-debug-panel {
      display: none !important;
    }
  }
</style>
