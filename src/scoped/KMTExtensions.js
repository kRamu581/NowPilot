// Copyright 2026 KMT Technology LLC
// SPDX-License-Identifier: Apache-2.0
// KMTExtensions: the only open source core code that touches the x_kmt_ai.KMTExtension scripted extension point (open-core split spec 2.1).
// With no paid app installed, getExtensions returns [] and every hook is a no-op. A throwing extension is logged and skipped;
// callers that gate writes use blocked() so a throwing beforeConfirm counts as a block (fail closed, spec 2.2).
var KMTExtensions = Class.create();
KMTExtensions.POINT = 'x_kmt_ai.KMTExtension';
KMTExtensions.API_VERSION = 1;
KMTExtensions._cache = null;
KMTExtensions._valid = function(x) {
    try { return !!(x && typeof x.id == 'function' && typeof x.apiVersion == 'function' && x.apiVersion() == KMTExtensions.API_VERSION); }
    catch (e) { return false; }
};
KMTExtensions.all = function() {
    if (KMTExtensions._cache) return KMTExtensions._cache;
    var raw = [], out = [], i;
    try { raw = new GlideScriptedExtensionPoint().getExtensions(KMTExtensions.POINT) || []; }
    catch (e) { gs.warn('KMT AI: extension load failed: ' + e); raw = []; }
    for (i = 0; i < raw.length; i++) {
        if (KMTExtensions._valid(raw[i])) out.push(raw[i]);
        else gs.warn('KMT AI: extension ignored (no id() or apiVersion() != ' + KMTExtensions.API_VERSION + ')');
    }
    KMTExtensions._cache = out;
    return out;
};
KMTExtensions._name = function(x) { try { return String(x.id()); } catch (e) { return '?'; } };
KMTExtensions.call = function(hook, args, fallback) {
    var all = KMTExtensions.all(), res = [], i, x, r;
    for (i = 0; i < all.length; i++) {
        x = all[i];
        if (typeof x[hook] != 'function') continue;
        try { r = x[hook].apply(x, args || []); if (r !== undefined && r !== null) res.push(r); }
        catch (e) { gs.warn('KMT AI: extension ' + KMTExtensions._name(x) + '.' + hook + ' threw: ' + e); }
    }
    return res.length ? res : (fallback || []);
};
// beforeConfirm gate: returns null to proceed, or the first {ok:false, code, error} block. A throw is a block.
KMTExtensions.blocked = function(hook, args) {
    var all = KMTExtensions.all(), i, x, r;
    for (i = 0; i < all.length; i++) {
        x = all[i];
        if (typeof x[hook] != 'function') continue;
        try { r = x[hook].apply(x, args || []); }
        catch (e) { gs.warn('KMT AI: extension ' + KMTExtensions._name(x) + '.' + hook + ' threw: ' + e); return {ok: false, code: 409, error: 'Extension check failed'}; }
        if (r && r.ok === false) return r;
    }
    return null;
};
KMTExtensions.installed = function() { return KMTExtensions.all().length > 0; };
