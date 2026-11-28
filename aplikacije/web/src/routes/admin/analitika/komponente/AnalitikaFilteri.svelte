<script lang="ts">
  import type { KontekstFilter } from '../tipovi.js';

  type TipRacunaIzazova = '' | 'gost' | 'registriran';

  let {
    od = $bindable(''),
    doDana = $bindable(''),
    kontekst = $bindable<KontekstFilter>(''),
    izazovChallengeId = $bindable(''),
    izazovAccountType = $bindable<TipRacunaIzazova>(''),
    prikaziKontekst,
    prikaziIzazov,
    onOsvjezi,
  }: {
    od: string;
    doDana: string;
    kontekst: KontekstFilter;
    izazovChallengeId: string;
    izazovAccountType: TipRacunaIzazova;
    prikaziKontekst: boolean;
    prikaziIzazov: boolean;
    onOsvjezi: () => void;
  } = $props();
</script>

<form
  class="filteri"
  onsubmit={(e) => {
    e.preventDefault();
    onOsvjezi();
  }}
>
  <label>Od <input type="date" bind:value={od} /></label>
  <label>Do <input type="date" bind:value={doDana} /></label>
  {#if prikaziKontekst}
    <label
      >Kontekst
      <select bind:value={kontekst}>
        <option value="">Svi</option>
        <option value="javna">Javna</option>
        <option value="privatna">Privatna</option>
        <option value="trening">Trening</option>
        <option value="izazov">Izazov</option>
      </select>
    </label>
  {/if}
  {#if prikaziIzazov}
    <label
      >Izazov
      <input type="text" bind:value={izazovChallengeId} placeholder="npr. IZ-L1-DV-01" maxlength="32" />
    </label>
    <label
      >Račun (Izazov)
      <select bind:value={izazovAccountType}>
        <option value="">Svi</option>
        <option value="gost">Gost</option>
        <option value="registriran">Registriran</option>
      </select>
    </label>
  {/if}
  <button type="submit">Osvježi</button>
</form>