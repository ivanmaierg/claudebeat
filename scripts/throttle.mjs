import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

const EMPTY_STATE = () => ({ lastPlayedAt: 0, recentPlays: [] });
const MAX_RECENT = 120;

export function shouldPlay({ now, lastPlayedAt, recentTimestamps, cooldownSeconds, maxPerMinute }) {
  if (cooldownSeconds > 0) {
    const elapsed = now - lastPlayedAt;
    if (elapsed >= 0 && elapsed < cooldownSeconds * 1000) {
      return { play: false, reason: "cooldown" };
    }
  }

  if (maxPerMinute > 0) {
    const windowStart = now - 60_000;
    const recent = recentTimestamps.filter((t) => t > windowStart);
    if (recent.length >= maxPerMinute) {
      return { play: false, reason: "rate-limit" };
    }
  }

  return { play: true, reason: "ok" };
}

export function recordPlay(state, now) {
  return {
    lastPlayedAt: now,
    recentPlays: [...state.recentPlays, now],
  };
}

export async function loadThrottleState(dataDir) {
  if (!dataDir) return EMPTY_STATE();
  const filePath = path.join(dataDir, "throttle.json");
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      lastPlayedAt: typeof parsed.lastPlayedAt === "number" ? parsed.lastPlayedAt : 0,
      recentPlays: Array.isArray(parsed.recentPlays) ? parsed.recentPlays : [],
    };
  } catch {
    return EMPTY_STATE();
  }
}

export async function saveThrottleState(dataDir, state) {
  await mkdir(dataDir, { recursive: true });
  const filePath = path.join(dataDir, "throttle.json");
  const tmpPath = filePath + ".tmp";
  const truncated = state.recentPlays.slice(-MAX_RECENT);
  const data = {
    version: 1,
    lastPlayedAt: state.lastPlayedAt,
    recentPlays: truncated,
  };
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  await rename(tmpPath, filePath);
}
