/**
 * Vercel AI SDK + Tenuo — protected-tool demo entry point.
 *
 * Runs the allowed and denied scenarios from `protected-tool.ts` and prints
 * the transcript. No model, API key, or network: the tool is executed
 * directly, the way the SDK would invoke it after a model emits a tool call.
 *
 * The dev root mints warrants without key material and refuses production;
 * this entry point opts in explicitly for the local run.
 */
process.env.TENUO_ALLOW_DEV ??= "1";

const { runDemo } = await import("./protected-tool.ts");
await runDemo();
