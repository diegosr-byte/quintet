// Document factory (Diego): renders synthetic invoices, receipts, credit notes and the "we switched banks"
// email as real PDFs. Every page is marked SYNTHETIC. docs/contracts.md section 6.
import { action } from "./_generated/server";
import { ObjectType, v } from "convex/values";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { PERSONAS, isPersonaId } from "./lib/crs";
import { SEED_PARTIES } from "./seed";

const specArgs = {
  template: v.union(
    v.literal("invoice_a"), v.literal("invoice_b"), v.literal("invoice_c"),
    v.literal("receipt"), v.literal("credit_note"), v.literal("email_with_invoice"),
  ),
  // A seed party key (vendor or employee), or a brand-new payee. personaId makes the contact details exactly the
  // persona's, which is what lets CRS run on them.
  payee: v.union(
    v.string(),
    v.object({
      newPayee: v.object({
        displayName: v.string(), legalName: v.string(), email: v.string(), phone: v.string(),
        personaId: v.optional(v.string()),
      }),
    }),
  ),
  invoiceNumber: v.optional(v.string()),
  amountCents: v.optional(v.number()),
  lineItems: v.optional(v.array(v.object({ description: v.string(), amountCents: v.number() }))),
  issueDate: v.optional(v.string()), // YYYY-MM-DD
  ageDays: v.optional(v.number()), // receipts: dated this many days ago (ignored if issueDate is set)
  currency: v.optional(v.string()),
  bank: v.optional(v.union(v.literal("on_file"), v.literal("changed"))),
  callbackPhone: v.optional(v.string()), // "on_file" or "persona:P12"
  hiddenText: v.optional(v.union(v.string(), v.null())),
  merchant: v.optional(v.string()), // receipts
};
export type Spec = ObjectType<typeof specArgs>;

type Bank = { routingNumber: string; accountNumber: string };
type Payee = { key: string; name: string; legal: string; email: string; phone: string | null; bank: Bank | null; prefix: string; item: string };

const BUSINESS = "Bluefin Print & Design (SYNTHETIC)";
const FOOTER = "SYNTHETIC TEST DOCUMENT · Quintet demo";
// Fake accounts: routing numbers start with 99, which no real bank uses.
const CHANGED_BANK: Bank = { routingNumber: "990009412", accountNumber: "2290019412" };
const NEW_PAYEE_BANK: Bank = { routingNumber: "990005511", accountNumber: "3310055110" };
const BY_KEY: Record<string, { prefix: string; item: string }> = {
  lanternfish: { prefix: "LF", item: "Paper stock" },
  paperkite: { prefix: "PK", item: "Courier services" },
  saltmarsh: { prefix: "SM", item: "Cleaning services" },
  kestrel: { prefix: "KS", item: "Signage work" },
};
const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };
const INK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.45, 0.45, 0.5);
const WHITE = rgb(1, 1, 1);

const money = (cents: number, cur: string) =>
  `${SYMBOL[cur] ?? `${cur} `}${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPhone = (d: string) => `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 24 * 60 * 60 * 1000;

function resolvePayee(p: Spec["payee"]): Payee {
  if (typeof p === "string") {
    const s = SEED_PARTIES.find((x) => x.key === p);
    if (!s) throw new Error(`Unknown payee key "${p}"`);
    const d = BY_KEY[s.key] ?? { prefix: "EX", item: "Goods and services" };
    return { key: s.key, name: s.displayName, legal: s.legalName, email: s.email, phone: s.phone, bank: s.bank, ...d };
  }
  const n = p.newPayee;
  if (n.personaId !== undefined && !isPersonaId(n.personaId)) throw new Error(`Unknown persona "${n.personaId}"`);
  const persona = n.personaId !== undefined && isPersonaId(n.personaId) ? PERSONAS[n.personaId] : null;
  const initials = n.displayName.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return {
    key: n.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: n.displayName,
    legal: n.legalName,
    email: persona ? persona.email : n.email,
    phone: persona ? fmtPhone(persona.phone) : n.phone,
    bank: NEW_PAYEE_BANK,
    prefix: initials,
    item: "Goods and services",
  };
}

function resolvePhone(payee: Payee, cb: string | undefined): string | null {
  if (!cb || cb === "on_file") return payee.phone;
  const m = /^persona:(P\d{2})$/.exec(cb);
  if (m && isPersonaId(m[1])) return fmtPhone(PERSONAS[m[1]].phone);
  throw new Error(`Bad callbackPhone "${cb}"`);
}

type Fonts = { reg: PDFFont; bold: PDFFont };
type Inv = {
  vendor: string; legal: string; email: string; phone: string | null; number: string; issue: string; due: string;
  cur: string; items: { description: string; amountCents: number }[]; totalCents: number; bank: Bank | null; hidden: string | null;
};

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (line && font.widthOfTextAtSize(t, size) > max) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

const painter = (page: PDFPage, f: Fonts) => ({
  text: (s: string, x: number, y: number, size = 10, bold = false, color = INK) =>
    page.drawText(s, { x, y, size, font: bold ? f.bold : f.reg, color }),
  right: (s: string, xr: number, y: number, size = 10, bold = false) =>
    page.drawText(s, { x: xr - (bold ? f.bold : f.reg).widthOfTextAtSize(s, size), y, size, font: bold ? f.bold : f.reg, color: INK }),
  center: (s: string, y: number, size = 10, bold = false) =>
    page.drawText(s, { x: (page.getWidth() - (bold ? f.bold : f.reg).widthOfTextAtSize(s, size)) / 2, y, size, font: bold ? f.bold : f.reg, color: INK }),
  footer: () => page.drawText(FOOTER, { x: 50, y: 24, size: 8, font: f.reg, color: GRAY }),
  hidden: (s: string | null) => s && page.drawText(s, { x: 50, y: 40, size: 1, font: f.reg, color: WHITE }),
});

// Three layouts that differ in header, wording and block order, so intake isn't tuned to one template.
function drawInvoice(page: PDFPage, f: Fonts, inv: Inv, variant: "a" | "b" | "c") {
  const p = painter(page, f);
  const W = page.getWidth();
  const label = { a: "Total due", b: "Amount due", c: "Balance due" }[variant];
  const numLabel = { a: "Invoice #", b: "Invoice No.", c: "Invoice Number:" }[variant];
  let y = page.getHeight() - 60;

  if (variant === "b") p.center(inv.vendor, y, 20, true);
  else p.text(inv.vendor, 50, y, variant === "a" ? 20 : 16, true);
  if (variant === "a") p.right("INVOICE", W - 50, y, 20, true);
  y -= 18;
  const contact = [inv.email, inv.phone ? `Phone: ${inv.phone}` : null].filter(Boolean) as string[];
  for (const c of contact) { if (variant === "b") p.center(c, y, 9); else p.text(c, 50, y, 9, false, GRAY); y -= 12; }

  y -= 16;
  p.text(`${numLabel} ${inv.number}`, 50, y, 11, true);
  p.text(`Date: ${inv.issue}`, 50, y - 14, 10);
  p.text(`Due: ${inv.due}`, 50, y - 28, 10);
  p.text("Bill to:", W - 250, y, 10, true);
  p.text(BUSINESS, W - 250, y - 14, 10);
  y -= 58;

  const payment = () => {
    if (!inv.bank) return;
    p.text("Payment instructions", 50, y, 11, true);
    p.text(`Pay to: ${inv.legal}`, 50, y - 15);
    p.text(`Routing number: ${inv.bank.routingNumber}`, 50, y - 29);
    p.text(`Account number: ${inv.bank.accountNumber}`, 50, y - 43);
    y -= 70;
  };
  if (variant === "c") payment();

  p.text("Description", 50, y, 10, true);
  p.right("Amount", W - 50, y, 10, true);
  page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: W - 50, y: y - 5 }, thickness: 0.5, color: GRAY });
  y -= 20;
  for (const it of inv.items) {
    p.text(it.description, 50, y);
    p.right(money(it.amountCents, inv.cur), W - 50, y);
    y -= 15;
  }
  y -= 10;
  if (inv.items.length > 1) { p.right(`Subtotal: ${money(inv.totalCents, inv.cur)}`, W - 50, y); y -= 16; }
  p.right(`${label}: ${money(inv.totalCents, inv.cur)}`, W - 50, y, 12, true);
  y -= 40;
  if (variant !== "c") payment();

  p.footer();
  p.hidden(inv.hidden);
}

function drawEmail(page: PDFPage, f: Fonts, inv: Inv) {
  const p = painter(page, f);
  let y = page.getHeight() - 70;
  const header = [
    `From: ${inv.legal} <${inv.email}>`,
    "To: accounts@bluefinprint.example",
    `Date: ${inv.issue}`,
    `Subject: Updated payment details for invoice ${inv.number}`,
  ];
  for (const h of header) { p.text(h, 50, y, 10); y -= 16; }
  page.drawLine({ start: { x: 50, y: y + 6 }, end: { x: page.getWidth() - 50, y: y + 6 }, thickness: 0.5, color: GRAY });
  y -= 14;
  const body = [
    "Hi,",
    `We recently switched banks. Please use the new bank account on the attached invoice for this and all future payments.${inv.phone ? ` If you have any questions, call us on our new number: ${inv.phone}.` : ""}`,
    "Thanks for your continued business.",
    inv.vendor,
  ];
  for (const para of body) {
    for (const line of wrap(para, f.reg, 11, page.getWidth() - 100)) { p.text(line, 50, y, 11); y -= 15; }
    y -= 8;
  }
  p.footer();
}

function drawReceipt(page: PDFPage, f: Fonts, merchant: string, issue: string, cur: string, items: Inv["items"], totalCents: number) {
  const p = painter(page, f);
  const W = page.getWidth();
  let y = page.getHeight() - 40;
  p.center(merchant, y, 14, true);
  y -= 16;
  p.center("123 Market Street (SYNTHETIC)", y, 8);
  y -= 24;
  p.text(`Date: ${issue}`, 24, y, 9);
  y -= 22;
  for (const it of items) {
    p.text(it.description, 24, y, 9);
    p.right(money(it.amountCents, cur), W - 24, y, 9);
    y -= 14;
  }
  y -= 8;
  p.right(`Total: ${money(totalCents, cur)}`, W - 24, y, 11, true);
  y -= 22;
  p.text("VISA ****0000", 24, y, 9);
  p.text(FOOTER, 24, 14, 6);
}

function drawCreditNote(page: PDFPage, f: Fonts, inv: Inv) {
  const p = painter(page, f);
  const W = page.getWidth();
  let y = page.getHeight() - 60;
  p.text(inv.vendor, 50, y, 18, true);
  p.right("CREDIT NOTE", W - 50, y, 18, true);
  y -= 30;
  p.text(`Credit note # ${inv.number}`, 50, y, 11, true);
  p.text(`Date: ${inv.issue}`, 50, y - 14);
  p.text(`Issued to: ${BUSINESS}`, 50, y - 28);
  y -= 70;
  p.text("Credit for returned goods", 50, y);
  y -= 30;
  p.right(`Total credit: ${money(inv.totalCents, inv.cur)}`, W - 50, y, 12, true);
  y -= 30;
  p.text("This credit may be applied to future invoices.", 50, y, 10, false, GRAY);
  p.footer();
}

export async function buildDocument(spec: Spec, now: Date = new Date()): Promise<{ bytes: Uint8Array; fileName: string }> {
  const payee = resolvePayee(spec.payee);
  const cur = spec.currency ?? "USD";
  const issue = spec.issueDate ?? iso(new Date(now.getTime() - (spec.ageDays ?? 0) * DAY));
  const stamp = String(now.getTime()).slice(-5);
  const items = spec.lineItems ?? (spec.amountCents !== undefined ? [{ description: payee.item, amountCents: spec.amountCents }] : [{ description: payee.item, amountCents: 25000 }]);
  const totalCents = spec.amountCents ?? items.reduce((s, i) => s + i.amountCents, 0);
  const inv: Inv = {
    vendor: payee.name, legal: payee.legal, email: payee.email, phone: resolvePhone(payee, spec.callbackPhone),
    number: spec.invoiceNumber ?? `${payee.prefix}-${stamp}`, issue, due: iso(new Date(Date.parse(issue) + 30 * DAY)),
    cur, items, totalCents, bank: spec.bank === "changed" ? CHANGED_BANK : payee.bank, hidden: spec.hiddenText ?? null,
  };

  const doc = await PDFDocument.create();
  const f: Fonts = { reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const letter: [number, number] = [612, 792];
  let fileName = `${payee.key}-${inv.number}.pdf`;

  switch (spec.template) {
    case "invoice_a": case "invoice_b": case "invoice_c":
      drawInvoice(doc.addPage(letter), f, inv, spec.template.slice(-1) as "a" | "b" | "c");
      break;
    case "email_with_invoice":
      drawEmail(doc.addPage(letter), f, inv);
      drawInvoice(doc.addPage(letter), f, inv, "a");
      break;
    case "credit_note":
      drawCreditNote(doc.addPage(letter), f, { ...inv, number: spec.invoiceNumber ?? `CN-${stamp}` });
      fileName = `credit-note-${payee.key}-${stamp}.pdf`;
      break;
    case "receipt": {
      const merchant = spec.merchant ?? "Corner Market";
      const rItems = spec.lineItems ?? [];
      const total = spec.amountCents ?? (rItems.length ? rItems.reduce((s, i) => s + i.amountCents, 0) : 2500);
      drawReceipt(doc.addPage([300, 150 + rItems.length * 14]), f, merchant, issue, cur, rItems, total);
      fileName = `receipt-${payee.key}-${issue}-${stamp}.pdf`;
      break;
    }
  }
  return { bytes: await doc.save(), fileName };
}

// Public so the judge console and the eval runner can both call it. Synthetic documents only.
export const render = action({
  args: specArgs,
  handler: async (ctx, spec): Promise<{ storageId: string; fileName: string; mimeType: string }> => {
    const { bytes, fileName } = await buildDocument(spec);
    const storageId = await ctx.storage.store(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    return { storageId, fileName, mimeType: "application/pdf" };
  },
});
