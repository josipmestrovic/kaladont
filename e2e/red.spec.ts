import { test } from '@playwright/test';
import { cekajIstuPartiju, stvoriIgrace, udjiUJavniRed, zatvoriIgrace } from './pomocnici/igraci.js';

test('četiri igrača ulaze u javni red i dobivaju isti stol', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 4);
  try {
    await udjiUJavniRed(igraci, 'cetiri_igraca');
    await cekajIstuPartiju(igraci);
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('dva igrača ulaze u javni red i dobivaju isti stol', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 2);
  try {
    await udjiUJavniRed(igraci, 'dva_igraca');
    await cekajIstuPartiju(igraci);
  } finally {
    await zatvoriIgrace(igraci);
  }
});