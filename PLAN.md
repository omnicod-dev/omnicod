# OmniCod — Master Geliştirme Planı

> Oluşturulma: 2026-06-03  
> Durum: Aktif — her geliştirme kararı buradan alınır  
> Bu dosya kaynak-kod yetkisidir. Mimari değişiklik = bu dosyayı güncelle.

---

## 0. Proje Kimliği

**OmniCod** — OpenCode'dan üstün, sıfırdan yazılmış terminal AI asistanı.

### Temel Diferansiyatörler (OpenCode'a karşı)

| Özellik | OpenCode | OmniCod |
|---|---|---|
| Mimari | Monolitik, Effect-TS everywhere | Plugin tabanlı, async/await |
| Multi-agent | Same-process child session | Worker thread isolation, 3+1 orchestration |
| Skill sistemi | Yok | OmniRule embedded (218+ skill, 26 agent) |
| Provider ekleme | Core değiştirmek gerekiyor | npm paketi yükle, kaydettir |
| Token sayımı | karakter/4 tahmini | tiktoken (model-specific) |
| TUI kütüphanesi | opentui (deneysel, topluluk yok) | Ink (React, battle-tested) |
| Hook API | experimental.* karışıklığı | Versioned stable (v1.tool.before) |
| Depolama | JSON + SQLite dual | Sadece SQLite |
| MCP | Yok | MCP client (harici server'ları consume eder) |
| Sandbox | Yok (sadece kullanıcı onayı) | Process-level isolation |

---

## 1. Tech Stack — Kesinleşmiş Kararlar

### Runtime & Dil
| Bileşen | Seçim | Neden |
|---|---|---|
| Runtime | **Bun 1.3+** | Hızlı, native TypeScript, tek araç (build+run+pkg) |
| Dil | **TypeScript 5.8+** | strict mode, exactOptionalPropertyTypes |
| Node uyumluluğu | Bun'ın Node API uyumluluğu | Ink ve diğer npm paketleri çalışır |

### AI / LLM Katmanı
| Bileşen | Seçim | Neden |
|---|---|---|
| Provider abstraction | **Vercel AI SDK 6.x** (`ai`) | OpenCode'dan alınan doğru karar, 20+ provider |
| Token sayımı | **tiktoken** (`js-tiktoken`) | Model-specific BPE, karakter/4 tahmini değil |
| Streaming | AI SDK `streamText()` → SSE | Zaten iyi çalışıyor |
| Model metadata | **models.dev API** | Merkezi model veritabanı |

### Desteklenen Providerlar (built-in, AI SDK üzerinden)
- `@ai-sdk/anthropic` — Claude 3/4 serisi
- `@ai-sdk/openai` — GPT-4o, o-serisi
- `@ai-sdk/google` — Gemini 2.x
- `@ai-sdk/openrouter` — 200+ model proxy
- `ollama-ai-provider` — Local model desteği

Her provider kendi `ProviderPlugin` class'ında. Core değişikliği gerektirmez.

### Depolama
| Bileşen | Seçim | Neden |
|---|---|---|
| Database | **SQLite** (`bun:sqlite` native) | Local-first, zero-dep, hızlı |
| ORM | **Drizzle ORM** | Type-safe, migration sistemi, Bun uyumlu |
| Schema versioning | Drizzle migrations | `drizzle-kit generate` ile |

JSON dual storage **yok**. Tek canonical kaynak: SQLite.

### TUI
| Bileşen | Seçim | Neden |
|---|---|---|
| Framework | **Ink 5.x** (React TUI) | Battle-tested, büyük topluluk, test edilebilir |
| Test | **@ink-testing-library** | Unit test yazılabilir TUI bileşenleri |
| Rendering | React 18 + Ink renderer | Component tabanlı, state yönetimi kolay |

### HTTP & Olaylar
| Bileşen | Seçim | Neden |
|---|---|---|
| HTTP framework | **Hono** | Lightweight, TypeScript-first, Bun uyumlu |
| Event streaming | **SSE** (Server-Sent Events) | Tek yönlü push, WebSocket gerek yok |
| Auth | **JWT** (Bearer token) | OpenCode'un Basic Auth'ından güvenli |
| Loopback port | `127.0.0.1:7777` (default) | Config ile override edilebilir |

### MCP
| Bileşen | Seçim | Neden |
|---|---|---|
| Rol | **MCP Client only** | Harici MCP server'ları consume eder |
| SDK | `@modelcontextprotocol/sdk` | Resmi Anthropic SDK |
| Konfigürasyon | `.omnicod/mcp.json` | claude_desktop_config formatıyla uyumlu |

MCP server olma özelliği **ertelendi** (web UI fazından sonra değerlendirilebilir).

### Multi-Agent
| Bileşen | Seçim | Neden |
|---|---|---|
| İzolasyon | **Bun Worker threads** | OpenCode'un same-process hatasını tekrarlamıyoruz |
| İletişim | `MessageChannel` + structured clone | Tip-güvenli mesajlaşma |
| Koordinasyon | Orchestrator Agent (built-in) | OmniRule'un ORCHESTRATOR_AGENT'ından türetildi |
| Model | **3+1** (1 orchestrator + N worker) | Orchestrator yönlendirir, worker'lar çalıştırır |

### FP / Async
- **Effect-TS kullanılmıyor.** Her yerde `async/await` + `AbortController`.
- Hata yönetimi: typed `Result<T, E>` pattern (Effect olmadan).
- Concurrency: `Promise.all`, `Promise.race`, Bun worker threads.

---

## 2. Paket Yapısı (Monorepo)

3 paket — OpenCode'un 25 paketine karşı.

```
omnicod/
├── packages/
│   ├── core/        ← Tüm engine mantığı
│   ├── cli/         ← TUI giriş noktası, Ink bileşenleri
│   └── sdk/         ← Dış kullanım için public API
├── bun.lockb
├── package.json     ← Workspace root
└── turbo.json       ← Build pipeline (opsiyonel, sadece paralel build için)
```

### `packages/core` — İç Yapı

```
core/src/
├── agent/
│   ├── loop.ts          ← Ana agent döngüsü (streamText + tool dispatch)
│   ├── orchestrator.ts  ← Multi-agent koordinatörü
│   ├── worker.ts        ← Worker thread agent runner
│   ├── pool.ts          ← Agent worker pool yönetimi
│   └── types.ts         ← AgentConfig, AgentResult, AgentEvent
│
├── session/
│   ├── manager.ts       ← Session CRUD, aktif session takibi
│   ├── compaction.ts    ← Token overflow → LLM özeti → tail_turns koruması
│   ├── history.ts       ← Mesaj geçmişi, part tipleri
│   └── types.ts         ← Session, Part, CompactionConfig
│
├── provider/
│   ├── registry.ts      ← Provider kayıt + discovery
│   ├── plugin.ts        ← ProviderPlugin abstract class
│   ├── anthropic.ts     ← Claude provider plugin
│   ├── openai.ts        ← OpenAI provider plugin
│   ├── google.ts        ← Gemini provider plugin
│   ├── openrouter.ts    ← OpenRouter provider plugin
│   ├── ollama.ts        ← Ollama provider plugin
│   ├── tokenizer.ts     ← tiktoken wrapper, model-specific sayım
│   └── types.ts         ← ProviderConfig, ModelInfo
│
├── tool/
│   ├── registry.ts      ← Tool kayıt + lookup
│   ├── executor.ts      ← Tool execution pipeline
│   ├── sandbox.ts       ← Process-level izolasyon (shell için)
│   ├── built-in/
│   │   ├── shell.ts     ← Komut çalıştırma
│   │   ├── read.ts      ← Dosya okuma
│   │   ├── write.ts     ← Dosya yazma
│   │   ├── edit.ts      ← Dosya düzenleme
│   │   ├── glob.ts      ← Dosya arama
│   │   ├── grep.ts      ← İçerik arama
│   │   ├── webfetch.ts  ← HTTP istek
│   │   ├── task.ts      ← Subagent spawn
│   │   └── todo.ts      ← Görev listesi
│   └── types.ts         ← ToolDef, ExecuteResult, ToolContext
│
├── hook/
│   ├── emitter.ts       ← Typed EventEmitter, hook tetikleme
│   ├── registry.ts      ← Hook kayıt + öncelik sıralaması
│   └── types.ts         ← HookEvent, HookHandler, HookVersion
│
├── skill/
│   ├── detector.ts      ← Proje tipi tespiti (Next.js, React, Go...)
│   ├── injector.ts      ← Skill → system prompt injection
│   ├── library/         ← OmniRule'dan entegre edilmiş 218+ skill
│   │   ├── frontend/    ← nextjs-expert, react-expert, vue-expert...
│   │   ├── backend/     ← nodejs-expert, go-expert, python-expert...
│   │   ├── infra/       ← docker, k8s, terraform, aws...
│   │   ├── data/        ← supabase-patterns, drizzle-orm, prisma...
│   │   └── business/    ← stripe-integration, clerk-auth, analytics...
│   └── types.ts         ← SkillDef, SkillMatch, InjectionContext
│
├── permission/
│   ├── evaluator.ts     ← Wildcard kural değerlendirmesi
│   ├── store.ts         ← Session-scoped onaylı izinler
│   ├── parser.ts        ← tree-sitter ile komut parse
│   └── types.ts         ← PermissionRule, PermissionDecision
│
├── mcp/
│   ├── client.ts        ← MCP server bağlantısı + tool discovery
│   ├── bridge.ts        ← MCP tool'larını OmniCod tool registry'ye köprüle
│   └── types.ts         ← MCPServer, MCPToolDef
│
├── storage/
│   ├── schema.ts        ← Drizzle tablo tanımları
│   ├── migrations/      ← SQL migration dosyaları
│   ├── queries.ts       ← Type-safe sorgu fonksiyonları
│   └── db.ts            ← SQLite bağlantısı + singleton
│
└── server/
    ├── hono.ts          ← Hono app, route tanımları
    ├── sse.ts           ← SSE event stream yönetimi
    ├── auth.ts          ← JWT middleware
    └── types.ts         ← API request/response tipleri
```

### `packages/cli` — İç Yapı

```
cli/src/
├── index.ts             ← Entry point, CLI parse (commander veya yargs)
├── bootstrap.ts         ← Server başlatma, SQLite init, hook yükleme
├── commands/
│   ├── run.ts           ← Ana interaktif mod
│   ├── config.ts        ← Config yönetimi
│   └── mcp.ts           ← MCP server ekle/kaldır
├── tui/
│   ├── App.tsx          ← Kök Ink bileşeni
│   ├── Chat.tsx         ← Mesaj listesi + input
│   ├── Message.tsx      ← Tek mesaj render (text, tool, system)
│   ├── ToolCall.tsx     ← Tool çağrısı görselleştirme
│   ├── PermissionPrompt.tsx ← İzin sorma UI
│   ├── AgentStatus.tsx  ← Multi-agent durumu (worker listesi)
│   ├── StatusBar.tsx    ← Alt bar (model, token, session)
│   └── hooks/           ← Ink custom hooks (useSSE, useSession...)
└── config/
    ├── loader.ts        ← .omnicod/config.json okuma
    └── types.ts         ← OmniCodConfig
```

### `packages/sdk` — İç Yapı

```
sdk/src/
├── client.ts            ← OmniCodClient (HTTP + SSE wrapper)
├── types.ts             ← Public tipler (re-export from core)
└── index.ts             ← Public API surface
```

---

## 3. Veri Modeli (SQLite Schema)

```typescript
// sessions tablosu
sessions: {
  id:         text PRIMARY KEY,  // ulid()
  title:      text,
  created_at: integer,           // unix ms
  updated_at: integer,
  parent_id:  text REFERENCES sessions(id),  // multi-agent: parent session
  config:     text,              // JSON: model, provider, temperature
  status:     text,              // "active" | "complete" | "error"
}

// parts tablosu — tüm mesaj içerikleri
parts: {
  id:         text PRIMARY KEY,
  session_id: text REFERENCES sessions(id),
  sequence:   integer,           // sıralama
  role:       text,              // "user" | "assistant" | "tool" | "system"
  type:       text,              // "text" | "tool_call" | "tool_result" | "compaction" | "error"
  content:    text,              // JSON veya raw text
  tokens:     integer,           // o part'ın token maliyeti
  created_at: integer,
}

// tool_calls tablosu — tool execution metadata
tool_calls: {
  id:          text PRIMARY KEY,
  part_id:     text REFERENCES parts(id),
  tool_name:   text,
  args:        text,             // JSON
  result:      text,             // JSON
  duration_ms: integer,
  status:      text,             // "pending" | "success" | "error" | "denied"
  created_at:  integer,
}

// config tablosu — key-value store
config: {
  key:   text PRIMARY KEY,
  value: text,                   // JSON
}

// mcp_servers tablosu
mcp_servers: {
  id:      text PRIMARY KEY,
  name:    text UNIQUE,
  command: text,                 // spawn komutu
  args:    text,                 // JSON array
  env:     text,                 // JSON object
  enabled: integer,              // 0 | 1
}
```

---

## 4. Hook Sistemi — Versioned API

### Stabil Hook'lar (v1.*)

```typescript
type HookEvent = 
  // Session lifecycle
  | "v1.session.start"          // { session: Session }
  | "v1.session.end"            // { session: Session, reason: string }
  | "v1.session.compact"        // { summary: string, retained_turns: number }
  
  // Message flow
  | "v1.chat.message"           // { role, content } → değiştirilebilir
  | "v1.chat.system"            // { prompt: string } → değiştirilebilir
  
  // Tool execution
  | "v1.tool.before"            // { tool, args } → args değiştirilebilir
  | "v1.tool.after"             // { tool, args, result } → result değiştirilebilir
  
  // Permission
  | "v1.permission.ask"         // { tool, pattern } → karar override edilebilir
  
  // Skill injection
  | "v1.context.inject"         // { skills: SkillDef[] } → skill listesi değiştirilebilir
  
  // Multi-agent
  | "v1.agent.spawn"            // { child_session_id, type, prompt }
  | "v1.agent.complete"         // { child_session_id, result }
  | "v1.agent.error"            // { child_session_id, error }
  
  // MCP
  | "v1.mcp.connected"          // { server_name, tools: string[] }
  | "v1.mcp.disconnected"       // { server_name }
```

### Hook Kayıt API

```typescript
// Kullanım
omnicod.hooks.on("v1.tool.before", async (event, ctx) => {
  if (event.tool === "shell" && event.args.command.includes("rm")) {
    ctx.log("rm komutu tespit edildi")
  }
  return event  // değiştirilmemiş dön, ya da { ...event, args: {...} }
})

// Öncelik (düşük önce çalışır, yüksek son çalışır)
omnicod.hooks.on("v1.session.start", handler, { priority: 10 })
```

### Hook Çalışma Sırası

- Tüm handler'lar **sırayla** çalışır (OpenCode'dan farklı değil ama planlı)
- Her handler bir sonrakine event'i geçirir (middleware zinciri)
- Herhangi bir handler hata fırlatırsa → zincir durur, hata loglanır
- `v1.permission.ask` → handler "deny" döndürebilir → tool iptal edilir

---

## 5. Agent Loop — Detaylı Akış

### Tek Agent Döngüsü

```
kullanıcı mesajı
  → v1.chat.message hook
  → skill detector → proje tipini tespit et
  → v1.context.inject hook → system prompt hazırla
  → MCP tool'larını registry'e ekle
  → streamText(messages, tools, system)
    ↓ stream başlar
    ↓ text delta → SSE "text" event
    ↓ tool_call delta → tool dispatching
      → v1.tool.before hook
      → permission evaluator
        → "allow" → sandbox → execute
        → "ask"   → TUI prompt → kullanıcı onayı → execute
        → "deny"  → tool_result: "Permission denied"
      → v1.tool.after hook
      → SSE "tool" event
    ↓ stream biter → v1.chat.message (assistant) hook
  → token sayımı (tiktoken)
  → overflow? → compaction → continue
```

### Compaction Mantığı (OpenCode'dan alınan iyi karar)

```
usable_tokens = model.context_limit - max_output_tokens - 20_000 (buffer)
actual_tokens = input + output + cache.read + cache.write

if actual_tokens >= usable_tokens:
  → compaction başlar
  → son 2 turn (tail_turns) korunur
  → eski tool_result'lar 2000 karaktere kısaltılır (TOOL_OUTPUT_MAX_CHARS)
  → LLM'e: "Şu ana kadar yapılanları özetle"
  → özet + son 2 turn yeni mesaj geçmişi olur
  → "Devam et" otomatik eklenir
  → compaction başarısız → agent "stop" döner (sonsuz döngü koruması)
```

**Sabitler:**
```typescript
const COMPACTION_BUFFER    = 20_000   // token
const TOOL_OUTPUT_MAX_CHARS = 2_000   // karakter
const DEFAULT_TAIL_TURNS   = 2        // turn
const PRUNE_MINIMUM        = 20_000   // token
const PRUNE_PROTECT        = 40_000   // token
```

### 3+1 Multi-Agent Orchestration

```
Orchestrator Agent (ana process'te çalışır)
  │
  ├── v1.agent.spawn → Worker Thread 1 (Explore Agent)
  │     ├── kendi SQLite session'ı
  │     ├── kendi tool registry'si (subset — güvenli)
  │     └── MessageChannel üzerinden sonuç → Orchestrator
  │
  ├── v1.agent.spawn → Worker Thread 2 (Code Agent)
  │     ├── kendi SQLite session'ı
  │     └── MessageChannel üzerinden sonuç → Orchestrator
  │
  └── v1.agent.spawn → Worker Thread 3 (Review Agent)
        ├── kendi SQLite session'ı
        └── MessageChannel üzerinden sonuç → Orchestrator

Worker'lar tamamlandığında:
  → v1.agent.complete hook
  → Orchestrator sonuçları birleştirir
  → Kullanıcıya sunar
```

**Worker izolasyon kuralları:**
- Her worker kendi `MessageChannel` çiftiyle iletişim kurar
- Worker'lar birbirine doğrudan mesaj gönderemez (Orchestrator köprüler)
- Her worker'a izin kuralları parent'tan türetilir ve **kısıtlanır** (parent'ın sahip olmadığı izin verilmez)
- Worker crash → `v1.agent.error` → Orchestrator bilgilendirilir, diğer worker'lar devam eder

### Built-in Agent Tipleri (OmniRule'dan entegre)

```typescript
type BuiltInAgentType =
  | "explore"        ← Kod arama, dosya keşfi (read-only tools)
  | "code"           ← Yazma, düzenleme (read+write tools)
  | "review"         ← Kod inceleme (read-only, no shell)
  | "test"           ← Test çalıştırma (shell, read-only write)
  | "docs"           ← Dokümantasyon (read+write, no shell)
  | "performance"    ← OmniRule PERFORMANCE_AGENT'tan
  | "analytics"      ← OmniRule ANALYTICS_AGENT'tan
  | "security"       ← Güvenlik analizi (read-only)
  | "debug"          ← Hata ayıklama (read+shell)
  | "custom"         ← .omnicod/agents/*.md dosyaları
```

---

## 6. Skill Sistemi (OmniRule Entegrasyonu)

OmniRule'un 218+ skill'i ve 26 agent'ı OmniCod'un `core/src/skill/` modülüne taşındı.

### Skill Detection Pipeline

```
proje dizini analiz edilir:
  → package.json, go.mod, Cargo.toml, requirements.txt, etc.
  → dosya ağacı örnekleme (.ts, .tsx, .go, .py, .rs...)
  → özel marker'lar (next.config.ts → nextjs-expert)
  → git history örnekleme (commit pattern)

tespit edilen tipler → ilgili skill'ler yüklenir
  → nextjs-expert + react-expert + typescript-expert
  → sistem promptuna inject edilir (v1.context.inject hook)
```

### Skill Tanım Formatı

```typescript
interface SkillDef {
  id: string                    // "nextjs-expert"
  name: string                  // "Next.js Expert"
  description: string           // LLM'e açıklama
  detector: SkillDetector       // Nasıl tespit edilir
  system_prompt: string         // Inject edilecek içerik
  priority: number              // Çakışmada öncelik
  tags: string[]                // ["frontend", "react", "ssr"]
}

interface SkillDetector {
  files?: string[]              // package.json içinde aranacaklar
  packages?: string[]           // bağımlılık isimleri
  extensions?: string[]         // dosya uzantıları
  paths?: string[]              // glob pattern'leri
  custom?: (dir: string) => boolean | Promise<boolean>
}
```

### OmniRule'dan Migrate Edilecek Skill Kategorileri

```
skill/library/
├── frontend/
│   ├── nextjs-expert.ts        ✓ mevcut
│   ├── react-expert.ts         ✓ mevcut
│   ├── vue-expert.ts           ✓ mevcut
│   ├── nuxt-expert.ts          ✓ mevcut (yeni eklendi)
│   ├── remix-expert.ts         ✓ mevcut (yeni eklendi)
│   └── expo-router.ts          ✓ mevcut (yeni eklendi)
├── backend/
│   ├── nodejs-expert.ts        ✓ mevcut
│   ├── bun-patterns.ts         ✓ mevcut (yeni eklendi)
│   ├── python-expert.ts        ✓ mevcut
│   └── go-expert.ts            ✓ mevcut
├── data/
│   ├── supabase-patterns.ts    ✓ mevcut (yeni eklendi)
│   ├── drizzle-orm.ts          ✓ mevcut (yeni eklendi)
│   ├── trpc-patterns.ts        ✓ mevcut (yeni eklendi)
│   └── prisma-expert.ts        ✓ mevcut
├── infra/
│   ├── docker-expert.ts        ✓ mevcut
│   └── turborepo-patterns.ts   ✓ mevcut (yeni eklendi)
└── business/
    ├── stripe-integration.ts   ✓ mevcut (yeni eklendi)
    ├── clerk-auth.ts           ✓ mevcut (yeni eklendi)
    └── llm-integration.ts      ✓ mevcut (yeni eklendi)
```

---

## 7. Permission Sistemi

OpenCode'un wildcard sistemi korundu + process-level enforcement eklendi.

### Kural Yapısı

```typescript
interface PermissionRule {
  tool: string          // "shell" | "write" | "read" | "*"
  pattern: string       // glob pattern — "git *", "rm *", "/etc/*"
  action: "allow" | "ask" | "deny"
  scope: "session" | "project" | "global"
}
```

### Kural Değerlendirme Sırası

1. `global` kurallar (en düşük öncelik)
2. `project` kurallar (`.omnicod/permissions.json`)
3. `session` kurallar (runtime'da onaylananlar)
4. Hiçbiri eşleşmezse → `"ask"`

### Shell Sandbox (Yeni)

```
shell tool çağrısı
  → permission evaluator → "allow"
  → sandbox.execute(command, { workdir, env })
    → Bun.spawn ile child process
    → workdir: sadece proje dizini (chroot benzeri kısıtlama)
    → env: filtrelenmiş (sadece whitelist'teki env var'lar)
    → timeout: 30s default (config ile override)
    → output: stdout + stderr yakalanır, 50K char limit
```

Tam OS-level sandbox (seccomp/bubblewrap) **v2 milestone** — MVP'de workdir kısıtlaması + env filtreleme yeterli.

---

## 8. Konfigürasyon Sistemi

### Dosya Hiyerarşisi

```
~/.omnicod/
├── config.json          ← Global kullanıcı ayarları
├── permissions.json     ← Global izin kuralları
└── mcp.json            ← Global MCP server listesi

<proje-dizini>/.omnicod/
├── config.json          ← Proje-özel ayarlar (global'i override eder)
├── permissions.json     ← Proje-özel izinler
├── mcp.json            ← Proje-özel MCP server'ları
├── agents/             ← Custom agent tanımları (.md)
└── tools/              ← Custom tool tanımları (.ts)
```

### `config.json` Şeması

```typescript
interface OmniCodConfig {
  provider: {
    default: string           // "anthropic" | "openai" | "google" | "ollama"
    models: {
      main: string            // "claude-sonnet-4-6"
      small: string           // Compaction için küçük model
    }
  }
  session: {
    tail_turns: number        // default: 2
    auto_compact: boolean     // default: true
  }
  skill: {
    auto_detect: boolean      // default: true
    disabled: string[]        // Kapatılan skill id'leri
  }
  permissions: {
    default_action: "ask" | "allow" | "deny"  // default: "ask"
    rules: PermissionRule[]
  }
  sandbox: {
    shell_timeout_ms: number  // default: 30000
    env_whitelist: string[]   // İzin verilen env var'lar
  }
  server: {
    port: number              // default: 7777
    auth_token: string        // otomatik generate edilir
  }
  multi_agent: {
    max_workers: number       // default: 4
    worker_timeout_ms: number // default: 300000 (5 dakika)
  }
}
```

---

## 9. SSE Event Protokolü

TUI ve SDK, HTTP API'yi SSE üzerinden dinler. Tüm eventler type-safe.

```typescript
type SSEEvent =
  | { type: "text";          data: { delta: string; session_id: string } }
  | { type: "tool_call";     data: { id: string; tool: string; args: unknown } }
  | { type: "tool_result";   data: { id: string; result: unknown; status: string } }
  | { type: "permission";    data: { id: string; tool: string; pattern: string; action: string } }
  | { type: "agent_spawn";   data: { id: string; type: string; session_id: string } }
  | { type: "agent_status";  data: { id: string; status: string; progress?: string } }
  | { type: "agent_done";    data: { id: string; result: string } }
  | { type: "compaction";    data: { session_id: string; tokens_before: number; tokens_after: number } }
  | { type: "error";         data: { message: string; code: string } }
  | { type: "done";          data: { session_id: string } }
```

---

## 10. HTTP API Endpoint'leri

```
POST   /v1/session               ← Yeni session oluştur
GET    /v1/session               ← Session listesi
GET    /v1/session/:id           ← Session detayı
DELETE /v1/session/:id           ← Session sil

POST   /v1/session/:id/message   ← Mesaj gönder (SSE stream döner)
POST   /v1/session/:id/stop      ← Aktif agent'ı durdur

GET    /v1/session/:id/events    ← SSE event stream

POST   /v1/permission/:id/respond ← İzin sorusuna yanıt ver (allow/deny)

GET    /v1/provider              ← Kayıtlı provider listesi
GET    /v1/provider/:id/models   ← Provider model listesi

GET    /v1/tool                  ← Kayıtlı tool listesi
GET    /v1/skill                 ← Aktif skill listesi

GET    /v1/mcp                   ← MCP server listesi
POST   /v1/mcp                   ← MCP server ekle
DELETE /v1/mcp/:name             ← MCP server kaldır

GET    /v1/health                ← Auth gerektirmez, sunucu durumu
```

---

## 11. Geliştirme Fazları

### Faz 0 — Temel Iskelet ✅ TAMAMLANDI (2026-06-04)

**Hedef**: Çalışan monorepo, SQLite, provider bağlantısı, "Hello World" agent loop

**Görevler:**
- [x] Bun workspace monorepo kurulumu (core, cli, sdk)
- [x] TypeScript strict config (tsconfig.json)
- [x] SQLite schema v1 (sessions, parts, tool_calls, config, mcp_servers tabloları)
- [x] Drizzle ORM kurulumu + ilk migration (5 tablo, `__drizzle_migrations` kayıtlı)
- [x] Provider registry iskelet (ProviderPlugin abstract class)
- [x] Anthropic provider plugin
- [x] OpenAI provider plugin (Faz 1'den öne çekildi)
- [x] OpenRouter provider plugin (Faz 4'ten öne çekildi)
- [x] Google Gemini provider plugin (Faz 1'den öne çekildi)
- [x] OpenCode/Zenmux provider plugin (baseURL: zenmux.ai/api/v1)
- [x] Provider auto-detection (ANTHROPIC_API_KEY → OPENCODE_API_KEY → OPENAI_API_KEY sırası)
- [x] tiktoken wrapper (model-specific: cl100k_base / o200k_base)
- [x] Agent loop: generateText (non-streaming, tüm provider'larda güvenilir)
- [x] Hook emitter v1.* versioned API (types + emitter)
- [x] Session manager (SQLite persist)
- [x] Tool registry iskelet (boş, Faz 1'de doldurulacak)
- [x] Hono server + `/v1/health`, `/v1/session`, `/v1/provider` endpoint'leri
- [x] SSE event manager iskelet
- [x] `bun run dev` çalışıyor (interaktif + pipe modu)

**Notlar:**
- `streamText` → `generateText` değişikliği: zenmux.ai SSE stream kapatmıyor; Faz 1'de TUI ile birlikte provider-specific streaming eklenecek
- Zenmux.ai permission hatası: kod doğru, abonelik/key sorunu

**Başarı kriteri**: `echo "Merhaba, OmniCod" | bun run dev` → yanıt alır ✅ (doğrudan API key ile doğrulandı)

---

### Faz 1 — Core Agent Loop ✅ TAMAMLANDI (2026-06-04)

**Hedef**: Tam özellikli tek-agent, compaction, izinler, built-in tool'lar

**Görevler:**
- [x] Tool registry + executor pipeline (`tool/executor.ts` — hook + permission + SQLite kayıt)
- [x] Built-in tool'lar: shell, read, write, edit, glob, grep (Zod parametreli)
- [x] Permission system (wildcard evaluator + session store + PermissionGate)
- [x] Shell sandbox (workdir kısıtlama + env whitelist + 30s timeout + 50K output limit)
- [x] Compaction sistemi (PLAN.md sabitleriyle — BUFFER=20K, TAIL=2, PRUNE=2K)
- [x] Hook emitter bağlantısı (v1.tool.before, v1.tool.after executor'da aktif)
- [x] Session CRUD (Faz 0'da tamamlandı)
- [x] Tool call + result SQLite kayıt (executor içinde)
- [x] Agent loop yeniden yazıldı: streamText + tools + maxSteps=20 + compaction
- [x] Ink TUI: App, Message, ChatInput, PermissionPrompt, StatusBar bileşenleri
- [x] Permission prompt UI (Y/N klavye girişiyle, TUI'da modal olarak gösterilir)
- [x] ExecutorEvents → TUI köprüsü (permission_ask event'i App'e iletilir)
- [x] SSE üzerinden TUI event güncellemesi (fullStream → onText/onToolCall/onToolResult)
- [x] OpenAI + Google provider plugin'leri (Faz 0'da tamamlandı)

**Başarı kriteri**: Gerçek proje dizininde Claude'la interaktif terminal konuşması, tool onayı, session özeti.

---

### Faz 2 — Skill Sistemi & OmniRule Entegrasyonu ✅ TAMAMLANDI (2026-06-04)

**Hedef**: Otomatik skill detection, OmniRule skill library taşıması

**Notlar:**
- OmniRule ayrı repo olarak kalır (Claude Code entegrasyonu için)
- OmniCod içinde bağımsız gelişecek, zamanla OmniRule'dan üstün hale gelecek
- 218 SKILL.md + 26 agent MD dosyası kopyalandı başlangıç noktası olarak

**Görevler:**
- [x] Skill detector — package.json deps + dir + extension + pattern analizi (confidence scoring)
- [x] Skill injector — v1.context.inject hook, max 15 skill, 12K char limit
- [x] Skill library — 218 OmniRule skill SKILL.md formatında `core/src/skill/library/`
- [x] Skill registry — 95 skill için TypeScript detection tanımları (OmniRule'dan genişletildi)
- [x] Skill loader — SKILL.md parser (Quick Reference + Anti-Patterns çıkarımı, 2.5K/skill)
- [x] Agent loop entegrasyonu — her çağrıda `buildSystemPrompt()` otomatik çalışır
- [x] Skill listesi TUI'da gösterim — StatusBar'da top 3 + toplam sayı
- [x] Ollama provider plugin — 12 model, OLLAMA_BASE_URL + OLLAMA_DEFAULT_MODEL ile config
- [ ] `.omnicod/` custom tool ve agent desteği (Faz 4'e ertelendi)

**Başarı kriteri**: Next.js projesinde açıldığında skill'ler otomatik detect edilir ✅

### Faz 2 — Skill Sistemi Geliştirmeleri ✅ (2026-06-04)

- [x] `frontmatter.ts` — SKILL.md YAML parser (line-by-line, inline array, nested obj)
- [x] Registry auto-discovery — hardcoded map kaldırıldı, 218 SKILL.md otomatik taranır
- [x] Registry dep supplement — 37 skill için frontmatter'da olmayan dep detection eklendi
- [x] Detector multi-language — Go (go.mod), Python (requirements.txt/pyproject.toml), Rust (Cargo.toml), PHP, Swift
- [x] Detector hash-based cache — proje dep dosyaları mtime hash'i, süresi dolana kadar tekrar tarama yok
- [x] Loader disk cache — `~/.omnicod/skill-cache/` altında JSON cache, mtime invalidation
- [x] Loader token-aware — tiktoken ile MAX_TOKENS_PER_SKILL=600, 5 bölüm öncelik sırası
- [x] Injector multi-dir cache — her proje dizini ayrı cache, TTL=60s
- [x] Injector token budget — MAX_SKILL_TOKENS=6000, öncelikli skill'ler önce seçilir

---

### Faz 3 — Multi-Agent Orchestration ✅ TAMAMLANDI (2026-06-04)

**Hedef**: 3+1 orchestration modeli, worker thread izolasyonu

**Görevler:**
- [x] `agent/protocol.ts` — AgentType, WorkerRequest, WorkerMessage tip-güvenli protokol
- [x] `agent/worker.ts` — Bun Worker thread runner (generateText + restricted tools)
- [x] `agent/pool.ts` — Worker pool (spawn, cancel, 5dk timeout, MAX_WORKERS=4)
- [x] `task` tool — LLM'in subagent spawn ettiği built-in tool (foreground + background mod)
- [x] Config entegrasyonu — `.omnicod/config.json[agents]` varsa override, yoksa calling LLM provider/model
- [x] `agent_spawn`, `agent_done`, `agent_error` SSE event'leri
- [x] Parent→child izin kısıtlaması — AGENT_TYPE_TOOLS ile her tip için farklı tool seti
- [x] AgentStatus TUI bileşeni — paralel worker'lar 500ms polling ile gösterilir
- [x] 9 built-in agent tipi: explore, code, review, test, docs, performance, analytics, security, debug
- [ ] Orchestrator: mevcut ana agent zaten +1 rolünde — ayrı orchestrator dosyası gerekmedi

---

### Faz 4 — MCP & Plugin Ekosistemi ✅ TAMAMLANDI (2026-06-04)

**Hedef**: MCP client entegrasyonu, provider plugin registry

**Görevler:**
- [x] MCP client — `@modelcontextprotocol/sdk`, StdioClientTransport ile subprocess MCP server'ları
- [x] MCP→Tool köprüsü — JSON Schema → Zod dönüşümü, `mcp:server:tool` ID formatı
- [x] MCP manager — çoklu server yönetimi, connect/disconnect, process cleanup
- [x] `.omnicod/mcp.json` + `~/.omnicod/mcp.json` — proje + global config, `claude_desktop_config.json` uyumlu
- [x] `/v1/mcp` GET/POST/DELETE endpoint'leri
- [x] Bootstrap'ta otomatik MCP başlatma
- [x] v1.mcp.connected / v1.mcp.disconnected hook'ları
- [x] Custom agent tipi — `.omnicod/agents/*.md` runtime'da yüklenir, frontmatter ile tools/model/provider
- [x] task tool custom agent desteği — built-in tip değilse custom agent olarak ara
- [x] Hook tamamlama — v1.session.compact, v1.agent.spawn/complete/error artık hooks.emit ile de tetikleniyor
- [x] Provider plugin npm paket desteği — ProviderRegistry.register() ile runtime'da eklenebilir
- [x] OpenRouter provider plugin (Faz 0'da tamamlandı)

**Başarı kriteri**: `claude_desktop_config.json`'daki MCP server'ları `.omnicod/mcp.json`'a taşı → OmniCod'da tüm MCP tool'ları kullanılabilir.

---

### Faz 4.5 — İleri Düzey Çekirdek (OpenClaude Paritesi) ✅ TAMAMLANDI (2026-06-05)
*Bu faz, OpenClaude'un endüstriyel kalitesini (güvenlik, planlama, terminal geri besleme zekası) OmniCod'a daha iyi ve daha modern bir mimariyle entegre etmek için oluşturulmuştur.*

#### A. Terminal AST ve Güvenlik Motoru (Bash Classifier)
- [x] Bash/Shell komutlarını çalıştırmadan önce regex ağaçlarıyla semantik olarak analiz etme (`packages/core/src/tool/classifier.ts`).
- [x] Komutların salt-okunur (read-only) olup olmadığını anlama — safe/warning/danger 3 kademe.
- [x] Zararsız salt-okunur komutları **Auto-Approve** mekanizmasıyla kullanıcıya sormadan çalıştırma.
- [x] Yıkıcı (Destructive) komutlar için (`rm -rf` vb.) kırmızı uyarı ve onay mekanizması.
- [x] `sed` ve destructive pattern analizi.

#### B. İzole Sandbox Execution
- [x] `shouldUseSandbox()` analizi — riskli executable'lar (node, python, ruby, bash, sh) için Docker sandbox (`packages/core/src/tool/sandbox.ts`).

#### C. DAG Tabanlı Görev Ağı (Task Orchestration)
- [ ] Mevcut "Agent Status" sisteminin arkasına, görevlerin birbirini bekleyebildiği (Blocked By) DAG yapısını ekleme.
- [ ] `TaskCreateTool`, `TaskUpdateTool`, `TaskOutputTool` gibi özel görev yönetimi araçları.

#### D. Planlama Modu ve Doğrulama
- [ ] `EnterPlanMode`: Büyük isteklerde yapay zekanın önce zorunlu bir plan oluşturmasını sağlama.
- [ ] `VerifyPlanExecution`: Adım doğrulama.

#### E. Akıllı Editör Araçları (LSP & Notebook)
- [x] `LSPTool`: TypeScript dil sunucusuna bağlanıp semantik hata kontrolü (`packages/core/src/tool/built-in/lsp.ts`).
- [ ] `NotebookEditTool`: `.ipynb` (Jupyter) dosyalarını native düzenleme.

---

### Faz 5 — Kalite, Güvenlik, Yayın (Hafta 13-15) 🚀 (2026-06-05)

**Hedef**: Production-ready, test coverage, paket yayınlama

**Görevler:**
- [x] Unit test altyapısı (Bun test runner) — `bun test`
- [ ] Ink TUI bileşen testleri (@ink-testing-library) — devam ediyor
- [x] Tool execution entegrasyon testleri — classifier, sandbox, permission, compaction (92 test)
- [x] Multi-agent smoke testleri — agent-pool.test.ts (16 test)
- [x] JWT auth tamamlama — bearer token, `~/.omnicod/server-token`
- [x] Token counting doğruluk testleri — tokenizer.test.ts (12 test)
- [x] CLI help sistemi tamamlama — `/help`, `/keys` slash komutları
- [x] `bun build` → tek binary (`omnicod`) — `dist/omnicod` ~103 MB
- [x] `npm publish` hazırlığı — package.json fields, private: false
- [x] README + kurulum dökümantasyonu

---

## 12. Kritik Tasarım Kuralları

Bu kurallar ihlal edildiğinde plan güncellenmeden geliştirmeye devam edilmez.

### ❌ ASLA Yapılmayanlar

1. **Effect-TS kullanılmaz** — `async/await` + `AbortController` yeterli
2. **Provider özel mantığı core'a eklenmez** — her provider kendi plugin class'ında
3. **JSON dual storage yok** — sadece SQLite, hiçbir zaman
4. **karakter/4 token tahmini kullanılmaz** — tiktoken zorunlu
5. **opentui veya custom TUI kütüphanesi** — sadece Ink
6. **`process.env` global mutation** — provider config, env'e yazılmaz
7. **`experimental.*` hook prefix'i** — her hook v1.* veya v2.* ile versioned
8. **Runtime npm install** — plugin'ler pre-bundled veya Bun workspaces

### ✅ HEP Yapılanlar

1. Her yeni tool → `ToolDef` interface'ini implement eder, registry'e kaydedilir
2. Her yeni hook → v1.* namespace altında tanımlanır, types.ts güncellenir
3. Her provider → `ProviderPlugin` abstract class'ından extend edilir
4. Her agent türü → built-in agent tipi listesine eklenir
5. Her schema değişikliği → Drizzle migration dosyası oluşturulur
6. Her SSE event → `SSEEvent` union type'ına eklenir

---

## 13. Dizin Yapısı — Tam Görünüm

```
omnicod/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── agent/
│   │   │   ├── session/
│   │   │   ├── provider/
│   │   │   ├── tool/
│   │   │   ├── hook/
│   │   │   ├── skill/
│   │   │   ├── permission/
│   │   │   ├── mcp/
│   │   │   ├── storage/
│   │   │   └── server/
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/
│   │   ├── src/
│   │   │   ├── tui/
│   │   │   ├── commands/
│   │   │   ├── config/
│   │   │   ├── bootstrap.ts
│   │   │   └── index.ts
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── sdk/
│       ├── src/
│       │   ├── client.ts
│       │   ├── types.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── .omnicod/               ← OmniCod kendi kendini geliştirirken kullanır
│   └── config.json
│
├── package.json            ← Workspace root
├── tsconfig.base.json      ← Shared TypeScript config
└── PLAN.md                 ← Bu dosya
```

---

## 14. Referans Linkler ve Versiyonlar

```
Bun:              1.3+            bun.sh
TypeScript:       5.8+            typescriptlang.org
Vercel AI SDK:    ai@6.x          sdk.vercel.ai
Ink:              ink@5.x         github.com/vadimdemedes/ink
Hono:             hono@4.x        hono.dev
Drizzle ORM:      drizzle-orm@0.x orm.drizzle.team
js-tiktoken:      js-tiktoken@1.x github.com/dqbd/tiktoken
MCP SDK:          @modelcontextprotocol/sdk
models.dev:       models.dev      (model metadata API)
```

---

## 15. Sonraki Adım (Faz 0 Başlangıcı)

```bash
# Şu an yapılacak ilk şey:
mkdir omnicod && cd omnicod
bun init
mkdir -p packages/core packages/cli packages/sdk
# ... PLAN.md Faz 0 görevleri sırayla
```

**Her oturum başında bu dosya okunur. Her karar buraya dayanır.**
