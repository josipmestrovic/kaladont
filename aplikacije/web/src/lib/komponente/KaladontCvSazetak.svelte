<script lang="ts">
  import { formatirajStazBiografski } from 'zajednicko';
  import type { KaladontCvDto } from 'zajednicko';

  interface Props {
    cv: KaladontCvDto | null;
    gost?: boolean;
  }

  let { cv, gost = false }: Props = $props();

  const tekstBiografije = $derived.by(() => {
    if (gost) return 'Ovaj igrač igra kao gost. Opis će biti dostupan nakon registracije.';
    if (!cv) return '';

    const biografija = cv.biografija.tip === 'opis'
      ? cv.biografija.recenice.join(' ')
      : cv.biografija.tekst;
    const staz = formatirajStazBiografski(cv.staz);
    return staz ? `${biografija} ${staz}` : biografija;
  });
</script>

<section class="cv-sazetak" aria-label="Biografija Kaladont igrača">
  {#if tekstBiografije}
    <p class="cv-biografija" role={gost ? 'status' : undefined}>{tekstBiografije}</p>
  {/if}
</section>

<style>
  .cv-sazetak { min-width: 0; padding: 16px; border: 1px solid #e5ddc8; border-radius: 8px; background: #fffdf5; }
  .cv-biografija { margin: 0; color: var(--boja-tekst-osnovni); line-height: 1.55; overflow-wrap: anywhere; }
</style>