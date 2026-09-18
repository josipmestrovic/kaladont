<script lang="ts">
  import type { DnkOs } from 'zajednicko';

  interface Props {
    prije: DnkOs[];
    poslije: DnkOs[];
    odigrano: number;
    otkljucan: boolean;
    upravoOtkljucan: boolean;
    preostaloDoOtkljucavanja: number;
    mod: 'cetiri_igraca' | 'dva_igraca';
  }

  let { prije, poslije, odigrano, otkljucan, upravoOtkljucan, preostaloDoOtkljucavanja, mod }: Props = $props();
  const naslov = $derived(mod === 'dva_igraca' ? 'Kaladont DNK 2 igrača' : 'Kaladont DNK 4 igrača');

  const srediste = 120;
  const radijus = 78;
  const kutovi = [-90, -30, 30, 90, 150, 210];
  const prstenovi = [25, 50, 75, 100];

  function koordinata(vrijednost: number, indeks: number, skala = radijus): string {
    const kut = (kutovi[indeks]! * Math.PI) / 180;
    const udaljenost = (Math.max(0, Math.min(100, vrijednost)) / 100) * skala;
    return `${srediste + Math.cos(kut) * udaljenost},${srediste + Math.sin(kut) * udaljenost}`;
  }

  function tocke(vrijednosti: DnkOs[], skala = radijus): string {
    return vrijednosti.map((os, indeks) => koordinata(os.vrijednost, indeks, skala)).join(' ');
  }

  function prijeZa(os: DnkOs): number {
    return prije.find((stavka) => stavka.kljuc === os.kljuc)?.vrijednost ?? os.vrijednost;
  }

  function promijeniloSe(os: DnkOs): boolean {
    return prijeZa(os) !== os.vrijednost;
  }
</script>

<section class="dnk-promjena" aria-labelledby="dnk-promjena-naslov">
  <div class="dnk-promjena-zaglavlje">
    <div>
      <p class="dnk-natpis">Novi profil igre</p>
      <h3 id="dnk-promjena-naslov">{naslov}</h3>
    </div>
    {#if !otkljucan}
      <strong>{odigrano} / 10</strong>
    {/if}
  </div>
  {#if upravoOtkljucan}
    <p class="dnk-poruka"><strong>🎉 ČESTITAMO, OTKLJUČAO SI KALADONT DNK <a href="/profil">NA SVOM PROFILU</a>! 🎊</strong></p>
  {:else if otkljucan}
    <p class="dnk-poruka">Ukupno odigrano: <strong>{odigrano}</strong></p>
  {:else}
    <p class="dnk-poruka">Do otključavanja preostaje još <strong>{preostaloDoOtkljucavanja}</strong> javnih igara.</p>
  {/if}

  <div class="dnk-promjena-sadrzaj">
    <div class="graf-omotac">
      <svg viewBox="0 0 240 240" role="img" aria-label="Novi Kaladont DNK profil">
        {#each prstenovi as prsten}
          <polygon points={tocke(poslije.map((os) => ({ ...os, vrijednost: prsten })))} class="dnk-prsten" />
        {/each}
        {#each poslije as os, indeks}
          {@const kraj = koordinata(100, indeks)}
          {@const oznaka = koordinata(113, indeks)}
          <line x1={srediste} y1={srediste} x2={kraj.split(',')[0]} y2={kraj.split(',')[1]} class="dnk-os" />
          <text x={oznaka.split(',')[0]} y={oznaka.split(',')[1]} class="dnk-oznaka" text-anchor="middle" dominant-baseline="middle">{os.naziv}</text>
        {/each}
        <polygon points={tocke(poslije)} class="dnk-podrucje" />
      </svg>
    </div>

    <div class="dnk-promjene-lista">
      {#each poslije as os}
        {@const staraVrijednost = prijeZa(os)}
        <div class="dnk-promjena-redak">
          <strong>{os.naziv}</strong>
          <span class:promijenjeno={promijeniloSe(os)}>
            {#if promijeniloSe(os)}
              <s>{staraVrijednost}</s>
              <span class:pad={os.vrijednost > staraVrijednost} class="strelica" aria-label={os.vrijednost > staraVrijednost ? 'Povećanje' : 'Smanjenje'}>{os.vrijednost > staraVrijednost ? '↑' : '↓'}</span>
            {/if}
            <b>{os.vrijednost}</b>
          </span>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .dnk-promjena {
    width: 100%;
    max-width: none;
    margin: 32px auto 0;
    padding: 18px;
    border: 1px solid #e5ddc8;
    border-radius: 8px;
    background: #fff;
    text-align: left;
  }

  .dnk-promjena-zaglavlje,
  .dnk-promjena-redak {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .dnk-natpis {
    margin: 0 0 2px;
    color: var(--boja-akcent);
    font-size: var(--tekst-mikro);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h3 {
    margin: 0;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-naslov);
    font-size: 1.35rem;
  }

  .dnk-promjena-zaglavlje > strong { color: var(--boja-akcent); font-size: 1.35rem; white-space: nowrap; }
  .dnk-poruka { margin: 10px 0 4px; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mikro); }
  .dnk-poruka strong { color: var(--boja-mint-tamni); }

  .dnk-promjena-sadrzaj {
    display: grid;
    grid-template-columns: minmax(210px, 0.9fr) minmax(220px, 1.1fr);
    align-items: center;
    gap: 18px;
    margin-top: 8px;
  }

  .graf-omotac {
    width: min(100%, 250px);
    margin: 0 auto;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .dnk-prsten { fill: none; stroke: #eadfca; stroke-width: 1; }
  .dnk-os { stroke: #dfd5c2; stroke-width: 1; }
  .dnk-oznaka { fill: var(--boja-tekst-sekundarni); font-size: 8px; font-weight: 700; }
  .dnk-podrucje { fill: rgb(228 87 46 / 22%); stroke: var(--boja-akcent); stroke-width: 2.5; stroke-linejoin: round; }

  .dnk-promjene-lista {
    display: grid;
    gap: 8px;
  }

  .dnk-promjena-redak {
    min-height: 30px;
    padding-bottom: 6px;
    border-bottom: 1px solid #eee8dc;
    font-size: var(--tekst-sitni);
  }

  .dnk-promjena-redak > strong { color: var(--boja-tekst-osnovni); }
  .dnk-promjena-redak > span { display: inline-flex; align-items: center; gap: 7px; color: var(--boja-akcent); }
  .dnk-promjena-redak s { color: var(--boja-tekst-sekundarni); text-decoration-thickness: 2px; }
  .dnk-promjena-redak b { min-width: 22px; text-align: right; }
  .strelica { color: var(--boja-akcent); font-size: 1.15rem; font-weight: 800; line-height: 1; }
  .strelica.pad { color: var(--boja-mint-tamni); }

  @media (max-width: 600px) {
    .dnk-promjena { padding: 14px; }
    .dnk-promjena-zaglavlje { align-items: flex-start; flex-direction: column; }
    .dnk-promjena-sadrzaj { grid-template-columns: 1fr; gap: 10px; }
    .graf-omotac { max-width: 250px; }
  }
</style>
