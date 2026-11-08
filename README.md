<div align="center">

<img src="src/assets/favicon.svg" alt="Now Pilot" width="96" height="96" />

# Now Pilot for ServiceNow

**AI on ServiceNow that never writes without your Accept.**

Open source · Multi-model · Human in the loop

[![Version](https://img.shields.io/badge/v2.0.0-168B50?style=flat-square)](https://github.com/kRamu581/NowPilot)
[![License](https://img.shields.io/badge/Apache--2.0-080808?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-224%2F224-168B50?style=flat-square)](src/test)
[![Stars](https://img.shields.io/github/stars/kRamu581/NowPilot?style=flat-square)](https://github.com/kRamu581/NowPilot/stargazers)

**[Install](INSTALL.md)** · **[Features](FEATURES.md)** · **[Architecture](#architecture)** · **[Security](SECURITY.md)** · **[Contribute](CONTRIBUTING.md)**

⭐ **Star the repo** if you want a ServiceNow AI agent you can trust.

</div>

---

## What is it?

Now Pilot is a **floating AI panel** inside ServiceNow.

It helps with incidents, knowledge, and code — but it **does not write to the database** until you click **Accept**.

| You keep | You skip |
|---|---|
| Full control (last click is yours) | Expensive GenAI seats |
| Your models (Gemini, Claude, GPT, Ollama…) | Vendor lock-in |
| ACL-safe reads (`GlideRecordSecure`) | Blind auto-writes |

---

## Why people use it

1. **Safe** — every change is a sealed proposal; you Accept or Reject  
2. **Free app** — Apache-2.0; you only pay LLM tokens  
3. **Any model** — Gemini, Claude, OpenAI, OpenRouter, local  
4. **Real platform help** — summarize tickets, draft code, plan work  
5. **Tested** — **224/224** offline tests

---

## What's new in v2.0

- **Story decomposer** — backlog / story → OOTB-first build plan  
- **ATF helper** — form steps + Jasmine-style server test ideas  
- **Architect refactorer** — safer patterns (no `current.update()` in before rules, async client patterns)  
- **Otto UI** — cleaner panel, proposal cards, Accept / Reject  
- **Gemini 2.0 Flash** — first-class provider support  

Full list: **[FEATURES.md](FEATURES.md)**

---

## Try in 60 seconds (no instance)

```bash
git clone https://github.com/kRamu581/NowPilot.git
cd NowPilot
node local_runner.js
```

Open **http://localhost:3000** → click the Now Pilot launcher.

---

## Install on ServiceNow

Full steps: **[INSTALL.md](INSTALL.md)**

**Short version:**

1. Import `update_sets/now_pilot_global.xml` → Preview → **Commit**  
2. Import `update_sets/now_pilot_scoped.xml` → Preview → **Commit**  
3. Give yourself role **`x_gmg_ai.user`** → log out / in  
4. Add a provider in **`x_gmg_ai_provider.list`**  
5. Open an Incident → open the panel → chat

**Gemini example**

| Field | Value |
|---|---|
| Type | `gemini` or `openai_compatible` |
| Model | `gemini-2.0-flash` |
| Base URL | `https://generativelanguage.googleapis.com/v1beta/openai` |
| API key | From [Google AI Studio](https://aistudio.google.com/apikey) |

---

## What it can do

- **Chat on the form** — uses the record you have open  
- **ITSM help** — similar incidents, knowledge, next steps  
- **Dev help** — Business Rules, Script Includes, Client Scripts, ATF ideas  
- **Story → plan** — break a backlog item into platform pieces  
- **Safer code** — blocks bad patterns like `current.update()` in before rules  
- **Workflows** — multi-step plans that pause before writes  

Deep detail: **[FEATURES.md](FEATURES.md)**

---

## How safety works

```
You ask → Agent proposes → You review → Accept / Reject
```

- No silent production writes  
- Reads go through **ACLs**  
- Proposals are sealed (**GMGSeal**)  
- Outbound PII can be redacted  

More: **[SECURITY.md](SECURITY.md)**

---

## Architecture

```mermaid
flowchart TD
    subgraph Browser ["1. Browser / ServiceNow UI"]
        UI["NowPilot Floating Widget<br/>(gmg_ai_agent_panel.js)"]
        User(["Developer / ITIL Agent"])
        User <-->|Prompt / Accept Proposal| UI
    end

    subgraph Scoped ["2. ServiceNow Scoped Backend (x_gmg_ai)"]
        REST["Scripted REST API (/api/x_gmg_ai/agent/chat)"]
        Core["AgentCore Orchestrator"]
        DevAsst["DevAssistant (Pillar 1 Engines)"]
        ITSM["ITSMAssistant (RAG & Knowledge)"]
        WF["WorkflowEngine (Autonomous Tasks)"]
        Tools["AgentTools (GlideRecordSecure)"]
        Validator["DevValidator (Static Code Analysis)"]
        Seal["GMGSeal (Cryptographic Action Guard)"]
    end

    subgraph LLM ["3. Model Layer"]
        Adapter["LLMAdapter"]
        Gemini["Google Gemini 2.0 Flash"]
        Claude["Anthropic Claude 3.5"]
        GPT["OpenAI GPT-4o"]
        Local["Local Ollama / vLLM"]
    end

    UI --> REST --> Core
    Core --> DevAsst
    Core --> ITSM
    Core --> WF
    DevAsst & ITSM & WF --> Tools
    DevAsst --> Validator
    Core --> Adapter
    Adapter --> Gemini & Claude & GPT & Local
    Core --> Seal
    Seal -->|Sealed Action Card| UI
```

**In one line:** UI panel → REST API → AgentCore → tools / validators → LLM → sealed proposal back to you.

---

## Tests

```bash
node src/test/run_all_tests.js
```

**224 tests · 8 suites · offline · 0 network required**

| Suite | File | Tests |
|---|---|---:|
| Responsive layout | `test_responsive_layout.js` | 7 |
| Otto UI | `test_otto_ui.js` | 7 |
| Production readiness | `test_production_readiness.js` | 107 |
| Dev Assistant | `test_dev_assistant.js` | 20 |
| ITSM intelligence | `test_itsm_intelligence.js` | 22 |
| OmniRoute | `test_omniroute.js` | 13 |
| Workflow automation | `test_workflow_automation.js` | 22 |
| Pillar 1 backlog | `test_pillar1_backlog_uplift.js` | 26 |
| **Total** | | **224** |

---

## Repo map

```
update_sets/     ← install these two XMLs on ServiceNow
  now_pilot_global.xml
  now_pilot_scoped.xml
src/global/      ← floating panel UI
src/scoped/      ← agent backend (x_gmg_ai)
src/test/        ← 224 tests
local_runner.js  ← local demo server
INSTALL.md       ← full install guide
```

---

## Contribute

Ideas, bugs, and PRs are welcome.

1. Fork → branch → PR  
2. Run `node src/test/run_all_tests.js`  
3. See **[CONTRIBUTING.md](CONTRIBUTING.md)**

Built and extended by **Kanam Ramu**. Based on the GMG AI Agent open-source foundation (Apache-2.0).

---

## License

**Apache-2.0** — see [LICENSE](LICENSE).

```
Copyright 2026 GMG Technology LLC
Developed and extended by Kanam Ramu
```

---

<div align="center">

**Like the idea? Star the repo — it helps others find it.**

[![Star](https://img.shields.io/github/stars/kRamu581/NowPilot?style=social)](https://github.com/kRamu581/NowPilot)

**Now Pilot** · You keep the last click · Open source for ServiceNow

</div>
