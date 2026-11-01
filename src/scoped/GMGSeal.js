// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
var GMGSeal = Class.create();
/* Open source core (open-core split step 5, approver 2026-10-18): the proposal tamper seal. Moved verbatim from ReviewerTools (scoped copy of
 * GMGAIApplierCore's CARD_OPTION_KEYS / reviewCanon / reviewHash / REVIEW_GATE / reviewGate; bodies must stay identical). Paid ReviewerTools
 * aliases these. routeGate() is the core Confirm gate: route 'none' -> insert-time seal must match; route 'reviewer' -> only with GMG Plan &
 * Create installed (its beforeConfirm checks the verdict), else 409; empty/unknown route -> refused. */
/* architecture review gate, scoped copy (the Reviewer never calls the Applier). MUST stay identical to GMGAIApplierCore's
 * CARD_OPTION_KEYS / reviewCanon / reviewHash / REVIEW_GATE / reviewGate (test_review_gate_store checks the bodies match). Used by
 * get_proposal (hash what was read), ActionService.confirm (refuse before any write) and BuildItemService (Accept / Not passed). */
GMGSeal.CARD_OPTION_KEYS = [['spec', 'update_set'], ['spec', 'update_set_auto'], ['spec', 'activate']];
/* architecture review ruling (c): the canonical hash covers EVERY field the Applier reads to decide what it writes: run_as, target_table,
 * target_sys_id, operation, action_type, target_updated_on, summary, diff, current_script and the payload (card options above excluded). Keys are sorted recursively, so key order alone is
 * not an edit. r: a reviewInput object ({payload, action_type, operation, target_table, target_sys_id}) or a bare payload string. */
GMGSeal.REVIEW_HASH_FIELDS = ['action_type', 'operation', 'target_table', 'target_sys_id', 'target_updated_on', 'summary', 'diff', 'current_script'];   // approver (4): what the card SHOWS (summary, diff, current_script) is hashed too; older stored hashes mismatch -> fail closed   // target_updated_on: the Applier's stale-target check reads it
GMGSeal.BOUND_FIELDS = ['bound_table', 'bound_sys_id'];   // open-core split step 7: sealed when present (a current-record proposal)
GMGSeal.sortDeep = function(v) {
    if (Object.prototype.toString.call(v) == '[object Array]') return v.map(GMGSeal.sortDeep);
    if (v && typeof v == 'object') { var o = {}; Object.keys(v).sort().forEach(function(k) { o[k] = GMGSeal.sortDeep(v[k]); }); return o; }
    return v;
};
GMGSeal.reviewInput = function(pa) {
    var o = {payload: String(pa.getValue('payload') || '')};
    GMGSeal.REVIEW_HASH_FIELDS.forEach(function(f) { o[f] = pa.isValidField(f) ? String(pa.getValue(f) || '') : ''; });
    GMGSeal.BOUND_FIELDS.forEach(function(f) { if (pa.isValidField(f) && pa.getValue(f)) o[f] = String(pa.getValue(f)); });   // step 7
    return o;
};
GMGSeal.reviewCanon = function(r, fields) {
    if (r === null || typeof r != 'object') r = {payload: r};
    var raw = String(r.payload == null ? '' : r.payload), p = null; try { p = JSON.parse(raw); } catch (e) { p = null; }
    var obj = !!(p && typeof p == 'object');
    if (obj) GMGSeal.CARD_OPTION_KEYS.forEach(function(k) { var o = p; for (var i = 0; i < k.length - 1; i++) o = o && typeof o == 'object' ? o[k[i]] : null; if (o && typeof o == 'object') delete o[k[k.length - 1]]; });
    var out = {payload: obj ? p : raw, run_as: obj && p.run_as != null ? String(p.run_as) : ''};
    (fields || GMGSeal.REVIEW_HASH_FIELDS).forEach(function(f) { out[f] = String(r[f] == null ? '' : r[f]); });
    GMGSeal.BOUND_FIELDS.forEach(function(f) { if (r[f]) out[f] = String(r[f]); });   // step 7: the binding is sealed too (only when set, so unbound rows keep their hash)
    return JSON.stringify(GMGSeal.sortDeep(out));
};
GMGSeal.reviewHash = function(r, fields) { return String(new GlideDigest().getSHA256Hex(GMGSeal.reviewCanon(r, fields))).toLowerCase(); };
/* Design review: a stored hash in the OLD canon (before summary, diff, current_script were hashed) that still matches the card = out of date,
 * not edited. Still refused (409); only the message differs. Any other mismatch stays 'edited'. */
GMGSeal.REVIEW_GATE = {not_passed: 'The review didn\u2019t pass this change, so it can\u2019t be applied.', edited: 'This change was edited after the Reviewer passed it, so the pass no longer counts. Ask for a new review.', stale: 'This card is out of date and can\u2019t be accepted. Ask for the change again to get a fresh card.'};
/* r: {review_route, review_state, review_verdict, review_hash, payload} -> '' (may apply) or the refusal. Ruling (3), fail closed:
 * only review_route 'none' (set at creation for a proposal never routed to the Reviewer) skips the review; 'reviewer' needs a stored
 * pass on the same payload; an empty or unknown route is refused. Never inferred from build being empty. */
GMGSeal.gateInput = function(pa) {   // the gate's input read off a pending-action GlideRecord: review fields + everything the hash covers
    var o = GMGSeal.reviewInput(pa);
    ['review_route', 'review_state', 'review_verdict', 'review_hash'].forEach(function(f) { o[f] = pa.isValidField(f) ? String(pa.getValue(f) || '') : ''; });
    return o;
};
GMGSeal.reviewGate = function(r) {
    var miss = function() { return String(r.review_hash || '') == GMGSeal.reviewHash(r, GMGSeal.REVIEW_HASH_FIELDS.filter(function(f) { return ['summary', 'diff', 'current_script'].indexOf(f) < 0; })) ? GMGSeal.REVIEW_GATE.stale : GMGSeal.REVIEW_GATE.edited; };   // Design review: old-canon hash that still matches = out of date, not edited (still refused)
    if (!r) return GMGSeal.REVIEW_GATE.not_passed;
    var route = String(r.review_route || '');
    if (route == 'none') return !r.review_hash ? GMGSeal.REVIEW_GATE.edited : String(r.review_hash) != GMGSeal.reviewHash(r) ? miss() : '';   // architecture review (B): route-none cards carry the server's insert-time hash; any content change -> refused (fails closed when missing)
    if (route != 'reviewer') return GMGSeal.REVIEW_GATE.not_passed;
    if (String(r.review_verdict || '') != 'pass' || String(r.review_state || '') != 'passed') return GMGSeal.REVIEW_GATE.not_passed;
    if (!r.review_hash) return GMGSeal.REVIEW_GATE.edited;
    if (String(r.review_hash) != GMGSeal.reviewHash(r)) return miss();
    return '';
};
GMGSeal.hashOf = function(r) { try { return GMGSeal.reviewHash(r); } catch (e) { return ''; } };
GMGSeal.REVIEW_NEEDS_PAID = 'This change needs a Reviewer pass, which needs GMG Plan & Create. Nothing was applied.';
GMGSeal.routeGate = function(r, paidInstalled) {
    if (!r) return GMGSeal.REVIEW_GATE.not_passed;
    if (String(r.review_route || '') == 'reviewer') return paidInstalled ? '' : GMGSeal.REVIEW_NEEDS_PAID;   // paid beforeConfirm runs GMGSeal.reviewGate (verdict + hash)
    return GMGSeal.reviewGate(r);
};
/* the route-none seal above is an unkeyed SHA-256 stored on the pending-action row, so anyone who
 * can write that row can change the payload/target and recompute the hash. The server therefore ALSO keeps the hash in a row only the server
 * writes: an x_gmg_ai_log row (status 'sealed', pending_action, seal_hash), inserted by server code (plain GlideRecord) right after the card is
 * inserted. x_gmg_ai.user cannot create, write or delete x_gmg_ai_log or x_gmg_ai_pending_action (admin-only ACLs). Accept
 * (ActionService.notPassedBlock) requires: recomputed hash of the stored row == review_hash == the newest server seal. Missing, ambiguous or
 * unreadable seal -> refused (fail closed). No key to generate, store, rotate or leak into an update set. */
GMGSeal.SEAL_TABLE = 'x_gmg_ai_log';
GMGSeal.SEAL_STATUS = 'sealed';
GMGSeal.SEAL_NOTE = 'Proposal sealed by the server; Accept checks the card against this hash.';
GMGSeal.storeSeal = function(pa) {   // server path only; returns the seal row sys_id or ''
    var h = String(pa.getValue('review_hash') || ''), id = String(pa.getUniqueValue() || '');
    if (!h || !id) return '';
    var l = new GlideRecord(GMGSeal.SEAL_TABLE);
    l.initialize();
    l.setValue('user', gs.getUserID()); l.setValue('pending_action', id); l.setValue('status', GMGSeal.SEAL_STATUS); l.setValue('seal_hash', h);
    l.setValue('table_name', String(pa.getValue('target_table') || '')); l.setValue('record_sys_id', String(pa.getValue('target_sys_id') || ''));
    l.setValue('response', GMGSeal.SEAL_NOTE);
    return String(l.insert() || '');
};
/* newest server seal of one pending action ('' = none, or two newest rows in the same second disagree) */
GMGSeal.serverSeal = function(id) {
    if (!id) return '';
    var g = new GlideRecord(GMGSeal.SEAL_TABLE);
    g.addQuery('pending_action', id); g.addQuery('status', GMGSeal.SEAL_STATUS); g.orderByDesc('sys_created_on'); g.setLimit(2); g.query();
    if (!g.next()) return '';
    var h = String(g.getValue('seal_hash') || ''), on = String(g.getValue('sys_created_on') || '');
    if (g.next() && String(g.getValue('sys_created_on') || '') == on && String(g.getValue('seal_hash') || '') != h) return '';
    return h;
};
/* '' = the stored row matches the server seal (or the card is not route none: the Reviewer route is GMG Plan & Create's), else the refusal */
GMGSeal.serverSealGate = function(pa) {
    if (String(pa.getValue('review_route') || '') != 'none') return '';
    var h = String(pa.getValue('review_hash') || ''), s = '';
    try { s = GMGSeal.serverSeal(String(pa.getUniqueValue() || '')); } catch (e) { s = ''; }
    return h && s === h ? '' : GMGSeal.REVIEW_GATE.edited;
};
/* insert-time seal for a route-none proposal (every route-none insert uses it) */
GMGSeal.sealRouteNone = function(pa) {
    if (typeof pa.isValidField != 'function' || !pa.isValidField('review_route') || !pa.isValidField('review_hash') || String(pa.getValue('review_route')) != 'none') return;
    pa.setValue('review_hash', GMGSeal.reviewHash(GMGSeal.reviewInput(pa)));
};
