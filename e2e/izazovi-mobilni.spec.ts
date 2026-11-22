import { expect, test } from '@playwright/test';

test('mobilni: level tabovi 2×2 wrap i kartice bez horizontalnog scrolla', async ({ page }) => {
  await page.goto('/izazovi');
  await expect(page.getByRole('heading', { name: 'Izazovi' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('izazov-level-tabovi')).toBeVisible();
  await expect(page.getByTestId('izazov-level-1')).toBeVisible();
  await expect(page.getByTestId('izazov-level-4')).toBeVisible();
  await expect(page.getByTestId('izazov-kartica-IZ-L1-DV-01')).toBeVisible();
  await expect(page.getByTestId('izazov-kartica-IZ-L1-DV-05')).toHaveAttribute('data-status', 'zakljucan');

  const nemaHorizontalnog = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(nemaHorizontalnog).toBe(true);
});
