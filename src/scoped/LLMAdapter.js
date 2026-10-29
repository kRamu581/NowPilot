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

    // Disallow hostnames known for metadata or local resolutions
    if (host === 'localhost' || host === 'instance-data' || host === 'metadata.google.internal' ||
        /\.local$/i.test(host) || /\.localhost$/i.test(host)) {
        return true;
    }

    // Check for IPv4 literal (standard dotted decimal)
    var ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
        var a = parseInt(ipv4Match[1], 10), b = parseInt(ipv4Match[2], 10),
            c = parseInt(ipv4Match[3], 10), d = parseInt(ipv4Match[4], 10);
        if (a > 255 || b > 255 || c > 255 || d > 255) return true; // malformed octet
        // 127.0.0.0/8 (Loopback)
        if (a === 127) return true;
        // 10.0.0.0/8 (Private)
        if (a === 10) return true;
        // 172.16.0.0/12 (Private)
        if (a === 172 && (b >= 16 && b <= 31)) return true;
        // 192.168.0.0/16 (Private)
        if (a === 192 && b === 168) return true;
        // 169.254.0.0/16 (Link-local / Cloud Metadata)
        if (a === 169 && b === 254) return true;
        // 0.0.0.0/8, 100.64.0.0/10 (Carrier-grade NAT), 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
        if (a === 0) return true;
        if (a === 100 && (b >= 64 && b <= 127)) return true;
        if (a === 192 && b === 0 && c === 2) return true;
        if (a === 198 && b === 51 && c === 100) return true;
        if (a === 203 && b === 0 && c === 113) return true;
        // 224.0.0.0/4 (Multicast), 240.0.0.0/4 (Reserved)
        if (a >= 224) return true;
        return false;
    }

    // Disallow ambiguous non-dotted numeric IP representations (e.g. integer, octal, hex 2130706433, 0x7f.1)
    if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) {
        return true;
    }

    // Check for IPv6 literal (enclosed in brackets or bare)
    var bareIpv6 = host.replace(/^\[|\]$/g, '');
    if (bareIpv6.indexOf(':') >= 0) {
        // ::1 (Loopback)
        if (bareIpv6 === '::1' || bareIpv6 === '0:0:0:0:0:0:0:1') return true;
        // fe80::/10 (Link-local), fc00::/7 (Unique local)
        if (/^fe[89ab]/i.test(bareIpv6) || /^f[cd]/i.test(bareIpv6)) return true;
        // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:10.x.x.x etc.)
        var mappedMatch = bareIpv6.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
        if (mappedMatch) return LLMAdapter.isPrivateOrReservedHost(mappedMatch[1]);
        // Disallow unspecified ::
        if (bareIpv6 === '::') return true;
        return true; // Conservative fail-closed for direct IPv6 literals unless configured via domain
    }

    return false;
};

LLMAdapter.validateEndpoint = function(url, allowLocalhost) {
    url = String(url || '').trim();
    if (!url) return {ok: false, error: 'Endpoint URL is empty.'};

    // Prevent URL parser confusion / userinfo tricks (e.g. https://attacker.com@internal.host/)
    if (url.indexOf('@') >= 0) {
        return {ok: false, error: 'Userinfo (@) in endpoint URL is prohibited.'};
    }

    var m = url.match(/^([a-z0-9+.-]+):\/\/([^\/:]+)(?::(\d+))?(\/.*)?$/i);
    if (!m) return {ok: false, error: 'Invalid URL format: ' + url};
    var scheme = m[1].toLowerCase(), host = m[2].toLowerCase(), port = m[3] ? parseInt(m[3], 10) : (scheme == 'https' ? 443 : 80);

    if (scheme !== 'https' && scheme !== 'http') {
        return {ok: false, error: 'Protocol "' + scheme + '" not permitted; use HTTPS.'};
    }

    // Check loopback specifically
    var isLoopback = (host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]');

    // Remote hosts MUST be HTTPS
    if (!isLoopback && scheme !== 'https') {
        return {ok: false, error: 'Insecure HTTP endpoints are not permitted for remote host "' + host + '"; HTTPS is required.'};
    }

    // If loopback, only allow if explicit property is true
    if (isLoopback) {
        if (!allowLocalhost) {
            return {
                ok: false,
                error: 'HTTP loopback (' + host + ') is disabled by default. Note: in cloud-hosted ServiceNow instances, 127.0.0.1 targets the ServiceNow node, not your local workstation. Set system property x_gmg_ai.allow_http_localhost to true only for local lab environments.'
            };
        }
        return {ok: true, scheme: scheme, host: host, port: port, url: url, is_loopback: true};
    }

    // For all non-loopback endpoints, verify host is not private, link-local, or cloud metadata
    if (LLMAdapter.isPrivateOrReservedHost(host)) {
        return {
            ok: false,
            error: 'Host "' + host + '" resolves to a private, link-local, or metadata address and is forbidden by SSRF protection policy.'
        };
    }

    return {ok: true, scheme: scheme, host: host, port: port, url: url, is_loopback: false};
};

/* ---- Error Classification ---- */
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
        /* gemini: first-class type — defaults to Google OpenAI-compatible endpoint */
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

        // Security: prevent redirect-based SSRF
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

        // Check for partial usage even in error / 429 responses
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
    },

    _openai: function(system, messages, tools, opts, pCfg) {
        pCfg = pCfg || this.p;
        var cleanSystem = LLMAdapter.systemText(system);
        var msgs = [{role: 'system', content: cleanSystem}];
        messages.forEach(function(m) {
            if (m.role == 'tool') {
                msgs.push({role: 'tool', tool_call_id: m.tool_call_id, content: LLMAdapter.sanitizeOutboundText(m.content)});
            } else if (m.role == 'assistant' && m.tool_calls && m.tool_calls.length) {
                msgs.push({role: 'assistant', content: LLMAdapter.sanitizeOutboundText(m.content || ''), tool_calls: m.tool_calls.map(function(t) {
                    return {id: t.id, type: 'function', 'function': {name: t.name, arguments: JSON.stringify(t.arguments || {})}};
                })});
            } else {
                msgs.push({role: m.role, content: LLMAdapter.sanitizeOutboundText(m.content)});
            }
        });
        if (opts && opts.final_note) msgs.push({role: 'user', content: LLMAdapter.sanitizeOutboundText(opts.final_note)});
        var body = {model: pCfg.model, messages: msgs, max_tokens: pCfg.max_tokens};
        if (tools && tools.length) {
            body.tools = tools.map(function(t) {
                return {type: 'function', 'function': {name: t.name, description: t.description, parameters: t.parameters}};
            });
            body.tool_choice = (opts && opts.tool_choice_none) ? 'none' : 'auto';
            var ft = LLMAdapter.forcedTool(opts, tools);
            if (ft) body.tool_choice = {type: 'function', 'function': {name: ft}};
        }
        var url = (pCfg.base_url || '').replace(/\/+$/, '');
        if (!/\/chat\/completions$/.test(url)) url += '/chat/completions';
        
        var res = this._post(url, {'Authorization': 'Bearer ' + pCfg.key}, body);
        if (!res.ok) return res;

        var ci = {tools_hash: LLMAdapter.hash(JSON.stringify(body.tools || [])), system_hash: LLMAdapter.hash(system), tool_choice: body.tool_choice || 'auto', web_search: false, breakpoints: 0};
        var choice = (res.json.choices || [])[0] || {};
        var m = choice.message || {};
        var calls = (m.tool_calls || []).map(function(tc) {
            var args = {};
            try { args = JSON.parse(tc['function'].arguments || '{}'); } catch (e) {}
            return {id: tc.id, name: tc['function'].name, arguments: args};
        });
        var usage = res.usage || {};
        if (res.json.usage) {
            var u = res.json.usage;
            var cached = (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0;
            usage = {
                input: (u.prompt_tokens || 0) - cached,
                output: u.completion_tokens || 0,
                cache_read: cached,
                cache_write: 0
            };
        }
        return {
            ok: true,
            text: m.content || '',
            tool_calls: calls,
            usage: usage,
            finish_reason: choice.finish_reason || '',
            cache_info: ci,
            model: pCfg.model,
            provider_type: pCfg.type || 'openai_compatible'
        };
    },

    supportsWebSearch: function() { return this.p.type == 'anthropic'; },

    _anthropic: function(system, messages, tools, opts, pCfg) {
        pCfg = pCfg || this.p;
        opts = opts || {};
        var body = {
            model: pCfg.model,
            max_tokens: pCfg.max_tokens,
            messages: []
        };
        var msgs = [];
        messages.forEach(function(m) {
            if (m.role == 'tool') {
                msgs.push({role: 'user', content: [{type: 'tool_result', tool_use_id: m.tool_call_id, content: LLMAdapter.sanitizeOutboundText(m.content)}]});
            } else if (m.role == 'assistant' && m.tool_calls && m.tool_calls.length) {
                var content = [];
                if (m.content) content.push({type: 'text', text: LLMAdapter.sanitizeOutboundText(m.content)});
                m.tool_calls.forEach(function(t) {
                    content.push({type: 'tool_use', id: t.id, name: t.name, input: t.arguments || {}});
                });
                msgs.push({role: 'assistant', content: content});
            } else {
                msgs.push({role: m.role == 'assistant' ? 'assistant' : 'user', content: LLMAdapter.sanitizeOutboundText(m.content)});
            }
        });
        if (opts.final_note) msgs.push({role: 'user', content: LLMAdapter.sanitizeOutboundText(opts.final_note)});
        body.messages = msgs;
        if (tools && tools.length) {
            body.tools = tools.map(function(t) {
                return {name: t.name, description: t.description, input_schema: t.parameters};
            });
            body.tool_choice = (opts && opts.tool_choice_none) ? {type: 'none'} : {type: 'auto'};
            var ftA = LLMAdapter.forcedTool(opts, tools);
            if (ftA && LLMAdapter.supportsForcedTool(pCfg.model)) {
                body.tool_choice = {type: 'tool', name: ftA};
            }
        }
        var ci = LLMAdapter.applyCache(body, system, String(gs.getProperty('x_gmg_ai.llm.prompt_cache', 'true')) != 'false');
        if (ftA && body.tools && body.tool_choice && body.tool_choice.type == 'auto') ci.tool_choice = 'auto_only_' + ftA;
        var url = (pCfg.base_url || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
        if (!/\/messages$/.test(url)) url += '/messages';
        var hdr = {'x-api-key': pCfg.key, 'anthropic-version': '2023-06-01'};
        var usage = {input: 0, output: 0, cache_read: 0, cache_write: 0, web_search: 0}, raw = [], res, loops = 0, stop = '';
        var resent = false, requests = 0;
        var add = function(r) { var u = (r && r.json && r.json.usage) || (r && r.usage) || {}; usage.input += u.input_tokens || u.input || 0; usage.output += u.output_tokens || u.output || 0;
            usage.cache_read += u.cache_read_input_tokens || u.cache_read || 0; usage.cache_write += u.cache_creation_input_tokens || u.cache_write || 0; };

        while (true) {
            res = this._post(url, hdr, body); requests++;
            if (!res.ok && ftA && !resent && body.tool_choice && body.tool_choice.type == 'tool' && LLMAdapter.forcedToolUnsupported(res.error)) {
                resent = true; add(res); LLMAdapter.forceByOnlyTool(body, ftA); ci.tool_choice = 'auto_only_' + ftA; res = this._post(url, hdr, body); requests++;
            }
            if (!res.ok) { add(res); res.usage = usage; res.requests = requests; res.resent = resent; if (ftA) res.forced_miss = true; return res; }
            var u = res.json.usage || {};
            usage.input += u.input_tokens || 0; usage.output += u.output_tokens || 0;
            usage.cache_read += u.cache_read_input_tokens || 0; usage.cache_write += u.cache_creation_input_tokens || 0;
            usage.web_search += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
            raw = raw.concat(res.json.content || []); stop = res.json.stop_reason || '';
            if (res.json.stop_reason != 'pause_turn' || ++loops > 3) break;
            body.messages = msgs.concat([{role: 'assistant', content: raw}]);
        }
        var text = [], calls = [];
        raw.forEach(function(b) {
            if (b.type == 'text') text.push(b.text);
            if (b.type == 'tool_use') calls.push({id: b.id, name: b.name, arguments: b.input || {}});
        });
        return {
            ok: true,
            text: text.join(''),
            tool_calls: calls,
            usage: usage,
            finish_reason: stop,
            cache_info: ci,
            model: pCfg.model,
            provider_type: 'anthropic',
            requests: requests,
            resent: resent
        };
    }
};

/* ---- Static helpers (hash, sanitize, systemText, cache) ---- */
LLMAdapter.hash = function(s) {
    s = String(s || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h = h & h; }
    return (h >>> 0).toString(16);
};

LLMAdapter.sanitizeOutboundText = function(t) {
    t = String(t == null ? '' : t);
    if (typeof DiagnosticService != 'undefined' && DiagnosticService.redact) {
        try { return DiagnosticService.redact(t); } catch (e) {}
    }
    return t;
};

LLMAdapter.systemText = function(system) {
    if (system && typeof system == 'object') {
        return String(system['static'] || '') + (system.dynamic ? ('\n' + system.dynamic) : '');
    }
    return String(system || '');
};

LLMAdapter.CACHEABLE = {text: 1, tool_use: 1};
LLMAdapter.LOOKBACK = 4;
LLMAdapter.MAX_BREAKPOINTS = 4;

LLMAdapter._markLast = function(m) {
    if (typeof m.content == 'string') { m.content = [{type: 'text', text: m.content}]; }
    if (!Array.isArray(m.content) || !m.content.length) return false;
    m.content = m.content.slice();
    for (var i = m.content.length - 1; i >= 0; i--) {
        var b = m.content[i];
        if (b && LLMAdapter.CACHEABLE[b.type]) {
            var c = {}; for (var k in b) c[k] = b[k];
            c.cache_control = {type: 'ephemeral'}; m.content[i] = c; return true;
        }
    }
    return false;
};

LLMAdapter._blocks = function(m) { return Array.isArray(m.content) ? m.content.length : (m.content ? 1 : 0); };

LLMAdapter.applyCache = function(body, system, enabled) {
    var st = (system && typeof system == 'object') ? String(system['static'] || '') : String(system || '');
    var dy = (system && typeof system == 'object') ? String(system.dynamic || '') : '';
    var ci = {tools_hash: LLMAdapter.hash(JSON.stringify(body.tools || [])), system_hash: LLMAdapter.hash(st),
        tool_choice: body.tool_choice ? body.tool_choice.type : 'auto', web_search: (body.tools || []).some(function(t) { return t.type && t.type.indexOf('web_search') == 0; }), breakpoints: 0, cached: !!enabled};
    if (!enabled) return ci;
    var n = 0;
    if (body.tools && body.tools.length) {
        body.tools = body.tools.slice(); var lt = {}, src = body.tools[body.tools.length - 1];
        for (var k in src) lt[k] = src[k]; lt.cache_control = {type: 'ephemeral'}; body.tools[body.tools.length - 1] = lt; n++;
    }
    var sys = [{type: 'text', text: st, cache_control: {type: 'ephemeral'}}]; n++;
    if (dy) sys.push({type: 'text', text: dy});
    body.system = sys;
    var ms = body.messages = (body.messages || []).map(function(m) { var c = {}; for (var k2 in m) c[k2] = m[k2]; return c; });
    if (ms.length && LLMAdapter._markLast(ms[ms.length - 1])) n++;
    if (!ms.length) { ci.breakpoints = n; ci.blocks_since_turn_start = 0; return ci; }
    var start = ms.length - 1;
    while (start > 0 && !(ms[start].role == 'user' && (typeof ms[start].content == 'string' || !(ms[start].content[0] && ms[start].content[0].type == 'tool_result')))) start--;
    var since = 0; for (var i = start; i < ms.length; i++) since += LLMAdapter._blocks(ms[i]);
    if (since > LLMAdapter.LOOKBACK && n < LLMAdapter.MAX_BREAKPOINTS) {
        for (var j = ms.length - 2; j > start; j--) if (ms[j].role == 'assistant') { if (LLMAdapter._markLast(ms[j])) { n++; ci.fourth = j; } break; }
    }
    ci.breakpoints = n; ci.blocks_since_turn_start = since;
    return ci;
};
