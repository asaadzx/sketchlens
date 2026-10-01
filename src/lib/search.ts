/**
 * Openverse (WordPress Foundation) needs no API key, returns results under
 * licences that allow commercial use and modification, and sends CORS headers
 * so the browser can fetch and re-draw them on a canvas.
 */
const ENDPOINT = 'https://api.openverse.org/v1/images/'

export interface SearchResult {
  id: string
  title: string
  thumb: string
  url: string
  creator: string
  creatorUrl: string
  license: string
  licenseUrl: string
  sourceUrl: string
}

interface RawResult {
  id?: string
  title?: string | null
  url?: string | null
  thumbnail?: string | null
  creator?: string | null
  creator_url?: string | null
  license?: string | null
  license_url?: string | null
  foreign_landing_url?: string | null
}

export const SUGGESTIONS = [
  'line art',
  'minimal line drawing',
  'botanical sketch',
  'geometric wall art',
  'mandala outline',
  'single line art',
  'star constellation',
  'floral outline',
  'moon phase',
  'mountain line art',
  'cat line art',
  'wave pattern',
]

export async function searchImages(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: '24',
    license_type: 'commercial,modification',
    extension: 'jpg',
    mature: 'false',
  })

  const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(response.status === 429 ? 'Too many searches, wait a moment.' : 'Search failed.')
  }

  const data = (await response.json()) as { results?: RawResult[] }
  const results = data.results ?? []

  return results
    .filter((item): item is Required<Pick<RawResult, 'id' | 'url'>> & RawResult => Boolean(item.id && item.url))
    .map((item) => ({
      id: item.id,
      title: item.title?.trim() || 'Untitled',
      thumb: item.thumbnail || item.url!,
      url: item.url!,
      creator: item.creator?.trim() || 'Unknown',
      creatorUrl: item.creator_url || '',
      license: item.license?.toUpperCase() || 'CC',
      licenseUrl: item.license_url || 'https://creativecommons.org/licenses/',
      sourceUrl: item.foreign_landing_url || '',
    }))
}

/** CC-BY style attribution string, required by several of the licences Openverse returns. */
export function formatAttribution(result: SearchResult): string {
  return `${result.creator} — ${result.license}`
}
