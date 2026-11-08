// Unit Test Suite 9: Multi-Provider AI Model Catalog & Capability Architecture
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock ServiceNow environment
const mockState = {
    properties: {
        'instance_name': 'dev12345',
        'x_gmg_ai.max_rounds': '4',
        'x_gmg_ai.time_budget_ms': '45000',
        'x_gmg_ai.max_attempts': '2',
        'x_gmg_ai.web_search.enabled': 'false',
        'x_gmg_ai.llm.prompt_cache': 'true',
        'x_gmg_ai.tools.selection': 'true',
        'x_gmg_ai.tool_result_chars': '4000',
        'x_gmg_ai.context.server_store': 'false',
        'x_gmg_ai.model_allowlist': '', // empty to test dynamic catalog lookups
        'x_gmg_ai.fallback_providers': '',
        'x_gmg_ai.allow_http_localhost': 'true'
    },
    tables: {
        x_gmg_ai_provider: [],
        x_gmg_ai_log: []
    },
    roles: ['x_gmg_ai.user', 'admin'],
    restResponses: []
};

global.Class = {
    create: function() {
        return function() {
            if (this.initialize) this.initialize.apply(this, arguments);
        };
    }
};

global.gs = {
    getProperty: (name, def) => (name in mockState.properties ? mockState.properties[name] : def),
    setProperty: (name, val) => { mockState.properties[name] = String(val); },
    hasRole: (r) => mockState.roles.includes(r),
    getUserID: () => '6816f79cc0a8016401c5a33be04be441',
    getUserName: () => 'admin',
    getUserDisplayName: () => 'System Administrator',
    info: () => {},
    warn: () => {},
    error: () => {},
    getSession: () => ({
        clientData: {},
        getClientData: function(k) { return this.clientData[k]; },
        putClientData: function(k, v) { this.clientData[k] = v; }
    })
};

global.sn_ws = {
    RESTMessageV2: function() {
        this.headers = {};
        this.endpoint = '';
        this.httpMethod = 'GET';
        this.body = '';
        this.timeout = 30000;
        this.followRedirects = false;

        this.setEndpoint = (ep) => { this.endpoint = ep; };
        this.setHttpMethod = (m) => { this.httpMethod = m; };
        this.setRequestHeader = (k, v) => { this.headers[k] = v; };
        this.setRequestBody = (b) => { this.body = b; };
        this.setHttpTimeout = (ms) => { this.timeout = ms; };
        this.setFollowRedirects = (f) => { this.followRedirects = f; };

        this.execute = () => {
            const nextResp = mockState.restResponses.shift() || {
                statusCode: 200,
                body: JSON.stringify({
                    choices: [{
                        message: { role: 'assistant', content: 'Multi-provider verified.' },
                        finish_reason: 'stop'
                    }],
                    usage: { prompt_tokens: 15, completion_tokens: 5 }
                })
            };
            return {
                getStatusCode: () => nextResp.statusCode || 200,
                getBody: () => typeof nextResp.body === 'string' ? nextResp.body : JSON.stringify(nextResp.body),
                getHeader: () => null,
                getErrorMessage: () => nextResp.error || ''
            };
        };
    }
};

global.GlideRecord = function(table) {
    this.table = table;
    this.records = (mockState.tables[table] || []).map(r => Object.assign({}, r));
    this.currentIndex = -1;
    this.limit = 999;
    this.current = null;

    this.addActiveQuery = function() {
        this.records = this.records.filter(r => r.active === '1' || r.active === true || r.active === 1);
    };
    this.orderByDesc = function() {};
    this.orderBy = function() {};
    this.setLimit = function(n) { this.limit = n; };
    this.query = function() { this.currentIndex = -1; };
    this.next = function() {
        this.currentIndex++;
        if (this.currentIndex < this.records.length && this.currentIndex < this.limit) {
            this.current = this.records[this.currentIndex];
            return true;
        }
        return false;
    };
    this.get = function(id) {
        const found = this.records.find(r => r.sys_id === id);
        if (found) {
            this.current = found;
            return true;
        }
        return false;
    };
    this.getValue = function(field) {
        return this.current ? this.current[field] : null;
    };
    this.getUniqueValue = function() {
        return this.current ? this.current.sys_id : null;
    };
    this.isValidField = function(field) {
        return this.current ? field in this.current : true;
    };
};

// Provide dummy placeholders for dependencies
global.AgentTools = function() {};
global.Budget = function() {};
global.ContextStore = { installIncomplete: () => null };
global.DiagnosticService = { redact: (s) => s, ERRORS: { CONFIG_ERROR: 'CONFIG_ERROR' } };

// Load Scoped Scripts
const scopedDir = path.resolve('src/scoped');
eval(fs.readFileSync(path.join(scopedDir, 'LLMAdapter.js'), 'utf8'));
eval(fs.readFileSync(path.join(scopedDir, 'AgentCore.js'), 'utf8'));

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
    try {
        fn();
        console.log('  [PASS] ' + desc);
        passCount++;
    } catch (err) {
        console.error('  [FAIL] ' + desc + ' -> ' + err.message);
        failCount++;
    }
}

console.log('=== Suite 9: Multi-Provider AI Model Catalog & Capability Architecture ===');

// Test 1: Registry completeness
it('LLMAdapter.PROVIDERS defines all 9 requested AI providers and endpoints', () => {
    const requiredProviders = ['deepseek', 'zai', 'qwen', 'google', 'openai', 'meta', 'mistral', 'nvidia', 'specialty'];
    requiredProviders.forEach(pid => {
        assert.ok(LLMAdapter.PROVIDERS[pid], 'Provider ' + pid + ' must exist');
        assert.ok(LLMAdapter.PROVIDERS[pid].default_base_url.startsWith('https://'), 'Provider ' + pid + ' default base URL must be HTTPS');
    });
});

// Test 2: DeepSeek Models catalog verification
it('DeepSeek catalog models (V4.1, V4, R1 0528, OCR) configured with correct capability flags', () => {
    const chat = LLMAdapter.getModelInfo('deepseek-chat');
    assert.strictEqual(chat.provider, 'deepseek');
    assert.strictEqual(chat.supportsTools, true);
    assert.strictEqual(chat.supportsVision, false);

    const r1 = LLMAdapter.getModelInfo('deepseek-reasoner');
    assert.strictEqual(r1.supportsReasoning, true);
    assert.strictEqual(r1.supportsVision, false);

    const ocr = LLMAdapter.getModelInfo('deepseek-ocr');
    assert.strictEqual(ocr.supportsVision, true);
    assert.ok(ocr.capabilities.includes('ocr'));
});

// Test 3: Z.ai (GLM) Models catalog verification
it('Z.ai GLM models (5.3, 4.7, 4.5, 4.1V, 4V, 4 Flash, Z1 Flash, 4 9B, Z1 9B) configured', () => {
    const glm5 = LLMAdapter.getModelInfo('glm-5.3-flash');
    assert.strictEqual(glm5.provider, 'zai');
    assert.ok(glm5.capabilities.includes('fast'));

    const glm4v = LLMAdapter.getModelInfo('glm-4v-flash');
    assert.strictEqual(glm4v.supportsVision, true);

    const glmZ1 = LLMAdapter.getModelInfo('glm-z1-flash');
    assert.strictEqual(glmZ1.supportsReasoning, true);
});

// Test 4: Qwen Models catalog verification
it('Qwen models (Qwen3 235B, 8B, 3.5 4B, 2.5 7B) configured correctly', () => {
    const qwen235 = LLMAdapter.getModelInfo('qwen3-235b-instruct');
    assert.strictEqual(qwen235.provider, 'qwen');
    assert.strictEqual(qwen235.supportsReasoning, true);

    const qwen8b = LLMAdapter.getModelInfo('qwen3-8b');
    assert.ok(qwen8b.capabilities.includes('fast'));
});

// Test 5: Google & OpenAI Models catalog verification
it('Google (Gemini, Gemma 4) & OpenAI (GPT OSS 120B, GPT-4o, Mini) configured', () => {
    const gemini = LLMAdapter.getModelInfo('gemini-2.0-flash');
    assert.strictEqual(gemini.supportsVision, true);
    assert.strictEqual(gemini.supportsTools, true);

    const gptOss = LLMAdapter.getModelInfo('gpt-oss-120b');
    assert.strictEqual(gptOss.provider, 'openai');
    assert.strictEqual(gptOss.supportsReasoning, true);
});

// Test 6: Meta, Mistral, NVIDIA & Specialty Models verification
it('Meta (Llama 3.1), Mistral, NVIDIA (Nemotron) & Specialty (Hunyuan, LFM, Xing) configured', () => {
    const llama = LLMAdapter.getModelInfo('meta-llama/llama-3.1-8b-instruct');
    assert.strictEqual(llama.provider, 'meta');

    const mistral = LLMAdapter.getModelInfo('mistral-small-3.2-24b');
    assert.strictEqual(mistral.provider, 'mistral');

    const nemoUltra = LLMAdapter.getModelInfo('nvidia/nemotron-3-ultra');
    assert.strictEqual(nemoUltra.supportsReasoning, true);

    const hunyuan = LLMAdapter.getModelInfo('hunyuan-mt-7b');
    assert.strictEqual(hunyuan.provider, 'specialty');
    assert.ok(hunyuan.capabilities.includes('translation'));
});

// Test 7: Provider ID Normalization & URL Resolution
it('LLMAdapter normalizes provider names and resolves default base URLs', () => {
    assert.strictEqual(LLMAdapter.normalizeProviderId('DeepSeek Provider'), 'deepseek');
    assert.strictEqual(LLMAdapter.normalizeProviderId('Zhipu GLM 4.0'), 'zai');
    assert.strictEqual(LLMAdapter.normalizeProviderId('Alibaba DashScope Qwen'), 'qwen');
    assert.strictEqual(LLMAdapter.normalizeProviderId('Google Gemini Gateway'), 'google');
    assert.strictEqual(LLMAdapter.normalizeProviderId('NVIDIA NIM Endpoint'), 'nvidia');

    assert.strictEqual(LLMAdapter.resolveDefaultBaseUrl('DeepSeek'), 'https://api.deepseek.com');
    assert.strictEqual(LLMAdapter.resolveDefaultBaseUrl('Z.ai'), 'https://open.bigmodel.cn/api/paas/v4');
    assert.strictEqual(LLMAdapter.resolveDefaultBaseUrl('NVIDIA'), 'https://integrate.api.nvidia.com/v1');
});

// Test 8: Capability Gating
it('LLMAdapter.validateCapability enforces model capability boundaries', () => {
    // Vision checks
    assert.strictEqual(LLMAdapter.validateCapability('deepseek-chat', 'vision').ok, false);
    assert.strictEqual(LLMAdapter.validateCapability('deepseek-ocr', 'vision').ok, true);
    assert.strictEqual(LLMAdapter.validateCapability('glm-4.1v-thinking-flash', 'vision').ok, true);

    // Reasoning checks
    assert.strictEqual(LLMAdapter.validateCapability('deepseek-reasoner', 'reasoning').ok, true);
    assert.strictEqual(LLMAdapter.validateCapability('glm-z1-flash', 'reasoning').ok, true);
    assert.strictEqual(LLMAdapter.validateCapability('qwen3.5-4b', 'reasoning').ok, false);

    // Tools check
    assert.strictEqual(LLMAdapter.validateCapability('glm-4-flash', 'tools').ok, true);
    assert.strictEqual(LLMAdapter.validateCapability('deepseek-ocr', 'tools').ok, false);
});

// Test 9: Extended Error Classification
it('LLMAdapter.classifyError detects provider quota exhaustion and model not found', () => {
    const quotaErr = LLMAdapter.classifyError(402, 'insufficient_quota: account balance is 0');
    assert.strictEqual(quotaErr.category, 'quota_exhausted');
    assert.strictEqual(quotaErr.retryable, false);

    const balanceErr = LLMAdapter.classifyError(400, 'balance insufficient in Zhipu account');
    assert.strictEqual(balanceErr.category, 'quota_exhausted');

    const notFound = LLMAdapter.classifyError(404, 'model not found: deepseek-xyz');
    assert.strictEqual(notFound.category, 'not_found');
});

// Test 10: AgentCore.isModelAllowed dynamic catalog integration
it('AgentCore.isModelAllowed authorizes registered catalog models dynamically', () => {
    // When no allowlist is configured, all catalog models are allowed
    assert.strictEqual(AgentCore.isModelAllowed('deepseek-chat', 'default-model'), true);
    assert.strictEqual(AgentCore.isModelAllowed('glm-4-flash', 'default-model'), true);
    assert.strictEqual(AgentCore.isModelAllowed('qwen3-8b', 'default-model'), true);
    assert.strictEqual(AgentCore.isModelAllowed('unknown-random-llm', 'default-model'), false);
});

// Test 11: AgentCore.listProviders output structure and key redaction
it('AgentCore.listProviders populates model_details with capabilities and hides API key', () => {
    mockState.tables.x_gmg_ai_provider = [
        {
            sys_id: '11112222333344445555666677778888',
            name: 'DeepSeek Production',
            type: 'openai_compatible',
            model: 'deepseek-chat',
            active: '1',
            is_default: '1',
            api_key: 'sk-secret-do-not-leak'
        }
    ];

    const core = new AgentCore();
    const res = core.listProviders();
    assert.strictEqual(res.providers.length, 1);
    const p = res.providers[0];
    assert.strictEqual(p.name, 'DeepSeek Production');
    assert.strictEqual(p.provider_id, 'deepseek');
    assert.ok(p.models.length > 1, 'Provider should contain catalog models');
    assert.ok(p.models.includes('deepseek-reasoner'));
    assert.ok(p.model_details.length > 1);

    // SECURITY CHECK: Verify api_key is NEVER exposed in client output
    assert.strictEqual(p.api_key, undefined);
    assert.strictEqual(p.key, undefined);
});

// Test 12: LLMAdapter chat pre-flight capability enforcement
it('LLMAdapter.chat rejects unsupported capabilities before network call', () => {
    const provGr = {
        sys_id: '11112222333344445555666677778888',
        name: 'DeepSeek',
        type: 'openai_compatible',
        model: 'deepseek-chat',
        key: 'sk-test-key'
    };

    const adapter = new LLMAdapter(provGr);
    // Attempt vision request with deepseek-chat (which does not support vision)
    const res = adapter.chat('system', [{ role: 'user', content: 'Describe this image' }], [], {
        require_capability: 'vision'
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.category, 'capability_unsupported');
    assert.ok(res.error.includes('does not support vision'));
});

// Test 13: Reasoning extraction in _openai
it('LLMAdapter._openai extracts reasoning_content for thinking models', () => {
    const provGr = {
        sys_id: '11112222333344445555666677778888',
        name: 'DeepSeek',
        type: 'openai_compatible',
        model: 'deepseek-reasoner',
        key: 'sk-test-key'
    };

    mockState.restResponses = [{
        statusCode: 200,
        body: JSON.stringify({
            choices: [{
                message: {
                    role: 'assistant',
                    content: 'The answer is 42.',
                    reasoning_content: 'Step 1: Analyzed question. Step 2: Computed result.'
                },
                finish_reason: 'stop'
            }],
            usage: { prompt_tokens: 20, completion_tokens: 30 }
        })
    }];

    const adapter = new LLMAdapter(provGr);
    const res = adapter.chat('system', [{ role: 'user', content: 'What is the answer?' }]);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.text, 'The answer is 42.');
    assert.strictEqual(res.reasoning, 'Step 1: Analyzed question. Step 2: Computed result.');
});

// Test 14: SSRF & security defense across multi-provider base URLs
it('LLMAdapter prevents SSRF attacks on provider base URLs', () => {
    const provGr = {
        sys_id: '11112222333344445555666677778888',
        name: 'Malicious Provider',
        type: 'openai_compatible',
        base_url: 'http://169.254.169.254/latest/meta-data',
        model: 'deepseek-chat',
        key: 'sk-test-key'
    };

    const adapter = new LLMAdapter(provGr);
    const res = adapter.chat('system', [{ role: 'user', content: 'ping' }]);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.category, 'security_error');
    assert.ok(res.error.includes('security validation failed'));
});

// Test 15: Provider-isolated allowlist binding
it('AgentCore.isModelAllowed enforces provider-isolated model boundaries', () => {
    // When requesting deepseek-chat on DeepSeek provider -> allowed
    assert.strictEqual(AgentCore.isModelAllowed('deepseek-chat', 'deepseek-chat', 'DeepSeek Production'), true);
    // When requesting deepseek-reasoner on DeepSeek provider -> allowed
    assert.strictEqual(AgentCore.isModelAllowed('deepseek-reasoner', 'deepseek-chat', 'DeepSeek Production'), true);
    // Cross-provider spoofing: requesting gpt-4o through DeepSeek provider -> REJECTED
    assert.strictEqual(AgentCore.isModelAllowed('gpt-4o', 'deepseek-chat', 'DeepSeek Production'), false);
    // Cross-provider spoofing: requesting claude on OpenAI provider -> REJECTED
    assert.strictEqual(AgentCore.isModelAllowed('claude-3-5-sonnet-20241022', 'gpt-4o-mini', 'OpenAI Production'), false);
    // Requesting claude on Anthropic provider -> allowed
    assert.strictEqual(AgentCore.isModelAllowed('claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022', 'Anthropic Claude'), true);
});

// Test 16: Parameter stripping for reasoning models
it('LLMAdapter._openai strips temperature for reasoning models', () => {
    let capturedBody = null;
    const provGr = {
        sys_id: '11112222333344445555666677778888',
        name: 'DeepSeek',
        type: 'openai_compatible',
        model: 'deepseek-reasoner',
        key: 'sk-test-key'
    };

    const adapter = new LLMAdapter(provGr);
    adapter._post = (url, headers, body) => {
        capturedBody = body;
        return {
            ok: true,
            status: 200,
            json: { choices: [{ message: { role: 'assistant', content: 'reasoning result' } }] }
        };
    };

    adapter.chat('system', [{ role: 'user', content: 'solve puzzle' }], [], { temperature: 0.7 });
    assert.ok(capturedBody, 'HTTP body should be captured');
    assert.strictEqual(capturedBody.temperature, undefined, 'Reasoning model must strip temperature');
    assert.ok(capturedBody.max_completion_tokens, 'Reasoning model should use max_completion_tokens');
});

// Test 17: Native Anthropic Claude provider support
it('LLMAdapter supports native Anthropic Claude protocol', () => {
    let capturedAnthropicBody = null;
    const provGr = {
        sys_id: 'claude_prov_01',
        name: 'Claude 3.5 Sonnet',
        type: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        key: 'sk-ant-api03-test'
    };

    const adapter = new LLMAdapter(provGr);
    adapter._post = (url, headers, body) => {
        capturedAnthropicBody = body;
        assert.ok(headers['x-api-key'], 'Anthropic header x-api-key must be present');
        return {
            ok: true,
            status: 200,
            json: {
                content: [{ type: 'text', text: 'Hello from Claude' }],
                usage: { input_tokens: 10, output_tokens: 5 }
            }
        };
    };

    const res = adapter.chat('system', [{ role: 'user', content: 'hi' }]);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.text, 'Hello from Claude');
    assert.strictEqual(capturedAnthropicBody.model, 'claude-3-5-sonnet-20241022');
});

console.log('----------------------------------------------------------------------');
console.log('Suite 9 Functional Tests: ' + passCount + ' passed, ' + failCount + ' failed.');
console.log('----------------------------------------------------------------------');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
