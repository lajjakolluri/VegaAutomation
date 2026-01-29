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

  /**
   * CRITICAL FIX 1: Block reCAPTCHA before navigation
   */
  async blockRecaptcha() {
    await this.page.route('**/recaptcha/**', route => route.abort());
    await this.page.route('**/google.com/recaptcha/**', route => route.abort());
    console.log('✅ reCAPTCHA blocked');
  }

  /**
   * CRITICAL FIX 2: Aggressive API bypass - intercept ALL outgoing requests
   */
  async setupOTPBypass() {
    console.log('🔧 Setting up comprehensive API bypass...');
    
    // Intercept ALL POST/PUT requests that might be OTP-related
    await this.page.route('**/**', async (route) => {
      const request = route.request();
      const url = request.url();
      const method = request.method();
      
      // Only intercept POST/PUT requests
      if (method !== 'POST' && method !== 'PUT') {
        await route.continue();
        return;
      }
      
      const urlLower = url.toLowerCase();
      
      // Check if this is an OTP-related request
      const isOtpRequest = 
        urlLower.includes('otp') ||
        urlLower.includes('verify') ||
        urlLower.includes('sms') ||
        urlLower.includes('code') ||
        urlLower.includes('validation');
      
      if (isOtpRequest) {
        console.log(`🔄 INTERCEPTED OTP REQUEST: ${method} ${url}`);
        
        // Check the request body
        const postData = request.postData();
        if (postData) {
          console.log(`📦 Request body: ${postData.substring(0, 200)}`);
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: true,
            verified: true,
            valid: true,
            status: 'success',
            message: 'OTP verified successfully',
            token: 'mock-auth-token-12345',
            data: {
              verified: true,
              user: { verified: true }
            }
          })
        });
        
        return;
      }
      
      // Let other requests through
      await route.continue();
    });

    console.log('✅ Aggressive OTP bypass configured');
  }

  async navigateToAuth() {
    // Block reCAPTCHA FIRST
    await this.blockRecaptcha();
    
    await this.page.goto(this.authUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log('✅ Navigated to auth page');
  }

  async switchToRegisterMode() {
    await this.registerModeButton.click();
    await this.page.waitForTimeout(500); // Wait for mode switch
    console.log('✅ Switched to register mode');
  }

  /**
   * CRITICAL FIX 3: Smart phone number entry with proper format
   */
  async enterPhoneNumber(phone: string) {
    console.log(`📱 Entering phone: ${phone}`);
    
    // Format phone number properly - US format typically requires (XXX) XXX-XXXX or +1XXXXXXXXXX
    // First, try to detect and format
    let formattedPhone = phone.replace(/\D/g, ''); // Remove non-digits
    
    // If it doesn't start with country code, check length
    if (formattedPhone.length === 10) {
      // US 10-digit format - try different formats until one works
      const formats = [
        `(${formattedPhone.slice(0,3)}) ${formattedPhone.slice(3,6)}-${formattedPhone.slice(6)}`,
        formattedPhone,
        `+1${formattedPhone}`,
        `1${formattedPhone}`
      ];
      
      for (const format of formats) {
        await this.phoneInput.clear();
        await this.phoneInput.fill(format);
        await this.phoneInput.blur();
        await this.page.waitForTimeout(800);
        
        const isEnabled = await this.nextButton.isEnabled().catch(() => false);
        
        if (isEnabled) {
          console.log(`✅ Phone format accepted: ${format}`);
          await this.nextButton.click();
          console.log('✅ Phone number submitted');
          return;
        }
        
        console.log(`❌ Format rejected: ${format}`);
      }
    } else {
      // Just try the original format
      await this.phoneInput.clear();
      await this.phoneInput.fill(phone);
      await this.phoneInput.blur();
      await this.page.waitForTimeout(800);
      
      const isEnabled = await this.nextButton.isEnabled().catch(() => false);
      
      if (isEnabled) {
        console.log(`✅ Phone format accepted: ${phone}`);
        await this.nextButton.click();
        console.log('✅ Phone number submitted');
        return;
      }
    }
    
    // If we get here, no format worked - capture debug info
    console.error('❌ All phone formats rejected');
    
    // Get the actual validation error message if visible
    const errorMsg = await this.page.locator('[role="alert"], .error-message, [data-testid*="error"]')
      .first()
      .textContent()
      .catch(() => 'No error message found');
    
    console.log(`Validation error: ${errorMsg}`);
    
    await this.page.screenshot({ 
      path: `./test-results/phone-validation-failed-${Date.now()}.png`,
      fullPage: true
    });
    
    throw new Error(`Phone validation failed - Next button disabled. Error: ${errorMsg}`);
  }

  /**
   * CRITICAL FIX 4: Enhanced OTP handling with SMS waiting detection
   */
  async enterOTP(otp: string = '123456') {
    try {
      console.log(`📝 Waiting for OTP screen or detecting page state...`);
      
      // Wait a moment for the page to transition after phone submission
      await this.page.waitForTimeout(2000);
      
      // Check what state we're in - OTP screen, error, or still on phone screen
      const pageState = await this.detectPageState();
      console.log(`📊 Current page state: ${pageState}`);
      
      if (pageState === 'waiting_for_sms') {
        console.log('⏳ Backend is sending real SMS - waiting for OTP screen...');
        
        // Wait longer for OTP screen to appear (real SMS takes time)
        const otpVisible = await this.otpInputs.first().waitFor({ 
          state: 'visible',
          timeout: 30000 
        }).then(() => true).catch(() => false);
        
        if (!otpVisible) {
          console.error('❌ OTP screen never appeared - SMS may have failed');
          await this.page.screenshot({ 
            path: `./test-results/no-otp-screen-${Date.now()}.png`,
            fullPage: true
          });
          throw new Error('OTP screen did not appear after phone submission');
        }
      } else if (pageState === 'otp_screen') {
        console.log('✅ OTP screen detected');
      } else if (pageState === 'error') {
        console.error('❌ Error detected on page');
        const errorMsg = await this.getErrorMessage();
        throw new Error(`Phone submission failed: ${errorMsg}`);
      } else if (pageState === 'registration') {
        console.log('🎉 Already on registration page - OTP was bypassed!');
        return true;
      }

      console.log(`📝 Entering OTP: ${otp}`);

      // Fill each OTP digit with delays
      for (let i = 0; i < 6; i++) {
        await this.otpInputs.nth(i).fill(otp[i]);
        await this.page.waitForTimeout(150);
      }

      console.log('✅ OTP digits entered');

      // Look for submit button or wait for auto-submit
      const submitButton = this.page.getByTestId('verify-otp-button')
        .or(this.page.getByTestId('submit-otp-button'))
        .or(this.page.getByRole('button', { name: /verify|submit|continue/i }));
      
      const isSubmitVisible = await submitButton.isVisible().catch(() => false);
      
      if (isSubmitVisible) {
        await submitButton.click();
        console.log('✅ OTP submitted via button');
      } else {
        console.log('⏳ Waiting for auto-submit...');
        await this.page.waitForTimeout(2000);
      }

      // Wait for navigation to registration page
      console.log('⏳ Waiting for registration page...');
      
      await this.page.waitForSelector('[data-testid="first-name-input"]', { 
        timeout: 20000,
        state: 'visible'
      });

      const isOnRegistration = await this.firstNameInput.isVisible().catch(() => false);
      
      if (isOnRegistration) {
        console.log('✅ Successfully reached registration page');
        return true;
      }

      console.error('❌ Failed to reach registration page');
      await this.page.screenshot({ 
        path: `./test-results/otp-failed-${Date.now()}.png`,
        fullPage: true
      });
      
      return false;

    } catch (error) {
      console.error(`❌ OTP entry failed: ${error.message}`);
      await this.page.screenshot({ 
        path: `./test-results/otp-error-${Date.now()}.png`,
        fullPage: true
      });
      
      // Check current page state
      const currentUrl = this.page.url();
      console.log(`Current URL: ${currentUrl}`);
      
      throw error;
    }
  }
  
  /**
   * Detect what state the auth page is in
   */
  async detectPageState(): Promise<'phone_screen' | 'waiting_for_sms' | 'otp_screen' | 'registration' | 'error'> {
    // Check for registration page
    const hasRegistrationFields = await this.firstNameInput.isVisible().catch(() => false);
    if (hasRegistrationFields) return 'registration';
    
    // Check for OTP inputs
    const hasOtpInputs = await this.otpInputs.first().isVisible().catch(() => false);
    if (hasOtpInputs) return 'otp_screen';
    
    // Check for error messages
    const errorLocators = [
      this.page.getByRole('alert'),
      this.page.locator('[role="alert"]'),
      this.page.locator('.error-message'),
      this.page.getByText(/error|failed|invalid/i)
    ];
    
    for (const locator of errorLocators) {
      const hasError = await locator.isVisible().catch(() => false);
      if (hasError) return 'error';
    }
    
    // Check if still on phone screen
    const hasPhoneInput = await this.phoneInput.isVisible().catch(() => false);
    if (hasPhoneInput) return 'phone_screen';
    
    // Check for "waiting" or "sending" messages
    const waitingMessages = await this.page.getByText(/sending|wait|verif/i).isVisible().catch(() => false);
    if (waitingMessages) return 'waiting_for_sms';
    
    return 'waiting_for_sms'; // Default assumption
  }
  
  /**
   * Get error message from page
   */
  async getErrorMessage(): Promise<string> {
    const errorLocators = [
      this.page.getByRole('alert'),
      this.page.locator('[role="alert"]'),
      this.page.locator('.error-message'),
      this.page.getByTestId('error-message')
    ];
    
    for (const locator of errorLocators) {
      const text = await locator.textContent().catch(() => null);
      if (text) return text;
    }
    
    return 'Unknown error';
  }

  async fillRegistrationDetails(userData: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
  }) {
    console.log('📝 Filling registration details...');
    
    await this.firstNameInput.waitFor({ state: 'visible', timeout: 10000 });
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
   * COMPLETE SIGNUP FLOW - All fixes integrated
   */
  async completeSignup(signupData: {
    phoneNumber: string;
    otp?: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
  }) {
    console.log('🚀 Starting signup flow with comprehensive fixes...');
    
    try {
      // STEP 1: Setup bypasses BEFORE navigation
      await this.setupOTPBypass();
      await this.blockRecaptcha();

      // STEP 2: Navigate
      await this.page.goto(this.authUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // STEP 3: Switch to register mode
      await this.switchToRegisterMode();

      // STEP 4: Enter phone number (with validation handling)
      await this.enterPhoneNumber(signupData.phoneNumber);

      // STEP 5: Enter OTP (with bypass active)
      const dummyOtp = '123456';
      const otpSuccess = await this.enterOTP(dummyOtp);

      if (!otpSuccess) {
        throw new Error('❌ Failed to bypass OTP verification');
      }

      // STEP 6: Fill registration form
      await this.fillRegistrationDetails({
        firstName: signupData.firstName,
        lastName: signupData.lastName,
        username: signupData.username,
        email: signupData.email
      });

      // STEP 7: Accept terms and submit
      await this.acceptTerms();
      await this.submitRegistration();
      
      console.log('✅ Signup flow completed successfully');
      
    } catch (error) {
      console.error(`❌ Signup flow failed: ${error.message}`);
      await this.page.screenshot({ 
        path: `./test-results/signup-failed-${Date.now()}.png`,
        fullPage: true
      });
      throw error;
    }
  }

  async verifySignupSuccess() {
    console.log('🔍 Verifying signup success...');
    
    // Wait for navigation away from auth page
    await this.page.waitForURL(url => !url.includes('/auth'), {
      timeout: 20000
    }).catch(() => {
      console.warn('⚠️ Still on auth page after signup');
    });

    const currentUrl = this.page.url();
    
    if (currentUrl.includes('/auth')) {
      await this.page.screenshot({ 
        path: `./test-results/signup-incomplete-${Date.now()}.png`,
        fullPage: true
      });
      throw new Error('Signup incomplete - still on auth page');
    }

    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.warn('⚠️ Network not idle, but continuing');
    });
    
    console.log(`✅ Signup verified - redirected to: ${currentUrl}`);
  }

  static generateTestUser(phone?: string) {
    const id = Date.now();
    // Generate a valid US phone number format
    const timestamp = id.toString().slice(-7);
    const defaultPhone = `801${timestamp}`;
    
    return {
      phoneNumber: phone || defaultPhone,
      otp: '123456',
      firstName: `QA${id}`,
      lastName: `Test${id}`,
      username: `qauser${id}`,
      email: `qa.test.${id}@vegaqa.com`
    };
  }
  
  /**
   * Debug helper to inspect phone input requirements
   */
  async debugPhoneInput() {
    const inputType = await this.phoneInput.getAttribute('type');
    const pattern = await this.phoneInput.getAttribute('pattern');
    const placeholder = await this.phoneInput.getAttribute('placeholder');
    const maxLength = await this.phoneInput.getAttribute('maxlength');
    
    console.log('📋 Phone Input Details:');
    console.log(`  Type: ${inputType}`);
    console.log(`  Pattern: ${pattern}`);
    console.log(`  Placeholder: ${placeholder}`);
    console.log(`  MaxLength: ${maxLength}`);
    
    return { inputType, pattern, placeholder, maxLength };
  }
}