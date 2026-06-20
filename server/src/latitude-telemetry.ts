import { capture, Latitude, type ContextOptions } from "@latitude-data/telemetry";

let client: Latitude | null = null;
let initAttempted = false;

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function initLatitudeTelemetry(): Latitude | null {
  if (client) return client;
  if (initAttempted) return null;
  initAttempted = true;

  const apiKey = readEnv("LATITUDE_API_KEY");
  const project = readEnv("LATITUDE_PROJECT_SLUG");
  if (!apiKey || !project) return null;

  try {
    client = new Latitude({
      apiKey,
      project,
      serviceName: process.env.OTEL_SERVICE_NAME?.trim() || "paperclip-server",
    });
    void client.ready.catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[paperclip] Latitude telemetry initialization did not complete", err);
    });
    return client;
  } catch (err) {
    // Telemetry must never prevent Paperclip from booting.
    // eslint-disable-next-line no-console
    console.warn("[paperclip] Latitude telemetry disabled after initialization failure", err);
    client = null;
    return null;
  }
}

export function getLatitudeTelemetryClient(): Latitude | null {
  return client;
}

export async function shutdownLatitudeTelemetry(): Promise<void> {
  if (!client) return;
  try {
    await client.shutdown();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[paperclip] Latitude telemetry shutdown failed", err);
  } finally {
    client = null;
  }
}

export async function captureLatitude<T>(
  name: string,
  fn: () => T | Promise<T>,
  options?: ContextOptions,
): Promise<T> {
  if (!client) return await fn();

  let started = false;
  let completed = false;
  let result: T;
  let fnError: unknown;

  try {
    return await capture(
      name,
      async () => {
        started = true;
        try {
          result = await fn();
          completed = true;
          return result;
        } catch (err) {
          fnError = err;
          throw err;
        }
      },
      options,
    );
  } catch (err) {
    if (fnError && err === fnError) throw err;
    if (completed) return result!;
    if (!started) return await fn();
    throw err;
  }
}

