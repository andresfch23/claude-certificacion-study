import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-5";

const SYSTEM =
  "You are the customer support assistant for The Guardians Collectors, an online store. " +
  "Be concise and never invent order details.";

const history: Anthropic.MessageParam[] = [];

async function ask(text: string) {
  history.push({ role: "user", content: text });

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: history,
  });

  const block = resp.content[0];
  const reply = block.type === "text" ? block.text : "";

  history.push({ role: "assistant", content: reply });

  console.log(`\n> ${text}\n${reply}`);
  console.log(
    `[stop_reason=${resp.stop_reason} in=${resp.usage.input_tokens} out=${resp.usage.output_tokens}]`
  );
}

async function main() {
  await ask("Hi, my order #RX-10422 hasn't arrived.");
  await ask("It was supposed to come last Tuesday.");
  await ask("What was my order number again?");
}

main();