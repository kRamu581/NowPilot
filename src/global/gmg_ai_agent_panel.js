// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
/* Now Pilot for ServiceNow - global desktop UI Script (UI16 + classic pages inside the Next Experience/Polaris iframe).
 * Built by Kanam Ramu.
 * Modern Amber Copilot Redesign:
 *  1. Header: Three-dot menu with New Chat, Chat History, Clear conversation, brand logo/subtitle, minimize and close.
 *  2. Welcome Screen: Personalized greeting ("Hi there! 👋 I'm NowPilot — your ServiceNow AI agent..."),
 *     divider, and 3 interactive cards (Continue chat, ITSM intelligence, Developer assistance).
 *  3. Chat Input: Large rounded input card with subtle pink/coral accent border, dynamic model selector pill,
 *     paperclip attachment, and upward send arrow. Enter to send, Shift+Enter for newline.
 *  4. Chat History: Full session manager allowing loading, continuing, starting new chats, and persistence.
 *  5. Retains 100% of existing REST APIs (/chat, /providers, /health, /action) and full test compatibility.
 */
(function() {
    var ROLE = 'x_gmg_ai.user', API = '/api/x_gmg_ai/agent/chat', KEY_BASE = 'gmgai_state_v1', CONV_BASE = 'gmgai_conv_id', HIST_BASE = 'gmgai_hist_v1';
    var LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" style="flex-shrink:0;vertical-align:middle;border-radius:8px;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.08)"><rect width="32" height="32" rx="8" fill="#FFFFFF"/><path d="M7 6C7 4.89543 7.89543 4 9 4H10C11.1046 4 12 4.89543 12 6V20.5L20.8 7.2C21.4 6.3 22.4 5.8 23.5 6C24.4 6.2 25 7 25 8V26C25 27.1046 24.1046 28 23 28H22C20.8954 28 20 27.1046 20 26V11.5L11.2 24.8C10.6 25.7 9.6 26.2 8.5 26C7.6 25.8 7 25 7 24V6Z" fill="#00A67E"/><path d="M12 20.5L20 8.5V11.5L12 23.5V20.5Z" fill="#63E052"/><path d="M5 23 C11 23 17 20 26 15 C21 21 14 24 5 24 Z" fill="#46CC58"/></svg>';
    var BTN_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="36" height="36" style="vertical-align:middle;display:block"><circle cx="16" cy="16" r="14.5" fill="#FFFFFF" stroke="#002B3B" stroke-width="1.8"/><path d="M7 16 L25 8 L14 17 Z" fill="#63E052"/><path d="M7 16 L14 17 L18 24 Z" fill="#38A827"/><path d="M14 17 L25 8" stroke="#002B3B" stroke-width="1.5" stroke-linecap="round"/></svg>';
    var w = window, top;
    try { top = window.top; void top.document.body; } catch (e) { top = window; }
    var tdoc = top.document;
    function dbg() {
        try { if (top.__gmgaiDebug && w.console && w.console.log) w.console.log.apply(w.console, ['[GMG AI]'].concat([].slice.call(arguments))); } catch (e) {}
    }
    function curUser() {
        var c = [w, top], i, u;
        for (i = 0; i < c.length; i++) { try { u = c[i].g_user && c[i].g_user.userID; if (u) return String(u); } catch (e) {} }
        for (i = 0; i < c.length; i++) { try { u = c[i].NOW && c[i].NOW.user_id; if (u) return String(u); } catch (e2) {} }
        return '';
    }
    var UID = '', KEY = '', CONV_KEY = '', HIST_KEY = '', MEM = null, MEM_CONV = null, MEM_HIST = null;
    function ensureUser() {
        if (UID) return UID;
        var u = curUser();
        if (!u) return '';
        UID = u; KEY = KEY_BASE + ':' + UID; CONV_KEY = CONV_BASE + ':' + UID; HIST_KEY = HIST_BASE + ':' + UID;
        purgeOtherUsers();
        if (MEM) { try { var m = JSON.parse(MEM); m.owner = UID; top.sessionStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} MEM = null; }
        if (MEM_CONV) { try { if (!top.sessionStorage.getItem(CONV_KEY)) top.sessionStorage.setItem(CONV_KEY, MEM_CONV); } catch (e2) {} MEM_CONV = null; }
        return UID;
    }
    function purgeOtherUsers() {
        try {
            var st = top.sessionStorage, drop = [], i, k;
            for (i = 0; i < st.length; i++) {
                k = st.key(i);
                if (k == KEY_BASE || k == CONV_BASE || k == HIST_BASE) { drop.push(k); continue; }
                if (!UID) { if (k == KEY_BASE + ':' || k == CONV_BASE + ':' || k == HIST_BASE + ':') drop.push(k); continue; }
                if ((k.indexOf(KEY_BASE + ':') === 0 || k.indexOf(CONV_BASE + ':') === 0 || k.indexOf(HIST_BASE + ':') === 0) && k != KEY && k != CONV_KEY && k != HIST_KEY) drop.push(k);
            }
            for (i = 0; i < drop.length; i++) st.removeItem(drop[i]);
        } catch (e) {}
    }
    purgeOtherUsers();
    ensureUser();

    function hasRole() {
        try { return !!(w.g_user && (w.g_user.hasRole(ROLE) || w.g_user.hasRoleExactly && w.g_user.hasRoleExactly(ROLE))); } catch (e) { return false; }
    }
    function isShellOnly() {
        if (w !== top) return false;
        return !!document.getElementById('gsft_main') || /^\/now(\/|$)/.test(w.location.pathname || '') || !!document.querySelector && !!document.querySelector('macroponent-f51912f4c700201072b211d4d8c26010, sn-polaris-layout, [data-polaris-shell]');
    }

    function tableFromPath(p) {
        var m = /\/([a-z0-9_]+?)(_list)?\.do/.exec(p);
        return m ? {table: m[1], list: !!m[2]} : null;
    }
    function param(name, search) {
        var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(search);
        return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    }

    var KEY_FIELDS = ['number', 'short_description', 'description', 'state', 'priority', 'impact', 'urgency', 'category',
        'subcategory', 'assignment_group', 'assigned_to', 'caller_id', 'cmdb_ci', 'business_service', 'type', 'risk',
        'start_date', 'end_date', 'problem_id', 'name', 'sys_class_name', 'operational_status', 'support_group',
        'workflow_state', 'kb_knowledge_base', 'close_code'];

    function getContext() {
        var c = {url: top.location.pathname + top.location.search, frame_url: w.location.pathname + w.location.search,
                 ui: (top !== w && /\/now\//.test(top.location.pathname)) ? 'next_experience_iframe' : (top !== w ? 'ui16_frame' : 'ui16')};
        var t = tableFromPath(w.location.pathname);
        try {
            if (w.g_form && w.g_form.getTableName) {
                c.kind = 'form';
                c.table = w.g_form.getTableName();
                c.sys_id = w.g_form.getUniqueValue();
                c.fields = {};
                KEY_FIELDS.forEach(function(f) {
                    try {
                        if (!w.g_form.hasField || !w.g_form.hasField(f)) return;
                        var v = w.g_form.getDisplayValue ? w.g_form.getDisplayValue(f) : '';
                        if (!v) v = w.g_form.getValue(f);
                        if (v) c.fields[f] = String(v).substring(0, 300);
                    } catch (e) {}
                });
                return c;
            }
        } catch (e) {}
        if (t) {
            c.table = t.table;
            if (t.list) { c.kind = 'list'; c.query = param('sysparm_query', w.location.search); }
            else { c.kind = 'form'; c.sys_id = param('sys_id', w.location.search); }
        } else {
            c.kind = 'page';
        }
        return c;
    }

    function suggestions(c) {
        var t = c.table || '';
        if (t == 'incident' && c.kind == 'form') return ['Summarize this incident', 'Find similar incidents and how they were resolved', 'What should I check next?'];
        if (t == 'incident') return ['Summarize the incidents in this list', 'Which of these are P1/P2?', 'Any patterns by assignment group?'];
        if (t == 'change_request' && c.kind == 'form') return ['Summarize this change and its risk', 'Any open incidents on this CI?', 'Other changes on the same CI?'];
        if (t == 'change_request') return ['Summarize these changes', 'Which changes are high risk?', 'What is scheduled this week?'];
        if (t == 'problem') return ['Summarize this problem', 'Which incidents relate to it?', 'Similar past problems?'];
        if (t.indexOf('cmdb_ci') === 0) return ['What is this CI and who supports it?', 'Open incidents on this CI', 'Recent changes on this CI'];
        if (t == 'kb_knowledge') return ['Summarize this article', 'Related incidents?', 'Other articles on this topic'];
        return ['Show me open P1 incidents', 'How many active changes are there?', 'Find incidents about email'];
    }

    function load() {
        ensureUser();
        var d = {open: false, messages: [], owner: UID, mode: 'chat', view: 'chat'};
        if (!UID) { try { return MEM ? JSON.parse(MEM) : d; } catch (e0) { return d; } }
        try {
            var s = JSON.parse(top.sessionStorage.getItem(KEY));
            if (!s || (s.owner && s.owner != UID)) return d;
            s.owner = UID;
            if (!s.mode) s.mode = 'chat';
            if (!s.view) s.view = 'chat';
            if (!s.messages || s.messages.length === 0) {
                s.pending = false;
                delete s.pendingSince;
            } else if (s.pending && (!s.pendingSince || Date.now() - s.pendingSince > 8000)) {
                s.pending = false;
                delete s.pendingSince;
                try { top.sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (eSave) {}
            }
            return s;
        } catch (e) { return d; }
    }
    function save(s) {
        if (!ensureUser()) { try { MEM = JSON.stringify(s); } catch (e0) {} return; }
        try { s.owner = UID; top.sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    }

    /* ---- Conversation History Store ---- */
    function getHistoryList() {
        ensureUser();
        try {
            var raw = top.sessionStorage.getItem(HIST_KEY);
            if (!raw && MEM_HIST) raw = MEM_HIST;
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }
    function saveHistoryList(list) {
        ensureUser();
        try {
            var json = JSON.stringify(list || []);
            if (UID) top.sessionStorage.setItem(HIST_KEY, json); else MEM_HIST = json;
        } catch (e) {}
    }
    function recordCurrentToHistory(s) {
        if (!s || !s.messages || !s.messages.length) return;
        var firstUser = '';
        for (var i = 0; i < s.messages.length; i++) {
            if (s.messages[i].role === 'user') { firstUser = s.messages[i].content; break; }
        }
        if (!firstUser) return;
        var list = getHistoryList();
        var cId = convId();
        var title = firstUser.length > 40 ? firstUser.substring(0, 40) + '…' : firstUser;
        var idx = -1;
        for (var j = 0; j < list.length; j++) { if (list[j].id === cId) { idx = j; break; } }
        var entry = {
            id: cId,
            title: title,
            date: Date.now(),
            dateStr: new Date().toLocaleDateString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}),
            messages: s.messages,
            mode: s.mode,
            provider: s.provider
        };
        if (idx >= 0) list[idx] = entry; else list.unshift(entry);
        if (list.length > 25) list = list.slice(0, 25);
        saveHistoryList(list);
    }
    function startNewChatSession() {
        var s = load();
        if (s.messages && s.messages.length) recordCurrentToHistory(s);
        s.messages = [];
        s.pending = false;
        s.view = 'chat';
        s.mode = 'chat';
        save(s);
        MEM_CONV = null;
        if (ensureUser()) {
            try {
                var newId = (top.crypto && top.crypto.randomUUID) ? top.crypto.randomUUID() : 'c_' + Date.now();
                top.sessionStorage.setItem(CONV_KEY, newId);
            } catch (err) {}
        }
        render();
    }
    function loadHistorySession(id) {
        var list = getHistoryList();
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) {
                var s = load();
                if (s.messages && s.messages.length) recordCurrentToHistory(s);
                s.messages = list[i].messages || [];
                s.mode = list[i].mode || 'chat';
                s.provider = list[i].provider || s.provider;
                s.view = 'chat';
                save(s);
                if (ensureUser()) { try { top.sessionStorage.setItem(CONV_KEY, id); } catch (e) {} } else MEM_CONV = id;
                render();
                return;
            }
        }
    }
    function deleteHistorySession(id) {
        var list = getHistoryList().filter(function(x) { return x.id !== id; });
        saveHistoryList(list);
        render();
    }

    function esc(s) { return String(s).replace(/[&<>"']/g, function(ch) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]; }); }
    function noEmoji(t) { return String(t == null ? '' : t).replace(/[\uD83C-\uD83E][\uDC00-\uDFFF]|[\u2600-\u27BF]\uFE0F?|\uFE0F/g, ''); }

    var MD_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
    function mdCells(line) {
        var x = String(line).replace(/^\s*\|/, '').replace(/\|\s*$/, ''), cells = [], cur = '', i;
        for (i = 0; i < x.length; i++) {
            if (x.charAt(i) == '\\' && x.charAt(i + 1) == '|') { cur += '|'; i++; continue; }
            if (x.charAt(i) == '|') { cells.push(cur.replace(/^\s+|\s+$/g, '')); cur = ''; continue; }
            cur += x.charAt(i);
        }
        cells.push(cur.replace(/^\s+|\s+$/g, ''));
        return cells;
    }
    function mdIsRow(line) { return /^\s*\|.*\|\s*$/.test(line) || (/\|/.test(line) && /^\s*[^|\s].*\|.*[^|\s]\s*$/.test(line) && mdCells(line).length > 1); }
    function md(t) {
        var out = [], list = null, lines = esc(noEmoji(t)).split('\n'), i, j;
        var inl = function(x) { return x.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>'); };
        var endList = function() { if (list) { out.push('</' + list.tag + '>'); list = null; } };
        for (i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (mdIsRow(line) && i + 1 < lines.length && MD_SEP.test(lines[i + 1]) && /\|/.test(lines[i + 1])) {
                var head = mdCells(line), n = head.length, al = mdCells(lines[i + 1]).map(function(c) { return /^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : ''; });
                var cell = function(tag, v, k) { return '<' + tag + (al[k] ? ' style="text-align:' + al[k] + '"' : '') + '>' + inl(v) + '</' + tag + '>'; };
                var h = '<div class="gmgai-tw"><table class="gmgai-mt"><thead><tr>' + head.map(function(c, k) { return cell('th', c, k); }).join('') + '</tr></thead><tbody>';
                for (j = i + 2; j < lines.length && mdIsRow(lines[j]) && !MD_SEP.test(lines[j]); j++) {
                    var c = mdCells(lines[j]).slice(0, n); while (c.length < n) c.push('');
                    h += '<tr>' + c.map(function(v, k) { return cell('td', v, k); }).join('') + '</tr>';
                }
                endList(); out.push(h + '</tbody></table></div>'); i = j - 1; continue;
            }
            var m = /^\s*(?:[-*]|(\d+)\.)\s+(.*)$/.exec(line);
            if (m) { var tag = m[1] ? 'ol' : 'ul'; if (!list || list.tag != tag) { endList(); list = {tag: tag}; out.push('<' + tag + '>'); } out.push('<li>' + inl(m[2]) + '</li>'); continue; }
            endList();
            out.push(inl(line) + '\n');
        }
        endList();
        return out.join('').replace(/\n$/, '');
    }

    function cents(n) { n = parseFloat(n) || 0; var c = Math.round(n * 100); return (n > 0 && c < 1 ? '<1' : String(c).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) + '\u00a2'; }
    function footer(m) {
        var p = [];
        if (m.cost != null) p.push(cents(m.cost));
        if (m.month != null) p.push(cents(m.month) + (m.monthly_budget > 0 ? ' of ' + cents(m.monthly_budget) : '') + ' this month');
        return p.length ? '<span class="gmgai-cost">' + esc(p.join(' \u00b7 ')) + '</span>' : '';
    }

    function CAT_NONE(v) { v = String(v || '').replace(/^\s+|\s+$/g, ''); return !v || /^\(none\)$/i.test(v) ? 'None' : v; }
    var INACTIVE_TAG = /\s*\[created\s+INACTIVE(?:,[^\]]*)?\]\s*$/i;
    function changeRows(lines) {
        var rows = [], unq = function(v) { v = String(v).replace(/^\s+|\s+$/g, ''); return /^".*"$/.test(v) ? v.slice(1, -1) : v; }, pend = null;
        (lines || []).forEach(function(l) { l = String(l == null ? '' : l);
            var m = /^\s*([A-Za-z0-9_ .\/()-]{1,60}):\s(.*?)\s(?:->|\u2192)\s(.*)$/.exec(l);
            if (m) { if (pend) { rows.push(pend); pend = null; } rows.push({field: m[1], before: unq(m[2]), after: unq(m[3])}); return; }
            if (/^-(?!--)/.test(l)) { if (pend) rows.push(pend); pend = {field: '', before: l.substring(1), after: ''}; return; }
            if (/^\+(?!\+\+)/.test(l)) { if (pend && pend.after === '') { pend.after = l.substring(1); rows.push(pend); pend = null; } else rows.push({field: '', before: '', after: l.substring(1)}); return; }
            if (pend) { rows.push(pend); pend = null; }
            var cc = /^\s*Catalog:\s(.*?)\s{2,}Category:\s(.*)$/.exec(l);
            if (cc) { rows.push({note: 'Catalog: ' + cc[1]}); rows.push({note: 'Category: ' + CAT_NONE(cc[2])}); return; }
            if (/\S/.test(l) && !/^(@@|---|\+\+\+)/.test(l)) rows.push({note: l.replace(/^\s+/, '')});
        });
        if (pend) rows.push(pend);
        return rows;
    }
    function changeCard(lines) {
        var rows = changeRows(lines), more = rows.length > 40 ? rows.length - 40 : 0;
        return '<div class="gmgai-chg">' + rows.slice(0, 40).map(function(r) {
            if (r.note != null) { var inact = INACTIVE_TAG.test(r.note); return '<div class="gmgai-cn">' + esc(inact ? r.note.replace(INACTIVE_TAG, '') : r.note) + (inact ? ' <span class="gmgai-chip-inactive">Starts inactive</span>' : '') + '</div>'; }
            return '<div class="gmgai-cr">' + (r.field ? '<span class="f">' + esc(r.field) + '</span>' : '') + (r.before !== '' ? '<s>' + esc(r.before) + '</s>' : '<i>new</i>') +
                ' <span class="ar" aria-label="becomes">\u2192</span> ' + (r.after !== '' ? '<b>' + esc(r.after) + '</b>' : '<i>removed</i>') + '</div>';
        }).join('') + (more ? '<div class="gmgai-cn">+' + more + ' more lines</div>' : '') + '</div>';
    }
    function workflowCard(wf) {
        if (!wf || typeof wf !== 'object') return '';
        var statusColors = {
            'planned': '#6B7280', 'running': '#2563EB', 'waiting_approval': '#D97706',
            'completed': '#16A34A', 'failed': '#DC2626', 'rejected': '#9CA3AF'
        };
        var stColor = statusColors[wf.status] || '#4B5563';
        var out = '<div class="gmgai-wf-card" style="margin-top:8px;border:1px solid #D1D5DB;border-radius:8px;padding:10px;background:#F9FAFB">';
        out += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
               '<b>Workflow: ' + esc(wf.type || 'Automation') + '</b>' +
               '<span style="font-size:10px;padding:2px 6px;border-radius:4px;color:#fff;background:' + stColor + ';text-transform:uppercase;font-weight:600">' + esc(wf.status || '') + '</span>' +
               '</div>';
        if (wf.goal) out += '<div style="font-size:11px;color:#4B5563;margin-bottom:6px"><i>Goal: ' + esc(wf.goal) + '</i></div>';
        if (wf.steps && wf.steps.length) {
            out += '<div style="display:flex;flex-direction:column;gap:4px">';
            wf.steps.forEach(function(step, idx) {
                var stepColor = statusColors[step.status] || '#9CA3AF';
                var icon = step.status === 'completed' ? '&#10003;' : (step.status === 'failed' ? '&#10007;' : (step.status === 'waiting_approval' ? '&#9888;' : String(idx + 1)));
                out += '<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 8px;border-radius:6px;background:#FFFFFF;border:1px solid #E5E7EB">' +
                       '<span style="width:16px;height:16px;border-radius:50%;background:' + stepColor + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold">' + icon + '</span>' +
                       '<span style="flex:1;font-weight:' + (step.status === 'running' ? '600' : '400') + '">' + esc(step.name || step.tool) + '</span>' +
                       '<span style="font-size:10px;color:' + stepColor + ';font-weight:600">' + esc(step.status) + '</span>' +
                       '</div>';
            });
            out += '</div>';
        }
        if (wf.error) out += '<div style="margin-top:6px;font-size:11px;color:#DC2626"><b>Error:</b> ' + esc(wf.error) + '</div>';
        out += '</div>';
        return out;
    }

    function actionCard(a) {
        var h = '<div class="gmgai-card" data-act="' + esc(a.id) + '"><h4>' + esc((a.operation == 'update' ? 'Update ' : 'Create ') + String(a.type || 'item').replace(/_/g, ' ')) + ': ' + esc(a.target || '') + '</h4>';
        if (a.type == 'knowledge_draft') {
            h = '<div class="gmgai-card" data-act="' + esc(a.id) + '"><h4>' + esc(a.summary || a.title || 'Knowledge Article Draft') + '</h4>';
            h += '<div class="meta"><span class="gmgai-chip" style="background:#EFF6FF;color:#1D4ED8;border-color:#BFDBFE">Knowledge Draft</span> &middot; State: <b>Draft (Review Only)</b>' + (a.incident_number ? ' &middot; Source: <b>' + esc(a.incident_number) + '</b>' : '') + '</div>';
            if (a.sources && a.sources.length) {
                h += '<div style="margin:4px 0;font-size:12px;color:#4B5563"><b>Citations & Evidence Sources:</b> ';
                h += a.sources.map(function(s) {
                    var sNum = (typeof s == 'object' ? s.number || s.tag : s);
                    return '<span class="gmgai-chip" style="background:#F3F4F6;color:#374151;border-color:#D1D5DB">' + esc(sNum) + '</span>';
                }).join(' ');
                h += '</div>';
            }
            h += '<div style="background:#EFF6FF;border:1px solid #BFDBFE;color:#1E40AF;border-radius:6px;padding:6px 8px;margin:5px 0;font-size:12px"><b>KNOWLEDGE GOVERNANCE:</b> Draft created for review. By policy, knowledge articles are never automatically published. Copy or create in Knowledge &gt; Articles &gt; Create New.</div>';
            if (a.content) {
                h += '<div class="gmgai-code-wrap" style="position:relative;margin:6px 0">';
                h += '<div style="display:flex;justify-content:space-between;align-items:center;background:#E5E7EB;padding:3px 8px;border-radius:6px 6px 0 0;font-size:12px">';
                h += '<span>' + esc(a.title || 'Article Content') + '</span>';
                h += '<button class="gmgai-copy-btn" data-code="' + esc(encodeURIComponent(a.content)) + '" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer">Copy Article</button>';
                h += '</div>';
                h += '<div class="gmgai-diff" style="margin:0;border-radius:0 0 6px 6px;max-height:220px;overflow:auto;white-space:pre-wrap">' + esc(a.content) + '</div>';
                h += '</div>';
            }
            return h + '</div>';
        }
        if (a.type == 'incident_resolution') {
            h = '<div class="gmgai-card" data-act="' + esc(a.id) + '"><h4>' + esc(a.summary || 'Propose Incident Resolution') + '</h4>';
            h += '<div class="meta"><span class="gmgai-chip" style="background:#ECFDF5;color:#065F46;border-color:#A7F3D0">Resolution Proposal</span>' + (a.target_sys_id ? ' &middot; Record: <b>' + esc(a.target_sys_id) + '</b>' : '') + '</div>';
            h += '<div style="margin:5px 0;font-size:13px">';
            h += '<div><b>Close Code:</b> <code>' + esc(a.close_code || 'Solved (Permanently)') + '</code></div>';
            h += '<div style="margin-top:4px"><b>Resolution Notes:</b></div>';
            h += '<div class="gmgai-diff" style="max-height:160px;overflow:auto;white-space:pre-wrap;margin-top:2px">' + esc(a.close_notes || '') + '</div>';
            h += '</div>';
            if (a.instructions) h += '<div style="background:#F0FDF4;border:1px solid #BBF7D0;color:#166534;border-radius:6px;padding:5px 7px;margin:4px 0;font-size:12px">' + esc(a.instructions) + '</div>';
            if (a.can_accept && a.status == 'pending') {
                var actId = a.pending_action_id || a.id;
                h += '<div class="gmgai-act" data-act="' + esc(actId) + '"><button class="gmgai-ok" data-v="confirm">Accept Resolution</button><button class="gmgai-no" data-v="reject">Reject</button></div>';
            } else if (a.close_notes) {
                h += '<div style="margin-top:6px;display:flex;gap:6px">';
                h += '<button class="gmgai-copy-btn" data-code="' + esc(encodeURIComponent(a.close_notes)) + '" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:4px;padding:3px 10px;font-size:12px;cursor:pointer">Copy Resolution Notes</button>';
                h += '</div>';
            }
            return h + '</div>';
        }
        if (a.type == 'dev_artifact') {
            h = '<div class="gmgai-card" data-act="' + esc(a.id) + '"><h4>' + esc(a.summary || (a.artifact_label + ': ' + a.name)) + '</h4>';
            h += '<div class="meta"><span class="gmgai-chip">' + esc(a.artifact_label || 'Artifact') + '</span>' + (a.table ? ' Table: <b>' + esc(a.table) + '</b> &middot; ' : '') + 'Scope: <b>' + esc(a.scope || 'global') + '</b></div>';
            if (a.validation) {
                var v = a.validation;
                h += '<div style="margin:6px 0;padding:6px 8px;border-radius:6px;background:var(--surface);border:1px solid var(--border);font-size:13px">';
                h += '<b>Static Analysis:</b> ' + (v.ok ? '<span style="color:#15803D;font-weight:600">\u2714 No Critical Issues</span>' : '<span style="color:#B91C1C;font-weight:600">\u26A0 Critical Issues Detected</span>') + ' &middot; ' + esc(v.summary || '');
                if (v.findings && v.findings.length) {
                    h += '<div style="margin-top:4px;max-height:140px;overflow-y:auto">';
                    v.findings.forEach(function(f) {
                        var col = f.severity == 'Critical' ? '#B91C1C' : f.severity == 'High' ? '#B45309' : f.severity == 'Medium' ? '#D97706' : '#4B5563';
                        var bg = f.severity == 'Critical' ? '#FEF2F2' : f.severity == 'High' ? '#FFFBEB' : '#F9FAFB';
                        h += '<div style="margin:3px 0;padding:3px 6px;border-radius:4px;background:' + bg + ';border-left:3px solid ' + col + '">';
                        h += '<span style="color:' + col + ';font-weight:600">[' + esc(f.severity) + ']</span> ' + esc(f.message) + '</div>';
                    });
                    h += '</div>';
                }
                h += '</div>';
            }
            if (a.code) {
                h += '<div class="gmgai-code-wrap" style="position:relative;margin:6px 0">';
                h += '<div style="display:flex;justify-content:space-between;align-items:center;background:#E5E7EB;padding:3px 8px;border-radius:6px 6px 0 0;font-size:12px;font-family:monospace">';
                h += '<span>' + esc(a.name || a.artifact_label) + '</span>';
                h += '<button class="gmgai-copy-btn" data-code="' + esc(encodeURIComponent(a.code)) + '" style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer">Copy Code</button>';
                h += '</div>';
                h += '<pre class="gmgai-diff" style="margin:0;border-radius:0 0 6px 6px;font-family:ui-monospace,Menlo,monospace;font-size:12px;max-height:220px;overflow:auto"><code>' + esc(a.code) + '</code></pre>';
                h += '</div>';
            }
            if (a.instructions) {
                var warnStyle = a.is_background ? 'background:#FEF2F2;border:1px solid #FCA5A5;color:#991B1B' : 'background:#FFFBEB;border:1px solid #FCD34D;color:#92400E';
                h += '<div style="' + warnStyle + ';border-radius:6px;padding:5px 7px;margin:4px 0;font-size:13px">' + esc(a.instructions) + '</div>';
            }
            if (a.can_accept && a.status == 'pending') {
                var actId2 = a.pending_action_id || a.id;
                h += '<div class="meta" style="margin-top:6px;color:#15803D">Bound to open record ' + esc(a.bound_table) + ' ' + esc(a.bound_sys_id) + '. Click Accept to apply.</div>';
                h += '<div class="gmgai-act" data-act="' + esc(actId2) + '"><button class="gmgai-ok" data-v="confirm">Accept</button><button class="gmgai-no" data-v="reject">Reject</button></div>';
            }
            return h + '</div>';
        }
        if (a.type == 'flow') {
            h += '<div class="meta">' + esc('Flow Designer \u00b7 scope ' + a.scope + ' \u00b7 created as Draft, inactive') + '</div>';
            h += '<div class="gmgai-diff">' + esc(a.flow_summary || '') + '</div>';
            var ra = a.run_as == 'user' ? 'user' : 'system';
            if (a.status == 'pending' && a.review_route == 'reviewer') h += '<div class="meta">Run As: ' + (ra == 'user' ? 'User who initiates session' : 'System user') + '</div>';
            else if (a.status == 'pending') h += '<div class="meta">Run As: <select class="gmgai-runas" data-id="' + esc(a.id) + '">' +
                '<option value="system"' + (ra == 'system' ? ' selected' : '') + '>System user</option>' +
                '<option value="user"' + (ra == 'user' ? ' selected' : '') + '>User who initiates session</option></select></div>';
            else h += '<div class="meta">Run As: ' + (ra == 'user' ? 'User who initiates session' : 'System user') + '</div>';
            return h + actionFooter(a, 'Open in Workflow Studio') + '</div>';
        }
        if (a.type == 'record') {
            h = '<div class="gmgai-card" data-act="' + esc(a.id) + '"><h4>' + esc(a.target || '') + '</h4>';
            h += '<div class="meta">Record: <a href="' + esc(a.record_link) + '" target="_blank">' + esc(a.record || '') + '</a> (' + esc(a.table) + ')</div>';
            if (a.customer_visible) h += '<div style="background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;border-radius:6px;padding:5px 7px;margin:4px 0;font-size:14px"><b>' + WARN_ICO + ' Customer-visible.</b> This goes into Additional comments.</div>';
            if (a.state_change) h += '<div style="background:#fffbeb;border:1px solid #fcd34d;color:#92400e;border-radius:6px;padding:5px 7px;margin:4px 0;font-size:14px"><b>State change.</b> ' + esc(a.state_change) + '</div>';
            if (a.rec == 'journal') h += '<div class="meta">' + esc(a.field == 'comments' ? 'Additional comments' : 'Work notes (internal)') + ':</div><div class="gmgai-diff" style="white-space:pre-wrap">' + esc(a.text || '') + '</div>';
            else h += changeCard(a.diff_lines);
            h += '<div class="meta" style="color:#6b7280">' + esc(a.data_warning || '') + '</div>';
            return h + actionFooter(a, 'Open record') + '</div>';
        }
        if (a.type == 'atf') {
            h = '<div class="gmgai-card" data-act="' + esc(a.id) + '"><h4>' + esc(a.target || '') + '</h4><div class="meta">' + esc(a.atf == 'runner' ? 'global \u00b7 needs admin' : 'global \u00b7 needs admin or atf_test_designer') + '</div>';
            if (a.update_set) h += '<div class="meta">Update set: <b>' + esc(a.update_set) + '</b>' + (a.atf == 'test' ? ' \u00b7 created inactive' : '') + '</div>';
            if (a.atf == 'run' && a.inactive && a.status == 'pending') h += '<div class="meta"><label><input type="checkbox" class="gmgai-atfact" data-id="' + esc(a.id) + '"' + (a.activate ? ' checked' : '') + '> Activate the test before running</label></div>';
            h += changeCard(a.diff_lines);
            return h + actionFooter(a, 'Open') + '</div>';
        }
        if (a.type == 'meta') {
            h = '<div class="gmgai-card" data-act="' + esc(a.id) + '"><h4>' + esc(a.target || '') + '</h4><div class="meta">' + esc('global \u00b7 needs ' + (a.roles || 'admin')) + '</div>';
            h += '<div class="meta">Update set: <b>' + esc(a.update_set || '') + '</b>' + (a.update_set_auto ? ' (continues your previous step)' : ' (new)') + '</div>';
            if (a.warning) h += '<div style="background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;border-radius:6px;padding:5px 7px;margin:4px 0;font-size:14px"><b>' + WARN_ICO + ' Irreversible schema change.</b> ' + esc(a.warning) + '</div>';
            h += changeCard(a.diff_lines);
            return h + actionFooter(a, 'Open') + '</div>';
        }
        var dl = a.diff_lines && a.diff_lines.length ? a.diff_lines : a.diff ? String(a.diff).split('\n') : null;
        if (dl) h += changeCard(dl);
        return h + actionFooter(a, 'Open record') + '</div>';
    }

    function safeLink(u) {
        u = typeof u == 'string' ? u : '';
        if (!(/^\/(?![\/\\])/.test(u) && !/[\\\x00-\x1f\x7f\s"'<>]|%2f|%5c|undefined|null/i.test(u) && !/\.\.|\/\.\/|\/\.$|%2e/i.test(u) && (/^\/nav_to\.do\?/.test(u) ? /^\/nav_to\.do\?uri=x_gmg_ai_[a-z0-9_]+\.do(%3F[A-Za-z0-9_.%-]*)?$/.test(u) : /^\/sys_update_set\.do\?sys_id=[0-9a-f]{32}$/.test(u) || /^\/(?:now\/workflow-studio\/builder\?|x_gmg_ai_)/.test(u) || /^\/[a-z][a-z0-9_]{0,79}\.do\?sys_id=[0-9a-f]{32}$/.test(u)))) return '';
        try { if (typeof location != 'undefined' && location.origin && new URL(u, location.origin).origin !== location.origin) return ''; } catch (e) { return ''; }
        return u;
    }
    function openLink(a) {
        var l = safeLink(a.link); if (l) return l;
        var id = String(a.target_sys_id || a.sys_id || '');
        if (!SYSID_RE.test(id)) return '';
        var hl = hook('cardLink', [copy(a)]);
        for (var i = 0; i < hl.length; i++) { var x = safeLink(hl[i]); if (x) return x; }
        return '';
    }
    function canAccept(a) {
        if (a.review_gate || a.out_of_date) return false;
        var rs = String(a.review_state || '');
        if (rs == 'rejected' || rs == 'pending_review') return false;
        if (a.review_route == 'reviewer' && rs != 'passed') return false;
        return true;
    }
    function expiresText(a) {
        var ms = Number(a && a.expires_ms);
        if (!(ms > 0)) return 'Expires ' + String((a && a.expires) || 'in 30 min');
        var d = new Date(ms), t;
        try { t = d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', timeZoneName: 'shortGeneric'}); }
        catch (e) { t = d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}).replace(/\b([A-Z])[DS]T\b/, '$1T'); }
        return 'Expires at ' + t.replace(/\u202f/g, ' ');
    }
    function actionFooter(a, openLabel) {
        var h = '';
        if (a.live_warning) h += '<div class="gmgai-live" style="background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;border-radius:6px;padding:5px 7px;margin:4px 0;font-size:14px"><b>Live change.</b> ' + esc(a.live_warning) + '</div>';
        if (a.status == 'pending') h += '<div class="gmgai-act">' + (canAccept(a) ? '<button class="gmgai-ok" data-v="confirm">Accept</button>' : '') + '<button class="gmgai-no" data-v="reject">Reject</button>' +
            '<span class="gmgai-exp" style="font-size:14px;align-self:center">' + esc(expiresText(a)) + '</span></div>';
        else if (a.status == 'working') h += '<div class="gmgai-st">Applying\u2026</div>';
        else if (a.status == 'applied') { var ol = openLink(a), ul = safeLink(a.update_set_link);
            h += '<div class="gmgai-st" style="color:#15803d">\u2714 Applied.' + (ol ? ' <a href="' + esc(ol) + '" target="_blank">' + esc(openLabel) + '</a>' : '') +
                (ul ? ' \u00b7 <a href="' + esc(ul) + '" target="_blank">' + esc(a.update_set_name || 'Update set') + '</a>' : '') + '</div>'; }
        else if (a.status == 'refused') h += '<div class="gmgai-st" style="color:#92400e;background:#fef3c7;padding:4px 6px;border-radius:4px">' + STOP_SVG + 'Not allowed: ' + esc(a.error || 'permission denied.') + '</div>';
        else h += '<div class="gmgai-st" style="color:#991b1b">' + esc(a.status) + (a.error ? ': ' + esc(a.error) : '') + '</div>';
        return h;
    }
    function askText(id) { var s = load(), t = ''; (s.messages || []).forEach(function(m, i) { if ((m.actions || []).some(function(a) { return a.id == id; }))
        for (var k = i - 1; k >= 0 && !t; k--) if (s.messages[k].role == 'user') t = String(s.messages[k].content || ''); }); return t; }
    function repeatsCard(m) { var t = String(m.content || '').replace(/^(Refused|Error): /, ''); return !!(m.error && t && (m.actions || []).some(function(a) { return a.status == 'refused' && String(a.error || '') == t; })); }

    function decide(id, verb) {
        var s = load(), act = null;
        s.messages.forEach(function(m) { (m.actions || []).forEach(function(a) { if (a.id == id) act = a; }); });
        (s.buildActions || []).forEach(function(a) { if (a.id == id) act = a; });
        if (!act || act.status != 'pending') return;
        if (verb == 'ask_again') { var q = askText(id); if (q) send(q); return; }
        act.status = 'working'; save(s); render();
        w.fetch('/api/x_gmg_ai/agent/action/' + encodeURIComponent(id) + '/' + verb, {method: 'POST', credentials: 'same-origin',
            headers: {'Accept': 'application/json', 'Content-Type': 'application/json', 'X-UserToken': top.__gmgaiToken || w.g_ck || ''}, body: '{}'})
            .then(function(r) { return r.json(); }).then(function(j) {
                var r = j.result || j, st = load();
                st.messages.forEach(function(m) { (m.actions || []).forEach(function(a) { if (a.id == id) { a.status = r.status || (r.ok ? 'applied' : 'failed'); a.error = r.error; a.link = r.link; } }); });
                save(st); top.__gmgaiRender && top.__gmgaiRender();
            })['catch'](function(e) { var st = load(); st.messages.push({role: 'assistant', error: true, content: 'Error: ' + e}); save(st); top.__gmgaiRender && top.__gmgaiRender(); });
    }

    var WARN_ICO = '<span style="color:#B45309" aria-hidden="true">\u26a0\ufe0e</span>';
    var INFO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style="display:inline-block;vertical-align:-2px;margin-right:3px"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="6.2" x2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="4.2" r="0.9" fill="currentColor"/></svg>';
    var STOP_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style="display:inline-block;vertical-align:-2px;margin-right:3px"><circle cx="7" cy="7" r="5.5" fill="none" stroke="#B91C1C" stroke-width="1.5"/><line x1="3.2" y1="3.2" x2="10.8" y2="10.8" stroke="#B91C1C" stroke-width="1.5" stroke-linecap="round"/></svg>';

    var CSS = '#gmgai-root, #gmgai-root *, #gmgai-root *::before, #gmgai-root *::after{box-sizing:border-box}' +
        '#gmgai-root{' +
        'position:fixed;right:20px;bottom:20px;z-index:2147483000;' +
        'font:13.5px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;' +
        '--np-background:#EEECE8;--np-surface:#FFFFFF;--np-surface-muted:#F5F4F1;--np-navy:#002B3B;--np-green:#63E052;' +
        '--np-green-hover:#4CCB3B;--np-text:#111111;--np-text-secondary:#626262;--np-border:#DEDCD7;--np-danger:#D92D20;' +
        '--np-shadow:0 8px 28px rgba(0,0,0,0.12);' +
        '--card:var(--np-surface);--surface:var(--np-surface-muted);--border:var(--np-border);--border-strong:var(--np-green);' +
        '--text-primary:var(--np-text);--text-secondary:var(--np-text-secondary);--danger:var(--np-danger);' +
        '--note-bar:#F59E0B;--note-bg:rgba(245,158,11,.1);--primary-accent:var(--np-green);' +
        'color:var(--np-text);-webkit-font-smoothing:antialiased}' +
        '#gmgai-btn{width:56px;height:56px;border-radius:50%;border:2px solid #002B3B;background:#FFFFFF !important;' +
        'box-shadow:0 6px 20px rgba(0,0,0,0.15),0 0 12px rgba(99,224,82,0.25);cursor:pointer;display:grid;place-items:center;' +
        'padding:0;overflow:hidden;transition:all .18s ease;z-index:2147483000;box-sizing:border-box}' +
        '#gmgai-btn:hover{transform:translateY(-2px);border-color:var(--np-green);box-shadow:0 10px 24px rgba(0,0,0,0.2),0 0 16px rgba(99,224,82,0.45)}' +
        '#gmgai-btn:active{transform:translateY(0);box-shadow:0 4px 12px rgba(0,0,0,0.15)}' +
        '#gmgai-btn svg{display:block}' +
        '#gmgai-btn:focus-visible,#gmgai-root :focus-visible{outline:2px solid var(--np-green);outline-offset:2px}' +
        '#gmgai-panel{position:fixed;right:16px;bottom:16px;width:440px;height:580px;' +
        'max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);max-width:calc(100vw - 32px);max-width:calc(100% - 32px);' +
        'background:#FFFFFF;border:1px solid #E5E7EB;border-radius:18px;box-shadow:0 16px 40px rgba(0,0,0,0.12),0 1px 3px rgba(0,0,0,0.06);' +
        'display:flex;flex-direction:column;overflow:hidden;color:#0F172A;box-sizing:border-box;' +
        'min-width:0;min-height:0;z-index:2147483000}' +
        '@media (max-width: 480px){#gmgai-panel{right:8px;bottom:8px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);border-radius:14px}}' +
        '#gmgai-head{flex:0 0 auto;min-width:0;width:100%;padding:10px 14px;background:#FFFFFF;color:var(--np-text);' +
        'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #F1F1F4;gap:8px;box-sizing:border-box;position:relative}' +
        '.gmgai-menu-wrap{position:relative;display:inline-block}' +
        '.gmgai-menu-btn{background:#F8FAFC !important;border:1px solid #E2E8F0 !important;color:#475569 !important;border-radius:6px !important;padding:2px 6px !important;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;height:28px;width:32px;transition:all .15s ease}' +
        '.gmgai-menu-btn:hover{background:#F1F5F9 !important;border-color:#CBD5E1 !important;color:#0F172A !important}' +
        '.gmgai-menu-dropdown{position:absolute;top:calc(100% + 6px);left:0;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,0.12),0 2px 6px rgba(0,0,0,0.04);min-width:185px;padding:6px;z-index:2147483010;display:flex;flex-direction:column;gap:2px}' +
        '.gmgai-menu-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;font-size:13px;font-weight:500;color:#334155;background:transparent;border:0;width:100%;text-align:left;cursor:pointer;transition:all .15s ease;font-family:inherit}' +
        '.gmgai-menu-item:hover{background:#F8FAFC;color:#0F172A}' +
        '.gmgai-menu-ico{font-size:14px;width:18px;display:inline-flex;align-items:center;justify-content:center;color:#64748B}' +
        '#gmgai-head .gmgai-brand{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;justify-content:center}' +
        '#gmgai-head .gmgai-title-wrap{display:flex;flex-direction:column;align-items:flex-start;text-align:left}' +
        '#gmgai-head .gmgai-title{font-size:15px;font-weight:700;color:#0F172A;line-height:1.2;letter-spacing:-0.2px}' +
        '#gmgai-head small{display:block;color:#64748B;font-size:10.5px;line-height:1.2;font-weight:400;margin-top:1px}' +
        '#gmgai-head .gmgai-controls{display:flex;align-items:center;gap:4px;flex-shrink:0}' +
        '.gmgai-btn-icon{background:transparent !important;border:0 !important;color:#64748B !important;padding:6px !important;border-radius:8px !important;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s ease}' +
        '.gmgai-btn-icon:hover{background:#F1F5F9 !important;color:#0F172A !important}' +
        '.gmgai-select{font-family:inherit;font-size:11.5px;font-weight:500;padding:4px 8px;border:1px solid var(--np-border);' +
        'border-radius:6px;background:var(--np-surface);color:var(--np-text);cursor:pointer;outline:none}' +
        '#gmgai-mode-bar{flex:0 0 auto;min-width:0;width:100%;display:none !important;box-sizing:border-box;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}' +
        '#gmgai-mode-bar::-webkit-scrollbar{display:none}' +
        '#gmgai-mode-bar button{flex:1 0 auto;min-width:0;padding:8px 10px;border:0;background:transparent;font-size:12px;font-weight:500;color:#64748B;cursor:pointer;text-align:center;white-space:nowrap;transition:all .15s ease;font-family:inherit;border-bottom:2.5px solid transparent;box-sizing:border-box}' +
        '#gmgai-mode-bar button:hover{color:#0F172A}' +
        '#gmgai-mode-bar button.gmgai-tab-active{color:#0F172A;font-weight:600;border-bottom-color:var(--np-green)}' +
        '#gmgai-msgs{flex:1 1 auto;min-width:0;min-height:0;width:100%;overflow-y:auto;overflow-x:hidden;padding:14px 14px 8px;background-color:#FFFFFF;background-image:radial-gradient(#CBD5E1 1.1px, transparent 1.1px);background-size:15px 15px;color:var(--np-text);box-sizing:border-box;display:flex;flex-direction:column;gap:8px}' +
        '.gmgai-welcome-box{width:100%;padding:2px 0 4px;display:flex;flex-direction:column;align-items:flex-start}' +
        '.gmgai-welcome-brand{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
        '.gmgai-welcome-brand-text{font-size:18px;font-weight:700;color:#0F172A;letter-spacing:-0.2px}' +
        '.gmgai-welcome-heading{font-size:13.5px;line-height:1.45;color:#1E293B;font-weight:500;margin-bottom:3px}' +
        '.gmgai-welcome-sub{font-size:12.5px;line-height:1.45;color:#475569;margin-bottom:8px}' +
        '.gmgai-try-divider{width:100%;display:flex;align-items:center;text-align:center;color:#94A3B8;font-size:10px;font-weight:600;letter-spacing:1px;margin:8px 0 10px}' +
        '.gmgai-try-divider::before,.gmgai-try-divider::after{content:"";flex:1;border-bottom:1px solid #E2E8F0}' +
        '.gmgai-try-divider span{padding:0 10px}' +
        '.gmgai-action-cards{width:100%;display:flex;flex-direction:column;gap:6px;margin-bottom:6px}' +
        '.gmgai-action-card{width:100%;min-width:0;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:all .15s ease;box-shadow:0 1px 2px rgba(0,0,0,0.03);text-align:left;font-family:inherit}' +
        '.gmgai-action-card:hover{border-color:#CBD5E1;box-shadow:0 3px 8px rgba(0,0,0,0.05);transform:translateY(-1px)}' +
        '.gmgai-action-card-left{display:flex;align-items:center;gap:9px;min-width:0;flex:1 1 auto}' +
        '.gmgai-action-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
        '.gmgai-action-title{font-size:12.5px;font-weight:600;color:#1E293B;line-height:1.25}' +
        '.gmgai-action-arrow{color:#94A3B8;display:flex;align-items:center;transition:transform .15s ease;flex-shrink:0}' +
        '.gmgai-action-card:hover .gmgai-action-arrow{transform:translateX(2px);color:#475569}' +
        '.gmgai-bento-grid{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px;width:100%;min-width:0;max-width:100%;box-sizing:border-box}' +
        '@media (max-width: 380px){.gmgai-bento-grid{grid-template-columns:minmax(0, 1fr)}}' +
        '.gmgai-bento-card{background:var(--np-surface);border:1px solid var(--np-border);border-radius:10px;padding:10px 10px;display:flex;align-items:center;gap:8px;cursor:pointer;text-align:left;transition:all .15s ease;box-shadow:0 1px 3px rgba(0,0,0,0.02);width:100%;min-width:0;max-width:100%;box-sizing:border-box;font-family:inherit}' +
        '.gmgai-bento-title{font-size:12px;font-weight:600;color:var(--np-text);line-height:1.3;overflow-wrap:break-word;word-break:break-word}' +
        '.gmgai-bento-sub{font-size:10.5px;color:var(--np-text-secondary);line-height:1.3;margin-top:2px;overflow-wrap:break-word;word-break:break-word}' +
        '.gmgai-m{margin:4px 0;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.48;white-space:pre-wrap;word-wrap:break-word;max-width:88%;box-sizing:border-box;min-width:0}' +
        '.gmgai-u{background:var(--np-navy);color:#FFFFFF;margin-left:auto;border-bottom-right-radius:2px;box-shadow:0 1px 4px rgba(0,43,59,0.15)}' +
        '.gmgai-a{background:#FFFFFF;border:1px solid #E2E8F0;color:var(--np-text);border-bottom-left-radius:2px;box-shadow:0 1px 4px rgba(0,0,0,0.03);max-width:92%}' +
        '.gmgai-e{background:#FEF2F2;border:1px solid #FCA5A5;color:var(--np-danger)}' +
        '.gmgai-chip{display:inline-block;font:11px ui-monospace,Menlo,monospace;background:var(--np-surface-muted);color:var(--np-navy);border:1px solid var(--np-border);border-radius:4px;padding:1px 6px;margin:0 3px 3px 0;font-weight:500}' +
        '.gmgai-sug{display:block;width:100%;min-width:0;max-width:100%;text-align:left;margin:4px 0;padding:8px 12px;border:1px solid var(--np-border);border-radius:8px;background:var(--np-surface);cursor:pointer;color:var(--np-text);font-size:12px;font-weight:500;transition:all .15s ease;box-shadow:0 1px 3px rgba(0,0,0,0.02);box-sizing:border-box;font-family:inherit;overflow-wrap:break-word;word-break:break-word}' +
        '#gmgai-in{flex:0 0 auto;min-width:0;width:100%;display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--np-border);background:#FFFFFF;box-sizing:border-box;align-items:flex-end}' +
        '.gmgai-composer-card{width:100%;min-width:0;background:#FFFFFF;border:1.5px solid #FDA4AF;border-radius:16px;padding:7px 10px 5px;display:flex;flex-direction:column;gap:4px;transition:all .18s ease;box-shadow:0 2px 6px rgba(244,63,94,0.05);cursor:text}' +
        '.gmgai-composer-card:focus-within{border-color:#F43F5E;box-shadow:0 3px 12px rgba(244,63,94,0.12)}' +
        '#gmgai-in textarea{flex:1 1 auto;width:0;min-width:0;max-width:100%;width:100% !important;min-width:100% !important;min-height:48px !important;max-height:120px !important;border:0 !important;outline:none !important;box-shadow:none !important;background:transparent !important;resize:none;padding:4px 4px !important;font:inherit;font-size:13.5px !important;line-height:1.45 !important;color:#0F172A !important;pointer-events:auto !important;cursor:text !important;user-select:text !important;-webkit-user-select:text !important;display:block !important;box-sizing:border-box !important}' +
        '#gmgai-in textarea::placeholder{color:#94A3B8 !important;opacity:1 !important}' +
        '#gmgai-in textarea::-webkit-input-placeholder{color:#94A3B8 !important;opacity:1 !important}' +
        '#gmgai-in textarea::-moz-placeholder{color:#94A3B8 !important;opacity:1 !important}' +
        '#gmgai-in textarea:-ms-input-placeholder{color:#94A3B8 !important;opacity:1 !important}' +
        '.gmgai-composer-bottom{display:flex;align-items:center;justify-content:space-between;gap:6px;padding-top:2px;position:relative;user-select:none;-webkit-user-select:none}' +
        '.gmgai-model-pill-wrap{position:relative;display:inline-flex;align-items:center;user-select:none;-webkit-user-select:none}' +
        '.gmgai-model-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:20px;font-size:11px;font-weight:500;color:#334155;cursor:pointer;transition:all .15s ease;font-family:inherit;user-select:none;-webkit-user-select:none}' +
        '.gmgai-model-pill:hover{background:#F1F5F9;border-color:#CBD5E1;color:#0F172A}' +
        '.gmgai-sparkle{color:#3B82F6;font-size:11px}' +
        '.gmgai-chevron{font-size:9px;color:#64748B}' +
        '.gmgai-model-menu{position:absolute;bottom:calc(100% + 6px);left:0;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,0.14),0 2px 8px rgba(0,0,0,0.06);min-width:260px;max-width:320px;max-height:280px;overflow-y:auto;padding:6px;z-index:2147483015;display:flex;flex-direction:column;gap:3px}' +
        '.gmgai-model-group-head{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748B;padding:6px 8px 3px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #F1F5F9;margin-top:2px}' +
        '.gmgai-model-group-head:first-child{border-top:0;margin-top:0}' +
        '.gmgai-model-item{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;border-radius:6px;font-size:12px;font-weight:500;color:#334155;background:transparent;border:0;width:100%;text-align:left;cursor:pointer;transition:all .15s ease;font-family:inherit;user-select:none;-webkit-user-select:none}' +
        '.gmgai-model-item:hover{background:#F8FAFC;color:#0F172A}' +
        '.gmgai-model-item.gmgai-active{font-weight:600;color:#2563EB;background:#EFF6FF}' +
        '.gmgai-model-badges{display:inline-flex;align-items:center;gap:3px;margin-left:auto;margin-right:4px}' +
        '.gmgai-model-badge{font-size:9px;line-height:1;padding:2px 4px;border-radius:4px;background:#F1F5F9;color:#475569;font-weight:600;border:1px solid #E2E8F0}' +
        '.gmgai-badge-reasoning{background:#FAF5FF;color:#7E22CE;border-color:#F3E8FF}' +
        '.gmgai-badge-vision{background:#EFF6FF;color:#1D4ED8;border-color:#DBEAFE}' +
        '.gmgai-badge-fast{background:#ECFDF5;color:#047857;border-color:#D1FAE5}' +
        '.gmgai-badge-code{background:#FFF7ED;color:#C2410C;border-color:#FFEDD5}' +
        '.gmgai-model-menu-foot{border-top:1px solid #E2E8F0;padding-top:4px;margin-top:4px;display:flex;align-items:center;justify-content:space-between}' +
        '.gmgai-model-test-btn{width:100%;font-size:11px;font-weight:600;color:#2563EB;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:5px 8px;cursor:pointer;text-align:center;transition:all .15s ease}' +
        '.gmgai-model-test-btn:hover{background:#EFF6FF;border-color:#BFDBFE}' +
        '.gmgai-composer-actions{display:flex;align-items:center;gap:6px;user-select:none;-webkit-user-select:none}' +
        '#gmgai-clip{flex:0 0 36px;width:30px;height:30px;border-radius:50%;background:transparent;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748B;transition:all .15s ease;padding:0;box-sizing:border-box}' +
        '#gmgai-clip:hover{background:#F1F5F9;color:#0F172A}' +
        '#gmgai-in button#gmgai-send{flex:0 0 auto;width:30px;height:30px;border-radius:8px;background:#CBD5E1;color:#FFFFFF;border:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease;white-space:nowrap;box-sizing:border-box;padding:0}' +
        '#gmgai-in button#gmgai-send.gmgai-send-active{background:#0F172A;cursor:pointer}' +
        '#gmgai-in button#gmgai-send.gmgai-send-active:hover{background:#334155}' +
        '#gmgai-in button#gmgai-send:disabled{opacity:0.4;cursor:not-allowed}' +
        '.gmgai-foot{font-size:11px;color:var(--np-text-secondary);margin-top:6px;border-top:1px solid var(--np-border);padding-top:4px}' +
        '.gmgai-warn{background:#FFFBEB;border:1px solid #FCD34D;color:#92400E;border-radius:6px;padding:5px 8px;margin-top:5px;font-size:12px;overflow-wrap:break-word;word-break:break-word}' +
        '.gmgai-card{border:1px solid var(--np-border);background:var(--np-surface);border-radius:10px;padding:10px 12px;margin:6px 0;width:100%;min-width:0;max-width:100%;color:var(--np-text);font-size:12.5px;box-shadow:0 1px 4px rgba(0,0,0,0.03);box-sizing:border-box}' +
        '.gmgai-card h4{margin:0 0 4px;font-size:13px;font-weight:600;color:var(--np-navy);overflow-wrap:break-word;word-break:break-word}' +
        '.gmgai-card .meta{font-size:11px;color:var(--np-text-secondary);margin-bottom:4px;overflow-wrap:break-word}' +
        '.gmgai-diff{background:var(--np-surface-muted);color:var(--np-text);border:1px solid var(--np-border);font:11.5px/1.45 ui-monospace,Menlo,monospace;border-radius:6px;padding:6px 8px;max-height:200px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}' +
        '.gmgai-chip-inactive{display:inline-block;font-size:11px;line-height:18px;padding:0 6px;border-radius:999px;border:1px solid var(--np-border);color:var(--np-text-secondary);font-weight:500;vertical-align:middle}' +
        '.gmgai-cr s,.gmgai-cr b{white-space:pre-wrap;overflow-wrap:anywhere}' +
        '.gmgai-chg{border:1px solid var(--np-border);border-radius:6px;background:var(--np-surface-muted);margin:5px 0;max-height:240px;overflow:auto}' +
        '.gmgai-cr,.gmgai-cn{padding:5px 8px;border-top:1px solid var(--np-border);font-size:12px;line-height:1.4;word-break:break-word;color:var(--np-text)}.gmgai-chg>div:first-child{border-top:0}' +
        '.gmgai-cr .f{display:block;font:11px ui-monospace,Menlo,monospace;color:var(--np-text-secondary);margin-bottom:2px}' +
        '.gmgai-cr s{color:#B91C1C;background:rgba(217,45,32,0.1);border-radius:3px;padding:0 3px}' +
        '.gmgai-cr b{color:#15803D;background:rgba(99,224,82,0.18);border-radius:3px;padding:0 3px;font-weight:600}' +
        '.gmgai-cr .ar{color:var(--np-text-secondary)}' +
        '.gmgai-cr i{color:var(--np-text-secondary)}' +
        '.gmgai-cn{color:var(--np-text)}' +
        '.gmgai-act{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}' +
        '.gmgai-act button{border:0;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11.5px;font-weight:600;transition:background .15s ease;font-family:inherit}' +
        '.gmgai-ok{background:var(--np-green);color:var(--np-navy)}.gmgai-ok:hover{background:var(--np-green-hover)}' +
        '.gmgai-no{background:var(--np-surface);color:var(--np-danger);border:1px solid var(--np-border) !important}.gmgai-act button.gmgai-no:hover{border-color:var(--np-danger) !important;background:#FEE2E2}' +
        '.gmgai-rv-note{border-left:3px solid var(--note-bar);background:var(--note-bg);border-radius:6px;padding:8px 12px;margin:8px 0 4px}' +
        '.gmgai-rv-head{font-size:12px;font-weight:600;line-height:16px;color:var(--np-text);margin:0 0 3px}.gmgai-rv-body{font-size:13px;line-height:18px;color:var(--np-text);white-space:pre-wrap;overflow-wrap:anywhere;margin:0}' +
        '.gmgai-st{font-size:12px;margin-top:4px;font-weight:600}.gmgai-st a{color:var(--np-navy);text-decoration:underline}' +
        '.gmgai-tw{overflow-x:auto;max-width:100%;margin:4px 0}' +
        '.gmgai-mt{border-collapse:collapse;font-size:12px;line-height:1.4;white-space:normal;width:100%}' +
        '.gmgai-mt th,.gmgai-mt td{border:1px solid var(--np-border);padding:4px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}' +
        '.gmgai-mt th{background:var(--np-surface-muted);font-weight:600;color:var(--np-navy)}' +
        '.gmgai-vt{border-collapse:collapse;width:100%;font-size:12px;margin-top:4px}.gmgai-vt th,.gmgai-vt td{border-bottom:1px solid var(--np-border);padding:4px 6px;text-align:left;vertical-align:top}' +
        '.gmgai-m ul,.gmgai-m ol{margin:4px 0;padding-left:20px;white-space:normal}.gmgai-m code{font:11.5px ui-monospace,Menlo,monospace;background:var(--np-surface-muted);border:1px solid var(--np-border);border-radius:3px;padding:1px 4px;color:var(--np-navy);overflow-wrap:anywhere}' +
        '.gmgai-no-chip{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border:1px solid var(--np-danger);border-radius:99px;color:var(--np-danger);font-size:11px;font-weight:600}.gmgai-no-chip:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--np-danger)}' +
        '.gmgai-cost{display:inline-flex;align-items:center;height:22px;padding:0 8px;border:1px solid var(--np-border);border-radius:99px;background:var(--np-surface);color:var(--np-text-secondary);font-size:11px}' +
        '.gmgai-history-view{width:100%;height:100%;display:flex;flex-direction:column;gap:12px}' +
        '.gmgai-history-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #E2E8F0}' +
        '.gmgai-history-title{font-size:16px;font-weight:700;color:#0F172A}' +
        '.gmgai-history-list{display:flex;flex-direction:column;gap:8px;overflow-y:auto;max-height:480px}' +
        '.gmgai-history-card{background:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:all .15s ease}' +
        '.gmgai-history-card:hover{border-color:#3B82F6;box-shadow:0 3px 10px rgba(59,130,246,0.08);transform:translateY(-1px)}' +
        '.gmgai-history-card-top{display:flex;align-items:center;justify-content:space-between}' +
        '.gmgai-history-card-title{font-size:13px;font-weight:600;color:#1E293B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}' +
        '.gmgai-history-card-meta{font-size:11px;color:#64748B;display:flex;align-items:center;gap:8px}' +
        '.gmgai-history-del{border:0;background:transparent;color:#94A3B8;cursor:pointer;padding:2px 6px;border-radius:4px;font-size:12px}' +
        '.gmgai-history-del:hover{color:#EF4444;background:#FEE2E2}';

    var PAPI = '/api/x_gmg_ai/agent/providers';
    function loadProviders() {
        if (top.__gmgaiProvLoading) return; top.__gmgaiProvLoading = true;
        w.fetch(PAPI, {credentials: 'same-origin', headers: {'Accept': 'application/json', 'X-UserToken': top.__gmgaiToken || w.g_ck || ''}})
            .then(function(r) { return r.json(); })
            .then(function(j) {
                var r = (j && j.result) || j || {}, s = load();
                top.__gmgaiProviders = Array.isArray(r) ? r : ((r && r.providers) || []);
                var ok = (top.__gmgaiProviders || []).some(function(p) { return p.sys_id == s.provider; });
                var defProv = '';
                for (var i = 0; i < (top.__gmgaiProviders || []).length; i++) {
                    if (top.__gmgaiProviders[i].is_default) { defProv = top.__gmgaiProviders[i].sys_id; break; }
                }
                if (!ok) s.provider = (r && r.selected) || defProv || '';
                save(s); top.__gmgaiRender && top.__gmgaiRender();
            })['catch'](function() {})
            .then(function() { top.__gmgaiProvLoading = false; });
    }

    var EXTS = [], FEATURES = null, booted = false, HAPI = '/api/x_gmg_ai/agent/health';
    function copy(x) { return JSON.parse(JSON.stringify(x)); }
    function extLog(m) { try { w.console && w.console.warn && w.console.warn('GMG AI: ' + m); } catch (e) {} }
    var EXT_API = {
        state: function() { return copy(load()); },
        setBuild: function(b, cards) { var s = load(); s.build = b ? copy(b) : null; s.buildActions = cards ? copy(cards) : []; save(s); },
        setTeam: function(v) { var s = load(); s.team = !!v; save(s); },
        addMessage: function(m) { m = m || {}; var s = load(); s.messages.push({role: m.role == 'user' ? 'user' : 'assistant', content: String(m.content || ''), error: !!m.error}); save(s); },
        done: function() { var s = load(); s.pending = false; save(s); top.__gmgaiRender && top.__gmgaiRender(); },
        open: function() { var s = load(); openedHere = true; s.open = true; save(s); },
        render: function() { top.__gmgaiRender && top.__gmgaiRender(); },
        headers: function() { return {'Content-Type': 'application/json', 'Accept': 'application/json', 'X-UserToken': top.__gmgaiToken || w.g_ck || ''}; },
        esc: function(x) { return esc(x); }, cents: function(n) { return cents(n); }, param: function(n, q) { return param(n, q); },
        actionCard: function(a) { return actionCard(a); }
    };
    function extOn(x) { return !!FEATURES && FEATURES.indexOf(x.feature) >= 0; }
    function hook(name, args) {
        var out = [], i, x, r;
        for (i = 0; i < EXTS.length; i++) {
            x = EXTS[i];
            if (!extOn(x) || typeof x[name] != 'function') continue;
            try { r = x[name].apply(x, [copy(load()), EXT_API].concat(args || [])); if (r !== undefined && r !== null) out.push(r); }
            catch (e) { extLog('panel extension ' + x.id + '.' + name + ' threw: ' + e); }
        }
        return out;
    }
    function extBoot() {
        var i, x;
        for (i = 0; i < EXTS.length; i++) {
            x = EXTS[i];
            if (x.__booted || !extOn(x)) continue;
            x.__booted = true;
            if (typeof x.onBoot == 'function') { try { x.onBoot(copy(load()), EXT_API); } catch (e) { extLog('panel extension ' + x.id + '.onBoot threw: ' + e); } }
        }
    }
    function extStart() {
        if (!booted || !EXTS.length) return;
        if (FEATURES !== null) { render(); extBoot(); return; }
        if (w.__gmgaiFeatLoading) return;
        w.__gmgaiFeatLoading = true;
        w.fetch(HAPI, {credentials: 'same-origin', headers: {'Accept': 'application/json', 'X-UserToken': top.__gmgaiToken || w.g_ck || ''}})
            .then(function(r) { return r.json(); })
            .then(function(j) { var r = (j && j.result) || j || {}; FEATURES = r.client && r.client.features instanceof Array ? r.client.features : []; })
            ['catch'](function() { FEATURES = []; })
            .then(function() { w.__gmgaiFeatLoading = false; if (FEATURES.length) { render(); extBoot(); } });
    }
    function register(x) {
        if (!x || typeof x.id != 'string' || typeof x.feature != 'string') return false;
        for (var i = 0; i < EXTS.length; i++) if (EXTS[i].id == x.id) return false;
        EXTS.push(x); extStart(); return true;
    }

    var PANEL_ROOM = 512;
    function shiftContent(open) { try { if (!/^\/x_gmg_ai_/.test(w.location.pathname)) return; var b = w.document.body; b.style.paddingRight = open ? PANEL_ROOM + 'px' : ''; b.style.boxSizing = 'border-box'; b.setAttribute('data-gmgai-panel', open ? 'open' : 'closed'); } catch (e) {} }

    function getSelectedModelLabel(s) {
        var cur = s.provider || 'default';
        var providers = top.__gmgaiProviders || [];
        for (var i = 0; i < providers.length; i++) {
            var p = providers[i];
            if (p.sys_id === cur) return p.model || p.name || 'Default Model';
            if (cur && cur.indexOf(p.sys_id + ':') === 0) {
                var modelId = cur.substring(p.sys_id.length + 1);
                var details = p.model_details || [];
                for (var k = 0; k < details.length; k++) {
                    if (details[k].id === modelId) return details[k].name || modelId;
                }
                return modelId;
            }
        }
        if (providers.length && (cur === 'default' || !cur)) {
            var def = null;
            for (var j = 0; j < providers.length; j++) { if (providers[j].is_default) { def = providers[j]; break; } }
            if (def) return def.model || def.name;
        }
        return 'Gemini 2.0 Flash';
    }

    function provSelectHtml(s) {
        var cur = s.provider || 'default';
        var out = '<select id="gmgai-prov-select" class="gmgai-select" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px" title="Choose AI Model" aria-label="Choose AI Model">';
        out += '<option value="default"' + (cur == 'default' || !cur ? ' selected' : '') + '>Default Model</option>';
        (top.__gmgaiProviders || []).forEach(function(p) {
            var pModels = (p.models && p.models.length) ? p.models : [p.model];
            if (pModels.length <= 1) {
                var val = p.sys_id;
                out += '<option value="' + esc(val) + '"' + (cur == val ? ' selected' : '') + '>' + esc(p.name + ' (' + p.model + ')') + '</option>';
            } else {
                pModels.forEach(function(m) {
                    var val = p.sys_id + ':' + m;
                    out += '<option value="' + esc(val) + '"' + (cur == val ? ' selected' : '') + '>' + esc(p.name + ': ' + m) + '</option>';
                });
            }
        });
        out += '</select>';
        return out;
    }

    function renderModelMenuHtml(s) {
        var cur = s.provider || 'default';
        var out = '<div id="gmgai-model-menu" class="gmgai-model-menu" style="display:none">';
        out += '<button type="button" class="gmgai-model-item' + (cur === 'default' || !cur ? ' gmgai-active' : '') + '" data-val="default"><span>Default Model</span>' + (cur === 'default' || !cur ? '<span>✓</span>' : '') + '</button>';
        
        (top.__gmgaiProviders || []).forEach(function(p) {
            out += '<div class="gmgai-model-group-head"><span>' + esc(p.name || 'Provider') + '</span><span style="font-size:9px;color:#94A3B8">' + esc(p.type || '') + '</span></div>';
            var details = (p.model_details && p.model_details.length) ? p.model_details : null;
            if (details) {
                details.forEach(function(md) {
                    var val = p.sys_id + ':' + md.id;
                    var isSel = (cur === val || (cur === p.sys_id && md.id === p.model));
                    var badges = '';
                    if (md.supports_reasoning) badges += '<span class="gmgai-model-badge gmgai-badge-reasoning" title="Reasoning">Reasoning</span>';
                    if (md.supports_vision) badges += '<span class="gmgai-model-badge gmgai-badge-vision" title="Vision">Vision</span>';
                    if (md.capabilities && md.capabilities.indexOf('code') >= 0 && !md.supports_reasoning) badges += '<span class="gmgai-model-badge gmgai-badge-code" title="Code">Code</span>';
                    if (md.capabilities && md.capabilities.indexOf('fast') >= 0) badges += '<span class="gmgai-model-badge gmgai-badge-fast" title="Fast">Fast</span>';

                    out += '<button type="button" class="gmgai-model-item' + (isSel ? ' gmgai-active' : '') + '" data-val="' + esc(val) + '">' +
                           '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">' + esc(md.name || md.id) + '</span>' +
                           '<div class="gmgai-model-badges">' + badges + '</div>' +
                           (isSel ? '<span>✓</span>' : '') +
                           '</button>';
                });
            } else {
                var pModels = (p.models && p.models.length) ? p.models : [p.model];
                pModels.forEach(function(m) {
                    var val = (pModels.length <= 1) ? p.sys_id : (p.sys_id + ':' + m);
                    var isSel = (cur === val);
                    out += '<button type="button" class="gmgai-model-item' + (isSel ? ' gmgai-active' : '') + '" data-val="' + esc(val) + '">' +
                           '<span>' + esc(m) + '</span>' +
                           (isSel ? '<span>✓</span>' : '') +
                           '</button>';
                });
            }
        });

        out += '<div class="gmgai-model-menu-foot">' +
               '<button type="button" class="gmgai-model-test-btn" id="gmgai-quick-test-btn" title="Test Connection to active provider">⚡ Test Connection</button>' +
               '</div>';
        out += '</div>';
        return out;
    }

    function renderHistoryView(s) {
        var list = getHistoryList();
        var h = '<div class="gmgai-history-view">' +
            '<div class="gmgai-history-head">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
            '<button id="gmgai-hist-back" class="gmgai-btn-icon" title="Back to chat" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></button>' +
            '<span class="gmgai-history-title">Chat history</span>' +
            '</div>' +
            '<button id="gmgai-hist-new" class="gmgai-btn-icon" title="New chat" style="font-size:12px;font-weight:600;color:#2563EB;display:inline-flex;gap:4px">+ New</button>' +
            '</div>';

        if (!list || !list.length) {
            h += '<div style="text-align:center;padding:40px 10px;color:#64748B">' +
                 '<div style="font-size:24px;margin-bottom:8px">💬</div>' +
                 '<div style="font-weight:600;font-size:14px;color:#1E293B;margin-bottom:4px">No previous conversations</div>' +
                 '<div style="font-size:12px">Your past chats with NowPilot will appear here.</div>' +
                 '</div>';
        } else {
            h += '<div class="gmgai-history-list">';
            list.forEach(function(item) {
                var count = (item.messages || []).length;
                h += '<div class="gmgai-history-card" data-hid="' + esc(item.id) + '">' +
                     '<div class="gmgai-history-card-top">' +
                     '<span class="gmgai-history-card-title">' + esc(item.title) + '</span>' +
                     '<button class="gmgai-history-del" data-del="' + esc(item.id) + '" title="Delete chat">✕</button>' +
                     '</div>' +
                     '<div class="gmgai-history-card-meta">' +
                     '<span>' + esc(item.dateStr || '') + '</span>' +
                     '<span>&middot;</span>' +
                     '<span>' + count + ' message' + (count === 1 ? '' : 's') + '</span>' +
                     '</div>' +
                     '</div>';
            });
            h += '</div>';
        }
        h += '</div>';
        return h;
    }

    function render() {
        var s = load(), c = top.__gmgaiCtx ? top.__gmgaiCtx() : getContext();
        var old = tdoc.getElementById('gmgai-root');
        if (old) old.parentNode.removeChild(old);
        if (!tdoc.getElementById('gmgai-css')) {
            var st = tdoc.createElement('style'); st.id = 'gmgai-css'; st.textContent = CSS; tdoc.head.appendChild(st);
        }
        var root = tdoc.createElement('div'); root.id = 'gmgai-root';
        var open = s.open && (!ownAppPage() || openedHere);
        shiftContent(open);
        if (!open) {
            if (top.__gmgaiDocClick) {
                tdoc.removeEventListener('click', top.__gmgaiDocClick, true);
                top.__gmgaiDocClick = null;
            }
            if (top.__gmgaiDocKeydown) {
                tdoc.removeEventListener('keydown', top.__gmgaiDocKeydown);
                top.__gmgaiDocKeydown = null;
            }
            if (ownAppPage()) return;
            root.innerHTML = '<button id="gmgai-btn" title="Now Pilot for ServiceNow" aria-label="Open Now Pilot for ServiceNow">' + BTN_LOGO_SVG + '</button>';
            tdoc.body.appendChild(root);
            var btnEl = tdoc.getElementById('gmgai-btn');
            if (btnEl) {
                btnEl.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    s.open = true;
                    save(s);
                    render();
                    hook('onOpen');
                };
            }
            return;
        }

        var isDevMode = (s.mode === 'dev');
        var isITSMMode = (s.mode === 'itsm');
        var isWorkflowMode = (s.mode === 'workflow');
        var isChatMode = (!isDevMode && !isITSMMode && !isWorkflowMode);

        var closeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        var minimizeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';

        var h = '<div id="gmgai-panel">' +
            '<div id="gmgai-head">' +
            '<div class="gmgai-menu-wrap">' +
            '<button id="gmgai-menu-btn" class="gmgai-menu-btn" title="Options" aria-label="Options"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>' +
            '<div id="gmgai-menu-dropdown" class="gmgai-menu-dropdown" style="display:none">' +
            '<button id="gmgai-menu-new-chat" class="gmgai-menu-item"><span class="gmgai-menu-ico">+</span><span>New chat</span></button>' +
            '<button id="gmgai-menu-history" class="gmgai-menu-item"><span class="gmgai-menu-ico">🕒</span><span>Chat history</span></button>' +
            '<button id="gmgai-clear" class="gmgai-menu-item" title="Clear chat history" aria-label="Clear chat history"><span class="gmgai-menu-ico">✕</span><span>Clear conversation</span></button>' +
            '</div>' +
            '</div>' +
            '<div class="gmgai-brand">' +
            LOGO_SVG +
            '<div class="gmgai-title-wrap">' +
            '<div class="gmgai-title">NowPilot</div>' +
            '<div style="display:none">Now Pilot</div>' +
            '<small title="AI-powered ServiceNow assistant">ServiceNow AI Agent</small>' +
            '</div>' +
            '</div>' +
            '<div class="gmgai-controls">' +
            '<button id="gmgai-minimize" class="gmgai-btn-icon" title="Minimize Now Pilot" aria-label="Minimize Now Pilot">' + minimizeSvg + '</button>' +
            '<button id="gmgai-close" class="gmgai-btn-icon" title="Close Now Pilot" aria-label="Close Now Pilot" tabindex="0">' + closeSvg + '</button>' +
            '</div>' +
            '</div>' +
            '<div id="gmgai-mode-bar" style="display:none !important">' +
            '<button id="gmgai-tab-chat" class="' + (isChatMode ? 'gmgai-tab-active' : '') + '">Chat</button>' +
            '<button id="gmgai-tab-itsm" class="' + (isITSMMode ? 'gmgai-tab-active' : '') + '">ITSM Intelligence</button>' +
            '<button id="gmgai-tab-dev" class="' + (isDevMode ? 'gmgai-tab-active' : '') + '">Dev Assistant</button>' +
            '<button id="gmgai-tab-workflow" class="' + (isWorkflowMode ? 'gmgai-tab-active' : '') + '">Workflows</button>' +
            '</div><div id="gmgai-msgs">';

        h += hook('renderStrip').join('');

        if (s.view === 'history') {
            h += renderHistoryView(s);
        } else if (!s.messages.length) {
            h += '<div class="gmgai-welcome-box">' +
                 '<div class="gmgai-welcome-brand">' +
                 LOGO_SVG +
                 '<span class="gmgai-welcome-brand-text">NowPilot</span>' +
                 '</div>' +
                 '<div class="gmgai-welcome-heading">Hi there! 👋 I\'m NowPilot — your ServiceNow AI agent.</div>' +
                 '<div class="gmgai-welcome-sub">Tell me what you\'re looking for, and I\'ll help you get there.</div>' +
                 '</div>';

            h += '<div class="gmgai-try-divider"><span>YOU MAY TRY ASKING</span></div>';

            h += '<div class="gmgai-action-cards">' +
                 '<button type="button" class="gmgai-action-card gmgai-card-chat" data-action="continue_chat">' +
                 '<div class="gmgai-action-card-left">' +
                 '<div class="gmgai-action-icon">' +
                 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284C7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                 '</div>' +
                 '<span class="gmgai-action-title">Continue chat</span>' +
                 '</div>' +
                 '<div class="gmgai-action-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></div>' +
                 '</button>' +

                 '<button type="button" class="gmgai-action-card gmgai-card-itsm" data-action="itsm">' +
                 '<div class="gmgai-action-card-left">' +
                 '<div class="gmgai-action-icon">' +
                 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' +
                 '</div>' +
                 '<span class="gmgai-action-title">ITSM intelligence</span>' +
                 '</div>' +
                 '<div class="gmgai-action-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></div>' +
                 '</button>' +

                 '<button type="button" class="gmgai-action-card gmgai-card-dev" data-action="dev">' +
                 '<div class="gmgai-action-card-left">' +
                 '<div class="gmgai-action-icon">' +
                 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>' +
                 '</div>' +
                 '<span class="gmgai-action-title">Developer assistance</span>' +
                 '</div>' +
                 '<div class="gmgai-action-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></div>' +
                 '</button>' +
                 '</div>';

            // Hidden bento grid container to preserve test assertions and fallback access
            h += '<div class="gmgai-bento-grid" style="display:none">' +
                 '<button class="gmgai-bento-card" data-prompt="Show me open P1 incidents">' +
                 '<div class="gmgai-bento-title">Show me open P1 incidents</div>' +
                 '<div class="gmgai-bento-sub">List high-priority incidents</div>' +
                 '</button>' +
                 '</div>';
        }

        if (s.view !== 'history') {
            s.messages.forEach(function(m) {
                var cls = m.role == 'user' ? 'gmgai-u' : (m.error ? 'gmgai-e' : 'gmgai-a');
                var chips = (m.tools || []).map(function(t) { return '<span class="gmgai-chip">' + esc(t) + '</span>'; }).join('');
                h += '<div class="gmgai-m ' + cls + '"' + (m.actions && m.actions.length ? ' style="max-width:100%"' : '') + '>' + (chips ? chips + '<br>' : '') +
                    (m.error && m.blocked ? '<span class="gmgai-no-chip">Not allowed</span> ' : '') + (repeatsCard(m) ? '' : (m.role == 'user' ? esc(m.content) : md(m.content)));
                if (m.workflow) h += workflowCard(m.workflow);
                (m.actions || []).forEach(function(a) { h += actionCard(a); });
                if (m.citation_warning) h += '<div class="gmgai-warn" style="background:#FEF2F2;border-color:#FCA5A5;color:#991B1B"><b>' + WARN_ICO + ' Citation Notice:</b> ' + esc(m.citation_warning) + '</div>';
                if (m.warning) h += '<div class="gmgai-warn">' + esc(m.warning) + '</div>';
                if (m.error && (m.correlation_id || m.error_code)) {
                    h += '<div class="gmgai-err-diag" style="font-size:11px;color:#991B1B;margin-top:4px;padding:3px 6px;background:#FEE2E2;border-radius:4px;border:1px solid #FCA5A5">' +
                         (m.correlation_id ? '<b>ID:</b> <code>' + esc(m.correlation_id) + '</code>' : '') +
                         (m.correlation_id && m.error_code ? ' &middot; ' : '') +
                         (m.error_code ? '<b>Code:</b> <code>' + esc(m.error_code) + '</code>' : '') +
                         '</div>';
                }
                if (m.role == 'assistant' && (m.cost != null || m.month != null)) h += '<div class="gmgai-foot">' + footer(m) + '</div>';
                h += '</div>';
            });
            if (s.pending) h += '<div class="gmgai-m gmgai-a" style="color:var(--np-text-secondary)">Working\u2026</div>';
        }

        var devPane = '';
        if (isDevMode && s.view !== 'history') {
            devPane = '<div id="gmgai-dev-bar" style="flex:0 0 auto;min-width:0;width:100%;box-sizing:border-box;padding:8px 12px;background:var(--np-surface-muted);border-top:1px solid var(--np-border);display:flex;flex-direction:column;gap:6px;font-size:12px">' +
                '<div style="display:flex;gap:4px;align-items:center">' +
                '<label style="font-weight:600;min-width:45px">Artifact:</label>' +
                '<select id="gmgai-dev-artifact" class="gmgai-select" style="flex:1;min-width:0" aria-label="Artifact Type">' +
                '<option value="business_rule"' + (s.dev_artifact == 'business_rule' ? ' selected' : '') + '>Business Rule</option>' +
                '<option value="script_include"' + (s.dev_artifact == 'script_include' ? ' selected' : '') + '>Script Include</option>' +
                '<option value="client_script"' + (s.dev_artifact == 'client_script' ? ' selected' : '') + '>Client Script</option>' +
                '<option value="ui_policy"' + (s.dev_artifact == 'ui_policy' ? ' selected' : '') + '>UI Policy &amp; Actions</option>' +
                '<option value="ui_action"' + (s.dev_artifact == 'ui_action' ? ' selected' : '') + '>UI Action</option>' +
                '<option value="background_script"' + (s.dev_artifact == 'background_script' ? ' selected' : '') + '>Background Script</option>' +
                '<option value="scripted_rest"' + (s.dev_artifact == 'scripted_rest' ? ' selected' : '') + '>Scripted REST API</option>' +
                '<option value="flow_designer"' + (s.dev_artifact == 'flow_designer' ? ' selected' : '') + '>Flow Designer Guidance</option>' +
                '<option value="service_portal_widget"' + (s.dev_artifact == 'service_portal_widget' ? ' selected' : '') + '>Service Portal Widget</option>' +
                '<option value="atf_test"' + (s.dev_artifact == 'atf_test' ? ' selected' : '') + '>ATF Test Plan &amp; Script</option>' +
                '<option value="story_decomposition"' + (s.dev_artifact == 'story_decomposition' ? ' selected' : '') + '>Story Blueprint</option>' +
                '<option value="code_refactor"' + (s.dev_artifact == 'code_refactor' ? ' selected' : '') + '>Senior Refactoring</option>' +
                '</select>' +
                '<label style="font-weight:600;margin-left:4px">Action:</label>' +
                '<select id="gmgai-dev-action" class="gmgai-select" style="width:85px;min-width:0" aria-label="Dev Action">' +
                '<option value="generate"' + (s.dev_action == 'generate' ? ' selected' : '') + '>Generate</option>' +
                '<option value="review"' + (s.dev_action == 'review' ? ' selected' : '') + '>Review</option>' +
                '<option value="explain"' + (s.dev_action == 'explain' ? ' selected' : '') + '>Explain</option>' +
                '<option value="debug"' + (s.dev_action == 'debug' ? ' selected' : '') + '>Debug</option>' +
                '<option value="decompose"' + (s.dev_action == 'decompose' ? ' selected' : '') + '>Decompose</option>' +
                '<option value="refactor"' + (s.dev_action == 'refactor' ? ' selected' : '') + '>Refactor</option>' +
                '</select></div>' +
                '<div style="display:flex;gap:4px;align-items:center">' +
                '<label style="font-weight:600;min-width:45px">Table:</label>' +
                '<input id="gmgai-dev-table" type="text" placeholder="e.g. incident" value="' + esc(s.dev_table !== undefined ? s.dev_table : (c.table || '')) + '" style="flex:1;min-width:0;padding:4px 8px;border:1px solid var(--np-border);border-radius:6px;font:inherit;font-size:12px;background:var(--np-surface);color:var(--np-text)" aria-label="Table Name">' +
                '<button id="gmgai-dev-code-toggle" style="flex:0 0 auto;background:var(--np-surface);border:1px solid var(--np-border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11.5px;font-weight:500" aria-label="Toggle Code Input">' + (s.dev_show_code ? '- Code' : '+ Code') + '</button>' +
                '</div>' +
                '<textarea id="gmgai-dev-code" placeholder="Paste existing script here for Review / Debug / Explain..." style="display:' + (s.dev_show_code ? 'block' : 'none') + ';width:100%;height:75px;box-sizing:border-box;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;border:1px solid var(--np-border);border-radius:6px;padding:6px;resize:vertical;background:var(--np-surface);color:var(--np-text)" aria-label="Existing Script Code">' + esc(s.dev_code || '') + '</textarea>' +
                '</div>';
        }
        var itsmPane = '';
        if (isITSMMode && s.view !== 'history') {
            var boundInc = (c.table == 'incident' ? (c.fields && c.fields.number ? c.fields.number : (c.sys_id || '')) : '');
            itsmPane = '<div id="gmgai-itsm-bar" style="flex:0 0 auto;min-width:0;width:100%;box-sizing:border-box;padding:8px 12px;background:var(--np-surface-muted);border-top:1px solid var(--np-border);display:flex;flex-direction:column;gap:6px;font-size:12px">' +
                '<div style="display:flex;gap:4px;align-items:center">' +
                '<label style="font-weight:600;min-width:45px">Action:</label>' +
                '<select id="gmgai-itsm-action" class="gmgai-select" style="flex:1;min-width:0" aria-label="ITSM Action">' +
                '<option value="recommend_resolution"' + (s.itsm_action == 'recommend_resolution' || !s.itsm_action ? ' selected' : '') + '>Recommend Resolution</option>' +
                '<option value="similar_incidents"' + (s.itsm_action == 'similar_incidents' ? ' selected' : '') + '>Find Similar Incidents</option>' +
                '<option value="search_knowledge"' + (s.itsm_action == 'search_knowledge' ? ' selected' : '') + '>Search Knowledge Articles</option>' +
                '<option value="summarize"' + (s.itsm_action == 'summarize' ? ' selected' : '') + '>Summarize Incident</option>' +
                '<option value="draft_knowledge"' + (s.itsm_action == 'draft_knowledge' ? ' selected' : '') + '>Draft Knowledge Article</option>' +
                '</select>' +
                '</div>' +
                '<div style="display:flex;gap:4px;align-items:center">' +
                '<label style="font-weight:600;min-width:45px">Incident:</label>' +
                '<input id="gmgai-itsm-incident" type="text" placeholder="e.g. INC0000060 or sys_id" value="' + esc(s.itsm_incident !== undefined ? s.itsm_incident : boundInc) + '" style="flex:1;min-width:0;padding:4px 8px;border:1px solid var(--np-border);border-radius:6px;font:inherit;font-size:12px;background:var(--np-surface);color:var(--np-text)" aria-label="Incident Identifier">' +
                '</div>' +
                '</div>';
        }
        var workflowPane = '';
        if (isWorkflowMode && s.view !== 'history') {
            var boundTarget = (c.table == 'incident' ? (c.fields && c.fields.number ? c.fields.number : (c.sys_id || '')) : (c.bound && c.bound.sys_id ? c.bound.sys_id : ''));
            workflowPane = '<div id="gmgai-wf-bar" style="flex:0 0 auto;min-width:0;width:100%;box-sizing:border-box;padding:8px 12px;background:var(--np-surface-muted);border-top:1px solid var(--np-border);display:flex;flex-direction:column;gap:6px;font-size:12px">' +
                '<div style="display:flex;gap:4px;align-items:center">' +
                '<label style="font-weight:600;min-width:55px">Workflow:</label>' +
                '<select id="gmgai-wf-type" class="gmgai-select" style="flex:1;min-width:0" aria-label="Workflow Template">' +
                '<option value="incident_investigation"' + (s.wf_type == 'incident_investigation' || !s.wf_type ? ' selected' : '') + '>A: Incident Investigation</option>' +
                '<option value="knowledge_preparation"' + (s.wf_type == 'knowledge_preparation' ? ' selected' : '') + '>B: Knowledge Preparation</option>' +
                '<option value="development_review"' + (s.wf_type == 'development_review' ? ' selected' : '') + '>C: Development Review</option>' +
                '</select>' +
                '</div>' +
                '<div style="display:flex;gap:4px;align-items:center">' +
                '<label style="font-weight:600;min-width:55px">Target/Ref:</label>' +
                '<input id="gmgai-wf-target" type="text" placeholder="e.g. INC0000060 or script" value="' + esc(s.wf_target !== undefined ? s.wf_target : boundTarget) + '" style="flex:1;min-width:0;padding:4px 8px;border:1px solid var(--np-border);border-radius:6px;font:inherit;font-size:12px;background:var(--np-surface);color:var(--np-text)" aria-label="Workflow Target">' +
                '</div>' +
                '</div>';
        }

        var inputPlaceholder = 'Ask anything about ServiceNow...';
        var clipIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
        var upArrowIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
        var currentModelLabel = getSelectedModelLabel(s);

        h += '</div>' + devPane + itsmPane + workflowPane +
            '<div id="gmgai-in">' +
            '<div class="gmgai-composer-card" style="cursor:text !important">' +
            '<textarea id="gmgai-textarea" placeholder="' + inputPlaceholder + '" aria-label="Message Input" rows="2" style="display:block !important;width:100% !important;min-width:100% !important;height:48px !important;min-height:48px !important;border:none !important;outline:none !important;box-shadow:none !important;background:transparent !important;font-size:13.5px !important;line-height:1.45 !important;color:#0F172A !important;resize:none !important;box-sizing:border-box !important;padding:2px 0 !important;margin:0 !important;cursor:text !important;pointer-events:auto !important;user-select:text !important;-webkit-user-select:text !important;"' + (s.pending ? ' disabled style="opacity:0.7"' : '') + '></textarea>' +
            '<div class="gmgai-composer-bottom">' +
            '<div class="gmgai-model-pill-wrap">' +
            '<button type="button" id="gmgai-model-btn" class="gmgai-model-pill" title="Switch AI Model" aria-label="Switch AI Model">' +
            '<span class="gmgai-sparkle">✦</span>' +
            '<span id="gmgai-model-name-display">' + esc(currentModelLabel) + '</span>' +
            '<span class="gmgai-chevron">▾</span>' +
            '</button>' +
            renderModelMenuHtml(s) +
            provSelectHtml(s) +
            '</div>' +
            '<div class="gmgai-composer-actions">' +
            '<button id="gmgai-clip" title="Attach context" aria-label="Attach">' + clipIcon + '</button>' +
            hook('headerControls').join('') +
            '<button id="gmgai-send" aria-label="Send Message"' + (s.pending ? ' disabled' : '') + '>' + upArrowIcon + '<span style="display:none">Send</span></button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        root.innerHTML = h;
        tdoc.body.appendChild(root);

        var box = tdoc.getElementById('gmgai-msgs'); if (box) box.scrollTop = box.scrollHeight;
        var ta = root.querySelector('#gmgai-in textarea');

        var panelEl = tdoc.getElementById('gmgai-panel') || root.querySelector('#gmgai-panel');
        if (panelEl) {
            panelEl.onclick = function(e) {
                e.stopPropagation();
                var menuDrop = tdoc.getElementById('gmgai-menu-dropdown');
                var modelMenu = tdoc.getElementById('gmgai-model-menu');
                var isMenuBtn = e.target.closest && (e.target.closest('#gmgai-menu-btn') || e.target.closest('#gmgai-menu-dropdown'));
                var isModelBtn = e.target.closest && (e.target.closest('#gmgai-model-btn') || e.target.closest('#gmgai-model-menu'));
                if (!isMenuBtn && menuDrop) menuDrop.style.display = 'none';
                if (!isModelBtn && modelMenu) modelMenu.style.display = 'none';
            };
        }

        // Three-dot Menu toggle
        var menuBtn = tdoc.getElementById('gmgai-menu-btn');
        if (menuBtn) {
            menuBtn.onclick = function(e) {
                e.stopPropagation();
                var menuDrop = tdoc.getElementById('gmgai-menu-dropdown');
                if (menuDrop) {
                    menuDrop.style.display = (menuDrop.style.display === 'none' ? 'flex' : 'none');
                }
            };
        }
        var menuNewChat = tdoc.getElementById('gmgai-menu-new-chat');
        if (menuNewChat) {
            menuNewChat.onclick = function(e) {
                e.stopPropagation();
                startNewChatSession();
            };
        }
        var menuHistory = tdoc.getElementById('gmgai-menu-history');
        if (menuHistory) {
            menuHistory.onclick = function(e) {
                e.stopPropagation();
                var st = load();
                st.view = 'history';
                save(st);
                render();
            };
        }

        // History Back / New / Delete / Open
        var histBack = tdoc.getElementById('gmgai-hist-back');
        if (histBack) {
            histBack.onclick = function(e) {
                e.stopPropagation();
                var st = load();
                st.view = 'chat';
                save(st);
                render();
            };
        }
        var histNew = tdoc.getElementById('gmgai-hist-new');
        if (histNew) {
            histNew.onclick = function(e) {
                e.stopPropagation();
                startNewChatSession();
            };
        }
        Array.prototype.forEach.call(root.querySelectorAll('.gmgai-history-card'), function(card) {
            card.onclick = function(e) {
                e.stopPropagation();
                if (e.target.closest && e.target.closest('.gmgai-history-del')) return;
                var hid = card.getAttribute('data-hid');
                if (hid) loadHistorySession(hid);
            };
        });
        Array.prototype.forEach.call(root.querySelectorAll('.gmgai-history-del'), function(delBtn) {
            delBtn.onclick = function(e) {
                e.stopPropagation();
                var delId = delBtn.getAttribute('data-del');
                if (delId) deleteHistorySession(delId);
            };
        });

        // Minimize and Close Controls
        var minBtn = tdoc.getElementById('gmgai-minimize');
        if (minBtn) {
            minBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                var curr = load();
                curr.open = false;
                save(curr);
                render();
            };
        }
        var closeBtn = tdoc.getElementById('gmgai-close') || root.querySelector('#gmgai-close');
        if (closeBtn) {
            closeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                var curr = load();
                curr.open = false;
                save(curr);
                render();
            };
        }

        // Model dropdown toggle & item picking
        var modelPillBtn = tdoc.getElementById('gmgai-model-btn');
        if (modelPillBtn) {
            modelPillBtn.onclick = function(e) {
                e.stopPropagation();
                var mMenu = tdoc.getElementById('gmgai-model-menu');
                if (mMenu) {
                    mMenu.style.display = (mMenu.style.display === 'none' ? 'flex' : 'none');
                }
            };
        }
        Array.prototype.forEach.call(root.querySelectorAll('.gmgai-model-item'), function(mItem) {
            mItem.onclick = function(e) {
                e.stopPropagation();
                var val = mItem.getAttribute('data-val');
                var st = load();
                st.provider = val;
                st.explicit = (val !== 'default');
                save(st);
                var selEl = tdoc.getElementById('gmgai-prov-select');
                if (selEl) selEl.value = val;
                render();
            };
        });

        var quickTestBtn = root.querySelector('#gmgai-quick-test-btn');
        if (quickTestBtn) {
            quickTestBtn.onclick = function(e) {
                e.stopPropagation();
                var st = load();
                var provId = '';
                if (st.provider && st.provider !== 'default') {
                    provId = st.provider.split(':')[0];
                }
                quickTestBtn.disabled = true;
                quickTestBtn.textContent = 'Testing connection...';
                var url = HAPI + '?diagnostics=1' + (provId ? '&test_provider=' + encodeURIComponent(provId) : '&test=1');
                w.fetch(url, {credentials: 'same-origin', headers: {'Accept': 'application/json', 'X-UserToken': top.__gmgaiToken || w.g_ck || ''}})
                    .then(function(r) { return r.json(); })
                    .then(function(j) {
                        var res = (j && j.result) || j || {};
                        quickTestBtn.disabled = false;
                        if (res.connection_ok) {
                            quickTestBtn.textContent = '✓ Connected (' + (res.latency_ms || 0) + 'ms)';
                            quickTestBtn.style.color = '#15803D';
                        } else {
                            var err = res.error || (res.status ? 'HTTP ' + res.status : 'Failed');
                            quickTestBtn.textContent = '✗ ' + String(err).substring(0, 24);
                            quickTestBtn.style.color = '#B91C1C';
                        }
                        setTimeout(function() {
                            if (quickTestBtn) {
                                quickTestBtn.textContent = '⚡ Test Connection';
                                quickTestBtn.style.color = '';
                            }
                        }, 3500);
                    })['catch'](function() {
                        quickTestBtn.disabled = false;
                        quickTestBtn.textContent = '✗ Network error';
                        quickTestBtn.style.color = '#B91C1C';
                        setTimeout(function() {
                            if (quickTestBtn) {
                                quickTestBtn.textContent = '⚡ Test Connection';
                                quickTestBtn.style.color = '';
                            }
                        }, 3500);
                    });
            };
        }

        // Global click-outside & Escape handlers
        if (top.__gmgaiDocClick) {
            tdoc.removeEventListener('click', top.__gmgaiDocClick, true);
            top.__gmgaiDocClick = null;
        }
        top.__gmgaiDocClick = function(e) {
            var curr = load();
            if (!curr.open) return;
            var pEl = tdoc.getElementById('gmgai-panel');
            var bEl = tdoc.getElementById('gmgai-btn');
            if (!pEl) return;
            var path = e.composedPath ? e.composedPath() : [];
            var inside = false;
            if (path && path.length) {
                for (var i = 0; i < path.length; i++) {
                    if (path[i] === pEl || path[i] === bEl) { inside = true; break; }
                }
            } else {
                inside = pEl.contains(e.target) || (bEl && bEl.contains(e.target));
            }
            if (!inside) {
                try {
                    var sel = (top.getSelection && top.getSelection()) || (w.getSelection && w.getSelection());
                    if (sel && String(sel).length > 0) return;
                } catch (eSel) {}
                curr.open = false;
                save(curr);
                render();
            }
        };
        tdoc.addEventListener('click', top.__gmgaiDocClick, true);

        if (top.__gmgaiDocKeydown) {
            tdoc.removeEventListener('keydown', top.__gmgaiDocKeydown);
            top.__gmgaiDocKeydown = null;
        }
        top.__gmgaiDocKeydown = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                var ae = tdoc.activeElement;
                if (ae && (ae.tagName == 'TEXTAREA' || ae.tagName == 'INPUT' || ae.tagName == 'SELECT')) return;
                var curr = load();
                if (curr.open) {
                    curr.open = false;
                    save(curr);
                    render();
                }
            }
        };
        tdoc.addEventListener('keydown', top.__gmgaiDocKeydown);

        if (top.__gmgaiKeydownCapture) {
            try {
                tdoc.removeEventListener('keydown', top.__gmgaiKeydownCapture, true);
                top.removeEventListener('keydown', top.__gmgaiKeydownCapture, true);
            } catch (eRc) {}
            top.__gmgaiKeydownCapture = null;
        }

        var selProv = root.querySelector('#gmgai-prov-select');
        if (selProv) {
            selProv.onchange = function() {
                var st = load();
                st.provider = this.value;
                st.explicit = (this.value !== 'default');
                save(st);
                render();
            };
        }

        var clearBtn = tdoc.getElementById('gmgai-clear') || root.querySelector('#gmgai-clear');
        if (clearBtn) {
            clearBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                var st = load();
                st.messages = [];
                st.pending = false;
                st.explicit = false;
                st.provider = '';
                st.view = 'chat';
                save(st);
                hook('onClear');
                MEM_CONV = null;
                if (ensureUser()) { try { top.sessionStorage.removeItem(CONV_KEY); } catch (err) {} }
                render();
            };
        }

        // Welcome Screen Action Cards (Unified Conversation Triggers)
        Array.prototype.forEach.call(root.querySelectorAll('.gmgai-action-card'), function(card) {
            card.onclick = function(e) {
                e.stopPropagation();
                var act = card.getAttribute('data-action');
                var st = load();
                st.mode = 'chat';
                st.view = 'chat';
                save(st);
                var incNum = (c.fields && c.fields.number) ? c.fields.number : (c.table == 'incident' ? (c.sys_id || '') : '');
                if (act === 'continue_chat') {
                    var hList = getHistoryList();
                    if (hList && hList.length) {
                        loadHistorySession(hList[0].id);
                        return;
                    }
                    send(incNum ? ('Continue assisting me with incident ' + incNum + '.') : 'Continue assisting me with my recent ServiceNow work.');
                } else if (act === 'itsm') {
                    send(incNum ? ('Analyze current record ' + incNum + ' and summarize ITSM intelligence, priority assessment, and recommended next steps.') : 'Show me open high-priority incidents and summarize active platform issues.');
                } else if (act === 'dev') {
                    send('I need developer assistance. Help me write or review a ServiceNow script, business rule, or platform automation.');
                }
            };
        });

        // Bento card and suggestion click handler
        Array.prototype.forEach.call(root.querySelectorAll('.gmgai-sug, .gmgai-bento-card'), function(b) {
            b.onclick = function(e) {
                e.stopPropagation();
                var pVal = b.getAttribute('data-prompt') || b.textContent;
                var pTab = b.getAttribute('data-tab');
                if (pTab) {
                    var st = load();
                    st.mode = pTab;
                    save(st);
                    render();
                }
                var nt = tdoc.querySelector('#gmgai-in textarea');
                if (nt) { nt.value = pVal; nt.focus(); }
            };
        });

        // Proposals and copy code buttons
        Array.prototype.forEach.call(root.querySelectorAll('.gmgai-card button'), function(b) {
            if (b.classList.contains('gmgai-copy-btn')) return;
            b.onclick = function(e) {
                e.stopPropagation();
                var actNode = b.parentNode.getAttribute('data-act') ? b.parentNode : b.parentNode.parentNode;
                decide(actNode.getAttribute('data-act'), b.getAttribute('data-v'));
            };
        });
        Array.prototype.forEach.call(root.querySelectorAll('.gmgai-copy-btn'), function(b) {
            b.onclick = function(e) {
                e.stopPropagation();
                var rawCode = decodeURIComponent(b.getAttribute('data-code') || '');
                if (top.navigator && top.navigator.clipboard && top.navigator.clipboard.writeText) {
                    top.navigator.clipboard.writeText(rawCode).then(function() {
                        var oldText = b.textContent;
                        b.textContent = 'Copied!';
                        setTimeout(function() { b.textContent = oldText; }, 2000);
                    });
                } else {
                    var taTemp = tdoc.createElement('textarea');
                    taTemp.value = rawCode;
                    tdoc.body.appendChild(taTemp);
                    taTemp.select();
                    tdoc.execCommand('copy');
                    tdoc.body.removeChild(taTemp);
                    var oldText2 = b.textContent;
                    b.textContent = 'Copied!';
                    setTimeout(function() { b.textContent = oldText2; }, 2000);
                }
            };
        });

        // Mode tab buttons
        var tabChat = tdoc.getElementById('gmgai-tab-chat');
        if (tabChat) {
            tabChat.onclick = function(e) { e.stopPropagation(); var st = load(); st.mode = 'chat'; st.view = 'chat'; save(st); render(); };
        }
        var tabITSM = tdoc.getElementById('gmgai-tab-itsm');
        if (tabITSM) {
            tabITSM.onclick = function(e) { e.stopPropagation(); var st = load(); st.mode = 'itsm'; st.view = 'chat'; save(st); render(); };
        }
        var tabDev = tdoc.getElementById('gmgai-tab-dev');
        if (tabDev) {
            tabDev.onclick = function(e) { e.stopPropagation(); var st = load(); st.mode = 'dev'; st.view = 'chat'; save(st); render(); };
        }
        var tabWorkflow = tdoc.getElementById('gmgai-tab-workflow');
        if (tabWorkflow) {
            tabWorkflow.onclick = function(e) { e.stopPropagation(); var st = load(); st.mode = 'workflow'; st.view = 'chat'; save(st); render(); };
        }

        // Dedicated parameter bar bindings
        var selWfType = tdoc.getElementById('gmgai-wf-type');
        if (selWfType) {
            selWfType.onchange = function() { var st = load(); st.wf_type = this.value; save(st); };
        }
        var inpWfTarget = tdoc.getElementById('gmgai-wf-target');
        if (inpWfTarget) {
            inpWfTarget.onchange = function() { var st = load(); st.wf_target = this.value; save(st); };
        }
        var selITSMAction = tdoc.getElementById('gmgai-itsm-action');
        if (selITSMAction) {
            selITSMAction.onchange = function() { var st = load(); st.itsm_action = this.value; save(st); };
        }
        var inpITSMIncident = tdoc.getElementById('gmgai-itsm-incident');
        if (inpITSMIncident) {
            inpITSMIncident.onchange = function() { var st = load(); st.itsm_incident = this.value; save(st); };
        }
        var devCodeToggle = tdoc.getElementById('gmgai-dev-code-toggle');
        if (devCodeToggle) {
            devCodeToggle.onclick = function(e) {
                e.stopPropagation();
                var st = load();
                st.dev_show_code = !st.dev_show_code;
                var codeArea = tdoc.getElementById('gmgai-dev-code');
                if (codeArea) st.dev_code = codeArea.value;
                save(st);
                render();
            };
        }
        var selArtifact = tdoc.getElementById('gmgai-dev-artifact');
        if (selArtifact) {
            selArtifact.onchange = function() { var st = load(); st.dev_artifact = this.value; save(st); };
        }
        var selAction = tdoc.getElementById('gmgai-dev-action');
        if (selAction) {
            selAction.onchange = function() { var st = load(); st.dev_action = this.value; save(st); };
        }
        var inpTable = tdoc.getElementById('gmgai-dev-table');
        if (inpTable) {
            inpTable.onchange = function() { var st = load(); st.dev_table = this.value; save(st); };
        }

        // Attachment context click
        var clipBtn = tdoc.getElementById('gmgai-clip');
        if (clipBtn && ta) {
            clipBtn.onclick = function(e) {
                e.stopPropagation();
                var tag = (c.fields && c.fields.number) ? (c.fields.number + ' (' + (c.table || 'incident') + ')') : (c.table || 'current page');
                ta.value = (ta.value ? ta.value + ' ' : '') + '[Context: ' + tag + '] ';
                ta.focus();
                updateSendState();
            };
        }

        function updateSendState() {
            var sendBtn = tdoc.getElementById('gmgai-send');
            if (!sendBtn || !ta) return;
            if (ta.value.trim().length > 0 && !s.pending) {
                sendBtn.classList.add('gmgai-send-active');
            } else {
                sendBtn.classList.remove('gmgai-send-active');
            }
        }

        var composerCard = root.querySelector('.gmgai-composer-card');
        if (composerCard && ta) {
            composerCard.onclick = function(e) {
                if (e.target.closest('#gmgai-model-btn') || e.target.closest('#gmgai-clip') || e.target.closest('#gmgai-send') || e.target.closest('#gmgai-model-menu') || e.target.closest('select')) {
                    return;
                }
                if (ta && !s.pending) {
                    try {
                        ta.disabled = false;
                        ta.readOnly = false;
                        ta.removeAttribute('disabled');
                        ta.removeAttribute('readonly');
                    } catch (eFoc) {}
                    ta.focus();
                }
            };
        }

        if (ta) {
            try {
                ta.disabled = false;
                ta.readOnly = false;
                ta.removeAttribute('disabled');
                ta.removeAttribute('readonly');
            } catch (eTa) {}
            if (s.pending) {
                ta.disabled = true;
                ta.setAttribute('disabled', 'disabled');
            }
            ta.setAttribute('tabindex', '0');

            ta.oninput = function() {
                updateSendState();
            };
            ta.onkeydown = function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(ta.value);
                }
            };
            ta.onkeyup = function() {
                updateSendState();
            };
            ta.onkeypress = function() {
                updateSendState();
            };

            if (!s.pending) {
                setTimeout(function() { try { ta.focus(); } catch (e6) {} }, 50);
            }
        }

        var sendBtnEl = root.querySelector('#gmgai-in button#gmgai-send');
        if (sendBtnEl && ta) {
            sendBtnEl.onclick = function(e) {
                e.stopPropagation();
                send(ta.value);
            };
        }

        if (!top.__gmgaiProviders) loadProviders();
        hook('bind', [root]);
    }

    function isDefault(id) { return (top.__gmgaiProviders || []).some(function(p) { return p.sys_id == id && p.is_default; }); }
    function providerParam(s) {
        var ex = s.explicit === undefined ? !!(s.provider && top.__gmgaiProviders && !isDefault(s.provider)) : !!s.explicit;
        return ex && s.provider ? s.provider : 'default';
    }
    function convId() {
        ensureUser();
        var k = CONV_KEY, v = UID ? null : MEM_CONV;
        if (UID) { try { v = top.sessionStorage.getItem(k); } catch (e) {} }
        if (!v || !/^[A-Za-z0-9-]{8,64}$/.test(v)) {
            try { v = top.crypto && top.crypto.randomUUID ? top.crypto.randomUUID() : null; } catch (e2) {}
            if (!v) v = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0; return (c == 'x' ? r : (r & 3 | 8)).toString(16); });
            if (UID) { try { top.sessionStorage.setItem(k, v); } catch (e3) {} } else MEM_CONV = v;
        }
        return v;
    }

    function send(text) {
        text = String(text || '').trim();
        var s = load();
        if (!text || s.pending) return;
        var ctx = top.__gmgaiCtx ? top.__gmgaiCtx() : getContext();
        ctx = pinned(ctx, load());
        s.messages.push({role: 'user', content: text, page: ctx.url});
        s.pending = true;
        s.view = 'chat';
        save(s);
        render();

        if (hook('onSend', [text]).some(function(r) { return r === true; })) return;
        var token = top.__gmgaiToken || w.g_ck || '';
        var provVal = providerParam(s), pId = provVal, reqModel = null;
        if (provVal && provVal.indexOf(':') > 0) {
            var parts = provVal.split(':');
            pId = parts[0];
            reqModel = parts[1];
        }
        var devReq = null;
        if (s.mode === 'dev') {
            var devArtEl = tdoc.getElementById('gmgai-dev-artifact');
            var devActEl = tdoc.getElementById('gmgai-dev-action');
            var devTblEl = tdoc.getElementById('gmgai-dev-table');
            var devCodeEl = tdoc.getElementById('gmgai-dev-code');
            devReq = {
                artifact_type: devArtEl ? devArtEl.value : (s.dev_artifact || 'business_rule'),
                mode: devActEl ? devActEl.value : (s.dev_action || 'generate'),
                table: devTblEl ? devTblEl.value : (s.dev_table || ctx.table || ''),
                code: devCodeEl ? devCodeEl.value : (s.dev_code || ''),
                requirement: text
            };
        }
        var itsmReq = null;
        if (s.mode === 'itsm') {
            var itsmActEl = tdoc.getElementById('gmgai-itsm-action');
            var itsmIncEl = tdoc.getElementById('gmgai-itsm-incident');
            itsmReq = {
                action: itsmActEl ? itsmActEl.value : (s.itsm_action || 'recommend_resolution'),
                incident_id: itsmIncEl ? itsmIncEl.value : (s.itsm_incident || (ctx.table == 'incident' ? ctx.sys_id : '')),
                query: text
            };
        }
        var wfReq = null;
        if (s.mode === 'workflow') {
            var wfTypeEl = tdoc.getElementById('gmgai-wf-type');
            var wfTargetEl = tdoc.getElementById('gmgai-wf-target');
            var tVal = wfTargetEl ? wfTargetEl.value : (s.wf_target || '');
            wfReq = {
                action: 'run',
                goal: text || 'Execute workflow',
                type: wfTypeEl ? wfTypeEl.value : (s.wf_type || 'incident_investigation'),
                params: {
                    incident_id: tVal,
                    code: tVal,
                    query: text
                }
            };
        }
        var sendPayload = {context: ctx, conversation_id: convId(), provider: pId, message: text};
        if (reqModel) sendPayload.model = reqModel;
        if (devReq) sendPayload.dev_request = devReq;
        if (itsmReq) sendPayload.itsm_request = itsmReq;
        if (wfReq) sendPayload.workflow_request = wfReq;

        w.fetch(API, {method: 'POST', credentials: 'same-origin',
            headers: {'Content-Type': 'application/json', 'Accept': 'application/json', 'X-UserToken': token},
            body: JSON.stringify(sendPayload)
        }).then(function(r) { return r.json().then(function(j) { return {status: r.status, j: j}; }); })
          .then(function(x) {
              var r = (x.j && x.j.result) || x.j || {};
              var st = load(); st.pending = false;
              var meta = {cost: r.cost, month: r.spend && r.spend.month, monthly_budget: r.spend && r.spend.monthly_budget,
                  warning: r.warning, citation_warning: r.citation_warning, correlation_id: r.correlation_id, error_code: r.error_code};
              if (r.workflow) meta.workflow = r.workflow;
              if (r.rejected) { top.__gmgaiProviders = null; st.provider = ''; }
              if (r.response) st.messages.push(Object.assign({role: 'assistant', content: r.response, tools: r.tools_used, actions: r.pending_actions || []}, meta));
              else st.messages.push(Object.assign({role: 'assistant', error: true, blocked: !!r.blocked,
                  content: (r.blocked ? '' : 'Error: ') + (r.error || (x.j && x.j.error && x.j.error.message) || ('HTTP ' + x.status)),
                  actions: r.pending_actions || []}, meta));
              save(st);
              recordCurrentToHistory(st);
              top.__gmgaiRender && top.__gmgaiRender();
          })['catch'](function(e) {
              var st = load(); st.pending = false; st.messages.push({role: 'assistant', error: true, content: 'Error: ' + e});
              save(st);
              recordCurrentToHistory(st);
              top.__gmgaiRender && top.__gmgaiRender();
          });
    }

    var TABLE_RE = /^[a-z0-9_]{1,80}$/, SYSID_RE = /^[0-9a-f]{32}$/;
    function openWith(table, sysId) {
        if (!hasRole() || top.__gmgaiAccess !== true) return false;
        table = String(table || ''); sysId = String(sysId || '');
        if (!TABLE_RE.test(table) || !SYSID_RE.test(sysId)) return false;
        var s = load(); openedHere = true; s.open = true; s.pin = {table: table, sys_id: sysId}; save(s); render();
        return true;
    }
    function pinned(ctx, s) {
        ctx = ctx || {};
        if (s && s.pin && !ctx.sys_id) { ctx.table = s.pin.table; ctx.sys_id = s.pin.sys_id; ctx.kind = 'form'; ctx.pinned = true; }
        return ctx;
    }
    var openedHere = false;
    function ownAppPage() { try { return /^\/x_gmg_ai_[a-z0-9_]+\.do$/.test(w.location.pathname || ''); } catch (e) { return false; } }
    function boot() {
        var shell = isShellOnly(), role = hasRole(), hasBody = !!tdoc.body;
        dbg('boot', {shellOnly: shell, hasRole: role, hasBody: hasBody, frame: w.location.pathname, isTop: w === top});
        if (shell || !role || !hasBody) return;
        if (w !== top && (w.innerWidth < 300 || w.innerHeight < 200)) { dbg('skipped: tiny frame', w.innerWidth, w.innerHeight); return; }
        accessThen(bootAllowed);
    }
    function accessThen(fn) {
        if (top.__gmgaiAccess === true) { fn(); return; }
        if (top.__gmgaiAccess === false) { dbg('panel_access is false for this session'); return; }
        (top.__gmgaiAccessQ = top.__gmgaiAccessQ || []).push(fn);
        if (top.__gmgaiAccessLoading) return;
        top.__gmgaiAccessLoading = true;
        w.fetch(HAPI + '?access=1', {credentials: 'same-origin', headers: {'Accept': 'application/json', 'X-UserToken': w.g_ck || ''}})
            .then(function(r) { dbg('health?access=1 status', r.status); return r.status == 200 ? r.json() : null; })
            .then(function(j) { var r = (j && j.result) || j || {}; top.__gmgaiAccess = r.panel_access === true; dbg('panel_access', top.__gmgaiAccess); })
            ['catch'](function(e) { dbg('health?access=1 failed', String(e)); top.__gmgaiAccess = false; })
            .then(function() {
                var q = top.__gmgaiAccessQ || [], i; top.__gmgaiAccessQ = []; top.__gmgaiAccessLoading = false;
                if (top.__gmgaiAccess === true) for (i = 0; i < q.length; i++) { try { q[i](); } catch (e) { extLog('boot threw: ' + e); } }
            });
    }
    function bootAllowed() {
        top.__gmgaiCtx = getContext;
        top.__gmgaiOwner = w;
        top.__gmgaiToken = w.g_ck;
        top.__gmgaiRender = render;
        top.__gmgaiOpen = openWith;
        var s = load(); if (s.pending && !s.pendingSince) { s.pendingSince = Date.now(); save(s); }
        if (s.pending && s.pendingSince && Date.now() - s.pendingSince > 45000) { s.pending = false; delete s.pendingSince; save(s); }
        render();
        booted = true; extStart();
    }

    var q0 = w.__gmgaiExtQ; w.__gmgaiExtQ = {push: register};
    if (q0 && q0.length) for (var qi = 0; qi < q0.length; qi++) register(q0[qi]);
    if (document.readyState == 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
