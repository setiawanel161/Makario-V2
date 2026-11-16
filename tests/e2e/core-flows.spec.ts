import { expect, test } from '@playwright/test';

function findPageId(value: unknown, title: string): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const id = findPageId(entry, title);
      if (id !== null) return id;
    }
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  if ('title' in value && value.title === title && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  if ('children' in value) return findPageId(value.children, title);
  if ('pages' in value) return findPageId(value.pages, title);
  if ('page' in value) return findPageId(value.page, title);
  return null;
}

test('health, demo onboarding, editor, database layouts, and template cloning', async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(30_000);

  const health = await page.request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toMatchObject({ status: 'ok', database: 'connected' });
  const headers = health.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');

  const unique = `${Date.now()}`;
  await page.goto('/login', { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Enter workspace' })).toBeVisible();
  const demoEmail = `e2e-${unique}@makario.local`;
  await page.getByLabel('Your name').fill('E2E Builder');
  await page.getByLabel('Demo email').fill(demoEmail);
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.waitForLoadState('networkidle');

  const workspaceName = `E2E Workspace ${unique}`;
  await page.locator('input[name="preset"][value="TEAM"]').check({ force: true });
  await page.getByLabel('Workspace name').fill(workspaceName);
  await expect(page.getByRole('button', { name: 'Create workspace' })).toBeEnabled();
  const provisionResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/workspaces') &&
      response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: 'Create workspace' }).click();
  const provisionResponse = await provisionResponsePromise;
  expect(provisionResponse.status()).toBe(201);
  const provisionPayload: unknown = await provisionResponse.json();
  if (
    typeof provisionPayload !== 'object' ||
    provisionPayload === null ||
    !('workspace' in provisionPayload) ||
    typeof provisionPayload.workspace !== 'object' ||
    provisionPayload.workspace === null ||
    !('id' in provisionPayload.workspace) ||
    typeof provisionPayload.workspace.id !== 'string' ||
    !('slug' in provisionPayload.workspace) ||
    typeof provisionPayload.workspace.slug !== 'string'
  ) {
    throw new Error('Workspace provisioning returned no workspace slug.');
  }
  const workspaceId = provisionPayload.workspace.id;
  const workspaceSlug = provisionPayload.workspace.slug;
  const treeResponse = await page.request.get(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/pages/tree`,
  );
  expect(treeResponse.ok()).toBeTruthy();
  const tasksPageId = findPageId(await treeResponse.json(), 'Tasks');
  expect(tasksPageId).not.toBeNull();
  await page.goto(`/${workspaceSlug}`, { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(new RegExp(`/${workspaceSlug}$`));
  await page.goto(`/${workspaceSlug}/${tasksPageId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('textbox', { name: 'Page title' })).toHaveValue('Tasks');

  const pageCreateResponsePromise = page.waitForResponse(
    (response) =>
      /\/api\/workspaces\/[^/]+\/pages$/.test(response.url()) &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add page' }).click();
  const pageCreateResponse = await pageCreateResponsePromise;
  expect(pageCreateResponse.status()).toBe(201);
  const createPagePayload: unknown = await pageCreateResponse.json();
  const createdPageId = findPageId(createPagePayload, 'Untitled');
  expect(createdPageId).not.toBeNull();
  await page.goto(`/${workspaceSlug}/${createdPageId}`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: '+ Add a block' }).click();
  const paragraph = page.getByRole('textbox', { name: 'paragraph block content' });
  await expect(paragraph).toBeVisible();
  await paragraph.press('/');
  await page.getByRole('option', { name: /To-do/ }).click();
  await page.getByRole('textbox', { name: 'todo block content' }).fill('Complete E2E task');
  await page.getByRole('checkbox', { name: 'Mark to-do complete' }).check();

  await expect
    .poll(
      async () => {
        const response = await page.request.get('/api/gamification/profile');
        if (!response.ok()) return 0;
        const payload: unknown = await response.json();
        if (
          typeof payload !== 'object' ||
          payload === null ||
          !('profile' in payload) ||
          typeof payload.profile !== 'object' ||
          payload.profile === null ||
          !('totalXp' in payload.profile) ||
          typeof payload.profile.totalXp !== 'number'
        ) {
          return 0;
        }
        return payload.profile.totalXp;
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(60);

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'todo block content' })).toHaveValue(
    'Complete E2E task',
  );
  await expect(page.getByRole('checkbox', { name: 'Mark to-do complete' })).toBeChecked();

  await page.goto(`/${workspaceSlug}/${tasksPageId}`, { waitUntil: 'networkidle' });
  for (const [layout, label] of [
    ['TABLE', 'Table'],
    ['BOARD', 'Board'],
    ['CALENDAR', 'Calendar'],
    ['TIMELINE', 'Timeline'],
    ['GALLERY', 'Gallery'],
  ] as const) {
    const tab = page.getByRole('button', { name: label, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
    if (layout === 'TIMELINE') {
      await expect(page.getByRole('region', { name: 'Database timeline' })).toBeVisible();
    }
    if (layout === 'GALLERY') {
      await expect(page.getByRole('region', { name: 'Database gallery' })).toBeVisible();
    }
  }

  await page.goto(`/${workspaceSlug}/${createdPageId}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Share' }).click();
  const shareDialog = page.getByRole('dialog', { name: 'Share page' });
  await expect(shareDialog).toBeVisible();
  const duplicatePermission = page.getByRole('checkbox', {
    name: 'Allow Duplicate as Template',
  });
  await duplicatePermission.check();
  await expect(duplicatePermission).toBeChecked();
  await expect(shareDialog).toBeVisible();
  const publishResponsePromise = page.waitForResponse(
    (response) =>
      /\/api\/pages\/[^/]+\/publish$/.test(response.url()) &&
      response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /Publish/ }).click();
  expect((await publishResponsePromise).status()).toBe(200);
  const publicLink = page.getByLabel('Public page link');
  await expect(publicLink).toBeVisible();
  const publicPath = await publicLink.inputValue();
  await page.goto(publicPath, { waitUntil: 'networkidle' });
  await expect(page.getByText('Complete E2E task')).toBeVisible();
  await page.getByRole('button', { name: 'Duplicate as Template' }).click();
  await page.getByRole('button', { name: 'Copy template' }).click();
  await expect(page).toHaveURL(new RegExp(`/${workspaceSlug}/[^/]+$`));
  await expect(page.getByRole('textbox', { name: 'Page title' })).toHaveValue('Untitled');
  await expect(page.getByRole('textbox', { name: 'todo block content' })).toHaveValue(
    'Complete E2E task',
  );
});
