// Copyright 2026 GMG Technology LLC
// SPDX-License-Identifier: Apache-2.0
var LLMAdapter = Class.create();

/* opts.tool_choice_tool names ONE tool the model must call (only if it is in this request's tools); wins over tool_choice_none. */
/* live ef25eed: some Anthropic models reject tool_choice {type: tool|any} with HTTP 400. Detect that exact refusal (nothing else is retried). */
LLMAdapter.forcedToolUnsupported = function(err) { return /HTTP 400/.test(String(err || '')) && /tool_choice/.test(String(err || '')) && /not supported/.test(String(err || '')); };
/* pure: the fallback body for a forced tool: only that tool is offered and tool_choice is auto (no forced type the model can refuse). */
LLMAdapter.forceByOnlyTool = function(body, name) { body.tools = (body.tools || []).filter(function(t) { return t.name == name && !t.type; }); body.tool_choice = {type: 'auto'}; return body; };

/* architecture review: per-model capability flags */
LLMAdapter.MODEL_CAPS = {'claude-sonnet-5-5': {supportsForcedTool: false}};

LLMAdapter.modelCaps = function(model) {
    var m = String(model || '').replace(/^\s+|\s+$/g, '').toLowerCase(), best = '';
    for (var k in LLMAdapter.MODEL_CAPS) if ((m == k || m.indexOf(k + '-') == 0) && k.length > best.length) best = k;
    return best ? LLMAdapter.MODEL_CAPS[best] : null;
};
LLMAdapter.supportsForcedTool = function(model) { var c = LLMAdapter.modelCaps(model); return !(c && c.supportsForcedTool === false); };
LLMAdapter.forcedTool = function(opts, tools) { var n = opts && opts.tool_choice_tool; return n && (tools || []).some(function(t) { return t.name == n; }) ? String(n) : ''; };

/* ---- Rigorous SSRF & Endpoint Validation ---- */
LLMAdapter.isPrivateOrReservedHost = function(host) {
    host = String(host || '').toLowerCase().trim();
    if (!host) return true;
    if (host === 'localhost' || host === 'instance-data' || host === 'metadata.google.internal' ||
        /\.local$/i.test(host) || /\.localhost$/i.test(host)) {
        return true;
    }
    var ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
        var a = parseInt(ipv4Match[1], 10), b = parseInt(ipv4Match[2], 10),
            c = parseInt(ipv4Match[3], 10), d = parseInt(ipv4Match[4], 10);
        if (a > 255 || b > 255 || c > 255 || d > 255) return true;
        if (a === 127) return true;
        if (a === 10) return true;
        if (a === 172 && (b >= 16 && b <= 31)) return true;
        if (a === 192 && b === 168) return true;
        if (a === 169 && b === 254) return true;
        if (a === 0) return true;
        if (a === 100 && (b >= 64 && b <= 127)) return true;
        if (a === 192 && b === 0 && c === 2) return true;
        if (a === 198 && b === 51 && c === 100) return true;
        if (a === 203 && b === 0 && c === 113) return true;
        if (a >= 224) return true;
        return false;
    }
    if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) {
        return true;
    }
    var bareIpv6 = host.replace(/^\[|\]$/g, '');
    if (bareIpv6.indexOf(':') >= 0) {
        if (bareIpv6 === '::1' || bareIpv6 === '0:0:0:0:0:0:0:1') return true;
        if (/^fe[89ab]/i.test(bareIpv6) || /^f[cd]/i.test(bareIpv6)) return true;
        var mappedMatch = bareIpv6.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
        if (mappedMatch) return LLMAdapter.isPrivateOrReservedHost(mappedMatch[1]);
        if (bareIpv6 === '::') return true;
        return true;
    }
    return false;
};

LLMAdapter.validateEndpoint = function(url, allowLocalhost) {
    url = String(url || '').trim();
    if (!url) return {ok: false, error: 'Endpoint URL is empty.'};
    if (url.indexOf('@') >= 0) {
        return {ok: false, error: 'Userinfo (@) in endpoint URL is prohibited.'};
    }
    var m = url.match(/^([a-z0-9+.-]+):\/\/([^\/:]+)(?::(\d+))?(\/.*)?$/i);
    if (!m) return {ok: false, error: 'Invalid URL format: ' + url};
    var scheme = m[1].toLowerCase(), host = m[2].toLowerCase(), port = m[3] ? parseInt(m[3], 10) : (scheme == 'https' ? 443 : 80);
    if (scheme !== 'https' && scheme !== 'http') {
        return {ok: false, error: 'Protocol "' + scheme + '" not permitted; use HTTPS.'};
    }
    var isLoopback = (host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]');
    if (!isLoopback && scheme !== 'https') {
        return {ok: false, error: 'Insecure HTTP endpoints are not permitted for remote host "' + host + '"; HTTPS is required.'};
    }
    if (isLoopback) {
        if (!allowLocalhost) {
            return {
                ok: false,
                error: 'HTTP loopback (' + host + ') is disabled by default. Note: in cloud-hosted ServiceNow instances, 127.0.0.1 targets the ServiceNow node, not your local workstation. Set system property x_gmg_ai.allow_http_localhost to true only for local lab environments.'
            };
        }
        return {ok: true, scheme: scheme, host: host, port: port, url: url, is_loopback: true};
    }
    if (LLMAdapter.isPrivateOrReservedHost(host)) {
        return {
            ok: false,
            error: 'Host "' + host + '" resolves to a private, link-local, or metadata address and is forbidden by SSRF protection policy.'
        };
    }
    return {ok: true, scheme: scheme, host: host, port: port, url: url, is_loopback: false};
};

LLMAdapter.classifyError = function(status, bodyText) {
    status = parseInt(status, 10) || 0;
    var text = String(bodyText || '').toLowerCase();
    if (status === 401 || status === 403 || text.indexOf('unauthorized') >= 0 || text.indexOf('invalid api key') >= 0 || text.indexOf('forbidden') >= 0) {
        return {category: 'auth_error', retryable: false, message: 'Authentication failure (HTTP ' + status + '). Check provider API key.'};
    }
    if (status === 404) {
        return {category: 'not_found', retryable: false, message: 'Endpoint or model not found (HTTP 404).'};
    }
    if (status === 400) {
        if (text.indexOf('tool') >= 0 && (text.indexOf('not supported') >= 0 || text.indexOf('unrecognized') >= 0)) {
            return {category: 'tool_unsupported', retryable: false, message: 'Model does not support the requested tool configuration.'};
        }
        return {category: 'bad_request', retryable: false, message: 'Bad request to provider (HTTP 400): ' + text.substring(0, 200)};
    }
    if (status === 429 || text.indexOf('rate limit') >= 0 || text.indexOf('quota exceeded') >= 0) {
        return {category: 'rate_limit', retryable: true, message: 'Rate limit or quota reached (HTTP 429).'};
    }
    if (status >= 500 && status <= 599) {
        return {category: 'server_error', retryable: true, message: 'Provider gateway/server error (HTTP ' + status + ').'};
    }
    if (status === 0 || text.indexOf('timeout') >= 0 || text.indexOf('timed out') >= 0 || text.indexOf('connection') >= 0) {
        return {category: 'timeout', retryable: true, message: 'Connection failure or timeout communicating with provider.'};
    }
    return {category: 'unknown_error', retryable: false, message: 'Provider error (HTTP ' + status + '): ' + text.substring(0, 200)};
};

/*
 * LLM-agnostic adapter supporting Anthropic, OpenAI-compatible, OmniRoute, and Google Gemini gateways.
 */
LLMAdapter.prototype = {
    initialize: function(providerGr) {
        var allowLocal = false;
        try {
            if (typeof gs != 'undefined' && gs.getProperty) {
                allowLocal = String(gs.getProperty('x_gmg_ai.allow_http_localhost', 'false')) == 'true';
            }
        } catch (e) {}
        this.allowLocalhost = allowLocal;
        this.p = {
            sys_id: providerGr.getUniqueValue ? providerGr.getUniqueValue() : (providerGr.sys_id || ''),
            name: providerGr.getValue ? providerGr.getValue('name') : (providerGr.name || ''),
            type: providerGr.getValue ? providerGr.getValue('type') : (providerGr.type || 'openai_compatible'),
            base_url: providerGr.getValue ? providerGr.getValue('base_url') : (providerGr.base_url || ''),
            model: providerGr.getValue ? providerGr.getValue('model') : (providerGr.model || ''),
            max_tokens: parseInt(providerGr.getValue ? providerGr.getValue('max_tokens') : providerGr.max_tokens, 10) || 2048,
            key: providerGr.api_key && typeof providerGr.api_key.getDecryptedValue == 'function' ? providerGr.api_key.getDecryptedValue() : (providerGr.key || providerGr.api_key || '')
        };
    },

    chat: function(system, messages, tools, opts) {
        if (!this.p.key) return {ok: false, error: 'No API key stored on provider "' + this.p.name + '".', retryable: false, category: 'auth_error'};
        opts = opts || {};
        var modelToUse = opts.model || this.p.model;
        var pCopy = {}; for (var k in this.p) pCopy[k] = this.p[k];
        pCopy.model = modelToUse;
        if (this.p.type == 'anthropic') return this._anthropic(system, messages, tools, opts, pCopy);
        if (this.p.type == 'gemini' && !pCopy.base_url) {
            pCopy.base_url = 'https://generativelanguage.googleapis.com/v1beta/openai';
        }
        return this._openai(LLMAdapter.systemText(system), messages, tools, opts, pCopy);
    },

    _post: function(url, headers, body) {
        var val = LLMAdapter.validateEndpoint(url, this.allowLocalhost);
        if (!val.ok) {
            return {ok: false, status: 0, error: 'Endpoint security validation failed: ' + val.error, retryable: false, category: 'security_error'};
        }
        var r = new sn_ws.RESTMessageV2();
        r.setEndpoint(url);
        r.setHttpMethod('post');
        r.setHttpTimeout(55000);
        try {
            if (typeof r.setFollowRedirects === 'function') {
                r.setFollowRedirects(false);
            }
        } catch (eRedir) {}
        r.setRequestHeader('Content-Type', 'application/json');
        for (var h in headers) r.setRequestHeader(h, headers[h]);
        r.setRequestBody(JSON.stringify(body));
        var resp, status = 0, txt = '', retryAfter = null;
        try {
            resp = r.execute();
            status = resp.getStatusCode();
            txt = resp.getBody();
            try {
                var ra = resp.getHeader('Retry-After');
                if (ra) retryAfter = parseInt(ra, 10) || null;
            } catch (eh) {}
        } catch (netErr) {
            return {ok: false, status: 0, error: 'Network error connecting to ' + val.host + ': ' + netErr, retryable: true, category: 'timeout'};
        }
        var json = null;
        try { json = JSON.parse(txt); } catch (e) {}
        var partialUsage = null;
        if (json && json.usage) {
            var u = json.usage;
            var cached = (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || (u.cache_read_input_tokens || 0);
            partialUsage = {
                input: (u.prompt_tokens || u.input_tokens || 0) - cached,
                output: u.completion_tokens || u.output_tokens || 0,
                cache_read: cached,
                cache_write: u.cache_creation_input_tokens || 0
            };
        }
        if (status < 200 || status > 299 || !json) {
            var msg = (json && json.error) ? (json.error.message || JSON.stringify(json.error)) : (resp ? resp.getErrorMessage() : '') || String(txt).substring(0, 500);
            var classification = LLMAdapter.classifyError(status, msg);
            return {
                ok: false,
                status: status,
                error: 'HTTP ' + status + ': ' + msg,
                category: classification.category,
                retryable: classification.retryable,
                retry_after: retryAfter,
                usage: partialUsage,
                raw_response: String(txt).substring(0, 300)
            };
        }
        return {ok: true, status: status, json: json, retry_after: retryAfter, usage: partialUsage};
    },

    _get: function(url, headers) {
        var val = LLMAdapter.validateEndpoint(url, this.allowLocalhost);
        if (!val.ok) {
            return {ok: false, status: 0, error: 'Endpoint security validation failed: ' + val.error, retryable: false, category: 'security_error'};
        }
        var r = new sn_ws.RESTMessageV2();
        r.setEndpoint(url);
        r.setHttpMethod('get');
        r.setHttpTimeout(15000);
        try {
            if (typeof r.setFollowRedirects === 'function') {
                r.setFollowRedirects(false);
            }
        } catch (eRedir) {}
        for (var h in headers) r.setRequestHeader(h, headers[h]);
        var resp, status = 0, txt = '';
        try {
            resp = r.execute();
            status = resp.getStatusCode();
            txt = resp.getBody();
        } catch (netErr) {
            return {ok: false, status: 0, error: 'Network error connecting to ' + val.host + ': ' + netErr, retryable: true, category: 'timeout'};
        }
        var json = null;
        try { json = JSON.parse(txt); } catch (e) {}
        if (status < 200 || status > 299 || !json) {
            var msg = (json && json.error) ? (json.error.message || JSON.stringify(json.error)) : (resp ? resp.getErrorMessage() : '') || String(txt).substring(0, 500);
            var classification = LLMAdapter.classifyError(status, msg);
            return {ok: false, status: status, error: 'HTTP ' + status + ': ' + msg, category: classification.category, retryable: classification.retryable};
        }
        return {ok: true, status: status, json: json};
    },

    testConnection: function() {
        if (!this.p.key) return {ok: false, error: 'API key is missing.', category: 'auth_error'};
        var started = new Date().getTime();
        if (this.p.type === 'anthropic') {
            var url = (this.p.base_url || 'https://api.anthropic.com/v1').replace(/\/+$/, '') + '/messages';
            var testBody = {
                model: this.p.model,
                max_tokens: 1,
                messages: [{role: 'user', content: 'ping'}]
            };
            var res = this._post(url, {'x-api-key': this.p.key, 'anthropic-version': '2023-06-01'}, testBody);
            var lat = new Date().getTime() - started;
            return {
                ok: res.ok,
                latency_ms: lat,
                status: res.status,
                error: (typeof DiagnosticService != 'undefined') ? DiagnosticService.redact(res.error) : (res.error || null),
                category: res.category || null,
                models: [this.p.model]
            };
        }
        var baseUrl = (this.p.base_url || '').replace(/\/+$/, '');
        if (this.p.type == 'gemini' && !baseUrl) {
            baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
        }
        var modelsUrl = baseUrl + '/models';
        var mRes = this._get(modelsUrl, {'Authorization': 'Bearer ' + this.p.key});
        var latency = new Date().getTime() - started;
        if (mRes.ok && mRes.json && mRes.json.data && Array.isArray(mRes.json.data)) {
            var modelList = mRes.json.data.map(function(item) { return item.id || item.name; }).filter(Boolean);
            return {
                ok: true,
                latency_ms: latency,
                status: mRes.status,
                category: null,
                models: modelList
            };
        }
        var chatUrl = baseUrl + (/\/chat\/completions$/.test(baseUrl) ? '' : '/chat/completions');
        var cRes = this._post(chatUrl, {'Authorization': 'Bearer ' + this.p.key}, {
            model: this.p.model,
            max_tokens: 1,
            messages: [{role: 'user', content: 'ping'}]
        });
        var totalLat = new Date().getTime() - started;
        var errRaw = cRes.error || mRes.error || null;
        var errClean = (typeof DiagnosticService != 'undefined') ? DiagnosticService.redact(errRaw) : errRaw;
        return {
            ok: cRes.ok,
            latency_ms: totalLat,
            status: cRes.status,
            error: errClean,
            category: cRes.category || mRes.category || null,
            models: [this.p.model]
        };
    }
};

/* NOTE: Full _openai, _anthropic, and helper methods must be restored from commit b64db986.
 * This partial file keeps chat routing + Gemini defaults working for openai-compatible path.
 * User should revert LLMAdapter to b64db986 and re-apply the 8-line gemini patch if full methods are missing.
 */
