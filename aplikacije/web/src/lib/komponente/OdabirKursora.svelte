<script lang="ts">
  import { onMount } from 'svelte';
  import {
    postavkeKursora,
    postaviRezimKursora,
    postaviSetKursora,
    SETOVI_KURSORA,
    type RezimKursora,
    type SetKursora,
  } from '$lib/postavke-kursora.js';

  const stanjaPregleda = [
    { id: 'normal', naziv: 'Strelica' },
    { id: 'hover', naziv: 'Rukica' },
    { id: 'klik', naziv: 'Klik' },
  ] as const;

  let odabranePostavke = $state({ set: '05-kaladont' as SetKursora, rezim: 'ruka' as RezimKursora });

  onMount(() => postavkeKursora.subscribe((vrijednost) => (odabranePostavke = vrijednost)));
</script>

<div class="odabir-kursora">
  <fieldset class="izbor-seta">
    <legend>Odaberi izgled</legend>
    <div class="mreza-setova">
      {#each SETOVI_KURSORA as set (set.id)}
        <label class="kartica-seta" class:odabrana={odabranePostavke.set === set.id}>
          <input
            type="radio"
            name="set-kursora"
            value={set.id}
            checked={odabranePostavke.set === set.id}
            onchange={() => postaviSetKursora(set.id)}
          />
          <span class="naziv-seta">{set.naziv}</span>
          <span class="pregled-stanja">
            {#each stanjaPregleda as stanje (stanje.id)}
              <span class="stanje">
                <img
                  src="/kursori/{set.id}/{set.stanja[stanje.id].datoteka}"
                  alt=""
                  width="48"
                  height="48"
                />
                <span>{stanje.naziv}</span>
              </span>
            {/each}
          </span>
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset class="izbor-rezima">
    <legend>Pokazivač</legend>
    <label>
      <input
        type="radio"
        name="rezim-kursora"
        value="ruka"
        checked={odabranePostavke.rezim === 'ruka'}
        onchange={() => postaviRezimKursora('ruka')}
      />
      Stalna rukica
    </label>
    <label>
      <input
        type="radio"
        name="rezim-kursora"
        value="strelica"
        checked={odabranePostavke.rezim === 'strelica'}
        onchange={() => postaviRezimKursora('strelica')}
      />
      Strelica
    </label>
  </fieldset>

  <p class="napomena-kursora">
    Prilagođeni kursor prikazuje se na računalima i prijenosnicima s mišem ili drugim pokazivačem. Na uređajima koji se koriste dodirom ostaje standardni pokazivač.
  </p>
</div>

<style>
  .odabir-kursora { display: flex; flex-direction: column; gap: 14px; }
  fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
  legend { margin-bottom: 8px; font-size: var(--tekst-sitni); font-weight: 700; }
  .mreza-setova { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .kartica-seta { display: flex; min-width: 0; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--boja-obrub); border-radius: var(--radijus-kartica); background: var(--boja-povrsina-3); cursor: pointer; }
  .kartica-seta.odabrana { border-color: var(--boja-mint); box-shadow: 0 0 0 2px var(--boja-mint); }
  .kartica-seta input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .kartica-seta input:focus-visible + .naziv-seta { outline: 3px solid var(--boja-fokus); outline-offset: 3px; }
  .naziv-seta { font-weight: 700; }
  .pregled-stanja { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; }
  .stanje { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 2px; color: var(--boja-tekst-sekundarni); font-size: 11px; }
  .stanje img { width: 48px; height: 48px; object-fit: contain; }
  .izbor-rezima { display: flex; flex-wrap: wrap; gap: 8px 16px; }
  .izbor-rezima legend { flex-basis: 100%; }
  .izbor-rezima label { display: inline-flex; align-items: center; gap: 8px; font-size: var(--tekst-sitni); cursor: pointer; }
  .izbor-rezima input { width: 18px; height: 18px; margin: 0; accent-color: var(--boja-mint); }
  .napomena-kursora { margin: 0; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }

  @media (max-width: 380px) {
    .mreza-setova { grid-template-columns: 1fr; }
  }
</style>