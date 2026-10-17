import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const category = { id: '20000000-0000-4000-8000-000000000010', name: 'Coffee' }
const item = {
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Image drink',
  price: '35000',
  isAvailable: true,
  categoryId: category.id,
  category,
  kitchenStationId: null,
  imageUrl: null,
}
const paged = (list: unknown[]) => ({
  list,
  currentPage: 1,
  totalItems: list.length,
  totalPages: 1,
})
const policy = {
  enabled: true,
  maxBytes: 2 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
}
const uploaded = {
  id: '40000000-0000-4000-8000-000000000001',
  url: 'https://images.example.test/storage/v1/object/public/menu-images/managed-menu/test.webp',
  expiresAt: '2030-10-18T00:00:00.000Z',
}
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII=',
  'base64',
)
const imageFile = { name: 'drink.png', mimeType: 'image/png', buffer: png }

let browserErrors: string[]
test.beforeEach(({ page }) => {
  browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:'))
      browserErrors.push(message.text())
  })
})
test.afterEach(() => {
  expect(browserErrors).toEqual([])
})

async function open(
  page: Page,
  purpose: 'create' | 'update' = 'update',
  keys = ['/menu_read', `/menu_${purpose}`],
) {
  await page
    .context()
    .addCookies([{ name: 'csrfToken', value: 'image-csrf', domain: 'localhost', path: '/' }])
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(keys)) }),
  )
  await page.route('**/api/v1/menu/items?**', (route) =>
    route.fulfill({ json: envelope(paged([item])) }),
  )
  await page.route(`**/api/v1/menu/items/${item.id}`, (route) =>
    route.fulfill({ json: envelope(item) }),
  )
  await page.route('**/api/v1/menu/categories?**', (route) =>
    route.fulfill({ json: envelope(paged([category])) }),
  )
  await page.route(uploaded.url, (route) => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('https://legacy.example.test/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: png }),
  )
  await page.goto('/staff/menu')
  await expect(page.getByText(item.name, { exact: true })).toBeVisible()
  if (purpose === 'update') await page.getByTitle('Sửa thông tin món').click()
  else await page.getByRole('button', { name: 'Tạo món mới', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Tên món', { exact: true })).toBeVisible()
  if (purpose === 'create') {
    await dialog.getByLabel('Tên món', { exact: true }).fill('New image drink')
    await dialog.getByLabel('Đơn giá (VNĐ)').fill('35000')
    await dialog
      .getByRole('combobox', { name: 'Danh mục món', exact: true })
      .selectOption(category.id)
  }
  return dialog
}

async function chooseUpload(page: Page) {
  await page.getByRole('button', { name: 'Chọn từ máy', exact: true }).click()
  return page.getByLabel('Chọn ảnh JPEG, PNG hoặc WebP (tối đa 2 MB)', { exact: true })
}

test('manual URL workflow does not depend on Supabase and still sends JSON with CSRF', async ({
  page,
}) => {
  let policyReads = 0
  await page.route('**/api/v1/menu/images/policy', (route) => {
    policyReads++
    return route.abort()
  })
  const dialog = await open(page)
  let writes = 0
  await page.route(`**/api/v1/menu/items/${item.id}`, (route) => {
    writes++
    expect(route.request().headers()['content-type']).toContain('application/json')
    expect(route.request().headers()['x-csrf-token']).toBe('image-csrf')
    expect(route.request().postDataJSON()).toEqual({
      imageUrl: 'https://legacy.example.test/drink.jpg',
    })
    return route.fulfill({ json: envelope(item) })
  })
  await dialog.getByLabel('Ảnh món (HTTPS)', { exact: true }).fill('not-a-url')
  await expect(dialog.getByLabel('Tên món', { exact: true })).toBeVisible()
  await dialog
    .getByLabel('Ảnh món (HTTPS)', { exact: true })
    .fill('https://legacy.example.test/drink.jpg')
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(writes).toBe(1)
  expect(policyReads).toBe(0)
})

test('disabled and failed capability reads retain URL entry and can be refreshed', async ({
  page,
}) => {
  let state = 'disabled'
  await page.route('**/api/v1/menu/images/policy', (route) =>
    route.fulfill({
      status: state === 'error' ? 503 : 200,
      json: envelope({ ...policy, enabled: state === 'enabled' }),
    }),
  )
  const dialog = await open(page)
  const picker = await chooseUpload(page)
  await expect(dialog).toContainText('Chức năng tải ảnh chưa được bật')
  await expect(picker).toHaveCount(0)
  state = 'error'
  await dialog.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  state = 'enabled'
  await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(picker).toBeVisible()
  await dialog.getByRole('button', { name: 'URL ảnh', exact: true }).click()
  await expect(dialog.getByLabel('Ảnh món (HTTPS)', { exact: true })).toBeEnabled()
})

for (const purpose of ['create', 'update'] as const) {
  test(`${purpose} uploads once, blocks dismissal and saves only the returned HTTPS URL`, async ({
    page,
  }, info) => {
    await page.route('**/api/v1/menu/images/policy', (route) =>
      route.fulfill({ json: envelope(policy) }),
    )
    const dialog = await open(page, purpose)
    const save = dialog.getByRole('button', {
      name: purpose === 'create' ? 'Tạo món' : 'Lưu thay đổi',
      exact: true,
    })
    const picker = await chooseUpload(page)
    await picker.setInputFiles(imageFile)
    await expect(dialog.getByAltText('Ảnh món xem trước')).toHaveAttribute('src', /^blob:/)
    await expect(save).toBeDisabled()
    await dialog.getByRole('button', { name: 'Gỡ ảnh khỏi bản nháp' }).click()
    await picker.setInputFiles(imageFile)
    await expect(save).toBeDisabled()
    let uploads = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(`**/api/v1/menu/images/${purpose}`, async (route) => {
      uploads++
      expect(route.request().headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/)
      expect(route.request().headers()['x-csrf-token']).toBe('image-csrf')
      expect(route.request().postDataBuffer()!.includes(png)).toBe(true)
      await gate
      await route.fulfill({ status: 201, json: envelope(uploaded) })
    })
    await dialog.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Đang tải ảnh…', exact: true })).toBeDisabled()
    await expect(save).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Đóng', exact: true }).last()).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    release()
    await expect(dialog.getByRole('status')).toContainText('Ảnh đã tải lên, món chưa được lưu.')
    await expect(dialog.getByLabel('Ảnh món (HTTPS)', { exact: true })).toHaveValue(uploaded.url)
    await expect(save).toBeEnabled()
    expect(uploads).toBe(1)
    const preview = dialog.getByAltText('Ảnh món xem trước')
    await expect(preview).toHaveJSProperty('complete', true)
    expect(
      await preview.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await page.screenshot({ path: info.outputPath(`menu-image-${purpose}.png`), fullPage: true })
    let saves = 0
    await page.route(
      `**/api/v1/menu/items${purpose === 'update' ? '/' + item.id : ''}`,
      (route) => {
        saves++
        expect(route.request().headers()['content-type']).toContain('application/json')
        expect(route.request().postDataJSON().imageUrl).toBe(uploaded.url)
        return route.fulfill({ json: envelope(item) })
      },
    )
    await save.click()
    await expect(dialog).not.toBeVisible()
    expect(saves).toBe(1)
  })
}

test('invalid and oversized files never upload; server 413 keeps the draft for correction', async ({
  page,
}) => {
  await page.route('**/api/v1/menu/images/policy', (route) =>
    route.fulfill({ json: envelope(policy) }),
  )
  const dialog = await open(page)
  const picker = await chooseUpload(page)
  let uploads = 0
  await page.route('**/api/v1/menu/images/update', (route) => {
    uploads++
    return route.fulfill({ status: 413 })
  })
  for (const input of [
    { name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
    { ...imageFile, buffer: Buffer.alloc(policy.maxBytes + 1) },
  ]) {
    await picker.setInputFiles(input)
    await expect(dialog.getByRole('alert')).toContainText('Chọn ảnh JPEG, PNG hoặc WebP hợp lệ')
    await expect(dialog.getByRole('button', { name: 'Tải ảnh lên', exact: true })).toBeDisabled()
  }
  expect(uploads).toBe(0)
  await picker.setInputFiles(imageFile)
  await dialog.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Tệp tải lên quá lớn')
  await expect(dialog.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Tải ảnh lên', exact: true })).toBeEnabled()
  expect(uploads).toBe(1)
})

test('multipart retry after authentication refresh preserves file bytes and CSRF', async ({
  page,
}) => {
  await page.route('**/api/v1/menu/images/policy', (route) =>
    route.fulfill({ json: envelope(policy) }),
  )
  const dialog = await open(page)
  let uploads = 0
  let refreshes = 0
  await page.route('**/api/v1/auth/refresh', (route) => {
    refreshes++
    return route.fulfill({ json: envelope({}) })
  })
  await page.route('**/api/v1/menu/images/update', (route) => {
    uploads++
    expect(route.request().postDataBuffer()!.includes(png)).toBe(true)
    expect(route.request().headers()['x-csrf-token']).toBe('image-csrf')
    return route.fulfill({
      status: uploads === 1 ? 401 : 201,
      json: uploads === 1 ? {} : envelope(uploaded),
    })
  })
  await (await chooseUpload(page)).setInputFiles(imageFile)
  await dialog.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click()
  await expect(dialog.getByLabel('Ảnh món (HTTPS)', { exact: true })).toHaveValue(uploaded.url)
  expect(uploads).toBe(2)
  expect(refreshes).toBe(1)
})

test('expired upload cannot silently save a menu item and can be replaced', async ({ page }) => {
  await page.route('**/api/v1/menu/images/policy', (route) =>
    route.fulfill({ json: envelope(policy) }),
  )
  const dialog = await open(page)
  await page.route('**/api/v1/menu/images/update', (route) =>
    route.fulfill({ status: 201, json: envelope(uploaded) }),
  )
  await (await chooseUpload(page)).setInputFiles(imageFile)
  await dialog.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click()
  await expect(dialog.getByLabel('Ảnh món (HTTPS)', { exact: true })).toHaveValue(uploaded.url)
  let writes = 0
  await page.route(`**/api/v1/menu/items/${item.id}`, (route) => {
    writes++
    return route.fulfill({
      status: 409,
      json: { code: 'IMAGE_UPLOAD_NOT_AVAILABLE', errors: [{ message: 'expired' }] },
    })
  })
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Ảnh tải lên không còn khả dụng')
  await expect(dialog.getByLabel('Ảnh món (HTTPS)', { exact: true })).toHaveValue(uploaded.url)
  await expect(dialog.getByRole('button', { name: 'Chọn từ máy', exact: true })).toBeEnabled()
  expect(writes).toBe(1)
})
