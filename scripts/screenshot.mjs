#!/usr/bin/env node
// Screenshot pages of the local app in a headless browser: no window, no
// focus stealing. Logs in first and reports console errors and HTTP errors.
//
//   node scripts/screenshot.mjs [--out dir] [--dark] [--full] <path> [<path> ...]
//
// Uses the installed Google Chrome in headless mode (no browser download).
// Env: APP_URL (default http://localhost:8000), SCREENSHOT_EMAIL and
// SCREENSHOT_PASSWORD for the login, CHROME_PATH to use another browser.

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const option = (name) => {
    const index = args.indexOf(name);

    return index === -1 ? null : args.splice(index, 2)[1];
};
const flag = (name) => {
    const index = args.indexOf(name);

    return index === -1 ? false : (args.splice(index, 1), true);
};

const out = option('--out') ?? 'storage/screenshots';
const dark = flag('--dark');
const fullPage = flag('--full');
const paths = args;
const base = (process.env.APP_URL ?? 'http://localhost:8000').replace(/\/$/, '');

if (paths.length === 0) {
    console.error('Usage: node scripts/screenshot.mjs [--out dir] [--dark] [--full] <path> [<path> ...]');
    process.exit(1);
}

mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: dark ? 'dark' : 'light' });
const page = await context.newPage();

if (dark) {
    await page.addInitScript(() => localStorage.setItem('appearance', 'dark'));
}

await page.goto(`${base}/login`, { waitUntil: 'networkidle' });

if (page.url().includes('/login') && process.env.SCREENSHOT_EMAIL) {
    await page.fill('#email', process.env.SCREENSHOT_EMAIL);
    await page.fill('#password', process.env.SCREENSHOT_PASSWORD ?? '');
    await page.click('button[type=submit]');
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {
        console.error('Login failed: still on /login. Check SCREENSHOT_EMAIL and SCREENSHOT_PASSWORD.');
        process.exit(1);
    });
}

let failures = 0;

for (const [index, path] of paths.entries()) {
    const errors = [];
    const onConsole = (message) => message.type() === 'error' && errors.push(message.text());
    const onPageError = (error) => errors.push(String(error));
    const onResponse = (response) => response.status() >= 500 && errors.push(`${response.status()} ${response.url()}`);

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('response', onResponse);

    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    if (new URL(page.url()).pathname.startsWith('/login') && !path.startsWith('/login')) {
        errors.push('redirected to /login (not signed in)');
    }

    const file = `${out}/${String(index).padStart(2, '0')}.png`;
    await page.screenshot({ path: file, fullPage });

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);

    failures += errors.length > 0 ? 1 : 0;
    console.log(`${file}  ${path}  ${errors.length ? `ERRORS: ${errors.slice(0, 3).join(' | ')}` : 'ok'}`);
}

await browser.close();
process.exit(failures > 0 ? 1 : 0);
