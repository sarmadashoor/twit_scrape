// Top tier accounts
const topTierAccounts = [
  { handle: '@gregisenberg', tier: 'top', category: 'startup ideas, viral growth thinking' },
  { handle: '@heybarsee', tier: 'top', category: 'AI tools, micro-SaaS ideas, prompt packs' },
  { handle: '@jspeiser', tier: 'top', category: 'AI business models, product walkthroughs' },
  { handle: '@bentossell', tier: 'top', category: 'Founder of Makerpad, shares AI stacks & ideas' },
  { handle: '@levelsio', tier: 'top', category: 'Indie AI builds, experiments, automation use cases' },
  { handle: '@thesamparr', tier: 'top', category: 'co-host of My First Million, posts idea threads' },
  { handle: '@thisiskp_', tier: 'top', category: 'build-in-public + AI tool application insights' },
  { handle: '@danshipper', tier: 'top', category: 'AI and productivity stack synthesis' },
  { handle: '@tibo_maker', tier: 'top', category: 'indie maker building with AI agents' },
  { handle: '@swyx', tier: 'top', category: 'deep AI/LLM infrastructure, founder-focused insights' }
];

// Mid tier accounts
const midTierAccounts = [
  { handle: '@eladgil', tier: 'mid', category: 'investor/angel with AI trend predictions' },
  { handle: '@pranavkhaitan', tier: 'mid', category: 'ex-Google AI, startup builder' },
  { handle: '@packym', tier: 'mid', category: 'business models + deep dives with AI integration' },
  { handle: '@matthgray', tier: 'mid', category: 'posts actionable solopreneur/AI tips' },
  { handle: '@simonhoiberg', tier: 'mid', category: 'SaaS-focused AI implementations' },
  { handle: '@shivsahni', tier: 'mid', category: 'B2B founder + frequent AI concept sharing' },
  { handle: '@zaeemk', tier: 'mid', category: 'prompt engineer + agent-builder' },
  { handle: '@joshua_luna', tier: 'mid', category: 'growth + AI automation frameworks' },
  { handle: '@philmohun', tier: 'mid', category: 'idea threads, tech stack breakdowns' },
  { handle: '@alexgarcia_atx', tier: 'mid', category: 'viral growth meets AI tools' }  // Updated handle
];

module.exports = {
  accounts: [...topTierAccounts, ...midTierAccounts],
  getByTier: (tier) => tier === 'top' ? topTierAccounts : midTierAccounts,
  getAll: () => [...topTierAccounts, ...midTierAccounts],
  getCount: () => topTierAccounts.length + midTierAccounts.length
};