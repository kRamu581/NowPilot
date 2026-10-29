<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 GMG Technology LLC -->
# Installing Now Pilot for ServiceNow (open source)

You need a ServiceNow instance and an account with the admin role. Install it on a sub-production instance first.

## Files

| Order | File | Update set after import | Updates | sha256 |
|---|---|---|---|---|
| 1 | update_sets/gmg_ai_agent_global.xml | Now Pilot open source (global) | 3 | d5bc3b46d97a12fda4f60c1e31ba13183411ddbc5d7199e923ef8c8973fd4168 |
| 2 | update_sets/gmg_ai_agent_scoped.xml | Now Pilot open source (scoped) | 330 | 6370c8473985a85afd256a6b8744c9f3cb975f9759d3141b6664a41dd11b3438 |

v1.5.0 (with Production Readiness, Observability & End-to-End Validation upgrade). Previous v1.0.1, v1.1.0, v1.2.0, v1.3.0, and v1.4.0 passed live install tests on ServiceNow Australia release Patch 7. To check a download, compare its sha256 (`sha256sum <file>`) with this table or SHA256SUMS.

**Changes go live once the user confirms.** The agent writes only to the record you have open, and only after you click Accept. If that record is active code, the confirmed change goes live immediately. The update set tracks the change; it does not hold it back for review. Review the diff, and test in a sub-production instance first.

## Install
Do these steps for the global file first, then the same steps for the scoped file:
1. Go to **System Update Sets > Retrieved Update Sets** and choose **Import Update Set from XML**. Upload the file.
2. Open the retrieved update set it creates (names above) and click **Preview Update Set**. Resolve any problems before you go on.
   In our v1.0.0 test install both sets previewed with 0 problems and 0 collisions.
3. Click **Commit Update Set**.

## After install
1. **Give users the role x_gmg_ai.user.** Only users with this role see the GMG AI Agent menu and the chat panel.
   The Providers and Settings modules are admin-only.
   **The chat panel can take a minute to appear.** Once you add the role, log out and back in, then open a normal list or form, such as the incident list.
   If the launcher still isn't there after a minute, do a hard refresh, or clear the cache by going to `/cache.do` as an admin.
2. **Add an AI provider** under **GMG AI Agent > Providers**. None are installed.
   - Type **omniroute** for OmniRoute AI gateways, **anthropic** for Claude, **gemini** for Google Gemini, or **openai_compatible** for OpenAI, xAI Grok and other OpenAI-compatible APIs.
   - Fill in name, base URL, model and API key. For omniroute, openai_compatible, and gemini the agent calls `<base URL>/chat/completions`.
     For anthropic, leave the base URL blank to use https://api.anthropic.com/v1.
     For gemini, leave the base URL blank to use https://generativelanguage.googleapis.com/v1beta/openai (Google's OpenAI-compatible endpoint).
   - **OmniRoute configuration**:
     - Name: e.g. `OmniRoute Primary Gateway`
     - Type: `omniroute`
     - Base URL: `https://omniroute.internal.corp/v1` (HTTPS required for remote hosts; local testing at `http://127.0.0.1:20128/v1` requires `x_gmg_ai.allow_http_localhost` = true)
     - Model: e.g. `llama-3-70b`
     - API Key: Gateway secret key
   - **Google Gemini configuration**:
     - Name: e.g. `Google Gemini`
     - Type: `gemini` (or `openai_compatible`)
     - Base URL: leave blank for type `gemini`, or set `https://generativelanguage.googleapis.com/v1beta/openai`
     - Model: e.g. `gemini-2.0-flash`, `gemini-1.5-pro`, or `gemini-2.5-pro`
     - API Key: Google AI Studio / Gemini API key (from https://aistudio.google.com/apikey)
   - To see costs, enter prices in USD per million tokens (price_input_per_m, price_output_per_m). When unpriced, cost is reported as unpriced/unknown.
     Admins can also open the provider list from the **Edit prices & budgets** link on the **Usage** page.
   - Optional spend caps in USD: daily_budget and monthly_budget on the provider, and x_gmg_ai.user_daily_cap_usd per user (0 = no cap).
3. **Review the settings** under **Now Pilot > Settings** (or filter `sys_properties.list` by `x_gmg_ai`). Key defaults:
   - `x_gmg_ai.fallback_providers`: Comma-separated provider names to attempt in sequence on retryable failures (e.g. `Secondary OmniRoute,Backup OpenAI`).
   - `x_gmg_ai.model_allowlist`: Optional comma-separated model identifiers allowed for user selection.
   - `x_gmg_ai.allow_http_localhost`: false by default. Set to true only in developer/lab environments where OmniRoute runs on 127.0.0.1/localhost.
   - `x_gmg_ai.retry_max_attempts`: 2 by default (max 5). Bounded retries with exponential backoff and randomized jitter.
   - `x_gmg_ai.default_close_code`: `Solved (Permanently)` by default. Matches instance incident choice lists.
   - `x_gmg_ai.redact_outbound_pii`: `true` by default. Masks email addresses, phone numbers, SSNs, payment card numbers, and API keys before sending outbound LLM requests.
   - `x_gmg_ai.panel_access` = everyone. The other values are admins and off.
   - `x_gmg_ai.allow_non_admin_writes` = true. Set it to false and the agent is read-only for anyone without the admin role.
   - `x_gmg_ai.web_search.enabled` = false. Web search works with Claude only.

## Upgrade and Rollback Instructions
- **Upgrading to v1.4.0 (from v1.0.1, v1.1.0, v1.2.0, or v1.3.0)**:
  1. Import and preview `update_sets/gmg_ai_agent_global.xml`, verify 0 collisions, then click **Commit Update Set**.
  2. Import and preview `update_sets/gmg_ai_agent_scoped.xml`, verify 0 collisions, then click **Commit Update Set**.
  3. The v1.4.0 upgrade adds `WorkflowPlanner` and `WorkflowEngine` Script Includes, updates `AgentTools`, `AgentCore`, and introduces the four-way mode bar (Chat, ITSM Intelligence, Dev Assistant, Workflows) with interactive multi-step workflow orchestration, progress tracking, and proposal confirmation in the panel.
  4. No database schema alterations or migrations are required.
- **Rollback**:
  If needed, open **System Update Sets > Local Update Sets**, select the committed update set, and click **Back Out** (scoped first, then global). In accordance with ServiceNow best practices, always export an XML backup of existing configurations in sub-production prior to major upgrades.
4. **Chat history retention.** The scheduled job **GMG AI - chat history retention** ships inactive. Chat history is not purged, and
   `x_gmg_ai.context.retention_days` has no effect, until you set the job's run time and activate it.

## What gets installed
- The application **GMG AI Agent** (scope x_gmg_ai) with role x_gmg_ai.user.
- Tables: x_gmg_ai_provider, x_gmg_ai_pending_action, x_gmg_ai_log, x_gmg_ai_conversation, x_gmg_ai_message.
- ACLs on pending actions, logs and chat history: users read only their own rows; create, write and delete are admin-only.
- The chat panel UI script `gmg_ai_agent_panel` (global). It is the only active UI script.
- The Scripted REST API `/api/x_gmg_ai/agent`, the Usage page and the menu modules.
- No AI providers, API keys, prices or budgets.

## If the chat history ACLs are missing
The agent checks for its 8 chat-history ACLs (x_gmg_ai_conversation and x_gmg_ai_message, read, write, create and delete).
If any are missing, every /api/x_gmg_ai/agent call answers HTTP 503 "install incomplete: conversation ACLs missing".
Fix: re-commit the scoped update set, or elevate to security_admin and recreate the missing ACLs in scope x_gmg_ai.

See FEATURES.md for what the agent does, and LICENSE / NOTICE for licensing. Provided AS IS under Apache-2.0.

## Accepting cards
- **Accept ownership.** Accept on a card owned by another user returns **HTTP 403**. HTTP 409 is returned only for a card that was already applied. Admins can Accept any user's pending card (admin override).
