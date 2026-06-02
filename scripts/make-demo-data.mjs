// 生成用于截图的演示数据 —— SpaceMind 自家 JSON 备份格式,在管理页用 "Import JSON" 导入。
// 运行: node scripts/make-demo-data.mjs  → 输出 spacemind-demo-data.json
import { writeFileSync } from 'node:fs'

const BASE = new Date('2026-06-02T11:00:00').getTime()
const HOUR = 3600_000
const DAY = 24 * HOUR
const ago = (d, h = 0) => BASE - d * DAY - h * HOUR

let cid = 0
let mid = 0
const conversations = []
const messages = []

const URL_BUILDERS = {
  chatgpt: (id) => `https://chatgpt.com/c/${id}`,
  claude: (id) => `https://claude.ai/chat/${id}`,
  gemini: (id) => `https://gemini.google.com/app/${id}`,
  deepseek: (id) => `https://chat.deepseek.com/a/chat/s/${id}`,
  mistral: (id) => `https://chat.mistral.ai/chat/${id}`,
}

// 给每条对话造一个像样的 id(贴近各平台真实形态)
function rid(platform, n) {
  if (platform === 'claude' || platform === 'mistral') {
    // 伪 uuid
    const h = (s) => s.toString(16).padStart(2, '0')
    const seed = (n * 2654435761) >>> 0
    const b = [...Array(16)].map((_, i) => h((seed >> (i % 4) * 8 ^ (i * 73)) & 0xff))
    return `${b.slice(0, 4).join('')}-${b.slice(4, 6).join('')}-${b.slice(6, 8).join('')}-${b.slice(8, 10).join('')}-${b.slice(10, 16).join('')}`
  }
  return `${platform.slice(0, 3)}${(n * 99991).toString(36)}${n}xq`
}

function conv({ platform, title, space, tags = [], starred = false, note, daysAgo, hoursAgo = 0, msgs = [] }) {
  cid += 1
  const id = rid(platform, cid)
  const captured = ago(daysAgo, hoursAgo)
  const firstUser = msgs.find((m) => m.role === 'user')?.content
  const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')?.content
  conversations.push({
    id,
    platform,
    url: URL_BUILDERS[platform](id),
    title,
    ...(space ? { spaceId: space } : {}),
    tags,
    starred,
    ...(note ? { note } : {}),
    capturedAt: captured,
    platformUpdatedAt: captured,
    messageCount: msgs.length,
    preview: {
      ...(firstUser ? { firstUserMessage: firstUser } : {}),
      ...(lastAssistant ? { lastAssistantMessage: lastAssistant } : {}),
    },
  })
  msgs.forEach((m, i) => {
    mid += 1
    messages.push({
      id: `m${mid}`,
      conversationId: id,
      role: m.role,
      content: m.content,
      timestamp: captured + i * 60_000,
    })
  })
  return id
}

// ---- Spaces ----
const spaces = [
  { id: 'sp-thesis', name: 'Thesis · Diffusion Models', color: 'violet', emoji: '🎓', note: 'Lit review + experiments for the dissertation', pinned: true, sortIndex: 0, createdAt: ago(40), updatedAt: ago(1) },
  { id: 'sp-dev', name: 'SpaceMind Dev', color: 'indigo', emoji: '🚀', note: 'Building the extension itself', pinned: true, sortIndex: 1, createdAt: ago(35), updatedAt: ago(0, 3) },
  { id: 'sp-job', name: 'Job Search 2026', color: 'emerald', emoji: '💼', sortIndex: 2, createdAt: ago(28), updatedAt: ago(2) },
  { id: 'sp-cook', name: 'Recipes & Meal Prep', color: 'amber', emoji: '🍳', sortIndex: 3, createdAt: ago(20), updatedAt: ago(3) },
  { id: 'sp-lang', name: '日语学习', color: 'cyan', emoji: '🌏', note: 'N2 备考', sortIndex: 4, createdAt: ago(18), updatedAt: ago(4) },
  { id: 'sp-write', name: 'Blog & Writing', color: 'pink', emoji: '✍️', sortIndex: 5, createdAt: ago(15), updatedAt: ago(5) },
]

// ---- Thesis ----
conv({ platform: 'chatgpt', space: 'sp-thesis', starred: true, tags: ['reading', 'core'], daysAgo: 1,
  title: 'Explain classifier-free guidance intuitively',
  note: 'Great explanation — cite in chapter 2',
  msgs: [
    { role: 'user', content: 'Can you explain classifier-free guidance in diffusion models intuitively, without heavy math?' },
    { role: 'assistant', content: 'Think of it as steering. The model makes two predictions — one conditioned on your prompt, one unconditioned — and you push further in the direction of the conditioned one. The guidance scale controls how hard you push.' },
  ] })
conv({ platform: 'claude', space: 'sp-thesis', tags: ['reading'], daysAgo: 3,
  title: 'Summarize the DDPM vs DDIM sampling tradeoffs',
  msgs: [
    { role: 'user', content: 'Compare DDPM and DDIM sampling for my related-work section.' },
    { role: 'assistant', content: 'DDPM is stochastic and needs many steps for quality; DDIM is deterministic and lets you trade steps for speed with little quality loss, which is why most fast samplers build on it.' },
  ] })
conv({ platform: 'gemini', space: 'sp-thesis', tags: ['experiment'], daysAgo: 6,
  title: 'Debug NaN loss when training at fp16',
  msgs: [
    { role: 'user', content: 'My diffusion training loss goes to NaN after ~2k steps in fp16. Ideas?' },
    { role: 'assistant', content: 'Classic fp16 overflow. Try gradient clipping, a loss scaler (or bf16 instead), and check that your noise schedule isn’t producing near-zero variances that blow up the SNR weighting.' },
  ] })
conv({ platform: 'deepseek', space: 'sp-thesis', tags: ['math'], daysAgo: 9,
  title: 'Derive the ELBO for the reverse process',
  msgs: [
    { role: 'user', content: 'Walk me through deriving the variational lower bound for the diffusion reverse process.' },
    { role: 'assistant', content: 'Start from log p(x0) ≥ E_q[ log p(x_{0:T}) − log q(x_{1:T}|x0) ], then split the joint into the per-step KL terms. Each term matches a Gaussian posterior, which is where the closed-form targets come from.' },
  ] })

// ---- SpaceMind Dev ----
conv({ platform: 'claude', space: 'sp-dev', starred: true, tags: ['bug', 'fixed'], daysAgo: 0, hoursAgo: 3,
  title: 'Sidebar MutationObserver fires too often',
  note: 'Solution: 800ms debounce — shipped',
  msgs: [
    { role: 'user', content: 'My content script’s MutationObserver on the chat sidebar fires dozens of times per second while scrolling. How do I tame it?' },
    { role: 'assistant', content: 'Debounce the handler. Collect mutations, then run your scrape once after ~800ms of quiet. Also scope the observer to the sidebar subtree, not document.body, so unrelated DOM churn doesn’t trigger it.' },
  ] })
conv({ platform: 'chatgpt', space: 'sp-dev', tags: ['architecture'], daysAgo: 0, hoursAgo: 6,
  title: 'Best way to avoid IndexedDB write races in MV3',
  msgs: [
    { role: 'user', content: 'Multiple content scripts + a manager page all want to write IndexedDB. How do I avoid races in Manifest V3?' },
    { role: 'assistant', content: 'Make the background service worker the single writer. Everyone else sends typed messages; the worker validates and performs every write. One code path, one place for schema checks, no cross-context races.' },
  ] })
conv({ platform: 'mistral', space: 'sp-dev', tags: ['css'], daysAgo: 2,
  title: 'Shadow DOM overlay leaks host page styles',
  msgs: [
    { role: 'user', content: 'My injected overlay picks up the host site’s Tailwind variables. How do I isolate it?' },
    { role: 'assistant', content: 'Mount inside a shadow root and set `all: initial` on the host element, then ship your own inline styles rather than relying on inherited CSS custom properties.' },
  ] })
conv({ platform: 'gemini', space: 'sp-dev', tags: ['release'], daysAgo: 4,
  title: 'Chrome Web Store review checklist for MV3',
  msgs: [
    { role: 'user', content: 'What trips up first-time Chrome Web Store submissions?' },
    { role: 'assistant', content: 'Mismatched privacy policy vs requested permissions, missing icon sizes, vague single-purpose description, and broad host permissions without per-host justification. Tighten all four before submitting.' },
  ] })

// ---- Job Search ----
conv({ platform: 'chatgpt', space: 'sp-job', starred: true, tags: ['resume'], daysAgo: 2,
  title: 'Tighten my resume bullet points',
  msgs: [
    { role: 'user', content: 'Rewrite this bullet to be more impact-driven: "Worked on the search feature."' },
    { role: 'assistant', content: '"Built full-text search across 50k records with sub-100ms p95 latency, lifting feature engagement 22%." Lead with the verb, quantify the scope, end with the outcome.' },
  ] })
conv({ platform: 'claude', space: 'sp-job', tags: ['interview', 'system-design'], daysAgo: 5,
  title: 'Mock system design: design a URL shortener',
  msgs: [
    { role: 'user', content: 'Give me a mock interview prompt for a URL shortener and grade my answer.' },
    { role: 'assistant', content: 'Design a service that maps long URLs to short codes at 10k writes/s. Discuss key generation, the read-heavy access pattern, caching, and how you’d guarantee uniqueness without a single bottleneck.' },
  ] })
conv({ platform: 'deepseek', space: 'sp-job', tags: ['interview'], daysAgo: 8,
  title: 'Common behavioral questions + STAR answers',
  msgs: [
    { role: 'user', content: 'Help me prep STAR answers for "tell me about a conflict on your team".' },
    { role: 'assistant', content: 'Situation: brief context. Task: your responsibility. Action: what *you* specifically did to de-escalate. Result: the measurable outcome and what you’d keep doing. Keep it to 90 seconds.' },
  ] })

// ---- Cooking ----
conv({ platform: 'gemini', space: 'sp-cook', tags: ['quick'], daysAgo: 3,
  title: '20-minute weeknight dinners with chickpeas',
  msgs: [
    { role: 'user', content: 'Five 20-minute dinners built around canned chickpeas?' },
    { role: 'assistant', content: 'Crispy chickpea tacos, lemon-garlic chickpea pasta, curried chickpea bowls, chickpea shakshuka, and a warm chickpea-feta salad. All one-pan, all under 20 minutes.' },
  ] })
conv({ platform: 'mistral', space: 'sp-cook', starred: true, tags: ['baking'], daysAgo: 7,
  title: 'Why did my sourdough come out flat?',
  msgs: [
    { role: 'user', content: 'My sourdough loaf spread flat instead of rising. What went wrong?' },
    { role: 'assistant', content: 'Usually over-proofing or a weak starter. Do the poke test before baking, build more tension when shaping, and make sure your starter doubles reliably within 4–6 hours before you mix.' },
  ] })
conv({ platform: 'chatgpt', space: 'sp-cook', tags: ['meal-prep'], daysAgo: 11,
  title: 'High-protein meal prep on a $60/week budget',
  msgs: [
    { role: 'user', content: 'Plan a high-protein week of meal prep for about $60.' },
    { role: 'assistant', content: 'Anchor on eggs, chicken thighs, lentils, oats, and frozen veg. Batch-cook a grain, two proteins, and a sauce on Sunday; mix-and-match into 10 containers across the week.' },
  ] })

// ---- 日语学习 (CJK 演示) ----
conv({ platform: 'claude', space: 'sp-lang', starred: true, tags: ['语法', 'N2'], daysAgo: 4,
  title: '「ように」和「ために」有什么区别？',
  note: '终于搞懂了目的 vs 状态',
  msgs: [
    { role: 'user', content: '日语里「ように」和「ために」都表示目的,具体怎么区分?' },
    { role: 'assistant', content: '「ために」用于意志可控、主语一致的目的(为了…而做);「ように」用于非意志或主语不同的目标状态(为了能…),常接可能形或自动词。' },
  ] })
conv({ platform: 'deepseek', space: 'sp-lang', tags: ['单词'], daysAgo: 10,
  title: 'N2 高频副词整理与例句',
  msgs: [
    { role: 'user', content: '帮我整理 20 个 N2 高频副词,每个配一个例句。' },
    { role: 'assistant', content: '好的,例如:さすが(果然)、いきなり(突然)、たまたま(碰巧)、わざわざ(特意)、相変わらず(一如既往)……每个都给你配了日常例句,方便记忆。' },
  ] })
conv({ platform: 'gemini', space: 'sp-lang', tags: ['听力'], daysAgo: 13,
  title: '推荐适合 N2 的播客和听力材料',
  msgs: [
    { role: 'user', content: '有没有适合 N2 水平的日语播客推荐?' },
    { role: 'assistant', content: '可以试试「日本語の森」「Nihongo con Teppei」和 NHK 的やさしいニュース,语速适中、话题日常,适合精听加泛听结合。' },
  ] })

// ---- Writing ----
conv({ platform: 'mistral', space: 'sp-write', tags: ['draft'], daysAgo: 5,
  title: 'Outline a blog post on local-first software',
  msgs: [
    { role: 'user', content: 'Help me outline a blog post arguing for local-first software.' },
    { role: 'assistant', content: 'Open with the cloud-dependency pain, define local-first’s seven ideals, contrast ownership vs convenience, give two concrete examples, then close on the privacy and longevity payoff.' },
  ] })
conv({ platform: 'chatgpt', space: 'sp-write', starred: true, tags: ['draft', 'editing'], daysAgo: 12,
  title: 'Make this paragraph less stiff and more human',
  msgs: [
    { role: 'user', content: 'This intro reads like a press release. Loosen it up without losing the meaning.' },
    { role: 'assistant', content: 'Cut the buzzwords, swap passive voice for active, and open with a concrete moment instead of an abstraction. Same point, but it now sounds like a person wrote it.' },
  ] })

// ---- Unsorted (无 spaceId,演示 Unsorted 收件箱) ----
conv({ platform: 'gemini', daysAgo: 0, hoursAgo: 1, tags: [],
  title: 'Quick: convert 180°F to Celsius',
  msgs: [
    { role: 'user', content: 'What’s 180°F in Celsius?' },
    { role: 'assistant', content: '180°F is about 82.2°C.' },
  ] })
conv({ platform: 'deepseek', daysAgo: 0, hoursAgo: 5, tags: [],
  title: 'Regex to match a hex color code',
  msgs: [
    { role: 'user', content: 'Give me a regex that matches #RGB and #RRGGBB hex colors.' },
    { role: 'assistant', content: '/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/ — covers both the 3- and 6-digit forms.' },
  ] })
conv({ platform: 'mistral', daysAgo: 1, tags: [],
  title: 'Polite way to decline a meeting invite',
  msgs: [
    { role: 'user', content: 'How do I politely decline a meeting that isn’t relevant to me?' },
    { role: 'assistant', content: '"Thanks for including me — I don’t think I’d add much here, so I’ll step back, but please loop me in on the notes." Warm, brief, and protects your time.' },
  ] })
conv({ platform: 'chatgpt', daysAgo: 2, tags: [],
  title: 'Difference between git rebase and merge',
  msgs: [
    { role: 'user', content: 'When should I rebase vs merge?' },
    { role: 'assistant', content: 'Rebase to keep a linear history on your own feature branch before sharing; merge to integrate shared branches without rewriting history others depend on.' },
  ] })

const payload = {
  format: 'spacemind-export',
  formatVersion: 1,
  app: 'SpaceMind',
  exportedAt: BASE,
  spaces,
  conversations,
  messages,
}

writeFileSync('spacemind-demo-data.json', JSON.stringify(payload, null, 2))
console.log(`✓ spacemind-demo-data.json — ${spaces.length} spaces, ${conversations.length} conversations, ${messages.length} messages`)
