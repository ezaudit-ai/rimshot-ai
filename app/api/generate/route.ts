import { NextResponse } from 'next/server';


type ToneId = 'dad' | 'dry' | 'savage' | 'safe' | 'absurd' | 'standup';
type Mode = 'generate' | 'funnier';


const TONE_LABELS: Record<ToneId, string> = {
  dad: 'Dad Joke',
  dry: 'Dry Wit',
  savage: 'Savage',
  safe: 'Corporate Safe',
  absurd: 'Absurd',
  standup: 'Stand-up Style',
};


const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';


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


/**
 * Deterministic fallback so the app still works without an API key.
 */
function generateDeterministicPunchline(input: string, tone: ToneId) {
  const subject = subjectFromInput(input);
  const seed = hashString(`${input}::${tone}`);

  const jokes: Record<ToneId, string[]> = {
    dad: [
      `${subject} Next thing you know, you'll explain the joke and make it worse.`,
      `${subject} Honestly? That's the punchline now.`,
      `${subject} That's not a plan, that's a tradition.`,
      `${subject} If wisdom were coffee, that would be decaf and lukewarm.`,
    ],
    dry: [
      `${subject} Remarkable. In the sense that it exists.`,
      `${subject} Bold strategy. Let's see if it feels awkward in person.`,
      `${subject} That's… a choice.`,
      `${subject} Congrats on making silence uncomfortable.`,
    ],
    savage: [
      `${subject} You really woke up and chose career-limiting move.`,
      `${subject} That's not a red flag. That's a parade.`,
      `${subject} If there were consequences, they'd be drafting you right now.`,
      `${subject} The twist nobody asked for and HR won't approve.`,
    ],
    safe: [
      `${subject} Great—I'll put it on the list of things we pretend are under control.`,
      `${subject} Perfect. Let's schedule a follow-up to agree on why this happened.`,
      `${subject} Love the ambition. Concerned by literally everything else.`,
      `${subject} Let's align on how we're never doing that again.`,
    ],
    absurd: [
      `${subject} — and that's when a raccoon in a blazer politely asked for a receipt.`,
      `${subject} Somewhere, a clown quit out of respect.`,
      `${subject} The universe sent an email asking for an extension.`,
      `${subject} Honestly? That's exactly what the toaster predicted.`,
    ],
    standup: [
      `${subject} I'm not saying you're the problem… but the plot is suspicious.`,
      `${subject} That's the kind of thing that makes a therapist adjust their glasses.`,
      `${subject} You know it's bad when even the silence feels embarrassed.`,
      `${subject} This is why humans can't have nice things.`,
    ],
  };

  const short = clampString(input);
  if (!short) {
    return "Type a setup first—I'll handle the punchline.";
  }

  if (short.length < 8) {
    return "Give me a little more to work with—this doesn't need to be a novel, just a setup.";
  }

  return pick(jokes[tone], seed);
}


/**
 * Minimal OpenAI client using fetch (no SDK dependency required).
 */
async function openAIChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  temperature: number
) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature,
      max_tokens: 256,
      n: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI response error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as any;
  const content = data?.choices?.[0]?.message?.content?.trim();
  return content || '';
}


/**
 * Multi-step pipeline:
 * - interpret angle (0.7)
 * - generate candidates (0.9)
 * - rank (0.25)
 */
async function generatePromptedPunchline(
  input: string,
  toneId: ToneId,
  toneLabel: string,
  mode: Mode,
  currentPunchline?: string
) {
  const SYS = `You are a world-class short-form comedy punch-up writer.

Your job is to turn a user's setup, awkward message, boring announcement, or corporate phrase into a short, funny, screenshotable punchline.

You are not writing full jokes, monologues, or explanations.
You are writing a single punchline or one-liner that feels sharp, modern, and human.

Primary objectives:
- Be funny fast
- Be concise
- Be specific
- Be shareable
- Sound like something a witty person would post online

Hard rules:
- Keep the final punchline under 18 words unless explicitly told otherwise
- Prefer 6 to 14 words
- Return punchlines, not explanations
- Do not explain why the joke is funny
- Do not add setup unless needed for rhythm
- Avoid generic filler humor
- Avoid cheesy dad-joke structure unless the selected tone is Dad Joke
- Avoid sounding like a greeting card, HR memo, or AI assistant
- Avoid hashtags, emojis, quotation marks, bullet points, or labels in the final answer
- Avoid repetition of the user's exact wording unless using it makes the joke land better
- Prefer surprise, contrast, exaggeration, irony, or uncomfortable truth
- The output should feel screenshotable and instantly understandable`;

  const DEV = `You are generating punchlines for rimshot.ai.

Product context:
- The site is built for short, punchy, funny outputs that pair with a rimshot sound
- The output will often be screenshotted and shared
- Users should feel like the tool “got it” instantly
- The joke must land on first read

Generation priorities in order:
1. Funny
2. Short
3. Specific
4. Shareable
5. On-tone

Never produce:
- Explanations
- Disclaimers
- Moralizing
- Multi-paragraph responses
- Numbered lists
- Setup + long payoff structures
- Safe corporate fluff
- Generic observational comedy with no twist`;

  const toneDefs = `
Tone definitions:
Dad Joke: playful, light, a little corny on purpose, more clever than savage, family-safe.
Dry Wit: subtle, restrained, smart, lightly sarcastic, sounds effortless.
Savage: aggressive, ruthless, bold, concise, should sting, but still be funny.
Corporate Safe: workplace-appropriate, LinkedIn-safe, clever, not offensive, lightly cynical about meetings, email, and business speak.
Absurd: surreal, unexpected, strange but readable, should still connect to the input.
Stand-up Style: conversational, relatable, slightly more human and spoken, still short, but can be a touch looser than other tones.`;

  const baseUserContext = `User input: ${input}
Selected tone: ${toneLabel}
${toneDefs}`;

  // Step A: interpret angle
  const angle = await openAIChat(
    [
      { role: 'system', content: SYS },
      { role: 'assistant', content: DEV },
      {
        role: 'user',
        content: `${baseUserContext}

Analyze the user's input for comedic potential.

Identify internally:
- literal meaning
- hidden meaning
- emotional truth
- funniest angle
- target type:
  - corporate nonsense
  - awkward relationship moment
  - self-own
  - social observation
  - petty frustration
  - absurd scenario
  - boring announcement dressed up as important
  - other

Then produce one internal creative brief in one sentence:
Angle: ...

Do not write the joke yet.`,
      },
    ],
    0.7
  );

  const angleLine =
    angle
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .find((x) => x.toLowerCase().startsWith('angle:')) || 'Angle: Make the truth hurt fast.';

  // Step B: generate candidates
  const candidatesRaw = await openAIChat(
    [
      { role: 'system', content: SYS },
      { role: 'assistant', content: DEV },
      {
        role: 'user',
        content: `${baseUserContext}

Creative brief: ${angleLine}

${mode === 'generate'
  ? `Write 6 candidate punchlines based on the creative brief and user input.`
  : `Take the current punchline and make it funnier while staying coherent and on-tone.

Current punchline: ${currentPunchline ?? ''}

Write 6 new candidate punchlines.`}

Rules:
- Each candidate must be under 18 words
- Each candidate must take a different comedic angle or wording approach
- Keep them punchy
- No explanations
- No labels inside the text
- Avoid repeating the exact user input unless it improves the joke
- At least:
  - 2 should be safer
  - 2 should be sharper
  - 2 should try a more surprising twist

Return as plain lines only, one per line.`,
      },
    ],
    0.9
  );

  const candidates = candidatesRaw
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .filter((x) => x.length < 60)
    .slice(0, 10);

  if (candidates.length === 0) throw new Error('No candidates generated');

  // Step C: rank candidates
  const best = await openAIChat(
    [
      { role: 'system', content: SYS },
      { role: 'assistant', content: DEV },
      {
        role: 'user',
        content: `${baseUserContext}

Candidates:
${candidates.map((c, idx) => `${idx + 1}. ${c}`).join('\n')}

Choose the single best candidate using these criteria:
- funniest on first read
- shortest without losing clarity
- most shareable
- strongest rhythm
- least generic
- best match for the selected tone

Reject any candidate that:
- feels predictable
- sounds AI-written
- is too wordy
- explains the joke
- is mean without being clever
- repeats the input with little transformation

Return only the winning punchline.`,
      },
    ],
    0.25
  );

  const punchline = (best || candidates[0]).trim();
  if (!punchline) throw new Error('Empty best punchline');
  return punchline;
}


export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const inputText = (body?.inputText ?? '').toString().slice(0, 500);
  const tone = (body?.tone ?? 'standup') as ToneId;
  const validTone = (tone in TONE_LABELS ? tone : 'standup') as ToneId;

  const mode = (body?.mode ?? 'generate') as Mode;
  const currentPunchline = (body?.currentPunchline ?? '').toString();

  if (containsDisallowed(inputText)) {
    return NextResponse.json({
      punchline: 'No rimshots for that. Try something harmless.',
      toneId: validTone,
      tone: TONE_LABELS[validTone],
    });
  }

  let punchline = '';

  try {
    punchline = await generatePromptedPunchline(
      inputText,
      validTone,
      TONE_LABELS[validTone],
      mode,
      currentPunchline
    );
  } catch (e) {
    console.error('OpenAI pipeline failed, falling back', e);
    punchline = generateDeterministicPunchline(inputText, validTone);
  }

  return NextResponse.json({
    punchline,
    toneId: validTone,
    tone: TONE_LABELS[validTone],
  });
}
