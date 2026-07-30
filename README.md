# 考公陪跑宝典

手机优先、本地优先的行测刷题与申论训练 PWA。首次打开并完成题库初始化后，可添加到手机主屏幕；答题、错题、FSRS 复习、申论草稿和统计均保存在设备的 IndexedDB 中。

## 已实现

- 首页：继续上次、今日复习、累计题量、正确率和最近训练。
- 刷题：六大模块专项组卷，可按难度、题源、未做/错题/收藏、年份、地区和卷型筛选，并支持逐题解析和整组计时/答题卡/交卷。
- 错题：自动归档，按 FSRS 的“忘记、困难、掌握、简单”评分安排复习。
- 申论：6 套原创卷、计时写作、字数提示、自动保存、参考要点和离线量表。
- 我的：题包题量与许可概览、来源直达、JSON/XLSX 导入、带 SHA-256 校验的版本化备份与恢复、存储占用。
- PWA：程序外壳、图标和全部内置题包预缓存，首次加载后可断网启动。
- 历年真题：本地目录已索引 722 套国考/省考试卷（国考 37、省考 685），支持手机端搜索和地区筛选；已离线接入 16 套完整试卷、1,890 道历年真题。
- 贵州题库：14 套完整贵州省考/选调卷，共 1,630 题；覆盖 2026—2017、2014、2009 年的可完整解析卷，题目、答案和题图均已离线化。
- 内置内容：180 道原创行测题、6 套原创申论卷、2,217 道开放题源题目、1,890 道历年真题，共 4,287 道行测题。

开放题源包括 C-Eval civil_servant（52 道，CC BY-NC-SA 4.0）、CMMLU Chinese Civil Service Exam（165 道，CC BY-NC 4.0）、LogiQA 2.0（1,200 道，CC BY-NC-SA 4.0）和 BAAI COIG Exam Instructions（800 道，Apache-2.0 / 来源特定条款）。历年卷来自公开真题目录，保留原卷链接、来源和条款字段；首批解析标为草稿，等待逐题复核。

## 开源主体

当前 PWA 学员端保留 React + Vite PWA + Dexie + FSRS 的本地优先架构，并选定 [mindskip/xzs-mysql](https://github.com/mindskip/xzs-mysql) 作为后续题库管理与教师后台上游。现已加入 XZS 单选题 JSON 兼容适配器；完整候选对比、许可证和接入边界见 [`docs/OSS_BASELINE.md`](docs/OSS_BASELINE.md)。

## 本地运行

```powershell
npm install
npm run dev -- --host 0.0.0.0
```

正式构建与预览：

```powershell
npm run build
npm run preview
```

手机安装和离线 Service Worker 需要 HTTPS。将 `dist/` 部署到 GitHub Pages、Cloudflare Pages、Vercel 等静态托管后，用手机浏览器打开链接并选择“添加到主屏幕”。仓库已包含 GitHub Pages 工作流。

## 校验

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
```

`test:e2e` 使用手机视口验证答题、重新加载恢复、首次加载后的离线启动、大题库筛选、真题目录搜索、省份/年份/卷型筛选与空结果保护。本机 Playwright 配置使用已安装的 Chrome。

## 刷新开放题源

```powershell
npm run data:refresh-open
```

脚本从各项目的公开数据端点获取、清洗并生成 `src/data/generated/openPacks.ts`。生成结果进入版本控制，使发布构建不依赖运行时网络。

## 刷新国考与省考目录/题包

```powershell
npm run data:refresh-exam-catalog
npm run data:refresh-exam-pilots
```

第一条命令刷新 34 个地区的试卷目录到 `public/exam-paper-catalog.json`；第二条命令解析基础试卷，贵州专项可执行 `npm run data:refresh-guizhou`。流水线生成 `src/data/generated/examPacks.ts`、`public/exam-assets/` 以及 `data/review-packs/` 审核报告。只有题目、答案、选项和图片全部通过校验的试卷会进入内置题库；题图随 Service Worker 预缓存，飞行模式下仍可显示。

生成手机端运行证据：

```powershell
npm run proof:mobile
```

## 题包导入

- JSON：支持 `QuestionPackManifest + ObjectiveQuestion[]`，也会自动识别 XZS 单选题导出及 `response.list` 分页结构；示例见 [`docs/examples/xzs-single-choice-export.json`](docs/examples/xzs-single-choice-export.json)。
- XLSX：第一张工作表支持中文表头：`题目ID、模块、子类、题干、选项A、选项B、选项C、选项D、答案、解析、难度、年份、地区、来源、来源链接、许可、标签`。
- 备份 JSON：带 `schemaVersion` 和 SHA-256 `checksum`，可在“我的”页面直接恢复。

## 技术栈

React、TypeScript、Vite、vite-plugin-pwa、Dexie.js、ts-fsrs、Zod、SheetJS、Vitest、Playwright。
