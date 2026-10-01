import { useEffect, useRef, useState } from 'react'
import { ExternalLink, ImagePlus, Link2, Loader2, Search, Upload, X } from 'lucide-react'
import {
  SOURCE_LABEL,
  SUGGESTIONS,
  formatAttribution,
  searchImages,
  type SearchResult,
} from '../lib/search'
import { Panel, Segmented } from './ui'

type Tab = 'search' | 'link' | 'upload'

export interface PickedImage {
  src: string
  attribution: string
  shareable: boolean
}

export function SourcePanel({
  open,
  onClose,
  onPick,
  busy,
}: {
  open: boolean
  onClose: () => void
  onPick: (picked: PickedImage) => void
  busy: boolean
}) {
  const [tab, setTab] = useState<Tab>('search')
  if (!open) return null

  return (
    <Panel title="Choose an image" onClose={onClose}>
      <div className="space-y-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'search', label: 'Search' },
            { value: 'link', label: 'Link' },
            { value: 'upload', label: 'Upload' },
          ]}
        />

        {tab === 'search' ? <SearchTab onPick={onPick} busy={busy} /> : null}
        {tab === 'link' ? <LinkTab onPick={onPick} /> : null}
        {tab === 'upload' ? <UploadTab onPick={onPick} /> : null}
      </div>
    </Panel>
  )
}

function SearchTab({ onPick, busy }: { onPick: (picked: PickedImage) => void; busy: boolean }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const controller = useRef<AbortController | null>(null)

  const term = query.trim()

  // Derive the "not searching yet" view instead of resetting it from an effect.
  const short = term.length < 3

  useEffect(() => {
    if (short) return

    const timer = window.setTimeout(async () => {
      controller.current?.abort()
      const next = new AbortController()
      controller.current = next
      setStatus('loading')
      try {
        const found = await searchImages(term, next.signal)
        if (next.signal.aborted) return
        setResults(found)
        setStatus('done')
        setMessage(found.length === 0 ? 'Nothing matched. Try a simpler word.' : '')
      } catch (error) {
        if (next.signal.aborted) return
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Search failed.')
      }
    }, 420)

    return () => window.clearTimeout(timer)
  }, [term, short])

  useEffect(() => () => controller.current?.abort(), [])

  return (
    <div className="space-y-4 pb-1">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 focus-within:border-clay">
        <Search className="size-4 shrink-0 text-ink-faint" strokeWidth={2} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="line art, botanical, mandala…"
          aria-label="Search images"
          autoComplete="off"
          className="w-full bg-transparent text-[0.95rem] outline-none placeholder:text-ink-faint"
        />
        {status === 'loading' ? <Loader2 className="size-4 animate-spin text-ink-faint" /> : null}
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
              setStatus('idle')
              setMessage('')
            }}
            aria-label="Clear search"
            className="text-ink-faint hover:text-ink"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {!query ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Try</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-ink-soft transition hover:border-clay hover:text-clay"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-clay-deep">{message}</p> : null}

      {!short && results.length > 0 ? (
        <>
          <p className="text-xs text-ink-faint">
            {results.length} results · {SOURCE_LABEL}, commercial use and modification allowed
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onPick({
                      src: result.url,
                      attribution: formatAttribution(result),
                      shareable: true,
                    })
                  }
                  className="group block w-full overflow-hidden rounded-xl border border-line bg-card transition hover:border-clay disabled:opacity-50"
                >
                  <img
                    src={result.thumb}
                    alt={result.title}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="aspect-square w-full object-cover"
                  />
                  <span className="flex items-center justify-between gap-1 px-2 py-1.5 text-[0.6rem] font-medium tracking-wide text-ink-soft uppercase">
                    <span className="truncate">{result.creator}</span>
                    <span className="shrink-0 rounded bg-shell px-1 py-0.5 text-[0.55rem]">
                      {result.license}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function LinkTab({ onPick }: { onPick: (picked: PickedImage) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      setError('That does not look like a valid URL.')
      return
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      setError('Only http and https image links work.')
      return
    }
    setError('')
    onPick({ src: parsed.toString(), attribution: '', shareable: true })
  }

  return (
    <div className="space-y-3 pb-1">
      <p className="text-sm leading-relaxed text-ink-soft">
        Already found a picture? Paste any public image link — it will load straight into the
        overlay.
      </p>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 focus-within:border-clay">
        <Link2 className="size-4 shrink-0 text-ink-faint" strokeWidth={2} />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="https://…/image.jpg"
          aria-label="Image URL"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-[0.95rem] outline-none placeholder:text-ink-faint"
        />
      </div>
      {error ? <p className="text-sm text-clay-deep">{error}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-cream transition hover:bg-clay disabled:opacity-40"
      >
        <ImagePlus className="size-4" strokeWidth={2} />
        Load image
      </button>
    </div>
  )
}

function UploadTab({ onPick }: { onPick: (picked: PickedImage) => void }) {
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="space-y-3 pb-1">
      <p className="text-sm leading-relaxed text-ink-soft">
        Pick something from your gallery. Gallery images stay on your device, so they are not
        included in share links.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          if (!file.type.startsWith('image/')) {
            setError('That file is not an image.')
            return
          }
          setError('')
          onPick({ src: URL.createObjectURL(file), attribution: '', shareable: false })
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card px-4 py-5 text-sm font-semibold text-ink transition hover:border-clay hover:text-clay"
      >
        <Upload className="size-4" strokeWidth={2} />
        Choose from gallery
      </button>
      {error ? <p className="text-sm text-clay-deep">{error}</p> : null}
      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
        <ExternalLink className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
        CC BY and CC BY-SA images from the search tab keep their credit line in the corner of the
        view.
      </p>
    </div>
  )
}
