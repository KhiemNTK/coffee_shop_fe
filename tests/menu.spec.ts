import { expect, test, type Page } from '@playwright/test'

const category = { id: '10000000-0000-4000-8000-000000000001', name: 'Cà phê' }
const item = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Cà phê sữa đá',
  price: 35000,
  category,
  optionGroups: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'Thêm vị',
      minSelected: 0,
      maxSelected: 1,
      options: [
        {
          id: '40000000-0000-4000-8000-000000000001',
          name: 'Sữa tươi',
          priceDelta: 5000.5,
        },
      ],
    },
  ],
}
const result = { list: [item], totalPages: 1, totalItems: 1, currentPage: 1 }
const envelope = (data: unknown) => ({ errors: null, data, message: 'OK' })

test('a shrinking catalog does not strand the user on an empty page', async ({
  page,
}) => {
  await mockCategories(page)
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({
      json: envelope(
        new URL(route.request().url()).searchParams.get('page') === '2'
          ? { list: [], currentPage: 2, totalItems: 1, totalPages: 1 }
          : { ...result, totalPages: 2, totalItems: 13 },
      ),
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await page.getByRole('button', { name: 'Về trang đầu' }).click()
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible()
})

test('category failure does not hide the menu and has its own retry', async ({
  page,
}) => {
  let failed = true
  await page.route('**/api/v1/menu/public/categories', (route) =>
    failed
      ? route.fulfill({ status: 503 })
      : route.fulfill({ json: envelope([category]) }),
  )
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({ json: envelope(result) }),
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible()
  failed = false
  await page.getByRole('button', { name: 'Thử lại danh mục' }).click()
  await expect(
    page.getByRole('button', { name: category.name, exact: true }),
  ).toBeVisible()
})

test('unsafe numeric prices are rejected instead of rounded', async ({
  page,
}) => {
  await mockCategories(page)
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({
      json: envelope({
        ...result,
        list: [{ ...item, price: Number.MAX_SAFE_INTEGER }],
      }),
    }),
  )
  await page.goto('/')
  await expect(page.getByRole('alert')).toBeVisible()
})

async function mockCategories(page: Page) {
  await page.route('**/api/v1/menu/public/categories', (route) =>
    route.fulfill({ json: envelope([category]) }),
  )
}

test('menu, exact prices, options and responsive layout', async ({
  page,
}, testInfo) => {
  await mockCategories(page)
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({ json: envelope(result) }),
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible()
  await expect(page.getByText('35.000 ₫', { exact: true })).toBeVisible()
  await page.getByText('Tùy chọn món').click()
  await expect(page.getByText('+5.000,50 ₫', { exact: true })).toBeVisible()
  const cover = page.locator('.menu-cover img')
  await expect(cover).toHaveJSProperty('complete', true)
  expect(
    await cover.evaluate((node) => (node as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('menu.png'),
    fullPage: true,
  })
})

test('filters and pagination are sent to the API; filtering resets page', async ({
  page,
}) => {
  await mockCategories(page)
  await page.route('**/api/v1/menu/public/items?*', (route) => {
    const query = new URL(route.request().url()).searchParams
    return route.fulfill({
      json: envelope({
        ...result,
        totalPages: 2,
        totalItems: 13,
        currentPage: Number(query.get('page')),
      }),
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page.getByText('Trang 2 / 2')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Tìm món' }).fill('sữa')
  const search = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get('keyword') === 'sữa',
  )
  await page.getByRole('button', { name: 'Tìm', exact: true }).click()
  expect(new URL((await search).url()).searchParams.get('page')).toBe('1')
  await expect(page.getByText('Trang 1 / 2')).toBeVisible()
  const categoryRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).searchParams.get('categoryId') === category.id,
  )
  await page.getByRole('button', { name: category.name, exact: true }).click()
  expect(
    new URL((await categoryRequest).url()).searchParams.get('itemPerPage'),
  ).toBe('12')
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await expect(page.getByRole('searchbox')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Tất cả' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('API failure is recoverable without leaking server details', async ({
  page,
}) => {
  await mockCategories(page)
  let failed = true
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { secret: 'internal-sensitive-error' },
        })
      : route.fulfill({ json: envelope(result) }),
  )
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Chưa tải được thực đơn')
  await expect(page.getByText('internal-sensitive-error')).toHaveCount(0)
  failed = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible()
})

test('malformed response fails closed', async ({ page }) => {
  await mockCategories(page)
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({
      json: envelope({ ...result, list: [{ ...item, price: 'not-money' }] }),
    }),
  )
  await page.goto('/')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(0)
})

test('empty filtered results can be reset', async ({ page }) => {
  await mockCategories(page)
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({
      json: envelope(
        new URL(route.request().url()).searchParams.has('keyword')
          ? { list: [], currentPage: 1, totalItems: 0, totalPages: 0 }
          : result,
      ),
    }),
  )
  await page.goto('/')
  await page.getByRole('searchbox').fill('Không tồn tại')
  await page.getByRole('button', { name: 'Tìm', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Không tìm thấy món phù hợp' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Xóa bộ lọc', exact: true })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible()
})

test('decimal strings preserve minor units and large exact values', async ({
  page,
}) => {
  await mockCategories(page)
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({
      json: envelope({
        ...result,
        list: [{ ...item, price: '999999999999999.99' }],
      }),
    }),
  )
  await page.goto('/')
  await expect(
    page.getByText('999.999.999.999.999,99 ₫', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
