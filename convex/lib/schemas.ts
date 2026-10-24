// STUB by Josiah, per docs/contracts.md §5. Diego owns this file: replace wholesale.
import type { DocKind } from "./policy";

export type LineItemCategory = "goods" | "services" | "food" | "alcohol" | "gift_card" | "tobacco" | "other";

export type Extraction = {
  docKind: DocKind;
  vendorOrMerchantName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  totalCents: number | null;
  lineItems: { description: string; amountCents: number; category: LineItemCategory }[];
  payTo: { name: string; routingNumber: string; accountNumber: string } | null;
  itemized: boolean | null;
  suspiciousInstructions: string[];
  confidence: number;
  missingFields: string[];
};

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

// JSON Schema for output_config.format (structured outputs).
export const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "docKind", "vendorOrMerchantName", "contactEmail", "contactPhone", "invoiceNumber", "issueDate", "dueDate",
    "currency", "totalCents", "lineItems", "payTo", "itemized", "suspiciousInstructions", "confidence", "missingFields",
  ],
  properties: {
    docKind: { type: "string", enum: ["invoice", "receipt", "email", "credit_note", "unknown"] },
    vendorOrMerchantName: nullable({ type: "string" }),
    contactEmail: nullable({ type: "string" }),
    contactPhone: nullable({ type: "string" }),
    invoiceNumber: nullable({ type: "string" }),
    issueDate: nullable({ type: "string", description: "YYYY-MM-DD" }),
    dueDate: nullable({ type: "string", description: "YYYY-MM-DD" }),
    currency: { type: "string", description: "ISO 4217 code, e.g. USD" },
    totalCents: nullable({ type: "integer" }),
    lineItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "amountCents", "category"],
        properties: {
          description: { type: "string" },
          amountCents: { type: "integer" },
          category: { type: "string", enum: ["goods", "services", "food", "alcohol", "gift_card", "tobacco", "other"] },
        },
      },
    },
    payTo: nullable({
      type: "object",
      additionalProperties: false,
      required: ["name", "routingNumber", "accountNumber"],
      properties: { name: { type: "string" }, routingNumber: { type: "string" }, accountNumber: { type: "string" } },
    }),
    itemized: nullable({ type: "boolean" }),
    suspiciousInstructions: { type: "array", items: { type: "string" } },
    confidence: { type: "number", description: "0 to 1" },
    missingFields: { type: "array", items: { type: "string" } },
  },
} as const;
