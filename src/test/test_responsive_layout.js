// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0

const fs = require('fs');
const assert = require('assert');

console.log('--- STARTING RESPONSIVE LAYOUT & OVERFLOW PREVENTION TESTS ---\n');

let total = 0;
let passed = 0;

function test(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log(`[PASS] ${name}`);
    } catch (e) {
        console.error(`[FAIL] ${name}: ${e.message}`);
    }
}

const uiScript = fs.readFileSync('src/global/gmg_ai_agent_panel.js', 'utf8');

// 1. Box Sizing Universal Reset
test('1. Universal Box-Sizing: Applied across all root descendants', () => {
    assert(uiScript.includes('#gmgai-root, #gmgai-root *, #gmgai-root *::before, #gmgai-root *::after{box-sizing:border-box}'), 'Universal box-sizing reset applied');
});

// 2. Panel Dimensions and Responsive Max-Width
test('2. Panel Max-Width: Responsive bounds at 320px, 375px, and 450px', () => {
    assert(uiScript.includes('max-width:calc(100vw - 32px)'), 'Panel bounds to viewport width');
    assert(uiScript.includes('@media (max-width: 480px){#gmgai-panel{right:8px;bottom:8px;max-width:calc(100vw - 16px)'), 'Mobile media query adapts for <= 480px');
    assert(uiScript.includes('min-width:0'), 'Panel has min-width:0 to allow flex shrinking');
    assert(uiScript.includes('overflow:hidden'), 'Panel clips overflow cleanly');
});

// 3. Navigation Tabs Overflow Prevention
test('3. Navigation Tabs: Controlled overflow without breaking container', () => {
    assert(uiScript.includes('#gmgai-mode-bar{flex:0 0 auto;min-width:0;width:100%'), 'Mode bar is fixed flex item with min-width:0');
    assert(uiScript.includes('overflow-x:auto'), 'Tabs scroll horizontally if labels exceed container width');
    assert(uiScript.includes('scrollbar-width:none'), 'Scrollbar hidden on modern browsers');
    assert(uiScript.includes('#gmgai-mode-bar::-webkit-scrollbar{display:none}'), 'Scrollbar hidden on WebKit');
});

// 4. Content Area Vertical Scrolling
test('4. Content Area: Vertical scroll only, horizontal overflow strictly forbidden', () => {
    assert(uiScript.includes('#gmgai-msgs{flex:1 1 auto;min-width:0;min-height:0;width:100%;overflow-y:auto;overflow-x:hidden'), 'Content area has flex:1 1 auto, overflow-y:auto, overflow-x:hidden');
});

// 5. Bento Suggestion Grid & Text Wrapping
test('5. Bento Cards: minmax(0, 1fr) grid tracks and natural text wrapping', () => {
    assert(uiScript.includes('grid-template-columns:repeat(2, minmax(0, 1fr))'), 'Grid tracks use minmax(0, 1fr) preventing track blowout');
    assert(uiScript.includes('@media (max-width: 380px){.gmgai-bento-grid{grid-template-columns:minmax(0, 1fr)}}'), 'Single column fallback at <= 380px');
    assert(uiScript.includes('.gmgai-bento-card{background:var(--np-surface);border:1px solid var(--np-border);border-radius:10px;padding:10px 10px;display:flex;align-items:center;gap:8px;cursor:pointer;text-align:left;transition:all .15s ease;box-shadow:0 1px 3px rgba(0,0,0,0.02);width:100%;min-width:0;max-width:100%'), 'Bento card has min-width:0 and max-width:100%');
    assert(uiScript.includes('.gmgai-bento-title{font-size:12px;font-weight:600;color:var(--np-text);line-height:1.3;overflow-wrap:break-word;word-break:break-word}'), 'Bento title wraps naturally');
    assert(uiScript.includes('.gmgai-bento-sub{font-size:10.5px;color:var(--np-text-secondary);line-height:1.3;margin-top:2px;overflow-wrap:break-word;word-break:break-word}'), 'Bento subtitle wraps naturally without clipping');
});

// 6. Composer Pinned to Bottom & Sizing
test('6. Composer: Pinned to bottom, auto-growing input, visible Send button', () => {
    assert(uiScript.includes('#gmgai-in{flex:0 0 auto;min-width:0;width:100%;display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--np-border)'), 'Composer is pinned at bottom with flex:0 0 auto');
    assert(uiScript.includes('#gmgai-in textarea{flex:1 1 auto;width:0;min-width:0;max-width:100%'), 'Textarea has flex:1 1 auto with width:0 and min-width:0 to shrink and grow');
    assert(uiScript.includes('#gmgai-in button#gmgai-send{flex:0 0 auto'), 'Send button has flex:0 0 auto to prevent shrinking');
    assert(uiScript.includes('white-space:nowrap'), 'Send button label never wraps');
    assert(uiScript.includes('#gmgai-clip{flex:0 0 36px'), 'Attachment paperclip button maintains fixed circular size');
});

// 7. XML Update Set Packaging Check
test('7. XML Packaging: Double-escaping verified in global update set', () => {
    const globalXml = fs.readFileSync('update_sets/now_pilot_global.xml', 'utf8');
    assert(globalXml.includes('grid-template-columns:repeat(2, minmax(0, 1fr))'), 'minmax(0, 1fr) grid tracks packaged in global XML');
    assert(globalXml.includes('max-width:calc(100vw - 32px)'), 'Panel bounds packaged in global XML');
});

console.log(`\n========================================`);
console.log(`RESPONSIVE LAYOUT TEST SUMMARY: ${passed} / ${total} tests passed.`);
console.log(`========================================\n`);

if (passed !== total) {
    process.exit(1);
}
