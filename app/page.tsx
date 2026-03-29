'use client'

import { useEffect, useRef, useState } from 'react'

const TONES = [
  { id: 'dad', label: 'Dad Joke' },
  { id: 'dry', label: 'Dry Wit' },
  { id: 'savage', label: 'Savage' },
  { id: 'safe', label: 'Corporate Safe' },
  { id: 'absurd', label: 'Absurd' },
  { id: 'standup', label: 'Stand-up Style' },
] as const

const EXAMPLES = [
  "My boss said we’re like a family here.",
  "I’m trying to eat healthy, but Taco Bell exists.",
  "We need to circle back by EOD.",
  "I paid $11 for a coffee and a life crisis.",
]

const DONATE_URL = 'https://buymeacoffee.com/wahuwan'

type ToneId = (typeof TONES)[number]['id']

type ApiResponse = {
  punchline: string
  tone: string
}

function clampInput(input: string) {
  return input.trim().slice(0, 240)
}

function getShareText(input: string, punchline: string, toneLabel: string) {
  return `INPUT: "${input}"
TONE: ${toneLabel}
PUNCHLINE: ${punchline}

Generated on rimshot.ai
Support: ${DONATE_URL}`
}

async function playSyntheticRimshot() {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

  // Kick-ish thump
  const kickOsc = ctx.createOscillator()
  kickOsc.type = 'sine'
  kickOsc.frequency.setValueAtTime(110, ctx.currentTime)
  kickOsc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.18)

  const kickGain = ctx.createGain()
  kickGain.gain.setValueAtTime(1, ctx.currentTime)
  kickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)

  kickOsc.connect(kickGain).connect(ctx.destination)
  kickOsc.start(ctx.currentTime)
  kickOsc.stop(ctx.currentTime + 0.18)

  // Snare-ish noise burst
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'highpass'
  noiseFilter.frequency.setValueAtTime(800, ctx.currentTime)

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.6, ctx.currentTime)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)

  noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination)
  noise.start(ctx.currentTime + 0.02)
  noise.stop(ctx.currentTime + 0.22)

  // Cymbal “tss”
  const cymGain = ctx.createGain()
  cymGain.gain.setValueAtTime(0.4, ctx.currentTime)
  cymGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)

  for (let i = 0; i < 6; i++) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(220 + i * 90, ctx.currentTime)
    osc.connect(cymGain)
    osc.start(ctx.currentTime + 0.16)
    osc.stop(ctx.currentTime + 0.34)
  }

  cymGain.connect(ctx.destination)

  // Clean up
  setTimeout(() => ctx.close(), 400)
}

export default function Page() {
  const [tone, setTone] = useState<ToneId>('dry')
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [hasMp3, setHasMp3] = useState(false)

  const toneLabel = TONES.find((t) => t.id === tone)?.label ?? 'Dry Wit'

  useEffect(() => {
    let cancelled = false

    async function initAudio() {
      try {
        const res = await fetch('/rimshot.mp3', { method: 'HEAD' })
        if (cancelled) return
        if (res.ok) {
          audioRef.current = new Audio('/rimshot.mp3')
          setHasMp3(true)
        }
      } catch {
        // ignore: will use synthetic fallback
      }
    }

    initAudio()

    return () => {
      cancelled = true
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current.load()
      }
    }
  }, [])

  async function playRimshot() {
    try {
      if (hasMp3 && audioRef.current) {
        audioRef.current.currentTime = 0
        await audioRef.current.play()
      } else {
        await playSyntheticRimshot()
      }
    } catch (e) {
      console.error('Rimshot failed', e)
      await playSyntheticRimshot()
    }
  }

  async function generate() {
    const trimmed = clampInput(inputText)
    setInputText(trimmed)

    if (!trimmed) {
      setError('Type something first.')
      setResult(null)
      return
    }

    setError(null)
    setLoading(true)
    setCopied(false)
    setResult(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText: trimmed, tone }),
      })

      if (!res.ok) {
        throw new Error('Bad response')
      }

      const data = (await res.json()) as ApiResponse
      setResult(data)
    } catch {
      setError('Could not generate a punchline right now. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copyResult() {
    if (!result) return
    const share = getShareText(inputText, result.punchline, toneLabel)
    try {
      await navigator.clipboard.writeText(share)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed — your browser may block clipboard access.')
    }
  }

  return (
    <div className="wrap">
      <header className="header">
        <div className="brand">
          <span className="logo" aria-hidden>
            🥁
          </span>
          <div>
            <div className="title">rimshot.ai</div>
            <div className="subtitle">
              Type something. Get a punchline. Hit the rimshot.
            </div>
          </div>
        </div>
        <div className="hint">
          (Sound works even without a file — it synthesizes a rimshot automatically. If
          you add <code>public/rimshot.mp3</code>, it will use it.) 10% of donations go to the Prostate Cancer Foundation via wahuwan.org.
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <div className="sectionTitle">Your input</div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(clampInput(e.target.value))}
            className="textarea"
            placeholder="Write the setup, the awkward message, or the boring announcement…"
          />

          <div className="chips">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="chip"
                type="button"
                onClick={() => setInputText(ex)}
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="sectionTitle">Tone</div>

          <div className="toneRow">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={t.id === tone ? 'tone toneActive' : 'tone'}
                onClick={() => setTone(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={generate}
              disabled={loading}
            >
              {loading ? 'Generating…' : 'Generate Punchline'}
            </button>

            <button
              type="button"
              className="btnSecondary"
              onClick={() => setResult(null)}
              disabled={loading}
            >
              Clear
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </section>

        <section className="card">
          <div className="sectionTitle">Output</div>

          {!result && !error && (
            <div className="empty">
              <div className="emptyTitle">Hit Generate</div>
              <div className="emptyText">
                Keep it short and punchy—this site is designed to be screenshotable.
              </div>
            </div>
          )}

          {result && (
            <div className="resultCard">
              <div className="toneBadge">{result.tone}</div>
              <div className="inputBlock">{inputText}</div>
              <div className="punchlineBlock">{result.punchline}</div>

              <div className="resultActions">
                <button type="button" className="btn" onClick={playRimshot}>
                  🥁 Rimshot
                </button>
                <button type="button" className="btnSecondary" onClick={copyResult}>
                  {copied ? 'Copied!' : 'Copy Share Text'}
                </button>
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={generate}
                  disabled={loading}
                >
                  Regenerate
                </button>
                <a
                  className="btnSecondary"
                  href={DONATE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Donate
                </a>
              </div>

              <div className="footnote">
                pro tip: screenshot and post it. The internet loves low-effort comedy.
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
