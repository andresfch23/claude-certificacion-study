import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";
const CATEGORIES = ["cards", "accessories", "shipping", "other"] as const;

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface Invoice {
  invoice_number: string;
  customer_name: string | null;
  due_date: string | null;
  category: (typeof CATEGORIES)[number];
  category_detail: string | null;
  line_items: LineItem[];
  stated_total: number;
}

const recordInvoice: Anthropic.Tool = {
  name: "record_invoice",
  description:
    "Record the fields of one invoice exactly as the document states them. " +
    "Use null for any field the document does not state. Never guess or fill in a likely value.",
  input_schema: {
    type: "object",
    properties: {
      invoice_number: { type: "string" },
      customer_name: { type: ["string", "null"] },
      due_date: {
        type: ["string", "null"],
        description: "ISO date (YYYY-MM-DD), or null when the invoice states no due date",
      },
      category: { type: "string", enum: [...CATEGORIES] },
      category_detail: {
        type: ["string", "null"],
        description: "What the purchase is, in a few words. Fill this in when category is 'other', otherwise null",
      },
      line_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: "number" },
          },
          required: ["description", "quantity", "unit_price"],
        },
      },
      stated_total: {
        type: "number",
        description: "The total printed on the invoice. Copy it; do not recalculate it",
      },
    },
    required: [
      "invoice_number",
      "customer_name",
      "due_date",
      "category",
      "category_detail",
      "line_items",
      "stated_total",
    ],
  },
};

const documents: { title: string; text: string }[] = [
  {
    title: "A. Complete invoice",
    text: `The Guardians Collectors — Invoice GC-1001
            Bill to: Marta Ruiz
            Due: 15 December 2026
            3 x Booster pack "Ancient Guardians" @ $12.00
            1 x Starter deck @ $24.00
            TOTAL: $60.00`,
  },
  {
    title: "B. Missing fields, unusual purchase",
    text: `hey, here's the receipt you asked for (GC-1002)

          1 glass display cabinet w/ LED lighting ....... 340.00
          delivery was free

          total 340.00
          thanks!!`,
  },
  {
    title: "C. Total does not match the items",
    text: `The Guardians Collectors — Invoice GC-1003
            Bill to: Julian Ortega
            Due: 2026-12-20
            2 x Card sleeves (100 ct) @ $10.00
            1 x Deck box @ $45.00
            TOTAL: $60.00`,
  },
];

async function extractInvoice(text: string): Promise<Invoice> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    tools: [recordInvoice],
    tool_choice: { type: "tool", name: recordInvoice.name },
    messages: [{ role: "user", content: text }],
  });

  const call = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!call) throw new Error("The model did not call record_invoice");
  return call.input as Invoice;
}

function calculatedTotal(invoice: Invoice): number {
  const sum = invoice.line_items.reduce((total, item) => total + item.quantity * item.unit_price, 0);
  return Math.round(sum * 100) / 100;
}

function describeTotalCheck(invoice: Invoice): string {
  const calculated = calculatedTotal(invoice);
  const verdict = calculated === invoice.stated_total ? "ok" : "MISMATCH, send to human review";
  return `items add up to ${calculated.toFixed(2)}, invoice states ${invoice.stated_total.toFixed(2)}: ${verdict}`;
}

async function main() {
  for (const document of documents) {
    const invoice = await extractInvoice(document.text);
    console.log(`\n=== ${document.title} ===`);
    console.log(JSON.stringify(invoice, null, 2));
    console.log(`check: ${describeTotalCheck(invoice)}`);
  }
}

main();