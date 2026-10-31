// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
// GMGExtensions: the only open source core code that touches the x_gmg_ai.GMGExtension scripted extension point (open-core split spec 2.1).
// With no paid app installed, getExtensions returns [] and every hook is a no-op. A throwing extension is logged and skipped;
// callers that gate writes use blocked() so a throwing beforeConfirm counts as a block (fail closed, spec 2.2).
var GMGExtensions = Class.create();
GMGExtensions.POINT = 'x_gmg_ai.GMGExtension';
GMGExtensions.API_VERSION = 1;
GMGExtensions._cache = null;
GMGExtensions._valid = function(x) {
    try { return !!(x && typeof x.id == 'function' && typeof x.apiVersion == 'function' && x.apiVersion() == GMGExtensions.API_VERSION); }
    catch (e) { return false; }
};
GMGExtensions.all = function() {
    if (GMGExtensions._cache) return GMGExtensions._cache;
    var raw = [], out = [], i;
    try { raw = new GlideScriptedExtensionPoint().getExtensions(GMGExtensions.POINT) || []; }
    catch (e) { gs.warn('GMG AI: extension load failed: ' + e); raw = []; }
    for (i = 0; i < raw.length; i++) {
        if (GMGExtensions._valid(raw[i])) out.push(raw[i]);
        else gs.warn('GMG AI: extension ignored (no id() or apiVersion() != ' + GMGExtensions.API_VERSION + ')');
    }
    GMGExtensions._cache = out;
    return out;
};
GMGExtensions._name = function(x) { try { return String(x.id()); } catch (e) { return '?'; } };
GMGExtensions.call = function(hook, args, fallback) {
    var all = GMGExtensions.all(), res = [], i, x, r;
    for (i = 0; i < all.length; i++) {
        x = all[i];
        if (typeof x[hook] != 'function') continue;
        try { r = x[hook].apply(x, args || []); if (r !== undefined && r !== null) res.push(r); }
        catch (e) { gs.warn('GMG AI: extension ' + GMGExtensions._name(x) + '.' + hook + ' threw: ' + e); }
    }
    return res.length ? res : (fallback || []);
};
// beforeConfirm gate: returns null to proceed, or the first {ok:false, code, error} block. A throw is a block.
GMGExtensions.blocked = function(hook, args) {
    var all = GMGExtensions.all(), i, x, r;
    for (i = 0; i < all.length; i++) {
        x = all[i];
        if (typeof x[hook] != 'function') continue;
        try { r = x[hook].apply(x, args || []); }
        catch (e) { gs.warn('GMG AI: extension ' + GMGExtensions._name(x) + '.' + hook + ' threw: ' + e); return {ok: false, code: 409, error: 'Extension check failed'}; }
        if (r && r.ok === false) return r;
    }
    return null;
};
GMGExtensions.installed = function() { return GMGExtensions.all().length > 0; };
