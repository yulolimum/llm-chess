export const providerOptions = [
  { label: 'Claude', value: 'claude' },
  { label: 'Codex', value: 'codex' },
] as const

export const effortLevels = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const

export type Provider = (typeof providerOptions)[number]['value']
export type ProviderOption = (typeof providerOptions)[number]
export type EffortLevel = (typeof effortLevels)[number]
export type EffortOption = {
  label: string
  value: EffortLevel
}
export type ModelOption = {
  defaultEffort?: EffortLevel
  efforts?: readonly EffortLevel[]
  label: string
  value: string
}
export type PlayerConfig = {
  effort: EffortLevel | undefined
  model: string
  provider: Provider
  strategy: string | undefined
}

export const modelOptionsByProvider = {
  claude: [
    {
      defaultEffort: 'high',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      label: 'Claude Fable 5',
      value: 'claude-fable-5',
    },
    {
      defaultEffort: 'high',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      label: 'Claude Opus 4.8',
      value: 'claude-opus-4-8',
    },
    {
      defaultEffort: 'xhigh',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      label: 'Claude Opus 4.7',
      value: 'claude-opus-4-7',
    },
    {
      defaultEffort: 'high',
      efforts: ['low', 'medium', 'high', 'max'],
      label: 'Claude Opus 4.6',
      value: 'claude-opus-4-6',
    },
    {
      defaultEffort: 'high',
      efforts: ['low', 'medium', 'high'],
      label: 'Claude Opus 4.5',
      value: 'claude-opus-4-5',
    },
    {
      defaultEffort: 'high',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      label: 'Claude Sonnet 5',
      value: 'claude-sonnet-5',
    },
    {
      defaultEffort: 'high',
      efforts: ['low', 'medium', 'high', 'max'],
      label: 'Claude Sonnet 4.6',
      value: 'claude-sonnet-4-6',
    },
    { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
  ],
  codex: [
    {
      defaultEffort: 'low',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
      label: 'GPT-5.6-Sol',
      value: 'gpt-5.6-sol',
    },
    {
      defaultEffort: 'medium',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
      label: 'GPT-5.6-Terra',
      value: 'gpt-5.6-terra',
    },
    {
      defaultEffort: 'medium',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      label: 'GPT-5.6-Luna',
      value: 'gpt-5.6-luna',
    },
    {
      defaultEffort: 'medium',
      efforts: ['low', 'medium', 'high', 'xhigh'],
      label: 'GPT-5.5',
      value: 'gpt-5.5',
    },
    {
      defaultEffort: 'medium',
      efforts: ['low', 'medium', 'high', 'xhigh'],
      label: 'GPT-5.4',
      value: 'gpt-5.4',
    },
    {
      defaultEffort: 'medium',
      efforts: ['low', 'medium', 'high', 'xhigh'],
      label: 'GPT-5.4-Mini',
      value: 'gpt-5.4-mini',
    },
    {
      defaultEffort: 'high',
      efforts: ['low', 'medium', 'high', 'xhigh'],
      label: 'GPT-5.3-Codex-Spark',
      value: 'gpt-5.3-codex-spark',
    },
  ],
} as const satisfies Record<Provider, readonly ModelOption[]>

export const providerCommandByProvider: Record<Provider, string> = {
  claude: 'claude',
  codex: 'codex',
}

const effortLabels: Record<EffortLevel, string> = {
  high: 'High',
  low: 'Low',
  max: 'Max',
  medium: 'Medium',
  ultra: 'Ultra',
  xhigh: 'Extra High',
}

export function getProviderLabel(provider: string): string {
  return providerOptions.find(option => option.value === provider)?.label ?? provider
}

export function getModelLabel(provider: string, model: string): string {
  return getModelOption(provider, model)?.label ?? model
}

export function getEffortLabel(effort: string): string {
  return isEffortLevel(effort) ? effortLabels[effort] : effort
}

export function getEffortOptions(provider: Provider, model: string): EffortOption[] {
  const option = getModelOption(provider, model)

  return (option?.efforts ?? []).map(effort => ({
    label: effortLabels[effort],
    value: effort,
  }))
}

export function getModelOption(provider: string, model: string): ModelOption | undefined {
  if (!isProvider(provider)) {
    return undefined
  }

  const options: readonly ModelOption[] = modelOptionsByProvider[provider]

  return options.find(option => option.value === model)
}

export function isProvider(value: string): value is Provider {
  return providerOptions.some(provider => provider.value === value)
}

export function isEffortLevel(value: string): value is EffortLevel {
  return Object.hasOwn(effortLabels, value)
}
