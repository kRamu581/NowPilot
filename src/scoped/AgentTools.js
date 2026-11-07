// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
var AgentTools = Class.create();
/* Read-only tools. Every lookup uses GlideRecordSecure, so the CALLING USER's ACLs apply. */
AgentTools.ALLOWED = ['incident', 'problem', 'change_request', 'cmdb_ci', 'sys_user_group', 'kb_knowledge',
    'sys_dictionary', 'sys_choice', 'sys_ui_section', 'sys_ui_element', 'sys_ui_policy', 'sys_ui_policy_action'];
AgentTools.KEY_FIELDS = {
    incident: 'number,short_description,state,priority,impact,urgency,category,assignment_group,assigned_to,caller_id,cmdb_ci,opened_at,sys_updated_on',
    problem: 'number,short_description,state,priority,assignment_group,assigned_to,cmdb_ci,opened_at',
    change_request: 'number,short_description,state,type,risk,priority,assignment_group,assigned_to,cmdb_ci,start_date,end_date',
    cmdb_ci: 'name,sys_class_name,operational_status,install_status,support_group,owned_by,ip_address,location',
    sys_user_group: 'name,description,manager,email,active',
    kb_knowledge: 'number,short_description,workflow_state,kb_knowledge_base,kb_category,sys_updated_on',
    sys_dictionary: 'name,element,column_label,internal_type,max_length,reference,mandatory,choice',
    sys_choice: 'name,element,language,value,label,sequence,inactive',
    sys_ui_section: 'name,view,caption,sys_domain',
    sys_ui_element: 'sys_ui_section,element,position,type',
    sys_ui_policy: 'table,short_description,conditions,on_load,reverse_if_false,active,order',
    sys_ui_policy_action: 'ui_policy,table,field,mandatory,visible,disabled'
};
AgentTools.prototype = {
    initialize: function() {},

    definitions: function() {
        var tables = AgentTools.ALLOWED;
        return [
            {name: 'query_records',
             description: 'Query ServiceNow records with an encoded query. Allowed tables: ' + tables.join(', ') + '. Returns display values. Read-only.',
             parameters: {type: 'object', properties: {
                 table: {type: 'string', 'enum': tables},
                 query: {type: 'string', description: 'ServiceNow encoded query, e.g. active=true^priority=1^ORDERBYDESCsys_created_on'},
                 fields: {type: 'string', description: 'Comma-separated field names (optional; sensible defaults)'},
                 limit: {type: 'integer', description: 'Max rows, default 10, max 50'}
             }, required: ['table']}},
            {name: 'get_record',
             description: 'Get one record by sys_id or number (or name for cmdb_ci/sys_user_group). Returns all populated fields as display values. Read-only.',
             parameters: {type: 'object', properties: {
                 table: {type: 'string', 'enum': tables},
                 sys_id: {type: 'string'},
                 number: {type: 'string', description: 'Record number (INC0000060) or name'}
             }, required: ['table']}},
            {name: 'find_similar_incidents',
             description: 'Find incidents similar to a given incident (by sys_id or number) or to free text, using short description keywords and category/CI. Read-only.',
             parameters: {type: 'object', properties: {
                 sys_id: {type: 'string'}, number: {type: 'string'},
                 text: {type: 'string', description: 'Free text if no incident given'},
                 limit: {type: 'integer'}
             }}},
            {name: 'search_similar_incidents',
             description: 'Search for historical incidents similar to a given incident or query using explainable multi-factor scoring (keywords 0.45, category 0.20, CI 0.25, resolution notes 0.10). Authorized and read-only.',
             parameters: {type: 'object', properties: {
                 incident_id: {type: 'string', description: 'sys_id or number of reference incident'},
                 query: {type: 'string', description: 'Search text or keywords'},
                 category: {type: 'string'},
                 cmdb_ci: {type: 'string', description: 'Configuration item sys_id or name'},
                 limit: {type: 'integer', description: 'Max results (default 5, max 20)'}
             }}},
            {name: 'search_knowledge_articles',
             description: 'Search published and active knowledge articles (kb_knowledge). Excludes drafts, retired, and expired articles. Authorized and read-only.',
             parameters: {type: 'object', properties: {
                 query: {type: 'string', description: 'Search keywords or question'},
                 knowledge_base: {type: 'string', description: 'Specific knowledge base sys_id (optional)'},
                 limit: {type: 'integer', description: 'Max results (default 5, max 20)'}
             }, required: ['query']}},
            {name: 'recommend_resolution',
             description: 'Retrieve evidence from similar resolved incidents and verified knowledge articles to recommend grounded resolution steps for an incident. Read-only.',
             parameters: {type: 'object', properties: {
                 incident_id: {type: 'string', description: 'sys_id or number of incident'},
                 query: {type: 'string', description: 'Short description or problem keywords'}
             }}},
            {name: 'summarize_incident',
             description: 'Retrieve an incident and its journal work notes to create a structured incident summary. Read-only.',
             parameters: {type: 'object', properties: {
                 incident_id: {type: 'string', description: 'sys_id or number of incident'},
                 work_notes_limit: {type: 'integer', description: 'Max work notes entries (default 10)'}
             }}},
            {name: 'prepare_knowledge_draft',
             description: 'Prepare a draft knowledge article from a resolved incident with full resolution notes and validation steps. Non-publishing draft only. Read-only.',
             parameters: {type: 'object', properties: {
                 incident_id: {type: 'string', description: 'sys_id or number of resolved incident'},
                 resolution_notes: {type: 'string', description: 'Optional override for resolution notes'}
             }, required: ['incident_id']}},
            {name: 'validate_dev_code',
             description: 'Validate ServiceNow code for syntax errors, scoped API safety, recursion, and security. Read-only.',
             parameters: {type: 'object', properties: {
                 code: {type: 'string', description: 'JavaScript code to validate'},
                 artifact_type: {type: 'string', description: 'Artifact type, e.g. business_rule, client_script, script_include'}
             }, required: ['code']}},
            {name: 'review_dev_artifact',
             description: 'Review ServiceNow artifact code against 8-point platform contract. Read-only.',
             parameters: {type: 'object', properties: {
                 code: {type: 'string', description: 'JavaScript code to review'},
                 artifact_type: {type: 'string', description: 'Artifact type'}
             }, required: ['code']}},
            {name: 'decompose_story',
             description: 'Decompose a ServiceNow business user story or enhancement into a complete architectural blueprint with OOTB recommendations, components, story points, and ATF plan. Read-only.',
             parameters: {type: 'object', properties: {
                 story_text: {type: 'string', description: 'Business user story or enhancement requirement text'},
                 table: {type: 'string', description: 'Target ServiceNow table (e.g. incident, change_request)'}
             }, required: ['story_text']}},
            {name: 'generate_atf_test',
             description: 'Generate automated test framework (ATF) steps and server-side Jasmine assertion scripts for a ServiceNow table or form. Read-only.',
             parameters: {type: 'object', properties: {
                 table: {type: 'string', description: 'Target ServiceNow table (e.g. incident)'},
                 test_name: {type: 'string', description: 'Optional custom name for the ATF test'},
                 field_values: {type: 'object', description: 'Optional initial field key-value pairs'}
             }, required: ['table']}},
            {name: 'refactor_dev_code',
             description: 'Refactor ServiceNow script anti-patterns (recursive update in before BR, synchronous client GlideRecord to GlideAjax, unbounded queries, hardcoded sys_ids) into CTA-grade code. Read-only.',
             parameters: {type: 'object', properties: {
                 code: {type: 'string', description: 'JavaScript code to refactor'},
                 artifact_type: {type: 'string', description: 'Artifact type, e.g. business_rule, client_script'}
             }, required: ['code']}}
        ];
    },

    execute: function(name, args) {
        try {
            args = args || {};
            if (name == 'query_records') return this.queryRecords(args);
            if (name == 'get_record') return this.getRecord(args);
            if (name == 'find_similar_incidents') return this.findSimilar(args);
            if (name == 'search_similar_incidents') return this.searchSimilarIncidents(args);
            if (name == 'search_knowledge_articles') return this.searchKnowledgeArticles(args);
            if (name == 'recommend_resolution') return this.recommendResolution(args);
            if (name == 'summarize_incident') return this.summarizeIncident(args);
            if (name == 'prepare_knowledge_draft') return this.prepareKnowledgeDraft(args);
            if (name == 'validate_dev_code') {
                if (typeof DevValidator == 'undefined') return {error: 'DevValidator not installed.'};
                return new DevValidator().validate(args.code || '', args.artifact_type || 'business_rule');
            }
            if (name == 'review_dev_artifact') {
                if (typeof WorkflowEngine != 'undefined') return new WorkflowEngine()._executeDevReview(args);
                return {error: 'WorkflowEngine not installed.'};
            }
            if (name == 'decompose_story') {
                if (typeof DevAssistant != 'undefined' && DevAssistant.decomposeStory) {
                    return DevAssistant.decomposeStory(args.story_text || '', args);
                }
                return {error: 'DevAssistant not installed or decomposeStory not available.'};
            }
            if (name == 'generate_atf_test') {
                if (typeof DevAssistant != 'undefined' && DevAssistant.generateATF) {
                    return DevAssistant.generateATF(args);
                }
                return {error: 'DevAssistant not installed or generateATF not available.'};
            }
            if (name == 'refactor_dev_code') {
                if (typeof DevAssistant != 'undefined' && DevAssistant.refactorCode) {
                    return DevAssistant.refactorCode(args.code || '', args.artifact_type || 'business_rule', args);
                }
                return {error: 'DevAssistant not installed or refactorCode not available.'};
            }
            return {error: 'Unknown tool ' + name};
        } catch (e) {
            return AgentTools.toolError(name, e);
        }
    },

    _checkTable: function(t) {
        if (AgentTools.ALLOWED.indexOf(String(t)) < 0) throw 'Table not allowed: ' + t;
    },

    _row: function(gr, fields) {
        var o = {sys_id: gr.getUniqueValue()};
        fields.forEach(function(f) {
            f = String(f).trim();
            if (!f || !gr.isValidField(f)) return;
            var el = gr.getElement(f);
            if (!el.canRead()) return;
            var v = el.getDisplayValue();
            if (v !== '' && v != null) o[f] = String(v).substring(0, 500);
        });
        return o;
    },

    queryRecords: function(a) {
        this._checkTable(a.table);
        var limit = Math.min(parseInt(a.limit, 10) || 10, 50);
        var gr = new GlideRecordSecure(a.table);
        if (a.query) gr.addEncodedQuery(a.query);
        gr.setLimit(limit);
        gr.query();
        var fields = (a.fields || AgentTools.KEY_FIELDS[a.table]).split(',');
        var rows = [];
        while (gr.next()) rows.push(this._row(gr, fields));
        return {table: a.table, query: a.query || '', count: rows.length, rows: rows};
    },

    _find: function(table, sysId, number) {
        var gr = new GlideRecordSecure(table);
        if (sysId && gr.get(sysId)) return gr;
        if (number) {
            gr = new GlideRecordSecure(table);
            var f = gr.isValidField('number') ? 'number' : 'name';
            gr.addQuery(f, number);
            gr.setLimit(1);
            gr.query();
            if (gr.next()) return gr;
        }
        return null;
    },

    getRecord: function(a) {
        this._checkTable(a.table);
        var gr = this._find(a.table, a.sys_id, a.number);
        if (!gr) return {error: 'Not found or not readable by you: ' + a.table + ' ' + (a.sys_id || a.number || '')};
        var o = {table: gr.getRecordClassName(), sys_id: gr.getUniqueValue()};
        var els = gr.getElements();
        for (var i = 0; i < els.length && Object.keys(o).length < 80; i++) {
            var el = els[i];
            var n = el.getName();
            if (/^sys_(mod_count|tags|domain_path)$/.test(n) || !el.canRead()) continue;
            var v = el.getDisplayValue();
            if (v !== '' && v != null) o[n] = String(v).substring(0, 800);
        }
        return o;
    },

    findSimilar: function(a) {
        var limit = Math.min(parseInt(a.limit, 10) || 8, 25);
        var text = a.text || '', exclude = '', category = '', ci = '';
        if (a.sys_id || a.number) {
            var src = this._find('incident', a.sys_id, a.number);
            if (!src) return {error: 'Source incident not found or not readable.'};
            text = src.getValue('short_description') || '';
            exclude = src.getUniqueValue();
            category = src.getValue('category') || '';
            ci = src.getValue('cmdb_ci') || '';
        }
        var stop = {the: 1, and: 1, 'for': 1, 'with': 1, from: 1, that: 1, 'this': 1, have: 1, unable: 1, cannot: 1, not: 1, when: 1, after: 1, issue: 1, error: 1, please: 1};
        var words = String(text).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function(w) { return w.length > 3 && !stop[w]; }).slice(0, 5);
        if (!words.length && !ci && !category) return {error: 'No keywords to match on.'};
        var gr = new GlideRecordSecure('incident');
        var parts = words.map(function(w) { return 'short_descriptionLIKE' + w; });
        if (ci) parts.push('cmdb_ci=' + ci);
        var q = parts.join('^OR');
        if (exclude) q += '^sys_id!=' + exclude;
        q += '^ORDERBYDESCsys_updated_on';
        gr.addEncodedQuery(q);
        gr.setLimit(limit * 3);
        gr.query();
        var fields = 'number,short_description,state,priority,category,cmdb_ci,assignment_group,close_code,close_notes'.split(',');
        var rows = [];
        while (gr.next()) {
            var r = this._row(gr, fields);
            var sd = String(gr.getValue('short_description') || '').toLowerCase();
            r.score = words.filter(function(w) { return sd.indexOf(w) >= 0; }).length +
                (category && gr.getValue('category') == category ? 0.5 : 0) + (ci && gr.getValue('cmdb_ci') == ci ? 1 : 0);
            rows.push(r);
        }
        rows.sort(function(x, y) { return y.score - x.score; });
        return {keywords: words, matched_on_ci: !!ci, results: rows.slice(0, limit)};
    },

    searchSimilarIncidents: function(a) {
        if (typeof ITSMRetriever == 'undefined') return {error: 'ITSMRetriever not installed.'};
        var retriever = new ITSMRetriever();
        var inc = null;
        if (a.incident_id || a.sys_id || a.number) {
            var gr = this._find('incident', a.sys_id || a.incident_id, a.number || a.incident_id);
            if (gr) {
                inc = {
                    sys_id: gr.getUniqueValue(),
                    number: gr.getValue('number') || '',
                    short_description: gr.getValue('short_description') || '',
                    category: gr.getValue('category') || '',
                    subcategory: gr.getValue('subcategory') || '',
                    cmdb_ci: gr.getValue('cmdb_ci') || ''
                };
            }
        }
        var results = retriever.searchSimilarIncidents({
            incident: inc,
            query: a.query || a.text || (inc ? inc.short_description : ''),
            category: a.category || (inc ? inc.category : ''),
            cmdb_ci: a.cmdb_ci || (inc ? inc.cmdb_ci : ''),
            limit: a.limit || 5
        });
        var list = results.results || results || [];
        return {
            query: a.query || a.text || '',
            count: list.length,
            results: list
        };
    },

    searchKnowledgeArticles: function(a) {
        if (typeof ITSMRetriever == 'undefined') return {error: 'ITSMRetriever not installed.'};
        var retriever = new ITSMRetriever();
        var results = retriever.searchKnowledgeArticles({
            query: a.query || '',
            knowledge_base: a.knowledge_base,
            limit: a.limit || 5
        });
        var list = results.results || results || [];
        return {
            query: a.query || '',
            count: list.length,
            results: list
        };
    },

    recommendResolution: function(a) {
        if (typeof ITSMRetriever == 'undefined' || typeof ITSMContextBuilder == 'undefined') return {error: 'ITSM components not installed.'};
        var retriever = new ITSMRetriever();
        var contextBuilder = new ITSMContextBuilder();
        var inc = null;
        if (a.incident_id || a.sys_id || a.number) {
            var gr = this._find('incident', a.sys_id || a.incident_id, a.number || a.incident_id);
            if (gr) {
                inc = {
                    sys_id: gr.getUniqueValue(),
                    number: gr.getValue('number') || '',
                    short_description: gr.getValue('short_description') || '',
                    description: gr.getValue('description') || '',
                    category: gr.getValue('category') || '',
                    subcategory: gr.getValue('subcategory') || '',
                    cmdb_ci: gr.getValue('cmdb_ci') || '',
                    priority: gr.getValue('priority') || '',
                    state: gr.getDisplayValue('state') || gr.getValue('state') || ''
                };
            }
        }
        var query = a.query || (inc ? inc.short_description : '');
        var evidence = retriever.retrieveEvidence({
            incident: inc,
            query: query,
            limit: a.limit || 5
        });
        var ctx = contextBuilder.buildContext(evidence);
        return {
            incident: inc,
            evidence: ctx.contextText,
            sources: ctx.sourcesSummary,
            source_registry: ctx.sourceRegistry
        };
    },

    summarizeIncident: function(a) {
        var gr = this._find('incident', a.sys_id || a.incident_id, a.number || a.incident_id);
        if (!gr) return {error: 'Incident not found or not readable: ' + (a.sys_id || a.incident_id || a.number)};
        var inc = {
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number') || '',
            short_description: gr.getValue('short_description') || '',
            description: gr.getValue('description') || '',
            category: gr.getValue('category') || '',
            cmdb_ci: gr.getDisplayValue('cmdb_ci') || gr.getValue('cmdb_ci') || '',
            state: gr.getDisplayValue('state') || gr.getValue('state') || '',
            priority: gr.getDisplayValue('priority') || gr.getValue('priority') || '',
            assigned_to: gr.getDisplayValue('assigned_to') || '',
            assignment_group: gr.getDisplayValue('assignment_group') || ''
        };
        var workNotes = '';
        try {
            if (gr.isValidField('work_notes') && gr.work_notes && typeof gr.work_notes.getJournalEntry == 'function') {
                workNotes = gr.work_notes.getJournalEntry(Math.min(parseInt(a.work_notes_limit, 10) || 5, 20)) || '';
            }
        } catch (eJ) {}
        return {
            incident: inc,
            work_notes: workNotes
        };
    },

    prepareKnowledgeDraft: function(a) {
        var gr = this._find('incident', a.sys_id || a.incident_id, a.number || a.incident_id);
        if (!gr) return {error: 'Incident not found or not readable: ' + (a.sys_id || a.incident_id || a.number)};
        var closeNotes = a.resolution_notes || gr.getValue('close_notes') || '';
        var inc = {
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number') || '',
            short_description: gr.getValue('short_description') || '',
            description: gr.getValue('description') || '',
            cmdb_ci: gr.getDisplayValue('cmdb_ci') || gr.getValue('cmdb_ci') || '',
            close_code: gr.getValue('close_code') || '',
            close_notes: closeNotes,
            state: gr.getDisplayValue('state') || gr.getValue('state') || ''
        };
        return {
            incident: inc,
            resolution_notes: closeNotes,
            governance_notice: 'Knowledge drafts must remain in draft state and undergo standard peer/criteria review before publication.'
        };
    },

    type: 'AgentTools'
};
/* tool error logging (RECOVERY 2026-10-18, approver): log stack + lineNumber/fileName server-side; the model still sees only the message. */
AgentTools.toolError = function(name, e) {
    var msg = String(e && e.message !== undefined ? e.message : e), line = e && e.lineNumber !== undefined ? e.lineNumber : '', file = e && e.fileName ? e.fileName : '';
    var stack = e && e.stack ? String(e.stack).substring(0, 4000) : '';
    try { gs.error('gmg-tool-error tool=' + name + ' error=' + (e && e.name ? e.name + ': ' : '') + msg + ' line=' + line + ' file=' + file + (stack ? '\nstack: ' + stack : '')); } catch (x) {}
    return {error: 'Tool error: ' + e};
};
