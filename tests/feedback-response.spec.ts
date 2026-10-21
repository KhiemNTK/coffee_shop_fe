import { expect, test } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '93000000-0000-4000-8000-000000000001'
const reply = 'Quán đã liên hệ và xử lý phản hồi của bạn.'
const date = '2026-10-20T08:00:00Z'

test('receipt tracking displays the public reply without internal staff details or a second feedback form', async ({
  page,
}, info) => {
  await page.route('**/api/v1/orders/takeaway/pickup/status', (route) =>
    route.fulfill({
      json: envelope({
        invoiceId: id,
        status: 'COLLECTED',
        expiresAt: '2030-01-01T00:00:00Z',
        items: [],
        feedback: {
          id,
          rating: 1,
          comment: 'Nhận món chậm',
          createdAt: date,
          resolvedAt: date,
          customerReply: reply,
          resolutionNote: 'Private internal note',
          resolvedById: id,
        },
      }),
    }),
  )
  await page.goto(`/pickup#invoiceId=${id}&code=${'a'.repeat(43)}`)
  await expect(page.getByRole('region', { name: 'Phản hồi và trả lời từ quán' })).toContainText(
    reply,
  )
  await expect(page.getByText('Private internal note')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Gửi đánh giá', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('public-feedback-response.png'), fullPage: true })
})

test('staff separates the internal note from the public reply and retries an uncertain resolution unchanged', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(['/reports_read', '/feedback_resolve'])) }),
  )
  const writes: unknown[] = []
  await page.route('**/api/v1/orders/takeaway/feedback/cases?*', (route) =>
    route.fulfill({
      json: envelope({
        list:
          writes.length >= 2
            ? []
            : [
                {
                  id,
                  invoice: { invoiceNumber: 'CASE-001' },
                  rating: 1,
                  comment: 'Nhận món chậm',
                  createdAt: date,
                },
              ],
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
      }),
    }),
  )
  await page.route(`**/api/v1/orders/takeaway/feedback/${id}/resolve`, (route) => {
    writes.push(route.request().postDataJSON())
    return writes.length === 1
      ? route.abort()
      : route.fulfill({ json: envelope({ id, resolvedAt: date }) })
  })
  await page.goto('/staff/reconciliation?tab=feedback')
  await page.getByRole('button', { name: 'Xử lý', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Ghi chú xử lý nội bộ').fill('Đã trao đổi nội bộ với trưởng ca')
  await dialog.getByLabel('Trả lời công khai cho khách (không bắt buộc)').fill(reply)
  await dialog.getByRole('button', { name: 'Xác nhận đã xử lý', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByLabel('Ghi chú xử lý nội bộ')).toBeDisabled()
  await expect(dialog.getByLabel('Trả lời công khai cho khách (không bắt buộc)')).toBeDisabled()
  await dialog.getByRole('button', { name: 'Xác nhận đã xử lý', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toEqual([
    { resolutionNote: 'Đã trao đổi nội bộ với trưởng ca', customerReply: reply },
    { resolutionNote: 'Đã trao đổi nội bộ với trưởng ca', customerReply: reply },
  ])
})
