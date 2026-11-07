<script lang="ts">
  import {
    dohvatiStanjeSanducica,
    postaviFokusSanducicToasta,
    zatvoriSanducicToast,
  } from '$lib/stanje-sanducica.svelte.js';

  const stanje = dohvatiStanjeSanducica();
</script>

{#if stanje.toastPoruka}
  <aside class="sanducic-toast" role="status" aria-live="polite">
    <div class="sadrzaj">
      <img class="ikona" src="/ikone/81-mailbox.webp" alt="" aria-hidden="true" width="36" height="36" />
      <strong>{stanje.toastPoruka}</strong>
      <a
        class="akcija"
        href="/obavijesti"
        onfocus={() => postaviFokusSanducicToasta(true)}
        onblur={() => postaviFokusSanducicToasta(false)}
        onclick={() => zatvoriSanducicToast()}
      >
        Pročitaj
      </a>
    </div>
    <button type="button" class="zatvori" aria-label="Zatvori obavijest" onclick={() => zatvoriSanducicToast()}>×</button>
  </aside>
{/if}

<style>
  .sanducic-toast {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 44px 14px 16px;
    position: relative;
    border: 2px solid var(--boja-akcent, #2a8f86);
    border-radius: 10px;
    background: var(--boja-povrsina, #fff);
    color: var(--boja-tekst-osnovni);
    box-shadow: var(--sjena-modal);
    animation: sanducic-ulaz 0.4s ease-out;
  }

  .sadrzaj {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }

  .ikona {
    flex-shrink: 0;
    object-fit: contain;
  }

  .sadrzaj strong {
    font-weight: 700;
    font-size: 1.02rem;
    line-height: 1.35;
    min-width: 0;
  }

  .akcija {
    flex-shrink: 0;
    font-weight: 700;
    color: var(--boja-akcent, #2a8f86);
    text-decoration: underline;
  }

  .zatvori {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }

  @keyframes sanducic-ulaz {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
