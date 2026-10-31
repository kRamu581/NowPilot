// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
var GMGAIApplier = Class.create();
/* Public facade (global, access public, client_callable=false). It holds ONLY the entry points that x_gmg_ai and global callers use
 * (grep src for global.GMGAIApplier.X) and forwards each to global.GMGAIApplierCore, which is "This application scope only" so other scopes
 * cannot reach it. Core methods call each other inside Core. */
GMGAIApplier.CALLER_SCOPE = GMGAIApplierCore.CALLER_SCOPE;
// (2) every entry point reads gs.getCallerScopeName() in its OWN body (a nested read reports 'rhino.global'), runs Core's _callerOk, then forwards.
GMGAIApplier.REFUSED = function(name) { var m = 'GMGAIApplier.' + name + ' may only be called by the GMG AI Agent'; return {ok: false, error: m, reason: m}; };
// static entry points
GMGAIApplier.userAccess = function() { var caller = gs.getCallerScopeName(); if (!GMGAIApplierCore._callerOk(false, caller)) return GMGAIApplier.REFUSED('userAccess'); return GMGAIApplierCore._userAccess.apply(GMGAIApplierCore, arguments); };   // x_gmg_ai only
GMGAIApplier.validateRecordWrite = function() { var caller = gs.getCallerScopeName(); if (!GMGAIApplierCore._callerOk(true, caller)) return GMGAIApplier.REFUSED('validateRecordWrite'); return GMGAIApplierCore.validateRecordWrite.apply(GMGAIApplierCore, arguments); };
GMGAIApplier.validateFieldWrite = function() { var caller = gs.getCallerScopeName(); if (!GMGAIApplierCore._callerOk(true, caller)) return GMGAIApplier.REFUSED('validateFieldWrite'); return GMGAIApplierCore.validateFieldWrite.apply(GMGAIApplierCore, arguments); };   // step 6
GMGAIApplier.activeNote = function(s) { return GMGAIApplierCore.activeNote(s); };   // step 8, pure text
GMGAIApplier.deniedTable = function() { var caller = gs.getCallerScopeName(); if (!GMGAIApplierCore._callerOk(true, caller)) return 'refused'; return GMGAIApplierCore.deniedTable.apply(GMGAIApplierCore, arguments); };   // step 6, fails closed
GMGAIApplier.updateSetNameFor = function() { var caller = gs.getCallerScopeName(); if (!GMGAIApplierCore._callerOk(false, caller)) return GMGAIApplier.REFUSED('updateSetNameFor'); return GMGAIApplierCore.updateSetNameFor.apply(GMGAIApplierCore, arguments); };   // RecordTools card preview (x_gmg_ai only); Core's static builder, the same one Accept uses
GMGAIApplier.prototype = {
    initialize: function() {},
    // instance entry points: ActionService (apply) and validateScript (script syntax check)
    apply: function(actionId) { var caller = gs.getCallerScopeName(); if (!GMGAIApplierCore._callerOk(true, caller)) return GMGAIApplier.REFUSED('apply'); var c = new GMGAIApplierCore(); return c.apply(actionId); },
    validateScript: function(script) { var caller = gs.getCallerScopeName(); if (!GMGAIApplierCore._callerOk(true, caller)) return GMGAIApplier.REFUSED('validateScript'); return new GMGAIApplierCore().validateScript(script); },
    type: 'GMGAIApplier'
};
