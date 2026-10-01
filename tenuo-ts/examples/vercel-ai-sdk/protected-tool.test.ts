/**
 * Allow/deny coverage for the Vercel AI SDK protected-tool example.
 *
 * No model provider or credentials: every case calls the wrapped `execute`
 * directly. `executed` is the evidence — a denied call must never appear in
 * it, proving the underlying operation did not run after denial.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import { AuthorizationDeniedError, under } from "@tenuo/core";
import { createHarness, runDemo } from "./protected-tool.ts";

describe("vercel-ai-sdk protected tool", () => {
  it("keeps the AI SDK tool shape: description and inputSchema pass through", () => {
    const { protectedReadFile } = createHarness();
    expect(protectedReadFile.description).toBe(
      "Read a UTF-8 text file and return its contents.",
    );
    // The SDK still validates inputs against this schema; Tenuo never treats
    // the host schema as authority.
    expect(protectedReadFile.inputSchema).toBeDefined();
  });

  it("preserves useful TypeScript input inference", () => {
    const { protectedReadFile } = createHarness();
    expectTypeOf(protectedReadFile.execute)
      .parameter(0)
      .toEqualTypeOf<{ path: string }>();
    expectTypeOf(protectedReadFile.execute).returns.resolves.toEqualTypeOf<string>();
  });

  it("allows a path under the session root and runs the operation", async () => {
    const { protectedReadFile, reportsSession, executed } = createHarness();
    const result = await protectedReadFile.execute(
      { path: "/data/reports/q3.pdf" },
      { session: reportsSession },
    );
    expect(result).toBe("Q3 revenue up 12% quarter over quarter.");
    expect(executed).toEqual(["/data/reports/q3.pdf"]);
  });

  it("denies a path outside the session root and never runs the operation", async () => {
    const { protectedReadFile, reportsSession, executed } = createHarness();
    const error = await protectedReadFile
      .execute({ path: "/data/finance/ledger.csv" }, { session: reportsSession })
      .then(
        () => "no-error",
        (cause: unknown) => cause,
      );
    expect(error).toBeInstanceOf(AuthorizationDeniedError);
    expect((error as AuthorizationDeniedError).code).toBe("TENUO_CONSTRAINT_VIOLATION");
    expect((error as AuthorizationDeniedError).field).toBe("path");
    // The denial happened before the operation: nothing executed.
    expect(executed).toEqual([]);
  });

  it("denies a path outside the tool ceiling even for a broader session", async () => {
    const { tenuo, protectedReadFile, executed } = createHarness();
    const broadSession = tenuo.session({
      allow: { read_file: { path: under("/etc") } },
    });
    const error = await protectedReadFile
      .execute({ path: "/etc/passwd" }, { session: broadSession })
      .then(
        () => "no-error",
        (cause: unknown) => cause,
      );
    expect(error).toBeInstanceOf(AuthorizationDeniedError);
    expect(executed).toEqual([]);
  });

  it("accepts the session from AsyncLocalStorage when options omit it", async () => {
    const { tenuo, protectedReadFile, reportsSession, executed } = createHarness();
    const result = await tenuo.withSession(reportsSession, () =>
      protectedReadFile.execute({ path: "/data/reports/q3.pdf" }),
    );
    expect(result).toBe("Q3 revenue up 12% quarter over quarter.");
    expect(executed).toEqual(["/data/reports/q3.pdf"]);
  });

  it("reports the allow/deny transcript via runDemo", async () => {
    const lines: string[] = [];
    await runDemo((line) => lines.push(line));
    expect(lines).toEqual([
      "allowed  /data/reports/q3.pdf -> Q3 revenue up 12% quarter over quarter.",
      "denied   /data/finance/ledger.csv -> TENUO_CONSTRAINT_VIOLATION (field path)",
      'tool executed for: ["/data/reports/q3.pdf"]',
    ]);
  });
});
