<div align="center">

# 🌙 Luach Vestot (לוח וסתות)

### A Privacy-First Halachic Cycle Tracking System

[![Live](https://img.shields.io/badge/Live-veset.dina--ins.co.il-blue?style=for-the-badge)](https://veset.dina-ins.co.il)
[![Node.js](https://img.shields.io/badge/Node.js-20-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-Hardened-2496ED?style=for-the-badge&logo=docker)](https://docker.com)
[![Encryption](https://img.shields.io/badge/AES--256--GCM-Encrypted-red?style=for-the-badge&logo=lock)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![MCP](https://img.shields.io/badge/MCP-AI%20Ready-purple?style=for-the-badge)](https://modelcontextprotocol.io)

<br>

*Self-hosted niddah cycle tracking with automatic veset calculation, field-level encryption, and AI integration via MCP.*

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📅 Hebrew Calendar
- Full Hebrew month grid (א׳–ל׳)
- Toggle between Hebrew/Gregorian views
- Year-dependent month lengths (Cheshvan/Kislev)
- Gematria day names & Hebrew year display

</td>
<td width="50%">

### 🧮 Halachic Calculations
- **Onah Beinonit** (30 & 31)
- **Veset Haflagah** (1st, 2nd, 3rd)
- **Veset Hachodesh** (Hebrew month-day)
- **Or Zarua** (opposite onah)
- **Mechitza** (partition/reset)
- Configurable: Rama vs Mechaber

</td>
</tr>
<tr>
<td width="50%">

### 🔒 Zero-Knowledge Encryption
- AES-256-GCM field-level encryption
- Single encrypted blob per user
- Server admin sees NOTHING
- Key derived from password (PBKDF2)
- No plaintext dates, counts, or patterns

</td>
<td width="50%">

### 🤖 AI Integration (MCP)
- Full MCP server for AI assistants
- 10 tools: CRUD cycles, vestot, settings
- Bulk import with Hebrew date support
- API key authentication
- Works with Kiro, Claude, etc.

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    HTTPS (Let's Encrypt)                    │
├────────────────────────────────────────────────────────────┤
│              Nginx Proxy Manager (Docker)                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   ┌──────────────────────────────────────────────────┐    │
│   │           Node.js / Express (Docker)              │    │
│   │                                                    │    │
│   │  ┌─────────┐  ┌──────────┐  ┌───────────────┐   │    │
│   │  │  Auth   │  │  Cycles  │  │   Vestot Calc  │   │    │
│   │  │ (bcrypt)│  │  (CRUD)  │  │   Engine       │   │    │
│   │  └────┬────┘  └────┬─────┘  └───────┬───────┘   │    │
│   │       │             │                │            │    │
│   │  ┌────▼─────────────▼────────────────▼───────┐   │    │
│   │  │         Encrypted Blob Service             │   │    │
│   │  │    (load → decrypt → compute → encrypt     │   │    │
│   │  │                  → save)                   │   │    │
│   │  └────────────────────┬──────────────────────┘   │    │
│   │                       │                           │    │
│   │  ┌────────────────────▼──────────────────────┐   │    │
│   │  │              SQLite (WAL)                  │   │    │
│   │  │  ┌────────┐  ┌────────────────────────┐   │   │    │
│   │  │  │ users  │  │ user_data              │   │   │    │
│   │  │  │ (plain)│  │ (encrypted blob only)  │   │   │    │
│   │  │  └────────┘  └────────────────────────┘   │   │    │
│   │  └───────────────────────────────────────────┘   │    │
│   └──────────────────────────────────────────────────┘    │
│                                                            │
│   Security: non-root │ read-only FS │ all caps dropped     │
│             no-new-privileges │ rate limiting               │
└────────────────────────────────────────────────────────────┘
```

---

## 🔐 Encryption Model

| Layer | What's Protected |
|-------|-----------------|
| **Transport** | HTTPS/TLS (Let's Encrypt) |
| **Storage** | Single AES-256-GCM encrypted blob per user |
| **Key Derivation** | PBKDF2 (100K iterations, SHA-512) |
| **At Rest** | Server admin sees only opaque blob — no dates, no counts, no patterns |
| **Passwords** | bcrypt (12 rounds) |
| **Session** | httpOnly cookie, SQLite-backed |

### What the server admin can see:
```sql
SELECT * FROM user_data;
-- user_id: 1000
-- encrypted_blob: "7a9f2bc1e4d8... (opaque gibberish) ...f3a2"
-- That's it. No record counts. No dates. Nothing.
```

### What the server admin CANNOT see:
- ❌ How many cycles a user has
- ❌ Any dates (Hebrew or Gregorian)
- ❌ Onah (day/night)
- ❌ Calculated prisha days
- ❌ User's halachic settings
- ❌ Mechitza (partition) locations

---

## 📱 UI Highlights

| Feature | Description |
|---------|-------------|
| 🌗 Hebrew Calendar Mode | Proper Hebrew month grid (א׳ אב → ל׳ אב) with Gregorian secondary |
| 📊 Color-Coded Markers | Pink=Beinonit, Orange=Haflagah(1/2/3), Purple=Hachodesh |
| ✂️ Mechitza (Partition) | Visual dividers in history that reset haflagah counting |
| 🔑 API Key Management | Reveal/hide/copy with confirmation |
| 📧 Email Reminders | Daily at 16:00, multiple verified recipients |
| 📋 Hebrew Date Input | Gematria dropdowns (א׳–ל׳), year-dependent day counts |

---

## 🚀 Quick Start

### Docker (recommended)

```bash
git clone https://github.com/noah-tz/yemey-prisha.git
cd yemey-prisha

# Create .env
echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env
echo "ALLOW_REGISTRATION=true" >> .env

# Optional: Brevo SMTP for email reminders
echo "SMTP_HOST=smtp-relay.brevo.com" >> .env
echo "SMTP_PORT=587" >> .env
echo "SMTP_USER=your-brevo-login" >> .env
echo "SMTP_PASS=your-brevo-key" >> .env

# Run
docker compose up -d
```

Open `http://localhost:3000`

### Development

```bash
npm install
node server.js
```

---

## 🔌 API

Full REST API with API key authentication:

```bash
# Get all prisha days
curl -H "X-API-Key: vst_..." https://your-server/api/vestot

# Add a cycle (Hebrew date)
curl -X POST -H "X-API-Key: vst_..." \
  -H "Content-Type: application/json" \
  -d '{"startDateHeb":{"year":5786,"month":7,"day":6},"onah":"day","inputFormat":"hebrew"}' \
  https://your-server/api/cycles

# Bulk import
curl -X POST -H "X-API-Key: vst_..." \
  -d '{"records":[{"startDateHeb":{"year":5786,"month":7,"day":6},"onah":"day","inputFormat":"hebrew"}]}' \
  https://your-server/api/cycles/import
```

📖 Full docs at `/api/docs` or `#api-docs` in the app.

---

## 🤖 MCP Server (AI Integration)

The project includes a dedicated [Model Context Protocol](https://modelcontextprotocol.io) server for AI assistants:

```json
{
  "mcpServers": {
    "vestot": {
      "command": "node",
      "args": ["path/to/vestot-mcp/dist/index.js"],
      "env": {
        "VESTOT_URL": "https://your-server",
        "VESTOT_API_KEY": "vst_..."
      }
    }
  }
}
```

### Available MCP Tools:
| Tool | Description |
|------|-------------|
| `vestot_list_cycles` | List all recorded cycles |
| `vestot_add_cycle` | Add a new cycle (Gregorian/Hebrew) |
| `vestot_update_cycle` | Edit an existing cycle |
| `vestot_delete_cycle` | Delete a cycle |
| `vestot_get_prisha_days` | Get all calculated separation days |
| `vestot_get_calendar` | Get prisha days for a date range |
| `vestot_get_settings` | View halachic settings |
| `vestot_update_settings` | Update settings |
| `vestot_import_cycles` | Bulk import past cycles |
| `vestot_add_mechitza` | Add a partition (reset haflagah) |
| `vestot_remove_mechitza` | Remove a partition |
| `vestot_list_mechitzot` | List all partitions |

---

## 📐 Hebrew Date Engine

Built on the **Rata Die algorithm** (Dershowitz & Reingold), ported from a Google Apps Script library:

- Accurate Hebrew ↔ Gregorian conversion
- Handles all year types (חסרה/כסדרה/שלמה)
- Leap year (עיבור) awareness
- Variable month lengths (Cheshvan 29/30, Kislev 29/30)
- `addMonths()` with overflow handling

---

## 🛡️ Security Hardening

| Measure | Implementation |
|---------|---------------|
| Container isolation | Docker with `read_only: true` |
| Non-root execution | UID 1001, all capabilities dropped |
| Privilege escalation | `no-new-privileges: true` |
| Rate limiting | 10 req/15min (auth), 100 req/min (API) |
| Port exposure | `127.0.0.1:3000` only (not public) |
| Security headers | X-Frame-Options, X-Content-Type-Options, XSS-Protection |
| Registration control | `ALLOW_REGISTRATION=false` env var |
| Consent recording | IP + User-Agent + timestamp + terms version |

---

## 📁 Project Structure

```
yemey-prisha/
├── server.js                    # Express entry point
├── db.js                        # SQLite + migrations
├── Dockerfile                   # Multi-stage, non-root
├── docker-compose.yml           # Production config
├── services/
│   ├── hebrewDateUtils.js       # Rata Die Hebrew calendar engine
│   ├── vesetCalculationEngine.js # Core halachic logic
│   ├── cycleService.js          # Blob-based CRUD + recalculation
│   ├── userDataService.js       # Encrypted blob load/save
│   ├── crypto.js                # AES-256-GCM + PBKDF2
│   ├── authService.js           # Registration + login + key derivation
│   ├── emailService.js          # Brevo SMTP transactional email
│   └── reminderJob.js           # Daily cron job (16:00)
├── routes/
│   ├── auth.js                  # Login/register/logout + consent
│   ├── cycles.js                # CRUD + import
│   ├── vestot.js                # Prisha days + calendar
│   ├── settings.js              # User preferences + API key
│   ├── mechitzot.js             # Partition management
│   ├── reminderEmails.js        # Email verification flow
│   └── api-docs.js              # Public API documentation
├── middleware/
│   ├── auth.js                  # Session + API key auth
│   └── session.js               # SQLite-backed sessions
├── public/
│   ├── index.html               # SPA shell (RTL Hebrew)
│   ├── terms.html               # Terms of Service + Privacy
│   ├── favicon.svg              # Calendar + moon icon
│   ├── css/styles.css           # Responsive RTL design
│   ├── js/                      # Vanilla JS modules (IIFE)
│   └── lib/hebrew-date.js       # Client-side Hebrew calendar
└── .kiro/powers/repos/vestot-mcp/  # MCP server for AI
```

---

## ⚖️ Legal

- **Terms of Service** at `/terms.html` — includes halachic disclaimer, encryption disclosure, and liability limitation
- **Privacy Policy** — GDPR/Israeli Privacy Law (תיקון 13) compliant
- **Consent** — recorded at registration with IP, user-agent, and terms version

---

## 📜 License

UNLICENSED — Private project.

---

<div align="center">

*Built with 🌙 for the Jewish community*

**Hebrew dates • Halachic calculations • Zero-knowledge encryption • AI-ready**

</div>
