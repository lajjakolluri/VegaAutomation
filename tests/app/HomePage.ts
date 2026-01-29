import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';


export class HomePage {
    readonly page: Page;
    readonly logo: Locator;                 
    readonly requestDemoBtn: Locator;
    readonly watchDemoBtn: Locator;
    readonly mainHeading: Locator;
    readonly statsSection: Locator;

    constructor(page: Page) {
        this.page = page;
        
        // Target the logo within the nav
        this.logo = page.locator('nav').getByRole('link').first();
        
        // FIX: Removed .filter({ visible: true }) from constructor. 
        // We use .first() or a more specific locator to handle the Desktop/Mobile duplicate issue.
        this.requestDemoBtn = page.getByRole('link', { name: /Request Demo/i }).first();
        
        this.watchDemoBtn = page.getByRole('button', { name: /Watch demo/i });
        
        // FIX: Broadened regex to match your spec's expectation of "Space Management" or the Hero text
        this.mainHeading = page.getByRole('heading', { level: 1 });
        
        // FIX: Stats sections often use complex nesting. Finding by ID or a simpler text locator is safer.
        this.statsSection = page.getByText('100+ Hours Saved');
    }

    async navigate() {
        // Use the baseURL from config if possible, otherwise keep the hardcoded string
        await this.page.goto('https://vegaevents.com/', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
    }

    async clickRequestDemo() {
        // Wait for the button to be ready for interaction to prevent "Timeout exceeded"
        await this.requestDemoBtn.waitFor({ state: 'visible', timeout: 10000 });
        await this.requestDemoBtn.click();
        
        // Wait for the URL to change to the demo page
        await this.page.waitForURL(/.*demo/, { timeout: 10000 });
    }

    async clickWatchDemo() {
        await this.watchDemoBtn.waitFor({ state: 'visible' });
        await this.watchDemoBtn.click();
    }

    async verifyHeaderVisible() {
        await expect(this.logo).toBeVisible();
    }
}