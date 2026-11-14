const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.Class = {
    create: function() {
        return function() {
            if (this.initialize) this.initialize.apply(this, arguments);
        };
    }
};
global.gs = {
    getProperty: function() { return 'local-test'; },
    error: function() {}
};

const scopedDir = path.join(__dirname, '..', 'scoped');
eval(fs.readFileSync(path.join(scopedDir, 'AgentTools.js'), 'utf8'));
eval(fs.readFileSync(path.join(scopedDir, 'AgentCore.js'), 'utf8'));

const tools = new AgentTools();
const definitions = tools.definitions();
const draftDefinition = definitions.find(d => d.name === 'draft_laptop_catalog_build');

assert(draftDefinition, 'The laptop blueprint tool is registered.');
assert.strictEqual(AgentCore.filterDefs(definitions, 'record').some(d => d.name === 'draft_laptop_catalog_build'), true);
assert(AgentCore.prototype.staticPrompt.call({}, {}, 'record').includes('design-only laptop catalog/approval/fulfillment blueprint'));

global.GlideRecord = function() { throw new Error('The design-only tool must not access ServiceNow records.'); };
global.GlideRecordSecure = global.GlideRecord;

const defaultPlan = tools.execute('draft_laptop_catalog_build', {});
assert.strictEqual(defaultPlan.type, 'laptop_catalog_flow_blueprint');
assert.strictEqual(defaultPlan.status, 'design_only');
assert.strictEqual(defaultPlan.apply_supported, false);
assert.strictEqual(defaultPlan.persisted, false);
assert.strictEqual(defaultPlan.instance_writes, false);
assert.strictEqual(defaultPlan.execution_ready, false);
assert.strictEqual(defaultPlan.catalog_item.name, 'Laptop Request');
assert.strictEqual(defaultPlan.catalog_item.active, false);
assert(defaultPlan.catalog_item.variables.some(v => v.name === 'requested_for' && v.reference === 'sys_user'));
assert(defaultPlan.flow.steps.some(s => s.type === 'Manager Approval'));
const financeStep = defaultPlan.flow.steps.find(s => s.type === 'Conditional IT Finance CAB Approval');
assert(financeStep);
assert.strictEqual(financeStep.required_when, null);
assert.strictEqual(financeStep.configuration_required, true);
assert(defaultPlan.decision_points.some(d => d.indexOf('Define the approved condition') >= 0));
assert(defaultPlan.flow.steps.some(s => s.type === 'Create Catalog Task' && s.assignment_group === 'Hardware'));
assert(defaultPlan.implementation_notice.includes('No ServiceNow records'));

const configuredPlan = tools.execute('draft_laptop_catalog_build', {
    catalog_item_name: 'Employee Laptop Request',
    finance_condition: 'estimated_cost exceeds approved_limit',
    hardware_assignment_group: 'Endpoint Hardware'
});
assert.strictEqual(configuredPlan.catalog_item.name, 'Employee Laptop Request');
assert.strictEqual(configuredPlan.flow.steps.find(s => s.type === 'Conditional IT Finance CAB Approval').required_when, 'estimated_cost exceeds approved_limit');
assert.strictEqual(configuredPlan.flow.steps.find(s => s.type === 'Create Catalog Task').assignment_group, 'Endpoint Hardware');
assert.strictEqual(configuredPlan.decision_points.some(d => d.indexOf('Define the approved condition') >= 0), false);

const invalidPlan = tools.execute('draft_laptop_catalog_build', {catalog_item_name: 'x'.repeat(101)});
assert(invalidPlan.error && invalidPlan.error.indexOf('Catalog item name') >= 0);
const invalidTypePlan = tools.execute('draft_laptop_catalog_build', {finance_condition: ['not', 'text']});
assert(invalidTypePlan.error && invalidTypePlan.error.indexOf('Finance condition must be text') >= 0);

console.log('[PASS] Laptop catalog blueprint is available in chat and remains design-only');
console.log('[PASS] Approval condition and Hardware group are explicit, configurable, and never written');
console.log('[PASS] Invalid blueprint input is rejected');
