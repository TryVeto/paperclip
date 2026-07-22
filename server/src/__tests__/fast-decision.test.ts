import { describe, expect, it, vi } from "vitest";
import {
  FAST_DECISION_ACTIONS,
  FAST_DECISION_PAYLOAD_LIMITS,
  FAST_DECISION_VERSION,
  FastDecisionConfigError,
  executeFastDecision,
  resolveFastDecisionConfig,
  type FastDecisionConfig,
  type FastDecisionDecision,
  type FastDecisionInput,
} from "../services/fast-decision.js";

const AGENT_ID = "ce33d4f8-267f-4863-b71f-2c3168fb3e6a";
const FALLBACK_AGENT_ID = "4652166d-11aa-4d40-aaed-183b5ece4537";

function enabledEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PAPERCLIP_FAST_DECISION_ENABLED: "true",
    PAPERCLIP_FAST_DECISION_AGENT_IDS: AGENT_ID,
    PAPERCLIP_FAST_DECISION_BASE_URL: "http://127.0.0.1:8317/v1",
    PAPERCLIP_FAST_DECISION_API_KEY_ENV: "TEST_FAST_DECISION_KEY",
    PAPERCLIP_FAST_DECISION_MODEL: "gpt-5.6-terra",
    PAPERCLIP_FAST_DECISION_REASONING_EFFORT: "low",
    PAPERCLIP_FAST_DECISION_TIMEOUT_MS: "8000",
    PAPERCLIP_FAST_DECISION_FALLBACK_AGENT_ID: FALLBACK_AGENT_ID,
    PAPERCLIP_FAST_DECISION_PROVIDER: "veto_gateway",
    PAPERCLIP_FAST_DECISION_BILLER: "veto_gateway",
    PAPERCLIP_FAST_DECISION_BILLING_TYPE: "subscription_included",
    TEST_FAST_DECISION_KEY: "secret-test-key",
    ...overrides,
  };
}

function config(env: NodeJS.ProcessEnv = enabledEnv()): FastDecisionConfig {
  const resolved = resolveFastDecisionConfig(env, AGENT_ID);
  if (!resolved) throw new Error("Expected fast-decision config to resolve");
  return resolved;
}

function input(overrides: Partial<FastDecisionInput> = {}): FastDecisionInput {
  return {
    issueTitle: "Decide the next step",
    issueBody: "The issue body",
    latestComment: "The latest comment",
    wakeReason: "issue_assigned",
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("resolveFastDecisionConfig", () => {
  it("exports the stable version and exact decision action contract", () => {
    expect(FAST_DECISION_VERSION).toBe("fast-decision-v1");
    expect(FAST_DECISION_ACTIONS).toEqual([
      "comment_and_done",
      "escalate_slow",
      "backlog",
      "no_op",
    ]);
  });

  it("returns null only when disabled or not allowlisted", () => {
    expect(resolveFastDecisionConfig({}, AGENT_ID)).toBeNull();
    expect(resolveFastDecisionConfig(enabledEnv(), "4652166d-11aa-4d40-aaed-183b5ece4537")).toBeNull();
  });

  it("fails closed on an empty allowlist and throws typed errors only after membership is established", () => {
    expect(resolveFastDecisionConfig(
      enabledEnv({ PAPERCLIP_FAST_DECISION_AGENT_IDS: "" }),
      AGENT_ID,
    )).toBeNull();

    expect(() => resolveFastDecisionConfig(
      enabledEnv({ PAPERCLIP_FAST_DECISION_FALLBACK_AGENT_ID: "" }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "fallback_agent_id_missing" }));
    expect(() => resolveFastDecisionConfig(
      enabledEnv({ PAPERCLIP_FAST_DECISION_FALLBACK_AGENT_ID: AGENT_ID }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "fallback_agent_id_invalid" }));
    expect(() => resolveFastDecisionConfig(
      enabledEnv({ PAPERCLIP_FAST_DECISION_REASONING_EFFORT: "high" }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "reasoning_effort_invalid" }));
    expect(() => resolveFastDecisionConfig(
      enabledEnv({ PAPERCLIP_FAST_DECISION_PROVIDER: "" }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "provider_missing" }));
    expect(() => resolveFastDecisionConfig(
      enabledEnv({ PAPERCLIP_FAST_DECISION_BILLING_TYPE: "free-ish" }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "billing_type_invalid" }));

    expect(FastDecisionConfigError).toBeTypeOf("function");
  });

  it("rejects a remote endpoint unless remote access is explicitly enabled", () => {
    expect(() => resolveFastDecisionConfig(
      enabledEnv({ PAPERCLIP_FAST_DECISION_BASE_URL: "https://api.example.test/v1" }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "remote_endpoint_not_allowed" }));

    expect(resolveFastDecisionConfig(
      enabledEnv({
        PAPERCLIP_FAST_DECISION_BASE_URL: "https://api.example.test/v1",
        PAPERCLIP_FAST_DECISION_ALLOW_REMOTE: "true",
      }),
      AGENT_ID,
    )).toMatchObject({ endpoint: "https://api.example.test/v1/responses" });

    expect(() => resolveFastDecisionConfig(
      enabledEnv({
        PAPERCLIP_FAST_DECISION_BASE_URL: "http://api.example.test/v1",
        PAPERCLIP_FAST_DECISION_ALLOW_REMOTE: "true",
      }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "base_url_invalid" }));
  });

  it("requires a valid named environment variable containing the API key", () => {
    expect(() => resolveFastDecisionConfig(
      enabledEnv({ PAPERCLIP_FAST_DECISION_API_KEY_ENV: "bad-name" }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "api_key_env_invalid" }));
    expect(() => resolveFastDecisionConfig(
      enabledEnv({ TEST_FAST_DECISION_KEY: "" }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "api_key_missing" }));
    expect(() => resolveFastDecisionConfig(
      enabledEnv({ PAPERCLIP_FAST_DECISION_API_KEY_ENV: "toString" }),
      AGENT_ID,
    )).toThrowError(expect.objectContaining({ code: "api_key_missing" }));
  });
});

describe("executeFastDecision", () => {
  it("makes one capped, strict-schema Responses API request and returns a validated decision", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      id: "resp-123",
      model: "gpt-5.6-terra-2026-07-01",
      output_text: JSON.stringify({
        action: "comment_and_done",
        comment: "The request is already handled.",
        reason: "The supplied context contains a conclusive answer.",
      } satisfies FastDecisionDecision),
      usage: {
        input_tokens: 123,
        input_tokens_details: { cached_tokens: 20 },
        output_tokens: 25,
      },
    }));

    const result = await executeFastDecision(
      config(),
      input({
        issueTitle: "T".repeat(FAST_DECISION_PAYLOAD_LIMITS.issueTitle + 25),
        issueBody: "B".repeat(FAST_DECISION_PAYLOAD_LIMITS.issueBody + 25),
        latestComment: "C".repeat(FAST_DECISION_PAYLOAD_LIMITS.latestComment + 25),
        wakeReason: "W".repeat(FAST_DECISION_PAYLOAD_LIMITS.wakeReason + 25),
      }),
      { fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:8317/v1/responses");
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("error");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer secret-test-key",
      "content-type": "application/json",
    });

    const request = JSON.parse(String(init?.body)) as {
      model: string;
      store: boolean;
      reasoning: { effort: string };
      input: Array<{ role: string; content: Array<{ type: string; text: string }> }>;
      text: {
        format: {
          type: string;
          strict: boolean;
          schema: {
            additionalProperties: boolean;
            required: string[];
            properties: { action: { enum: string[] } };
          };
        };
      };
    };
    expect(request.model).toBe("gpt-5.6-terra");
    expect(request.store).toBe(false);
    expect(request.reasoning).toEqual({ effort: "low" });
    expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(request.text.format.schema.additionalProperties).toBe(false);
    expect(request.text.format.schema.required).toEqual(["action", "comment", "reason"]);
    expect(request.text.format.schema.properties.action.enum).toEqual([...FAST_DECISION_ACTIONS]);

    const userPayload = JSON.parse(request.input[1]!.content[0]!.text) as Record<string, string>;
    expect(Object.keys(userPayload).sort()).toEqual([
      "issueBody",
      "issueTitle",
      "latestComment",
      "wakeReason",
    ]);
    expect(userPayload.issueTitle).toHaveLength(FAST_DECISION_PAYLOAD_LIMITS.issueTitle);
    expect(userPayload.issueBody).toHaveLength(FAST_DECISION_PAYLOAD_LIMITS.issueBody);
    expect(userPayload.latestComment).toHaveLength(FAST_DECISION_PAYLOAD_LIMITS.latestComment);
    expect(userPayload.wakeReason).toHaveLength(FAST_DECISION_PAYLOAD_LIMITS.wakeReason);
    expect(String(init?.body)).not.toContain("secret-test-key");

    expect(result).toMatchObject({
      ok: true,
      decision: {
        action: "comment_and_done",
        comment: "The request is already handled.",
        reason: "The supplied context contains a conclusive answer.",
      },
      model: "gpt-5.6-terra-2026-07-01",
      responseId: "resp-123",
      usage: { inputTokens: 123, outputTokens: 25, cachedInputTokens: 20 },
      elapsedMs: expect.any(Number),
    });
  });

  it("extracts structured output from the nested Responses API message shape", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            action: "escalate_slow",
            comment: "",
            reason: "This needs file access.",
          }),
        }],
      }],
    }));

    const result = await executeFastDecision(config(), input(), { fetchImpl });

    expect(result).toMatchObject({
      ok: true,
      decision: { action: "escalate_slow", reason: "This needs file access." },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns a typed invalid-response error for malformed or out-of-contract output", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      id: "resp-invalid-1",
      model: "gpt-5.6-terra-2026-07-01",
      output_text: JSON.stringify({
        action: "delete_everything",
        comment: "No.",
        reason: "No.",
      }),
      usage: {
        input_tokens: 40,
        input_tokens_details: { cached_tokens: 5 },
        output_tokens: 8,
      },
    }));

    const result = await executeFastDecision(config(), input(), { fetchImpl });

    expect(result).toMatchObject({
      ok: false,
      code: "invalid_response",
      message: expect.any(String),
      elapsedMs: expect.any(Number),
      responseId: "resp-invalid-1",
      model: "gpt-5.6-terra-2026-07-01",
      usage: { inputTokens: 40, cachedInputTokens: 5, outputTokens: 8 },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns typed HTTP and transport errors without retrying", async () => {
    const httpFetch = vi.fn(async () => jsonResponse({ error: "unauthorized" }, 401));
    await expect(executeFastDecision(config(), input(), { fetchImpl: httpFetch })).resolves.toMatchObject({
      ok: false,
      code: "http_error",
      message: "Fast decision request failed with HTTP 401",
      elapsedMs: expect.any(Number),
    });
    expect(httpFetch).toHaveBeenCalledTimes(1);

    const transportFetch = vi.fn(async () => {
      throw new Error("socket closed");
    });
    await expect(executeFastDecision(config(), input(), { fetchImpl: transportFetch })).resolves.toMatchObject({
      ok: false,
      code: "request_failed",
      message: "Fast decision request failed",
      elapsedMs: expect.any(Number),
    });
    expect(transportFetch).toHaveBeenCalledTimes(1);
  });

  it("aborts at the configured deadline and returns a typed timeout error without retrying", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }));

      const pending = executeFastDecision(
        config(enabledEnv({ PAPERCLIP_FAST_DECISION_TIMEOUT_MS: "250" })),
        input(),
        { fetchImpl },
      );
      await vi.advanceTimersByTimeAsync(250);

      await expect(pending).resolves.toMatchObject({
        ok: false,
        code: "timeout",
        message: "Fast decision request timed out after 250ms",
        elapsedMs: expect.any(Number),
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the deadline active while reading the response body", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(async () => ({
        ok: true,
        json: () => new Promise<never>(() => undefined),
      } as Response));
      let result: Awaited<ReturnType<typeof executeFastDecision>> | undefined;
      void executeFastDecision(
        config(enabledEnv({ PAPERCLIP_FAST_DECISION_TIMEOUT_MS: "250" })),
        input(),
        { fetchImpl },
      ).then((value) => {
        result = value;
      });

      await vi.advanceTimersByTimeAsync(250);

      expect(result).toMatchObject({ ok: false, code: "timeout" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
