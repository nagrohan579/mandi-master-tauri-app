/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as damageManagement from "../damageManagement.js";
import type * as debug from "../debug.js";
import type * as entryManagement from "../entryManagement.js";
import type * as masterData from "../masterData.js";
import type * as openingBalances from "../openingBalances.js";
import type * as payments from "../payments.js";
import type * as procurement from "../procurement.js";
import type * as reports from "../reports.js";
import type * as sales from "../sales.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  damageManagement: typeof damageManagement;
  debug: typeof debug;
  entryManagement: typeof entryManagement;
  masterData: typeof masterData;
  openingBalances: typeof openingBalances;
  payments: typeof payments;
  procurement: typeof procurement;
  reports: typeof reports;
  sales: typeof sales;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
