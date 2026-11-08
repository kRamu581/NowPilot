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

/* ---- Unified Multi-Provider Registry & Model Catalog ---- */
LLMAdapter.PROVIDERS = {
    'deepseek': {
        id: 'deepseek',
        name: 'DeepSeek',
        default_base_url: 'https://api.deepseek.com',
        default_model: 'deepseek-chat',
        type: 'openai_compatible'
    },
    'zai': {
        id: 'zai',
        name: 'Z.ai (GLM)',
        default_base_url: 'https://open.bigmodel.cn/api/paas/v4',
        default_model: 'glm-4-flash',
        type: 'openai_compatible'
    },
    'qwen': {
        id: 'qwen',
        name: 'Qwen',
        default_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        default_model: 'qwen2.5-7b-instruct',
        type: 'openai_compatible'
    },
    'google': {
        id: 'google',
        name: 'Google',
        default_base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
        default_model: 'gemini-2.0-flash',
        type: 'openai_compatible'
    },
    'openai': {
        id: 'openai',
        name: 'OpenAI',
        default_base_url: 'https://api.openai.com/v1',
        default_model: 'gpt-4o-mini',
        type: 'openai_compatible'
    },
    'meta': {
        id: 'meta',
        name: 'Meta',
        default_base_url: 'https://api.groq.com/openai/v1',
        default_model: 'meta-llama/llama-3.1-8b-instruct',
        type: 'openai_compatible'
    },
    'mistral': {
        id: 'mistral',
        name: 'Mistral',
        default_base_url: 'https://api.mistral.ai/v1',
        default_model: 'mistral-small-3.2-24b',
        type: 'openai_compatible'
    },
    'nvidia': {
        id: 'nvidia',
        name: 'NVIDIA',
        default_base_url: 'https://integrate.api.nvidia.com/v1',
        default_model: 'nvidia/nemotron-3-nano-omni-30b',
        type: 'openai_compatible'
    },
    'specialty': {
        id: 'specialty',
        name: 'Specialty / Gateway',
        default_base_url: 'https://openrouter.ai/api/v1',
        default_model: 'hunyuan-mt-7b',
        type: 'openai_compatible'
    },
    'anthropic': {
        id: 'anthropic',
        name: 'Anthropic Claude',
        default_base_url: 'https://api.anthropic.com/v1',
        default_model: 'claude-3-5-sonnet-20241022',
        type: 'anthropic'
    },
    'ollama': {
        id: 'ollama',
        name: 'Ollama (Local)',
        default_base_url: 'http://127.0.0.1:11434/v1',
        default_model: 'llama3.1:8b',
        type: 'openai_compatible'
    }
};

LLMAdapter.MODEL_CATALOG = {
    // 1. DeepSeek
    'deepseek-chat': { provider: 'deepseek', name: 'DeepSeek V4.1 Flash', capabilities: ['text', 'code', 'tools', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: true },
    'deepseek-v4.1-flash': { provider: 'deepseek', name: 'DeepSeek V4.1 Flash', capabilities: ['text', 'code', 'tools', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: true, target_id: 'deepseek-chat' },
    'deepseek-v4-flash': { provider: 'deepseek', name: 'DeepSeek V4 Flash', capabilities: ['text', 'code', 'tools', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: true, target_id: 'deepseek-chat' },
    'deepseek-reasoner': { provider: 'deepseek', name: 'DeepSeek R1 0528', capabilities: ['reasoning', 'code', 'text'], supportsVision: false, supportsReasoning: true, supportsTools: false },
    'deepseek-r1-0528': { provider: 'deepseek', name: 'DeepSeek R1 0528', capabilities: ['reasoning', 'code', 'text'], supportsVision: false, supportsReasoning: true, supportsTools: false, target_id: 'deepseek-reasoner' },
    'deepseek-ocr': { provider: 'deepseek', name: 'DeepSeek OCR', capabilities: ['vision', 'ocr', 'text'], supportsVision: true, supportsReasoning: false, supportsTools: false },

    // 2. Z.ai (GLM)
    'glm-5.3-flash': { provider: 'zai', name: 'GLM 5.3 Flash', capabilities: ['text', 'code', 'tools', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: true },
    'glm-4.7-flash': { provider: 'zai', name: 'GLM 4.7 Flash', capabilities: ['text', 'code', 'tools', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: true },
    'glm-4.5-flash': { provider: 'zai', name: 'GLM 4.5 Flash', capabilities: ['text', 'code', 'tools', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: true },
    'glm-4.1v-thinking-flash': { provider: 'zai', name: 'GLM 4.1V Thinking Flash', capabilities: ['vision', 'reasoning', 'text'], supportsVision: true, supportsReasoning: true, supportsTools: false },
    'glm-4v-flash': { provider: 'zai', name: 'GLM 4V Flash', capabilities: ['vision', 'text'], supportsVision: true, supportsReasoning: false, supportsTools: false },
    'glm-4-flash': { provider: 'zai', name: 'GLM 4 Flash', capabilities: ['text', 'code', 'fast', 'tools'], supportsVision: false, supportsReasoning: false, supportsTools: true },
    'glm-z1-flash': { provider: 'zai', name: 'GLM Z1 Flash', capabilities: ['reasoning', 'code', 'text'], supportsVision: false, supportsReasoning: true, supportsTools: false },
    'glm-4-9b': { provider: 'zai', name: 'GLM 4 9B', capabilities: ['text', 'code'], supportsVision: false, supportsReasoning: false, supportsTools: false },
    'glm-z1-9b': { provider: 'zai', name: 'GLM Z1 9B', capabilities: ['reasoning', 'text'], supportsVision: false, supportsReasoning: true, supportsTools: false },

    // 3. Qwen
    'qwen3-235b-instruct': { provider: 'qwen', name: 'Qwen3 235B Instruct', capabilities: ['text', 'code', 'tools', 'reasoning'], supportsVision: false, supportsReasoning: true, supportsTools: true },
    'qwen3-8b': { provider: 'qwen', name: 'Qwen3 8B', capabilities: ['text', 'code', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: false },
    'qwen3.5-4b': { provider: 'qwen', name: 'Qwen3.5 4B', capabilities: ['text', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: false },
    'qwen2.5-7b-instruct': { provider: 'qwen', name: 'Qwen2.5 7B Instruct', capabilities: ['text', 'code', 'tools'], supportsVision: false, supportsReasoning: false, supportsTools: true },

    // 4. Google
    'gemini-2.0-flash': { provider: 'google', name: 'Gemini 2.0 Flash', capabilities: ['text', 'code', 'vision', 'tools', 'fast'], supportsVision: true, supportsReasoning: false, supportsTools: true },
    'gemma-4-26b-a4b': { provider: 'google', name: 'Gemma 4 26B A4B', capabilities: ['text', 'code'], supportsVision: false, supportsReasoning: false, supportsTools: false },
    'gemma-4-e4b': { provider: 'google', name: 'Gemma 4 E4B', capabilities: ['text', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: false },

    // 5. OpenAI
    'gpt-oss-120b': { provider: 'openai', name: 'GPT OSS 120B', capabilities: ['text', 'code', 'tools', 'reasoning'], supportsVision: false, supportsReasoning: true, supportsTools: true },
    'gpt-4o': { provider: 'openai', name: 'GPT-4o', capabilities: ['text', 'code', 'vision', 'tools'], supportsVision: true, supportsReasoning: false, supportsTools: true },
    'gpt-4o-mini': { provider: 'openai', name: 'GPT-4o Mini', capabilities: ['text', 'code', 'fast', 'tools'], supportsVision: true, supportsReasoning: false, supportsTools: true },

    // 6. Meta
    'llama-3.1-8b': { provider: 'meta', name: 'Llama 3.1 8B', capabilities: ['text', 'code', 'tools', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: true },
    'meta-llama/llama-3.1-8b-instruct': { provider: 'meta', name: 'Llama 3.1 8B Instruct', capabilities: ['text', 'code', 'tools', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: true },
    'meta-llama/llama-3.3-70b-instruct': { provider: 'meta', name: 'Llama 3.3 70B Instruct', capabilities: ['text', 'code', 'tools'], supportsVision: false, supportsReasoning: false, supportsTools: true },

    // 7. Mistral
    'mistral-small-3.2-24b': { provider: 'mistral', name: 'Mistral Small 3.2 24B', capabilities: ['text', 'code', 'tools'], supportsVision: false, supportsReasoning: false, supportsTools: true },
    'open-mistral-nemo': { provider: 'mistral', name: 'Mistral Nemo', capabilities: ['text', 'code', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: false },

    // 8. NVIDIA
    'nvidia/nemotron-3-ultra': { provider: 'nvidia', name: 'Nemotron 3 Ultra', capabilities: ['text', 'code', 'reasoning'], supportsVision: false, supportsReasoning: true, supportsTools: false },
    'nvidia/nemotron-3-nano-omni-30b': { provider: 'nvidia', name: 'Nemotron 3 Nano Omni 30B', capabilities: ['vision', 'text', 'fast'], supportsVision: true, supportsReasoning: false, supportsTools: false },

    // 9. Additional Models
    'hunyuan-mt-7b': { provider: 'specialty', name: 'Hunyuan MT 7B', capabilities: ['translation', 'text'], supportsVision: false, supportsReasoning: false, supportsTools: false },
    'liquid/lfm-2.5-2.6b': { provider: 'specialty', name: 'LFM 2.5 2.6B', capabilities: ['text', 'fast'], supportsVision: false, supportsReasoning: false, supportsTools: false },
    'xing-4.0-29b': { provider: 'specialty', name: 'Xing 4.0 29B', capabilities: ['text', 'code'], supportsVision: false, supportsReasoning: false, supportsTools: false },

    // 10. Anthropic Claude (Native Provider)
    'claude-3-5-sonnet-20241022': { provider: 'anthropic', name: 'Claude 3.5 Sonnet', capabilities: ['text', 'code', 'vision', 'tools', 'fast'], supportsVision: true, supportsReasoning: false, supportsTools: true },
    'claude-3-5-haiku-20241022': { provider: 'anthropic', name: 'Claude 3.5 Haiku', capabilities: ['text', 'code', 'fast', 'tools'], supportsVision: true, supportsReasoning: false, supportsTools: true },
    'claude-3-opus-20240229': { provider: 'anthropic', name: 'Claude 3 Opus', capabilities: ['text', 'code', 'vision', 'tools'], supportsVision: true, supportsReasoning: false, supportsTools: true }
};

LLMAdapter.normalizeProviderId = function(typeOrName) {
    var s = String(typeOrName || '').toLowerCase().trim();
    if (s.indexOf('anthropic') >= 0 || s.indexOf('claude') >= 0) return 'anthropic';
    if (s.indexOf('deepseek') >= 0) return 'deepseek';
    if (s.indexOf('z.ai') >= 0 || s.indexOf('zai') >= 0 || s.indexOf('zhipu') >= 0 || s.indexOf('glm') >= 0) return 'zai';
    if (s.indexOf('qwen') >= 0 || s.indexOf('dashscope') >= 0 || s.indexOf('alibaba') >= 0) return 'qwen';
    if (s.indexOf('google') >= 0 || s.indexOf('gemini') >= 0 || s.indexOf('gemma') >= 0) return 'google';
    if (s.indexOf('meta') >= 0 || s.indexOf('llama') >= 0) return 'meta';
    if (s.indexOf('mistral') >= 0) return 'mistral';
    if (s.indexOf('nvidia') >= 0 || s.indexOf('nemotron') >= 0) return 'nvidia';
    if (s.indexOf('ollama') >= 0) return 'ollama';
    if (s.indexOf('hunyuan') >= 0 || s.indexOf('liquid') >= 0 || s.indexOf('xing') >= 0) return 'specialty';
    if (s === 'openai_compatible') return 'openai_compatible';
    if (s.indexOf('openai') >= 0 || s.indexOf('chatgpt') >= 0 || s.indexOf('gpt') >= 0) return 'openai';
    if (s.indexOf('specialty') >= 0 || s.indexOf('gateway') >= 0 || s.indexOf('openrouter') >= 0) return 'specialty';
    return 'openai_compatible';
};

LLMAdapter.resolveDefaultBaseUrl = function(typeOrName) {
    var pid = LLMAdapter.normalizeProviderId(typeOrName);
    var pDef = LLMAdapter.PROVIDERS[pid];
    return pDef ? pDef.default_base_url : 'https://api.openai.com/v1';
};

LLMAdapter.getModelInfo = function(modelId) {
    var m = String(modelId || '').trim();
    if (!m) return null;
    if (LLMAdapter.MODEL_CATALOG[m]) return LLMAdapter.MODEL_CATALOG[m];
    var mLower = m.toLowerCase();
    for (var k in LLMAdapter.MODEL_CATALOG) {
        if (k.toLowerCase() === mLower) return LLMAdapter.MODEL_CATALOG[k];
    }
    return null;
};

LLMAdapter.isCatalogModel = function(modelId) {
    return !!LLMAdapter.getModelInfo(modelId);
};

LLMAdapter.isModelAllowedForProvider = function(modelId, providerTypeOrName, providerDefaultModel) {
    var m = String(modelId || '').trim();
    if (!m) return false;
    if (providerDefaultModel && m === String(providerDefaultModel).trim()) return true;

    var info = LLMAdapter.getModelInfo(m);
    if (!info) return false;

    if (providerTypeOrName) {
        var pid = LLMAdapter.normalizeProviderId(providerTypeOrName);
        if (pid && pid !== 'openai_compatible') {
            return info.provider === pid;
        }
    }
    return true;
};

LLMAdapter.getModelsForProvider = function(typeOrName, provName) {
    var pid = 'openai_compatible';
    if (provName) {
        var fromName = LLMAdapter.normalizeProviderId(provName);
        if (fromName !== 'openai_compatible') pid = fromName;
    }
    if (pid === 'openai_compatible' && typeOrName) {
        pid = LLMAdapter.normalizeProviderId(typeOrName);
    }
    var out = [];
    for (var k in LLMAdapter.MODEL_CATALOG) {
        var entry = LLMAdapter.MODEL_CATALOG[k];
        if (entry.provider === pid || pid === 'openai_compatible') {
            out.push({
                id: k,
                name: entry.name,
                capabilities: entry.capabilities.slice(),
                supportsVision: !!entry.supportsVision,
                supportsReasoning: !!entry.supportsReasoning,
                supportsTools: !!entry.supportsTools
            });
        }
    }
    return out;
};

LLMAdapter.validateCapability = function(modelId, requiredCap) {
    if (!requiredCap) return {ok: true};
    var info = LLMAdapter.getModelInfo(modelId);
    if (!info) return {ok: true};
    if (requiredCap === 'vision' && !info.supportsVision) {
        return {ok: false, error: 'Model "' + modelId + '" does not support vision or OCR input.'};
    }
    if (requiredCap === 'ocr' && (!info.supportsVision && info.capabilities.indexOf('ocr') < 0)) {
        return {ok: false, error: 'Model "' + modelId + '" does not support OCR processing.'};
    }
    if (requiredCap === 'reasoning' && !info.supportsReasoning) {
        return {ok: false, error: 'Model "' + modelId + '" does not support deep reasoning mode.'};
    }
    if (requiredCap === 'tools' && !info.supportsTools) {
        return {ok: false, error: 'Model "' + modelId + '" does not support function/tool calling.'};
    }
    return {ok: true};
};


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
    if (status === 404 || text.indexOf('model_not_found') >= 0 || text.indexOf('model not found') >= 0 || text.indexOf('does not exist') >= 0) {
        return {category: 'not_found', retryable: false, message: 'Endpoint or model not found (HTTP 404).'};
    }
    if (text.indexOf('insufficient_quota') >= 0 || text.indexOf('quota exceeded') >= 0 || text.indexOf('balance insufficient') >= 0 || text.indexOf('out of credits') >= 0 || text.indexOf('credit balance') >= 0) {
        return {category: 'quota_exhausted', retryable: false, message: 'Provider quota or credit balance exhausted.'};
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

        // Capability pre-flight check if requested
        if (opts.require_capability) {
            var capCheck = LLMAdapter.validateCapability(modelToUse, opts.require_capability);
            if (!capCheck.ok) {
                return {ok: false, error: capCheck.error, category: 'capability_unsupported', retryable: false};
            }
        }

        // Canonical model ID alias mapping
        var mInfo = LLMAdapter.getModelInfo(modelToUse);
        if (mInfo && mInfo.target_id) {
            pCopy.model = mInfo.target_id;
        }

        if (this.p.type == 'anthropic') return this._anthropic(system, messages, tools, opts, pCopy);
        
        // Auto-resolve base_url if empty using provider registry
        if (!pCopy.base_url) {
            pCopy.base_url = LLMAdapter.resolveDefaultBaseUrl(pCopy.type || pCopy.name);
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
        if (!baseUrl) {
            baseUrl = LLMAdapter.resolveDefaultBaseUrl(this.p.type || this.p.name);
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
        
        var isReasoningModel = false;
        var modelInfo = LLMAdapter.getModelInfo(pCfg.model);
        if (modelInfo && modelInfo.supportsReasoning) isReasoningModel = true;
        if (/^(o1|o3|deepseek-reasoner|glm-z1)/i.test(pCfg.model || '')) isReasoningModel = true;

        var body = {model: pCfg.model, messages: msgs};
        if (isReasoningModel) {
            // Reasoning models reject custom temperature or frequency penalty; use max_completion_tokens
            if (pCfg.max_tokens) body.max_completion_tokens = pCfg.max_tokens;
        } else {
            if (pCfg.max_tokens) body.max_tokens = pCfg.max_tokens;
            if (opts && typeof opts.temperature === 'number') body.temperature = opts.temperature;
        }

        if (tools && tools.length && (!modelInfo || modelInfo.supportsTools !== false)) {
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
        var reasoningText = m.reasoning_content || '';
        return {
            ok: true,
            text: m.content || (reasoningText && !calls.length ? reasoningText : ''),
            reasoning: reasoningText || null,
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
    if (typeof DiagnosticService != 'undefined') {
        if (typeof DiagnosticService.redactPII == 'function') {
            try { return DiagnosticService.redactPII(t); } catch (e) {}
        } else if (typeof DiagnosticService.redact == 'function') {
            try { return DiagnosticService.redact(t); } catch (e) {}
        }
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
