/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ViktorSpacesEmail from "../ViktorSpacesEmail.js";
import type * as auth from "../auth.js";
import type * as budgets from "../budgets.js";
import type * as categories from "../categories.js";
import type * as collaborators from "../collaborators.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as googleAuth from "../googleAuth.js";
import type * as http from "../http.js";
import type * as lib from "../lib.js";
import type * as notifications from "../notifications.js";
import type * as profiles from "../profiles.js";
import type * as reports from "../reports.js";
import type * as savings from "../savings.js";
import type * as seedTestUser from "../seedTestUser.js";
import type * as testAuth from "../testAuth.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";
import type * as viktorSpaceAuthConfig from "../viktorSpaceAuthConfig.js";
import type * as viktorSpaceAuthEnv from "../viktorSpaceAuthEnv.js";
import type * as viktorTools from "../viktorTools.js";
import type * as waParser from "../waParser.js";
import type * as wallets from "../wallets.js";
import type * as whatsapp from "../whatsapp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ViktorSpacesEmail: typeof ViktorSpacesEmail;
  auth: typeof auth;
  budgets: typeof budgets;
  categories: typeof categories;
  collaborators: typeof collaborators;
  constants: typeof constants;
  crons: typeof crons;
  dashboard: typeof dashboard;
  googleAuth: typeof googleAuth;
  http: typeof http;
  lib: typeof lib;
  notifications: typeof notifications;
  profiles: typeof profiles;
  reports: typeof reports;
  savings: typeof savings;
  seedTestUser: typeof seedTestUser;
  testAuth: typeof testAuth;
  transactions: typeof transactions;
  users: typeof users;
  viktorSpaceAuthConfig: typeof viktorSpaceAuthConfig;
  viktorSpaceAuthEnv: typeof viktorSpaceAuthEnv;
  viktorTools: typeof viktorTools;
  waParser: typeof waParser;
  wallets: typeof wallets;
  whatsapp: typeof whatsapp;
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
