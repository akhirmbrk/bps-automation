# BPS Automation

<p align="center">
  <!-- Badges -->
  <img src="https://img.shields.io/badge/version-5.1.0-blue?style=for-the-badge" alt="Version 5.1.0" />
  <img src="https://img.shields.io/badge/Manifest-V3-green?style=for-the-badge" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Chrome-Extension-orange?style=for-the-badge" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/License-Internal-red?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <b>Automated data extraction from FASIH BPS portal with modular architecture, JWT management, and comprehensive export.</b>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> · <a href="#features">Features</a> · <a href="#architecture">Architecture</a> · <a href="#installation">Installation</a> · <a href="#configuration">Configuration</a> · <a href="#changelog">Changelog</a>
</p>

---

## Elevator Pitch

**BPS Automation** is a Chromium browser extension that automates data extraction from the FASIH BPS (Badan Pusat Statistik) portal and provides comprehensive Manajemen Mitra (Partner Management) capabilities. Built for BPS enumerators and administrators, it streamlines survey data collection, user allocation, and partner tracking with a modern, modular ES6 architecture.

---

## Quick Start

**Prerequisites:** Chrome 88+ or Edge 88+ (Chromium-based browser)

```bash
# 1. Clone the repository
git clone https://github.com/akhirmbrk/bps-automation.git
cd bps-automation

# 2. Load the extension
# Open chrome://extensions/ → Enable Developer Mode → Load unpacked → Select this folder
```

---

## Features

- **FASIH Data Extraction** — Extract survey data in three modes: Basic (core data), Ekstra (pre-defined data), and Detail (full answers). Supports CSV and Excel export with auto-expiring history cache.

- **User Allocation** — Upload Excel templates to批量 allocate enumerators. Automatic region hierarchy resolution with real-time progress tracking and configurable rate limiting.

- **Mitra KEPKA Dashboard** — Browse, search, and export partner data with detailed profiles. View survey participation history and examination status.

- **JWT Auto-Capture** — Automatically extracts and maintains JWT tokens from manajemen-mitra.bps.go.id via content script injection, eliminating manual token management.

- **Session Monitoring** — Modern session check toast with loading state and compact floating status card to verify session health at a glance.

- **Dark Mode & Responsive** — Full dark mode support with responsive design that works on desktop and tablet screens.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Dashboard (HTML/CSS)              │
├─────────────────────────────────────────────────────┤
│                  App Controller (app.js)             │
├───────────┬───────────┬───────────┬─────────────────┤
│   Auth    │  Surveys  │ Scraper   │  Exporter       │
│  Module   │  Module   │  Module   │  Module         │
├───────────┴───────────┴───────────┴─────────────────┤
│              Core Infrastructure                     │
│  ┌─────────┬─────────┬──────────┬────────┐          │
│  │API      │Config   │Event Bus │Logger  │          │
│  │Client   │Manager  │(Pub/Sub) │        │          │
│  └─────────┴─────────┴──────────┴────────┘          │
├─────────────────────────────────────────────────────┤
│              Chrome Extension Layer                  │
│  ┌──────────────┬──────────────────────────────────┐ │
│  │Background.js │Content Scripts (JWT Injection)   │ │
│  └──────────────┴──────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Design Principles:**
- **Event-driven** — Modules communicate via a centralized EventBus (pub/sub pattern)
- **Singleton services** — Each module exports a singleton instance for consistent state
- **Centralized constants** — All magic numbers and configuration values live in `constants.js`

---

## Installation

### Production (Load Extension)

1. **Clone** the repository
   ```bash
   git clone https://github.com/akhirmbrk/bps-automation.git
   cd bps-automation
   ```

2. **Open Chrome Extensions** — Navigate to `chrome://extensions/`

3. **Enable Developer Mode** — Toggle the switch in the top-right corner

4. **Load Unpacked** — Click "Load unpacked" and select the repository folder (the one containing `manifest.json`)

5. **Verify** — The BPS Automation icon should appear in your toolbar

### After Installation

1. Login to https://fasih-sm.bps.go.id in your browser
2. Login to https://manajemen-mitra.bps.go.id (for Mitra features)
3. Click the **BPS AUTOMATION** icon in your toolbar
4. The dashboard will open in a new tab

---

## Configuration

The extension uses centralized constants in `src/constants.js`. Key settings:

| Setting | Default | Description |
|---------|---------|-------------|
| FASIH Base URL | `https://fasih-sm.bps.go.id` | FASIH server URL |
| Mitra API URL | `https://mitra-api.bps.go.id` | Mitra API endpoint |
| Rate Limit | `300ms` | Delay between API requests |
| Detail Rate Limit | `100ms` | Delay for detail mode extraction |
| Batch Size | `100` | Records per request |
| Max Pagination | `50` | Maximum pagination pages |

---

## Security

- **No hardcoded credentials** — All authentication uses browser session cookies
- **JWT stored securely** — Tokens are stored in `chrome.storage.local` (encrypted by Chromium)
- **Rate limiting** — Built-in delays prevent API abuse and server overload
- **CSP compliant** — Content Security Policy properly configured for Chrome extension environment

---

## Project Structure

```
bps-automation/
├── manifest.json            # Chrome extension manifest v3
├── background.js            # Service worker (messaging, cookies)
├── dashboard.html           # Main UI dashboard
├── main.css                 # Stylesheet
├── xlsx.full.min.js         # SheetJS library for Excel export
├── .gitignore               # Git ignore rules
├── content/
│   └── mitra-jwt-inject.js  # Content script for JWT extraction
├── icons/                   # Extension icons
└── src/
    ├── app.js               # Main application controller
    ├── constants.js         # Centralized constants & config
    ├── core/                # Core infrastructure modules
    ├── modules/             # Feature modules
    └── storage/             # History cache
```

---

## Changelog

### v5.1.0 (2026-04-06)

**Fixes**

- App/duplicate-code: remove duplicate `updateJwtStatus`, `checkJwtStatus`, and `checkAllSessions` functions so that corrupted JWT/session handlers no longer cause runtime errors.
- App/filterAkunMitra: remove duplicate `filterAkunMitra` function so that cached data search works correctly without mutating service data.
- Utils/debounce: replace `func.apply(this, args)` with `func.apply(null, args)` in debounce and throttle so that utility functions work correctly outside class context.

**Changes**

- App/JWT: add JWT auto-capture from manajemen-mitra.bps.go.id via content script so that authentication is maintained without manual token input.
- App/session-monitoring: add compact floating status card and modern session check toast with loading state so that users can verify session status at a glance.
- Constants/config: consolidate magic numbers into named constants so that configuration is centralized and maintainable.

**Improvements**

- Code/consistency: standardize naming, optional chaining, and modern ES6+ syntax across all modules so that codebase follows industry best practices.
- Code/cleanup: remove unreachable code, dead functions, and unnecessary imports so that bundle size and complexity are reduced.
- Structure: move all files from extension/ folder to repository root so that Chrome extension structure follows standard conventions.

[Full Changelog](https://github.com/akhirmbrk/bps-automation/releases/tag/v5.1.0)

---

<p align="center">
  <b>BPS Kabupaten Kutai Kartanegara</b><br />
  <sub>Internal use only</sub>
</p>