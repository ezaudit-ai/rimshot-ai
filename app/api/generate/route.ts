import { NextResponse } from 'next/server';

type ToneId = 'dad' | 'dry' | 'savage' | 'safe' | 'absurd' | 'standup';

const TONE_LABELS: Record<ToneId, string> = {
  dad: 'Dad Joke',
  dry: 'Dry Wit',
  savage: 'Savage',
  safe: 'Corporate Safe',
  absurd: 'Absurd',
  standup: 'Stand-up Style',
};

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

  const cutoff = 80;
  const short = s.length > cutoff ? `${s.slice(0, cutoff)}…` : s;
  const punct = short.match(/^(.*?[.!?])/);
  return (punct ? punct[1] : short).trim();
}

function containsDisallowed(raw: string) {
  const lower = raw.toLowerCase();
  const disallowed = ['kill', 'rape', 'shoot', 'bomb', 'nazi', 'kkk'];
  return disallowed.some((w) => lower.includes(w));
}

function generatePunchline(input: string, tone: ToneId) {
  const subject = subjectFromInput(input);
  const seed = hashString(`${input}::${tone}`);

  const jokes: Record<ToneId, string[]> = {
 dad: [
      `${subject} Next thing you know, you'll explain the joke and make it worse.`,
      `${subject} Honestly? That's the punchline now.`,
      `${subject} That's not a plan, that's a tradition.`,
      `${subject} If wisdom were coffee, that would be decaf and lukewarm.`
    ],
    dry: [
      `${subject} Remarkable. In the sense that it exists.`,
      `${subject} Bold strategy. Let's see if it feels awkward in person.`,
      `${subject} That's… a choice.`,
      `${subject} Congrats on making silence uncomfortable.`
    ],
    savage: [
      `${subject} You really woke up and chose "career-limiting move".`,
      `${subject} That's not a red flag. That's a parade.`,
      `${subject} If there were consequences, they'd be drafting you right now.`,
      `${subject} The twist nobody asked for and HR won't approve.`
    ],
    safe: [
      `${subject} Great—I'll put it on the list of things we pretend are under control.`,
      `${subject} Perfect. Let's schedule a follow-up to agree on why this happened.`,
      `${subject} Love the ambition. Concerned by literally everything else.`,
      `${subject} Let's align on how we're never doing that again.`
    ],
    absurd: [
      `${subject} — and that's when a raccoon in a blazer politely asked for a receipt.`,
      `${subject} Somewhere, a clown quit out of respect.`,
      `${subject} The universe sent an email asking for an extension.`,
      `${subject} Honestly? That's exactly what the toaster predicted.`
    ],
    standup: [
      `${subject} I'm not saying you're the problem… but the plot is suspicious.`,
      `${subject} That's the kind of thing that makes a therapist adjust their glasses.`,
      `${subject} You know it's bad when even the silence feels embarrassed.`,
      `${subject} This is why humans can't have nice things.`
    ]
  };

  if (containsDisallowed(input)) {
    return 'No rimshots for that. Try something harmless.';
  }

  const short = clampString(input);
  if (!short) {
    return "Type a setup first—I'll handle the punchline.";
  }

  if (short.length < 8) {
    return "Give me a little more to work with—this doesn't need to be a novel, just a setup.";
  }

  return pick(jokes[tone], seed);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const inputText = (body?.inputText ?? '').toString().slice(0, 500);
  const tone = (body?.tone ?? 'standup') as ToneId;
  const validTone = (tone in TONE_LABELS ? tone : 'standup') as ToneId;

  const punchline = generatePunchline(inputText, validTone);
  return NextResponse.json({
    punchline,
    toneId: validTone,
    tone: TONE_LABELS[validTone]
  });
}
