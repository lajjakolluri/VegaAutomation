import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive Security and Accessibility Audit Suite
 * Tests for: API keys, credentials, accessibility, SEO, and performance
 */

// Configure timeout for slow-loading pages
test.setTimeout(120000); // 2 minutes per test

// Configure navigation timeout
const NAVIGATION_TIMEOUT = 90000; // 90 seconds

test.describe('Security Audit Tests', () => {
  
  test('Check for exposed API keys in source code', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded' // Faster than 'load'
    });
    
    // Get the full page source
    const pageContent = await page.content();
    
    // Common API key patterns
    const apiKeyPatterns = [
      /api[_-]?key[_-]?=[\w-]{20,}/gi,
      /apikey[\s:=]+['"][\w-]{20,}['"]/gi,
      /AKIA[0-9A-Z]{16}/g, // AWS Access Key
      /sk_live_[0-9a-zA-Z]{24,}/g, // Stripe Live Key
      /sk_test_[0-9a-zA-Z]{24,}/g, // Stripe Test Key
      /AIza[0-9A-Za-z\\-_]{35}/g, // Google API Key
      /ya29\.[0-9A-Za-z\-_]+/g, // Google OAuth
      /ghp_[a-zA-Z0-9]{36}/g, // GitHub Personal Access Token
      /glpat-[a-zA-Z0-9\-_]{20}/g, // GitLab Personal Access Token
      /Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/g, // Bearer tokens
      /[a-zA-Z0-9_-]*:[a-zA-Z0-9_-]+@github\.com/g, // GitHub credentials
    ];
    
    const foundKeys: string[] = [];
    
    for (const pattern of apiKeyPatterns) {
      const matches = pageContent.match(pattern);
      if (matches) {
        foundKeys.push(...matches);
      }
    }
    
    // Log findings
    if (foundKeys.length > 0) {
      console.error('⚠️ SECURITY ALERT: Potential API keys found:');
      foundKeys.forEach(key => {
        console.error(`  - ${key.substring(0, 20)}...`);
      });
    }
    
    expect(foundKeys.length, 
      `Found ${foundKeys.length} potential API keys exposed in source code`
    ).toBe(0);
  });

  test('Check for hardcoded database credentials', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const pageContent = await page.content();
    const scriptContent = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.map(s => s.textContent || '').join('\n');
    });
    
    const fullContent = pageContent + '\n' + scriptContent;
    
    // Database credential patterns
    const credentialPatterns = [
      /password[\s:=]+['"][^'"]{3,}['"]/gi,
      /pwd[\s:=]+['"][^'"]{3,}['"]/gi,
      /db_password[\s:=]+['"][^'"]{3,}['"]/gi,
      /database_password[\s:=]+['"][^'"]{3,}['"]/gi,
      /mysql:\/\/[\w]+:[\w]+@/gi,
      /postgres:\/\/[\w]+:[\w]+@/gi,
      /mongodb:\/\/[\w]+:[\w]+@/gi,
      /Server=.*;Database=.*;User Id=.*;Password=/gi,
      /connectionString[\s:=]+['"][^'"]+['"]/gi,
    ];
    
    const foundCredentials: string[] = [];
    
    for (const pattern of credentialPatterns) {
      const matches = fullContent.match(pattern);
      if (matches) {
        foundCredentials.push(...matches);
      }
    }
    
    if (foundCredentials.length > 0) {
      console.error('⚠️ SECURITY ALERT: Potential database credentials found:');
      foundCredentials.forEach(cred => {
        console.error(`  - ${cred.substring(0, 30)}...`);
      });
    }
    
    expect(foundCredentials.length,
      `Found ${foundCredentials.length} potential database credentials in source`
    ).toBe(0);
  });

  test('Check for sensitive data in HTML comments', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const pageContent = await page.content();
    
    // Extract all HTML comments
    const commentPattern = /<!--([\s\S]*?)-->/g;
    const comments = pageContent.match(commentPattern) || [];
    
    const suspiciousKeywords = [
      'password', 'secret', 'token', 'api', 'key', 'credential',
      'auth', 'private', 'confidential', 'internal', 'todo',
      'fixme', 'hack', 'temporary', 'admin', 'root'
    ];
    
    const suspiciousComments: string[] = [];
    
    comments.forEach(comment => {
      const lowerComment = comment.toLowerCase();
      for (const keyword of suspiciousKeywords) {
        if (lowerComment.includes(keyword)) {
          suspiciousComments.push(comment);
          break;
        }
      }
    });
    
    if (suspiciousComments.length > 0) {
      console.warn('⚠️ Suspicious comments found:');
      suspiciousComments.forEach(comment => {
        console.warn(`  - ${comment.substring(0, 100)}...`);
      });
    }
    
    // Warning only, not failing the test
    console.log(`Total comments: ${comments.length}, Suspicious: ${suspiciousComments.length}`);
  });

  test('Check for exposed environment variables', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const envVars = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const scriptContent = scripts.map(s => s.textContent || '').join('\n');
      
      const envPatterns = [
        /process\.env\.\w+/g,
        /NODE_ENV/g,
        /REACT_APP_/g,
        /VUE_APP_/g,
        /VITE_/g,
        /NEXT_PUBLIC_/g,
      ];
      
      const found: string[] = [];
      envPatterns.forEach(pattern => {
        const matches = scriptContent.match(pattern);
        if (matches) found.push(...matches);
      });
      
      return found;
    });
    
    if (envVars.length > 0) {
      console.warn('⚠️ Environment variable references found in client code:');
      envVars.forEach(env => console.warn(`  - ${env}`));
    }
    
    // This is informational - public env vars are sometimes OK
    console.log(`Found ${envVars.length} environment variable references`);
  });
});

test.describe('Accessibility Audit Tests', () => {
  
  test('Verify all images have alt attributes', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .filter(img => !img.hasAttribute('alt') || img.getAttribute('alt')?.trim() === '')
        .map(img => ({
          src: img.src,
          id: img.id || 'no-id',
          class: img.className || 'no-class'
        }));
    });
    
    if (imagesWithoutAlt.length > 0) {
      console.error('❌ Images without alt attributes:');
      imagesWithoutAlt.forEach(img => {
        console.error(`  - ${img.src} (id: ${img.id}, class: ${img.class})`);
      });
    }
    
    expect(imagesWithoutAlt.length,
      `Found ${imagesWithoutAlt.length} images without alt attributes`
    ).toBe(0);
  });

  test('Verify form inputs have associated labels', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const inputsWithoutLabels = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'));
      
      return inputs.filter(input => {
        const hasLabel = (
          input.hasAttribute('aria-label') ||
          input.hasAttribute('aria-labelledby') ||
          input.closest('label') !== null ||
          document.querySelector(`label[for="${input.id}"]`) !== null
        );
        return !hasLabel;
      }).map(input => ({
        type: input.tagName.toLowerCase(),
        name: (input as HTMLInputElement).name || 'no-name',
        id: input.id || 'no-id',
        placeholder: (input as HTMLInputElement).placeholder || 'no-placeholder'
      }));
    });
    
    if (inputsWithoutLabels.length > 0) {
      console.error('❌ Form inputs without labels:');
      inputsWithoutLabels.forEach(input => {
        console.error(`  - <${input.type}> name="${input.name}" id="${input.id}"`);
      });
    }
    
    expect(inputsWithoutLabels.length,
      `Found ${inputsWithoutLabels.length} form inputs without labels`
    ).toBe(0);
  });

  test('Verify presence of semantic HTML5 structural tags', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const structuralTags = await page.evaluate(() => {
      return {
        nav: document.querySelectorAll('nav').length,
        main: document.querySelectorAll('main').length,
        header: document.querySelectorAll('header').length,
        footer: document.querySelectorAll('footer').length,
        article: document.querySelectorAll('article').length,
        section: document.querySelectorAll('section').length,
        aside: document.querySelectorAll('aside').length,
      };
    });
    
    console.log('📊 Structural tags found:', structuralTags);
    
    // Check for essential structural elements
    expect(structuralTags.main, 
      'Page should have at least one <main> tag'
    ).toBeGreaterThan(0);
    
    // Warnings for missing but recommended tags
    if (structuralTags.nav === 0) {
      console.warn('⚠️ No <nav> tags found - consider adding navigation structure');
    }
    if (structuralTags.header === 0) {
      console.warn('⚠️ No <header> tags found');
    }
    if (structuralTags.footer === 0) {
      console.warn('⚠️ No <footer> tags found');
    }
  });

  test('Verify heading hierarchy (h1-h6)', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const headingStructure = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return headings.map(h => ({
        level: parseInt(h.tagName.substring(1)),
        text: h.textContent?.trim().substring(0, 50) || ''
      }));
    });
    
    console.log('📋 Heading structure:');
    headingStructure.forEach(h => {
      console.log(`  ${'  '.repeat(h.level - 1)}H${h.level}: ${h.text}`);
    });
    
    // Check for exactly one h1
    const h1Count = headingStructure.filter(h => h.level === 1).length;
    expect(h1Count, 'Page should have exactly one H1 tag').toBe(1);
    
    // Check for heading hierarchy violations
    for (let i = 1; i < headingStructure.length; i++) {
      const currentLevel = headingStructure[i].level;
      const previousLevel = headingStructure[i - 1].level;
      
      if (currentLevel - previousLevel > 1) {
        console.warn(`⚠️ Heading hierarchy skip: H${previousLevel} → H${currentLevel}`);
      }
    }
  });

  test('Check for ARIA attributes and roles', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const ariaInfo = await page.evaluate(() => {
      const elementsWithRole = document.querySelectorAll('[role]').length;
      const elementsWithAriaLabel = document.querySelectorAll('[aria-label]').length;
      const elementsWithAriaLabelledby = document.querySelectorAll('[aria-labelledby]').length;
      const elementsWithAriaDescribedby = document.querySelectorAll('[aria-describedby]').length;
      
      return {
        role: elementsWithRole,
        ariaLabel: elementsWithAriaLabel,
        ariaLabelledby: elementsWithAriaLabelledby,
        ariaDescribedby: elementsWithAriaDescribedby,
      };
    });
    
    console.log('♿ ARIA attributes usage:', ariaInfo);
    
    // Informational - good to have but not required
    if (ariaInfo.role === 0) {
      console.warn('⚠️ No ARIA roles found - consider adding for better accessibility');
    }
  });
});

test.describe('SEO Audit Tests', () => {
  
  test('Verify presence of title tag', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const title = await page.title();
    
    console.log(`📄 Page title: "${title}"`);
    
    expect(title, 'Page must have a title').toBeTruthy();
    expect(title.length, 'Title should be between 30-60 characters').toBeGreaterThan(30);
    expect(title.length, 'Title should be between 30-60 characters').toBeLessThan(60);
  });

  test('Verify meta description exists', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const metaDescription = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="description"]');
      return meta?.getAttribute('content') || '';
    });
    
    console.log(`📝 Meta description: "${metaDescription}"`);
    
    expect(metaDescription, 'Meta description should exist').toBeTruthy();
    expect(metaDescription.length, 'Meta description should be 120-160 characters').toBeGreaterThan(120);
    expect(metaDescription.length, 'Meta description should be 120-160 characters').toBeLessThan(160);
  });

  test('Check for Open Graph tags', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const ogTags = await page.evaluate(() => {
      const tags = {
        'og:title': document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
        'og:description': document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
        'og:image': document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
        'og:url': document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
      };
      return tags;
    });
    
    console.log('📱 Open Graph tags:', ogTags);
    
    if (!ogTags['og:title']) {
      console.warn('⚠️ Missing og:title tag');
    }
    if (!ogTags['og:image']) {
      console.warn('⚠️ Missing og:image tag');
    }
  });

  test('Verify canonical URL', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const canonical = await page.evaluate(() => {
      const link = document.querySelector('link[rel="canonical"]');
      return link?.getAttribute('href');
    });
    
    if (canonical) {
      console.log(`🔗 Canonical URL: ${canonical}`);
    } else {
      console.warn('⚠️ No canonical URL found');
    }
  });
});

test.describe('Performance Audit Tests', () => {
  
  test('Identify render-blocking resources', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const renderBlockingResources = await page.evaluate(() => {
      const resources = {
        blockingScripts: [] as string[],
        blockingStyles: [] as string[],
      };
      
      // Check for synchronous scripts in <head>
      const headScripts = document.querySelectorAll('head script:not([async]):not([defer])');
      headScripts.forEach(script => {
        const src = (script as HTMLScriptElement).src || 'inline script';
        resources.blockingScripts.push(src);
      });
      
      // Check for stylesheets
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
      stylesheets.forEach(link => {
        const href = (link as HTMLLinkElement).href;
        resources.blockingStyles.push(href);
      });
      
      return resources;
    });
    
    if (renderBlockingResources.blockingScripts.length > 0) {
      console.warn('⚠️ Render-blocking scripts found:');
      renderBlockingResources.blockingScripts.forEach(script => {
        console.warn(`  - ${script}`);
      });
      console.log('💡 Consider adding async or defer attributes');
    }
    
    if (renderBlockingResources.blockingStyles.length > 0) {
      console.log(`📊 Found ${renderBlockingResources.blockingStyles.length} stylesheets`);
      if (renderBlockingResources.blockingStyles.length > 3) {
        console.warn('⚠️ Consider combining CSS files to reduce render-blocking resources');
      }
    }
  });

  test('Check for large images without lazy loading', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const imagesWithoutLazyLoading = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .filter(img => !img.hasAttribute('loading') || img.getAttribute('loading') !== 'lazy')
        .map(img => ({
          src: img.src,
          loading: img.getAttribute('loading') || 'none',
          width: img.naturalWidth,
          height: img.naturalHeight
        }))
        .filter(img => img.width > 0); // Only count loaded images
    });
    
    if (imagesWithoutLazyLoading.length > 0) {
      console.warn(`⚠️ Found ${imagesWithoutLazyLoading.length} images without lazy loading:`);
      imagesWithoutLazyLoading.slice(0, 5).forEach(img => {
        console.warn(`  - ${img.src} (${img.width}x${img.height})`);
      });
      console.log('💡 Consider adding loading="lazy" to images below the fold');
    }
  });

  test('Analyze page size and resource count', async ({ page }) => {
    const resources: any[] = [];
    
    page.on('response', async (response) => {
      try {
        const request = response.request();
        const size = parseInt(response.headers()['content-length'] || '0');
        
        resources.push({
          url: request.url(),
          type: request.resourceType(),
          status: response.status(),
          size: size
        });
      } catch (e) {
        // Ignore errors for resources we can't measure
      }
    });
    
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const totalSize = resources.reduce((sum, r) => sum + r.size, 0);
    const sizeInMB = (totalSize / 1024 / 1024).toFixed(2);
    
    const resourcesByType = resources.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📊 Page Analysis:');
    console.log(`  Total resources: ${resources.length}`);
    console.log(`  Total size: ${sizeInMB} MB`);
    console.log('  Resources by type:', resourcesByType);
    
    if (parseFloat(sizeInMB) > 5) {
      console.warn('⚠️ Page size exceeds 5 MB - consider optimization');
    }
  });
});

test.describe('Additional Security Checks', () => {
  
  test('Check for inline event handlers', async ({ page }) => {
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    const inlineHandlers = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const found: string[] = [];
      
      const eventAttributes = [
        'onclick', 'onload', 'onmouseover', 'onmouseout', 
        'onerror', 'onchange', 'onsubmit', 'onfocus', 'onblur'
      ];
      
      elements.forEach(el => {
        eventAttributes.forEach(attr => {
          if (el.hasAttribute(attr)) {
            found.push(`<${el.tagName.toLowerCase()}> has ${attr}`);
          }
        });
      });
      
      return found;
    });
    
    if (inlineHandlers.length > 0) {
      console.warn('⚠️ Inline event handlers found (CSP risk):');
      inlineHandlers.slice(0, 10).forEach(handler => {
        console.warn(`  - ${handler}`);
      });
    }
  });

  test('Check for mixed content (HTTP resources on HTTPS page)', async ({ page }) => {
    const mixedContent: string[] = [];
    
    page.on('request', request => {
      const url = request.url();
      if (url.startsWith('http://') && !url.startsWith('http://localhost')) {
        mixedContent.push(url);
      }
    });
    
    await page.goto('https://vegaevents.com/', { 
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded'
    });
    
    if (mixedContent.length > 0) {
      console.error('❌ Mixed content detected (HTTP on HTTPS page):');
      mixedContent.forEach(url => {
        console.error(`  - ${url}`);
      });
    }
    
    expect(mixedContent.length,
      `Found ${mixedContent.length} HTTP resources on HTTPS page`
    ).toBe(0);
  });
});

// Summary report test
test('Generate comprehensive audit report', async ({ page }) => {
  await page.goto('https://vegaevents.com/', { 
    timeout: NAVIGATION_TIMEOUT,
    waitUntil: 'domcontentloaded'
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('COMPREHENSIVE AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(`URL: ${page.url()}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('='.repeat(80) + '\n');
  
  console.log('Run individual tests above for detailed findings.');
  console.log('Check console output for warnings and recommendations.');
});