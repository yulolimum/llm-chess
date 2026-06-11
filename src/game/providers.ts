export const providerOptions = [
  { label: 'Claude', value: 'claude' },
  { label: 'Codex', value: 'codex' },
] as const

export const modelOptionsByProvider = {
  claude: [
    { label: 'Claude Fable 5', value: 'claude-fable-5' },
    { label: 'Claude Opus 4.8', value: 'claude-opus-4-8' },
    { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
    { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
    { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
  ],
  codex: [
    { label: 'GPT-5.5', value: 'gpt-5.5' },
    { label: 'GPT-5.4', value: 'gpt-5.4' },
    { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini' },
    { label: 'GPT-5.3 Codex Spark', value: 'gpt-5.3-codex-spark' },
  ],
} as const

export const providerCommandByProvider: Record<Provider, string> = {
  claude: 'claude',
  codex: 'codex',
}

export type Provider = (typeof providerOptions)[number]['value']
export type ProviderOption = (typeof providerOptions)[number]
export type ModelOption = {
  label: string
  value: string
}
export type PlayerConfig = {
  model: string
  provider: Provider
  strategy: string | undefined
}

export function getProviderLabel(provider: string): string {
  return providerOptions.find(option => option.value === provider)?.label ?? provider
}

export function getModelLabel(provider: string, model: string): string {
  if (!isProvider(provider)) {
    return model
  }

  const options: readonly ModelOption[] = modelOptionsByProvider[provider]

  return options.find(option => option.value === model)?.label ?? model
}

export function isProvider(value: string): value is Provider {
  return providerOptions.some(provider => provider.value === value)
}
