/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as approvals from "../approvals.js";
import type * as audit from "../audit.js";
import type * as calls from "../calls.js";
import type * as cases from "../cases.js";
import type * as documents from "../documents.js";
import type * as evals from "../evals.js";
import type * as explain from "../explain.js";
import type * as gateRun from "../gateRun.js";
import type * as intakeNode from "../intakeNode.js";
import type * as lib_claude from "../lib/claude.js";
import type * as lib_gate from "../lib/gate.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_nessie from "../lib/nessie.js";
import type * as lib_parser from "../lib/parser.js";
import type * as lib_policy from "../lib/policy.js";
import type * as lib_schemas from "../lib/schemas.js";
import type * as orgs from "../orgs.js";
import type * as payments from "../payments.js";
import type * as policy from "../policy.js";
import type * as seed from "../seed.js";
import type * as verify from "../verify.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  approvals: typeof approvals;
  audit: typeof audit;
  calls: typeof calls;
  cases: typeof cases;
  documents: typeof documents;
  evals: typeof evals;
  explain: typeof explain;
  gateRun: typeof gateRun;
  intakeNode: typeof intakeNode;
  "lib/claude": typeof lib_claude;
  "lib/gate": typeof lib_gate;
  "lib/hash": typeof lib_hash;
  "lib/nessie": typeof lib_nessie;
  "lib/parser": typeof lib_parser;
  "lib/policy": typeof lib_policy;
  "lib/schemas": typeof lib_schemas;
  orgs: typeof orgs;
  payments: typeof payments;
  policy: typeof policy;
  seed: typeof seed;
  verify: typeof verify;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
