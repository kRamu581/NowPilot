// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- STARTING SERVICENOW OTTO-INSPIRED UI REDESIGN TESTS ---\n');

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

// 1. Color Tokens & Theme
test('1. Otto Design Tokens: CSS variables defined', () => {
    assert(uiScript.includes('--np-background:#EEECE8'), 'Background color token present');
    assert(uiScript.includes('--np-surface:#FFFFFF'), 'Surface color token present');
    assert(uiScript.includes('--np-surface-muted:#F5F4F1'), 'Surface muted token present');
    assert(uiScript.includes('--np-navy:#002B3B'), 'Navy color token present');
    assert(uiScript.includes('--np-green:#63E052'), 'Vibrant green token present');
    assert(uiScript.includes('--np-green-hover:#4CCB3B'), 'Green hover token present');
    assert(uiScript.includes('--np-text:#111111'), 'Main text color token present');
    assert(uiScript.includes('--np-text-secondary:#626262'), 'Secondary text token present');
    assert(uiScript.includes('--np-border:#DEDCD7'), 'Border color token present');
    assert(uiScript.includes('--np-danger:#D92D20'), 'Danger color token present');
    assert(uiScript.includes('--np-shadow:0 8px 28px rgba(0,0,0,0.12)'), 'Restrained shadow token present');
});

// 2. Scoped Typography
test('2. Typography: Inter system font stack and accessible sizes', () => {
    assert(uiScript.includes('Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto'), 'System font stack configured');
    assert(uiScript.includes('-webkit-font-smoothing:antialiased'), 'Crisp font smoothing enabled');
});

// 3. Logo & SVG Assets
test('3. Logo & Assets: Clean white & navy inline vector badges', () => {
    assert(uiScript.includes("var LOGO_SVG = '<svg"), 'Inline vector header logo defined');
    assert(uiScript.includes("fill=\"#FFFFFF\""), 'Logo has crisp white background');
    assert(uiScript.includes("fill=\"#63E052\""), 'Logo contains Otto green wing mark');
    assert(uiScript.includes("var BTN_LOGO_SVG = '<svg"), 'Inline vector launcher logo defined');
    assert(fs.existsSync('src/assets/favicon.svg'), 'favicon.svg exists in src/assets/');
    assert(fs.existsSync('src/assets/favicon.ico'), 'favicon.ico exists in src/assets/');
    assert(fs.existsSync('src/assets/favicon-32x32.png'), 'favicon-32x32.png exists in src/assets/');
    assert(fs.existsSync('src/assets/favicon-16x16.png'), 'favicon-16x16.png exists in src/assets/');
});

// 4. Chatbot Header Redesign
test('4. Header Redesign: Brand title, subtitle, model picker, clear, and close buttons', () => {
    assert(uiScript.includes('Now Pilot</div>'), 'Product name displayed');
    assert(uiScript.includes('AI-powered ServiceNow assistant'), 'Subtitle configured');
    assert(uiScript.includes('id="gmgai-prov-select"'), 'Model selector present');
    assert(uiScript.includes('id="gmgai-clear"'), 'Clear button present');
    assert(uiScript.includes('id="gmgai-close"'), 'Close button present');
    assert(uiScript.includes('aria-label="Close Now Pilot"'), 'Accessible label on close button');
    assert(uiScript.includes('title="Close Now Pilot"'), 'Tooltip on close button');
});

// 5. Navigation Tabs
test('5. Navigation Tabs: All 4 tabs present with green active indicator', () => {
    assert(uiScript.includes('id="gmgai-tab-chat"'), 'Chat tab present');
    assert(uiScript.includes('id="gmgai-tab-itsm"'), 'ITSM Intelligence tab present');
    assert(uiScript.includes('id="gmgai-tab-dev"'), 'Dev Assistant tab present');
    assert(uiScript.includes('id="gmgai-tab-workflow"'), 'Workflows tab present');
    assert(uiScript.includes('gmgai-tab-active'), 'Active tab styling class present');
    assert(uiScript.includes('border-bottom-color:var(--np-green)'), 'Green tab underline indicator');
});

// 6. Click-Outside & Inside-Click Containment
test('6. Event Handling: Internal clicks contained, outside clicks close cleanly', () => {
    assert(uiScript.includes('panelEl.onclick = function(e) {'), 'Internal clicks have dedicated click containment handler');
    assert(uiScript.includes('e.stopPropagation();'), 'StopPropagation used on panel clicks');
    assert(uiScript.includes('top.__gmgaiDocClick'), 'Document click handler registered on top window');
    assert(uiScript.includes('composedPath'), 'composedPath used for shadow DOM / nested containment check');
    assert(uiScript.includes('pEl.contains(e.target)'), 'contains fallback check implemented');
    assert(uiScript.includes('top.__gmgaiDocKeydown'), 'Escape key listener registered cleanly');
    assert(uiScript.includes("e.key === 'Escape'"), 'Escape key handler closes widget');
});

// 7. Update Set Packaging
test('7. Packaging: Double-escaping in XML update sets', () => {
    const globalXml = fs.readFileSync('update_sets/now_pilot_global.xml', 'utf8');
    assert(globalXml.includes('&amp;lt;svg'), 'SVG tag is double-escaped in global XML');
    assert(globalXml.includes('--np-background:#EEECE8'), 'Otto design tokens packaged in global XML');
    assert(globalXml.includes('id=&amp;quot;gmgai-close&amp;quot;'), 'Close button packaged in global XML');
});

console.log(`\n========================================`);
console.log(`OTTO UI REDESIGN TEST SUMMARY: ${passed} / ${total} tests passed.`);
console.log(`========================================\n`);

if (passed !== total) {
    process.exit(1);
}
