// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
/* Global UI Script — thin dispatcher for panel Accept / Reject.
 * All logic lives in GMGAIApplierCore (global SI). This file only
 * binds window.GMGAIApplier and routes calls so the panel keeps working.
 */
(function (global) {
    'use strict';
    var Core = global.GMGAIApplierCore;
    if (!Core) {
        try { if (typeof console !== 'undefined') console.warn('[GMG AI] GMGAIApplierCore not loaded'); } catch (e) {}
        return;
    }
    global.GMGAIApplier = {
        REFUSED: Core.REFUSED,
        NOT_BOUND: Core.NOT_BOUND,
        fieldAccess: function (table, field) { return Core.fieldAccess(table, field); },
        validateFieldWrite: function (table, field, value) { return Core.validateFieldWrite(table, field, value); },
        validateRecordWrite: function (table, fields) { return Core.validateRecordWrite(table, fields); },
        userAccess: function () { return Core.userAccess(); },
        deniedTable: function (table) { return Core.deniedTable(table); },
        apply: function (payload) { return Core.apply(payload); },
        reject: function (payload) { return Core.reject(payload); }
    };
})(typeof window !== 'undefined' ? window : this);
