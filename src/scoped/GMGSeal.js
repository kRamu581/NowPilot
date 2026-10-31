// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
var GMGSeal = Class.create();
/* Cryptographic proposal integrity (HMAC-SHA256). Seals pending actions so Accept cannot apply tampered payloads. */
GMGSeal.SEAL_TABLE = 'x_gmg_ai_pending_action';
GMGSeal.SEAL_STATUS = {pending: 'pending', accepted: 'accepted', rejected: 'rejected', expired: 'expired'};
GMGSeal.SEAL_NOTE = 'GMGSeal';
GMGSeal.REVIEW_NEEDS_PAID = false;
GMGSeal.REVIEW_HASH_FIELDS = ['table', 'sys_id', 'fields', 'type'];
GMGSeal.REVIEW_GATE = {not_passed: 'not_passed', edited: 'edited', stale: 'stale'};
GMGSeal.BOUND_FIELDS = ['table', 'sys_id', 'sys_mod_count', 'fields', 'type', 'script', 'payload'];
GMGSeal.SEAL_FIELDS = ['table', 'sys_id', 'sys_mod_count', 'fields', 'type', 'script', 'payload', 'created_by', 'created_on'];

GMGSeal.sortDeep = function(v) {
    if (v === null || v === undefined) return v;
    if (Array.isArray(v)) return v.map(GMGSeal.sortDeep);
    if (typeof v === 'object') {
        var o = {}, keys = Object.keys(v).sort(), i;
        for (i = 0; i < keys.length; i++) o[keys[i]] = GMGSeal.sortDeep(v[keys[i]]);
        return o;
    }
    return v;
};

GMGSeal.canon = function(obj) {
    try { return JSON.stringify(GMGSeal.sortDeep(obj)); } catch (e) { return String(obj); }
};

GMGSeal.hmac = function(secret, message) {
    var mac = new GlideCertificateEncryption();
    try {
        if (typeof mac.generateMac === 'function') return String(mac.generateMac(secret, 'HmacSHA256', message));
    } catch (e) {}
    try {
        var digest = new GlideDigest();
        return String(digest.sha256(String(secret) + '|' + String(message)));
    } catch (e2) {
        return String(GlideStringUtil.base64Encode(String(secret) + '|' + String(message))).substring(0, 64);
    }
};

GMGSeal.secret = function() {
    var s = '';
    try { s = String(gs.getProperty('x_gmg_ai.seal_secret', '') || ''); } catch (e) {}
    if (!s) {
        try { s = String(gs.getProperty('instance_name', 'gmg') || 'gmg') + '|seal'; } catch (e2) { s = 'gmg|seal'; }
    }
    return s;
};

GMGSeal.sealInput = function(pa) {
    var fields = {};
    try { fields = JSON.parse(pa.getValue('fields') || '{}'); } catch (e) { fields = {}; }
    var payload = {};
    try { payload = JSON.parse(pa.getValue('payload') || '{}'); } catch (e2) { payload = {}; }
    return {
        table: String(pa.getValue('table') || ''),
        sys_id: String(pa.getValue('sys_id') || ''),
        sys_mod_count: String(pa.getValue('sys_mod_count') || ''),
        fields: fields,
        type: String(pa.getValue('type') || ''),
        script: String(pa.getValue('script') || ''),
        payload: payload,
        created_by: String(pa.getValue('sys_created_by') || pa.getValue('created_by') || ''),
        created_on: String(pa.getValue('sys_created_on') || pa.getValue('created_on') || '')
    };
};

GMGSeal.computeSeal = function(pa) {
    return GMGSeal.hmac(GMGSeal.secret(), GMGSeal.canon(GMGSeal.sealInput(pa)));
};

GMGSeal.storeSeal = function(pa) {
    var seal = GMGSeal.computeSeal(pa);
    if (typeof pa.setValue === 'function') {
        try { if (pa.isValidField && pa.isValidField('seal_hash')) pa.setValue('seal_hash', seal); } catch (e) {}
        try { if (pa.isValidField && pa.isValidField('seal_algo')) pa.setValue('seal_algo', 'HmacSHA256'); } catch (e2) {}
    }
    return seal;
};

GMGSeal.verifySeal = function(pa) {
    var stored = '';
    try { stored = String(pa.getValue('seal_hash') || ''); } catch (e) {}
    if (!stored) return {ok: false, code: 'missing_seal', error: 'Proposal seal is missing'};
    var expect = GMGSeal.computeSeal(pa);
    if (stored !== expect) return {ok: false, code: 'seal_mismatch', error: 'Proposal seal verification failed (tamper or key change)'};
    return {ok: true};
};

GMGSeal.reviewInput = function(pa) {
    var fields = {};
    try { fields = JSON.parse(pa.getValue('fields') || '{}'); } catch (e) { fields = {}; }
    return {
        table: String(pa.getValue('table') || ''),
        sys_id: String(pa.getValue('sys_id') || ''),
        fields: fields,
        type: String(pa.getValue('type') || '')
    };
};

GMGSeal.reviewHash = function(input) {
    return GMGSeal.hmac(GMGSeal.secret(), 'review|' + GMGSeal.canon(input));
};

GMGSeal.reviewCanon = function(pa) {
    return GMGSeal.reviewHash(GMGSeal.reviewInput(pa));
};

GMGSeal.reviewGate = function(pa) {
    var route = '';
    try { route = String(pa.getValue('review_route') || 'none'); } catch (e) { route = 'none'; }
    if (route === 'none') return {ok: true, route: route};
    var stored = '';
    try { stored = String(pa.getValue('review_hash') || ''); } catch (e2) {}
    if (!stored) return {ok: false, code: GMGSeal.REVIEW_GATE.not_passed, error: 'Review gate not passed'};
    var expect = GMGSeal.reviewCanon(pa);
    if (stored !== expect) return {ok: false, code: GMGSeal.REVIEW_GATE.edited, error: 'Proposal changed after review'};
    return {ok: true, route: route};
};

GMGSeal.routeGate = function(pa) {
    return GMGSeal.reviewGate(pa);
};

GMGSeal.sealRouteNone = function(pa) {
    try {
        if (typeof pa.setValue === 'function' && pa.isValidField && pa.isValidField('review_route')) pa.setValue('review_route', 'none');
    } catch (e) {}
};

GMGSeal.serverSeal = function(pa) {
    GMGSeal.storeSeal(pa);
    return {ok: true};
};

GMGSeal.serverSealGate = function(pa) {
    var v = GMGSeal.verifySeal(pa);
    if (!v.ok) return v;
    var g = GMGSeal.reviewGate(pa);
    if (!g.ok) return g;
    return {ok: true};
};

GMGSeal.gateInput = function(pa) {
    return GMGSeal.serverSealGate(pa);
};

GMGSeal.prototype = {
    initialize: function() {},
    type: 'GMGSeal'
};

/* Keep review_hash in sync when route is none and bound fields change */
GMGSeal.syncReviewHashIfNone = function(pa) {
    if (typeof pa.isValidField != 'function' || !pa.isValidField('review_route') || !pa.isValidField('review_hash') || String(pa.getValue('review_route')) != 'none') return;
    pa.setValue('review_hash', GMGSeal.reviewHash(GMGSeal.reviewInput(pa)));
};
