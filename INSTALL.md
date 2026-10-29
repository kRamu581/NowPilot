<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 GMG Technology LLC -->
# Install Now Pilot on ServiceNow

Clear, step-by-step install for admins who may be new to update sets.

**Always install on a sub-production (dev/test) instance first.**

---

## Before you start

You need:

| Requirement | Why |
|---|---|
| ServiceNow **admin** role | Update sets, roles, cache |
| Sub-production instance | Vancouver / Washington / Xanadu / Brazil (Patch 7+) preferred |
| About 15–20 minutes | Import + role + one provider |
| An LLM API key | OpenAI, Anthropic, Gemini, OpenRouter, etc. |

Download the repo (or clone it):

```bash
git clone https://github.com/kRamu581/NowPilot.git
cd NowPilot
```

You will upload **two XML files**, in this order:

| Order | File path on disk | Name after import |
|:---:|---|---|
| **1st** | `update_sets/gmg_ai_agent_global.xml` | Now Pilot open source (global) |
| **2nd** | `update_sets/gmg_ai_agent_scoped.xml` | Now Pilot open source (scoped) |

> Optional integrity check: `sha256sum update_sets/*.xml` and compare with [SHA256SUMS](SHA256SUMS).

---

## Part 1 — Import the Global update set (do this first)

### Step 1. Open Retrieved Update Sets

1. Log in to your ServiceNow instance as **admin**.
2. In the left **Filter Navigator**, type:

   ```
   Retrieved Update Sets
   ```

3. Open **System Update Sets → Retrieved Update Sets**.

### Step 2. Import the XML

1. At the top of the list, click **Import Update Set from XML**.
2. Click **Choose File** / **Browse**.
3. Select:

   ```
   update_sets/gmg_ai_agent_global.xml
   ```

4. Click **Upload**.

ServiceNow creates a retrieved update set (name similar to **Now Pilot open source (global)**).

### Step 3. Preview

1. Open that retrieved update set (click its name).
2. Click **Preview Update Set**.
3. Wait until preview finishes.

**What you want to see:**

- **0 problems** (or only acceptable warnings you understand)
- **0 collisions** if this is a fresh install

If there are **errors**, fix or accept them before committing. Do **not** commit with unresolved errors.

### Step 4. Commit

1. Still on the same update set form, click **Commit Update Set**.
2. Confirm when prompted.
3. Wait until the commit completes successfully.

Global package is done. Continue to Part 2.

---

## Part 2 — Import the Scoped update set (do this second)

Repeat the same flow with the **scoped** file.

### Step 5. Import scoped XML

1. Go again to **System Update Sets → Retrieved Update Sets**.
2. Click **Import Update Set from XML**.
3. Choose:

   ```
   update_sets/gmg_ai_agent_scoped.xml
   ```

4. Click **Upload**.

### Step 6. Preview scoped set

1. Open the new retrieved set (**Now Pilot open source (scoped)**).
2. Click **Preview Update Set**.
3. Confirm **0 problems** / acceptable result.

### Step 7. Commit scoped set

1. Click **Commit Update Set**.
2. Wait until it finishes.

You have now installed the application (`x_gmg_ai`), APIs, panel UI script, and tables.

---

## Part 3 — Give users access (required)

Without this role, nobody sees the panel.

### Step 8. Assign the role

1. In Filter Navigator, type:

   ```
   Users
   ```

2. Open **User Administration → Users**.
3. Open the user who should use Now Pilot (or your own user).
4. Go to the **Roles** related list.
5. Click **Edit…** (or **Add**).
6. Add this role:

   ```
   x_gmg_ai.user
   ```

7. Save.

**Admin tip:** To test yourself, add `x_gmg_ai.user` to your admin account as well.

### Step 9. Log out and log back in

1. Log out of ServiceNow completely.
2. Log in again.
3. Open any **Incident** list or form (for example **Incident → Open**).

Within about a minute you should see the **Now Pilot** launcher (usually bottom-right).

**If you do not see it:**

1. Hard refresh the browser: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac).
2. As admin, open:

   ```
   https://YOUR-INSTANCE.service-now.com/cache.do
   ```

   Flush the cache, then hard-refresh the incident page again.
3. Confirm the user still has role `x_gmg_ai.user`.

---

## Part 4 — Add an AI provider (required for chat)

The install does **not** ship with any API keys. You must add one provider.

### Step 10. Open Providers

1. Filter Navigator:

   ```
   x_gmg_ai_provider.list
   ```

   Or: **GMG AI Agent → Providers** (if the menu is visible).

2. Click **New**.

### Step 11. Fill the form (pick one example)

#### Option A — OpenAI / OpenRouter / Grok (OpenAI-compatible)

| Field | Example value |
|---|---|
| **Name** | `OpenAI` |
| **Type** | `openai_compatible` |
| **Base URL** | `https://api.openai.com/v1` |
| **Model** | `gpt-4o-mini` |
| **API Key** | your secret key |
| **Active** | checked |
| **Is default** | checked |

#### Option B — Anthropic Claude

| Field | Example value |
|---|---|
| **Name** | `Claude` |
| **Type** | `anthropic` |
| **Base URL** | leave blank (uses `https://api.anthropic.com/v1`) |
| **Model** | `claude-sonnet-4-20250514` (or your model id) |
| **API Key** | your Anthropic key |
| **Active** | checked |
| **Is default** | checked |

#### Option C — Google Gemini

| Field | Example value |
|---|---|
| **Name** | `Gemini` |
| **Type** | `gemini` **or** `openai_compatible` |
| **Base URL** | blank if type=`gemini`, else `https://generativelanguage.googleapis.com/v1beta/openai` |
| **Model** | `gemini-2.0-flash` |
| **API Key** | key from [Google AI Studio](https://aistudio.google.com/apikey) |
| **Active** | checked |
| **Is default** | checked |

#### Option D — OpenRouter (many models)

| Field | Example value |
|---|---|
| **Name** | `OpenRouter` |
| **Type** | `openai_compatible` or `omniroute` |
| **Base URL** | `https://openrouter.ai/api/v1` |
| **Model** | `openai/gpt-4o-mini` |
| **API Key** | your OpenRouter key |
| **Active** | checked |
| **Is default** | checked |

3. Click **Submit** / **Save**.

Optional: use **Test connection** if your build exposes it on the provider form.

---

## Part 5 — Try it

1. Open any **Incident** form.
2. Click the **Now Pilot** launcher.
3. Ask something simple, for example:  
   `Summarize this incident in 3 bullets.`
4. If the agent proposes a field change, review the card and click **Accept** only if you want it applied.

**Remember:** The agent does **not** write to the database until you click **Accept**.

---

## Troubleshooting

| Symptom | What to do |
|---|---|
| No launcher button | Role `x_gmg_ai.user`? Logged out/in? Hard refresh? `/cache.do`? |
| HTTP 503 “install incomplete” / conversation ACLs | Re-commit **scoped** update set, or as `security_admin` recreate ACLs on `x_gmg_ai_conversation` and `x_gmg_ai_message` |
| Chat errors / auth failure | Check provider **API key**, **Base URL**, **Type**, and that **Active** is true |
| Preview has problems | Do not commit until resolved; compare with a clean sub-prod |
| Works in one browser only | Clear cache / try incognito after role change |

---

## Optional settings (after it works)

Filter Navigator → `sys_properties.list` → search `x_gmg_ai`:

| Property | Default | Meaning |
|---|---|---|
| `x_gmg_ai.fallback_providers` | empty | Comma-separated provider **names** to try if the primary fails |
| `x_gmg_ai.model_allowlist` | empty | Optional allowed model ids |
| `x_gmg_ai.allow_http_localhost` | `false` | Only for local lab gateways on 127.0.0.1 |
| `x_gmg_ai.redact_outbound_pii` | `true` | Mask PII before calling the LLM |
| `x_gmg_ai.allow_non_admin_writes` | `true` | Set `false` to make non-admins read-only |
| `x_gmg_ai.web_search.enabled` | `false` | Claude-only web search |

---

## Upgrade / rollback (short)

**Upgrade:** Import + Preview + Commit **global**, then **scoped** again (same order).

**Rollback:** **System Update Sets → Local Update Sets** → open the committed set → **Back Out** (scoped first, then global). Always back up sub-prod first.

---

## What the install adds

- Application **GMG AI Agent** (scope `x_gmg_ai`)
- Role `x_gmg_ai.user`
- Tables: providers, pending actions, logs, conversations, messages
- Global UI script for the floating panel
- Scripted REST API under `/api/x_gmg_ai/agent`
- **No** API keys and **no** providers until you add them

---

## Safety note

When you click **Accept** on a proposal for the record you have open, that change is applied on the instance. Test on sub-production first.

More detail: [SECURITY.md](SECURITY.md) · [FEATURES.md](FEATURES.md) · [README.md](README.md)

Licensed under Apache-2.0. See [LICENSE](LICENSE).
