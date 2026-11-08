// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Local Interactive Application Runner & ServiceNow Simulator
 * Starts a local HTTP server simulating a ServiceNow instance with the embedded
 * GMG AI Agent panel, Scripted REST APIs, and mock ServiceNow database.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const vm = require('vm');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// Setup minimal ServiceNow Rhino environment in Node.js
global.Class = { create: function() { return function() { if (this.initialize) this.initialize.apply(this, arguments); }; } };

const mockState = {
    currentUserId: '6816f79cc0a8016401c5a33be04be441',
    roles: ['x_gmg_ai.user', 'admin'],
    properties: {
        'x_gmg_ai.model_allowlist': 'claude-3-5-sonnet-20241022,gpt-4o,omniroute/gpt-4o-mini',
        'x_gmg_ai.time_budget_ms': '30000',
        'instance_name': 'dev_instance_local',
        'x_gmg_ai.allow_http_localhost': 'true',
        'x_gmg_ai.context.server_store': 'false'
    },
    tables: {
        x_gmg_ai_provider: [
            {
                sys_id: 'd890040e97120210e304b998c253af30',
                name: 'OmniRoute Gateway',
                type: 'omniroute',
                model: 'omniroute/gpt-4o-mini',
                active: '1',
                is_default: '1',
                base_url: 'http://127.0.0.1:20128/v1',
                api_url: 'http://127.0.0.1:20128/v1',
                price_input: '0.15',
                price_output: '0.60',
                api_key: { getDecryptedValue: () => 'sk-omni-test' }
            }
        ],
        x_gmg_ai_pending_action: [],
        x_gmg_ai_log: [],
        incident: [
            {
                sys_id: '9d385017c611228701d22104cc95c371',
                number: 'INC0000060',
                short_description: 'Network latency spike and packet loss on Dallas core switch',
                description: 'Users in Texas facility experiencing intermittent connectivity drops and packet loss exceeding 25% on vlan 104.',
                category: 'network',
                subcategory: 'switch',
                cmdb_ci: 'sw-dal-core-01',
                priority: '1',
                state: '2', // In Progress
                active: '1',
                sys_mod_count: '1',
                sys_updated_on: '2026-10-21 10:00:00',
                close_code: '',
                close_notes: ''
            },
            {
                sys_id: 'a9385017c611228701d22104cc95c372',
                number: 'INC0000055',
                short_description: 'Dallas core switch packet loss resolved by uplink renegotiation',
                description: 'Similar latency spikes observed previously on Dallas switch cluster.',
                category: 'network',
                subcategory: 'switch',
                cmdb_ci: 'sw-dal-core-01',
                priority: '2',
                state: '6', // Resolved
                active: '0',
                sys_mod_count: '4',
                sys_updated_on: '2026-10-18 14:20:00',
                close_code: 'Solved (Permanently)',
                close_notes: 'Flushed ARP cache, forced full-duplex negotiation on port 1/0/24, and cleared port-channel flap guard.'
            }
        ],
        kb_knowledge: [
            {
                sys_id: 'b890040e97120210e304b998c253af31',
                number: 'KB0001024',
                title: 'Troubleshooting Cisco Switch Port Flapping and Packet Drops',
                text: 'When core switches report packet drops over VLAN 100-200, check duplex settings and reset port channel negotiation.',
                workflow_state: 'published',
                valid_to: '2027-12-31',
                active: '1'
            }
        ]
    }
};

global.gs = {
    getUserID: () => mockState.currentUserId,
    getUserName: () => 'admin',
    getUserDisplayName: () => 'System Administrator',
    hasRole: (r) => mockState.roles.indexOf(r) >= 0,
    getProperty: (k, dflt) => (k in mockState.properties ? mockState.properties[k] : dflt),
    setProperty: (k, v) => { mockState.properties[k] = String(v); },
    warn: (m) => console.log('  [gs.warn]', m),
    error: (m) => console.log('  [gs.error]', m),
    info: (m) => console.log('  [gs.info]', m),
    beginningOfToday: () => '2026-10-21 00:00:00',
    getSession: () => ({
        clientData: {},
        getClientData: function(k) { return this.clientData[k]; },
        putClientData: function(k, v) { this.clientData[k] = v; }
    })
};

global.GlideDateTime = function(val) {
    this.val = val || '2026-10-21 12:00:00';
    this.getValue = () => this.val;
    this.getDisplayValue = () => this.val;
    this.setDisplayValueInternal = (v) => { this.val = v; };
    this.getNumericValue = () => 1761000000000;
    this.getLocalDate = () => ({ getValue: () => '2026-10-21' });
    this.after = (other) => other ? this.val > (typeof other.getValue === 'function' ? other.getValue() : String(other)) : false;
    this.before = (other) => other ? this.val < (typeof other.getValue === 'function' ? other.getValue() : String(other)) : false;
    this.addSeconds = () => {};
};

global.GlideDigest = function() {
    this.getSHA256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
};

function MockGlideRecord(table) {
    this.table = table;
    this.rows = (mockState.tables[table] || []).slice();
    this.idx = -1;
    this.current = {};
    this.queries = [];
    this.limit = 100;

    this.initialize = function() { this.current = {}; };
    this.addActiveQuery = function() {
        this.rows = this.rows.filter(r => r.active === true || r.active === '1' || r.active === undefined);
    };
    this.addQuery = function(f, op, val) {
        if (arguments.length === 2) { val = op; op = '='; }
        this.queries.push({ field: f, op: op, val: val });
    };
    this.addEncodedQuery = function() {};
    this.orderBy = function() {};
    this.orderByDesc = function() {};
    this.setLimit = function(n) { this.limit = n; };
    this.query = function() {
        var filtered = (mockState.tables[this.table] || []).slice();
        for (var i = 0; i < this.queries.length; i++) {
            var q = this.queries[i];
            if (q.op === '=') filtered = filtered.filter(r => String(r[q.field]) === String(q.val));
            else if (q.op === '!=') filtered = filtered.filter(r => String(r[q.field]) !== String(q.val));
        }
        this.rows = filtered.slice(0, this.limit);
        this.idx = -1;
    };
    this.next = function() {
        this.idx++;
        if (this.idx < this.rows.length) {
            this.current = this.rows[this.idx];
            Object.assign(this, this.current);
            return true;
        }
        return false;
    };
    this.get = function(id) {
        var found = (mockState.tables[this.table] || []).find(r => r.sys_id === id);
        if (found) {
            this.current = found;
            Object.assign(this, this.current);
            return true;
        }
        return false;
    };
    this.setValue = function(k, v) { this.current[k] = v; this[k] = v; };
    this.getValue = function(k) { return this.current[k] !== undefined && this.current[k] !== null ? String(this.current[k]) : ''; };
    this.getDisplayValue = function(k) { return this.getValue(k); };
    this.isValidField = function(k) { return true; };
    this.getUniqueValue = function() { return this.current.sys_id || (this.current.sys_id = crypto.randomBytes(16).toString('hex')); };
    this.insert = function() {
        if (!this.current.sys_id) this.current.sys_id = crypto.randomBytes(16).toString('hex');
        if (!mockState.tables[this.table]) mockState.tables[this.table] = [];
        mockState.tables[this.table].push(Object.assign({}, this.current));
        return this.current.sys_id;
    };
    this.update = function() {
        var rows = mockState.tables[this.table] || [];
        var idx = rows.findIndex(r => r.sys_id === this.current.sys_id);
        if (idx >= 0) { rows[idx] = Object.assign({}, this.current); return true; }
        return false;
    };
}
global.GlideRecord = MockGlideRecord;
global.GlideRecordSecure = MockGlideRecord;

global.GlideAggregate = function(table) {
    this.table = table;
    this.addQuery = function() {};
    this.addEncodedQuery = function() {};
    this.addAggregate = function() {};
    this.groupBy = function() {};
    this.setGroup = function() {};
    this.query = function() {};
    this.next = function() { return false; };
    this.getAggregate = function() { return 0; };
    this.getValue = function() { return ''; };
};

// Simulated REST outbound client with intelligent mock fallback if LLM is offline
global.sn_ws = {
    RESTMessageV2: function() {
        this.endpoint = '';
        this.method = 'post';
        this.headers = {};
        this.body = '';
        this.setEndpoint = (u) => { this.endpoint = u; };
        this.setHttpMethod = (m) => { this.method = m; };
        this.setRequestHeader = (k, v) => { this.headers[k] = v; };
        this.setRequestBody = (b) => { this.body = b; };
        this.setHttpTimeout = (ms) => {};
        this.execute = () => {
            // Check if endpoint is models test
            if (this.endpoint.endsWith('/models')) {
                return {
                    getStatusCode: () => 200,
                    getBody: () => JSON.stringify({ data: [{ id: 'omniroute/gpt-4o-mini' }, { id: 'gpt-4o' }] }),
                    getHeader: () => null,
                    haveError: () => false,
                    getErrorMessage: () => ''
                };
            }

            let promptText = '';
            try {
                const b = JSON.parse(this.body || '{}');
                const lastMsg = (b.messages || []).slice().reverse().find(m => m.role === 'user');
                if (lastMsg) promptText = String(lastMsg.content || '').toLowerCase();
            } catch (e) {}

            var reply = '';
            if (promptText.indexOf('summar') >= 0 || promptText.indexOf('inc0000060') >= 0 || promptText.indexOf('similar') >= 0 || promptText.indexOf('incident') >= 0) {
                reply = '### Incident Investigation (INC0000060)\n\n' +
                        '**Symptoms:** 25% packet loss and latency spikes on Dallas core switch (`sw-dal-core-01`).\n\n' +
                        '**Historical Correlation:**\n' +
                        '- Found matching resolved incident **INC0000055** (*Dallas core switch packet loss resolved by uplink renegotiation*).\n' +
                        '- Relevant knowledge article **KB0001024** (*Troubleshooting Cisco Switch Port Flapping and Packet Drops*).\n\n' +
                        '**Recommended Resolution:**\n' +
                        '1. Force full-duplex negotiation on port `1/0/24`.\n' +
                        '2. Flush the ARP cache.\n' +
                        '3. Verify port-channel flap guard status.';
            } else if (promptText.indexOf('rule') >= 0 || promptText.indexOf('dev') >= 0 || promptText.indexOf('script') >= 0 || promptText.indexOf('code') >= 0) {
                reply = '### ServiceNow Developer Assistant Analysis\n\n' +
                        'Static analysis completed for the requested artifact.\n\n' +
                        '**Key Observations:**\n' +
                        '- Scoped API compatibility: Verified clean usage of `GlideRecordSecure`.\n' +
                        '- Performance review: All database queries utilize bounded `setLimit()`.\n' +
                        '- Security boundary: Passed all static integrity checks with 0 critical findings.';
            } else if (promptText.indexOf('workflow') >= 0 || promptText.indexOf('plan') >= 0) {
                reply = '### Multi-Step Workflow Automation Plan\n\n' +
                        '1. **Step 1 (Read):** Query switch telemetry and active alerts on CI `sw-dal-core-01`.\n' +
                        '2. **Step 2 (Read):** Scan CMDB dependencies to check affected downstream services.\n' +
                        '3. **Step 3 (Proposal):** Generate proposed resolution work notes and submit for review.';
            } else {
                reply = 'I am Now Pilot for ServiceNow (v2.0.0) — From Ticket to Takeoff. Built by Kanam Ramu.\n\n' +
                        'I am connected to your instance and ready to help you investigate incidents, review ServiceNow developer artifacts, or automate multi-step workflows.';
            }

            return {
                getStatusCode: () => 200,
                getBody: () => JSON.stringify({
                    choices: [{
                        message: {
                            content: reply,
                            role: 'assistant'
                        }
                    }],
                    usage: { prompt_tokens: 140, completion_tokens: 85, total_tokens: 225 }
                }),
                getHeader: () => null,
                haveError: () => false,
                getErrorMessage: () => ''
            };
        };
    }
};

// Load Scoped Application Scripts
function loadScript(relPath) {
    const code = fs.readFileSync(path.resolve(__dirname, relPath), 'utf8');
    vm.runInThisContext(code);
}

loadScript('src/scoped/DiagnosticService.js');
loadScript('src/scoped/GMGSeal.js');
loadScript('src/scoped/Budget.js');
loadScript('src/scoped/DevValidator.js');
loadScript('src/scoped/DevAssistant.js');
loadScript('src/scoped/ITSMRetriever.js');
loadScript('src/scoped/ITSMContextBuilder.js');
loadScript('src/scoped/ITSMAssistant.js');
loadScript('src/scoped/RecordTools.js');
loadScript('src/scoped/AgentTools.js');
loadScript('src/scoped/LLMAdapter.js');
loadScript('src/scoped/WorkflowPlanner.js');
loadScript('src/scoped/WorkflowEngine.js');
loadScript('src/scoped/ActionService.js');
loadScript('src/scoped/AgentCore.js');
loadScript('src/global/GMGAIApplierCore.js');
global.GMGAIApplier = GMGAIApplierCore;
global.global = { GMGAIApplier: GMGAIApplierCore };

// Create HTTP server simulating ServiceNow UI and REST API
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

    // CORS & JSON helpers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-UserToken, Accept');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    // 0. Serve Logo & Favicon Assets
    if (pathname === '/assets/now_pilot_logo.png' || pathname === '/now_pilot_logo.png' || pathname === '/src/assets/now_pilot_logo.png' ||
        pathname === '/assets/takeoff_logo.png' || pathname === '/takeoff_logo.png' || pathname === '/src/assets/takeoff_logo.png') {
        const logoPath = fs.existsSync(path.resolve(__dirname, 'src/assets/now_pilot_logo.png'))
            ? path.resolve(__dirname, 'src/assets/now_pilot_logo.png')
            : path.resolve(__dirname, 'src/assets/takeoff_logo.png');
        if (fs.existsSync(logoPath)) {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            return res.end(fs.readFileSync(logoPath));
        }
    }
    if (pathname === '/favicon.ico' || pathname === '/assets/favicon.ico' || pathname === '/src/assets/favicon.ico') {
        const icoPath = path.resolve(__dirname, 'src/assets/favicon.ico');
        if (fs.existsSync(icoPath)) {
            res.writeHead(200, { 'Content-Type': 'image/x-icon' });
            return res.end(fs.readFileSync(icoPath));
        }
    }
    if (pathname === '/favicon.svg' || pathname === '/assets/favicon.svg' || pathname === '/src/assets/favicon.svg') {
        const svgPath = path.resolve(__dirname, 'src/assets/favicon.svg');
        if (fs.existsSync(svgPath)) {
            res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
            return res.end(fs.readFileSync(svgPath));
        }
    }
    if (pathname === '/assets/favicon-32x32.png' || pathname === '/favicon-32x32.png') {
        const p32 = path.resolve(__dirname, 'src/assets/favicon-32x32.png');
        if (fs.existsSync(p32)) {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            return res.end(fs.readFileSync(p32));
        }
    }
    if (pathname === '/assets/favicon-16x16.png' || pathname === '/favicon-16x16.png') {
        const p16 = path.resolve(__dirname, 'src/assets/favicon-16x16.png');
        if (fs.existsSync(p16)) {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            return res.end(fs.readFileSync(p16));
        }
    }

    // 1. Serve UI Script
    if (pathname === '/src/global/gmg_ai_agent_panel.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        return res.end(fs.readFileSync(path.resolve(__dirname, 'src/global/gmg_ai_agent_panel.js'), 'utf8'));
    }

    // 2. REST API: Health Check
    if (pathname === '/api/x_gmg_ai/agent/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (parsedUrl.query.access === '1') {
            return res.end(JSON.stringify({ panel_access: true }));
        }
        return res.end(JSON.stringify({
            user: 'admin',
            provider: 'OmniRoute Gateway',
            type: 'omniroute',
            model: 'omniroute/gpt-4o-mini',
            key_present: true,
            tools: ['get_record', 'query_records', 'search_similar_incidents', 'search_knowledge_articles', 'recommend_resolution', 'validate_dev_code', 'review_dev_artifact']
        }));
    }

    // 3. REST API: Providers List
    if (pathname === '/api/x_gmg_ai/agent/providers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const core = new AgentCore();
        const pList = core.listProviders();
        return res.end(JSON.stringify(pList.providers || pList));
    }

    // 4. REST API: Chat & Workflow Execution
    if (pathname === '/api/x_gmg_ai/agent/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body || '{}');
                const core = new AgentCore();
                const result = core.run(payload);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(result));
            } catch (ex) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: String(ex), error_code: 'INTERNAL_ERROR' }));
            }
        });
        return;
    }

    // 5. REST API: Action Confirm / Reject
    const actionMatch = pathname.match(/^\/api\/x_gmg_ai\/agent\/action\/([^\/]+)\/([^\/]+)$/);
    if (actionMatch && req.method === 'POST') {
        const actionId = decodeURIComponent(actionMatch[1]);
        const verb = actionMatch[2];
        const svc = new ActionService();
        const actionRes = verb === 'confirm' ? svc.confirm(actionId) : verb === 'reject' ? svc.reject(actionId) : { error: 'Unknown verb', code: 400 };
        res.writeHead(actionRes.code || 200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(actionRes));
    }

    // 5.5 Serve Showcase Landing Page
    if (pathname === '/' || pathname === '/landing' || pathname === '/landing.html') {
        const landingPath = path.resolve(__dirname, 'landing.html');
        if (fs.existsSync(landingPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(fs.readFileSync(landingPath, 'utf8'));
        }
    }

    // 6. Serve Interactive ServiceNow Incident Page with Embedded Agent Panel
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const inc = mockState.tables.incident[0];
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ServiceNow - Incident ${inc.number} | Now Pilot Simulator</title>
    <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
    <link rel="alternate icon" type="image/x-icon" href="/assets/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">
    <style>
        :root {
            --sn-primary: #1F2937;
            --sn-bg: #F3F4F6;
            --sn-border: #D1D5DB;
            --sn-header: #111827;
            --sn-accent: #2563EB;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: var(--sn-bg);
            color: #111827;
        }
        header {
            background: var(--sn-header);
            color: #FFFFFF;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        header .title {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 16px;
            font-weight: 600;
        }
        header .badge {
            background: #10B981;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 999px;
            font-weight: 500;
        }
        .container {
            max-width: 1000px;
            margin: 24px auto;
            background: #FFFFFF;
            border-radius: 8px;
            border: 1px solid var(--sn-border);
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            overflow: hidden;
        }
        .form-header {
            padding: 16px 24px;
            border-bottom: 1px solid var(--sn-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #FAFAFA;
        }
        .form-header h2 {
            margin: 0;
            font-size: 18px;
            color: var(--sn-primary);
        }
        .form-body {
            padding: 24px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px 25px;
        }
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .form-group.full {
            grid-column: span 2;
        }
        label {
            font-size: 13px;
            font-weight: 600;
            color: #4B5563;
        }
        input, select, textarea {
            padding: 8px 10px;
            border: 1px solid var(--sn-border);
            border-radius: 4px;
            font-family: inherit;
            font-size: 14px;
        }
        textarea {
            resize: vertical;
            min-height: 70px;
        }
        .status-pill {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            background: #FEF3C7;
            color: #92400E;
        }
        .banner {
            background: #EFF6FF;
            border-bottom: 1px solid #BFDBFE;
            padding: 10px 20px;
            font-size: 13px;
            color: #1E40AF;
        }
    </style>
    <!-- Mock ServiceNow client environment -->
    <script>
        window.__nowPilotLogoUrl = '/assets/now_pilot_logo.png';
        window.__takeoffLogoUrl = '/assets/now_pilot_logo.png';
        window.g_user = {
            userID: '${mockState.currentUserId}',
            userName: 'admin',
            hasRole: function(r) { return true; },
            hasRoleExactly: function(r) { return true; }
        };
        window.g_ck = 'mock_session_token_xyz';
        window.g_form = {
            getTableName: function() { return 'incident'; },
            getUniqueValue: function() { return '${inc.sys_id}'; },
            hasField: function(f) { return true; },
            getValue: function(f) {
                var el = document.getElementById('field-' + f);
                return el ? el.value : '';
            },
            getDisplayValue: function(f) {
                var el = document.getElementById('field-' + f);
                if (!el) return '';
                if (el.tagName === 'SELECT' && el.selectedIndex >= 0) {
                    return el.options[el.selectedIndex].text;
                }
                return el.value;
            }
        };
    </script>
</head>
<body>
    <header>
        <div class="title">
            <img src="/assets/now_pilot_logo.png" alt="Now Pilot for ServiceNow" style="width:28px;height:28px;object-fit:contain;border-radius:50%;background:#080808;border:1px solid #303030;padding:2px;box-shadow:0 1px 3px rgba(0,0,0,0.5)" />
            <span>ServiceNow Platform (Local Environment)</span>
            <span class="badge" style="background:#168B50;color:#ffffff;font-weight:600">Now Pilot v2.0.0</span>
            <span style="margin-left:8px;font-size:12px;color:#A3A3A3">From Ticket to Takeoff. &middot; Built by Kanam Ramu</span>
        </div>
        <div>
            <span>User: <b>admin (System Administrator)</b></span>
        </div>
    </header>
    <div class="banner">
        <b>Interactive Mode Active:</b> The <b>Now Pilot</b> launcher button is visible at the bottom-right of this window. Click it to open the floating panel and test <b>Chat</b>, <b>ITSM Intelligence</b>, <b>Dev Assistant</b>, or <b>Workflows</b>.
    </div>
    <div class="container">
        <div class="form-header">
            <div>
                <h2>Incident: ${inc.number}</h2>
                <span class="status-pill">State: In Progress</span>
            </div>
            <div>
                <button style="padding:6px 12px;background:#2563EB;color:white;border:none;border-radius:4px;cursor:pointer">Save</button>
            </div>
        </div>
        <div class="form-body">
            <div class="form-group">
                <label>Number</label>
                <input id="field-number" type="text" value="${inc.number}" readonly>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="field-category">
                    <option value="network" selected>Network</option>
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                </select>
            </div>
            <div class="form-group">
                <label>Configuration Item</label>
                <input id="field-cmdb_ci" type="text" value="${inc.cmdb_ci}">
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="field-priority">
                    <option value="1" selected>1 - Critical</option>
                    <option value="2">2 - High</option>
                    <option value="3">3 - Moderate</option>
                </select>
            </div>
            <div class="form-group full">
                <label>Short Description</label>
                <input id="field-short_description" type="text" value="${inc.short_description}">
            </div>
            <div class="form-group full">
                <label>Description</label>
                <textarea id="field-description">${inc.description}</textarea>
            </div>
        </div>
    </div>

    <!-- Inject the real GMG AI Agent UI Script -->
    <script src="/src/global/gmg_ai_agent_panel.js"></script>
</body>
</html>`;
    return res.end(html);
});

server.listen(PORT, () => {
    console.log('\n================================================================');
    console.log('  NOW PILOT FOR SERVICENOW - LOCAL APPLICATION RUNNER');
    console.log('  Tagline: From Ticket to Takeoff. | Built by Kanam Ramu');
    console.log('  Release: v2.0.0 (Pillar 1 Backlog Uplift & CTA Architecture)');
    console.log('================================================================');
    console.log(`\n  >> Running at: http://localhost:${PORT}/incident.do`);
    console.log(`  >> Health API: http://localhost:${PORT}/api/x_gmg_ai/agent/health`);
    console.log(`  >> REST Chat:  http://localhost:${PORT}/api/x_gmg_ai/agent/chat`);
    console.log('\n  Open your web browser at http://localhost:3000 to interact with');
    console.log('  the agent floating launcher, chat panel, ITSM intelligence,');
    console.log('  code generation, and automated workflows.\n');
});
