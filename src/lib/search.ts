import { supabase } from './supabase'
import type { HybridSearchResult, SearchMode } from './types'

export async function hybridSearch(
  query: string,
  mode: SearchMode,
  matchCount = 10
): Promise<HybridSearchResult[]> {
  const { data, error } = await supabase.rpc('hybrid_search', {
    p_query: query,
    p_match_count: matchCount,
    p_mode: mode,
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as HybridSearchResult[]
}
