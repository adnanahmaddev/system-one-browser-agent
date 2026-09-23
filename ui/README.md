# System One — Operator UI

Next.js 16 (App Router) + React 19 dashboard for driving and watching the browser
agent. It is a client of the agent bridge in `../src/server.ts`; on its own it
renders, but has nothing to talk to.

## Running

From the **repository root**, start both processes together:

```bash
npm run ui     # this UI on :3000 + agent bridge on :3001
```

Or from this directory, the UI alone (expects a bridge already running on :3001):

```bash
npm run dev
```

Then open <http://localhost:3000>.

## Layout

| Path | Contents |
|---|---|
| `app/page.tsx` | App shell: lifted run state, WebSocket client, keybindings |
| `app/layout.tsx` | Fonts (Inter + JetBrains Mono via `next/font/google`) and the theme bootstrap script |
| `app/globals.css` | Tailwind v4 entry and the light/dark design tokens |
| `components/` | `LiveViewport`, `StepTimeline`, `StepInspector`, `ResultBanner`, `ConsoleDrawer`, `TelemetryBar`, `DecisionBadge`, `ComposerCard`, `TopNav` |
| `lib/theme.ts` | Theme persistence and the external store `TopNav` subscribes to |
| `types/` | Shared run/telemetry types mirrored from `../src/types.ts` |

## Notes

- Keyboard: **Cmd/Ctrl+Enter** starts a run, **Esc** closes the step inspector, then
  exits theater mode, then stops a running agent.
- The live viewport renders JPEG frames streamed over the WebSocket. Frame size and
  rate are set by `AGENT_VIEWPORT`, `AGENT_DEVICE_SCALE`, `AGENT_FPS`, and
  `AGENT_SCREENSHOT_QUALITY` in the **agent** process, not here — see the root README.
- The console keeps the most recent 1000 log lines.

```bash
npm run build   # production build
npm run lint    # eslint
```
