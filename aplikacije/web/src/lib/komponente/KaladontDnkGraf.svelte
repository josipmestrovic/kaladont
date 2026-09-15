<script lang="ts">
  import type { DnkProfil } from 'zajednicko';

  interface Props {
    profil: DnkProfil;
    naslov?: string;
  }

  let { profil, naslov = 'Kaladont DNK' }: Props = $props();

  const srediste = 150;
  const radijus = 105;
  const kutovi = [-90, -30, 30, 90, 150, 210];
  const prstenovi = [20, 40, 60, 80, 100];

  function koordinata(vrijednost: number, indeks: number, skala = radijus): string {
    const kut = (kutovi[indeks]! * Math.PI) / 180;
    const udaljenost = (Math.max(0, Math.min(100, vrijednost)) / 100) * skala;
    return `${srediste + Math.cos(kut) * udaljenost},${srediste + Math.sin(kut) * udaljenost}`;
  }

  function tockeZaOsi(skala = radijus): string {
    return profil.osi.map((os, indeks) => koordinata(os.vrijednost, indeks, skala)).join(' ');
  }

  function tockePrstena(postotak: number): string {
    return profil.osi.map((_, indeks) => koordinata(postotak, indeks)).join(' ');
  }
</script>

<section class="dnk-kartica" aria-labelledby="dnk-naslov">
  <div class="dnk-zaglavlje">
    <div>
      <p class="dnk-natpis">Profil igre</p>
      <h3 id="dnk-naslov">{naslov}</h3>
    </div>
    <span class:otkljucan={profil.otkljucan} class="dnk-status">
      {profil.otkljucan ? `${profil.odigrano} partija` : `Otključava se nakon 10 partija`}
    </span>
  </div>

  {#if profil.otkljucan}
    <div class="dnk-sadrzaj">
      <div class="graf-omotac">
        <svg viewBox="0 0 300 300" role="img" aria-label={`${naslov}: šest osi profila igre`}>
          {#each prstenovi as prsten}
            <polygon points={tockePrstena(prsten)} class="dnk-prsten" />
          {/each}
          {#each profil.osi as os, indeks}
            <line x1={srediste} y1={srediste} x2={koordinata(100, indeks).split(',')[0]} y2={koordinata(100, indeks).split(',')[1]} class="dnk-os" />
            <text x={koordinata(116, indeks).split(',')[0]} y={koordinata(116, indeks).split(',')[1]} class="dnk-oznaka" text-anchor="middle" dominant-baseline="middle">{os.naziv}</text>
          {/each}
          <polygon points={tockeZaOsi()} class="dnk-podrucje" />
          {#each profil.osi as os, indeks}
            <circle cx={koordinata(os.vrijednost, indeks).split(',')[0]} cy={koordinata(os.vrijednost, indeks).split(',')[1]} r="4" class="dnk-tocka" />
          {/each}
        </svg>
      </div>
      <div class="dnk-osi">
        {#each profil.osi as os}
          <div class="dnk-redak">
            <div class="dnk-redak-zaglavlje">
              <strong>{os.naziv}</strong>
              <span>{os.vrijednost}</span>
            </div>
            <div class="dnk-traka" aria-label={`${os.naziv}: ${os.vrijednost} od 100`}>
              <span style={`width: ${os.vrijednost}%`}></span>
            </div>
            <small>
              {os.oznaka}
              {#if os.kljuc !== 'duge_rijeci' && os.kljuc !== 'rijetke_rijeci'} · {os.detalj}{/if}
            </small>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="dnk-zakljucano">
      <div class="zakljucani-graf" aria-hidden="true">✦</div>
      <div>
        <strong>DNK se tek oblikuje</strong>
        <p>Odigraj još {profil.preostaloDoOtkljucavanja} javnih partija da otključaš svoj profil igre.</p>
      </div>
    </div>
  {/if}
</section>

<style>
  .dnk-kartica {
    margin-bottom: 20px;
    padding: 20px;
    border: 1px solid #e5ddc8;
    border-radius: 8px;
    background: #fff;
  }

  .dnk-zaglavlje,
  .dnk-redak-zaglavlje {
    display: flex;
    align-items: flex-start;
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
    font-size: 1.5rem;
  }

  .dnk-status {
    padding: 5px 10px;
    border-radius: var(--radijus-pill);
    background: #f3eee2;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mikro);
    font-weight: 700;
    text-align: right;
  }

  .dnk-status.otkljucan {
    background: #e1f1e9;
    color: var(--boja-mint-tamni);
  }

  .dnk-sadrzaj {
    display: grid;
    grid-template-columns: minmax(230px, 0.9fr) minmax(220px, 1.1fr);
    align-items: center;
    gap: 24px;
    margin-top: 10px;
  }

  .graf-omotac {
    width: min(100%, 330px);
    margin: 0 auto;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .dnk-prsten {
    fill: none;
    stroke: #eadfca;
    stroke-width: 1;
  }

  .dnk-os {
    stroke: #dfd5c2;
    stroke-width: 1;
  }

  .dnk-oznaka {
    fill: var(--boja-tekst-sekundarni);
    font-size: 11px;
    font-weight: 700;
  }

  .dnk-podrucje {
    fill: rgb(228 87 46 / 22%);
    stroke: var(--boja-akcent);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }

  .dnk-tocka {
    fill: var(--boja-akcent);
    stroke: #fff;
    stroke-width: 2;
  }

  .dnk-osi {
    display: grid;
    gap: 12px;
  }

  .dnk-redak-zaglavlje {
    align-items: baseline;
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-mali);
  }

  .dnk-redak-zaglavlje span {
    color: var(--boja-akcent);
    font-weight: 800;
  }

  .dnk-traka {
    height: 7px;
    margin-top: 5px;
    overflow: hidden;
    border-radius: var(--radijus-pill);
    background: #eee8dc;
  }

  .dnk-traka span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--boja-mint);
  }

  .dnk-redak small {
    display: block;
    margin-top: 3px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .dnk-zakljucano {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 16px;
    padding: 18px;
    background: #faf7ef;
  }

  .zakljucani-graf {
    display: grid;
    width: 54px;
    height: 54px;
    flex: 0 0 54px;
    place-items: center;
    border: 2px dashed var(--boja-zuta-krema);
    border-radius: 50%;
    color: var(--boja-akcent);
    font-size: 1.6rem;
  }

  .dnk-zakljucano p {
    margin: 4px 0 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }

  @media (max-width: 640px) {
    .dnk-kartica { padding: 16px; }
    .dnk-zaglavlje { flex-direction: column; }
    .dnk-status { align-self: flex-start; }
    .dnk-sadrzaj { grid-template-columns: 1fr; gap: 12px; }
    .graf-omotac { max-width: 300px; }
  }
</style>
