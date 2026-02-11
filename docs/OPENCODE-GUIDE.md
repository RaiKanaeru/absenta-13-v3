# Panduan OpenCode AI — Absenta 13 v3

> Referensi lengkap semua **Agent**, **Slash Command**, **Skill**, dan **Tool** yang tersedia di sidebar OpenCode untuk project ini.

---

## Daftar Isi

- [1. Agent (Sidebar Menu)](#1-agent-sidebar-menu)
  - [1.1 Built-in Agents](#11-built-in-agents)
  - [1.2 Custom Agents (Project-Specific)](#12-custom-agents-project-specific)
- [2. Slash Commands](#2-slash-commands)
- [3. Skills (Knowledge Packs)](#3-skills-knowledge-packs)
- [4. Tools (Automasi)](#4-tools-automasi)
- [5. Cheat Sheet — Kapan Pakai Apa?](#5-cheat-sheet--kapan-pakai-apa)
- [6. Tips & Best Practices](#6-tips--best-practices)

---

## 1. Agent (Sidebar Menu)

Agent adalah "kepribadian AI" berbeda yang bisa kamu pilih di sidebar kiri OpenCode. Setiap agent punya spesialisasi masing-masing.

### 1.1 Built-in Agents

| # | Agent | Keahlian | Kapan Dipakai |
|---|-------|----------|---------------|
| 1 | **Sisyphus** | Orchestrator utama. Mendelegasi tugas ke agent lain, membuat plan, menjalankan keseluruhan workflow. | **Default agent.** Pakai ini untuk semua request umum — dia akan otomatis mendelegasi ke specialist yang tepat. |
| 2 | **Hephaestus** | Builder / implementor. Fokus eksekusi kode dan build. | Ketika kamu butuh agent yang langsung *ngoding* tanpa banyak analisis. Task-task implementation murni. |
| 3 | **Prometheus** | Planner / perencana. Analisis mendalam sebelum implementasi. | Ketika butuh **rencana detail** sebelum ngoding. Misalnya: "Buatkan plan untuk fitur X", "Analisis arsitektur Y". |
| 4 | **Atlas** | Explorer / peneliti codebase. Pencarian kontekstual mendalam. | Ketika butuh **cari tahu** sesuatu di codebase: "Gimana flow auth bekerja?", "Di mana endpoint X didefinisikan?", "Cari semua penggunaan fungsi Y". |
| 5 | **Researcher** | Riset mendalam, baik internal codebase maupun eksternal. | Investigasi yang butuh analisis lebih dalam dari sekedar grep. |
| 6 | **Scribe** | Penulis dokumentasi dan teknikal writing. | Ketika butuh **menulis/update dokumentasi**, README, komentar kode, atau penjelasan teknis. |
| 7 | **Coder** | Coding specialist murni. Fokus implementasi kode. | Tugas coding langsung: "Buat function ini", "Fix bug di file X", "Refactor komponen Y". |
| 8 | **Reviewer** | Code reviewer. Analisis kualitas, keamanan, dan performa. | Ketika butuh **review kode** tanpa modifikasi: cek security, performance, best practices. |

#### Cara Pilih Agent

Klik nama agent di **sidebar kiri** OpenCode. Agent yang aktif akan di-highlight.

> **Tips:** Untuk kebanyakan kasus, cukup pakai **Sisyphus** (default). Dia otomatis mendelegasi ke specialist yang tepat. Pilih agent spesifik hanya jika kamu tahu pasti butuh spesialisasi tertentu.

---

### 1.2 Custom Agents (Project-Specific)

Agent ini dibuat khusus untuk project Absenta 13 dan dikonfigurasi di `opencode.json`:

| Agent | Model AI | Keahlian | Kapan Dipakai |
|-------|----------|----------|---------------|
| **absenta-backend** | GPT-5.1 Codex | Express, MySQL, Redis, server-side logic | Semua pekerjaan backend: API endpoint, database query, controller, middleware. |
| **absenta-frontend** | Gemini 3 Pro | React, Vite, Tailwind, Shadcn UI | Semua pekerjaan frontend: komponen React, styling, halaman baru, form. |
| **absenta-reviewer** | Claude Opus 4.5 | Review kode, security audit, performance | Review perubahan sebelum commit/deploy. Tidak mengubah kode, hanya analisis. |

> **Note:** Custom agent ini bekerja sebagai subagent — mereka dipanggil oleh Sisyphus secara otomatis, atau bisa dipilih langsung di sidebar.

---

## 2. Slash Commands

Ketik `/` di chat untuk melihat daftar command. Command ini adalah **shortcut** untuk task-task yang sering dilakukan.

### Command Referensi Lengkap

| Command | Fungsi | Contoh Penggunaan |
|---------|--------|-------------------|
| `/dev` | Start development server (frontend + backend) | `/dev` → menjalankan `npm run dev:full` |
| `/lint` | Jalankan linter dan lihat error | `/lint` → menjalankan `npm run lint` |
| `/test` | Jalankan semua test | `/test` → menjalankan `npm test` |
| `/typecheck` | Cek TypeScript type errors | `/typecheck` → menjalankan `npx tsc --noEmit` |
| `/build` | Build frontend untuk production | Implisit via `/ship` |
| `/review` | Review perubahan kode saat ini | `/review` → analisis `git diff` untuk security, performance, code style |
| `/ship` | Lint + Build + Commit (siap deploy) | `/ship` → lint → build → commit (tidak push) |
| `/api` | Buat API endpoint baru | `/api attendance` → scaffold route + controller baru |
| `/component` | Buat React component baru | `/component StudentCard` → scaffold komponen TypeScript |
| `/docker-logs` | Lihat log Docker containers | `/docker-logs` atau `/docker-logs mysql` |
| `/acp` | Cek status ACP (Agent Control Protocol) | `/acp` → checklist setup |
| `/mcp-status` | Cek status MCP server connections | `/mcp-status` → lihat koneksi MCP aktif |

### Contoh Alur Kerja dengan Commands

```
# 1. Mulai development
/dev

# 2. Setelah selesai coding, cek error
/lint
/typecheck

# 3. Jalankan test
/test

# 4. Review perubahan
/review

# 5. Siap deploy? Lint + Build + Commit sekaligus
/ship
```

---

## 3. Skills (Knowledge Packs)

Skills adalah **paket pengetahuan** yang di-inject ke agent saat bekerja. Mereka berisi aturan, pattern, dan guideline spesifik.

### Project Skills (`.opencode/skills/`)

| Skill | Scope | Isi |
|-------|-------|-----|
| **absenta-frontend** | `src/` — React, Tailwind, Shadcn | Aturan: absolute imports (`@/`), component structure, apiCall usage, toast error handling, Tailwind styling, Lucide icons. |
| **absenta-backend** | `server/` — Express, MySQL, Redis | Aturan: ESM only, parameterized SQL, errorHandler helpers, createLogger, JSDoc mandatory, route patterns. |
| **absenta-devops** | Docker, deployment, ops | Aturan: docker-compose workflow, safe commands, CORS troubleshooting, minimal reversible fixes. |

### Kapan Skills Dipakai?

Skills **otomatis dimuat** oleh agent saat task cocok dengan domain-nya. Contoh:
- Kamu minta "Buat komponen StudentList" → skill `absenta-frontend` otomatis aktif
- Kamu minta "Tambah endpoint /api/guru/rekap" → skill `absenta-backend` otomatis aktif
- Kamu minta "Cek kenapa container crash" → skill `absenta-devops` otomatis aktif

### Installed Skills (`.agents/skills/`)

| Skill | Fungsi |
|-------|--------|
| **vercel-react-best-practices** | 50+ rules dari Vercel tentang React performance: memoization, suspense boundaries, lazy loading, hydration, bundle optimization, server patterns. |
| **find-skills** | Helper untuk menemukan dan menginstall skill baru dari registry. |

---

## 4. Tools (Automasi)

Tools adalah **fungsi executable** yang bisa dipanggil agent secara programmatic. Berbeda dari slash commands (yang kamu ketik), tools dipanggil otomatis oleh agent.

### Custom Tools (`.opencode/tools/`)

| Tool | Fungsi | Parameter |
|------|--------|-----------|
| **absenta_checks** | Jalankan verification suite (lint, test, build) sekaligus | `profile`: `"quick"` (lint+build), `"full"` (lint+test+build), `"backend"` (test:server saja) |
| **docker_status** | Cek status Docker containers + log terbaru | `service`: nama container (default: `"app"`), `tail`: jumlah baris log (default: `50`) |

### Contoh Penggunaan

Agent akan otomatis memanggil tools ini. Tapi kamu juga bisa minta secara eksplisit:

```
"Jalankan absenta_checks profile full"
→ Agent akan lint → test → build secara berurutan

"Cek docker_status untuk container mysql, 100 baris terakhir"
→ Agent akan tampilkan docker-compose ps + logs --tail=100 mysql
```

---

## 5. Cheat Sheet — Kapan Pakai Apa?

### Skenario Sehari-hari

| Saya mau... | Pakai |
|---|---|
| Mulai coding biasa | **Sisyphus** (default) — dia atur semuanya |
| Langsung coding tanpa basa-basi | **Coder** agent |
| Bikin plan sebelum implementasi | **Prometheus** agent |
| Cari tahu cara kerja fitur tertentu | **Atlas** agent |
| Review kode sebelum commit | `/review` atau **Reviewer** agent |
| Bikin komponen React baru | `/component NamaKomponen` |
| Bikin API endpoint baru | `/api namaEndpoint` |
| Cek semua error sekaligus | `/lint` lalu `/typecheck` |
| Siap deploy | `/ship` |
| Debug Docker yang error | `/docker-logs` |
| Tulis dokumentasi | **Scribe** agent |

### Quick Decision Tree

```
Mau ngapain?
│
├─ Coding / Fix bug
│  ├─ Simple (1 file) ──────────────→ Coder / Sisyphus
│  └─ Complex (multi-file) ─────────→ Sisyphus (auto-delegate)
│
├─ Perlu plan dulu
│  └─ "Buatkan rencana untuk..." ───→ Prometheus
│
├─ Cari tahu / investigasi
│  ├─ Di codebase ini ──────────────→ Atlas
│  └─ Library/framework eksternal ──→ Researcher
│
├─ Review / Audit
│  ├─ Quick review ─────────────────→ /review
│  └─ Deep security audit ──────────→ Reviewer agent
│
├─ Scaffold / Generate
│  ├─ React component ──────────────→ /component
│  └─ API endpoint ─────────────────→ /api
│
├─ Ops / Deploy
│  ├─ Cek container ────────────────→ /docker-logs
│  ├─ Lint + Build + Commit ────────→ /ship
│  └─ Troubleshoot ─────────────────→ absenta-devops skill (otomatis)
│
└─ Dokumentasi
   └─ Tulis/update docs ───────────→ Scribe agent
```

---

## 6. Tips & Best Practices

### Do's

- **Pakai Sisyphus untuk task umum** — dia paling pintar mendelegasi ke specialist yang tepat
- **Pakai slash commands** untuk workflow repetitif (`/lint`, `/test`, `/ship`)
- **Jelaskan konteks** — "Fix bug di halaman guru yang data tidak muncul" lebih baik dari "Fix bug"
- **Minta plan dulu** untuk fitur besar — "Buatkan plan untuk fitur export PDF" sebelum implementasi
- **Review sebelum commit** — `/review` menangkap masalah sebelum masuk production

### Don'ts

- **Jangan pilih agent random** — biarkan Sisyphus yang delegate, kecuali kamu yakin
- **Jangan skip testing** — selalu `/test` atau `/lint` setelah perubahan signifikan
- **Jangan langsung `/ship`** tanpa review — terutama untuk perubahan besar
- **Jangan edit `src/components/ui/*`** — ini komponen Shadcn, jangan dimodifikasi manual

### Workflow yang Direkomendasikan

```
1. Jelaskan fitur/bug ke Sisyphus
2. Sisyphus buat plan → kamu approve/revisi
3. Sisyphus delegate implementasi
4. /lint → /typecheck → /test
5. /review
6. /ship (jika semua OK)
```

---

## Struktur Konfigurasi

```
.opencode/
├── agents/          # Custom agent definitions (kosong, pakai opencode.json)
├── commands/        # Slash command definitions
│   ├── acp.md       # /acp
│   ├── api.md       # /api
│   ├── component.md # /component
│   ├── dev.md       # /dev
│   ├── docker-logs.md
│   ├── lint.md      # /lint
│   ├── mcp-status.md
│   ├── review.md    # /review
│   ├── ship.md      # /ship
│   ├── test.md      # /test
│   └── typecheck.md # /typecheck
├── rules/
│   └── workflow.md  # Workflow rules applied to all agents
├── skills/
│   ├── absenta-backend/SKILL.md
│   ├── absenta-frontend/SKILL.md
│   └── absenta-devops/SKILL.md
├── tools/
│   ├── absenta_checks.mjs   # Verification suite tool
│   └── docker_status.mjs    # Docker status tool
└── themes/          # UI themes
```

---

*Dibuat untuk project Absenta 13 v3 — Sistem Absensi Digital Modern*
