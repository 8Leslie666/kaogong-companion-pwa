import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseQuestionPack } from '../../domain/schemas'
import { examQuestionPacks } from './examPacks'

describe('generated national and provincial exam packs', () => {
  it('ships complete, schema-valid national, Zhejiang and Guizhou packs', () => {
    expect(examQuestionPacks).toHaveLength(16)
    expect(examQuestionPacks.filter((pack) => pack.questions[0]?.region === '贵州')).toHaveLength(14)
    expect(examQuestionPacks.filter((pack) => pack.questions[0]?.region === '贵州').reduce((sum, pack) => sum + pack.questions.length, 0)).toBe(1630)
    expect(examQuestionPacks.reduce((sum, pack) => sum + parseQuestionPack(pack).questions.length, 0)).toBe(1890)
  })

  it('keeps stable ids, answers, provenance and local question images', () => {
    const questions = examQuestionPacks.flatMap((pack) => pack.questions)
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
    expect(questions.every((question) => Boolean(question.contentHash))).toBe(true)
    expect(questions.every((question) => question.year && question.year >= 2009 && question.region && question.variant && question.sourceUrl.startsWith('https://'))).toBe(true)

    const markdown = questions.flatMap((question) => [question.stem, ...Object.values(question.options)])
    const assets = markdown.flatMap((text) => [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]!))
    expect(assets.length).toBeGreaterThan(700)
    expect(assets.every((asset) => existsSync(resolve(process.cwd(), 'public', asset)))).toBe(true)
  })
})
