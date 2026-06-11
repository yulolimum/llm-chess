import { randomBytes } from 'node:crypto'

export function createSortableGuid(): string {
  const timestamp = new Date().toISOString().replaceAll(/[-:.]/g, '').replace('T', '-').replace('Z', '')
  const randomPart = randomBytes(8).toString('hex')

  return `${timestamp}-${randomPart}`
}
