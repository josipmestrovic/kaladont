<script lang="ts">
  import type { GoalProgressIzazova, PravilnikPartije } from 'zajednicko';
  import { nazivPravilnika } from '$lib/igraj-rute.js';

  let {
    napredak,
    pravila = null,
    trajanjePotezaSek = null,
  }: {
    napredak: GoalProgressIzazova | null;
    pravila?: PravilnikPartije | null;
    trajanjePotezaSek?: number | null;
  } = $props();

  const stavke = $derived((() => {
    if (!napredak) return [] as { id: string; tekst: string; met: boolean }[];
    const lista: { id: string; tekst: string; met: boolean }[] = [
      { id: 'pobjeda', tekst: 'Pobijedi', met: false },
    ];
    if (napredak.bezPogreske.required) {
      lista.push({
        id: 'bez',
        tekst: 'Bez pogreške',
        met: napredak.bezPogreske.met,
      });
    }
    if (napredak.dugeRijeci.required > 0) {
      lista.push({
        id: 'duge',
        tekst: `Duge riječi ${napredak.dugeRijeci.current}/${napredak.dugeRijeci.required}`,
        met: napredak.dugeRijeci.met,
      });
    }
    if (napredak.rijetkeRijeci.required > 0) {
      lista.push({
        id: 'rijetke',
        tekst: `Rijetke riječi ${napredak.rijetkeRijeci.current}/${napredak.rijetkeRijeci.required}`,
        met: napredak.rijetkeRijeci.met,
      });
    }
    if (napredak.uspjesanDokaz.required > 0) {
      lista.push({
        id: 'dokaz',
        tekst: `Uspješan dokaz ${napredak.uspjesanDokaz.current}/${napredak.uspjesanDokaz.required}`,
        met: napredak.uspjesanDokaz.met,
      });
    }
    return lista;
  })());
</script>

{#if napredak}
  <aside class="ciljevi-izazova" aria-label="Ciljevi izazova" data-testid="izazov-ciljevi">
    <div class="meta">
      {#if pravila}
        <span>{nazivPravilnika(pravila)}</span>
      {/if}
      {#if trajanjePotezaSek != null && trajanjePotezaSek > 0}
        <span>{trajanjePotezaSek} s</span>
      {/if}
    </div>
    <ul>
      {#each stavke as stavka (stavka.id)}
        <li class:met={stavka.met} class:cekaj={stavka.id === 'pobjeda'}>
          <span class="oznaka" aria-hidden="true">{stavka.met ? '✓' : stavka.id === 'pobjeda' ? '○' : '○'}</span>
          <span>{stavka.tekst}</span>
        </li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .ciljevi-izazova {
    margin: 0 0 10px;
    padding: 8px 10px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
    font-size: var(--tekst-mali);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-bottom: 6px;
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
  }
  li {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--boja-tekst-sekundarni);
  }
  li.met {
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }
  .oznaka {
    font-weight: 700;
  }
</style>
