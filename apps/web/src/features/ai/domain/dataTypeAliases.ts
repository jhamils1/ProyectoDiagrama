import { dataTypes } from '../../modeling/domain/model'

export const typeAliases: Record<string, string[]> = Object.fromEntries(
  dataTypes.map((type) => [type, [type.toLowerCase()]]),
)
typeAliases.String.push('texto', 'cadena')
typeAliases.Integer.push('int', 'entero')
typeAliases.Boolean.push('bool', 'booleano')

export function canonicalDataType(value: string): string {
  if (!value) return ''
  const type = Object.entries(typeAliases).find(([, aliases]) => aliases.includes(value.toLowerCase()))?.[0]
  if (!type) throw new Error(`Tipo no admitido: ${value}. Tipos disponibles: ${dataTypes.join(', ')}.`)
  return type
}
