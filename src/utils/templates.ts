import { readFile } from 'node:fs/promises'

export type TemplateValues = Record<string, string | number>

export async function renderTemplateFile(path: string | URL, values: TemplateValues): Promise<string> {
  const template = await readFile(path, 'utf8')

  return renderTemplate(template, values)
}

export function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key]

    if (value === undefined) {
      throw new Error(`Missing template value: ${key}`)
    }

    return String(value)
  })
}
