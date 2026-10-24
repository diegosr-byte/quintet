// Deterministic re-read of a PDF's text layer. Cross-checks Claude and finds hidden instructions.
import { extractText, getDocumentProxy } from "unpdf";

export type ParserFields = {
  totalCents: number | null;
  routingNumber: string | null;
  accountNumber: string | null;
  invoiceNumber: string | null;
};

export async function pdfText(bytes: ArrayBuffer): Promise<string> {
  // pdf.js detaches the buffer it is given, so hand it a copy.
  const pdf = await getDocumentProxy(new Uint8Array(bytes.slice(0)));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

function dollarsToCents(s: string): number {
  return Math.round(parseFloat(s.replace(/,/g, "")) * 100);
}

export function parseFields(text: string): ParserFields {
  // Prefer the last "total"/"amount due" line: subtotals come first on most invoices.
  const totals = [...text.matchAll(/(?:total|amount due|balance due)[^\d$€]{0,20}[$€]?\s*([\d,]+\.\d{2})/gi)];
  const routing = text.match(/routing(?:\s*(?:number|no\.?|#))?\s*[:#]?\s*(\d{9})\b/i);
  const account = text.match(/account(?:\s*(?:number|no\.?|#))?\s*[:#]?\s*(\d{4,17})\b/i);
  const invoice = text.match(/invoice\s*(?:number|no\.?|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{2,})/i);
  return {
    totalCents: totals.length ? dollarsToCents(totals[totals.length - 1][1]) : null,
    routingNumber: routing?.[1] ?? null,
    accountNumber: account?.[1] ?? null,
    invoiceNumber: invoice?.[1] ?? null,
  };
}

const INJECTION_PATTERNS = [
  /\b(?:ai|assistant|system|model|llm|claude|gpt)\b\s*[:,-]/i,
  /ignore (?:all |any )?(?:previous|prior|above) instructions/i,
  /pre-?approved/i,
  /pay (?:this )?immediately/i,
  /approve (?:this|the) (?:invoice|payment)/i,
  /without (?:review|approval|verification)/i,
  /do not (?:flag|verify|call)/i,
];

// Returns each sentence of the text layer that looks addressed to an AI.
export function scanForInjection(text: string): { text: string; where: string }[] {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const hits = sentences.filter((s) => INJECTION_PATTERNS.some((p) => p.test(s)));
  return [...new Set(hits.map((s) => s.trim().slice(0, 300)))].map((t) => ({ text: t, where: "pdf_text_layer" }));
}
