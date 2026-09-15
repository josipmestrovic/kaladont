<script lang="ts">
  import { goto } from '$app/navigation';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import StoJeNovo from '$lib/komponente/StoJeNovo.svelte';

  const registriran = jeRegistriranKorisnik();
  let otvorenModal = $state(false);
  let otvoreneNovosti = $state(false);
  let otvoreniFooter = $state<'o-igri' | 'uvjeti' | 'privatnost' | null>(null);

  function igrajKlik(e: MouseEvent) {
    e.preventDefault();
    otvorenModal = true;
  }

  function odaberiMod(mod: '4p' | '1v1') {
    otvorenModal = false;
    if (mod === '1v1') {
      void goto('/red?mod=dva_igraca');
    } else {
      void goto('/red?mod=cetiri_igraca');
    }
  }
</script>

<div class="landing">
  <h1 class="logotip">Kaladont Multiplayer <span>(v0.4.0-closed-alpha.1)</span></h1>
  <p class="podnaslov">Hrvatska igra riječi</p>

  <div class="gumbi-sekcija">
    <div class="gumb-blok">
      <a href="/red" class="igraj-gumb" onclick={igrajKlik}>IGRAJ</a>
    </div>

    <div class="gumb-blok privatna-soba-blok">
      <a href="/soba/kreiraj" class="soba-gumb">Privatna soba</a>
    </div>
  </div>

  {#if !registriran}
    <p class="racun-linkovi">
      <a href="/prijava">Prijavi se</a> · <a href="/registracija">Registriraj se</a>
    </p>
  {/if}

  <p class="early-access-napomena">
    <strong>Early access</strong> — očekuj moguće greške. Ako ih pronađeš, prijavi ih kroz ugrađeni sustav za prijavu grešaka.
  </p>
</div>

{#if otvorenModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-podloga" onclick={() => (otvorenModal = false)} onkeydown={(e) => e.key === 'Escape' && (otvorenModal = false)}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-sadrzaj" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
      <h2>Što želiš igrati?</h2>
      <p class="modal-podtekst">Ovaj način igre bilježi bodove i pobjede te sudjeluje u dodjeli rangiranja i top ljestvici.</p>

      <div class="modal-gumbi">
        <button type="button" class="modal-izbor-gumb" onclick={() => odaberiMod('4p')}>
          4 igrača
        </button>

        <button type="button" class="modal-izbor-gumb" onclick={() => odaberiMod('1v1')}>
          2 igrača
        </button>
      </div>

      <button type="button" class="zatvori-modal-gumb" onclick={() => (otvorenModal = false)}>Zatvori</button>
    </div>
  </div>
{/if}

<footer>
  <button type="button" class="novosti-link" onclick={() => (otvoreneNovosti = true)}>Što je novo?</button>
  <span aria-hidden="true">·</span>
  <button type="button" class="footer-link" onclick={() => (otvoreniFooter = 'o-igri')}>O igri</button>
  <span aria-hidden="true">·</span>
  <button type="button" class="footer-link" onclick={() => (otvoreniFooter = 'uvjeti')}>Uvjeti</button>
  <span aria-hidden="true">·</span>
  <button type="button" class="footer-link" onclick={() => (otvoreniFooter = 'privatnost')}>Privatnost</button>
</footer>

{#if otvoreneNovosti}
  <StoJeNovo zatvori={() => (otvoreneNovosti = false)} />
{/if}
{#if otvoreniFooter}
  <StoJeNovo pogled={otvoreniFooter} zatvori={() => (otvoreniFooter = null)} />
{/if}

<style>
  .landing {
    text-align: center;
    padding-top: 40px;
  }

  .logotip {
    font-size: 40px;
    line-height: 1;
  }

  .logotip span {
    display: block;
    margin-top: 4px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-baza);
    font-weight: 600;
  }

  .podnaslov {
    color: var(--boja-tekst-sekundarni);
    margin-bottom: 32px;
    font-size: inherit;
  }

  .gumbi-sekcija {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .privatna-soba-blok {
    margin-top: 18px;
  }

  .igraj-gumb {
    display: inline-block;
    background: var(--boja-pozadina-primarna);
    color: white;
    font-family: var(--font-naslov);
    font-size: 24px;
    font-weight: 700;
    text-decoration: none;
    padding: 20px 64px;
    border-radius: var(--radijus-pill);
    box-shadow: var(--sjena-suptilna);
  }

  .soba-gumb {
    display: inline-block;
    background: white;
    border: 2px solid var(--boja-pozadina-primarna);
    color: var(--boja-pozadina-primarna);
    font-family: var(--font-naslov);
    font-size: 18px;
    font-weight: 700;
    text-decoration: none;
    padding: 12px 32px;
    border-radius: var(--radijus-pill);
    box-shadow: var(--sjena-suptilna);
  }

  .racun-linkovi {
    margin-top: 20px;
    font-size: inherit;
  }

  .early-access-napomena {
    max-width: 360px;
    margin: 24px auto 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-baza);
  }

  footer {
    margin-top: 32px;
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
    text-align: center;
  }

  .novosti-link { padding: 0; border: 0; background: none; color: var(--boja-tekst-naslov); font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
  .footer-link { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-decoration: underline; cursor: pointer; }

  .modal-podloga {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(26, 24, 21, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 100;
  }

  .modal-sadrzaj {
    background: white;
    border-radius: var(--radijus-kartica);
    padding: 24px;
    max-width: 440px;
    width: 100%;
    box-shadow: var(--sjena-suptilna);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }

  .modal-sadrzaj h2 {
    margin: 0;
    font-size: var(--naslov-2);
    line-height: 1.15;
  }

  .modal-podtekst {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .modal-gumbi {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .modal-izbor-gumb {
    background: #faf8f0;
    border: 2px solid #e5ddc8;
    border-radius: var(--radijus-pill);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-family: var(--font-naslov);
    font-size: 20px;
    font-weight: 700;
    color: var(--boja-tekst-naslov);
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .zatvori-modal-gumb {
    background: none;
    border: none;
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    font-size: var(--tekst-sitni);
  }
</style>
