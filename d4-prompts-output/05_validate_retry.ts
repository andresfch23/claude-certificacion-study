import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";
const MAX_ATTEMPTS = 3;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const useExamples = process.argv[2] === "examples";

interface Invoice {
  invoice_number: string;
  customer_name: string | null;
  due_date: string | null;
  stated_total: number;
}

type Outcome =
  | { status: "accepted"; invoice: Invoice; attempts: number }
  | { status: "needs_human"; reason: string; attempts: number };

const recordInvoice: Anthropic.Tool = {
  name: "record_invoice",
  description:
    "Record the fields of one invoice, copying each value as the document writes it. " +
    "Use null for any field the document does not state.",
  input_schema: {
    type: "object",
    properties: {
      invoice_number: { type: "string" },
      customer_name: { type: ["string", "null"] },
      due_date: { type: ["string", "null"] },
      stated_total: { type: "number" },
    },
    required: ["invoice_number", "customer_name", "due_date", "stated_total"],
  },
};

const EXAMPLES = `Here are two worked examples of correct records.

<example>
Document:
Invoice GC-0900 for Elena Vargas. Payment due March 3rd, 2026. Total $18.50
Record:
{"invoice_number": "GC-0900", "customer_name": "Elena Vargas", "due_date": "2026-03-03", "stated_total": 18.5}
</example>

<example>
Document:
receipt GC-0901, 2 deck boxes, total 90.00, pay by 07/11/2026 (day/month/year)
Record:
{"invoice_number": "GC-0901", "customer_name": null, "due_date": "2026-11-07", "stated_total": 90}
</example>`;

const documents: { title: string; text: string }[] = [
  {
    title: "A. Date written out in words",
    text: `The Guardians Collectors — Invoice GC-2001
Bill to: Marta Ruiz
Due: 15 December 2026
3 x Booster pack @ $12.00
TOTAL: $36.00`,
  },
  {
    title: "B. Customer name is not in the document",
    text: `hey, here's the receipt you asked for (GC-2002)
1 glass display cabinet ....... 340.00
total 340.00
thanks!!`,
  },
];

function findProblems(invoice: Invoice, source: string): string[] {
  const problems: string[] = [];

  if (invoice.customer_name === null) {
    problems.push("customer_name is required, but it is null");
  } else if (!source.includes(invoice.customer_name)) {
    problems.push(`customer_name "${invoice.customer_name}" does not appear in the document`);
  }

  if (invoice.due_date !== null && !ISO_DATE.test(invoice.due_date)) {
    problems.push(`due_date must use the format YYYY-MM-DD, but it is "${invoice.due_date}"`);
  }

  return problems;
}

function feedbackFor(problems: string[]): string {
  return [
    "Validation failed:",
    ...problems.map((problem) => `- ${problem}`),
    "Read the document again and call record_invoice with corrected values.",
    "If the document does not state a value, keep it null. Never invent one.",
  ].join("\n");
}

async function requestRecord(messages: Anthropic.MessageParam[]): Promise<Anthropic.Message> {
  return client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: useExamples ? EXAMPLES : undefined,
    tools: [recordInvoice],
    tool_choice: { type: "tool", name: recordInvoice.name },
    messages,
  });
}

function toolCallIn(response: Anthropic.Message): Anthropic.ToolUseBlock {
  const call = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!call) throw new Error("The model did not call record_invoice");
  return call;
}

/**
 * Sends each failed record back with its exact validation errors, up to MAX_ATTEMPTS.
 * Stops early when a retry returns the same problems, because another retry would change nothing.
 */
async function extractWithRetry(source: string): Promise<Outcome> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: source }];
  let previousProblems: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await requestRecord(messages);
    const call = toolCallIn(response);
    const invoice = call.input as Invoice;
    const problems = findProblems(invoice, source);

    console.log(`attempt ${attempt}: ${JSON.stringify(invoice)}`);
    for (const problem of problems) console.log(`  problem: ${problem}`);

    if (problems.length === 0) return { status: "accepted", invoice, attempts: attempt };
    if (problems.join() === previousProblems.join()) {
      return { status: "needs_human", reason: "the retry changed nothing", attempts: attempt };
    }

    previousProblems = problems;
    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: feedbackFor(problems) }],
      },
    );
  }

  return { status: "needs_human", reason: `still invalid after ${MAX_ATTEMPTS} attempts`, attempts: MAX_ATTEMPTS };
}

function describe(outcome: Outcome): string {
  if (outcome.status === "accepted") return `accepted after ${outcome.attempts} attempt(s)`;
  return `sent to a human after ${outcome.attempts} attempt(s): ${outcome.reason}`;
}

async function main() {
  console.log(`mode: ${useExamples ? "with examples in the prompt" : "no examples"}`);
  for (const document of documents) {
    console.log(`\n=== ${document.title} ===`);
    const outcome = await extractWithRetry(document.text);
    console.log(`result: ${describe(outcome)}`);
  }
}

main();