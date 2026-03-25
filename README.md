<!-- BlackRoad SEO Enhanced -->

# ulackroad streaming

> Part of **[BlackRoad OS](https://blackroad.io)** — Sovereign Computing for Everyone

[![BlackRoad OS](https://img.shields.io/badge/BlackRoad-OS-ff1d6c?style=for-the-badge)](https://blackroad.io)
[![BlackRoad-Media](https://img.shields.io/badge/Org-BlackRoad-Media-2979ff?style=for-the-badge)](https://github.com/BlackRoad-Media)

**ulackroad streaming** is part of the **BlackRoad OS** ecosystem — a sovereign, distributed operating system built on edge computing, local AI, and mesh networking by **BlackRoad OS, Inc.**

### BlackRoad Ecosystem
| Org | Focus |
|---|---|
| [BlackRoad OS](https://github.com/BlackRoad-OS) | Core platform |
| [BlackRoad OS, Inc.](https://github.com/BlackRoad-OS-Inc) | Corporate |
| [BlackRoad AI](https://github.com/BlackRoad-AI) | AI/ML |
| [BlackRoad Hardware](https://github.com/BlackRoad-Hardware) | Edge hardware |
| [BlackRoad Security](https://github.com/BlackRoad-Security) | Cybersecurity |
| [BlackRoad Quantum](https://github.com/BlackRoad-Quantum) | Quantum computing |
| [BlackRoad Agents](https://github.com/BlackRoad-Agents) | AI agents |
| [BlackRoad Network](https://github.com/BlackRoad-Network) | Mesh networking |

**Website**: [blackroad.io](https://blackroad.io) | **Chat**: [chat.blackroad.io](https://chat.blackroad.io) | **Search**: [search.blackroad.io](https://search.blackroad.io)

---


RoadTV but runs 100% on your hardware. No cloud. Local Ollama. Zero dependencies.

Watch 12 AI agents think in real-time. Each character they generate is a frame. Stream one agent or watch all 12 simultaneously in the RoadTV classroom grid.

## Features

- **12 agents** — Road, Coder, Scholar, Alice, Cecilia, Octavia, Lucidia, Aria, Pascal, Writer, Tutor, Cipher
- **RoadTV classroom** — grid view of all agents streaming at once (2/3/4/6 column layouts)
- **SSE streaming** — real-time Server-Sent Events, character by character from Ollama
- **Zero dependencies** — pure Node.js `http` module, nothing to install
- **Live stats** — chars, chars/sec, elapsed time per agent tile
- **Click to wake** — click any tile to start that agent thinking
- **Wake All** — one button fires all 12 agents simultaneously (staggered 800ms)
- **Fullscreen** — click a streaming tile to expand it
- **Configurable** — choose port, model, and Ollama host via CLI flags

## Requirements

- Node.js 18+
- Ollama running locally (or on a reachable host)

## Usage

```bash
node server.js --port 8802 --model qwen2.5:1.5b
```

Then open:
- Single agent view: http://localhost:8802/
- RoadTV classroom: http://localhost:8802/tv

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8802` | HTTP server port |
| `--model` | `qwen2.5:1.5b` | Ollama model to use |
| `--ollama` | `http://localhost:11434` | Ollama API base URL |

### API routes

| Route | Description |
|-------|-------------|
| `/` | Single agent streaming view |
| `/tv` | RoadTV classroom grid (all 12 agents) |
| `/api/stream?agent=road&prompt=...` | SSE stream from one agent |
| `/api/agents` | JSON list of all 12 agents |
| `/health` | Health check with version and config |

## License

Proprietary — BlackRoad OS, Inc.
