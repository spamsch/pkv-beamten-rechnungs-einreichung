# PKV Tracking

Desktop application for tracking private health insurance (PKV) invoices, reimbursements from Beihilfe and Debeka, and wire transfers. Built with Tauri, React, and SQLite.

## Features

- **Invoice management** — Create, edit, delete, and filter invoices with automatic calculation of Beihilfe/Debeka splits based on per-person percentages
- **Status tracking** — Track invoices through their lifecycle: neu, eingereicht, bezahlt, überwiesen, abgeschlossen
- **Batch operations** — Mark multiple invoices as eingereicht, überwiesen, or abgeschlossen at once
- **Dashboard** — Overview with counts, financial totals, per-person breakdown (Beihilfe offen, Debeka offen, zu überweisen), and overdue invoice alerts
- **Excel import** — Import invoices from Excel spreadsheets with flexible column mapping and date parsing
- **Paperless-ngx import** — Browse documents in Paperless-ngx by tags, preview them, and import as invoices with automatic field mapping (correspondent → Arzt, custom field → Betrag, tags → Person)
- **Paperless integration** — Linked invoices open directly in Paperless-ngx via the system browser

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, TanStack Query + Table, React Router
- **Backend**: Rust, Tauri 2, SQLite (rusqlite), reqwest (Paperless API)
- **Build**: Vite, Cargo

## Prerequisites

- [Rust](https://rustup.rs/) (1.77.2+)
- [Node.js](https://nodejs.org/) (LTS)
- Platform-specific Tauri dependencies — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
src/                        # React frontend
  lib/                      # Types, API client, formatting utilities
  hooks/                    # React Query hooks
  components/               # Reusable UI components
  pages/                    # Route pages
src-tauri/                  # Rust backend
  src/                      # Application logic
    db.rs                   # SQLite database layer
    models.rs               # Data models and business logic
    commands.rs             # Tauri command handlers
    paperless.rs            # Paperless-ngx API client
    import.rs               # Excel import logic
  migrations/               # SQL migration scripts
```

## Configuration

Paperless-ngx connection is configured in-app via **Einstellungen** (Settings). Enter your Paperless URL and API token, then use the test button to verify connectivity.

## Persons

Three persons are pre-configured with their insurance split percentages:

| Person   | Beihilfe | Debeka |
|----------|----------|--------|
| Johanna  | 70%      | 30%    |
| Thore    | 80%      | 20%    |
| Isabella | 80%      | 20%    |
