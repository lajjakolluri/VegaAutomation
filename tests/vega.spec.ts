// tests/auth-simple.spec.ts
import { test } from '@playwright/test';
import { VegaAuthPage } from './app/NavigationPage';

test.describe('Vega Auth - Simple Signup Test', () => {
  
  test('complete signup with generated user', async ({ page }) => {
    const authPage = new VegaAuthPage(page);
    const testUser = VegaAuthPage.generateTestUser();

    console.log('Test user:', testUser);

    await authPage.completeSignup(testUser);
    await authPage.verifySignupSuccess();
  });
});