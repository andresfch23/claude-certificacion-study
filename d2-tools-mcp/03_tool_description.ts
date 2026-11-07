import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";
const mode = process.argv[2] === "good" ? "good" : "bad";

const descriptions = {
  bad: {
    lookup_a: "Look up a customer.",
    lookup_b: "Look up an order.",
  },
  good: {
    lookup_a:
      "Fetch a customer's account profile (name, email, tier, open tickets) by customer ID. " +
      "Customer IDs look like 'C-' followed by digits, e.g. 'C-48213'. " +
      "Use this for questions about the account itself: who the customer is, their plan, their contact details. " +
      "Do not use this to check the status of a purchase; use lookup_order for that.",
    lookup_b:
      "Fetch the status, items and shipping details of one order by order number. " +
      "Order numbers look like '#' followed by letters and digits, e.g. '#RX-10422'. " +
      "Use this for anything about a specific purchase: where it is, when it ships, what it contains, refunds. " +
      "Do not use this to look up who the customer is; use get_customer for that.",
  },
}[mode];

const tools: Anthropic.Tool[] = [
  {
    name: "get_customer",
    description: descriptions.lookup_a,
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "lookup_order",
    description: descriptions.lookup_b,
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

const requests: { text: string; expected: string }[] = [
  { text: "Where is my order #RX-10422?", expected: "lookup_order" },
  { text: "Can you check what plan I'm on? My ID is C-48213.", expected: "get_customer" },
  { text: "Has #RX-77810 shipped yet?", expected: "lookup_order" },
  { text: "Update: I think my email on file is wrong. Account C-10021.", expected: "get_customer" },
  { text: "I want a refund for #RX-55019.", expected: "lookup_order" },
  { text: "Who is the account holder for C-33900?", expected: "get_customer" },
  { text: "What did I buy in #RX-10422?", expected: "lookup_order" },
  { text: "Do I have any open support tickets? C-48213", expected: "get_customer" },
  { text: "When does #RX-90001 arrive?", expected: "lookup_order" },
  { text: "What tier is customer C-77777?", expected: "get_customer" },
];

async function chosenTool(text: string): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    tools,
    messages: [{ role: "user", content: text }],
  });
  const call = response.content.find((block) => block.type === "tool_use");
  return call && call.type === "tool_use" ? call.name : "(no tool)";
}

async function main() {
  console.log(`mode: ${mode} descriptions\n`);
  let misrouted = 0;
  for (const request of requests) {
    const chosen = await chosenTool(request.text);
    const ok = chosen === request.expected;
    if (!ok) misrouted++;
    console.log(`${ok ? "ok  " : "MISS"}  ${chosen.padEnd(13)}  ${request.text}`);
  }
  console.log(`\nmisrouted: ${misrouted} / ${requests.length}`);
}

main();