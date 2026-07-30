import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpenText, BrainCircuit, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, CircleUserRound,
  Clock3, CloudOff, Download, ExternalLink, FilePenLine, Flag, Heart, Home, LibraryBig, ListChecks, RotateCcw,
  ShieldCheck, Sparkles, Star, Target, TimerReset, Upload, Wifi, X,
} from 'lucide-react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import { db, ensureSeedData } from './db/database'
import { EXAM_MODULES, type AnswerKey, type Difficulty, type EssayPaper, type EssaySubmission, type ExamModule, type PracticeMode } from './domain/types'
import {
  completeExamSession, createPracticeSession, finishInstantSession, rateReview, Rating,
  recordAnswer, saveSessionProgress, toggleFavorite, type CreateSessionOptions, type QuestionStatusFilter,
} from './services/practice'
import { createBackupBundle, downloadBackup, parseBackupBundle, restoreBackupBundle } from './services/backup'
import { importJsonEssayPack, importJsonPack, importXlsxPack, saveEssayPack, saveQuestionPack } from './services/importPack'
import './App.css'

type Page = 'home' | 'practice' | 'essay' | 'wrong' | 'mine'
const answerKeys: AnswerKey[] = ['A', 'B', 'C', 'D']

type ExamCatalog = {
  stats: { total: number; national: number; provincial: number; byRegion: Record<string, number> }
  regions: string[]
  papers: Array<{ id: string; title: string; url: string; region: string; year?: number; variant: string; recallEdition: boolean }>
}

function formatDuration(seconds: number): string {
  const minute = Math.floor(seconds / 60)
  return `${String(minute).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function MarkdownContent({ text, className }: { text: string; className?: string }) {
  return <div className={clsx('question-markdown', className)}><ReactMarkdown components={{
    img: ({ alt, ...props }) => <img {...props} alt={alt || '题图'} loading="lazy" decoding="async" />,
  }}>{text}</ReactMarkdown></div>
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [activeSessionId, setActiveSessionId] = useState<string>()
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    ensureSeedData().then(() => setReady(true))
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    addEventListener('online', goOnline)
    addEventListener('offline', goOffline)
    return () => { removeEventListener('online', goOnline); removeEventListener('offline', goOffline) }
  }, [])

  const startSession = async (options: CreateSessionOptions) => {
    const session = await createPracticeSession(options)
    setActiveSessionId(session.id)
  }

  if (!ready) return <div className="boot"><div className="seal">公</div><p>正在装入本地题库…</p></div>

  if (activeSessionId) return <PracticeSessionView sessionId={activeSessionId} onExit={() => setActiveSessionId(undefined)} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">公</span><span><strong>考公陪跑宝典</strong><small>每天进步一点点</small></span></div>
        <span className={clsx('network', !online && 'offline')}>{online ? <Wifi size={14} /> : <CloudOff size={14} />}{online ? '本地已保存' : '离线可用'}</span>
      </header>
      <main className="page-content">
        {page === 'home' && <HomePage onGo={setPage} onResume={setActiveSessionId} onStart={startSession} />}
        {page === 'practice' && <PracticePage onStart={startSession} />}
        {page === 'essay' && <EssayPage />}
        {page === 'wrong' && <WrongPage onStart={startSession} />}
        {page === 'mine' && <MinePage />}
      </main>
      <BottomNav page={page} onChange={setPage} />
    </div>
  )
}

function BottomNav({ page, onChange }: { page: Page; onChange: (page: Page) => void }) {
  const items: Array<[Page, string, typeof Home]> = [
    ['home', '首页', Home], ['practice', '刷题', ListChecks], ['essay', '申论', FilePenLine], ['wrong', '错题', RotateCcw], ['mine', '我的', CircleUserRound],
  ]
  return <nav className="bottom-nav" aria-label="主导航">{items.map(([id, label, Icon]) => <button key={id} className={clsx(page === id && 'active')} onClick={() => onChange(id)} aria-current={page === id ? 'page' : undefined}><Icon size={21} strokeWidth={page === id ? 2.5 : 1.8} /><span>{label}</span></button>)}</nav>
}

function HomePage({ onGo, onResume, onStart }: { onGo: (page: Page) => void; onResume: (id: string) => void; onStart: (options: CreateSessionOptions) => Promise<void> }) {
  const attempts = useLiveQuery(() => db.attempts.toArray(), []) ?? []
  const sessions = useLiveQuery(() => db.practiceSessions.orderBy('updatedAt').reverse().limit(5).toArray(), []) ?? []
  const wrong = useLiveQuery(() => db.wrongQuestionStates.toArray(), []) ?? []
  const active = sessions.find((session) => session.status === 'active')
  const dueIds = wrong.filter((item) => item.isWrong && new Date(item.due) <= new Date()).map((item) => item.questionId)
  const correct = attempts.filter((attempt) => attempt.correct).length
  const accuracy = attempts.length ? Math.round(correct / attempts.length * 100) : 0

  return <>
    <section className="hero-card">
      <div className="eyebrow"><Sparkles size={15} /> 今日训练</div>
      <h1>{attempts.length ? '稳住节奏，继续向前' : '从第一题开始，建立你的节奏'}</h1>
      <p>{dueIds.length ? `今天有 ${dueIds.length} 道到期错题，先清空再开新题。` : '错题已清空，可以开始一组新的专项训练。'}</p>
      <div className="hero-actions">
        {active ? <button className="primary" onClick={() => onResume(active.id)}>继续上次 <ChevronRight size={18} /></button> : <button className="primary" onClick={() => onStart({ mode: 'instant', count: 10, module: '全部模块' })}>开始 10 题 <ChevronRight size={18} /></button>}
        <button className="soft" onClick={() => onGo('practice')}>专项组卷</button>
      </div>
      <div className="hero-streak"><span>{new Date().getDate()}</span><div><strong>今日打卡日</strong><small>所有记录只存于这台设备</small></div></div>
    </section>

    <section className="stats-grid" aria-label="学习统计">
      <article><Target size={18} /><strong>{attempts.length}</strong><span>累计刷题</span></article>
      <article><ChartNoAxesCombined size={18} /><strong>{accuracy}%</strong><span>正确率</span></article>
      <article><RotateCcw size={18} /><strong>{wrong.filter((item) => item.isWrong).length}</strong><span>当前错题</span></article>
      <article><Clock3 size={18} /><strong>{Math.round(sessions.reduce((sum, item) => sum + item.elapsedSeconds, 0) / 60)}</strong><span>训练分钟</span></article>
    </section>

    {dueIds.length > 0 && <section className="section-block"><div className="section-heading"><div><span>FSRS 智能复习</span><h2>今日错题复习</h2></div><button className="text-button" onClick={() => onGo('wrong')}>查看全部</button></div><button className="review-banner" onClick={() => onStart({ mode: 'review', questionIds: dueIds, title: '今日到期复习' })}><span className="round-icon"><BrainCircuit /></span><span><strong>{dueIds.length} 道题等待复习</strong><small>根据记忆情况自动安排下次时间</small></span><ChevronRight /></button></section>}

    <section className="section-block">
      <div className="section-heading"><div><span>训练轨迹</span><h2>最近练习</h2></div></div>
      <div className="activity-list">{sessions.length ? sessions.map((session) => {
        const done = session.submittedQuestionIds.length
        return <button key={session.id} onClick={() => session.status === 'active' && onResume(session.id)} disabled={session.status !== 'active'}><span className={clsx('activity-icon', session.mode)}>{session.mode === 'exam' ? <TimerReset /> : <BookOpenText />}</span><span><strong>{session.title}</strong><small>{new Date(session.updatedAt).toLocaleDateString('zh-CN')} · {done}/{session.questionIds.length} 题 · {formatDuration(session.elapsedSeconds)}</small></span><span className={clsx('status-pill', session.status)}>{session.status === 'active' ? '继续' : '完成'}</span></button>
      }) : <EmptyState icon={LibraryBig} title="还没有练习记录" text="完成一组题后，这里会显示你的训练轨迹。" />}</div>
    </section>
  </>
}

function PracticePage({ onStart }: { onStart: (options: CreateSessionOptions) => Promise<void> }) {
  const [module, setModule] = useState<ExamModule | '全部模块'>('全部模块')
  const [count, setCount] = useState(10)
  const [mode, setMode] = useState<PracticeMode>('instant')
  const [difficulty, setDifficulty] = useState<Difficulty | '全部难度'>('全部难度')
  const [packId, setPackId] = useState<string | '全部题源'>('全部题源')
  const [status, setStatus] = useState<QuestionStatusFilter>('全部题目')
  const [year, setYear] = useState<number | '全部年份'>('全部年份')
  const [region, setRegion] = useState<string | '全部地区'>('全部地区')
  const [variant, setVariant] = useState<string | '全部卷型'>('全部卷型')
  const [catalog, setCatalog] = useState<ExamCatalog>()
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogRegion, setCatalogRegion] = useState('全部地区')
  useEffect(() => { fetch('exam-paper-catalog.json').then((response) => response.ok ? response.json() : undefined).then(setCatalog).catch(() => undefined) }, [])
  const data = useLiveQuery(async () => {
    const [questions, packs, attempts, wrongStates] = await Promise.all([
      db.questions.toArray(), db.questionPacks.toArray(), db.attempts.toArray(), db.wrongQuestionStates.toArray(),
    ])
    return { questions, packs, attempts, wrongStates }
  }, []) ?? { questions: [], packs: [], attempts: [], wrongStates: [] }
  const { questions, packs, attempts, wrongStates } = data
  const attemptedIds = new Set(attempts.map((attempt) => attempt.questionId))
  const wrongById = new Map(wrongStates.map((item) => [item.questionId, item]))
  const counts = Object.fromEntries(EXAM_MODULES.map((item) => [item, questions.filter((question) => question.module === item).length]))
  const years = [...new Set(questions.flatMap((question) => question.year ? [question.year] : []))].sort((a, b) => b - a)
  const regions = [...new Set(questions.flatMap((question) => question.region ? [question.region] : []))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const variants = [...new Set(questions.flatMap((question) => question.variant ? [question.variant] : []))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const installedHistoricalPacks = packs.filter((pack) => pack.packId.startsWith('gkzhenti-')).length
  const filteredQuestions = questions
    .filter((question) => module === '全部模块' || question.module === module)
    .filter((question) => difficulty === '全部难度' || question.difficulty === difficulty)
    .filter((question) => packId === '全部题源' || question.packId === packId)
    .filter((question) => year === '全部年份' || question.year === year)
    .filter((question) => region === '全部地区' || question.region === region)
    .filter((question) => variant === '全部卷型' || question.variant === variant)
    .filter((question) => {
      if (status === '全部题目') return true
      if (status === '未做题') return !attemptedIds.has(question.id)
      const state = wrongById.get(question.id)
      return status === '错题' ? Boolean(state?.isWrong) : Boolean(state?.isFavorite)
    })
  const availableCount = filteredQuestions.length
  const selectedCount = Math.min(count, availableCount)
  const catalogPapers = (catalog?.papers ?? []).filter((paper) => catalogRegion === '全部地区' || paper.region === catalogRegion).filter((paper) => !catalogQuery.trim() || paper.title.includes(catalogQuery.trim()) || String(paper.year ?? '').includes(catalogQuery.trim())).slice(0, 20)
  return <>
    <PageIntro kicker="专项训练" title="把每一组题，都练出反馈" description="自由选择模块和题量；逐题模式即时看解析，整组模式模拟考场节奏。" />
    {catalog && <details className="catalog-card"><summary><span><strong>{catalog.stats.total} 套国考与省考目录</strong><small>国考 {catalog.stats.national} 套 · 省考 {catalog.stats.provincial} 套 · 已离线接入 {installedHistoricalPacks} 套</small></span><ChevronRight /></summary><div className="catalog-browser"><label><span>搜索年份或标题</span><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="例如：2025、贵州、行政执法" /></label><div className="filter-chips"><button className={clsx(catalogRegion === '全部地区' && 'selected')} onClick={() => setCatalogRegion('全部地区')}>全部地区</button>{catalog.regions.map((item) => <button key={item} className={clsx(catalogRegion === item && 'selected')} onClick={() => setCatalogRegion(item)}>{item} · {catalog.stats.byRegion[item] ?? 0}</button>)}</div><div className="catalog-list">{catalogPapers.map((paper) => <a key={paper.id} href={paper.url} target="_blank" rel="noreferrer"><span><strong>{paper.title}</strong><small>{paper.region} · {paper.year ?? '年份待识别'} · {paper.variant}{paper.recallEdition ? ' · 回忆版' : ''}</small></span><ExternalLink /></a>)}</div>{catalogPapers.length === 20 && <p className="catalog-hint">当前显示前 20 套，可继续输入年份或关键词缩小范围。</p>}</div></details>}
    <section className="mode-toggle" aria-label="练习模式">
      <button className={clsx(mode === 'instant' && 'active')} onClick={() => setMode('instant')}><BookOpenText /><span><strong>逐题练习</strong><small>答一题，看一题解析</small></span></button>
      <button className={clsx(mode === 'exam' && 'active')} onClick={() => setMode('exam')}><TimerReset /><span><strong>整组模式</strong><small>统一计时，最后交卷</small></span></button>
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span>第一步</span><h2>选择模块</h2></div></div>
      <div className="module-grid"><button className={clsx('module-card all', module === '全部模块' && 'selected')} onClick={() => setModule('全部模块')}><span><LibraryBig /></span><strong>全部模块</strong><small>{questions.length} 道</small></button>{EXAM_MODULES.map((item, index) => <button key={item} className={clsx('module-card', module === item && 'selected')} onClick={() => setModule(item)}><span>{['政', '常', '言', '数', '判', '资'][index]}</span><strong>{item}</strong><small>{counts[item] ?? 0} 道</small></button>)}</div>
    </section>
    <section className="section-block filter-panel">
      <div className="section-heading"><div><span>第二步</span><h2>精细筛选</h2></div><strong className="available-count">{availableCount} 道可用</strong></div>
      <div className="filter-group"><div className="filter-label"><strong>练习状态</strong><small>按本机记录筛选</small></div><div className="filter-chips">{(['全部题目', '未做题', '错题', '收藏题'] as QuestionStatusFilter[]).map((item) => <button key={item} className={clsx(status === item && 'selected')} onClick={() => setStatus(item)}>{item}</button>)}</div></div>
      <div className="filter-group"><div className="filter-label"><strong>难度</strong><small>1 星基础，5 星挑战</small></div><div className="filter-chips compact"><button className={clsx(difficulty === '全部难度' && 'selected')} onClick={() => setDifficulty('全部难度')}>全部</button>{([1, 2, 3, 4, 5] as Difficulty[]).map((item) => <button key={item} className={clsx(difficulty === item && 'selected')} onClick={() => setDifficulty(item)}>{item} 星</button>)}</div></div>
      <div className="filter-group"><div className="filter-label"><strong>年份</strong><small>历年真题筛选</small></div><div className="filter-chips"><button className={clsx(year === '全部年份' && 'selected')} onClick={() => setYear('全部年份')}>全部年份</button>{years.map((item) => <button key={item} className={clsx(year === item && 'selected')} onClick={() => setYear(item)}>{item}</button>)}</div></div>
      <div className="filter-group"><div className="filter-label"><strong>地区</strong><small>国考与省考</small></div><div className="filter-chips"><button className={clsx(region === '全部地区' && 'selected')} onClick={() => setRegion('全部地区')}>全部地区</button>{regions.map((item) => <button key={item} className={clsx(region === item && 'selected')} onClick={() => setRegion(item)}>{item}</button>)}</div></div>
      <div className="filter-group"><div className="filter-label"><strong>卷型</strong><small>按职位层级练习</small></div><div className="filter-chips"><button className={clsx(variant === '全部卷型' && 'selected')} onClick={() => setVariant('全部卷型')}>全部卷型</button>{variants.map((item) => <button key={item} className={clsx(variant === item && 'selected')} onClick={() => setVariant(item)}>{item}</button>)}</div></div>
      <div className="filter-group"><div className="filter-label"><strong>题源</strong><small>来源与许可随题保留</small></div><div className="filter-chips sources"><button className={clsx(packId === '全部题源' && 'selected')} onClick={() => setPackId('全部题源')}>全部题源</button>{packs.map((pack) => <button key={pack.packId} className={clsx(packId === pack.packId && 'selected')} onClick={() => setPackId(pack.packId)}>{pack.title}</button>)}</div></div>
    </section>
    <section className="section-block"><div className="section-heading"><div><span>第三步</span><h2>选择题量</h2></div><span className="selection-note">本组 {selectedCount} 题</span></div><div className="count-picker">{[5, 10, 20, 30].map((item) => <button key={item} className={clsx(count === item && 'selected')} onClick={() => setCount(item)}><strong>{item}</strong><small>题</small></button>)}</div></section>
    <div className="sticky-action"><button className="primary wide" disabled={availableCount === 0} onClick={() => onStart({ mode, count, module, difficulty, packId, status, year, region, variant })}>{availableCount === 0 ? '当前筛选暂无题目' : mode === 'exam' ? `开始整组计时 · ${selectedCount} 题` : `开始逐题练习 · ${selectedCount} 题`} {availableCount > 0 && <ChevronRight />}</button></div>
  </>
}

function PracticeSessionView({ sessionId, onExit }: { sessionId: string; onExit: () => void }) {
  const session = useLiveQuery(() => db.practiceSessions.get(sessionId), [sessionId])
  const questions = useLiveQuery(async () => {
    const current = await db.practiceSessions.get(sessionId)
    if (!current) return []
    return (await db.questions.bulkGet(current.questionIds)).filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [sessionId]) ?? []
  const [selected, setSelected] = useState<AnswerKey>()
  const [elapsed, setElapsed] = useState(0)
  const [showSheet, setShowSheet] = useState(false)
  const [message, setMessage] = useState('')
  const secondRef = useRef(0)

  const sessionKey = session?.id
  const sessionStatus = session?.status
  useEffect(() => { if (session) { setElapsed(session.elapsedSeconds); secondRef.current = session.elapsedSeconds } }, [session, sessionKey])
  useEffect(() => {
    if (!sessionKey || sessionStatus !== 'active') return
    const timer = window.setInterval(() => {
      secondRef.current += 1; setElapsed(secondRef.current)
      if (secondRef.current % 5 === 0) saveSessionProgress(sessionId, { elapsedSeconds: secondRef.current })
    }, 1000)
    return () => clearInterval(timer)
  }, [sessionKey, sessionStatus, sessionId])

  if (!session || !questions.length) return <div className="boot"><p>正在恢复练习…</p></div>
  const index = Math.min(session.currentIndex, questions.length - 1)
  const question = questions[index]!
  const currentSelected = selected ?? session.selectedAnswers[question.id]
  const submitted = session.submittedQuestionIds.includes(question.id)
  const isExam = session.mode === 'exam'
  const isDone = session.status === 'completed'
  const selectAnswer = (key: AnswerKey) => {
    if (submitted && !isExam) return
    setSelected(key)
    if (isExam) saveSessionProgress(sessionId, { selectedAnswers: { ...session.selectedAnswers, [question.id]: key } })
  }
  const submitCurrent = async () => {
    if (!currentSelected) { setMessage('请先选择一个答案'); return }
    await recordAnswer(sessionId, question.id, currentSelected, elapsed)
    setMessage(currentSelected === question.answer ? '回答正确' : `正确答案是 ${question.answer}`)
  }
  const go = async (nextIndex: number) => { setSelected(undefined); setMessage(''); await saveSessionProgress(sessionId, { currentIndex: nextIndex, elapsedSeconds: elapsed }) }
  const next = async () => {
    if (index === questions.length - 1) { await finishInstantSession(sessionId, elapsed); return }
    await go(index + 1)
  }
  const handIn = async () => { await completeExamSession(sessionId, session.selectedAnswers, elapsed); setShowSheet(false) }

  const correctCount = questions.filter((item) => session.selectedAnswers[item.id] === item.answer).length
  if (isDone) return <div className="session-shell result-screen"><div className="result-emblem"><Check /></div><span className="eyebrow">本组完成</span><h1>{correctCount}/{questions.length} 题正确</h1><p>正确率 {Math.round(correctCount / questions.length * 100)}% · 用时 {formatDuration(session.elapsedSeconds || elapsed)}</p><div className="result-grid"><div><strong>{correctCount}</strong><span>答对</span></div><div><strong>{questions.length - correctCount}</strong><span>待巩固</span></div><div><strong>{Math.round((session.elapsedSeconds || elapsed) / questions.length)}</strong><span>秒/题</span></div></div><button className="primary wide" onClick={onExit}>返回训练首页</button></div>

  return <div className="session-shell">
    <header className="session-header"><button className="icon-button" onClick={onExit} aria-label="退出练习"><X /></button><div><strong>{session.title}</strong><small>{isExam ? '整组模式' : session.mode === 'review' ? 'FSRS 复习' : '逐题模式'}</small></div><button className="timer" onClick={() => setShowSheet(true)}><Clock3 /> {formatDuration(elapsed)}</button></header>
    <div className="progress-line"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
    <main className="question-area">
      <div className="question-meta"><span>{question.module} · {question.submodule}</span><button onClick={() => toggleFavorite(question.id)}><Star size={17} /> 收藏</button></div>
      <div className="question-title"><em>{index + 1}</em><MarkdownContent text={question.stem} /></div>
      <div className="answers">{answerKeys.map((key) => {
        const isCorrect = (submitted || isDone) && key === question.answer
        const isWrong = submitted && currentSelected === key && key !== question.answer
        return <button key={key} className={clsx(currentSelected === key && 'selected', isCorrect && 'correct', isWrong && 'wrong')} onClick={() => selectAnswer(key)}><span>{key}</span><MarkdownContent className="option-markdown" text={question.options[key]} />{isCorrect && <Check />}</button>
      })}</div>
      {!isExam && submitted && <section className="explanation"><div className="explanation-title"><span className={clsx(currentSelected === question.answer ? 'good' : 'bad')}>{message || (currentSelected === question.answer ? '回答正确' : `正确答案 ${question.answer}`)}</span><small>难度 {'★'.repeat(question.difficulty)}</small></div><h3>解析</h3><p>{question.explanation}</p><div className="tags">{question.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><details><summary>题源与许可</summary><p><a href={question.sourceUrl} target="_blank" rel="noreferrer">{question.source} <ExternalLink size={13} /></a><span>{question.license}</span></p></details>{session.mode === 'review' && <div className="rating-row"><span>这道题记得怎么样？</span><div><button onClick={() => rateReview(question.id, Rating.Again)}>忘记</button><button onClick={() => rateReview(question.id, Rating.Hard)}>困难</button><button onClick={() => rateReview(question.id, Rating.Good)}>掌握</button><button onClick={() => rateReview(question.id, Rating.Easy)}>简单</button></div></div>}</section>}
      {message && !submitted && <p className="form-message">{message}</p>}
    </main>
    <footer className="session-actions">
      <button className="soft square" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft /></button>
      {isExam ? <><button className="soft answer-sheet-button" onClick={() => setShowSheet(true)}><ListChecks /> 答题卡 {Object.keys(session.selectedAnswers).length}/{questions.length}</button>{index < questions.length - 1 ? <button className="primary" onClick={() => go(index + 1)}>下一题 <ChevronRight /></button> : <button className="primary" onClick={() => setShowSheet(true)}>准备交卷</button>}</> : !submitted ? <button className="primary grow" onClick={submitCurrent}>提交答案</button> : <button className="primary grow" onClick={next}>{index === questions.length - 1 ? '完成本组' : '下一题'} <ChevronRight /></button>}
    </footer>
    {showSheet && <div className="sheet-backdrop" onClick={() => setShowSheet(false)}><section className="answer-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="section-heading"><div><span>答题进度</span><h2>答题卡</h2></div><button className="icon-button" onClick={() => setShowSheet(false)}><X /></button></div><div className="sheet-grid">{questions.map((item, itemIndex) => <button key={item.id} className={clsx(session.selectedAnswers[item.id] && 'answered', itemIndex === index && 'current')} onClick={() => { go(itemIndex); setShowSheet(false) }}>{itemIndex + 1}</button>)}</div><p>已答 {Object.keys(session.selectedAnswers).length} 题，未答 {questions.length - Object.keys(session.selectedAnswers).length} 题</p>{isExam && <button className="primary wide" onClick={handIn}>确认交卷</button>}</section></div>}
  </div>
}

function EssayPage() {
  const papers = useLiveQuery(() => db.essayPapers.toArray(), []) ?? []
  const [paperId, setPaperId] = useState<string>()
  const [taskId, setTaskId] = useState<string>()
  const paper = papers.find((item) => item.id === paperId)
  if (paper && taskId) return <EssayWriter paper={paper} taskId={taskId} onBack={() => setTaskId(undefined)} />
  if (paper) return <div><button className="back-link" onClick={() => setPaperId(undefined)}><ChevronLeft /> 返回申论卷</button><PageIntro kicker={paper.positionType} title={paper.title} description={`${paper.materials.length} 则材料 · ${paper.tasks.length} 道题 · 建议 ${paper.durationMinutes} 分钟`} /><section className="paper-material"><h2>给定材料</h2>{paper.materials.map((material) => <details key={material.id} open><summary>{material.title}</summary><p>{material.content}</p></details>)}</section><section className="task-list"><h2>作答任务</h2>{paper.tasks.map((task, index) => <button key={task.id} onClick={() => setTaskId(task.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{task.title}</strong><p>{task.prompt}</p><small>限 {task.wordLimit} 字</small></div><ChevronRight /></button>)}</section></div>
  return <><PageIntro kicker="申论训练" title="在材料里读问题，在纸面上见能力" description="原创材料、计时写作、自动保存、参考要点与离线量表自评。" /><div className="paper-list">{papers.map((item, index) => <button key={item.id} onClick={() => setPaperId(item.id)}><span className="paper-number">{String(index + 1).padStart(2, '0')}</span><div><span className="paper-type">{item.positionType}</span><h2>{item.title}</h2><p>{item.materials.length} 则材料 · {item.tasks.length} 道任务</p></div><ChevronRight /></button>)}</div></>
}

function EssayWriter({ paper, taskId, onBack }: { paper: EssayPaper; taskId: string; onBack: () => void }) {
  const task = paper.tasks.find((item) => item.id === taskId)!
  const submissionId = `${paper.id}:${task.id}`
  const stored = useLiveQuery(() => db.essaySubmissions.get(submissionId), [submissionId])
  const [text, setText] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [checked, setChecked] = useState<string[]>([])
  const initialized = useRef('')
  useEffect(() => { if (stored && initialized.current !== submissionId) { setText(stored.answerText); setElapsed(stored.elapsedSeconds); setSubmitted(stored.status === 'submitted'); setChecked(stored.checkedRubricIds); initialized.current = submissionId } else if (stored === undefined && initialized.current !== submissionId) initialized.current = submissionId }, [stored, submissionId])
  useEffect(() => { const timer = setInterval(() => setElapsed((value) => value + 1), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    if (!initialized.current) return
    const timer = setTimeout(() => saveEssay(submitted ? 'submitted' : 'draft'), 650)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, checked, submitted])
  useEffect(() => {
    if (!initialized.current || elapsed === 0 || elapsed % 5 !== 0) return
    void db.essaySubmissions.update(submissionId, { elapsedSeconds: elapsed, updatedAt: new Date().toISOString() })
  }, [elapsed, submissionId])
  const score = task.rubric.filter((item) => checked.includes(item.id)).reduce((sum, item) => sum + item.maxScore, 0)
  const saveEssay = async (status: EssaySubmission['status'], createVersion = false) => {
    const now = new Date().toISOString()
    const current = await db.essaySubmissions.get(submissionId)
    const versions = createVersion
      ? [...(current?.versions ?? []), { savedAt: now, answerText: text, selfScore: score }]
      : current?.versions
    await db.essaySubmissions.put({ id: submissionId, paperId: paper.id, taskId: task.id, answerText: text, elapsedSeconds: elapsed, checkedRubricIds: checked, selfScore: score, status, createdAt: current?.createdAt ?? now, updatedAt: now, versions })
  }
  const submit = async () => { setSubmitted(true); await saveEssay('submitted', true) }
  return <div className="essay-writer"><header><button className="icon-button" onClick={onBack}><ChevronLeft /></button><div><strong>{task.title}</strong><small>自动保存到本机</small></div><span><Clock3 /> {formatDuration(elapsed)}</span></header><section className="essay-prompt"><span>{paper.title}</span><h2>{task.prompt}</h2><small>建议不超过 {task.wordLimit} 字</small></section><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="在这里开始作答…" aria-label="申论作答区" /><div className={clsx('word-count', text.length > task.wordLimit && 'over')}>{text.length} / {task.wordLimit} 字</div>{!submitted ? <button className="primary wide" onClick={submit} disabled={!text.trim()}>完成写作，开始自评</button> : <section className="self-review"><div className="section-heading"><div><span>离线量表</span><h2>参考要点与自评</h2></div><strong>{score} 分</strong></div><div className="reference-points"><h3>参考要点</h3>{task.referencePoints.map((point) => <p key={point}><Check /> {point}</p>)}</div><div className="rubric-list">{task.rubric.map((item) => <label key={item.id}><input type="checkbox" checked={checked.includes(item.id)} onChange={() => setChecked((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /><span><strong>{item.label}<em>+{item.maxScore}</em></strong><small>{item.description}</small></span></label>)}</div>{stored?.versions?.length ? <details className="version-history"><summary>历史版本（{stored.versions.length}）</summary>{[...stored.versions].reverse().map((version) => <article key={version.savedAt}><strong>{new Date(version.savedAt).toLocaleString('zh-CN')} · 自评 {version.selfScore} 分</strong><p>{version.answerText.slice(0, 90)}{version.answerText.length > 90 ? '…' : ''}</p></article>)}</details> : null}<button className="soft wide" onClick={() => setSubmitted(false)}>继续修改文章</button></section>}</div>
}

function WrongPage({ onStart }: { onStart: (options: CreateSessionOptions) => Promise<void> }) {
  const states = useLiveQuery(() => db.wrongQuestionStates.toArray(), []) ?? []
  const questions = useLiveQuery(() => db.questions.toArray(), []) ?? []
  const [tab, setTab] = useState<'due' | 'all' | 'favorite'>('due')
  const now = new Date()
  const filteredStates = states.filter((item) => tab === 'favorite' ? item.isFavorite : item.isWrong && (tab === 'all' || new Date(item.due) <= now))
  const rows = filteredStates.map((state) => ({ state, question: questions.find((question) => question.id === state.questionId) })).filter((item) => item.question)
  return <><PageIntro kicker="错题重练" title="错过一次，更要记住下一次" description="FSRS 根据你的记忆评分安排复习，不做无效重复。" /><div className="tabs"><button className={clsx(tab === 'due' && 'active')} onClick={() => setTab('due')}>今日到期</button><button className={clsx(tab === 'all' && 'active')} onClick={() => setTab('all')}>全部错题</button><button className={clsx(tab === 'favorite' && 'active')} onClick={() => setTab('favorite')}>收藏</button></div>{rows.length ? <><div className="wrong-list">{rows.map(({ state, question }) => <article key={state.questionId}><span>{question!.module.slice(0, 1)}</span><div><small>{question!.module} · {question!.submodule}</small><h3>{question!.stem}</h3><p>错 {state.wrongCount} 次 · {new Date(state.due) <= now ? '现在可复习' : `${new Date(state.due).toLocaleDateString('zh-CN')} 到期`}</p></div>{state.isFavorite && <Heart fill="currentColor" />}</article>)}</div><div className="sticky-action"><button className="primary wide" onClick={() => onStart({ mode: 'review', questionIds: rows.map((item) => item.state.questionId), title: tab === 'due' ? '今日到期复习' : '错题重练' })}>开始复习 {rows.length} 题 <ChevronRight /></button></div></> : <EmptyState icon={ShieldCheck} title={tab === 'favorite' ? '还没有收藏题目' : '这一栏已经清空'} text="完成练习后，错题和收藏会自动出现在这里。" />}</>
}

function MinePage() {
  const packs = useLiveQuery(() => db.questionPacks.toArray(), []) ?? []
  const questions = useLiveQuery(() => db.questions.toArray(), []) ?? []
  const attempts = useLiveQuery(() => db.attempts.toArray(), []) ?? []
  const essays = useLiveQuery(() => db.essaySubmissions.toArray(), []) ?? []
  const lastBackup = useLiveQuery(() => db.settings.get('lastBackupAt'), [])
  const [storage, setStorage] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 })
  const [message, setMessage] = useState('')
  useEffect(() => { navigator.storage?.estimate().then((estimate) => setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 })); navigator.storage?.persist?.() }, [])
  const exportData = async () => { const bundle = await createBackupBundle(); downloadBackup(bundle); await db.settings.put({ key: 'lastBackupAt', value: bundle.exportedAt }); setMessage('备份文件已生成') }
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    try {
      if (file.name.endsWith('.xlsx')) { const pack = await importXlsxPack(await file.arrayBuffer(), file.name); const count = await saveQuestionPack(pack); setMessage(`成功导入 ${count} 道题`) }
      else { const text = await file.text(); const json = JSON.parse(text); if (json.data && json.checksum) { const bundle = await parseBackupBundle(text); await restoreBackupBundle(bundle); setMessage('学习备份已恢复') } else if (json.essayPapers) { const pack = await importJsonEssayPack(text); const count = await saveEssayPack(pack); setMessage(`成功导入 ${count} 套申论卷`) } else { const pack = await importJsonPack(text, file.name); const count = await saveQuestionPack(pack); setMessage(`成功导入 ${count} 道题`) } }
    } catch (error) { setMessage(error instanceof Error ? error.message : '导入失败') }
    event.target.value = ''
  }
  const usedMb = (storage.usage / 1024 / 1024).toFixed(1)
  const quotaMb = (storage.quota / 1024 / 1024).toFixed(0)
  const packCounts = new Map<string, number>()
  questions.forEach((question) => packCounts.set(question.packId, (packCounts.get(question.packId) ?? 0) + 1))
  return <><PageIntro kicker="本地档案" title="你的进度，只属于这台设备" description="免账号、免后台。请定期导出备份，以便换机或清理浏览器数据后恢复。" /><section className="profile-summary"><div className="seal large">公</div><div><strong>本机学习者</strong><span>已练 {attempts.length} 题 · 申论稿件 {essays.length} 篇</span></div></section><section className="settings-group"><div className="section-heading"><div><span>数据安全</span><h2>备份与存储</h2></div></div><button className="setting-row" onClick={exportData}><span className="setting-icon"><Download /></span><span><strong>导出学习备份</strong><small>上次备份：{lastBackup?.value ? new Date(String(lastBackup.value)).toLocaleDateString('zh-CN') : '尚未备份'}</small></span><ChevronRight /></button><label className="setting-row"><span className="setting-icon"><Upload /></span><span><strong>导入题包或恢复备份</strong><small>支持 .json 与 .xlsx</small></span><ChevronRight /><input type="file" accept=".json,.xlsx" onChange={importFile} /></label><div className="storage-card"><div><span>本地存储</span><strong>{usedMb} MB</strong></div><div className="storage-bar"><span style={{ width: `${Math.min(100, storage.quota ? storage.usage / storage.quota * 100 : 0)}%` }} /></div><small>浏览器可用配额约 {quotaMb} MB，已请求持久存储。</small></div>{message && <p className="notice">{message}</p>}</section><section className="settings-group"><div className="section-heading"><div><span>题包管理</span><h2>已安装题包</h2></div><strong className="available-count">共 {questions.length} 题</strong></div>{packs.map((pack) => <a className="pack-row" key={pack.packId} href={pack.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${pack.title}，${packCounts.get(pack.packId) ?? 0} 道，查看题源`}><span className="setting-icon"><LibraryBig /></span><div><strong>{pack.title}</strong><small>{packCounts.get(pack.packId) ?? 0} 道 · v{pack.version} · {pack.builtIn ? '内置题包' : '用户导入'}</small><small className="pack-license">{pack.license}</small></div><ExternalLink /></a>)}</section><section className="settings-group attribution"><div className="section-heading"><div><span>开源与许可</span><h2>技术与题源说明</h2></div></div><p>应用使用 React、Vite PWA、Dexie.js、ts-fsrs、Zod、SheetJS、Vitest 与 Playwright 构建。内置题目和申论卷为原创内容；导入题包会保留来源链接及许可字段。</p><a href="https://github.com/open-spaced-repetition/ts-fsrs" target="_blank">查看 FSRS 开源项目 <ChevronRight /></a></section></>
}

function PageIntro({ kicker, title, description }: { kicker: string; title: string; description: string }) { return <section className="page-intro"><span>{kicker}</span><h1>{title}</h1><p>{description}</p></section> }
function EmptyState({ icon: Icon, title, text }: { icon: typeof Flag; title: string; text: string }) { return <div className="empty-state"><Icon /><h3>{title}</h3><p>{text}</p></div> }

export default App
