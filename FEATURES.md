<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 GMG Technology LLC -->
# GMG AI Agent for ServiceNow (open source): features

Describes the update sets built for v2.0.0 (with Multi-Provider Cloud Architecture, Production Readiness, Observability & End-to-End Validation, Agentic Workflow Automation, ITSM Intelligence & RAG, Advanced ServiceNow Development Assistant, and Gateway upgrades).

## Laptop catalog design prototype
- `draft_laptop_catalog_build` produces a read-only blueprint for a laptop catalog item, manager approval, conditional IT Finance CAB approval, and Hardware task fulfillment.
- The tool is available in chat and does not change the panel layout.
- This is a local design prototype only: it does not create catalog records, variables, Flow Designer artifacts, pending-action cards, or update-set entries. It cannot be accepted or deployed.
- The finance condition, laptop choices, and assignment-group references must be confirmed for the target instance. A real, deployable flow requires a known-good Flow Designer definition and ServiceNow instance validation.

## Production Readiness, Observability & End-to-End Validation (v1.5.0)
- **Centralized Diagnostics & Safe Error Classification (`DiagnosticService`)**:
  - Consistent taxonomy of 12 internal error codes:
    - `CONFIG_ERROR`: Missing/invalid provider, endpoint URL format violation, model allowlist refusal.
    - `AUTH_ERROR`: Provider authentication failure (HTTP 401/403), missing `x_gmg_ai.user` role, caller ACL failure.
    - `RATE_LIMIT`: Provider rate limit or quota exceeded (HTTP 429).
    - `TIMEOUT`: Provider execution deadline (<3000ms margin) or network read timeout.
    - `NETWORK_ERROR`: Connection refused, DNS failure, 5xx gateway errors, SSRF block.
    - `INVALID_RESPONSE`: Malformed JSON from model, truncated response, missing tool_calls.
    - `TOOL_ERROR`: Tool execution validation failure, unknown tool, parameter size limit exceeded (>32,000 chars).
    - `RECORD_ACCESS_ERROR`: `GlideRecordSecure` table/record/field access denied.
    - `PROPOSAL_ERROR`: Proposal creation failure, seal verification failure, tampering detected.
    - `STALE_CONFLICT`: Target record changed (`sys_mod_count` or `sys_updated_on`) between proposal and execution.
    - `BUDGET_EXHAUSTED`: Token spend cap, daily user spend cap, or provider spend quota exhausted.
    - `INTERNAL_ERROR`: Unexpected internal runtime exception.
  - Safe error presentation: scrubbed, understandable messages for end users; technical administrative details reserved for authorized administrators with sensitive credentials stripped.
  - Fail-safe retry classification: Write operations are **strictly non-retryable** upon timeout or ambiguous errors to prevent duplicate records or updates. Safe read operations are retryable under bounded time and budget margins.

- **Authoritative Correlation ID Tracking**:
  - Server-assigned authoritative correlation IDs (`corr_<timestamp>_<randomHex>`) created on all inbound transactions.
  - Untrusted client-supplied correlation metadata is sanitized and replaced if malformed.
  - Correlation IDs propagated across `AgentCore`, `LLMAdapter`, `WorkflowEngine`, `ActionService`, and `x_gmg_ai_log` records for end-to-end traceability.

- **Structured Audit Events & Observability**:
  - Structured, minimal audit events emitted across all critical lifecycle boundaries:
    - `agent_request_started`
    - `workflow_plan_created`
    - `tool_execution_started`
    - `tool_execution_completed`
    - `provider_request_failed`
    - `proposal_created`
    - `approval_accepted`
    - `approval_rejected`
    - `record_change_applied`
    - `record_change_rejected`
    - `workflow_completed`
    - `workflow_failed`
  - Recorded in `x_gmg_ai_log` with `status: 'audit_event'`, structured JSON metadata, target table and sys_id references.
  - Fail-safe logging architecture: logging failures are caught and logged to `gs.error()` without silently turning failed business operations into successful operations or crashing execution.
  - Secrets & credential protection: complete regex redaction of Bearer tokens, Basic auth, API keys (`sk-...`, `ghp-...`, etc.), passwords, and query tokens from prompts, errors, and audit responses.

- **Workflow Lifecycle Correctness & State Invariants**:
  - Enforced server-side state transitions (`planned` -> `running` -> `waiting_approval` -> `completed` / `failed` / `rejected`).
  - Terminal states (`completed`, `rejected`) cannot be re-executed.
  - Cross-user workflow isolation: non-admin users cannot inspect, resume, or execute workflows created by other users (HTTP 403).
  - Ambiguous write timeout handling: if a write action experiences an ambiguous timeout or exception, the step is marked `failed` with an explicit notice; automatic retries are blocked to prevent duplicate writes.
  - Safe interrupted-workflow recovery: resuming an interrupted workflow inspects previously generated proposals; if already `applied`, the step is marked `completed` and the workflow continues safely to subsequent steps without re-writing.

- **UI Resilience & Anti-Duplicate Click Controls (`gmg_ai_agent_panel.js`)**:
  - Duplicate-click protection: input textarea and submission buttons (Send, Run, Analyze, Start Workflow) are disabled with visual feedback (`disabled style="opacity:0.6;cursor:not-allowed"`) while a request is in `pending` state.
  - Double-click protection on action cards: Accept/Reject buttons immediately transition proposal status to `working`, preventing duplicate clicks from generating multiple requests.
  - Clean error rendering with diagnostic badges: displays safe user error message accompanied by `Diagnostic ID: [corr_...]` and `Code: [...]` tags.
  - Graceful recovery: network failures or empty responses reset `pending` state cleanly without freezing the panel or corrupting session history.

- **Provider Health Diagnostics & SSRF Safeguards (`rest_health.js` & `LLMAdapter`)**:
  - Rigorous endpoint validation rejecting cloud metadata (`169.254.169.254`), private IP subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and link-local ranges.
  - Localhost loopback (`127.0.0.1`) requires explicit administrative enablement via `x_gmg_ai.allow_http_localhost = true`.
  - Administrator connectivity checks test `/models` safely for OpenAI/Cloud gateways; capability gracefully reported as unavailable if endpoint returns 404.
  - API keys and authorization headers are never exposed in health responses or UI scripts (masked as `key_configured: true`).

## Agentic Workflow Automation & Controlled Tool Execution (v1.4.0)
- **Deterministic Workflow Planning (`WorkflowPlanner`)**:
  - Translates user intent into validated, schema-compliant execution plans.
  - Plan schema: `workflow_id`, `type`, `goal`, `status`, `steps`, `evidence`, `proposals`, `user_id`.
  - Intent classification for:
    - Incident Investigation (`incident_investigation`)
    - Knowledge Article Preparation (`knowledge_preparation`)
    - ServiceNow Development Review (`development_review`)
  - Server-side safety bounds: hard cap of maximum 8 steps per workflow.
  - Rejection of ambiguous, destructive, or bulk-deletion requests (e.g. `delete all`, `drop table`, `truncate`, `eval()`).

- **Multi-Step Tool Orchestration (`WorkflowEngine`)**:
  - Sequential execution of allowlisted tools (`get_record`, `query_records`, `get_current_record`, `search_similar_incidents`, `search_knowledge_articles`, `recommend_resolution`, `summarize_incident`, `prepare_knowledge_draft`, `validate_dev_code`, `review_dev_artifact`, `propose_resolution`, `propose_current_record_update`, `propose_journal_entry`).
  - Parameter validation and size enforcement (string parameters capped at 32,000 characters).
  - Time margin and budget safeguards: requires at least 3,000ms margin before executing heavy operations; halts gracefully if time budget or token spend caps are exceeded.
  - Loop prevention & evidence caching: reuses retrieved records and tool results across steps instead of repeatedly querying tables.
  - Secrets & sensitive-data redaction: automatically redacts bearer tokens, API keys, passwords, and secrets from parameters, logs, and evidence caches.

- **Permission-Aware Execution & Human Approval Invariant**:
  - Read operations strictly enforced via caller ACLs and `GlideRecordSecure`.
  - **Zero autonomous writes**: Whenever a write or change is proposed, the orchestrator generates a sealed `x_gmg_ai_pending_action` proposal card via `GMGSeal` and halts execution in `waiting_approval`.
  - The model can never self-approve. Changes can only be applied when an authorized human clicks **Accept** (`/api/x_gmg_ai/agent/confirm`).
  - Stale-record and duplicate submission protection re-evaluated at confirm time.

- **Initial Standard Workflows**:
  - **Workflow A (Incident Investigation)**: Validates incident -> searches similar historical incidents -> searches published knowledge -> summarizes incident history -> synthesizes grounded recommendation -> prepares resolution proposal card -> pauses for user Accept.
  - **Workflow B (Knowledge Article Preparation)**: Retrieves incident and resolution details -> searches existing knowledge to prevent duplication -> synthesizes 9-part structured draft -> prepares draft review proposal card (governance notice: non-auto-publishing) -> pauses for review.
  - **Workflow C (ServiceNow Development Review)**: Validates script syntax and scoped API boundaries -> performs 8-point architectural contract review -> prepares reviewed code correction card -> pauses for user confirmation.

- **Workflow UI Interface (`gmg_ai_agent_panel.js`)**:
  - Four-way mode switcher in the panel header: `[ Chat ] [ ITSM Intelligence ] [ Dev Assistant ] [ Workflows ]`.
  - Workflow template picker and target reference inputs.
  - Real-time step progress chips (`planned`, `running`, `waiting_approval`, `completed`, `failed`, `rejected`).
  - Interactive proposal cards with Accept/Reject buttons directly integrated into workflow timeline.

## ITSM Intelligence & Retrieval-Augmented Generation (v1.3.0)
- **Authorized Multi-Factor Similar Incident Search (`ITSMRetriever`)**:
  - Deterministic, explainable matching across historical incidents using `GlideRecordSecure('incident')`.
  - Transparent scoring breakdown:
    - Keywords overlap (0.45 weight) across short description and problem description.
    - Category / Subcategory matching (0.20 weight).
    - CMDB Configuration Item matching (0.25 weight).
    - Resolution notes completeness and quality (0.10 weight).
  - Enforces caller ACLs; only displays incidents the active user is authorized to read.
  - Bounded candidate retrieval window (`setLimit(limit * 3)`) with automatic deduplication.

- **Published Knowledge Base Retrieval (`ITSMRetriever`)**:
  - Direct retrieval of verified knowledge articles using `GlideRecordSecure('kb_knowledge')`.
  - Strict filtering: requires `workflow_state = 'published'` and validity check (`valid_to >= javascript:gs.beginningOfToday()^ORvalid_toISEMPTY`).
  - Draft, retired, or expired articles are strictly excluded.
  - Caller user criteria and read ACLs apply.

- **Prompt Sandboxing & Injection Defense (`ITSMContextBuilder`)**:
  - Retrieved ticket text and knowledge snippets are wrapped in explicit untrusted delimiters (`<itsm_evidence_sandbox>` / `### RETRIEVED ITSM EVIDENCE SANDBOX (UNTRUSTED DATA)`).
  - Explicit system prompt instructions declare all ticket data as untrusted, preventing model hijack from malicious instructions embedded in incident descriptions or work notes.
  - Context budget management: hard caps individual snippets at 500 characters and total evidence context at 6,000 characters.
  - Automatic data minimization: redacts Bearer tokens, API keys, passwords, SSNs, and credit card numbers from evidence text before presentation to LLMs.

- **Evidence-Grounded Resolution Recommendations (`ITSMAssistant`)**:
  - Synthesizes grounded troubleshooting and resolution steps citing specific retrieved sources (`[Source 1: INC...]`, `[Source 2: KB...]`).
  - Separates supported facts from technical inferences, missing information, and required approvals.
  - Expressly declares when root cause cannot be proven from evidence rather than guessing.
  - Explains conflicting evidence when historical resolutions diverge.

- **Anti-Hallucination Citation Validation (`ITSMAssistant.validateCitations`)**:
  - Server-side validation parses all emitted `INC\d{7}` and `KB\d{7}` tokens and compares them against `sourceRegistry`.
  - Flags hallucinated citations not present in retrieved records and attaches warning notices (`out.citation_warning`).

- **Structured Incident Summaries & Knowledge Article Drafting**:
  - **Incident Summaries**: Formats comprehensive 6-part executive and technical summaries covering symptoms, impact, troubleshooting history, historical links, current status, and remaining unknowns.
  - **Knowledge Article Drafting**: Drafts structured articles from resolved incidents (Title, Problem Statement, Symptoms, Environment, Root Cause, Prerequisites, Resolution Steps, Validation Steps, Rollback Steps).
  - **Knowledge Governance Safety Invariant**: Knowledge proposals are created strictly in `draft` state (`can_accept: false`) as reviewable cards with copyable formatted content; knowledge articles are never automatically published.
  - **Resolution Proposals**: Generates structured resolution proposals for the target incident (`close_code`, `close_notes`) that can be applied upon user confirmation.

- **ITSM Intelligence UI Panel Mode**:
  - Three-way mode switcher in the panel header: `[ Chat ] [ ITSM Intelligence ] [ Dev Assistant ]`.
  - Action selector: Recommend Resolution, Find Similar Incidents, Search Knowledge Articles, Summarize Incident, Draft Knowledge Article.
  - Context-aware incident identifier input.
  - Specialized action cards for `knowledge_draft` (with governance badge, source chips, and copy button) and `incident_resolution` (with Accept/Reject confirmation).

## Advanced ServiceNow Development Assistant (v1.2.0)
- **Artifact-Aware Code Generation**: Generates standard, production-ready code for 10 core ServiceNow development artifacts:
  1. **Business Rules** (`sys_script`): Scoped/global server triggers, timing conventions (before/after/async), and strict prevention of `current.update()` recursion.
  2. **Script Includes** (`sys_script_include`): Standard `Class.create()` prototype patterns and client-callable `AbstractAjaxProcessor` implementations with `getParameter()` and `newItem()`.
  3. **Client Scripts** (`sys_script_client`): `onLoad`, `onChange` (with mandatory `isLoading` guard), `onSubmit`, and asynchronous `GlideAjax` callbacks.
  4. **UI Policies & Actions** (`sys_ui_policy`): Condition builders, reverse-if-false rules, and mandatory/visible/read-only field actions.
  5. **UI Actions** (`sys_ui_action`): Dual client/server execution patterns with `gsftSubmit` and `window` checks.
  6. **Background Scripts**: Administrative scripts with simulation (`var dryRun = true;`), batch thresholds (`setLimit`), transaction wrappers, and an absolute invariant: **never auto-executed**.
  7. **Scripted REST API Resources** (`sys_ws_operation`): Inbound request parsing (`queryParams`, `pathParams`, `body.data`), HTTP status handling, and JSON payloads.
  8. **Flow Designer Guidance**: Architectural step-by-step guidance covering triggers, subflows, data pills, and error handling.
  9. **Service Portal Widgets** (`sp_widget`): Clean multi-pane structure (HTML Template, Client Controller, Server Script, CSS).
  10. **Automated Test Framework (ATF)** (`sys_atf_test`): Test plans and test step generation (impersonation, form operations, field validations, UI actions).

- **Code Review & Debugging Assistant**:
  - Paste existing code for explanation, bug detection, performance improvements, and security audits.
  - Returns a strict 8-point review contract:
    1. Summary of issue
    2. Severity (Critical, High, Medium, Low)
    3. Why it matters
    4. Relevant code section
    5. Recommended fix
    6. Corrected code
    7. Regression test cases
    8. Assumptions & platform caveats.

- **Deterministic Static Analysis Layer (`DevValidator`)**:
  - Pre-proposal and pre-deployment verification:
    - Balanced brackets, quotes, and control character scans.
    - Ban on `eval()`, `new Function()`, and unescaped `addEncodedQuery()` string concatenation.
    - Credential & API token leakage scanning.
    - Client/server boundary checks: flags `g_form`/`g_user`/`window` in server scripts, and `gs.*`/`current.*`/synchronous `GlideRecord` in client scripts.
    - Business Rule recursion detection (`current.update()` in before rules).
    - Performance warnings: flags N+1 `GlideRecord` instantiations inside loops and unbounded queries on large tables.
    - Background script safety: flags unguarded `deleteMultiple()` and missing `dryRun` flags.

- **Development Assistant UI Panel Toolbar**:
  - Chat vs. Dev Assistant tab toggle.
  - Dropdown selectors for Artifact Type and Action (Generate, Review, Explain, Debug).
  - Collapsible code input area for reviewing or debugging existing scripts.
  - Copy-to-clipboard button with visual feedback.
  - Validation findings summary box with Critical, High, and Medium issue badges.
  - Proposal card with Accept / Reject buttons when viewing a matching open record, or copyable snippet with manual deployment instructions.

## Chat panel
- A floating chat panel on desktop pages (global UI script `gmg_ai_agent_panel`, the only UI script that is active after install).
- It knows the current page. On a form it also reads the table, record sys_id and the field values you can see.
- **Model selector:** Authorized users can select from enabled, administrator-approved AI models or providers via an accessible dropdown in the panel header.
- Users need the role **x_gmg_ai.user** to see the panel and the GMG AI Agent menu.

## Any LLM provider & Cloud AI Gateways
- Provider types: **anthropic** and **openai_compatible** (covers Google Gemini, DeepSeek, OpenAI, Grok, Qwen, Z.ai, Meta, Mistral, NVIDIA).
- **Cloud AI Gateways:** Native support for standard OpenAI-compatible endpoints (`<base URL>/chat/completions`), model discovery via `GET /models`, and automatic rate limit `Retry-After` header handling.
- Add one as an admin under **GMG AI Agent > Providers**: name, type, base URL, model, API key. For openai_compatible the agent calls `<base URL>/chat/completions`. For anthropic a blank base URL means https://api.anthropic.com/v1.
- **Model allowlist:** Optional administrator property `x_gmg_ai.model_allowlist` restricts selectable models to an approved comma-separated list.
- **Safe automatic fallback:** If a provider encounters a retryable failure (HTTP 429 rate limit, 5xx server error, or connection timeout), the agent automatically attempts the next provider listed in `x_gmg_ai.fallback_providers` using bounded retries with exponential backoff and jitter within `x_gmg_ai.time_budget_ms`. Non-retryable errors (e.g., 401/403 authentication, 400 bad request) abort immediately with clear diagnostics.
- **SSRF protection:** Configurable endpoints are validated server-side. Remote endpoints must use HTTPS. Insecure HTTP is rejected, and cloud metadata services (e.g. 169.254.169.254) are strictly blocked. Local HTTP loopback (127.0.0.1 / localhost) is disabled by default and allowed only when `x_gmg_ai.allow_http_localhost` is explicitly set to true.
- **Diagnostics:** Admins can execute connection tests and latency checks via `GET /api/x_gmg_ai/agent/health?diagnostics=1` without leaking credentials.
- Web search is Claude (anthropic) only and off by default (`x_gmg_ai.web_search.enabled`). Up to `x_gmg_ai.web_search.max_uses` searches (default 3) per model call. Each search is charged at `x_gmg_ai.web_search.price_per_1k` (default $10 per 1,000).
- No providers ship with the install.

## Prompt caching
- Claude prompt caching is on by default (`x_gmg_ai.llm.prompt_cache`). Cached tokens that an OpenAI-compatible provider reports are also
  counted. Cache reads and writes are priced with multipliers (`x_gmg_ai.cache.read_multiplier` 0.1, `x_gmg_ai.cache.write_multiplier` 1.25,
  plus per-model overrides).

## Guardrails
- **The agent runs as the calling user.** It reads only what that user's ACLs allow.
- **Writes are proposals.** The agent can change only the open, saved record. Each change appears as a card with a before/after view.
  Nothing is written until the user clicks **Accept**. **Reject** discards it.
- **Where changes are recorded.** Script and configuration changes (records on tables that extend sys_metadata) are captured in a new update set
  whose name starts with "GMG AI – ", and the confirmation names it. Edits to data records (like incidents) are a direct update, made as the
  user, with no update set. They show in the record's history where the platform audits that table.
- **Changes go live once the user confirms.** The update set tracks the change; it does not hold it back for review. Review the diff,
  and test in a sub-production instance first.
- **Live-change notes.** Editing active code warns that the change goes live on Accept. Editing an inactive record notes that it won't run until someone activates it.
  `x_gmg_ai.opensource.refuse_active_script_edits` = true refuses edits to active code instead (default false).
- **What open source can't do:** create records of any kind (including catalog items, variables, flows and business rules), delete records,
  or change any record other than the open one. Those requests are refused.
- **Server seal check.** The server seals every card when it is proposed. Accept refuses a card whose contents no longer match that seal,
  and refuses an edit if the record changed after the card was made.
- **ACL and role tables are refused** for everyone, admins included: sys_security_acl, sys_security_acl_role, sys_user_role, sys_user_has_role,
  sys_user_role_contains, sys_group_has_role. These are allowed only if an admin sets `x_gmg_ai.opensource.acl_elevation_exception` = true (default false)
  AND the user has elevated to security_admin in that session. Otherwise the reply is "Elevate to security_admin to edit ACL or role records."
- **Always-denied tables:** credential, certificate, OAuth and auth-profile tables, and the agent's own x_gmg_ai_* tables. Admins can add more with
  `x_gmg_ai.opensource.denied_tables` (comma-separated, * wildcards).
- **Non-admin writes:** `x_gmg_ai.allow_non_admin_writes` (default **true**). Set it to false and the agent is read-only for anyone without the
  admin role: proposals and Accept are refused with "Updating records is turned off for your role." Admins are not affected.

- **Accept ownership.** Accept on a card owned by another user returns **HTTP 403**. HTTP 409 is returned only for a card that was already applied. Admins can Accept any user's pending card (admin override).

## Chat window access
- `x_gmg_ai.panel_access`: **everyone** (default), **admins** (users with the admin role), or **off**.
- The server enforces it. When a user's access is off, chat, Accept, Reject and GET /health return HTTP 403 with "The GMG AI Agent is turned off for your role."
  The launcher stays hidden unless the server explicitly says the user is allowed.

## Usage, cost and logs
- Every model call is logged in **AI Agent Log** (x_gmg_ai_log; module **Logs**). Each entry records provider, model, duration, input, output and
  cache tokens, web searches, rounds and estimated cost. These usage fields are read-only. Users see only their own log rows.
- **Cost** = tokens × the provider's price per million (price_input_per_m / price_output_per_m), with cache multipliers, plus web search fees.
  It shows **$0** until prices are entered. Admins use the **Edit prices & budgets** link on the Usage page, which opens the provider list.
- Modules: **Usage** (page x_gmg_ai_usage.do) and **Usage by Model** (log list grouped by model).

## Spend caps (USD, on estimated cost; 0 = no cap)
- Per provider: **daily_budget** and **monthly_budget**. Per user: **x_gmg_ai.user_daily_cap_usd**.
- Days start at midnight and months on the 1st, in each user's own time zone, so caps reset automatically. There is no manual reset.
- From **80%** the user sees a warning. At **100%** chat is blocked with a message naming the cap. To unblock, raise the cap.

## Chat history
- Conversations are stored on the server (`x_gmg_ai.context.server_store`, default true). Users read only their own (AI Conversation / AI Conversation Message).
- `x_gmg_ai.context.retention_days`: 5 by default, 5 at most.
- The scheduled job **GMG AI - chat history retention** ships **inactive**. Retention has no effect until an admin sets its run time and activates it.

## Platform pieces
- Application menu **GMG AI Agent**. Modules: Providers (admin), Logs, Pending Actions, Conversations, Usage by Model, Usage, Settings (admin).
- Tables: x_gmg_ai_provider, x_gmg_ai_pending_action, x_gmg_ai_log, x_gmg_ai_conversation, x_gmg_ai_message.
  Pending actions and logs: users read their own rows; create, write and delete are admin only.
- Scripted REST API `/api/x_gmg_ai/agent`: POST /chat, GET /health, POST /action/{id}/{verb}, GET /usage, GET /providers.
- Role: **x_gmg_ai.user**. Settings: 27 x_gmg_ai system properties under **GMG AI Agent > Settings**.

## Install
Global first, then scoped. See INSTALL.md.

---
See TRADEMARKS.md. Licensed under Apache-2.0 (see LICENSE and NOTICE). Provided AS IS, without warranties.

ServiceNow is a trademark of ServiceNow, Inc. GMG Technology LLC is not affiliated with or endorsed by ServiceNow, Inc. Anthropic/Claude, OpenAI and xAI/Grok are trademarks of their owners, used only to identify compatibility.
