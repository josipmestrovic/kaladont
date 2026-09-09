<script lang="ts">
  /**
   * RaniPristupBaner — mali banner koji podsjeća da je Kaladont u ranom pristupu.
   * Koristi se na /partija/[id] (pri dnu) i /povijest (pri vrhu).
   */
  let { onclickPrijavi = null }: { onclickPrijavi?: (() => void) | null } = $props();
</script>

<div class="rani-pristup-baner">
  <p>
    <strong>Kaladont je u ranom pristupu.</strong>
    Svaki report greške razmatramo kako bi igra postala bolja.
    <a
      href="#prijave"
      onclick={(e) => {
        if (onclickPrijavi) {
          e.preventDefault();
          onclickPrijavi();
        }
      }}>Prijavi problem</a
    >
  </p>
</div>

<style>
  .rani-pristup-baner {
    background: transparent;
    border: 1px solid var(--boja-tekst-sekundarni);
    border-radius: 6px;
    padding: 12px 16px;
    margin: 12px 0;
    font-size: var(--tekst-baza);
    line-height: 1.5;
  }

  .rani-pristup-baner p {
    margin: 0;
    color: #333;
  }

  .rani-pristup-baner a {
    color: #0066cc;
    text-decoration: underline;
  }

  .rani-pristup-baner a:hover {
    color: #0052a3;
  }

  @media (max-width: 640px) {
    .rani-pristup-baner {
      padding: 10px 12px;
      font-size: var(--tekst-mali);
    }
  }
</style>
