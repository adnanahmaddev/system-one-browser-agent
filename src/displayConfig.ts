/**
 * Screencast and viewport settings, read from the environment.
 *
 * Shared by the CLI and the WebSocket server so `AGENT_VIEWPORT=1920x1080` means
 * the same thing whichever entry point you launch.
 *
 *   AGENT_VIEWPORT=2560x1440      browser viewport in CSS pixels (default 1920x1080)
 *   AGENT_DEVICE_SCALE=2          device pixel ratio, 1-3 (default 1)
 *   AGENT_FPS=5                   target screencast frames per second (default 2.5)
 *   AGENT_SCREENSHOT_QUALITY=90   JPEG quality, 1-100 (default 80)
 *
 * Each knob trades bandwidth and page-thread time for fidelity: frames are CDP
 * screenshots encoded on the page's own thread, so raising fps and device scale
 * together directly slows the agent's real work.
 */
export interface DisplayConfig {
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  screenshotQuality?: number;
  screencastIntervalMs?: number;
}

function parseViewport(raw: string | undefined): { width: number; height: number } | undefined {
  if (!raw) return undefined;
  const match = /^(\d{3,5})\s*[x×]\s*(\d{3,5})$/.exec(raw.trim());
  if (!match) {
    console.warn(`Ignoring malformed AGENT_VIEWPORT="${raw}" (expected e.g. 1920x1080)`);
    return undefined;
  }
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

function parseNumber(
  name: string,
  raw: string | undefined,
  min: number,
  max: number
): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    console.warn(`Ignoring ${name}="${raw}" (expected a number between ${min} and ${max})`);
    return undefined;
  }
  return value;
}

export function readDisplayConfig(env: NodeJS.ProcessEnv = process.env): DisplayConfig {
  const fps = parseNumber("AGENT_FPS", env.AGENT_FPS, 0.5, 15);

  return {
    viewport: parseViewport(env.AGENT_VIEWPORT),
    deviceScaleFactor: parseNumber("AGENT_DEVICE_SCALE", env.AGENT_DEVICE_SCALE, 1, 3),
    screenshotQuality: parseNumber(
      "AGENT_SCREENSHOT_QUALITY",
      env.AGENT_SCREENSHOT_QUALITY,
      1,
      100
    ),
    screencastIntervalMs: fps ? Math.round(1000 / fps) : undefined,
  };
}

/** Human-readable summary of the effective settings, for startup banners. */
export function describeDisplayConfig(config: DisplayConfig): string {
  const viewport = config.viewport
    ? `${config.viewport.width}x${config.viewport.height}`
    : "1920x1080 (default)";
  const scale = config.deviceScaleFactor ?? 1;
  const fps = config.screencastIntervalMs ? 1000 / config.screencastIntervalMs : 2.5;
  const quality = config.screenshotQuality ?? 80;
  return `${viewport} @${scale}x, ~${fps.toFixed(1)}fps, JPEG q${quality}`;
}
