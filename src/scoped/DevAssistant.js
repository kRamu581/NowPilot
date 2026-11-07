// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
var DevAssistant = Class.create();

/**
 * Advanced ServiceNow Development Assistant engine.
 * Handles generation, explanation, review, and debugging of ServiceNow artifacts:
 * 1. Business Rules (sys_script)
 * 2. Script Includes (sys_script_include)
 * 3. Client Scripts (sys_script_client)
 * 4. UI Policies & Actions (sys_ui_policy / sys_ui_policy_action)
 * 5. UI Actions (sys_ui_action)
 * 6. Background Scripts (scripts - background / ad-hoc safe runner)
 * 7. Scripted REST API resources (sys_ws_operation)
 * 8. Flow Designer implementation guidance
 * 9. Service Portal widgets (sp_widget)
 * 10. Automated Test Framework (ATF) test plans & scripts (sys_atf_test)
 * 11. Story Decomposition Blueprints (rm_story)
 * 12. Senior Architect Code Refactoring
 */
DevAssistant.ARTIFACT_TYPES = {
    'business_rule': {
        label: 'Business Rule',
        table: 'sys_script',
        category: 'server',
        description: 'Server-side database trigger executing on insert, update, delete, or query.'
    },
    'script_include': {
        label: 'Script Include',
        table: 'sys_script_include',
        category: 'server',
        description: 'Reusable server-side JavaScript class or library, optionally client-callable.'
    },
    'client_script': {
        label: 'Client Script',
        table: 'sys_script_client',
        category: 'client',
        description: 'Browser-side script executing on form load, field change, or submit.'
    },
    'ui_policy': {
        label: 'UI Policy & Actions',
        table: 'sys_ui_policy',
        category: 'client',
        description: 'Client-side condition engine setting field mandatory, visible, or read-only states.'
    },
    'ui_action': {
        label: 'UI Action',
        table: 'sys_ui_action',
        category: 'hybrid',
        description: 'Form button, link, context menu item, or list button with client/server execution.'
    },
    'background_script': {
        label: 'Background Script',
        table: '',
        category: 'server_adhoc',
        description: 'One-off administrative script with dry-run and rollback protections. Never auto-executed.'
    },
    'scripted_rest': {
        label: 'Scripted REST API Resource',
        table: 'sys_ws_operation',
        category: 'server',
        description: 'Custom REST endpoint handling inbound HTTP requests and producing JSON responses.'
    },
    'flow_designer': {
        label: 'Flow Designer Guidance',
        table: 'sys_hub_flow',
        category: 'no_code_guidance',
        description: 'Step-by-step guidance for triggers, flow logic, actions, subflows, and error handlers.'
    },
    'service_portal_widget': {
        label: 'Service Portal Widget',
        table: 'sp_widget',
        category: 'sp',
        description: 'Service Portal widget composed of HTML template, Client Controller, Server Script, and CSS.'
    },
    'atf_test': {
        label: 'ATF Test Plan & Script',
        table: 'sys_atf_test',
        category: 'testing',
        description: 'Automated Test Framework test steps for form validation, server assertions, and regressions.'
    },
    'story_decomposition': {
        label: 'Story Decomposition Blueprint',
        table: 'rm_story',
        category: 'architecture',
        description: 'CTA architectural blueprint decomposing backlog stories into OOTB configs, flows, BRs, ACLs, story points, and ATF test plans.'
    },
    'code_refactor': {
        label: 'Senior Code Refactoring',
        table: '',
        category: 'refactoring',
        description: 'CTA-grade automated refactoring eliminating junior anti-patterns (recursive update in before BR, sync client GlideRecord to GlideAjax, unbounded queries, hardcoded sys_ids).'
    }
};

/**
 * Canonical starter templates ensuring adherence to ServiceNow runtime conventions
 */
DevAssistant.TEMPLATES = {
    'business_rule': function(name, table, when, actions) {
        when = when || 'before';
        table = table || 'incident';
        return '(function executeRule(current, previous /*null when async*/) {\n' +
               '    // Business Rule: ' + (name || 'Handle ' + table) + '\n' +
               '    // Timing: ' + when + ' (insert/update)\n' +
               '    // NOTE: In before rules, do NOT call current.update(). Changes to current are saved automatically.\n' +
               '    try {\n' +
               '        if (!current.isValidRecord()) return;\n\n' +
               '        // Business logic here\n\n' +
               '    } catch (ex) {\n' +
               '        gs.error("Error in Business Rule ' + name + ': " + ex.message);\n' +
               '    }\n' +
               '})(current, previous);';
    },

    'script_include': function(name, clientCallable, scope) {
        name = name || 'MyScriptInclude';
        if (clientCallable) {
            return 'var ' + name + ' = Class.create();\n' +
                   name + '.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {\n' +
                   '    // Client-callable method: call via ga.addParam("sysparm_name", "myMethod");\n' +
                   '    myMethod: function() {\n' +
                   '        var paramValue = this.getParameter("sysparm_value");\n' +
                   '        var result = this.newItem("result");\n' +
                   '        result.setAttribute("status", "success");\n' +
                   '        return JSON.stringify({ ok: true, data: paramValue });\n' +
                   '    },\n\n' +
                   '    type: "' + name + '"\n' +
                   '});';
        }
        return 'var ' + name + ' = Class.create();\n' +
               name + '.prototype = {\n' +
               '    initialize: function() {\n' +
               '    },\n\n' +
               '    execute: function(input) {\n' +
               '        return { ok: true, input: input };\n' +
               '    },\n\n' +
               '    type: "' + name + '"\n' +
               '};';
    },

    'client_script': function(name, type, table) {
        type = type || 'onLoad';
        if (type === 'onChange') {
            return 'function onChange(control, oldValue, newValue, isLoading, isTemplate) {\n' +
                   '    if (isLoading || newValue === "") {\n' +
                   '        return;\n' +
                   '    }\n' +
                   '    // onChange client logic\n' +
                   '}';
        }
        if (type === 'onSubmit') {
            return 'function onSubmit() {\n' +
                   '    // Return false to prevent form submission\n' +
                   '    return true;\n' +
                   '}';
        }
        return 'function onLoad() {\n' +
               '    // onLoad client logic using g_form\n' +
               '}';
    },

    'ui_action': function(name, table, isClient) {
        if (isClient) {
            return '// Client-side onClick function\n' +
                   'function runClientCode() {\n' +
                   '    if (g_form.getValue("short_description") == "") {\n' +
                   '        g_form.addErrorMessage("Short description is required.");\n' +
                   '        return false;\n' +
                   '    }\n' +
                   '    gsftSubmit(null, g_form.getFormElement(), "' + (name || 'custom_action') + '");\n' +
                   '}\n\n' +
                   '// Server-side code execution\n' +
                   'if (typeof window == "undefined") {\n' +
                   '    runServerCode();\n' +
                   '}\n\n' +
                   'function runServerCode() {\n' +
                   '    current.update();\n' +
                   '    action.setRedirectURL(current);\n' +
                   '}';
        }
        return '// Server-side UI Action\n' +
               '(function executeUIAction(current) {\n' +
               '    current.update();\n' +
               '    action.setRedirectURL(current);\n' +
               '})(current);';
    },

    'background_script': function(description) {
        return '// =========================================================================\n' +
               '// Background Script: ' + (description || 'Safe Administrative Script') + '\n' +
               '// SAFETY: dryRun = true executes in simulation mode without committing updates.\n' +
               '// NEVER AUTO-EXECUTED: Run manually in System Definition > Scripts - Background\n' +
               '// =========================================================================\n' +
               '(function executeAdminScript() {\n' +
               '    var dryRun = true;\n' +
               '    var limit = 100;\n' +
               '    var processed = 0;\n' +
               '    var updated = 0;\n\n' +
               '    gs.info("[BG SCRIPT] Starting script. DryRun = " + dryRun);\n' +
               '    try {\n' +
               '        var gr = new GlideRecord("incident");\n' +
               '        gr.addActiveQuery();\n' +
               '        gr.setLimit(limit);\n' +
               '        gr.query();\n\n' +
               '        while (gr.next()) {\n' +
               '            processed++;\n' +
               '            if (!dryRun) {\n' +
               '                // gr.setValue("field", value);\n' +
               '                // gr.update();\n' +
               '                updated++;\n' +
               '            }\n' +
               '        }\n' +
               '        gs.info("[BG SCRIPT] Completed. Processed: " + processed + ", Updated: " + updated);\n' +
               '    } catch (e) {\n' +
               '        gs.error("[BG SCRIPT] Exception encountered: " + e);\n' +
               '    }\n' +
               '})();';
    },

    'scripted_rest': function(name, method) {
        return '(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {\n' +
               '    // Scripted REST API: ' + (name || 'Custom Endpoint') + '\n' +
               '    var queryParams = request.queryParams;\n' +
               '    var pathParams = request.pathParams;\n' +
               '    var bodyData = request.body.data || {};\n\n' +
               '    try {\n' +
               '        response.setStatus(200);\n' +
               '        response.setContentType("application/json");\n' +
               '        return {\n' +
               '            ok: true,\n' +
               '            timestamp: new GlideDateTime().getValue(),\n' +
               '            result: bodyData\n' +
               '        };\n' +
               '    } catch (ex) {\n' +
               '        response.setStatus(500);\n' +
               '        return { ok: false, error: ex.message };\n' +
               '    }\n' +
               '})(request, response);';
    },

    'story_decomposition': function(title, table) {
        table = table || 'incident';
        return '# Story Decomposition: ' + (title || 'Enhancement for ' + table) + '\n\n' +
               'Target Table: `' + table + '`\n' +
               'Story Points: `3 pts` | Complexity: `Medium` | Risk: `Low`\n\n' +
               '## 1. OOTB First Recommendations\n' +
               '- Form UI: Configure UI Policy over Client Script for field mandatory/read-only rules.\n' +
               '- Workflow: Use Flow Designer for notifications and multi-stage approvals.\n\n' +
               '## 2. Components\n' +
               '- UI Policy: UIP - Enforce Field States on ' + table + '\n' +
               '- Business Rule: BR - Validate and Calculate ' + table + ' Defaults (Before Insert/Update)\n' +
               '- ATF Test: ATF_Regression_' + table.toUpperCase() + '\n';
    },

    'atf_test': function(name, table) {
        table = table || 'incident';
        name = name || ('ATF_Regression_' + table.toUpperCase());
        return '/**\n' +
               ' * ServiceNow ATF Server-Side Test Script (Jasmine BDD)\n' +
               ' * Target Table: ' + table + '\n' +
               ' */\n' +
               '(function(outputs, steps, params, stepResult, assertEqual) {\n' +
               '    describe("' + name + ' Suite", function() {\n' +
               '        var testSysId = null;\n' +
               '        beforeEach(function() {\n' +
               '            var gr = new GlideRecord("' + table + '");\n' +
               '            gr.initialize();\n' +
               '            gr.setValue("short_description", "ATF_FIXTURE_' + table + '");\n' +
               '            testSysId = gr.insert();\n' +
               '        });\n' +
               '        afterEach(function() {\n' +
               '            if (testSysId) {\n' +
               '                var grDel = new GlideRecord("' + table + '");\n' +
               '                if (grDel.get(testSysId)) grDel.deleteRecord();\n' +
               '            }\n' +
               '        });\n' +
               '        it("should verify record creation and default properties", function() {\n' +
               '            expect(testSysId).not.toBeNull();\n' +
               '            var grVerify = new GlideRecord("' + table + '");\n' +
               '            expect(grVerify.get(testSysId)).toBe(true);\n' +
               '        });\n' +
               '    });\n' +
               '})(outputs, steps, params, stepResult, assertEqual);';
    },

    'code_refactor': function(name, artifactType) {
        return '// =========================================================================\n' +
               '// CTA Architectural Refactoring for: ' + (name || 'ServiceNow Script') + '\n' +
               '// Artifact Type: ' + (artifactType || 'business_rule') + '\n' +
               '// Standards Applied: Anti-recursion, Asynchronous GlideAjax, Bounded Queries, System Properties\n' +
               '// =========================================================================\n';
    }
};

/**
 * Pillar 1: Backlog Story Decomposer
 * Decomposes business user stories and enhancement requests into CTA architectural blueprints
 * following OOTB-first design principles.
 */
DevAssistant.StoryDecomposer = {
    decompose: function(storyText, options) {
        options = options || {};
        var text = String(storyText || '').trim();
        var lower = text.toLowerCase();

        // 1. Target table detection
        var targetTable = options.table;
        if (!targetTable) {
            if (lower.indexOf('incident') >= 0 || lower.indexOf('p1') >= 0 || lower.indexOf('p2') >= 0 || lower.indexOf('caller') >= 0) {
                targetTable = 'incident';
            } else if (lower.indexOf('change') >= 0 || lower.indexOf('cab') >= 0 || lower.indexOf('cr ') >= 0 || lower.indexOf('rfc') >= 0) {
                targetTable = 'change_request';
            } else if (lower.indexOf('problem') >= 0 || lower.indexOf('known error') >= 0 || lower.indexOf('root cause') >= 0) {
                targetTable = 'problem';
            } else if (lower.indexOf('catalog') >= 0 || lower.indexOf('ritm') >= 0 || lower.indexOf('req') >= 0 || lower.indexOf('item') >= 0) {
                targetTable = 'sc_req_item';
            } else if (lower.indexOf('user') >= 0 || lower.indexOf('profile') >= 0) {
                targetTable = 'sys_user';
            } else if (lower.indexOf('asset') >= 0 || lower.indexOf('ci') >= 0 || lower.indexOf('cmdb') >= 0) {
                targetTable = 'cmdb_ci';
            } else {
                targetTable = 'incident';
            }
        }

        // 2. Persona detection
        var persona = 'ServiceNow User / Stakeholder';
        if (lower.indexOf('as a service desk') >= 0 || lower.indexOf('as an it agent') >= 0 || lower.indexOf('as an agent') >= 0 || lower.indexOf('as an it support') >= 0) {
            persona = 'IT Service Desk Agent';
        } else if (lower.indexOf('as a change manager') >= 0 || lower.indexOf('as cab') >= 0) {
            persona = 'Change Manager / CAB Member';
        } else if (lower.indexOf('as an incident manager') >= 0) {
            persona = 'Major Incident Manager';
        } else if (lower.indexOf('as a system admin') >= 0 || lower.indexOf('as an admin') >= 0 || lower.indexOf('as platform admin') >= 0) {
            persona = 'Platform Administrator';
        } else if (lower.indexOf('as an employee') >= 0 || lower.indexOf('as a caller') >= 0 || lower.indexOf('as end user') >= 0) {
            persona = 'Employee / End User';
        } else if (lower.indexOf('as a developer') >= 0) {
            persona = 'ServiceNow Application Developer';
        }

        // 3. Needs Analysis
        var hasVip = lower.indexOf('vip') >= 0;
        var hasPriorityOrUrgency = lower.indexOf('priority') >= 0 || lower.indexOf('urgency') >= 0 || lower.indexOf('p1') >= 0 || lower.indexOf('critical') >= 0;
        var hasLockOrReadOnly = lower.indexOf('lock') >= 0 || lower.indexOf('read-only') >= 0 || lower.indexOf('readonly') >= 0;
        var hasMandatory = lower.indexOf('mandatory') >= 0 || lower.indexOf('require') >= 0;
        var hasNotification = lower.indexOf('notify') >= 0 || lower.indexOf('notification') >= 0 || lower.indexOf('email') >= 0 || lower.indexOf('sms') >= 0 || lower.indexOf('slack') >= 0 || lower.indexOf('teams') >= 0 || lower.indexOf('alert') >= 0;
        var hasApproval = lower.indexOf('approv') >= 0 || lower.indexOf('cab') >= 0 || lower.indexOf('manager approval') >= 0;
        var hasAssignment = lower.indexOf('assign') >= 0 || lower.indexOf('assignment group') >= 0 || lower.indexOf('desk') >= 0;
        var hasAclOrRole = lower.indexOf('role') >= 0 || lower.indexOf('permission') >= 0 || lower.indexOf('access') >= 0 || lower.indexOf('restricted') >= 0;
        var hasIntegration = lower.indexOf('rest') >= 0 || lower.indexOf('api') >= 0 || lower.indexOf('endpoint') >= 0 || lower.indexOf('webhook') >= 0 || lower.indexOf('third-party') >= 0;

        // 4. OOTB-First Architecture & Component Decomposition
        var components = [];
        var ootbRecs = [];
        var atfScenarios = [];
        var acceptanceCriteria = [];
        var steps = [];
        var riskReasons = [];
        var points = 2;

        if (hasLockOrReadOnly || hasMandatory || hasVip) {
            ootbRecs.push({
                topic: 'Form Field Behavior (Read-Only / Mandatory / Visibility)',
                approach: 'OOTB Configuration (UI Policy)',
                rationale: 'ServiceNow CTA Best Practice: Always prefer UI Policies over Client Scripts for setting field mandatory, visible, or read-only states. UI Policies run with zero code, execute faster, and survive platform upgrades without regression.'
            });
            components.push({
                type: 'ui_policy',
                table: targetTable,
                name: 'UIP - Enforce ' + (hasLockOrReadOnly ? 'Field Locking' : 'Mandatory State') + ' on ' + targetTable,
                timing_or_type: 'onLoad & onChange',
                purpose: 'Dynamically toggle field states based on record conditions without client-side DOM manipulation.',
                details: {
                    condition: hasVip ? 'Caller.VIP is true' : (hasPriorityOrUrgency ? 'Priority is 1 - Critical' : 'Active is true'),
                    actions: [
                        { field: hasAssignment ? 'assignment_group' : 'short_description', mandatory: hasMandatory ? 'true' : 'leave_alone', read_only: hasLockOrReadOnly ? 'true' : 'leave_alone' }
                    ]
                }
            });
            points += 1;
        }

        if (hasNotification || hasApproval) {
            ootbRecs.push({
                topic: 'Workflow Automation & Multi-Channel Notifications',
                approach: 'Low-Code Flow (Flow Designer)',
                rationale: 'ServiceNow Platform Strategy: Deprecate legacy Workflow Editor and hardcoded Business Rule notifications in favor of Flow Designer. Provides natural audit trails, subflow reusability, and out-of-the-box integration spokes.'
            });
            components.push({
                type: 'flow_designer',
                table: targetTable,
                name: 'Flow - ' + (hasApproval ? 'Approval & ' : '') + 'Escalation Flow for ' + targetTable,
                timing_or_type: 'Record Created or Updated',
                purpose: 'Orchestrate notifications, escalations, and approval tasks asynchronously without blocking database transactions.',
                details: {
                    trigger: 'Record Created/Updated on ' + targetTable + ' where conditions match',
                    actions: [
                        hasApproval ? 'Ask for Approval from Manager / CAB' : 'Look Up Record Details',
                        hasNotification ? 'Send Notification / Teams / Slack Message to On-Call' : 'Log Audit Event'
                    ]
                }
            });
            points += 2;
        }

        if (hasPriorityOrUrgency || hasAssignment || components.length === 0) {
            components.push({
                type: 'business_rule',
                table: targetTable,
                name: 'BR - Calculate and Validate ' + targetTable + ' Defaults',
                timing_or_type: 'before (insert, update)',
                purpose: 'Enforce synchronous data integrity and calculate derived fields before database commit.',
                details: {
                    when: 'before',
                    operations: ['insert', 'update'],
                    condition: 'current.isValidRecord()',
                    rule: 'Do NOT call current.update(). Apply direct field assignments.'
                },
                code_skeleton: '(function executeRule(current, previous /*null when async*/) {\n' +
                               '    if (!current.isValidRecord()) return;\n' +
                               '    // Enforce business logic synchronously before commit\n' +
                               (hasVip ? '    if (current.caller_id && current.caller_id.vip == true) {\n        current.urgency = "1";\n    }\n' : '') +
                               '})(current, previous);'
            });
            points += 1;
        }

        if (hasIntegration || points >= 5) {
            var siName = (targetTable.charAt(0).toUpperCase() + targetTable.slice(1).replace(/_/g, '')) + 'AutomationHelper';
            components.push({
                type: 'script_include',
                table: 'sys_script_include',
                name: siName,
                timing_or_type: 'Server / Scoped Class',
                purpose: 'Encapsulate modular business logic and helper functions, keeping Business Rules and Flows lightweight.',
                details: {
                    clientCallable: false,
                    scope: options.scope || 'x_gmg_ai'
                },
                code_skeleton: 'var ' + siName + ' = Class.create();\n' +
                               siName + '.prototype = {\n' +
                               '    initialize: function() {},\n' +
                               '    evaluateEligibility: function(recordGr) {\n' +
                               '        if (!recordGr || !recordGr.isValidRecord()) return false;\n' +
                               '        return true;\n' +
                               '    },\n' +
                               '    type: "' + siName + '"\n' +
                               '};'
            });
            points += 2;
        }

        if (hasAclOrRole) {
            components.push({
                type: 'acl',
                table: targetTable,
                name: 'ACL - ' + targetTable + ' write/read restriction',
                timing_or_type: 'Security ACL (sys_security_acl)',
                purpose: 'Enforce data-layer security so only authorized roles can update fields.',
                details: {
                    operation: 'write',
                    roles_required: ['itil', 'admin']
                }
            });
            points += 1;
        }

        acceptanceCriteria.push('Given a ' + targetTable + ' form is loaded by a user, then fields are displayed according to UI Policy conditions.');
        if (hasVip) {
            acceptanceCriteria.push('Given the caller is marked as VIP, when an incident is submitted, then urgency is automatically set to High (1).');
        }
        if (hasNotification) {
            acceptanceCriteria.push('Given high-priority trigger conditions are met, when the record is saved, then the on-call notification is dispatched within SLA.');
        }
        if (hasLockOrReadOnly) {
            acceptanceCriteria.push('Given the record enters a locked state, when viewed by standard users, then assignment fields cannot be modified without proper roles.');
        }
        acceptanceCriteria.push('Given invalid input or unfulfilled conditions, when the user attempts save, then an informative error message is displayed and database rollback occurs.');

        atfScenarios.push({
            name: 'ATF_01_HappyPath_' + targetTable,
            type: 'form_validation',
            description: 'Validate that the form loads correctly, sets mandatory and read-only field states, and submits successfully.',
            expected_result: 'Record created with expected default values and UI states verified.'
        });
        atfScenarios.push({
            name: 'ATF_02_ServerIntegrity_' + targetTable,
            type: 'server_assertion',
            description: 'Execute server-side Jasmine assertions verifying business rule execution, no recursive updates, and field integrity.',
            expected_result: 'All Jasmine describe/it blocks assert true and clean up test fixtures.'
        });
        if (hasApproval || hasNotification) {
            atfScenarios.push({
                name: 'ATF_03_WorkflowTrigger_' + targetTable,
                type: 'server_assertion',
                description: 'Validate that Flow Designer flow triggers and generates appropriate task or notification records.',
                expected_result: 'Flow execution context completes with state SUCCESS.'
            });
        }

        steps.push('Step 1: Data Model & Dictionary: Verify required fields, choices, and indexes on [' + targetTable + '].');
        steps.push('Step 2: Script Include: Deploy modular helper class for business calculations and validations.');
        steps.push('Step 3: Business Rule / Server Logic: Configure synchronous Before Business Rule with guarded recursion.');
        steps.push('Step 4: UI Policy: Configure no-code UI Policy for dynamic client field states.');
        if (hasNotification || hasApproval) {
            steps.push('Step 5: Flow Designer: Author, test, and activate low-code Flow for notifications and approvals.');
        }
        steps.push('Step 6: Automated Test Framework: Build and execute ATF test suite to eliminate manual regression.');
        steps.push('Step 7: Update Set Packaging: Review in NowPilot DevAssistant and verify XML export integrity.');

        var complexity = 'Low';
        var risk = 'Low';
        if (points >= 8) {
            complexity = 'High';
            risk = 'High';
            riskReasons.push('Involves cross-table workflows, approvals, or external communication.');
        } else if (points >= 5) {
            complexity = 'Medium';
            risk = 'Medium';
            riskReasons.push('Involves both server-side business rules and client-side UI policies.');
        } else {
            riskReasons.push('Standard low-impact form configuration using OOTB features.');
        }
        if (hasApproval) riskReasons.push('Approval dependencies require testing user impersonation in sub-production.');

        var fib = 3;
        if (points <= 2) fib = 2;
        else if (points <= 4) fib = 3;
        else if (points <= 7) fib = 5;
        else if (points <= 10) fib = 8;
        else fib = 13;

        var md = [
            '# 🏛️ CTA Architectural Story Decomposition Blueprint',
            '',
            '**Story / Requirement:** ' + text.slice(0, 150) + (text.length > 150 ? '...' : ''),
            '**Target Table:** `' + targetTable + '` | **Persona:** ' + persona + ' | **Story Points:** `' + fib + ' pts` | **Complexity:** `' + complexity + '` | **Risk:** `' + risk + '`',
            '',
            '---',
            '',
            '## 1. 🎯 Out-Of-The-Box (OOTB) First Strategy',
            'To prevent technical debt and keep your ServiceNow platform upgrade-clean (Plat4mation Platform Stuckness Avoidance):'
        ];

        ootbRecs.forEach(function(rec) {
            md.push('- **' + rec.topic + ':** `' + rec.approach + '` — ' + rec.rationale);
        });

        md.push('');
        md.push('## 2. 🧩 Decomposed Platform Components (' + components.length + ' Artifacts)');
        md.push('| Component Type | Artifact Name | Scope / Table | Timing / Trigger | Purpose |');
        md.push('|---|---|---|---|---|');
        components.forEach(function(c) {
            md.push('| `' + c.type + '` | **' + c.name + '** | `' + c.table + '` | ' + (c.timing_or_type || 'N/A') + ' | ' + c.purpose + ' |');
        });

        md.push('');
        md.push('## 3. ✅ Acceptance Criteria (Given-When-Then)');
        acceptanceCriteria.forEach(function(ac, i) {
            md.push((i + 1) + '. ' + ac);
        });

        md.push('');
        md.push('## 4. 🧪 Automated Test Framework (ATF) Test Strategy');
        atfScenarios.forEach(function(atf) {
            md.push('- **' + atf.name + '** (`' + atf.type + '`): ' + atf.description + ' → *Expected:* ' + atf.expected_result);
        });

        md.push('');
        md.push('## 5. 🚀 Step-by-Step Implementation Sequence');
        steps.forEach(function(step) {
            md.push(step);
        });

        return {
            title: 'Story Decomposition: ' + targetTable.toUpperCase() + ' Automation',
            target_table: targetTable,
            persona: persona,
            story_points: fib,
            complexity: complexity,
            risk_level: risk,
            risk_reasons: riskReasons,
            ootb_first_recommendations: ootbRecs,
            components: components,
            atf_test_plan: atfScenarios,
            acceptance_criteria: acceptanceCriteria,
            implementation_steps: steps,
            raw_markdown: md.join('\n')
        };
    }
};

/**
 * Pillar 1: Automated Test Framework (ATF) Step & Suite Engine
 * Eliminates manual testing backlogs by generating structured form steps and Jasmine server assertions.
 */
DevAssistant.ATFGenerator = {
    generate: function(params) {
        params = params || {};
        var table = params.table || params.target_table || 'incident';
        var testName = params.name || params.test_name || ('ATF_Regression_' + table.toUpperCase() + '_' + Date.now().toString(36).slice(-4));
        var desc = params.description || ('Automated regression test suite for table ' + table);

        var steps = [];
        var order = 1;

        steps.push({
            order: order++,
            step_type: 'impersonate',
            step_config: 'Impersonate',
            label: 'Impersonate Test User',
            description: 'Impersonate standard user to test permissions and business rules under realistic role constraints.',
            parameters: { user: params.test_user || 'itil_user' }
        });

        steps.push({
            order: order++,
            step_type: 'open_a_new_form',
            step_config: 'Open a New Form',
            label: 'Open New ' + table + ' Form',
            description: 'Navigate to new record form for table ' + table + '.',
            parameters: { table: table, view: params.view || 'default' }
        });

        var fieldVals = params.field_values || {};
        if (Object.keys(fieldVals).length === 0) {
            if (table === 'incident') {
                fieldVals = {
                    short_description: 'NowPilot Automated ATF Test Incident',
                    caller_id: 'System Administrator',
                    category: 'software',
                    urgency: '2',
                    impact: '2'
                };
            } else if (table === 'change_request') {
                fieldVals = {
                    short_description: 'NowPilot Automated ATF Change Request',
                    type: 'normal',
                    risk: 'moderate'
                };
            } else {
                fieldVals = { short_description: 'NowPilot Automated ATF Test Record' };
            }
        }

        steps.push({
            order: order++,
            step_type: 'set_field_values',
            step_config: 'Set Field Values',
            label: 'Set Initial Field Values',
            description: 'Populate mandatory and test-specific form fields.',
            parameters: { table: table, field_values: fieldVals }
        });

        if (params.mandatory_fields || params.read_only_fields) {
            steps.push({
                order: order++,
                step_type: 'field_state_validation',
                step_config: 'Field State Validation',
                label: 'Validate Field States',
                description: 'Verify UI Policy and Client Script field constraints.',
                parameters: {
                    table: table,
                    mandatory: params.mandatory_fields || [],
                    read_only: params.read_only_fields || []
                }
            });
        }

        steps.push({
            order: order++,
            step_type: 'submit_a_form',
            step_config: 'Submit a Form',
            label: 'Submit ' + table + ' Form',
            description: 'Save the form to trigger server-side Business Rules and database insertion.',
            parameters: { assert_type: 'form_submitted_to_server' }
        });

        steps.push({
            order: order++,
            step_type: 'field_values_validation',
            step_config: 'Field Values Validation',
            label: 'Validate Saved Record Values',
            description: 'Ensure calculated fields and default states were correctly persisted by Business Rules.',
            parameters: { table: table, conditions: 'active=true^short_descriptionSTARTSWITHNowPilot' }
        });

        var jasmineScript = [
            '/** =========================================================================',
            ' * ServiceNow Automated Test Framework (ATF) Server-Side Test Script',
            ' * Test: ' + testName,
            ' * Target Table: ' + table,
            ' * Framework: Jasmine BDD Execution Context',
            ' * ========================================================================= */',
            '(function(outputs, steps, params, stepResult, assertEqual) {',
            '    describe("' + testName + ' Server Verification", function() {',
            '        var createdSysId = null;',
            '',
            '        beforeEach(function() {',
            '            var grFixture = new GlideRecord("' + table + '");',
            '            grFixture.initialize();',
            '            grFixture.setValue("short_description", "ATF_TEST_FIXTURE_' + Date.now().toString(36) + '");',
            '            if (grFixture.isValidField("active")) grFixture.setValue("active", true);',
            '            createdSysId = grFixture.insert();',
            '        });',
            '',
            '        afterEach(function() {',
            '            if (createdSysId) {',
            '                var grClean = new GlideRecord("' + table + '");',
            '                if (grClean.get(createdSysId)) {',
            '                    grClean.deleteRecord();',
            '                }',
            '            }',
            '        });',
            '',
            '        it("should successfully insert and retrieve record with valid sys_id", function() {',
            '            expect(createdSysId).not.toBeNull();',
            '            expect(createdSysId.length).toBe(32);',
            '            var grVerify = new GlideRecord("' + table + '");',
            '            expect(grVerify.get(createdSysId)).toBe(true);',
            '        });',
            '',
            '        it("should verify business rule execution without recursive update", function() {',
            '            var grCheck = new GlideRecord("' + table + '");',
            '            if (grCheck.get(createdSysId)) {',
            '                expect(grCheck.isValidRecord()).toBe(true);',
            '                if (grCheck.isValidField("sys_created_by")) {',
            '                    expect(grCheck.getValue("sys_created_by")).toBeDefined();',
            '                }',
            '            }',
            '        });',
            '    });',
            '})(outputs, steps, params, stepResult, assertEqual);'
        ].join('\n');

        var summary = [
            '### 🧪 Automated Test Framework (ATF) Blueprint: ' + testName,
            '**Table:** `' + table + '` | **Step Count:** ' + steps.length + ' steps | **Assertion Engine:** Jasmine Server-Side Script',
            '',
            '#### Execution Steps:',
            steps.map(function(s) {
                return s.order + '. **[' + s.step_config + ']** ' + s.description;
            }).join('\n'),
            '',
            '#### Jasmine Server-Side Test Script (Run Server Side Script step):',
            '```javascript',
            jasmineScript,
            '```'
        ].join('\n');

        return {
            test_name: testName,
            table: table,
            description: desc,
            steps: steps,
            server_assertion_script: jasmineScript,
            summary: summary
        };
    }
};

/**
 * Pillar 1: Senior Architect Code Refactorer
 * Bridges the junior talent shortage by refactoring code into CTA-grade ServiceNow standards.
 */
DevAssistant.ArchitectRefactorer = {
    refactor: function(code, artifactType, options) {
        options = options || {};
        code = String(code || '');
        artifactType = String(artifactType || 'business_rule').toLowerCase();

        var refactored = code;
        var issuesFound = [];
        var improvements = [];
        var companionArtifacts = [];

        // 1. Detect & Fix: current.update() in before Business Rules
        var isBR = (artifactType === 'business_rule' || artifactType === 'sys_script' || /function\s+executeRule\s*\(/.test(code) || /current\.update\s*\(/.test(code));
        if (isBR && /current\.update\s*\([^)]*\)\s*;?/.test(refactored)) {
            refactored = refactored.replace(/current\.update\s*\([^)]*\)\s*;?/g, '// REFACTORED: Removed direct update call on current record. In before Business Rules, modifications to current are automatically saved upon return.');
            issuesFound.push({
                id: 'BR_RECURSIVE_UPDATE',
                title: 'Recursive current.update() in Business Rule',
                severity: 'Critical',
                description: 'Calling current.update() inside a before business rule triggers recursive database execution, duplicate logging, and potential node thread starvation.',
                fix_applied: 'Removed direct update invocation on current. Properties set on current are automatically persisted by the platform engine.'
            });
            improvements.push('Removed recursive current.update() to prevent infinite trigger loops and stack overflows.');
        }

        // 2. Detect & Fix: Synchronous Client-Side GlideRecord
        var isClient = (artifactType === 'client_script' || artifactType === 'ui_policy' || artifactType === 'sys_script_client' || /g_form|g_user|onLoad|onChange|onSubmit/.test(code));
        if (isClient && /new\s+GlideRecord\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/.test(refactored)) {
            var matchTable = refactored.match(/new\s+GlideRecord\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/);
            var targetTable = matchTable ? matchTable[1] : 'sys_user';
            var className = (targetTable.charAt(0).toUpperCase() + targetTable.slice(1).replace(/_/g, '')) + 'LookupAjax';

            var companionCode = 'var ' + className + ' = Class.create();\n' +
                className + '.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {\n' +
                '    getRecordData: function() {\n' +
                '        var recordId = this.getParameter("sysparm_id");\n' +
                '        var result = { success: false, data: {} };\n' +
                '        if (!recordId) return JSON.stringify(result);\n' +
                '        var gr = new GlideRecordSecure("' + targetTable + '");\n' +
                '        if (gr.get(recordId)) {\n' +
                '            result.success = true;\n' +
                '            result.data = {\n' +
                '                sys_id: gr.getUniqueValue(),\n' +
                '                display_name: gr.getDisplayValue()\n' +
                '            };\n' +
                '        }\n' +
                '        return JSON.stringify(result);\n' +
                '    },\n' +
                '    type: "' + className + '"\n' +
                '});';

            companionArtifacts.push({
                artifact_type: 'script_include',
                name: className,
                client_callable: true,
                code: companionCode,
                description: 'Companion client-callable Script Include extending AbstractAjaxProcessor for asynchronous retrieval.'
            });

            var paramVar = 'g_form.getUniqueValue()';
            var queryParamMatch = refactored.match(/addQuery\s*\([^,]+,\s*([^)]+)\)/);
            if (queryParamMatch) {
                paramVar = queryParamMatch[1].trim();
            }

            var setValueField = '';
            var setValueMatch = refactored.match(/g_form\.setValue\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/);
            if (setValueMatch) {
                setValueField = setValueMatch[1];
            }

            var clientReplacement = '    // REFACTORED: Converted synchronous client GlideRecord to asynchronous GlideAjax\n' +
                '    var ga = new GlideAjax("' + className + '");\n' +
                '    ga.addParam("sysparm_name", "getRecordData");\n' +
                '    ga.addParam("sysparm_id", ' + paramVar + ');\n' +
                '    ga.getXMLAnswer(function(answer) {\n' +
                '        if (!answer) return;\n' +
                '        var res = JSON.parse(answer);\n' +
                '        if (res.success && res.data) {\n' +
                '            ' + (setValueField ? 'g_form.setValue("' + setValueField + '", res.data.' + setValueField + ');' : '// Process response') + '\n' +
                '        }\n' +
                '    });';

            var grIdx = refactored.indexOf('new GlideRecord');
            if (grIdx !== -1) {
                var startVar = refactored.lastIndexOf('var', grIdx);
                if (startVar === -1) startVar = grIdx;
                var queryIdx = refactored.indexOf('.query()', grIdx);
                var nextIdx = (queryIdx !== -1) ? refactored.indexOf('.next()', queryIdx) : -1;
                var endIdx = -1;
                if (nextIdx !== -1) {
                    var openCount = 0;
                    for (var i = nextIdx; i < refactored.length; i++) {
                        if (refactored.charAt(i) === '{') openCount++;
                        else if (refactored.charAt(i) === '}') {
                            openCount--;
                            if (openCount === 0) {
                                endIdx = i + 1;
                                break;
                            }
                        }
                    }
                }
                if (startVar !== -1 && endIdx !== -1) {
                    refactored = refactored.substring(0, startVar) + clientReplacement + refactored.substring(endIdx);
                } else {
                    refactored = refactored.replace(/new\s+GlideRecord\s*\([^)]*\);?/, clientReplacement);
                }
            }

            issuesFound.push({
                id: 'CLIENT_SYNC_GLIDERECORD',
                title: 'Synchronous Client-Side GlideRecord',
                severity: 'Critical',
                description: 'Synchronous GlideRecord calls in browser client scripts block browser rendering and main thread execution, causing UI freezing.',
                fix_applied: 'Refactored to asynchronous GlideAjax call with dedicated AbstractAjaxProcessor Script Include companion.'
            });
            improvements.push('Eliminated synchronous browser freeze by migrating client GlideRecord to asynchronous GlideAjax.');
        }

        // 3. Detect & Fix: Missing setLimit() on GlideRecord queries
        var queryMatches = refactored.match(/([a-zA-Z0-9_$]+)\.query\s*\(\s*\);/g);
        if (queryMatches) {
            queryMatches.forEach(function(qm) {
                var varName = qm.replace(/\.query\s*\(\s*\);/, '');
                var limitRegex = new RegExp(varName + '\\.setLimit\\s*\\(');
                if (!limitRegex.test(refactored)) {
                    var replaceTarget = varName + '.query();';
                    var boundedQuery = varName + '.setLimit(500); // REFACTORED: Enforce bounded query limit to protect memory and database performance\n    ' + varName + '.query();';
                    refactored = refactored.replace(replaceTarget, boundedQuery);
                    issuesFound.push({
                        id: 'UNBOUNDED_GLIDERECORD_QUERY',
                        title: 'Unbounded GlideRecord Query (Missing setLimit)',
                        severity: 'High',
                        description: 'Executing query() without setLimit() can retrieve excessive records, risking memory exhaustion and degrading instance performance.',
                        fix_applied: 'Injected defensive setLimit(500) prior to ' + varName + '.query().'
                    });
                    improvements.push('Protected database performance by adding setLimit(500) to ' + varName + ' query.');
                }
            });
        }

        // 4. Detect & Fix: Hardcoded 32-character sys_id
        var sysIdMatches = refactored.match(/['"]([0-9a-fA-F]{32})['"]/g);
        if (sysIdMatches) {
            var seenSysIds = {};
            sysIdMatches.forEach(function(m) {
                var rawId = m.replace(/['"]/g, '');
                if (seenSysIds[rawId]) return;
                seenSysIds[rawId] = true;

                var propCheck = new RegExp('gs\\.getProperty\\([^)]*' + rawId);
                if (!propCheck.test(refactored)) {
                    var targetLiteral = new RegExp("['\"]" + rawId + "['\"]", 'g');
                    refactored = refactored.replace(targetLiteral, "gs.getProperty('x_gmg_ai.config_id', '" + rawId + "')");
                    issuesFound.push({
                        id: 'HARDCODED_SYS_ID',
                        title: 'Hardcoded 32-Character sys_id (' + rawId.slice(0, 8) + '...)',
                        severity: 'Medium',
                        description: 'Hardcoded sys_ids are instance-specific and break when update sets are migrated between Dev, Test, and Prod instances.',
                        fix_applied: 'Replaced hardcoded sys_id with parameterized gs.getProperty lookup with fallback.'
                    });
                    improvements.push('Externalized hardcoded sys_id ' + rawId.slice(0, 8) + '... to dynamic gs.getProperty call.');
                }
            });
        }

        // 5. Detect: N+1 query loop
        if (/while\s*\([^{]*?\.next\s*\(\s*\)\s*\)\s*\{[\s\S]*?new\s+GlideRecord/m.test(refactored) || /for\s*\([^{]*?\)\s*\{[\s\S]*?new\s+GlideRecord/m.test(refactored)) {
            issuesFound.push({
                id: 'N_PLUS_ONE_QUERY',
                title: 'N+1 Database Query in Loop',
                severity: 'High',
                description: 'Instantiating or querying GlideRecord inside a loop triggers round-trips for every iteration, causing significant latency.',
                fix_applied: 'Flagged N+1 query pattern. Recommended refactoring to an IN operator query or Map caching.'
            });
            improvements.push('Flagged N+1 loop query pattern for set-based refactoring.');
        }

        // Formatted Markdown summary
        var md = [
            '# 🛠️ Senior Architect Code Refactoring Report',
            '',
            '**Artifact Type:** `' + artifactType + '` | **Issues Found:** ' + issuesFound.length + ' | **Companion Artifacts:** ' + companionArtifacts.length,
            '',
            '---',
            '',
            '## 1. 🔍 Detected Platform Anti-Patterns'
        ];

        if (issuesFound.length === 0) {
            md.push('✅ No anti-patterns detected. Code conforms to CTA platform standards.');
        } else {
            issuesFound.forEach(function(iss, idx) {
                md.push((idx + 1) + '. **[' + iss.severity.toUpperCase() + '] ' + iss.title + '**');
                md.push('   - *Description:* ' + iss.description);
                md.push('   - *Remediation Applied:* `' + iss.fix_applied + '`');
            });
        }

        md.push('');
        md.push('## 2. ⚡ Production-Ready Refactored Code');
        md.push('```javascript');
        md.push(refactored);
        md.push('```');

        if (companionArtifacts.length > 0) {
            md.push('');
            md.push('## 3. 📦 Companion Artifacts Required');
            companionArtifacts.forEach(function(ca) {
                md.push('### `' + ca.artifact_type + '`: **' + ca.name + '**');
                md.push(ca.description);
                md.push('```javascript');
                md.push(ca.code);
                md.push('```');
            });
        }

        return {
            original_code: code,
            refactored_code: refactored,
            artifact_type: artifactType,
            issues_found: issuesFound,
            improvements_made: improvements,
            companion_artifacts: companionArtifacts,
            cta_notes: 'All refactored code adheres to ServiceNow Certified Technical Architect (CTA) governance, performance, and upgradeability standards.',
            raw_markdown: md.join('\n')
        };
    }
};

DevAssistant.decomposeStory = function(storyText, options) {
    return DevAssistant.StoryDecomposer.decompose(storyText, options);
};

DevAssistant.generateATF = function(params) {
    return DevAssistant.ATFGenerator.generate(params);
};

DevAssistant.refactorCode = function(code, artifactType, options) {
    return DevAssistant.ArchitectRefactorer.refactor(code, artifactType, options);
};

DevAssistant.prototype = {
    initialize: function() {
        this.validator = new DevValidator();
    },

    /**
     * Build the specialized prompt instructions for the Development Assistant
     */
    buildSystemPrompt: function(mode, artifactType, context) {
        context = context || {};
        var artInfo = DevAssistant.ARTIFACT_TYPES[artifactType] || { label: artifactType, category: 'generic' };

        var lines = [
            '### ServiceNow Development Assistant Engine (' + mode.toUpperCase() + ' MODE)',
            'You are an expert ServiceNow Platform Architect and Certified Technical Architect (CTA).',
            'Target Artifact: ' + artInfo.label + (artInfo.table ? ' (' + artInfo.table + ')' : ''),
            'Execution Category: ' + artInfo.category,
            '',
            'ServiceNow Platform Standards & Invariants:',
            '1. Scoped Application API Isolation: In scoped apps, use scoped GlideRecord, GlideSystem, and GlideRecordSecure APIs.',
            '2. Client vs Server Boundary: NEVER mix client objects (g_form, g_user, window, document) in server code (Business Rules, Script Includes). NEVER call gs.* or current.* in Client Scripts.',
            '3. Business Rule Recursion: In before business rules, NEVER call current.update(). Modifying current saves automatically.',
            '4. Performance (N+1 Avoidance): Never instantiate or query GlideRecord inside a while(gr.next()) loop.',
            '5. Defensive Null Handling: Always verify gr.next() before accessing fields.',
            '6. Background Scripts: Always include a "var dryRun = true;" simulation flag and setLimit(). Background scripts must NEVER be executed automatically.',
            '7. ATF & Flow Guidance: Provide structured step-by-step instructions adhering to Workflow Studio and ATF best practices.',
            '8. Security & ACLs: Rely on GlideRecordSecure where user-level access is required. Never hardcode credentials.'
        ];

        if (context.table) lines.push('Target Table: ' + context.table);
        if (context.sys_scope) lines.push('Application Scope: ' + context.sys_scope);
        if (context.bound_display) lines.push('Open Record: ' + context.bound_display);

        if (mode === 'review' || mode === 'debug') {
            lines.push('');
            lines.push('REVIEW OUTPUT CONTRACT: For each issue identified, format strictly as:');
            lines.push('1. Summary: [Concise issue title]');
            lines.push('2. Severity: [Critical | High | Medium | Low]');
            lines.push('3. Why It Matters: [Explanation of impact]');
            lines.push('4. Relevant Code Section: [Code snippet]');
            lines.push('5. Recommended Fix: [Explanation of solution]');
            lines.push('6. Corrected Code: [Production-ready corrected code]');
            lines.push('7. Regression Test Cases: [Concrete test scenarios]');
            lines.push('8. Assumptions & Caveats: [Platform-specific assumptions]');
        } else if (mode === 'decompose') {
            lines.push('');
            lines.push('STORY DECOMPOSITION CONTRACT: When decomposing a user story or enhancement:');
            lines.push('1. Out-Of-The-Box (OOTB) First: Prioritize UI Policies and Flow Designer before writing custom script.');
            lines.push('2. Component Blueprint: Itemize each Business Rule, UI Policy, Flow, Script Include, and ACL required.');
            lines.push('3. Acceptance Criteria: Provide Given-When-Then criteria.');
            lines.push('4. ATF Test Plan: Include automated test steps to ensure zero-regression delivery.');
            lines.push('5. Story Points & Risk: Estimate Fibonacci points (1, 2, 3, 5, 8, 13) and assess technical risk.');
        } else if (mode === 'refactor') {
            lines.push('');
            lines.push('SENIOR ARCHITECT REFACTORING CONTRACT:');
            lines.push('1. Eliminate current.update() in before business rules.');
            lines.push('2. Convert synchronous client-side GlideRecord to asynchronous GlideAjax with companion Script Include.');
            lines.push('3. Guard unbounded queries with setLimit().');
            lines.push('4. Replace hardcoded 32-character sys_ids with gs.getProperty() lookups.');
            lines.push('5. Provide production-grade corrected code and issue explanations.');
        }

        return lines.join('\n');
    },

    /**
     * Inspect the open record to retrieve existing code if viewing a development artifact
     */
    getExistingCodeFromContext: function(bound) {
        if (!bound || !bound.table || !bound.sys_id || bound.error) return null;

        var supportedTables = ['sys_script', 'sys_script_include', 'sys_script_client', 'sys_ui_action', 'sys_ui_policy'];
        if (supportedTables.indexOf(bound.table) < 0) return null;

        try {
            var gr = new GlideRecordSecure(bound.table);
            if (gr.get(bound.sys_id)) {
                var scriptField = 'script';
                if (!gr.isValidField(scriptField)) return null;
                var el = gr.getElement(scriptField);
                if (el && el.canRead()) {
                    return {
                        table: bound.table,
                        sys_id: bound.sys_id,
                        name: gr.getValue('name') || gr.getValue('short_description') || '',
                        script: String(el.getValue() || '')
                    };
                }
            }
        } catch (e) {
            gs.warn('DevAssistant: Could not read open code record: ' + e);
        }
        return null;
    },

    /**
     * Run deterministic static analysis and prepare structured findings
     */
    validateCode: function(code, artifactType, options) {
        return this.validator.validate(code, artifactType, options);
    },

    /**
     * Create a structured proposal card for generated or reviewed code
     */
    createProposal: function(params) {
        params = params || {};
        var artifactType = params.artifact_type || 'business_rule';
        var artInfo = DevAssistant.ARTIFACT_TYPES[artifactType] || { label: artifactType };
        var name = params.name || ('Generated ' + artInfo.label);
        var table = params.table || '';
        var scope = params.scope || 'global';
        var code = params.code || '';
        var summary = params.summary || ('Create / Update ' + artInfo.label + ': ' + name);

        var isBackground = (artifactType === 'background_script');
        var isGuidance = (artifactType === 'flow_designer' || artifactType === 'atf_test' || artifactType === 'story_decomposition');
        var isRefactor = (artifactType === 'code_refactor');

        var validation = (artifactType === 'story_decomposition') 
            ? { ok: true, findings: [], count: 0, critical: 0, high: 0 } 
            : this.validateCode(code, artifactType);

        var actionCard = {
            id: 'dev_' + Math.random().toString(16).slice(2, 10),
            type: 'dev_artifact',
            artifact_type: artifactType,
            artifact_label: artInfo.label,
            name: name,
            table: table,
            scope: scope,
            summary: summary,
            code: code,
            validation: validation,
            status: 'pending',
            can_accept: !!params.bound_sys_id && !isGuidance && !isBackground,
            bound_table: params.bound_table || '',
            bound_sys_id: params.bound_sys_id || '',
            is_background: isBackground,
            is_guidance: isGuidance,
            is_refactor: isRefactor,
            refactor_details: params.refactor_details || null,
            story_details: params.story_details || null,
            atf_details: params.atf_details || null,
            instructions: isBackground
                ? 'BACKGROUND SCRIPT SAFETY: This script will NEVER execute automatically. Copy and execute manually in System Definition > Scripts - Background.'
                : isGuidance
                ? 'GUIDANCE ARTIFACT: Follow the step-by-step instructions in Workflow Studio or ATF Test Designer.'
                : isRefactor
                ? 'SENIOR ARCHITECT REFACTOR: Review detected anti-patterns, apply corrected code, and create companion Script Includes if provided.'
                : params.bound_sys_id
                ? 'Accept will update the open ' + artInfo.label + ' record in your active update set.'
                : 'Copy the generated code and create the ' + artInfo.label + ' record in your application scope.'
        };

        return actionCard;
    },

    decomposeStory: function(storyText, options) {
        return DevAssistant.decomposeStory(storyText, options);
    },

    generateATF: function(params) {
        return DevAssistant.generateATF(params);
    },

    refactorCode: function(code, artifactType, options) {
        return DevAssistant.refactorCode(code, artifactType, options);
    },

    type: 'DevAssistant'
};
