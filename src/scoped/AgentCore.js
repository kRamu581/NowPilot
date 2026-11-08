// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
var AgentCore = Class.create();
/* Runs the tool loop as the calling user. Entry point: new AgentCore().run(payload)
 * payload: {messages:[{role:'user'|'assistant', content}], context:{url, table, sys_id, view, kind, query, fields:{}}, provider:sys_id(optional), model:string(optional)}
 */
AgentCore.MAX_ROUNDS = 4;
AgentCore.WEB_SEARCH_DEFAULT = 'false';

/* loop settings from properties */
AgentCore.settings = function(getProp) {
    var mr = parseInt(getProp('x_gmg_ai.max_rounds', String(AgentCore.MAX_ROUNDS)), 10) || AgentCore.MAX_ROUNDS;
    var rawAttempts = getProp('x_gmg_ai.retry_max_attempts');
    if (rawAttempts === null || rawAttempts === undefined || rawAttempts === '') {
        rawAttempts = getProp('x_gmg_ai.max_attempts', '2');
    }
    var maxAttempts = parseInt(rawAttempts, 10);
    if (isNaN(maxAttempts) || maxAttempts < 1) maxAttempts = 1;
    if (maxAttempts > 5) maxAttempts = 5;

    return {
        maxRounds: Math.max(1, Math.min(mr, 10)),
        maxAttempts: maxAttempts,
        webSearch: String(getProp('x_gmg_ai.web_search.enabled', AgentCore.WEB_SEARCH_DEFAULT)) == 'true'
    };
};

/* Open-core split step 2 */
AgentCore.DATA_TOOLS = [
    'query_records', 'get_record', 'find_similar_incidents', 'get_journal', 'list_fields', 'get_catalog_item',
    'search_similar_incidents', 'search_knowledge_articles', 'recommend_resolution', 'summarize_incident', 'prepare_knowledge_draft',
    'validate_dev_code', 'review_dev_artifact'
];
AgentCore.extCall = function(hook, args) { return typeof GMGExtensions == 'undefined' ? [] : GMGExtensions.call(hook, args); };
AgentCore.selectToolSet = function(message, page, prevSet, enabled) {
    var res = AgentCore.extCall('toolSets', []), i, j, sets, r;
    for (i = 0; i < res.length; i++) {
        sets = res[i] instanceof Array ? res[i] : [res[i]];
        for (j = 0; j < sets.length; j++) {
            if (!sets[j] || typeof sets[j].select != 'function') continue;
            r = sets[j].select(message, page, prevSet, enabled);
            if (r && r.set) return r;
        }
    }
    return {set: 'record', reason: 'core'};
};

AgentCore.NO_SESSION = function() { return {proposed: [], definitions: function() { return []; }, handles: function() { return false; }, execute: function() { return {error: 'Unknown tool.'}; }}; };
AgentCore.toolSession = function(ctx, set) {
    var r = AgentCore.extCall('toolSession', [ctx, set]);
    return r.length && r[0] && typeof r[0].definitions == 'function' ? r[0] : AgentCore.NO_SESSION();
};

AgentCore.mergeDefs = function(defs, recDefs) {
    var names = {}; (recDefs || []).forEach(function(d) { names[d.name] = 1; });
    return defs.filter(function(d) { return !names[d.name]; }).concat(recDefs || []);
};
AgentCore.filterDefs = function(defs, set) {
    if (set != 'record') return defs;
    return defs.filter(function(d) { return AgentCore.DATA_TOOLS.indexOf(d.name) >= 0 || d.name == 'review_update_set'; });
};

AgentCore.TOOL_RESULT_CHARS = 4000;
AgentCore.resultChars = function(prop) {
    var s = String(prop == null ? '' : prop).trim(), n = /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
    return (n >= 1000 && n <= 12000) ? n : AgentCore.TOOL_RESULT_CHARS;
};
AgentCore.clipResult = function(s, max) {
    s = String(s == null ? '' : s);
    if (s.length <= max) return s;
    var marker = '\n[TRUNCATED: showing the first part of ' + s.length + ' chars. Narrow the call (filter, limit, fields, element or a sys_id) to see the rest.]';
    return s.substring(0, Math.max(0, max - marker.length)) + marker;
};

AgentCore.pickState = function(field, stored) {
    var f = field === undefined || field === null ? '' : String(field).trim(), st = /^[0-9a-f]{32}$/.test(String(stored || '')) ? String(stored) : '';
    if (/^default$/i.test(f)) return {mode: 'default', id: '', store: ''};
    if (f) return {mode: 'explicit', id: f, store: f};
    if (st) return {mode: 'stored', id: st, store: st};
    return {mode: 'none', id: '', store: ''};
};

AgentCore.route = function(o) {
    if (!o.lightName) return {use: 'heavy', reason: 'routing_off'};
    if (o.explicit) return {use: 'heavy', reason: 'explicit_pick'};
    if (o.set != 'record') return {use: 'heavy', reason: o.sticky ? 'build_sticky' : 'build_set'};
    if (!o.light) return {use: 'heavy', reason: 'light_not_found'};
    if (!o.light.active || !o.light.usable) return {use: 'heavy', reason: 'light_unusable'};
    if (String(o.light.type || '') != String(o.heavyType || '')) return {use: 'heavy', reason: 'api_type_mismatch'};
    if (o.light.id && o.light.id == o.heavyId) return {use: 'heavy', reason: 'same_provider'};
    return {use: 'light', reason: 'data_set'};
};

/* Fail-closed model allowlist validation:
 * - If x_gmg_ai.model_allowlist is set: model MUST be in that list.
 * - If x_gmg_ai.model_allowlist is unset: ONLY the provider's default model is allowed.
 *   Arbitrary client model overrides are rejected unless explicitly allowlisted by an admin.
 */
AgentCore.getAllowedModels = function() {
    var prop = '';
    try {
        if (typeof gs != 'undefined' && gs.getProperty) {
            prop = String(gs.getProperty('x_gmg_ai.model_allowlist', '') || '').trim();
        }
    } catch (e) {}
    if (!prop) return null;
    return prop.split(',').map(function(m) { return m.trim(); }).filter(Boolean);
};

AgentCore.isModelAllowed = function(modelName, providerDefaultModel, providerTypeOrName) {
    modelName = String(modelName || '').trim();
    if (!modelName) return false;
    var allowlist = AgentCore.getAllowedModels();
    if (allowlist && allowlist.length) {
        return allowlist.indexOf(modelName) >= 0;
    }
    // Provider's configured default model is always valid
    if (providerDefaultModel && modelName === String(providerDefaultModel).trim()) return true;
    // Recognized models in the multi-provider catalog
    if (typeof LLMAdapter != 'undefined' && typeof LLMAdapter.isCatalogModel == 'function') {
        if (LLMAdapter.isCatalogModel(modelName)) return true;
    }
    // Fail-closed when no allowlist is configured and not in catalog
    return false;
};

AgentCore.READ_ONLY_LINE = 'Read-only for this user: an admin has turned off record updates for non-admin users. You can read, look up and explain records, but you cannot propose or make any change. If asked to change something, reply exactly: "Updating records is turned off for your role. I can still read and explain this record for you."';
AgentCore.WRITE_TOOL_RE = /^(propose|create|update|delete|apply|confirm|convert|run|queue)_/;
AgentCore.readOnlyDefs = function(defs) { return (defs || []).filter(function(d) { return !AgentCore.WRITE_TOOL_RE.test(String(d.name || '')) && !AgentCore.isProposeTool(d.name); }); };
AgentCore.writesOff = function() { return typeof ActionService == 'undefined' ? '' : ActionService.writesOff(); };

AgentCore.prototype = {
    initialize: function() {
        this.tools = new AgentTools();
        this.budget = new Budget();
        this.dev = (typeof DevAssistant != 'undefined') ? new DevAssistant() : null;
        this.itsm = (typeof ITSMAssistant != 'undefined') ? new ITSMAssistant() : null;
        this.workflow = (typeof WorkflowEngine != 'undefined') ? new WorkflowEngine(this) : null;
        this.planner = (typeof WorkflowPlanner != 'undefined') ? new WorkflowPlanner() : null;
    },
    recordTools: function(ctx) { return typeof RecordTools == 'undefined' ? AgentCore.NO_SESSION() : new RecordTools(ctx); },

    getProvider: function() {
        var gr = new GlideRecord('x_gmg_ai_provider');
        gr.addActiveQuery();
        gr.orderByDesc('is_default');
        gr.orderBy('name');
        gr.setLimit(1);
        gr.query();
        return gr.next() ? gr : null;
    },

    canUse: function(gr) {
        if (!gr || gr.getValue('active') != '1' || !gs.hasRole('x_gmg_ai.user')) return false;
        if (gr.isValidField('roles') && gr.getValue('roles')) {
            return String(gr.getValue('roles')).split(',').some(function(r) { r = r.trim(); return r && gs.hasRole(r); });
        }
        return true;
    },

    listProviders: function() {
        var out = [], gr = new GlideRecord('x_gmg_ai_provider');
        gr.addActiveQuery(); gr.orderByDesc('is_default'); gr.orderBy('name'); gr.query();
        var allowlist = AgentCore.getAllowedModels();

        while (gr.next()) {
            if (this.canUse(gr)) {
                var defaultModel = gr.getValue('model') || '';
                var pType = gr.getValue('type') || 'openai_compatible';
                var pName = gr.getValue('name') || '';
                var catalogModels = (typeof LLMAdapter != 'undefined' && typeof LLMAdapter.getModelsForProvider == 'function')
                    ? LLMAdapter.getModelsForProvider(pType, pName)
                    : [];

                var models = [defaultModel];
                var modelDetails = [];

                if (allowlist && allowlist.length) {
                    models = allowlist.slice();
                    if (defaultModel && models.indexOf(defaultModel) < 0) models.unshift(defaultModel);
                } else if (catalogModels.length) {
                    catalogModels.forEach(function(cm) {
                        if (models.indexOf(cm.id) < 0) models.push(cm.id);
                    });
                }

                models.forEach(function(mId) {
                    var info = (typeof LLMAdapter != 'undefined' && typeof LLMAdapter.getModelInfo == 'function') ? LLMAdapter.getModelInfo(mId) : null;
                    modelDetails.push({
                        id: mId,
                        name: (info && info.name) || mId,
                        capabilities: (info && info.capabilities) || ['text'],
                        supports_vision: !!(info && info.supportsVision),
                        supports_reasoning: !!(info && info.supportsReasoning),
                        supports_tools: !!(info && info.supportsTools)
                    });
                });

                var pid = (typeof LLMAdapter != 'undefined' && typeof LLMAdapter.normalizeProviderId == 'function')
                    ? LLMAdapter.normalizeProviderId(pType === 'openai_compatible' ? pName : pType)
                    : pType;

                out.push({
                    sys_id: gr.getUniqueValue(),
                    name: pName,
                    type: pType,
                    provider_id: pid,
                    model: defaultModel,
                    models: models,
                    model_details: modelDetails,
                    is_default: gr.getValue('is_default') == '1'
                });
            }
        }
        var sel = this.selectedProvider(), def = this.getProvider();
        return {
            providers: out,
            selected: sel ? sel.getUniqueValue() : (def ? def.getUniqueValue() : null)
        };
    },

    SESSION_KEY: 'x_gmg_ai.chat_provider',
    selectedProvider: function() {
        var id = '';
        try { id = String(gs.getSession().getClientData(this.SESSION_KEY) || ''); } catch (e) {}
        if (!/^[0-9a-f]{32}$/.test(id)) return null;
        var gr = new GlideRecord('x_gmg_ai_provider');
        return gr.get(id) && this.canUse(gr) ? gr : null;
    },

    findLight: function(name) {
        var g = new GlideRecord('x_gmg_ai_provider'); g.addQuery('name', name); g.setLimit(1); g.query();
        return g.next() ? g : null;
    },

    resolveDefault: function() {
        try { gs.getSession().putClientData(this.SESSION_KEY, ''); } catch (e) {}
        var g = this.getProvider();
        return g ? {gr: g} : {error: 'No active AI provider configured (x_gmg_ai_provider).'};
    },

    resolveProvider: function(id) {
        if (id === undefined || id === null || id === '') {
            var g = this.selectedProvider() || this.getProvider();
            return g ? {gr: g} : {error: 'No active AI provider configured (x_gmg_ai_provider).'};
        }
        id = String(id);
        var gr = new GlideRecord('x_gmg_ai_provider');
        if (!/^[0-9a-f]{32}$/.test(id) || !gr.get(id)) return {error: 'Unknown AI provider.', rejected: true};
        if (!this.canUse(gr)) return {error: 'That AI provider is inactive or not available to you.', rejected: true};
        try { gs.getSession().putClientData(this.SESSION_KEY, id); } catch (e) {}
        return {gr: gr};
    },

    /* Get configured fallback provider candidates in order */
    getFallbackProviders: function(currentProviderId) {
        var prop = '';
        try {
            if (typeof gs != 'undefined' && gs.getProperty) {
                prop = String(gs.getProperty('x_gmg_ai.fallback_providers', '') || '').trim();
            }
        } catch (e) {}
        if (!prop) return [];

        var tokens = prop.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
        var fallbacks = [];
        for (var i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            var gr = new GlideRecord('x_gmg_ai_provider');
            if (/^[0-9a-f]{32}$/.test(t)) {
                if (gr.get(t) && gr.getValue('active') == '1' && this.canUse(gr)) {
                    if (gr.getUniqueValue() !== currentProviderId) fallbacks.push(gr);
                }
            } else {
                gr.addActiveQuery();
                gr.addQuery('name', t);
                gr.setLimit(1);
                gr.query();
                if (gr.next() && this.canUse(gr)) {
                    if (gr.getUniqueValue() !== currentProviderId) fallbacks.push(gr);
                }
            }
        }
        return fallbacks;
    },

    staticPrompt: function(ctx, toolSet) {
        var F = {after_data: [], before_prefer: [], end: []}, fr = AgentCore.extCall('promptFragments', [ctx, toolSet]), i, k, j;
        for (i = 0; i < fr.length; i++) for (k in F) if (fr[i][k]) for (j = 0; j < fr[i][k].length; j++) F[k].push(fr[i][k][j]);
        var lines = [
            'You are Now Pilot, an intelligent AI assistant embedded in ServiceNow (' + gs.getProperty('instance_name') + '). The current user is named in the request context below.',
            AgentCore.WORDING,
            'You follow the user around the platform and always know the page they are on (below). Use it: "this incident", "this record", "these results" mean the current page.',
            'Data tools (query_records, get_record, find_similar_incidents) are READ-ONLY and run with the user\'s own permissions. You cannot change incidents, problems, changes, CIs or other data.'
        ].concat(F.after_data, [
            'Record tools: get_journal (READ-ONLY) reads a task record and its work notes / comments; use it to summarize and never write when the user only asks for a summary.',
            'Metadata tools: list_fields and get_catalog_item are READ-ONLY.'
        ], F.before_prefer, [
            'Prefer calling a tool over guessing. Never invent record numbers, sys_ids, or field values. Be concise; use short lists or tables.'
        ], F.end);
        return lines.join('\n');
    },

    dynamicPrompt: function(ctx) {
        ctx = ctx || {};
        var lines = ['## Request context', 'User: ' + gs.getUserDisplayName() + ' (' + gs.getUserName() + ')', 'Current time: ' + new GlideDateTime().getDisplayValue(), '', '## Current page'];
        lines.push('URL: ' + (ctx.url || 'unknown'));
        if (ctx.ui) lines.push('UI: ' + ctx.ui);
        if (ctx.kind) lines.push('Page type: ' + ctx.kind);
        if (ctx.table) lines.push('Table: ' + ctx.table);
        if (ctx.sys_id && ctx.sys_id != '-1') lines.push('Record sys_id: ' + ctx.sys_id);
        if (ctx.sys_id == '-1') lines.push('This is a NEW, unsaved record form.');
        if (ctx.query) lines.push('List filter (encoded query): ' + ctx.query);
        if (ctx.bound && typeof RecordTools != 'undefined') lines.push(RecordTools.promptLine(ctx.bound));
        if (AgentCore.writesOff()) lines.push(AgentCore.READ_ONLY_LINE);
        if (AgentCore.coreOnly()) lines.push(AgentCore.CORE_LIMITS);
        if (ctx.fields) {
            var f = [];
            for (var k in ctx.fields) f.push('- ' + k + ': ' + String(ctx.fields[k]).substring(0, 300));
            if (f.length) lines.push('Form values as currently shown (may include unsaved edits):\n' + f.slice(0, 40).join('\n'));
        }
        return lines.join('\n');
    },

    systemPrompt: function(ctx) { return this.staticPrompt(ctx) + '\n\n' + this.dynamicPrompt(ctx); },

    run: function(payload) {
        if (typeof ContextStore != 'undefined' && typeof ContextStore.installIncomplete == 'function' && ContextStore.installIncomplete()) {
            return {error: ContextStore.INSTALL_INCOMPLETE, install_incomplete: true};
        }
        var started = new Date().getTime();
        var ctx = payload.context || {};
        delete ctx.acting_user; delete ctx.team; delete ctx.build; delete ctx.bound;
        var cid = String(payload.conversation_id || ''); ctx.conversation_id = /^[A-Za-z0-9-]{8,64}$/.test(cid) ? cid : '';

        var corrId = (typeof DiagnosticService != 'undefined') ? DiagnosticService.validateOrAssign(payload.correlation_id) : ('corr_' + new Date().getTime().toString(36));
        ctx.correlation_id = corrId;

        if (typeof DiagnosticService != 'undefined') {
            DiagnosticService.logAuditEvent({
                eventType: DiagnosticService.EVENT_TYPES.REQUEST_STARTED,
                correlationId: corrId,
                userId: gs.getUserID(),
                targetTable: ctx.table,
                targetSysId: ctx.sys_id,
                outcome: 'started'
            });
        }

        var store = null, conv = null;
        if (ctx.conversation_id && String(gs.getProperty('x_gmg_ai.context.server_store', 'true')) != 'false') { store = new ContextStore(); }
        var newMsg = payload.message !== undefined ? String(payload.message || '').substring(0, 8000) : '';
        if (!newMsg && payload.messages && payload.messages.length) {
            var lm = payload.messages[payload.messages.length - 1];
            if (lm && lm.role == 'user') newMsg = String(lm.content || '').substring(0, 8000);
        }
        if (!newMsg && payload.workflow_request) {
            newMsg = String(payload.workflow_request.goal || payload.workflow_request.action || 'Workflow execution').substring(0, 8000);
        }
        var history = store ? (newMsg ? [{role: 'user', content: newMsg}] : []) : ((payload.messages && payload.messages.length) ? (payload.messages || []).filter(function(m) {
            return (m.role == 'user' || m.role == 'assistant') && m.content;
        }).slice(-20).map(function(m) { return {role: m.role, content: String(m.content).substring(0, 8000)}; }) : (newMsg ? [{role: 'user', content: newMsg}] : []));
        var lastUser = history.length ? history[history.length - 1].content : '';
        var out = {response: '', tools_used: [], provider: '', model: '', fallbacks: [], attempts: 0, correlation_id: corrId};

        if (!gs.hasRole('x_gmg_ai.user')) {
            out.error = 'You need the x_gmg_ai.user role.';
            out.error_code = (typeof DiagnosticService != 'undefined') ? DiagnosticService.ERRORS.AUTH_ERROR : 'AUTH_ERROR';
            return out;
        }
        if (!history.length || history[history.length - 1].role != 'user') {
            out.error = 'No user message.';
            out.error_code = (typeof DiagnosticService != 'undefined') ? DiagnosticService.ERRORS.TOOL_ERROR : 'TOOL_ERROR';
            return out;
        }

        if (store) conv = store.open(ctx.conversation_id, ctx);
        if (!ctx.acting_user && typeof RecordTools != 'undefined') {
            try { ctx.bound = RecordTools.bind(ctx); } catch (eb) { ctx.bound = {error: 'Could not bind the open record.'}; }
            if (conv) RecordTools.store(conv, ctx.bound);
        }

        var pick = AgentCore.pickState(payload.provider, conv ? conv.getValue('explicit_provider') : '');
        var rp = pick.mode == 'default' ? this.resolveDefault() : this.resolveProvider(pick.id || undefined), pgr = rp.gr;
        if (!pgr && pick.mode == 'stored') { pick = {mode: 'none', id: '', store: ''}; rp = this.resolveProvider(undefined); pgr = rp.gr; }
        if (conv && pgr && String(conv.getValue('explicit_provider') || '') != pick.store) { conv.setValue('explicit_provider', pick.store); conv.update(); }
        if (!pgr) {
            out.error = rp.error;
            out.error_code = (typeof DiagnosticService != 'undefined') ? DiagnosticService.ERRORS.CONFIG_ERROR : 'CONFIG_ERROR';
            if (rp.rejected) out.rejected = true;
            this.log(ctx, null, out, lastUser, 'error');
            return out;
        }

        // Fail-closed model validation
        var requestedModel = payload.model ? String(payload.model).trim() : '';
        if (requestedModel) {
            if (!AgentCore.isModelAllowed(requestedModel, pgr.getValue('model'), pgr.getValue('type') || pgr.getValue('name'))) {
                out.error = 'Model "' + requestedModel + '" is not authorized. Valid models must be explicitly configured in x_gmg_ai.model_allowlist.';
                out.error_code = (typeof DiagnosticService != 'undefined') ? DiagnosticService.ERRORS.CONFIG_ERROR : 'CONFIG_ERROR';
                out.rejected = true;
                this.log(ctx, pgr, out, lastUser, 'error');
                return out;
            }
        }

        var selOn = String(gs.getProperty('x_gmg_ai.tools.selection', 'true')) != 'false', prevSet = conv ? conv.getValue('tool_set') : '';
        if (!conv) history.slice(0, -1).forEach(function(h) { if (h.role == 'user' && AgentCore.selectToolSet(h.content, ctx, prevSet, selOn).set == 'build') prevSet = 'build'; });
        var sel = AgentCore.selectToolSet(newMsg || lastUser, {kind: ctx.kind, table: ctx.table}, prevSet, selOn);
        if (conv && sel.set == 'build' && prevSet != 'build') { conv.setValue('tool_set', 'build'); conv.update(); }
        out.tool_set = sel.set; out.tool_set_reason = sel.reason;

        var lightName = String(gs.getProperty('x_gmg_ai.routing.light_provider', '') || '').trim(), lgr = lightName ? this.findLight(lightName) : null;
        var rt = AgentCore.route({lightName: lightName, explicit: pick.mode == 'explicit' || pick.mode == 'stored', set: sel.set, sticky: sel.reason == 'sticky',
            heavyType: pgr.getValue('type'), heavyId: pgr.getUniqueValue(), light: lgr ? {id: lgr.getUniqueValue(), active: lgr.getValue('active') == '1', usable: this.canUse(lgr), type: lgr.getValue('type')} : null});
        if (rt.use == 'light') pgr = lgr;
        out.routing = rt.reason; out.routed = rt.use == 'light';

        out.provider_id = pgr.getUniqueValue();
        out.provider = pgr.getValue('name');
        out.model = requestedModel || pgr.getValue('model');

        var llm = new LLMAdapter(pgr);
        var system = this.staticPrompt(ctx, sel.set), dyn = this.dynamicPrompt(ctx);
        var cfg = AgentCore.settings(function(n, d) { return gs.getProperty(n, d); });
        var ws = cfg.webSearch && llm.supportsWebSearch();
        var wsOpts = ws ? {web_search: {max_uses: Math.max(1, Math.min(parseInt(gs.getProperty('x_gmg_ai.web_search.max_uses', '3'), 10) || 3, 10))}} : {};
        if (requestedModel) wsOpts.model = requestedModel;

        system += ws ? '\nWeb search is available (web_search tool). Use it only when the user needs outside information; cite the source.'
                     : '\nYou have NO web search with this model. If an outside resource is needed, ask the user to paste a direct https URL.';
        system += '\nCatalog items: before proposing ANY catalog item edit, call get_catalog_item to read its current variables.';

        var defs = this.tools.definitions();
        var msgs = history.slice();
        var usage = {input: 0, output: 0, cache_read: 0, cache_write: 0, web_search: 0};

        var devReq = payload.dev_request || null;
        if (devReq && this.dev) {
            var devPrompt = this.dev.buildSystemPrompt(devReq.mode || 'generate', devReq.artifact_type || 'business_rule', {
                table: devReq.table || ctx.table,
                sys_scope: devReq.scope || (ctx.bound && ctx.bound.scope),
                bound_display: ctx.bound && ctx.bound.display
            });
            system = devPrompt + '\n\n' + system;

            var existingCode = devReq.code;
            if (!existingCode && ctx.bound) {
                var ex = this.dev.getExistingCodeFromContext(ctx.bound);
                if (ex && ex.script) existingCode = ex.script;
            }

            if (existingCode && (!msgs.length || msgs[msgs.length - 1].role == 'user')) {
                var codeHdr = '### ServiceNow Code Provided for ' + String(devReq.mode || 'Review').toUpperCase() + ' (' + String(devReq.artifact_type || 'Script') + '):\n```javascript\n' + existingCode + '\n```\n';
                if (msgs.length && msgs[msgs.length - 1].role == 'user') {
                    msgs[msgs.length - 1].content = codeHdr + '\nRequirement / Request:\n' + msgs[msgs.length - 1].content;
                }
            }
        }

        var itsmReq = payload.itsm_request || null;
        var itsmEvidence = null;
        var itsmTargetInc = null;
        var itsmAction = '';
        if (itsmReq && this.itsm) {
            itsmAction = itsmReq.action || 'recommend_resolution';

            var targetIncRef = itsmReq.incident_id || itsmReq.incident_number || itsmReq.sys_id || (ctx.bound && ctx.bound.table == 'incident' ? ctx.bound.sys_id : '');
            if (itsmReq.incident_data) {
                itsmTargetInc = itsmReq.incident_data;
            } else if (targetIncRef) {
                var incGr = this.tools._find('incident', targetIncRef, targetIncRef);
                if (incGr) {
                    itsmTargetInc = {
                        sys_id: incGr.getUniqueValue(),
                        number: incGr.getValue('number') || '',
                        short_description: incGr.getValue('short_description') || '',
                        description: incGr.getValue('description') || '',
                        category: incGr.getValue('category') || '',
                        subcategory: incGr.getValue('subcategory') || '',
                        cmdb_ci: incGr.getValue('cmdb_ci') || '',
                        priority: incGr.getValue('priority') || '',
                        state: incGr.getDisplayValue('state') || incGr.getValue('state') || '',
                        close_code: incGr.getValue('close_code') || '',
                        close_notes: incGr.getValue('close_notes') || ''
                    };
                }
            }

            var searchQuery = itsmReq.query || (itsmTargetInc ? itsmTargetInc.short_description : '') || lastUser;

            if (itsmAction == 'search_similar_incidents' || itsmAction == 'similar_incidents') {
                var simResults = this.itsm.retriever.searchSimilarIncidents({
                    incident: itsmTargetInc,
                    query: searchQuery,
                    category: itsmReq.category || (itsmTargetInc ? itsmTargetInc.category : ''),
                    cmdb_ci: itsmReq.cmdb_ci || (itsmTargetInc ? itsmTargetInc.cmdb_ci : ''),
                    limit: itsmReq.limit || 5
                });
                itsmEvidence = this.itsm.contextBuilder.buildContext({ incidents: simResults, articles: [] });
                system = '### ITSM INTELLIGENCE: SIMILAR INCIDENT SEARCH\n' + itsmEvidence.contextText + '\n\nAnalyze and summarize the similar historical incidents found above for the user.\n\n' + system;
            } else if (itsmAction == 'search_knowledge_articles' || itsmAction == 'search_knowledge') {
                var kbResults = this.itsm.retriever.searchKnowledgeArticles({
                    query: searchQuery,
                    knowledge_base: itsmReq.knowledge_base,
                    limit: itsmReq.limit || 5
                });
                itsmEvidence = this.itsm.contextBuilder.buildContext({ incidents: [], articles: kbResults });
                system = '### ITSM INTELLIGENCE: KNOWLEDGE ARTICLE SEARCH\n' + itsmEvidence.contextText + '\n\nSummarize and evaluate the verified knowledge articles found above.\n\n' + system;
            } else if (itsmAction == 'recommend_resolution') {
                var rawEvidence = this.itsm.retriever.retrieveEvidence({
                    incident: itsmTargetInc,
                    query: searchQuery,
                    limit: itsmReq.limit || 5
                });
                itsmEvidence = this.itsm.contextBuilder.buildContext(rawEvidence);
                var resPrompt = this.itsm.buildResolutionPrompt(itsmTargetInc, itsmEvidence);
                system = resPrompt + '\n\n' + system;
            } else if (itsmAction == 'summarize' || itsmAction == 'summarize_incident') {
                var rawEvidence2 = this.itsm.retriever.retrieveEvidence({
                    incident: itsmTargetInc,
                    query: searchQuery,
                    limit: 3
                });
                itsmEvidence = this.itsm.contextBuilder.buildContext(rawEvidence2);
                var notesText = itsmReq.work_notes || '';
                var sumPrompt = this.itsm.buildSummaryPrompt(itsmTargetInc, notesText, itsmEvidence);
                system = sumPrompt + '\n\n' + system;
            } else if (itsmAction == 'draft_knowledge' || itsmAction == 'prepare_knowledge_draft') {
                var rawEvidence3 = this.itsm.retriever.retrieveEvidence({
                    incident: itsmTargetInc,
                    query: searchQuery,
                    limit: 3
                });
                itsmEvidence = this.itsm.contextBuilder.buildContext(rawEvidence3);
                var resNotes = itsmReq.resolution_notes || (itsmTargetInc ? itsmTargetInc.close_notes : '');
                var draftPrompt = this.itsm.buildKnowledgeDraftPrompt(itsmTargetInc, resNotes, itsmEvidence);
                system = draftPrompt + '\n\n' + system;
            }

            if (itsmEvidence) {
                out.evidence = {
                    sources: itsmEvidence.sourcesSummary,
                    sourceRegistry: itsmEvidence.sourceRegistry,
                    count: (itsmEvidence.sourcesSummary || []).length
                };
            }
        }

        var wfReq = payload.workflow_request || null;
        if (wfReq && this.workflow && this.planner) {
            var wfAction = wfReq.action || 'run';
            var wfResult = null;
            if (wfAction === 'plan') {
                wfResult = this.planner.plan(wfReq.goal || lastUser, wfReq.params, ctx, gs.getUserID());
                if (!wfResult.ok) {
                    out.error = wfResult.error;
                    out.workflow_plan = null;
                    if (wfResult.requires_clarification) out.requires_clarification = true;
                    if (wfResult.rejected) out.rejected = true;
                } else {
                    out.workflow_plan = wfResult.plan;
                    out.response = 'Generated structured execution plan for: "' + wfResult.plan.goal + '" (' + wfResult.plan.steps.length + ' steps).';
                }
                this.log(ctx, pgr, out, lastUser, out.error ? 'error' : 'ok');
                return out;
            } else if (wfAction === 'resume') {
                wfResult = this.workflow.resume(wfReq.workflow, ctx, gs.getUserID());
            } else if (wfAction === 'retry') {
                wfResult = this.workflow.retry(wfReq.workflow, wfReq.step_id, ctx, gs.getUserID());
            } else {
                // 'run'
                var planToRun = wfReq.plan || null;
                if (!planToRun) {
                    var planned = this.planner.plan(wfReq.goal || lastUser, wfReq.params, ctx, gs.getUserID());
                    if (!planned.ok) {
                        out.error = planned.error;
                        if (planned.requires_clarification) out.requires_clarification = true;
                        if (planned.rejected) out.rejected = true;
                        this.log(ctx, pgr, out, lastUser, 'error');
                        return out;
                    }
                    planToRun = planned.plan;
                }
                wfResult = this.workflow.run(planToRun, ctx, gs.getUserID());
            }

            if (wfResult) {
                out.workflow = wfResult.workflow || wfResult.plan || null;
                if (!wfResult.ok) {
                    out.error = wfResult.error;
                    if (wfResult.code) out.code = wfResult.code;
                    out.response = 'Workflow halted: ' + (wfResult.error || 'Execution stopped');
                } else if (wfResult.waiting_approval) {
                    out.waiting_approval = true;
                    out.pending_action_id = wfResult.pending_action_id;
                    if (wfResult.proposal) {
                        out.pending_actions = [wfResult.proposal];
                    }
                    out.response = 'Workflow paused: change proposal generated (' + (wfResult.proposal ? wfResult.proposal.summary : 'Proposed Change') + ') and awaiting explicit human confirmation.';
                } else {
                    out.response = 'Workflow completed successfully with all ' + (out.workflow && out.workflow.steps ? out.workflow.steps.length : 0) + ' steps executed.';
                }
                if (out.workflow && out.workflow.evidence) {
                    out.evidence = out.workflow.evidence;
                }
                this.log(ctx, pgr, out, lastUser, out.error ? 'error' : 'ok');
                return out;
            }
        }

        if (store) {
            store.append(conv, 'user', {text: newMsg});
            var self = this, sumOpts = {};
            if (String(gs.getProperty('x_gmg_ai.context.model_summary', 'false')) == 'true') sumOpts.summarize = function(rows, rowText) {
                if (self.budget.status(pgr, 0, gs.getUserID()).blocked) return null;
                var r = llm.chat('Summarize these earlier chat turns in at most 120 words. No preamble.',
                    [{role: 'user', content: rowText.substring(0, 12000)}], [], wsOpts);
                if (r.usage) { for (var k in usage) usage[k] += r.usage[k] || 0; store.addTokens(conv, (r.usage.input || 0) + (r.usage.cache_read || 0) + (r.usage.cache_write || 0) + (r.usage.output || 0)); }
                return r.ok && r.text ? r.text : null;
            };
            var built = store.build(conv, system + '\n\n' + dyn, out.model, parseInt(pgr.getValue('max_tokens'), 10) || 2048, null, sumOpts);
            if (built.summary) dyn += '\n\nConversation summary (older turns, oldest first):\n' + built.summary;
            msgs = built.messages; out.context = built.info; out.conversation = conv.getUniqueValue();
        }

        var status = 'ok';
        var maxRounds = cfg.maxRounds, resultMax = AgentCore.resultChars(gs.getProperty('x_gmg_ai.tool_result_chars', ''));
        var budget = parseInt(gs.getProperty('x_gmg_ai.time_budget_ms', '45000'), 10) || 45000;
        var maxAttempts = cfg.maxAttempts;

        var bt = AgentCore.toolSession(ctx, sel.set);
        var rtools = this.recordTools(ctx);
        var defs2 = AgentCore.mergeDefs(AgentCore.filterDefs(defs.concat(bt.definitions()), sel.set), rtools.definitions()), sent = {};
        if (AgentCore.writesOff()) defs2 = AgentCore.readOnlyDefs(defs2);
        defs2.forEach(function(d) { sent[d.name] = 1; });

        var chatCost = 0, bs = null, lastTool = null;
        var fallbackChain = this.getFallbackProviders(pgr.getUniqueValue());
        var fallbackIdx = 0;

        for (var round = 1; round <= maxRounds; round++) {
            bs = this.budget.status(pgr, chatCost, gs.getUserID());
            if (bs.blocked) {
                out.error = bs.blocked;
                out.error_code = (typeof DiagnosticService != 'undefined') ? DiagnosticService.ERRORS.BUDGET_EXHAUSTED : 'BUDGET_EXHAUSTED';
                out.blocked = true;
                status = 'blocked';
                break;
            }

            var timeElapsed = new Date().getTime() - started;
            var plan = AgentCore.roundPlan(round, maxRounds, sel.set, bt.proposed.length, timeElapsed > budget);
            var forceAnswer = plan.force;

            var callOpts = {}; for (var wk in wsOpts) callOpts[wk] = wsOpts[wk];
            callOpts.tool_choice_none = forceAnswer;
            if (plan.note) callOpts.final_note = plan.note;
            if (requestedModel) callOpts.model = requestedModel;

            var res = null, attemptCount = 0;
            while (attemptCount < maxAttempts) {
                attemptCount++;
                out.attempts++;
                timeElapsed = new Date().getTime() - started;
                
                // Enforce minimum time margin (3000ms) before initiating network call
                if (budget - timeElapsed < 3000) {
                    res = {ok: false, error: 'Execution time budget exceeded (' + budget + 'ms).', category: 'timeout', retryable: false};
                    break;
                }

                res = llm.chat({'static': system, dynamic: dyn}, msgs, defs2, callOpts);

                // Accounting integrity: record actual usage on every attempt (including failed attempts)
                if (res.usage) {
                    for (var uk in usage) usage[uk] += res.usage[uk] || 0;
                    chatCost = this.budget.cost(pgr, usage);
                }

                if (res.ok) {
                    break; // Successful call
                }

                // If error is non-retryable (401/403 auth, 400 bad request, SSRF error), abort immediately
                if (!res.retryable) {
                    gs.warn('GMG AI call failed non-retryable: ' + res.error + ' (' + res.category + ')');
                    break;
                }

                // If attempts remaining, try fallback provider or backoff
                if (attemptCount < maxAttempts) {
                    var remainingBudget = budget - (new Date().getTime() - started);
                    if (remainingBudget < 3000) {
                        break; // Not enough time for another attempt
                    }

                    if (fallbackIdx < fallbackChain.length) {
                        var nextPgr = fallbackChain[fallbackIdx++];
                        var fbEvent = {
                            from_provider: pgr.getValue('name'),
                            from_model: out.model,
                            to_provider: nextPgr.getValue('name'),
                            to_model: nextPgr.getValue('model'),
                            reason: res.error,
                            category: res.category,
                            attempt: attemptCount
                        };
                        out.fallbacks.push(fbEvent);
                        gs.warn('GMG AI fallback: ' + fbEvent.from_provider + ' -> ' + fbEvent.to_provider + ' due to ' + fbEvent.reason);
                        
                        pgr = nextPgr;
                        out.provider_id = pgr.getUniqueValue();
                        out.provider = pgr.getValue('name');
                        out.model = pgr.getValue('model');
                        delete callOpts.model; // Use fallback provider's default model
                        llm = new LLMAdapter(pgr);
                        continue;
                    }

                    // No alternate provider; bounded exponential backoff with jitter and Retry-After
                    var backoffMs = (typeof DiagnosticService !== 'undefined' && typeof DiagnosticService.calculateBackoff === 'function')
                        ? DiagnosticService.calculateBackoff(attemptCount, res.retry_after, 2000)
                        : (function() {
                            var b = Math.min(2000, 200 * Math.pow(2, attemptCount)) + Math.floor(Math.random() * 150);
                            if (res.retry_after && res.retry_after > 0 && res.retry_after <= 10) b = Math.max(b, res.retry_after * 1000);
                            return b;
                        })();
                    if ((remainingBudget - backoffMs) > 2500) {
                        var sleepUntil = new Date().getTime() + backoffMs;
                        while (new Date().getTime() < sleepUntil) {}
                    } else {
                        break;
                    }
                }
            }

            var estimated = false;
            if (res && res.usage) {
                if (store) store.addTokens(conv, (res.usage.input || 0) + (res.usage.cache_read || 0) + (res.usage.cache_write || 0) + (res.usage.output || 0));
            } else if (store && res && res.ok) {
                estimated = true;
                store.addTokens(conv, ContextStore.estimateTokens(system) + ContextStore.estimateTokens(JSON.stringify(msgs)) + ContextStore.estimateTokens(res.text) + ContextStore.estimateTokens(JSON.stringify(res.tool_calls || [])));
            }

            if (!res || !res.ok) {
                var cErr = (typeof DiagnosticService != 'undefined') ? DiagnosticService.classify(res ? res.error : 'No response from model.', res ? res.status : 500) : null;
                out.error = res ? res.error : 'No response from model.';
                out.error_code = cErr ? cErr.code : 'INVALID_RESPONSE';
                status = 'error';

                if (typeof DiagnosticService != 'undefined') {
                    DiagnosticService.logAuditEvent({
                        eventType: DiagnosticService.EVENT_TYPES.PROVIDER_FAILED,
                        correlationId: corrId,
                        tool: 'llm_chat',
                        outcome: 'failure',
                        errorCode: out.error_code,
                        details: out.error
                    });
                }
                break;
            }

            if (forceAnswer && res.tool_calls && res.tool_calls.length) {
                res.text = (res.text || AgentCore.emptyFallback(round, lastTool)) + '\n(Final round: the model requested ' + res.tool_calls.map(function(c) { return c.name; }).join(', ') + '; not run.)';
                res.tool_calls = [];
            }

            if (!res.tool_calls || !res.tool_calls.length) {
                out.response = res.text || AgentCore.emptyFallback(round, lastTool);
                if (!res.text) out.empty_reply = {stop_reason: res.stop_reason || '', block_types: res.block_types || []};
                if (store) store.append(conv, 'agent', {text: out.response, estimated: estimated});
                break;
            }

            msgs.push({role: 'assistant', content: res.text || '', tool_calls: res.tool_calls, raw: res.raw});
            if (store) store.append(conv, 'agent', {text: res.text || '', estimated: estimated, args: res.tool_calls.map(function(c) { return {id: c.id, name: c.name, arguments: c.arguments}; })});

            for (var i = 0; i < res.tool_calls.length; i++) {
                var tc = res.tool_calls[i];
                out.tools_used.push(tc.name);
                var result = !sent[tc.name] ? {error: 'Tool ' + tc.name + ' is not available in this request.', refused: true}
                    : plan.proposeOnly && !AgentCore.isProposeTool(tc.name) ? {error: 'Last round: only propose_* tools run now; ' + tc.name + ' was not run.', refused: true}
                    : rtools.handles(tc.name) ? rtools.execute(tc.name, tc.arguments) : bt.handles(tc.name) ? bt.execute(tc.name, tc.arguments) : this.tools.execute(tc.name, tc.arguments);
                if (!result || !result.refused) lastTool = {name: tc.name, error: result && result.error ? String(result.error) : ''};
                var rs = AgentCore.clipResult(JSON.stringify(result), resultMax);
                msgs.push({role: 'tool', tool_call_id: tc.id, name: tc.name, content: rs});
                if (store) store.append(conv, 'tool', {tool_name: tc.name, tool_call_id: tc.id, args: tc.arguments || {}, result: rs});
            }
        }

        if (!out.response && status == 'ok') {
            out.response = AgentCore.proposedReply(bt.proposed) || AgentCore.emptyFallback(maxRounds, lastTool);
            if (store) store.append(conv, 'agent', {text: out.response, estimated: false});
        }

        out.usage = usage;
        out.cost = Math.round(chatCost * 1e6) / 1e6;
        out.pending_actions = rtools.proposed.concat(bt.proposed);

        // Dev Assistant Post-Processing: Static Validation and Artifact Proposal
        if (typeof DevValidator != 'undefined') {
            var codeToValidate = '';
            var artTypeToValidate = (devReq && devReq.artifact_type) || '';

            var codeMatch = String(out.response || '').match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/);
            if (codeMatch && codeMatch[1]) {
                codeToValidate = codeMatch[1].trim();
            } else if (devReq && devReq.code) {
                codeToValidate = devReq.code;
            }

            if (!artTypeToValidate) {
                var lowerPrompt = String(lastUser).toLowerCase();
                if (lowerPrompt.indexOf('business rule') >= 0 || lowerPrompt.indexOf('sys_script') >= 0) artTypeToValidate = 'business_rule';
                else if (lowerPrompt.indexOf('script include') >= 0) artTypeToValidate = 'script_include';
                else if (lowerPrompt.indexOf('client script') >= 0) artTypeToValidate = 'client_script';
                else if (lowerPrompt.indexOf('ui policy') >= 0) artTypeToValidate = 'ui_policy';
                else if (lowerPrompt.indexOf('ui action') >= 0) artTypeToValidate = 'ui_action';
                else if (lowerPrompt.indexOf('background script') >= 0) artTypeToValidate = 'background_script';
                else if (lowerPrompt.indexOf('rest') >= 0) artTypeToValidate = 'scripted_rest';
                else if (lowerPrompt.indexOf('atf') >= 0) artTypeToValidate = 'atf_test';
                else if (lowerPrompt.indexOf('portal') >= 0 || lowerPrompt.indexOf('widget') >= 0) artTypeToValidate = 'service_portal_widget';
                else if (lowerPrompt.indexOf('flow') >= 0) artTypeToValidate = 'flow_designer';
                else if (lowerPrompt.indexOf('story') >= 0 || lowerPrompt.indexOf('decompose') >= 0 || lowerPrompt.indexOf('backlog') >= 0) artTypeToValidate = 'story_decomposition';
                else if (lowerPrompt.indexOf('refactor') >= 0) artTypeToValidate = 'code_refactor';
            }

            if (codeToValidate && artTypeToValidate) {
                var valResult = new DevValidator().validate(codeToValidate, artTypeToValidate);
                out.validation = valResult;

                if (this.dev) {
                    var devCard = this.dev.createProposal({
                        artifact_type: artTypeToValidate,
                        code: codeToValidate,
                        table: (devReq && devReq.table) || ctx.table,
                        scope: (devReq && devReq.scope) || 'global',
                        bound_table: ctx.bound ? ctx.bound.table : '',
                        bound_sys_id: ctx.bound ? ctx.bound.sys_id : ''
                    });

                    var artDef = DevAssistant.ARTIFACT_TYPES[artTypeToValidate];
                    if (ctx.bound && artDef && ctx.bound.table === artDef.table && !ctx.bound.error && !AgentCore.writesOff()) {
                        try {
                            var propRes = rtools.propose({
                                fields: { script: codeToValidate },
                                summary: 'Update ' + artDef.label + ' script'
                            });
                            if (propRes && !propRes.error && propRes.pending_action_id) {
                                devCard.can_accept = true;
                                devCard.pending_action_id = propRes.pending_action_id;
                            }
                        } catch (eProp) {}
                    }

                    out.pending_actions = (out.pending_actions || []).concat([devCard]);
                }
            }
        }

        // ITSM Intelligence Post-Processing: Citation Validation & Proposal Generation
        if (this.itsm && out.response) {
            var registry = (itsmEvidence && itsmEvidence.sourceRegistry) ? itsmEvidence.sourceRegistry : {};

            msgs.forEach(function(m) {
                if (m.role == 'tool' && m.content) {
                    try {
                        var parsedTool = JSON.parse(m.content);
                        if (parsedTool && parsedTool.source_registry) {
                            for (var srk in parsedTool.source_registry) registry[srk] = parsedTool.source_registry[srk];
                        }
                    } catch (eToolParse) {}
                }
            });

            var citeVal = this.itsm.validateCitations(out.response, registry);
            out.citation_validation = citeVal;
            if (!citeVal.valid) {
                out.citation_warning = 'Unverified citations detected: ' + citeVal.hallucinatedCitations.join(', ') + '. These references were not retrieved from authorized instance data.';
            }

            if (itsmAction == 'draft_knowledge' || itsmAction == 'prepare_knowledge_draft') {
                var draftTitle = (itsmTargetInc && itsmTargetInc.short_description) ? itsmTargetInc.short_description : 'Knowledge Draft';
                var draftCard = this.itsm.createKnowledgeProposal({
                    title: draftTitle,
                    content: out.response,
                    incident_number: itsmTargetInc ? itsmTargetInc.number : '',
                    sources: (itsmEvidence && itsmEvidence.sourcesSummary) ? itsmEvidence.sourcesSummary : []
                });
                out.pending_actions = (out.pending_actions || []).concat([draftCard]);
            } else if (itsmAction == 'recommend_resolution' && itsmTargetInc) {
                var matchCloseNotes = out.response.match(/(?:Recommended Resolution Steps|Resolution Steps|Resolution):\s*([\s\S]*?)(?:\n\n[A-Z0-9#]|\n###|$)/i);
                var notesText = matchCloseNotes ? matchCloseNotes[1].trim() : out.response.substring(0, 1000);

                var configuredCloseCode = (typeof gs !== 'undefined' && gs.getProperty) ? gs.getProperty('x_gmg_ai.default_close_code', 'Solved (Permanently)') : 'Solved (Permanently)';
                var resolutionCloseCode = (itsmReq && itsmReq.close_code) ? itsmReq.close_code : configuredCloseCode;

                var resCard = this.itsm.createResolutionProposal({
                    sys_id: itsmTargetInc.sys_id,
                    number: itsmTargetInc.number,
                    close_code: resolutionCloseCode,
                    close_notes: notesText
                });

                if (ctx.bound && ctx.bound.table == 'incident' && ctx.bound.sys_id == itsmTargetInc.sys_id && !AgentCore.writesOff()) {
                    try {
                        var propRes = rtools.propose({
                            fields: { close_code: resolutionCloseCode, close_notes: notesText, state: '6' },
                            summary: 'Resolve ' + itsmTargetInc.number
                        });
                        if (propRes && !propRes.error && propRes.pending_action_id) {
                            resCard.can_accept = true;
                            resCard.pending_action_id = propRes.pending_action_id;
                        }
                    } catch (ePropRes) {}
                }

                out.pending_actions = (out.pending_actions || []).concat([resCard]);
            }
        }
        this._usage = usage; this._cost = chatCost;

        var after = this.budget.status(pgr, chatCost, gs.getUserID());
        out.spend = {today: after.today, month: after.month, daily_budget: after.daily_budget, monthly_budget: after.monthly_budget, priced: after.priced};
        if (!out.blocked && (after.warning || after.blocked)) out.warning = after.warning || ('Budget now used up; the next request will be blocked. ' + after.blocked);
        out.rounds = round > maxRounds ? maxRounds : round;
        out.ms = new Date().getTime() - started;

        if (store && conv && out.error && status != 'ok') store.append(conv, 'agent', {text: '[' + status + '] ' + out.error});
        this.log(ctx, pgr, out, lastUser, status);
        return out;
    },

    log: function(ctx, pgr, out, prompt, status) {
        try {
            var l = new GlideRecord('x_gmg_ai_log');
            l.initialize();
            l.setValue('user', gs.getUserID());
            l.setValue('page_url', String(ctx.url || '').substring(0, 1000));
            if (l.isValidField('conversation_id')) l.setValue('conversation_id', ctx.conversation_id || ctx.correlation_id || '');
            l.setValue('table_name', ctx.table || '');
            l.setValue('record_sys_id', ctx.sys_id || '');
            if (pgr) l.setValue('provider', pgr.getUniqueValue());
            l.setValue('model', out.model || '');
            l.setValue('tools', (out.tools_used || []).join(', ').substring(0, 1000));
            
            // Sensitive credential and secret redaction
            var cleanPrompt = AgentCore.redact(String(prompt || '')).substring(0, 4000);
            l.setValue('prompt', cleanPrompt);
            
            var respText = String(out.response || out.error || '');
            if (out.fallbacks && out.fallbacks.length) {
                respText += ' [Fallbacks: ' + out.fallbacks.map(function(f) { return f.from_provider + '->' + f.to_provider; }).join(', ') + ']';
            }
            var cleanResp = AgentCore.redact(respText).substring(0, 4000);
            l.setValue('response', cleanResp);
            l.setValue('status', status);
            l.setValue('duration_ms', out.ms || 0);

            var u = out.usage || {};
            l.setValue('input_tokens', u.input || 0);
            l.setValue('output_tokens', u.output || 0);
            l.setValue('cache_read_tokens', u.cache_read || 0);
            l.setValue('cache_write_tokens', u.cache_write || 0);
            if (l.isValidField('total_input_tokens')) l.setValue('total_input_tokens', AgentCore.totalInput(u));
            if (l.isValidField('web_search_requests')) l.setValue('web_search_requests', u.web_search || 0);
            l.setValue('est_cost', out.cost || 0);
            l.setValue('rounds', out.rounds || 0);
            if (out.pending_actions && out.pending_actions.length) l.setValue('pending_action', out.pending_actions[0].id);
            l.insert();
        } catch (e) {
            if (typeof gs != 'undefined' && gs.error) gs.error('GMG AI log failed: ' + e);
            else if (typeof gs != 'undefined' && gs.warn) gs.warn('GMG AI log failed: ' + e);
        }
    },

    type: 'AgentCore'
};

AgentCore.totalInput = function(u) { u = u || {}; return (u.input || 0) + (u.cache_read || 0) + (u.cache_write || 0); };
AgentCore.coreOnly = function() { try { return typeof GMGExtensions == 'undefined' || GMGExtensions.all().length === 0; } catch (e) { return true; } };
AgentCore.WORDING = 'Wording for the user: the card buttons are Accept and Reject; use exactly those two verbs for them, never a synonym. Call the user\'s work "this work" or "the plan", nothing else.';
AgentCore.roundLog = function(round, ci, u, forced, stopReason, blockTypes) {
    ci = ci || {}; u = u || {};
    var tail = ' stop_reason=' + (stopReason || '') + ' blocks=' + (blockTypes || []).join('+');
    return 'GMG AI cache: round=' + round + ' forced=' + !!forced + ' tools_hash=' + (ci.tools_hash || '') + ' system_hash=' + (ci.system_hash || '') +
        ' tool_choice=' + (ci.tool_choice || 'auto') + ' web_search=' + !!ci.web_search + ' breakpoints=' + (ci.breakpoints || 0) +
        ' cache_read=' + (u.cache_read || 0) + ' cache_write=' + (u.cache_write || 0) + ' input=' + (u.input || 0) + ' output=' + (u.output || 0) + tail;
};

AgentCore.FINAL_TURN_NOTE = 'Final turn: no more tools can run. Reply now in plain text with what you found, what you would propose, or why you cannot do it.';
AgentCore.PROPOSE_NEXT_NOTE = 'Round budget: after this round you have ONE round left, and on it only propose_* tools can run. Stop looking things up: call the propose tool NOW with what you have, or reply in plain text if this cannot be built.';
AgentCore.LAST_PROPOSE_NOTE = 'Final round: ONLY propose_* tools can run now; any other tool call is not run. Call the propose tool with what you have, or reply in plain text with why you cannot propose. Nothing is applied until the user accepts it.';
AgentCore.isProposeTool = function(n) { var r = AgentCore.extCall('isProposeTool', [n]); return r.length ? r[0] === true : /^propose_/.test(String(n || '')); };
AgentCore.roundPlan = function(round, maxRounds, set, proposedCount, timeUp) {
    var pending = set == 'build' && !(proposedCount > 0);
    if (timeUp) return {force: true, proposeOnly: false, note: AgentCore.FINAL_TURN_NOTE};
    if (round >= maxRounds) return pending && maxRounds > 1 ? {force: false, proposeOnly: true, note: AgentCore.LAST_PROPOSE_NOTE} : {force: true, proposeOnly: false, note: AgentCore.FINAL_TURN_NOTE};
    if (pending && maxRounds >= 3 && round == maxRounds - 1) return {force: false, proposeOnly: false, note: AgentCore.PROPOSE_NEXT_NOTE};
    return {force: false, proposeOnly: false, note: ''};
};
AgentCore.proposedReply = function(cards) {
    if (!cards || !cards.length) return '';
    return 'I proposed ' + cards.length + ' change' + (cards.length == 1 ? '' : 's') + ' (pending; nothing is applied until you accept it):\n' +
        cards.map(function(c) { return '- ' + (c.type || 'change') + ' ' + (c.target || '') + (c.summary ? ': ' + String(c.summary).split('\n')[0].substring(0, 200) : ''); }).join('\n') +
        '\nReview the card' + (cards.length == 1 ? '' : 's') + ' below to Accept or Reject.';
};

AgentCore.redact = function(s) {
    return String(s == null ? '' : s)
        .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=-]{8,}/gi, '$1 [redacted]')
        .replace(/\b(sk|xai|pk|rk)-[A-Za-z0-9_-]{8,}/gi, '[redacted key]')
        .replace(/\b(api[_-]?key|x-api-key|password|passwd|secret|token|authorization)(["']?\s*[:=]\s*["']?)[^\s"',;&]+/gi, '$1$2[redacted]');
};

AgentCore.emptyFallback = function(round, lastTool) {
    var s = 'I stopped after ' + round + ' round' + (round == 1 ? '' : 's') + ' without a final answer.';
    if (lastTool && lastTool.error) s += ' The last tool (' + lastTool.name + ') returned an error: ' + AgentCore.redact(lastTool.error).substring(0, 500);
    else if (lastTool && lastTool.name) s += ' The last tool I ran was ' + lastTool.name + '.';
    return s + ' Please rephrase or narrow the request and try again.';
};

AgentCore.STEER_CREATE = 'Plan & Create isn\'t enabled here, but if you create the <thing> yourself or open an existing one, I can help you work on it there.';
AgentCore.STEER_DELETE = 'Deleting records isn\'t available here. If you open the record, I can help you change it, for example by setting its state or adding a work note.';
AgentCore.CORE_LIMITS = 'Edition: Now Pilot (open source, based on GMG AI Agent). Creating new records, deleting records, and changing any record other than the open one are not available here (GMG Plan & Create is not enabled). ' +
    'Make no card for any of those. Use this steer for ANYTHING GMG Plan & Create would do: any request to create or build something new, of any record type or artifact. ' +
    'Answer a delete request with: "' + AgentCore.STEER_DELETE + '" For a change to another record, ask them to open that record.';
