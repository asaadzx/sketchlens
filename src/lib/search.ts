/**
 * Image search with two independent, key-free backends:
 *
 *  - Openverse: the best quality for line art and wall art, but anonymous
 *    requests are capped hard (page_size > 20 is rejected outright) and it can
 *    rate limit, so it is asked for a small page and treated as optional.
 *  - Wikimedia Commons: far more generous, effectively unlimited and always
 *    CORS-enabled. It carries a lot of noise, so results are filtered and it is
 *    used to top up or replace Openverse.
 *
 * Both are queried in parallel and merged, so one being down or rate limited
 * degrades the result list instead of breaking search.
 */

const OPENVERSE = 'https://api.openverse.org/v1/images/'
const COMMONS = 'https://commons.wikimedia.org/w/api.php'
const OPENVERSE_PAGE = 20

export const SOURCE_LABEL = 'Openverse + Wikimedia Commons'

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
  provider: string
}

/* Search terms that reliably pull in photographs and screenshots, which are
   useless as something to trace onto plaster. */
const NOISE = [
  'logo',
  'icon',
  'screenshot',
  'map of',
  'poster of',
  'cover of',
  'sign',
  'photograph of',
  'photo of',
  '.jpg',
  'scan of',
  'book',
  'stamp',
  'banner',
  'avatar',
  'portrait of',
]

function isUseful(title: string): boolean {
  const lower = title.toLowerCase()
  return !NOISE.some((noise) => lower.includes(noise))
}

interface RawOpenverse {
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

async function searchOpenverse(term: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: term,
    page_size: String(OPENVERSE_PAGE),
    license_type: 'commercial,modification',
    extension: 'jpg',
  })

  const response = await fetch(`${OPENVERSE}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`openverse:${response.status}`)

  const data = (await response.json()) as { results?: RawOpenverse[] }
  return (data.results ?? [])
    .filter((item): item is RawOpenverse & { id: string; url: string } =>
      Boolean(item.id && item.url && isUseful(item.title ?? '')),
    )
    .map((item) => ({
      id: `ov:${item.id}`,
      title: item.title?.trim() || 'Untitled',
      thumb: item.thumbnail || item.url,
      url: item.url,
      creator: item.creator?.trim() || 'Unknown',
      creatorUrl: item.creator_url || '',
      license: item.license?.toUpperCase() || 'CC',
      licenseUrl: item.license_url || 'https://creativecommons.org/licenses/',
      sourceUrl: item.foreign_landing_url || '',
      provider: 'Openverse',
    }))
}

interface CommonsImage {
  pageid?: number
  title?: string
  imageinfo?: {
    url?: string
    thumburl?: string
    descriptionurl?: string
    extmetadata?: Record<string, { value?: string }>
  }[]
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

async function searchCommons(term: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${term}`,
    gsrnamespace: '6',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '420',
    origin: '*',
  })

  const response = await fetch(`${COMMONS}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`commons:${response.status}`)

  const data = (await response.json()) as { query?: { pages?: Record<string, CommonsImage> } }
  const pages = Object.values(data.query?.pages ?? {})

  return pages
    .filter((page) => page.imageinfo?.[0]?.url)
    .map((page) => {
      const info = page.imageinfo![0]
      const meta = info.extmetadata ?? {}
      const title = stripHtml(page.title?.replace(/^File:/, '') ?? '')
      const author = stripHtml(meta.Artist?.value ?? '') || 'Wikimedia Commons'
      const licence = stripHtml(meta.LicenseShortName?.value ?? '') || 'CC'
      return {
        id: `commons:${page.pageid ?? title}`,
        title,
        thumb: info.thumburl || info.url!,
        url: info.url!,
        creator: author,
        creatorUrl: info.descriptionurl || '',
        license: licence.toUpperCase(),
        licenseUrl:
          meta.LicenseUrl?.value || 'https://commons.wikimedia.org/wiki/Commons:Licensing',
        sourceUrl: info.descriptionurl || '',
        provider: 'Wikimedia Commons',
      }
    })
    .filter((result) => isUseful(result.title))
}

export const SUGGESTIONS = [
  'line art',
  'minimal line drawing',
  'botanical sketch',
  'mandala',
  'single line art',
  'star constellation',
  'floral outline',
  'moon phase',
  'mountain outline',
  'cat line art',
  'wave pattern',
  'art nouveau',
]

export async function searchImages(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const term = query.trim()
  if (term.length < 3) return []

  const settled = await Promise.allSettled([
    searchOpenverse(term, signal),
    searchCommons(term, signal),
  ])

  if (settled.every((result) => result.status === 'rejected')) {
    throw new Error('Search is unavailable right now. Try a link or upload instead.')
  }

  const openverse = settled[0].status === 'fulfilled' ? settled[0].value : []
  const commons = settled[1].status === 'fulfilled' ? settled[1].value : []

  // Interleave so a dead backend cannot push the good results off the screen.
  const merged: SearchResult[] = []
  const longest = Math.max(openverse.length, commons.length)
  for (let index = 0; index < longest && merged.length < 40; index += 1) {
    if (openverse[index]) merged.push(openverse[index])
    if (commons[index] && merged.length < 40) merged.push(commons[index])
  }

  return merged
}

/** CC BY style attribution, which several of these licences require. */
export function formatAttribution(result: SearchResult): string {
  return `${result.creator} — ${result.license}`
}
