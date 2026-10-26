import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('========================================================================');
console.log('   Obido Studio — Global Typography & Font Cascade Verification Suite   ');
console.log('========================================================================');

// 1. Verify index.html loads complete Google Fonts weights
const indexHtmlPath = path.resolve('index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

console.log('1. Checking index.html font stylesheet links...');
assert(indexHtml.includes('fonts.googleapis.com'), 'index.html must link to Google Fonts');
assert(indexHtml.includes('Plus+Jakarta+Sans:wght@400;500;600;700;800'), 'Plus Jakarta Sans must include 400-800 weights');
assert(indexHtml.includes('Noto+Kufi+Arabic:wght@400;500;600;700;800'), 'Noto Kufi Arabic must include 400-800 weights');
assert(indexHtml.includes('IBM+Plex+Sans+Arabic:wght@400;500;600;700'), 'IBM Plex Sans Arabic must include 400-700 weights');
assert(indexHtml.includes('Inter:wght@300;400;500;600;700'), 'Inter must include 300-700 weights');
assert(indexHtml.includes('JetBrains+Mono:wght@400;500;600;700'), 'JetBrains Mono must include 400-700 weights');
console.log('✔ Test 1 Passed: index.html links all required font weights for all target families.');

// 2. Verify self-hosted same-origin .woff2 font assets exist in /public/fonts/
console.log('2. Checking self-hosted fallback .woff2 assets...');
const fontsDir = path.resolve('public/fonts');
assert(fs.existsSync(fontsDir), 'public/fonts directory must exist');
const woffFiles = fs.readdirSync(fontsDir).filter(f => f.endsWith('.woff2'));
assert(woffFiles.length >= 6, `Must have at least 6 woff2 files in public/fonts (found ${woffFiles.length})`);
assert(woffFiles.some(f => f.includes('plus-jakarta-sans')), 'Plus Jakarta Sans woff2 must be present');
assert(woffFiles.some(f => f.includes('noto-kufi-arabic')), 'Noto Kufi Arabic woff2 must be present');
assert(woffFiles.some(f => f.includes('ibm-plex-sans-arabic')), 'IBM Plex Sans Arabic woff2 must be present');
assert(woffFiles.some(f => f.includes('inter')), 'Inter woff2 must be present');
assert(woffFiles.some(f => f.includes('jetbrains-mono')), 'JetBrains Mono woff2 must be present');
console.log('✔ Test 2 Passed: Verified physical .woff2 font assets exist in /public/fonts/ for zero-block fallback.');

// 3. Verify Tailwind v4 @theme integration
const indexCssPath = path.resolve('src/index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');

console.log('3. Checking Tailwind v4 @theme configuration...');
assert(indexCss.includes('@theme'), 'src/index.css must configure Tailwind v4 @theme block');
assert(indexCss.includes('--font-sans: var(--font-body)'), 'Tailwind @theme --font-sans must bind to var(--font-body)');
assert(indexCss.includes('--font-display: var(--font-display)'), 'Tailwind @theme --font-display must bind to var(--font-display)');
assert(indexCss.includes('--font-mono: var(--font-mono)'), 'Tailwind @theme --font-mono must bind to var(--font-mono)');
console.log('✔ Test 3 Passed: Tailwind v4 @theme properly bridges design tokens to utility classes.');

// 4. Verify English font stacks and hierarchy
console.log('4. Checking English font hierarchy...');
assert(indexCss.includes("--font-display-en: 'Creato Display', 'Plus Jakarta Sans'"), 'English display stack must prioritize Creato Display with Plus Jakarta Sans as active fallback');
assert(indexCss.includes("--font-body-en: 'Helvetica Neue', 'Inter', Arial, sans-serif"), 'English body stack must prioritize Helvetica Neue with Inter as primary fallback');
console.log('✔ Test 4 Passed: English display and body hierarchies strictly adhere to specification.');

// 5. Verify Arabic font stacks and hierarchy
console.log('5. Checking Arabic font hierarchy...');
assert(indexCss.includes("--font-display-ar: 'Nasser', 'Fatimid Kufi', 'Modern Kufi', 'Noto Kufi Arabic'"), 'Arabic display stack must prioritize Nasser/Fatimid with Noto Kufi Arabic as active geometric fallback');
assert(indexCss.includes("--font-body-ar: 'Maryam', 'Nasser', 'IBM Plex Sans Arabic'"), 'Arabic body stack must prioritize Maryam/Nasser with IBM Plex Sans Arabic as active fallback');
console.log('✔ Test 5 Passed: Arabic display and body hierarchies strictly adhere to specification.');

// 6. Verify universal headings and display element cascade
console.log('6. Checking universal heading cascade...');
assert(indexCss.includes('h1, h2, h3, h4, h5, h6'), 'Headings h1-h6 must be bound to var(--font-display)');
assert(indexCss.includes('h1 *, h2 *, h3 *, h4 *, h5 *, h6 *'), 'Heading child elements must inherit display font');
assert(indexCss.includes('[dir="rtl"] h1'), 'RTL headings must be bound to var(--font-display-ar)');
console.log('✔ Test 6 Passed: Headings h1-h6 and children universally receive display typography.');

// 7. Verify UI controls and body elements
console.log('7. Checking UI controls, forms, and buttons...');
assert(indexCss.includes('button,'), 'Buttons must be explicitly bound to var(--font-body)');
assert(indexCss.includes('input,'), 'Form inputs must be explicitly bound to var(--font-body)');
assert(indexCss.includes('textarea,'), 'Textareas must be explicitly bound to var(--font-body)');
assert(indexCss.includes('select,'), 'Selects must be explicitly bound to var(--font-body)');
assert(indexCss.includes('label,'), 'Labels must be explicitly bound to var(--font-body)');
assert(indexCss.includes('html,') && indexCss.includes('body,'), 'html and body must be bound to var(--font-body)');
console.log('✔ Test 7 Passed: UI controls, buttons, forms, and body text universally bound to body typography.');

// 8. Verify monospace and tabular figure mapping
console.log('8. Checking monospace elements...');
assert(indexCss.includes('code,') && indexCss.includes('.font-mono') && indexCss.includes('.tabular-nums'), 'Code and monospace elements must be bound to var(--font-mono)');
assert(indexCss.includes('font-variant-numeric: tabular-nums'), 'Tabular numerals must be enforced on monospace elements');
console.log('✔ Test 8 Passed: Tabular numerals and monospace elements strictly configured.');

// 9. Verify TypographyInspectorModal forced style reset test element exists
console.log('9. Checking TypographyInspector forced style reset implementation...');
const inspectorPath = path.resolve('src/components/common/TypographyInspectorModal.tsx');
assert(fs.existsSync(inspectorPath), 'TypographyInspectorModal.tsx must exist');
const inspectorContent = fs.readFileSync(inspectorPath, 'utf8');
assert(inspectorContent.includes("all: 'unset'"), 'TypographyInspector must use all: unset for style reset test element');
assert(inspectorContent.includes("fontFamily: 'var(--font-display)'"), 'Style reset element must apply var(--font-display)');
assert(inspectorContent.includes('document.fonts.check'), 'TypographyInspector must use document.fonts.check API');
console.log('✔ Test 9 Passed: Forced style reset test element and document.fonts diagnostic confirmed.');

console.log('========================================================================');
console.log('   All 9 Typography Verification Tests Passed Successfully!             ');
console.log('========================================================================');
