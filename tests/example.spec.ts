import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class VegaAuthPage {
  readonly page: Page;
  readonly authUrl = 'https://admin.vegaevents.com/auth';

  readonly registerModeButton: Locator;
  readonly phoneInput: Locator;
  readonly nextButton: Locator;
  readonly otpInputs: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly termsCheckbox: Locator;
  readonly createAccountButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.registerModeButton = page.getByTestId('auth-mode-register');
    this.phoneInput = page.getByTestId('auth-input');
    this.nextButton = page.getByTestId('next-button');
    this.otpInputs = page.getByTestId('otp-input');
    this.firstNameInput = page.getByTestId('first-name-input');
    this.lastNameInput = page.getByTestId('last-name-input');
    this.usernameInput = page.getByTestId('username-input');
    this.emailInput = page.getByTestId('registration-email-input');
    this.termsCheckbox = page.getByTestId('terms-checkbox');
    this.createAccountButton = page.getByTestId('create-account-button');
  }

  async navigateToAuth() {
    await this.page.goto(this.authUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
  }

  async switchToRegisterMode() {
    await this.registerModeButton.click();
  }

  async enterPhoneNumber(phone: string) {
    await this.phoneInput.fill(phone);
    await this.nextButton.click();
  }

  /**
   * SOLUTION: API INTERCEPTION - Mock OTP verification
   * This bypasses the backend OTP validation entirely
   */
  async setupOTPBypass() {
    // Intercept ALL possible OTP verification endpoints
    const patterns = [
      '**/api/auth/verify-otp',
      '**/api/auth/verify',
      '**/api/verify-otp',
      '**/auth/verify-otp',
      '**/verify-otp',
      '**/otp/verify',
      '**/v1/auth/verify-otp'
    ];

    for (const pattern of patterns) {
      await this.page.route(pattern, async route => {
        console.log(`🔄 Intercepted: ${route.request().url()}`);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            verified: true,
            message: 'OTP verified successfully',
            token: 'mock-token-123'
          })
        });
      });
    }

    console.log('✅ OTP bypass configured for all verification endpoints');
  }

  /**
   * Smart OTP entry - works with any dummy OTP when bypass is active
   */
  async enterOTP(otp: string = '123456') {
    try {
      // Wait for OTP input to appear
      await this.otpInputs.first().waitFor({ 
        state: 'visible',
        timeout: 10000 
      });

      console.log(`📝 Entering OTP: ${otp}`);

      // Fill each OTP digit
      for (let i = 0; i < 6; i++) {
        await this.otpInputs.nth(i).fill(otp[i]);
        await this.page.waitForTimeout(100); // Small delay between inputs
      }

      // Auto-submit might trigger, or find submit button
      const submitButton = this.page.getByTestId('verify-otp-button')
        .or(this.page.getByRole('button', { name: /verify|submit|continue/i }));
      
      const isSubmitVisible = await submitButton.isVisible().catch(() => false);
      if (isSubmitVisible) {
        await submitButton.click();
        console.log('✅ OTP submitted via button');
      } else {
        console.log('✅ OTP auto-submitted');
      }

      // Wait for either registration page or error
      await Promise.race([
        this.page.waitForSelector('[data-testid="first-name-input"]', { timeout: 15000 }),
        this.page.waitForTimeout(5000)
      ]);

      // Verify we reached registration page
      const isOnRegistration = await this.firstNameInput.isVisible().catch(() => false);
      
      if (isOnRegistration) {
        console.log('✅ Successfully bypassed OTP - on registration page');
        return true;
      }

      // Check for error message
      const errorLocators = [
        this.page.getByTestId('otp-error'),
        this.page.getByText(/invalid|incorrect|expired/i),
        this.page.locator('.error-message')
      ];

      for (const errorLocator of errorLocators) {
        const hasError = await errorLocator.isVisible().catch(() => false);
        if (hasError) {
          const errorText = await errorLocator.textContent();
          console.error(`❌ OTP Error: ${errorText}`);
          await this.page.screenshot({ 
            path: `./test-results/otp-error-${Date.now()}.png`,
            fullPage: true
          });
          return false;
        }
      }

      console.warn('⚠️ OTP state unclear - may need to adjust selectors');
      return false;

    } catch (error) {
      console.error(`❌ OTP entry failed: ${error.message}`);
      await this.page.screenshot({ 
        path: `./test-results/otp-failure-${Date.now()}.png`,
        fullPage: true
      });
      throw error;
    }
  }

  async fillRegistrationDetails(userData: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
  }) {
    console.log('📝 Filling registration details...');
    
    await this.firstNameInput.fill(userData.firstName);
    await this.lastNameInput.fill(userData.lastName);
    await this.usernameInput.fill(userData.username);
    await this.emailInput.fill(userData.email);
    
    console.log('✅ Registration details filled');
  }

  async acceptTerms() {
    await this.termsCheckbox.click();
    await expect(this.termsCheckbox).toBeChecked();
    console.log('✅ Terms accepted');
  }

  async submitRegistration() {
    await this.createAccountButton.click();
    console.log('✅ Registration submitted');
  }

  /**
   * UPDATED: Complete signup with OTP bypass
   * Now accepts 'otp' parameter but ignores it (uses bypass instead)
   */
  async completeSignup(signupData: {
    phoneNumber: string;
    otp?: string; // Optional - will be ignored, keeping for compatibility
    firstName: string;
    lastName: string;
    username: string;
    email: string;
  }) {
    console.log('🚀 Starting signup flow with OTP bypass...');
    
    // STEP 1: Setup OTP bypass BEFORE navigation
    await this.setupOTPBypass();

    // STEP 2: Navigate and switch to register mode
    await this.navigateToAuth();
    await this.switchToRegisterMode();

    // STEP 3: Enter phone number
    await this.enterPhoneNumber(signupData.phoneNumber);

    // STEP 4: Enter dummy OTP (will be accepted due to bypass)
    const dummyOtp = '123456'; // Any 6-digit number works now!
    const otpSuccess = await this.enterOTP(dummyOtp);

    if (!otpSuccess) {
      throw new Error('❌ OTP bypass failed - check network interception');
    }

    // STEP 5: Fill registration form
    await this.fillRegistrationDetails({
      firstName: signupData.firstName,
      lastName: signupData.lastName,
      username: signupData.username,
      email: signupData.email
    });

    // STEP 6: Accept terms and submit
    await this.acceptTerms();
    await this.submitRegistration();
    
    console.log('✅ Signup flow completed successfully');
  }

  async verifySignupSuccess() {
    console.log('🔍 Verifying signup success...');
    
    // Wait for navigation away from auth page
    await this.page.waitForURL(url => !url.includes('/auth'), {
      timeout: 15000
    }).catch(() => {
      console.warn('⚠️ Still on auth page after signup');
    });

    // Verify we're NOT on auth page
    const currentUrl = this.page.url();
    if (currentUrl.includes('/auth')) {
      await this.page.screenshot({ 
        path: `./test-results/signup-not-complete-${Date.now()}.png`,
        fullPage: true
      });
      throw new Error('Signup did not complete - still on auth page');
    }

    await this.page.waitForLoadState('networkidle');
    console.log(`✅ Signup verified - redirected to: ${currentUrl}`);
  }

  static generateTestUser(phone: string) {
    const id = Date.now();
    return {
      phoneNumber: phone,
      otp: '123456', // Dummy - will be bypassed
      firstName: `Test${id}`,
      lastName: `User${id}`,
      username: `testuser${id}`,
      email: `test${id}@vegaqa.com`
    };
  }
}