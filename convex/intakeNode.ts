"use node";
// Node runtime: unpdf (pdf.js) does not run in the default Convex runtime.
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { structured, StructuredResult } from "./lib/claude";
import { sha256Hex } from "./lib/hash";
import { parseFields, pdfText, scanForInjection, ParserFields } from "./lib/parser";
import { Extraction, extractionJsonSchema } from "./lib/schemas";
import { INTAKE_SYSTEM_PROMPT } from "../prompts/intake";

function toBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < u8.length; i += 0x8000) binary += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(binary);
}

// Intake seat: Claude with NO tools reads the document; the parser re-reads the PDF text layer.
export const extract = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }): Promise<null> => {
    const { case: c, document: doc }: { case: Doc<"cases">; document: Doc<"documents"> } = await ctx.runQuery(
      internal.documents.forIntake,
      { caseId },
    );
    if (c.status !== "received") return null; // already picked up
    await ctx.runMutation(internal.cases.setStatus, { caseId, status: "extracting" });

    const blob = await ctx.storage.get(doc.storageId);
    if (!blob) {
      await ctx.runMutation(internal.cases.markFailed, { caseId, seat: "intake", error: "file missing from storage" });
      return null;
    }
    const bytes = await blob.arrayBuffer();
    const sha256 = await sha256Hex(bytes);

    let parserFields: ParserFields | null = null;
    let injectionFindings: { text: string; where: string }[] = [];
    if (doc.mimeType === "application/pdf") {
      try {
        const text = await pdfText(bytes);
        parserFields = parseFields(text);
        injectionFindings = scanForInjection(text);
      } catch (e) {
        console.warn(`parser failed on ${caseId}: ${(e as Error).message}`);
      }
    }

    let result: StructuredResult<Extraction>;
    try {
      result = await structured<Extraction>({
        system: INTAKE_SYSTEM_PROMPT,
        userText: `Extract the fields from this document (file name: ${JSON.stringify(doc.fileName)}).`,
        attachment: { mimeType: doc.mimeType, base64: toBase64(bytes) },
        schema: extractionJsonSchema,
        effort: "medium",
      });
    } catch (e) {
      result = { ok: false, error: `call failed: ${(e as Error).message.slice(0, 200)}`, costUsd: 0 };
    }
    if (!result.ok) {
      await ctx.runMutation(internal.cases.markFailed, { caseId, seat: "intake", error: `extraction ${result.error}` });
      return null;
    }

    await ctx.runMutation(internal.documents.saveExtraction, {
      caseId,
      sha256,
      extracted: result.value,
      parserFields,
      injectionFindings,
      costUsd: result.costUsd,
    });
    await ctx.scheduler.runAfter(0, internal.verify.run, { caseId });
    return null;
  },
});
