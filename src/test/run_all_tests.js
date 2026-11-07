const { execSync } = require('child_process');

const testSuites = [
    { file: 'src/test/test_responsive_layout.js', name: 'Responsive Layout' },
    { file: 'src/test/test_otto_ui.js', name: 'Otto UI Redesign' },
    { file: 'src/test/test_production_readiness.js', name: 'Production Readiness' },
    { file: 'src/test/test_dev_assistant.js', name: 'Dev Assistant' },
    { file: 'src/test/test_itsm_intelligence.js', name: 'ITSM Intelligence' },
    { file: 'src/test/test_omniroute.js', name: 'OmniRoute Multi-Model' },
    { file: 'src/test/test_workflow_automation.js', name: 'Workflow Automation' },
    { file: 'src/test/test_pillar1_backlog_uplift.js', name: 'Pillar 1 Backlog Uplift' }
];

console.log('----------------------------------------------------------------------');
console.log('TEST SUITE RECONCILIATION & EXECUTION AUDIT');
console.log('----------------------------------------------------------------------');

let totalPass = 0;
let totalFail = 0;

testSuites.forEach((ts, idx) => {
    try {
        const out = execSync('node ' + ts.file, { encoding: 'utf8' });
        const passes = (out.match(/\[PASS\]/g) || []).length;
        const fails = (out.match(/\[FAIL\]/g) || []).length;
        console.log('[Suite ' + (idx + 1) + '] ' + ts.name.padEnd(25) + ' | Exit: 0 | Passed: ' + passes.toString().padStart(3) + ' | Failed: ' + fails);
        totalPass += passes;
        totalFail += fails;
    } catch (e) {
        console.error('[Suite ' + (idx + 1) + '] ' + ts.name.padEnd(25) + ' | Exit: ' + (e.status || 1) + ' | FAILED');
        totalFail++;
    }
});

console.log('----------------------------------------------------------------------');
console.log('TOTAL UNIQUE FUNCTIONAL TESTS: ' + totalPass + ' PASSED, ' + totalFail + ' FAILED');
console.log('----------------------------------------------------------------------');

if (totalFail > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
