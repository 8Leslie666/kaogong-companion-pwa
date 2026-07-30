import type { EssayPaper, PositionType } from '../domain/types'

const PACK_ID = 'original-core-v1'

const topics: Array<{ type: PositionType; slug: string; title: string; focus: string; material: string; issues: string[] }> = [
  { type: '中央省级综合管理', slug: 'digital-government', title: '数字政府与公共服务协同', focus: '以数字化提升治理效能', material: '多地建设一体化政务平台，群众办事材料和次数明显减少。但部门数据标准不一、基层重复填报、老年人使用困难等问题仍然存在。有的地方开始设置线下帮办窗口，建立数据纠错和授权使用机制，并用群众满意度评价平台成效。', issues: ['数据标准不统一', '基层重复填报', '特殊群体数字使用困难'] },
  { type: '中央省级综合管理', slug: 'innovation', title: '让科技成果走出实验室', focus: '完善科技成果转化生态', material: '某省高校专利数量增长较快，真正转化为产品的比例却不高。调研发现，科研评价重论文轻应用，企业不知道去哪里找技术，技术经理人数量不足。当地试行成果清单、企业需求清单和服务清单联动，并允许科研人员按规定分享转化收益。', issues: ['供需信息不对称', '评价激励不匹配', '专业服务力量不足'] },
  { type: '市县综合管理', slug: 'eldercare', title: '家门口的幸福养老', focus: '构建社区养老服务网络', material: 'A市老龄人口持续增加。部分社区食堂受到欢迎，但也有站点距离远、服务项目单一、运营收入不足等问题。几家社区把闲置用房改为综合服务站，引入社会组织，提供助餐、康复、上门探访，并通过积分吸引低龄老人参与志愿服务。', issues: ['设施布局不均', '服务供给单一', '持续运营能力不足'] },
  { type: '市县综合管理', slug: 'old-town', title: '老街更新与城市记忆', focus: '在更新中延续地方文脉', material: 'B县古街一度设施老化、商户外迁。改造初期，有方案主张整体翻新，引发居民担忧。此后项目组记录老建筑档案，邀请居民和商户议事，保留街巷尺度，更新水电消防，引入书店、手工作坊和社区服务空间，客流与常住生活逐渐恢复。', issues: ['保护与改善关系失衡', '居民参与不足', '业态同质化风险'] },
  { type: '行政执法', slug: 'flexible-enforcement', title: '让执法既有力度又有温度', focus: '规范涉企行政执法', material: 'C市企业反映，多头检查、标准不一影响经营。一些执法部门整合检查计划，实行扫码入企、结果共享；对轻微且及时改正的事项依法采取提醒纠正，对涉及公共安全的违法行为严格查处。同时公开裁量基准，开展案卷评查和回访。', issues: ['重复检查', '裁量标准不透明', '服务与监管衔接不足'] },
  { type: '行政执法', slug: 'market-safety', title: '守护小摊点里的大民生', focus: '提升基层食品安全治理', material: 'D区流动摊点数量多，方便居民也带来食品安全和占道问题。过去简单取缔后常常反弹。街道划定便民经营区，市场监管人员提供办证指导和快检服务，城管、社区、商户共同制定卫生公约，并用风险等级确定检查频次。', issues: ['治理方式单一', '经营规范不足', '部门协同不够'] },
]

export const essayPapers: EssayPaper[] = topics.map((topic, index) => ({
  id: `essay-${topic.slug}`,
  packId: PACK_ID,
  title: topic.title,
  positionType: topic.type,
  durationMinutes: 150,
  materials: [
    { id: `${topic.slug}-m1`, title: '材料一｜现状', content: topic.material },
    { id: `${topic.slug}-m2`, title: '材料二｜一线声音', content: `基层干部表示，推进${topic.focus}既要形成统一规则，也要给一线留下因地制宜的空间。群众更关心服务是否方便、问题能否真正解决；相关主体则希望政策稳定、沟通顺畅、评价客观。` },
    { id: `${topic.slug}-m3`, title: '材料三｜实践启示', content: `专家认为，破解${topic.issues.join('、')}等问题，需要把需求识别、资源整合、过程监督和效果评价连成闭环。制度设计要可执行，数字工具要服务于人，试点经验还应及时复盘并转化为长效机制。` },
  ],
  tasks: [
    {
      id: `${topic.slug}-t1`, title: '概括题', prompt: `根据给定材料，概括推进“${topic.focus}”面临的主要问题。要求：全面、准确、有条理。`, wordLimit: 200,
      referencePoints: topic.issues,
      rubric: [
        { id: 'points', label: '要点完整', description: '覆盖材料中的核心问题并准确归纳', maxScore: 12 },
        { id: 'logic', label: '条理清楚', description: '分点作答，层次与逻辑关系清晰', maxScore: 5 },
        { id: 'language', label: '表达简洁', description: '用语规范，控制在规定字数内', maxScore: 3 },
      ],
    },
    {
      id: `${topic.slug}-t2`, title: '对策题', prompt: `假如你是相关部门工作人员，请就推进“${topic.focus}”提出具体建议。要求：针对性强、切实可行。`, wordLimit: 350,
      referencePoints: ['开展需求调研并分类施策', '健全部门协同和资源共享机制', '完善标准、监督与反馈闭环', '为重点群体提供便利服务'],
      rubric: [
        { id: 'target', label: '针对问题', description: '措施与材料问题逐项对应', maxScore: 8 },
        { id: 'action', label: '措施可行', description: '有主体、动作、机制和预期效果', maxScore: 9 },
        { id: 'structure', label: '结构清晰', description: '分层分类，语言准确简练', maxScore: 3 },
      ],
    },
    {
      id: `${topic.slug}-t3`, title: '文章写作', prompt: `请围绕“${topic.focus}”，联系实际，自选角度，自拟题目，写一篇议论文。`, wordLimit: 1000,
      referencePoints: ['准确理解主题内涵', '从材料提炼中心论点', '兼顾问题分析与治理路径', '联系实际并形成完整论证'],
      rubric: [
        { id: 'theme', label: '立意准确', description: '紧扣主题，中心论点明确且有现实意义', maxScore: 12 },
        { id: 'argument', label: '论证充分', description: '论据与论点匹配，分析具有层次', maxScore: 14 },
        { id: 'structure', label: '结构完整', description: '标题、开头、主体、结尾衔接自然', maxScore: 8 },
        { id: 'expression', label: '表达规范', description: '语言流畅，卷面意识与字数符合要求', maxScore: 6 },
      ],
    },
  ],
  source: `考公陪跑宝典原创申论卷 ${index + 1}`,
  license: '原创内容，仅供学习使用',
}))
