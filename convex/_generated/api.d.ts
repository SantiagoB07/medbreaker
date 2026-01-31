/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as evaluations from "../evaluations.js";
import type * as http from "../http.js";
import type * as kapsoWebhook from "../kapsoWebhook.js";
import type * as kapsoWebhookAction from "../kapsoWebhookAction.js";
import type * as messages from "../messages.js";
import type * as patients from "../patients.js";
import type * as procedures from "../procedures.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  evaluations: typeof evaluations;
  http: typeof http;
  kapsoWebhook: typeof kapsoWebhook;
  kapsoWebhookAction: typeof kapsoWebhookAction;
  messages: typeof messages;
  patients: typeof patients;
  procedures: typeof procedures;
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
