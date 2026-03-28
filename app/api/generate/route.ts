import { NextResponse } from 'next/server';

type ToneId = 'dad' | 'dry' | 'savage' | 'corporate' | 'absurd' | 'standup';

function clampString(input: string) {
  return input.trim().replace(/\s+/g, ' ');
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number) {
  return arr[Math.abs(seed) % arr.length];
}

function subjectFromInput(raw: string) {
  const s = clampString(raw);
  if (!s) return 'that';
  // Take first 80 chars, stop at punctuation if possible.
  const cutoff = 80;
  const short = s.length > cutoff ? `${s.slice(0, cutoff)}…` : s;
  const punct = short.match(/^(.*?[.!?])/);
  return (punct ? punct[1] : short).trim();
}

function containsDisallowed(raw: string) {
  const lower = raw.toLowerCase();
  const disallowed = ['kill ', 'rape', 'shoot', 'bomb', 'nazi', 'kkk'];
  return disallowed.some((w) => lower.includes(w));
}

function generatePunchline(input: string, tone: ToneId) {
  const subject = subjectFromInput(input);
  const seed = hashString(`${input}::${tone}`);

  const jokes: Record<ToneId, string[]> = {
    dad: [
      `${subject} Next thing you know, you’ll be wearing sandals with socks.`,
      `Classic dad move: ${subject} — and nobody laughed.`,
      `${subject} That’s a tough one. Like chewing glass with a smile.`,
      `${subject} If wisdom were coffee, that’s decaf.`
    ],
    dry: [
      `${subject} Remarkable. In the sense that it happened.`,
      `${subject} Bold strategy. Let’s see if anyone notices.`,
      `${subject} That’s… a choice.`,
      `${subject} So brave. So pointless. So… you.`
    ],
    savage: [
      `${subject} You really woke up and chose “career-limiting move.”`,
      `${subject} That’s not a red flag. That’s a parade.`,
      `${subject} Honestly? I’d delete that before it gets subpoenaed.`,
      `${subject} The plot twist nobody asked for.`
    ],
    corporate: [
      `${subject} Great! Let’s schedule a follow-up to agree on why this happened.`,
      `${subject} Perfect. I’ll add it to the list of things we pretend to track.`,
      `${subject} Love the ambition. Hate the outcome.`,
      `${subject} Let’s align on how we’re never doing that again.`
    ],
    absurd: [
      `${subject} — and then a raccoon in a blazer politely asked for a receipt.`,
      `${subject} Somewhere, a clown quit.`,
      `${subject} That’s when the universe sent an email asking for an extension.`,
      `${subject} Honestly? That’s exactly what the talking toaster predicted.`
    ],
    standup: [
      `${subject} I’m not saying you’re the problem, but the plot is suspicious.`,
      `${subject} That’s the kind of thing that makes a therapist adjust their glasses.`,
      `${subject} You know it’s bad when even the silence feels embarrassed.`,
      `${subject} This is why humans can’t have nice things.`
    ]
  };

  if (containsDisallowed(input)) {
    return 'No rimshots for that. Try something harmless.';
  }

  // Short inputs get an extra nudge.
  if (clampString(input).length < 8) {
    return 'Give me a little more to work with — this doesn’t need to be a novel, just a setup.';
  }

  return pick(jokes[tone], seed);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const inputText = (body?.inputText ?? '').toString();
  const tone = (body?.tone ?? 'standup') as ToneId;

  const punchline = generatePunchline(inputText, tone);
  return NextResponse.json({ punchline });
}
