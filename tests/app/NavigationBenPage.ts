import (page) from"@playwright/test";
import { expect } from '@playwright/test';
export class NavigationBenPage {
    readonly page: Page;
    readonly logo: Locator;                 
    readonly requestDemoBtn: Locator;
    readonly watchDemoBtn: Locator;
    readonly mainHeading: Locator;
    readonly statsSection: Locator;

    constructor(page: Page) {
        this.page = page;
        async fromLayoutPage() {
            await this.page.getByText('Layout').click();
            await this.page.getByText('Navigation Ben').click();