<script lang="ts">
  import type {
    GoalProgressIzazova,
    IzazovPartijaMeta,
    PravilnikPartije,
  } from 'zajednicko';
  import { PRAG_DUGE_RIJECI_IZAZOVA } from 'zajednicko';
  import { pocetniGoalProgressIzazova } from '$lib/izazovi-klijent.js';

  let {
    napredak,
    meta = null,
    // zadržano radi pozivatelja; pravila se više ne prikazuju u ovoj traci
    pravila: _pravila = null,
  }: {
    napredak: GoalProgressIzazova | null;
    meta?: IzazovPartijaMeta | null;
    pravila?: PravilnikPartije | null;
  } = $props();

  const tvojPotezSek = $derived(
    meta ? Math.round(meta.humanTurnDurationMs / 1000) : null,
  );

  /**
   * Uvjeti (required) uvijek iz kataloga — inače prazan/kasni server progress
   * sakrije npr. Duge 0/n do prvog poteza. Brojači (current/met) iz napretka.
   */
  const efektivniNapredak = $derived.by((): GoalProgressIzazova | null => {
    if (!meta) return napredak;
    const baza = pocetniGoalProgressIzazova(meta.challengeId);
    if (!napredak) return baza;
    return {
      bezPogreske: {
        required: baza.bezPogreske.required,
        met: napredak.bezPogreske.met,
      },
      bezZavrsavanjaNaKa: {
        required: baza.bezZavrsavanjaNaKa.required,
        met: napredak.bezZavrsavanjaNaKa?.met ?? baza.bezZavrsavanjaNaKa.met,
      },
      dugeRijeci: {
        required: baza.dugeRijeci.required,
        current: napredak.dugeRijeci.current,
        met: napredak.dugeRijeci.met,
      },
      rijetkeRijeci: {
        required: baza.rijetkeRijeci.required,
        current: napredak.rijetkeRijeci.current,
        met: napredak.rijetkeRijeci.met,
      },
      uspjesanDokaz: {
        required: baza.uspjesanDokaz.required,
        current: napredak.uspjesanDokaz.current,
        met: napredak.uspjesanDokaz.met,
      },
      sviCiljeviIspunjeni: napredak.sviCiljeviIspunjeni,
    };
  });

  const posebniUvjeti = $derived.by(() => {
    const stavke: { tekst: string; testId?: string }[] = [];
    if (tvojPotezSek != null && tvojPotezSek > 0) {
      stavke.push({ tekst: `Tvoj potez: ${tvojPotezSek} s` });
    }
    const gp = efektivniNapredak;
    if (gp?.bezPogreske.required) {
      stavke.push({
        tekst: gp.bezPogreske.met
          ? 'Bez pogrešne riječi — zasad ispunjeno'
          : 'Bez pogrešne riječi',
        testId: 'izazov-uvjet-bez-pogreske',
      });
    }
    if (gp?.bezZavrsavanjaNaKa?.required) {
      stavke.push({
        tekst: gp.bezZavrsavanjaNaKa.met
          ? 'Ne završi na ka — zasad ispunjeno'
          : 'Ne završi na ka',
        testId: 'izazov-uvjet-bez-ka',
      });
    }
    if (gp && gp.dugeRijeci.required > 0) {
      stavke.push({
        tekst: `Duge (≥${PRAG_DUGE_RIJECI_IZAZOVA}): ${gp.dugeRijeci.current}/${gp.dugeRijeci.required}`,
        testId: 'izazov-uvjet-duge',
      });
    }
    if (
      gp &&
      !gp.bezPogreske.required &&
      !gp.bezZavrsavanjaNaKa?.required &&
      gp.dugeRijeci.required === 0
    ) {
      stavke.push({ tekst: 'Pobijedi' });
    } else if (!gp) {
      stavke.push({ tekst: 'Pobijedi' });
    }
    return stavke;
  });
</script>

{#if posebniUvjeti.length > 0}
  <aside class="ciljevi-izazova" aria-label="Uvjeti izazova" data-testid="izazov-ciljevi">
    <p class="uvjeti-reda" data-testid="izazov-uvjeti-naslov">
      <span class="uvjeti-oznaka">Posebni uvjeti:</span>
      {#each posebniUvjeti as stavka, i (stavka.testId ?? stavka.tekst)}
        {#if i > 0}<span class="razdjelnik" aria-hidden="true">·</span>{/if}
        <span data-testid={stavka.testId}>{stavka.tekst}</span>
      {/each}
    </p>
  </aside>
{/if}

<style>
  .ciljevi-izazova {
    width: 100vw;
    margin: 0 0 10px;
    margin-left: calc(50% - 50vw);
    padding: 10px max(16px, calc(50vw - 50%));
    border: 1px solid var(--boja-obrub);
    border-bottom: none;
    border-radius: 0 0 8px 8px;
    background: var(--boja-povrsina-2);
    font-size: var(--tekst-mali);
    box-sizing: border-box;
  }
  .uvjeti-reda {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 6px;
    row-gap: 2px;
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
    line-height: 1.35;
  }
  .uvjeti-oznaka {
    color: var(--boja-tekst-osnovni);
    font-weight: 800;
  }
  .razdjelnik {
    font-weight: 700;
    opacity: 0.7;
  }
</style>
