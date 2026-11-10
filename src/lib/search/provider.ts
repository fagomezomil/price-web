/* ============================================================
   search/provider.ts — SearchProvider interface + elección por env.
   'meili' (prod, typo tolerance + synonyms) / 'sql' (dev fallback,
   LIKE multi-token, degradación documentada).
   ============================================================ */
import { env } from "@/env";
import type { SearchRespuesta } from "@/types";

import { MeiliProvider } from "./meili-provider";
import { SqlProvider } from "./sql-provider";

export interface SearchProvider {
  readonly nombre: string;
  search(q: string, zona?: string, limit?: number): Promise<SearchRespuesta>;
}

export function getSearchProvider(): SearchProvider {
  return env.PRECIO_SEARCH === "meili" ? new MeiliProvider() : new SqlProvider();
}
