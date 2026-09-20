import { test, expect } from '@playwright/test';
import { visitEditor, exportPdf } from './pw-helpers.js';

test.describe('Exported PDF — Cover Letter Customizations', () => {

  test('Cover Letter: exports recipient, subject, custom body, and signature', async ({ page }) => {
    await visitEditor(page, 'classic', {
      tab: 'coverletter',
      coverLetter: {
        recipientName: 'Evelyn Vance',
        recipientTitle: 'Director of People',
        company: 'Stripe, Inc.',
        date: '20 February 2026',
        subject: 'Staff Infrastructure Engineer Candidacy',
        body: '<p>Dear Evelyn,</p><p>I am eager to contribute to Stripe’s core payment infrastructure.</p>',
        closing: 'Warm regards',
        signatureName: 'Alex Johnson',
        signatureDesignation: 'Lead Infrastructure Engineer',
      },
    });

    const { runs, text } = await exportPdf(page);
    expect(runs.length).toBeGreaterThan(5);

    // Verify all customized fields in the exported PDF
    expect(text).toContain('Evelyn Vance');
    expect(text).toContain('Director of People');
    expect(text).toContain('Stripe, Inc.');
    expect(text).toContain('February 2026');
    expect(text).toContain('Staff Infrastructure Engineer Candidacy');
    expect(text).toContain('Stripe’s core payment infrastructure');
    expect(text).toContain('Warm regards');
    expect(text).toContain('Lead Infrastructure Engineer');
  });

  test('Cover Letter Generator: auto-tailors letter from resume and exports into PDF', async ({ page }) => {
    await visitEditor(page, 'classic', { tab: 'coverletter' });

    // Click Auto-Generate from Resume button
    const genBtn = page.locator('button:has-text("Auto-Generate from Resume")');
    await expect(genBtn).toBeVisible();
    await genBtn.click();

    // Fill target company and role in the modal
    const companyInput = page.locator('input[placeholder*="Google, Stripe"]');
    await companyInput.fill('Airbnb');

    const applyBtn = page.locator('button:has-text("Apply to Cover Letter")');
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Export PDF and verify the applied content reached the exported PDF
    const { text } = await exportPdf(page);
    expect(text).toContain('Airbnb');
    expect(text).toContain('Alex Johnson');
  });

});
