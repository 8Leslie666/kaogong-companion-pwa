import { describe, expect, it } from 'vitest'
import { utils, write } from 'xlsx'
import { importJsonPack, importXlsxPack } from './importPack'
import { importJsonEssayPack } from './importPack'
import { essayPapers } from '../data/essayPapers'

describe('question pack import', () => {
  it('maps a Chinese-header spreadsheet into the public question format', async () => {
    const sheet = utils.json_to_sheet([{ 模块: '常识判断', 子类: '科技', 题干: '水在标准大气压下的沸点是？', 选项A: '0℃', 选项B: '50℃', 选项C: '100℃', 选项D: '150℃', 答案: 'C', 解析: '标准大气压下水的沸点是100℃。', 难度: 1 }])
    const book = utils.book_new(); utils.book_append_sheet(book, sheet, '题目')
    const array = write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const pack = await importXlsxPack(array, '科技题.xlsx')
    expect(pack.questions[0].answer).toBe('C')
    expect(pack.questions[0].module).toBe('常识判断')
  })

  it('rejects malformed JSON packs at the import boundary', async () => {
    await expect(importJsonPack(JSON.stringify({ questions: [] }))).rejects.toThrow()
  })

  it('imports mindskip XZS single-choice exports through the upstream adapter', async () => {
    const xzs = {
      response: {
        list: [{
          id: 101,
          questionType: 1,
          subjectId: 1,
          title: '<p>这段文字意在说明什么？</p>',
          items: [
            { prefix: 'A', content: '选项一' }, { prefix: 'B', content: '选项二' },
            { prefix: 'C', content: '选项三' }, { prefix: 'D', content: '选项四' },
          ],
          analyze: '<p>结合文段主旨，答案为 B。</p>',
          correct: 'B',
          difficult: 2,
        }],
      },
    }
    const pack = await importJsonPack(JSON.stringify(xzs), '国考导出.json')
    expect(pack.manifest.sourceUrl).toBe('https://github.com/mindskip/xzs-mysql')
    expect(pack.questions).toHaveLength(1)
    expect(pack.questions[0]).toMatchObject({ answer: 'B', difficulty: 2, module: '言语理解' })
    expect(pack.questions[0].stem).toBe('这段文字意在说明什么？')
  })

  it('accepts a custom essay JSON pack and rejects mojibake', async () => {
    const manifest = { schemaVersion: 1, packId: 'user-essay', version: '1.0.0', title: '自定义申论', license: '用户自有内容', sourceUrl: 'https://example.com/essay', checksum: 'local-test' }
    const pack = await importJsonEssayPack(JSON.stringify({ manifest, essayPapers: [{ ...essayPapers[0], id: 'user-essay-1', packId: 'user-essay' }] }))
    expect(pack.essayPapers).toHaveLength(1)

    const broken = { manifest: { ...manifest, packId: 'broken' }, essayPapers: [{ ...essayPapers[0], id: 'broken-1', packId: 'broken', title: '锟斤拷资料' }] }
    await expect(importJsonEssayPack(JSON.stringify(broken))).rejects.toThrow(/乱码/)
  })
})
