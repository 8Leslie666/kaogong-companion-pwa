import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseQuestionPack } from '../../domain/schemas'
import { examQuestionPacks } from './examPacks'

describe('generated national and provincial exam packs', () => {
  it('ships two complete, schema-valid 2025 paper pilots', () => {
    expect(examQuestionPacks).toHaveLength(2)
    expect(examQuestionPacks.map((pack) => pack.questions.length)).toEqual([135, 125])
    expect(examQuestionPacks.reduce((sum, pack) => sum + parseQuestionPack(pack).questions.length, 0)).toBe(260)
  })

  it('keeps stable ids, answers, provenance and local question images', () => {
    const questions = examQuestionPacks.flatMap((pack) => pack.questions)
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
    expect(new Set(questions.map((question) => question.contentHash)).size).toBe(questions.length)
    expect(questions.every((question) => question.year === 2025 && question.region && question.variant && question.sourceUrl.startsWith('https://'))).toBe(true)

    const markdown = questions.flatMap((question) => [question.stem, ...Object.values(question.options)])
    const assets = markdown.flatMap((text) => [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]!))
    expect(assets.length).toBeGreaterThan(80)
    expect(assets.every((asset) => existsSync(resolve(process.cwd(), 'public', asset)))).toBe(true)
  })
})
