# 开源主体基座决策

更新时间：2026-07-30

## 当前事实

本项目最初从空仓库建立，当前学员端不是某个完整考试系统的 fork。它已经在代码层复用 React、Vite、vite-plugin-pwa、Dexie、ts-fsrs、Zod、SheetJS、Vitest、Playwright 等开源组件，在内容层接入 LogiQA 2.0、C-Eval、CMMLU 与 COIG。

因此，准确表述是：**已集成开源组件和开放题源，但此前没有完整开源考试产品作为上游主体。**

## 候选审计

数据为 2026-07-30 的 GitHub 快照，精确提交记录见 `upstream/upstream-lock.json`。

| 候选 | 许可 | 适配点 | 主要差距 | 结论 |
|---|---|---|---|---|
| [mindskip/xzs-mysql](https://github.com/mindskip/xzs-mysql) | AGPL-3.0 | 题库管理、试卷、考试记录、错题本、管理端、Web/微信端，中文生态完整 | Java + Vue + MySQL，默认需要账号和服务端，体积大 | **选为可选题库/后台上游** |
| [SurveyJS Form Library](https://github.com/surveyjs/survey-library) | MIT | React、JSON 表单、分页、测验和评分能力成熟 | 是组件库，不包含本地学习记录、错题与 FSRS；Creator 等产品需单独核验许可 | 保留为复杂表单候选 |
| [didi/xiaoju-survey](https://github.com/didi/xiaoju-survey) | Apache-2.0 | 题型、问卷/考试、编辑和分析能力完整 | Vue + NestJS + MongoDB，偏在线调研和组织级后台 | 后台扩展候选 |
| [AlliotTech/ham-exam-web](https://github.com/AlliotTech/ham-exam-web) | 仓库未检测到许可证 | Next/React、PWA、离线、本地记录、模拟考试与本产品最接近 | GitHub 根目录未检测到明确许可证 | 仅作产品调研样本 |
| [lsgwr/spring-boot-online-exam](https://github.com/lsgwr/spring-boot-online-exam) | MIT | 单选/多选/判断、角色、组卷、成绩 | 移动端仍在待办，最近主分支更新较早 | 未选 |

## 最终架构

采用“两层基座”，避免为了后台能力牺牲手机离线体验：

1. **学员端基座**：保留当前 React + Vite PWA + Dexie + FSRS。它负责安装、离线答题、计时、错题复习、申论和设备内备份。
2. **题库/后台上游**：选定 `mindskip/xzs-mysql`。后续需要教师后台、账号、集中题库或多人使用时，以 XZS 部署为管理端。
3. **兼容边界**：通过独立适配器把 XZS 的单选题 JSON 转换成 `QuestionPack`，不把 Java/Vue 服务端塞进 PWA 主包。
4. **真题采集边界**：国考、省考采集先进入来源台账和待审核题包，再经过答案、年份、地区、卷型、重复题与许可检查，最后进入学员端。

## 已落地的第一项集成

- `src/integrations/xzs.ts`：支持 XZS `QuestionEditRequestVM` / 分页 `response.list` 形式的四选一单选题导入。
- `src/services/importPack.ts`：JSON 导入时自动识别原生 `QuestionPack` 或 XZS 导出。
- XZS HTML 题干、选项和解析会清洗为手机端文本。
- 难度 1–5、答案、来源和稳定题目 ID 会映射到本地数据模型。
- 题目内容继续沿用其原始来源条款；XZS 软件本身的许可是 AGPL-3.0。

## 真题接入进度

1. 已完成公开真题库 API 目录采集器：34 个地区标签、722 套卷。
2. 已实现试卷页、答案页和图片资源解析，并生成逐卷审核 JSON。
3. 已缓存 87 张首批题图，并加入 PWA 离线资源清单。
4. 已加入年份、地区、卷型筛选和手机端真题目录搜索。
5. 已接入 2025 国考副省级卷 135 题与 2025 浙江 A 类卷 125 题；答案覆盖 100%，解析标记为草稿待复核。
6. 后续按审核节奏扩展其余目录；需要多人管理时，再部署 XZS MySQL 管理端并实现题包同步。
