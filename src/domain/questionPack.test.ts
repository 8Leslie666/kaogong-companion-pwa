import { describe, expect, it } from 'vitest'
import { parseQuestionPack } from './schemas'

const validPack = {
  manifest: {
    schemaVersion: 1,
    packId: 'demo-pack',
    version: '1.0.0',
    title: '演示题包',
    license: 'CC BY-NC-SA 4.0',
    sourceUrl: 'https://example.com',
    checksum: 'sha256:demo',
  },
  questions: [
    {
      id: 'demo-1',
      packId: 'demo-pack',
      module: '判断推理',
      submodule: '逻辑判断',
      stem: '若所有甲都是乙，所有乙都是丙，则哪项必然成立？',
      options: { A: '所有丙都是甲', B: '所有甲都是丙', C: '有些丙不是乙', D: '所有乙都是甲' },
      answer: 'B',
      explanation: '集合包含关系具有传递性。',
      difficulty: 2,
      source: '原创题',
      sourceUrl: 'https://example.com',
      license: 'CC BY-NC-SA 4.0',
      tags: ['传递关系'],
    },
  ],
}

describe('parseQuestionPack', () => {
  it('accepts a complete question pack and keeps stable identifiers', () => {
    const parsed = parseQuestionPack(validPack)
    expect(parsed.manifest.packId).toBe('demo-pack')
    expect(parsed.questions[0].answer).toBe('B')
  })

  it('rejects duplicate question identifiers', () => {
    expect(() => parseQuestionPack({
      ...validPack,
      questions: [validPack.questions[0], validPack.questions[0]],
    })).toThrow(/重复题目 ID/)
  })

  it('rejects an answer outside the available options', () => {
    expect(() => parseQuestionPack({
      ...validPack,
      questions: [{ ...validPack.questions[0], answer: 'E' }],
    })).toThrow()
  })
})

