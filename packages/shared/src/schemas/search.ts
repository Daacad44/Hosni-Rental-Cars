import { z } from 'zod';

/** Global topbar search (§9). */
export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export interface SearchResultItem {
  id: string;
  label: string;
  sublabel: string;
}

export interface SearchResults {
  vehicles: SearchResultItem[];
  customers: SearchResultItem[];
  agreements: SearchResultItem[];
}
