// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
/**
 * Test Suite: Pillar 1 - Slashing the Backlog & Bridging the Talent Shortage
 * Verifies:
 * 1. Backlog Story Decomposer (DevAssistant.StoryDecomposer)
 * 2. Automated Test Framework Step & Suite Engine (DevAssistant.ATFGenerator)
 * 3. Senior Architect Code Refactorer (DevAssistant.ArchitectRefactorer)
 * 4. DevAssistant Integration & AgentTools Dispatch
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Setup mock ServiceNow environment
const mockState = {
    properties: {
        'instance_name': 'dev12345',
        'x_gmg_ai.max_rounds': '4',
        'x_gmg_ai.config_id': '6816f79cc0a8016401c5a33be04be441'
    },
    tables: {
        incident: [],
        sys_user: []
    },
    roles: ['admin', 'itil', 'x_gmg_ai.user']
};

global.Class = {
    create: function() {
        return function() {
            if (this.initialize) this.initialize.apply(this, arguments);
        };
    }
};

global.gs = {
    getProperty: (name, def) => (name in mockState.properties ? mockState.properties[name] : def),
    setProperty: (name, val) => { mockState.properties[name] = String(val); },
    hasRole: (r) => mockState.roles.includes(r),
    getUserID: () => '6816f79cc0a8016401c5a33be04be441',
    info: () => {},
    warn: () => {},
    error: () => {}
};

global.GlideDateTime = function(val) {
    this.val = val || '2026-11-01 00:00:00';
    this.getValue = () => this.val;
};

global.GlideRecord = function(table) {
    this.table = table;
    this.query = function() {};
    this.setLimit = function() {};
    this.insert = function() { return '6816f79cc0a8016401c5a33be04be441'; };
    this.get = function() { return true; };
    this.deleteRecord = function() { return true; };
    this.initialize = function() {};
    this.setValue = function() {};
    this.getValue = function() { return 'test'; };
    this.isValidField = function() { return true; };
    this.isValidRecord = function() { return true; };
};
global.GlideRecordSecure = global.GlideRecord;

// Load Scoped Source Files
const scopedDir = path.resolve('src/scoped');
eval(fs.readFileSync(path.join(scopedDir, 'DevValidator.js'), 'utf8'));
eval(fs.readFileSync(path.join(scopedDir, 'DevAssistant.js'), 'utf8'));
eval(fs.readFileSync(path.join(scopedDir, 'AgentTools.js'), 'utf8'));

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  [PASS] ${name}`);
    } catch (e) {
        failed++;
        console.error(`  [FAIL] ${name}`);
        console.error(`         ${e.message}`);
    }
}

console.log('======================================================================');
console.log('NOWPILOT PILLAR 1: BACKLOG SLASHING & TALENT UPLIFT SUITE');
console.log('======================================================================');

// --------------------------------------------------------------------
// Section 1: Backlog Story Decomposer
// --------------------------------------------------------------------
console.log('\n--- Section 1: Backlog Story Decomposer (DevAssistant.StoryDecomposer) ---');

test('1. Decomposes VIP Incident Escalation Story with Complete Architecture', () => {
    const story = 'As an IT support agent, when a VIP caller submits a P1 Incident, alert the on-call manager and lock assignment group.';
    const blueprint = DevAssistant.decomposeStory(story);

    assert.strictEqual(blueprint.target_table, 'incident');
    assert.strictEqual(blueprint.persona, 'IT Service Desk Agent');
    assert(blueprint.story_points >= 5, `Expected >= 5 points, got ${blueprint.story_points}`);
    assert(blueprint.components.length >= 3, `Expected at least 3 components, got ${blueprint.components.length}`);

    // Verify UI Policy component
    const uip = blueprint.components.find(c => c.type === 'ui_policy');
    assert(uip, 'UI Policy component should be present');
    assert.strictEqual(uip.table, 'incident');

    // Verify Flow Designer component
    const flow = blueprint.components.find(c => c.type === 'flow_designer');
    assert(flow, 'Flow Designer component should be present');

    // Verify Business Rule component
    const br = blueprint.components.find(c => c.type === 'business_rule');
    assert(br, 'Business Rule component should be present');
});

test('2. Decomposes Change Request CAB Approval Story', () => {
    const story = 'As a Change Manager, all normal changes must require CAB approval and restrict modify role.';
    const blueprint = DevAssistant.decomposeStory(story);

    assert.strictEqual(blueprint.target_table, 'change_request');
    assert(blueprint.persona.includes('Change Manager'));
    
    const flow = blueprint.components.find(c => c.type === 'flow_designer');
    assert(flow, 'Flow Designer should be recommended for CAB approvals');

    const acl = blueprint.components.find(c => c.type === 'acl');
    assert(acl, 'ACL should be recommended for role restrictions');
});

test('3. Decomposes Service Catalog Item Request Story', () => {
    const story = 'As an employee, requesting a new laptop catalog item requires manager approval and notification.';
    const blueprint = DevAssistant.decomposeStory(story);

    assert.strictEqual(blueprint.target_table, 'sc_req_item');
    assert(blueprint.persona.includes('Employee'));
    assert(blueprint.ootb_first_recommendations.length > 0);
});

test('4. Generates Verifiable Given-When-Then Acceptance Criteria', () => {
    const story = 'When a VIP submits an incident, lock fields and notify manager.';
    const blueprint = DevAssistant.decomposeStory(story);

    assert(Array.isArray(blueprint.acceptance_criteria), 'Should produce acceptance criteria array');
    assert(blueprint.acceptance_criteria.length >= 3, 'Should have multiple criteria');
    blueprint.acceptance_criteria.forEach(crit => {
        assert(crit.includes('Given') || crit.includes('when') || crit.includes('then'), 'Criteria must follow BDD structure');
    });
});

test('5. Enforces Fibonacci Story Point Scale and Risk Justifications', () => {
    const validPoints = [1, 2, 3, 5, 8, 13];
    const simple = DevAssistant.decomposeStory('Simple read-only field on incident');
    const complex = DevAssistant.decomposeStory('Cross-system REST API integration with manager approval and VIP escalation and role lock');

    assert(validPoints.includes(simple.story_points), `Simple points ${simple.story_points} must be Fibonacci`);
    assert(validPoints.includes(complex.story_points), `Complex points ${complex.story_points} must be Fibonacci`);
    assert(complex.story_points >= simple.story_points, 'Complex story must have >= points than simple');
    assert(complex.risk_reasons.length > 0, 'Complex story must have risk reasons');
});

test('6. Formulates OOTB-First Architecture Strategy', () => {
    const story = 'Lock fields and require mandatory justification on incident';
    const blueprint = DevAssistant.decomposeStory(story);

    const uiRec = blueprint.ootb_first_recommendations.find(r => r.approach.includes('UI Policy'));
    assert(uiRec, 'Must recommend OOTB UI Policy over custom Client Script');
    assert(uiRec.rationale.includes('ServiceNow CTA Best Practice'));
});

// --------------------------------------------------------------------
// Section 2: Automated Test Framework (ATF) Engine
// --------------------------------------------------------------------
console.log('\n--- Section 2: Automated Test Framework Engine (DevAssistant.ATFGenerator) ---');

test('7. Generates Sequential Form Test Steps for Incident', () => {
    const atf = DevAssistant.generateATF({ table: 'incident' });

    assert.strictEqual(atf.table, 'incident');
    assert(atf.steps.length >= 4, `Expected at least 4 steps, got ${atf.steps.length}`);

    const stepTypes = atf.steps.map(s => s.step_type);
    assert(stepTypes.includes('impersonate'), 'Must include impersonation step');
    assert(stepTypes.includes('open_a_new_form'), 'Must include open form step');
    assert(stepTypes.includes('set_field_values'), 'Must include set field values step');
    assert(stepTypes.includes('submit_a_form'), 'Must include submit form step');
});

test('8. Injects Field State Validation Steps when Constraints Specified', () => {
    const atf = DevAssistant.generateATF({
        table: 'incident',
        mandatory_fields: ['short_description', 'caller_id'],
        read_only_fields: ['priority']
    });

    const stateStep = atf.steps.find(s => s.step_type === 'field_state_validation');
    assert(stateStep, 'Should generate field_state_validation step');
    assert.deepStrictEqual(stateStep.parameters.mandatory, ['short_description', 'caller_id']);
    assert.deepStrictEqual(stateStep.parameters.read_only, ['priority']);
});

test('9. Generates Complete Jasmine Server-Side Assertion Script with Teardown', () => {
    const atf = DevAssistant.generateATF({ table: 'incident', name: 'ATF_Incident_Sanity' });
    const script = atf.server_assertion_script;

    assert(script.includes('(function(outputs, steps, params, stepResult, assertEqual)'), 'Must have ATF signature');
    assert(script.includes('describe("ATF_Incident_Sanity Server Verification"'), 'Must have Jasmine describe block');
    assert(script.includes('beforeEach(function()'), 'Must have fixture setup');
    assert(script.includes('afterEach(function()'), 'Must have self-cleaning teardown');
    assert(script.includes('grClean.deleteRecord()'), 'Must perform cleanup deletion');
    assert(script.includes('it("should successfully insert'), 'Must assert insertion');
});

test('10. Generates Table-Specific Defaults for Change Request', () => {
    const atf = DevAssistant.generateATF({ table: 'change_request' });
    const setStep = atf.steps.find(s => s.step_type === 'set_field_values');
    assert(setStep, 'Must have set_field_values step');
    assert.strictEqual(setStep.parameters.field_values.type, 'normal');
});

// --------------------------------------------------------------------
// Section 3: Senior Architect Code Refactorer
// --------------------------------------------------------------------
console.log('\n--- Section 3: Senior Architect Code Refactorer (DevAssistant.ArchitectRefactorer) ---');

test('11. Refactors Business Rule: Eliminates current.update() in Before Rules', () => {
    const badCode = '(function executeRule(current, previous) {\n    current.urgency = "1";\n    current.update();\n})(current, previous);';
    const ref = DevAssistant.refactorCode(badCode, 'business_rule');

    assert(!ref.refactored_code.includes('current.update();'), 'Must remove current.update() call');
    assert(!ref.refactored_code.includes('current.update('), 'Must remove all current.update invocations');
    assert(ref.refactored_code.includes('current.urgency = "1"'), 'Must preserve field assignment');
    assert(ref.issues_found.some(i => i.id === 'BR_RECURSIVE_UPDATE'), 'Must report BR_RECURSIVE_UPDATE issue');
});

test('12. Refactors Client Script: Migrates Synchronous GlideRecord to Asynchronous GlideAjax', () => {
    const badClient = 'function onLoad() {\n    var gr = new GlideRecord("sys_user");\n    gr.addQuery("sys_id", g_user.userID);\n    gr.query();\n    if (gr.next()) {\n        g_form.setValue("email", gr.email);\n    }\n}';
    const ref = DevAssistant.refactorCode(badClient, 'client_script');

    assert(!ref.refactored_code.includes('new GlideRecord'), 'Client script must not contain synchronous GlideRecord');
    assert(ref.refactored_code.includes('new GlideAjax'), 'Must contain asynchronous GlideAjax instantiation');
    assert(ref.refactored_code.includes('getXMLAnswer'), 'Must use getXMLAnswer callback');
    assert.strictEqual(ref.companion_artifacts.length, 1, 'Must auto-generate 1 companion Script Include');

    const companion = ref.companion_artifacts[0];
    assert.strictEqual(companion.artifact_type, 'script_include');
    assert.strictEqual(companion.client_callable, true);
    assert(companion.code.includes('AbstractAjaxProcessor'), 'Companion Script Include must extend AbstractAjaxProcessor');
});

test('13. Guards Unbounded Queries: Injects Defensive setLimit(500)', () => {
    const unboundedCode = 'function findActiveIncidents() {\n    var gr = new GlideRecord("incident");\n    gr.addActiveQuery();\n    gr.query();\n    while (gr.next()) {}\n}';
    const ref = DevAssistant.refactorCode(unboundedCode, 'script_include');

    assert(ref.refactored_code.includes('gr.setLimit(500);'), 'Must inject setLimit(500) before query()');
    assert(ref.issues_found.some(i => i.id === 'UNBOUNDED_GLIDERECORD_QUERY'), 'Must report UNBOUNDED_GLIDERECORD_QUERY issue');
});

test('14. Parameterizes Hardcoded 32-Character sys_ids with gs.getProperty', () => {
    const hardcodedCode = 'var defaultAdmin = "6816f79cc0a8016401c5a33be04be441";\nvar gr = new GlideRecord("sys_user");';
    const ref = DevAssistant.refactorCode(hardcodedCode, 'script_include');

    assert(ref.refactored_code.includes("gs.getProperty('x_gmg_ai.config_id', '6816f79cc0a8016401c5a33be04be441')"), 'Must replace hardcoded sys_id with gs.getProperty lookup');
    assert(ref.issues_found.some(i => i.id === 'HARDCODED_SYS_ID'), 'Must report HARDCODED_SYS_ID issue');
});

test('15. Detects N+1 Query Loop Anti-Pattern', () => {
    const nPlusOneCode = 'var grInc = new GlideRecord("incident");\ngrInc.setLimit(100);\ngrInc.query();\nwhile (grInc.next()) {\n    var grUser = new GlideRecord("sys_user");\n    grUser.get(grInc.caller_id);\n}';
    const ref = DevAssistant.refactorCode(nPlusOneCode, 'script_include');

    assert(ref.issues_found.some(i => i.id === 'N_PLUS_ONE_QUERY'), 'Must report N_PLUS_ONE_QUERY issue');
});

test('16. Multi-Issue Refactoring: Fixes Recursion, Missing Limit, and Hardcoded Sys_ID in One Pass', () => {
    const messyCode = '(function executeRule(current) {\n    current.priority = "1";\n    current.update();\n    var gr = new GlideRecord("incident");\n    gr.query();\n    var fallbackId = "46d44a23a9fe19950012d100cca80666";\n})(current);';
    const ref = DevAssistant.refactorCode(messyCode, 'business_rule');

    assert.strictEqual(ref.issues_found.length, 3, 'Must detect all 3 issues simultaneously');
    assert(!ref.refactored_code.includes('current.update();'), 'Must remove current.update');
    assert(ref.refactored_code.includes('setLimit(500)'), 'Must inject setLimit');
    assert(ref.refactored_code.includes('gs.getProperty'), 'Must parameterize sys_id');
});

test('17. Clean Code Passes Unmodified with 0 Anti-Patterns', () => {
    const cleanCode = '(function executeRule(current, previous) {\n    if (!current.isValidRecord()) return;\n    current.urgency = "2";\n})(current, previous);';
    const ref = DevAssistant.refactorCode(cleanCode, 'business_rule');

    assert.strictEqual(ref.issues_found.length, 0, 'Clean code should have 0 issues');
    assert.strictEqual(ref.improvements_made.length, 0);
});

// --------------------------------------------------------------------
// Section 4: DevAssistant & AgentTools Integration
// --------------------------------------------------------------------
console.log('\n--- Section 4: DevAssistant & AgentTools Integration ---');

test('18. DevAssistant Exposes ARTIFACT_TYPES for Story Decomposition & Refactoring', () => {
    assert(DevAssistant.ARTIFACT_TYPES['story_decomposition'], 'Must support story_decomposition artifact');
    assert(DevAssistant.ARTIFACT_TYPES['code_refactor'], 'Must support code_refactor artifact');
    assert.strictEqual(DevAssistant.ARTIFACT_TYPES['story_decomposition'].category, 'architecture');
    assert.strictEqual(DevAssistant.ARTIFACT_TYPES['code_refactor'].category, 'refactoring');
});

test('19. DevAssistant.TEMPLATES Generates Valid Templates', () => {
    const tStory = DevAssistant.TEMPLATES['story_decomposition']('VIP Escalation', 'incident');
    assert(tStory.includes('Story Decomposition: VIP Escalation'), 'Story template must have title');

    const tATF = DevAssistant.TEMPLATES['atf_test']('Incident_Sanity', 'incident');
    assert(tATF.includes('Jasmine BDD'), 'ATF template must include Jasmine');

    const tRef = DevAssistant.TEMPLATES['code_refactor']('Urgent BR', 'business_rule');
    assert(tRef.includes('CTA Architectural Refactoring'), 'Refactor template must include header');
});

test('20. DevAssistant.createProposal Generates Story Blueprint Proposal Card', () => {
    const dev = new DevAssistant();
    const card = dev.createProposal({
        artifact_type: 'story_decomposition',
        name: 'VIP Escalation Blueprint',
        table: 'incident',
        code: '# Story Decomposition\nTarget Table: `incident`'
    });

    assert.strictEqual(card.type, 'dev_artifact');
    assert.strictEqual(card.artifact_type, 'story_decomposition');
    assert.strictEqual(card.is_guidance, true);
    assert.strictEqual(card.validation.ok, true);
});

test('21. DevAssistant.createProposal Generates Code Refactoring Proposal Card', () => {
    const dev = new DevAssistant();
    const card = dev.createProposal({
        artifact_type: 'code_refactor',
        name: 'Refactored VIP Business Rule',
        table: 'incident',
        code: '// Refactored code\nvar a = 1;'
    });

    assert.strictEqual(card.type, 'dev_artifact');
    assert.strictEqual(card.artifact_type, 'code_refactor');
    assert.strictEqual(card.is_refactor, true);
});

test('22. AgentTools Defines Pillar 1 Execution Capabilities', () => {
    const tools = new AgentTools();
    const defs = tools.definitions();
    const names = defs.map(d => d.name);

    assert(names.includes('decompose_story'), 'AgentTools must define decompose_story');
    assert(names.includes('generate_atf_test'), 'AgentTools must define generate_atf_test');
    assert(names.includes('refactor_dev_code'), 'AgentTools must define refactor_dev_code');
});

test('23. AgentTools.execute Dispatches decompose_story Tool', () => {
    const tools = new AgentTools();
    const res = tools.execute('decompose_story', {
        story_text: 'As an IT agent, when a P1 incident happens, alert manager and lock desk.',
        table: 'incident'
    });

    assert(res && !res.error, `Tool execution failed: ${res ? res.error : 'empty'}`);
    assert.strictEqual(res.target_table, 'incident');
    assert(res.components.length >= 3);
});

test('24. AgentTools.execute Dispatches generate_atf_test Tool', () => {
    const tools = new AgentTools();
    const res = tools.execute('generate_atf_test', {
        table: 'incident',
        test_name: 'ATF_Incident_Automated'
    });

    assert(res && !res.error, `Tool execution failed: ${res ? res.error : 'empty'}`);
    assert.strictEqual(res.test_name, 'ATF_Incident_Automated');
    assert(res.steps.length >= 4);
});

test('25. AgentTools.execute Dispatches refactor_dev_code Tool', () => {
    const tools = new AgentTools();
    const res = tools.execute('refactor_dev_code', {
        code: 'function executeRule(current) { current.update(); }',
        artifact_type: 'business_rule'
    });

    assert(res && !res.error, `Tool execution failed: ${res ? res.error : 'empty'}`);
    assert(!res.refactored_code.includes('current.update();'));
    assert(res.issues_found.length >= 1);
});

test('26. DevValidator Validates Refactored Code with Zero Errors', () => {
    const badCode = '(function executeRule(current) {\n    current.update();\n    var gr = new GlideRecord("incident");\n    gr.query();\n})(current);';
    const ref = DevAssistant.refactorCode(badCode, 'business_rule');
    const validator = new DevValidator();
    const valResult = validator.validate(ref.refactored_code, 'business_rule');

    assert.strictEqual(valResult.counts.Critical, 0, 'Refactored code must have 0 critical issues');
    assert.strictEqual(valResult.ok, true, 'Refactored code must be valid');
});

console.log('----------------------------------------------------------------------');
console.log(`TOTAL PILLAR 1 TESTS: ${passed} PASSED, ${failed} FAILED`);
console.log('----------------------------------------------------------------------');

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
