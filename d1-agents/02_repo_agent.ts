import Anthropic from "@anthropic-ai/sdk";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";
const ROOT = process.argv[2] ?? ".";

const tools: Anthropic.Tool[] = [
  {
    name: "list_files",
    description:
      "List the files and folders directly inside a directory of the project. " +
      "Use this first to discover what exists. Paths are relative to the project root. " +
      "Returns one entry per line, folders end with '/'.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory to list, e.g. '.' or 'src'" },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description:
      "Read the full text of one file. Use after list_files, only on files that look relevant " +
      "(entry points, configs, main modules). Do not read binary files or node_modules.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to the project root" },
      },
      required: ["path"],
    },
  },
];

// ---------- 2. The real implementations: your code, not the model ----------
function runTool(name: string, input: any): string {
  const target = join(ROOT, input.path);
  if (name === "list_files") {
    return readdirSync(target)
      .filter((f) => f !== "node_modules" && f !== ".git")
      .map((f) => (statSync(join(target, f)).isDirectory() ? f + "/" : f))
      .join("\n");
  }
  if (name === "read_file") {
    return readFileSync(target, "utf8").slice(0, 8000);
  }
  throw new Error(`unknown tool ${name}`);
}

// ---------- 3. The agentic loop ----------
async function main() {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Explore this project and explain in 5 bullet points what it is, " +
        "how it is organized, and where the entry point is.",
    },
  ];

  let turn = 0;
  while (true) {
    turn++;
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: "You are a senior engineer onboarding to an unfamiliar codebase. Use the tools to look before you answer.",
      tools,
      messages,
    });

    // Always store what the model said, including its tool requests
    messages.push({ role: "assistant", content: resp.content });
    console.log(`\n--- turn ${turn}: stop_reason=${resp.stop_reason} ---`);

    if (resp.stop_reason === "end_turn") {
      const text = resp.content.find((b) => b.type === "text");
      console.log(text && text.type === "text" ? text.text : "(no text)");
      break;
    }

    if (resp.stop_reason === "tool_use") {
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;
        console.log(`  tool: ${block.name}(${JSON.stringify(block.input)})`);
        let output: string;
        let isError = false;
        try {
          output = runTool(block.name, block.input);
        } catch (e: any) {
          output = `Error: ${e.message}`;
          isError = true;
        }
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: output,
          is_error: isError,
        });
      }
      // Tool results go back as a *user* message, and must be first in it
      messages.push({ role: "user", content: results });
      continue;
    }

    console.log("Unexpected stop_reason, stopping.");
    break;
  }
}

main();