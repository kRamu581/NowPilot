# Security Policy

Now Pilot for ServiceNow is engineered from the ground up for high-security enterprise environments. Because ServiceNow houses sensitive corporate records, employee data, configuration items, and platform code, Now Pilot implements a rigorous **defense-in-depth security model**.

---

## Supported Versions

| Version | Supported | Security Maintenance |
| :--- | :--- | :--- |
| **v1.5.x** | ✅ Yes | Active maintenance, security patches, and automated verification |
| **v1.4.x** | ⚠️ Limited | Critical security patches only |
| **< v1.4.0**| ❌ No | Please upgrade to v1.5.0 immediately |

---

## Core Security Architecture & Controls

### 1. Zero Unapproved Writes & Human-in-the-Loop (GMGSeal)
Now Pilot never allows language models to write directly to your ServiceNow database.
- **Sealed Proposals**: Every suggested change (ticket update, resolution note, knowledge article, or script modification) is staged as a pending proposal.
- **Cryptographic Tamper-Proofing (`GMGSeal`)**: Proposals are sealed using a SHA-256 HMAC signature calculated across the target table, record `sys_id`, proposed fields, and user context. Any tampering with proposal parameters invalidates the seal.
- **Stale-Record Detection**: Before any change is applied upon user click, the system compares the current record's `sys_mod_count` and `sys_updated_on` against the values present when the proposal was generated. If the record was altered in the background, the transaction is rejected (`STALE_CONFLICT`).
- **Replay & Double-Click Protection**: Actions are single-use. Replay attempts return `HTTP 409 Conflict`. UI buttons enter a disabled `working` state immediately upon click to prevent double submissions.

### 2. Server-Side Request Forgery (SSRF) Firewall
All outbound HTTP connections to AI providers, gateways, and web endpoints pass through strict URL validation in `LLMAdapter` and `AgentTools`:
- **Cloud Metadata Protection**: Requests to AWS/GCP/Azure instance metadata endpoints (`169.254.169.254` / `fd00:ec2::254`) are strictly blocked.
- **Private Subnet Protection**: Private network ranges (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and carrier-grade NAT blocks are forbidden.
- **Loopback Enforcement**: Local loopback addresses (`127.0.0.1`, `localhost`, `::1`) are blocked by default. They can only be enabled in local development lab environments with the explicit platform property `x_gmg_ai.allow_http_localhost = true`.
- **Self-Hosted Models (Ollama / vLLM / Local NIM)**: For self-hosted LLM endpoints hosted on private internal subnets (RFC 1918: `10.x`, `192.168.x`), outbound requests from cloud-hosted ServiceNow nodes are blocked by design. Route traffic through an HTTPS reverse proxy with a valid FQDN or use a secure gateway.
- **Protocol Enforcement**: Remote providers must use encrypted HTTPS. Credentials embedded in URLs (`user:pass@host`) are rejected.

### 3. Native Platform Authorization (`GlideRecordSecure`)
- **Strict ACL Inheritance**: All data reading and querying uses ServiceNow's `GlideRecordSecure` API rather than standard `GlideRecord`. The AI agent can only read, search, or summarize records that the signed-in user is explicitly authorized to view under ServiceNow Access Control Lists (ACLs).
- **Role Requirements**: Endpoints and UI scripts require the `x_gmg_ai.user` role. Administrative modules require `admin`.
- **Cross-User Session Isolation**: Browser session storage is keyed to the active user's ServiceNow ID (`UID`). Switching user accounts within the same browser tab purges foreign cache keys to prevent cross-user data leakage.

### 4. Untrusted Input Sandboxing & Prompt Injection Defense
- **Records are Untrusted**: Ticket descriptions, work notes, error logs, and Knowledge Base articles are treated as untrusted user input.
- **Sandbox Formatting**: Context builders wrap platform data in strict XML boundaries (`<ticket_context>`, `<knowledge_evidence>`) accompanied by explicit system instructions to ignore embedded administrative overrides or prompt hijacking attempts.
- **Static Code Analysis (`DevValidator`)**: Code generated or analyzed by the Dev Assistant is run through a platform AST/regex parser that detects and blocks:
  - Dangerous recursion or `current.update()` in Business Rules.
  - Arbitrary code execution (`eval()`, `new Function()`, `setTimeout` string evaluation).
  - Unsanitized encoded queries prone to injection.
  - Prototype pollution patterns.

### 5. Credential Protection & Sensitive Data Redaction
- **Server-Side API Key Storage**: Provider API keys are stored in encrypted platform fields (`x_gmg_ai_provider.api_key`). Keys are never sent to the client browser, never exposed in REST API responses, and never logged.
- **Automatic Log Redaction**: Outbound requests, error traces, audit logs, and diagnostic payloads are continuously filtered through regular expression scrubbers that redact:
  - Bearer tokens and Authorization headers.
  - API keys (`sk-...`, `ghp-...`, `xai-...`).
  - Passwords, client secrets, and session cookies.

### 6. Ambiguous Write Protection & Safe Recovery
- **Non-Retryable Writes**: In accordance with distributed transaction safety, write operations that encounter network timeouts, socket drops, or ambiguous HTTP 5xx responses are classified as **strictly non-retryable**. Automatic retries are forbidden to prevent duplicate records or double-updates.
- **Interrupted Workflow Recovery**: When resuming an interrupted multi-step workflow, the engine checks existing proposal states. If a step's proposal was already applied, the step is marked `completed` and the engine advances safely without re-submitting changes.

---

## Reporting a Vulnerability

We take the security of Now Pilot very seriously. If you discover a vulnerability or security flaw, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Send a detailed report to the security maintainers at:
   **`security@nowpilot.internal`** (or contact Kanam Ramu directly via the project repository).
3. Include the following details in your report:
   - Description of the vulnerability and attack vector.
   - Affected components (e.g., Script Include, UI Script, REST resource).
   - Step-by-step reproduction instructions or proof-of-concept.
   - Potential impact on the host ServiceNow instance.

### Disclosure Policy
- We will acknowledge receipt of your vulnerability report within **48 hours**.
- We will provide an initial assessment and timeline for a fix within **5 business days**.
- Once a fix is verified, a patch will be released with credit to the reporter in the release notes (unless anonymity is requested).
