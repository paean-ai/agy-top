# agy-top

ASCII-styled usage statistics for Antigravity with community leaderboard.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          agy-top v0.1.0                              │
│                   Antigravity Usage Statistics                        │
├──────────────────────────────────────────────────────────────────────┤
│  Uptime: 2h 34m        Models: 6        Last Refresh: 10s ago    ●  │
├──────────────────────────────────────────────────────────────────────┤
│  CREDITS OVERVIEW                                                     │
│  Prompt:  ████████████████░░░░░░░░░░░░░░  65% (650K/1M)             │
│  Flow:    ████████░░░░░░░░░░░░░░░░░░░░░░  35% (350K/1M)             │
├──────────────────────────────────────────────────────────────────────┤
│  MODEL QUOTAS                                                         │
│  gemini-3-flash              ████████  85%        Resets in 2h     │
│  gemini-3-pro                ██████    62%        Resets in 4h     │
│  claude-4-5-sonnet           ████      45%        Resets in 1h     │
└──────────────────────────────────────────────────────────────────────┘
  [q] Quit   [r] Refresh   [?] Help
```

## Features

- 🖥️ **Real-time Dashboard** - Live quota data from Antigravity Language Server
- 📊 **Model Breakdown** - Per-model quota with reset timers
- 📈 **Credits Overview** - Prompt and Flow credits visualization
- 🏆 **Leaderboard** - Community rankings with optional opt-in
- 🔐 **Auto-detection** - Automatically finds running Language Server

## Installation

```bash
# Using npm
npm install -g agy-top

# Using bun
bun add -g agy-top

# Or run directly with npx
npx agy-top
```

## Usage

### Dashboard Mode (Default)

```bash
# Show real-time usage dashboard
agy-top

# With auto-refresh disabled
agy-top --no-refresh

# Custom refresh interval (seconds)
agy-top --interval 30
```

### Authentication

```bash
# Login with your Paean account (required for leaderboard)
agy-top login

# Check authentication status
agy-top login --check

# Logout
agy-top logout
```

### Leaderboard

```bash
# Enable leaderboard mode in dashboard
agy-top --rank

# View current leaderboard
agy-top rank

# View different time periods
agy-top rank --period daily
agy-top rank --period weekly
agy-top rank --period monthly
agy-top rank --period all_time
```

### Submit Usage Data

```bash
# Submit usage data to leaderboard
agy-top submit

# Force submission (ignore cooldown)
agy-top submit --force

# Submit demo data (testing)
agy-top submit --demo
```

## Keyboard Shortcuts (Dashboard)

| Key | Action |
|-----|--------|
| `q` | Quit |
| `r` | Refresh data |
| `l` | Show leaderboard (rank mode) |
| `s` | Submit usage data |
| `?` | Show help |

## Configuration

Configuration is stored in `~/.config/agy-top/config.json`:

```json
{
  "apiUrl": "https://api.paean.ai",
  "webUrl": "https://app.paean.ai",
  "auth": {
    "token": "...",
    "userId": 123,
    "email": "user@example.com"
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGY_API_URL` | API server URL | `https://api.paean.ai` |
| `AGY_WEB_URL` | Web auth URL | `https://app.paean.ai` |

## Leaderboard & Privacy

- **Opt-in Only**: Your data is never submitted without explicit action
- **Anonymous Display**: Email addresses are masked on the leaderboard
- **Trust Scoring**: Server-side validation prevents data manipulation
- **Checksum Chain**: Historical consistency is verified

## Development

```bash
# Clone the repository
git clone https://github.com/paean-opensource/agy-top.git
cd agy-top

# Install dependencies
bun install

# Run in development mode
bun dev

# Build
bun run build
```

## API Endpoints

The agy-top CLI communicates with zero-api:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agy/health` | GET | Health check |
| `/agy/usage/submit` | POST | Submit usage data |
| `/agy/usage/my` | GET | Get user's usage history |
| `/agy/leaderboard` | GET | Get leaderboard |
| `/agy/rank` | GET | Get user's current rank |

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

---

Built with ❤️ by [Paean AI](https://paean.ai)
