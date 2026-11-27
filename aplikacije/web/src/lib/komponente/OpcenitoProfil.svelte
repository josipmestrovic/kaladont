<script lang="ts">
  /**
   * PR10: kartica Općenito — jedan DNK + sažetak javnih formata.
   * HINT: Statistika po formatu ostaje u Podizborniku; ovdje nema drugog radara.
   */
  import KaladontDnkGraf from '$lib/komponente/KaladontDnkGraf.svelte';
  import type { DnkProfil } from 'zajednicko';

  interface DnkMetrike {
    eliminacijePoPartiji: number;
    nizPrihvacenihRijeci: number;
    prosjekPrihvacenogPotezaMs: number;
    dugeRijeciPoPartiji: number;
    rijetkeRijeciPoPartiji: number;
  }

  interface Props {
    dnk: DnkProfil & { metrike: DnkMetrike };
    odigraneJavne: number;
    pobjedeJavne: number;
    /** Broj Brzih igara (Troboj); zasebno od ukupnog javnog broja. */
    odigraneBrzaIgra: number;
    prosjecnaOcjenaIgre: number | null;
    /** „Tvoj Kaladont DNK” na vlastitom, „Kaladont DNK” na javnom. */
    naslovDnk?: string;
  }

  let {
    dnk,
    odigraneJavne,
    pobjedeJavne,
    odigraneBrzaIgra,
    prosjecnaOcjenaIgre,
    naslovDnk = 'Kaladont DNK',
  }: Props = $props();

  const porazi = $derived(Math.max(0, odigraneJavne - pobjedeJavne));
  const postotakPobjeda = $derived(odigraneJavne > 0 ? Math.round((100 * pobjedeJavne) / odigraneJavne) : 0);
</script>

<section id="opcenito" class="opcenito-sekcija" aria-labelledby="opcenito-naslov">
  <h2 id="opcenito-naslov" class="opcenito-naslov">Općenito</h2>

  <KaladontDnkGraf profil={dnk} naslov={naslovDnk} />

  <div class="mrezica-kartica sazetak-igre">
    <div class="stat-kartica">
      <span class="stat-broj">{odigraneJavne}</span>
      <span class="stat-naziv">Odigrane javne igre</span>
    </div>
    <div class="stat-kartica">
      <span class="stat-broj">{odigraneBrzaIgra}</span>
      <span class="stat-naziv">Brza igra</span>
    </div>
    <div class="stat-kartica">
      <span class="stat-broj">{pobjedeJavne}</span>
      <span class="stat-naziv">Pobjede</span>
    </div>
    <div class="stat-kartica">
      <span class="stat-broj">{porazi}</span>
      <span class="stat-naziv">Porazi</span>
    </div>
    <div class="stat-kartica">
      <span class="stat-broj">{postotakPobjeda} %</span>
      <span class="stat-naziv">Postotak pobjeda</span>
    </div>
  </div>

  <section class="ostalo-kartica">
    <h3>Ostalo</h3>
    <div class="mrezica-kartica">
      {#if prosjecnaOcjenaIgre !== null}
        {@const ocjena = Math.round(prosjecnaOcjenaIgre)}
        <div class="stat-kartica">
          <span class="stat-broj">
            <span class="ocjena-zvjezdice" aria-label={`Prosječna ocjena ${ocjena} od 5`}>
              {#each Array.from({ length: 5 }, (_, i) => i < ocjena) as jeIspunjena}
                <img src={jeIspunjena ? '/ikone/27-zvjezdica-puna.webp' : '/ikone/26-zvjezdica-prazna.webp'} alt="" aria-hidden="true" />
              {/each}
            </span>
          </span>
          <span class="stat-naziv">Prosječna ocjena igre</span>
        </div>
      {/if}
      <div class="stat-kartica">
        <span class="stat-broj">{dnk.metrike.eliminacijePoPartiji.toFixed(2)}</span>
        <span class="stat-naziv">Eliminacije po igri</span>
      </div>
      <div class="stat-kartica">
        <span class="stat-broj">{dnk.metrike.nizPrihvacenihRijeci}</span>
        <span class="stat-naziv">Niz prihvaćenih riječi</span>
      </div>
      <div class="stat-kartica">
        <span class="stat-broj">
          {dnk.metrike.prosjekPrihvacenogPotezaMs > 0
            ? `${(dnk.metrike.prosjekPrihvacenogPotezaMs / 1000).toFixed(1)} s`
            : '—'}
        </span>
        <span class="stat-naziv">Prosjek prihvaćenog poteza</span>
      </div>
      <div class="stat-kartica">
        <span class="stat-broj">{dnk.metrike.dugeRijeciPoPartiji.toFixed(2)}</span>
        <span class="stat-naziv">Duge riječi po igri</span>
      </div>
      <div class="stat-kartica">
        <span class="stat-broj">{dnk.metrike.rijetkeRijeciPoPartiji.toFixed(2)}</span>
        <span class="stat-naziv">Rijetke riječi po igri</span>
      </div>
    </div>
  </section>
</section>

<style>
  .opcenito-sekcija {
    display: grid;
    gap: 1.25rem;
  }

  .opcenito-naslov {
    margin: 0;
    font-size: 1.35rem;
  }

  .sazetak-igre {
    margin-top: 0.25rem;
  }

  .mrezica-kartica {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.75rem;
  }

  .stat-kartica {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--boja-obrub);
    border-radius: 0.75rem;
    background: var(--boja-povrsina);
    color: var(--boja-tekst-osnovni);
  }

  .stat-broj {
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--boja-tekst-osnovni);
  }

  .stat-naziv {
    font-size: 0.85rem;
    color: var(--boja-tekst-sekundarni);
  }

  .ostalo-kartica h3 {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
    color: var(--boja-tekst-naslov);
  }

  .ocjena-zvjezdice {
    display: inline-flex;
    gap: 0.15rem;
  }

  .ocjena-zvjezdice img {
    width: 1.1rem;
    height: 1.1rem;
  }
</style>
