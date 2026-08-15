# DSH 任务（Quest）

DeepSeek Harness 常驻插件：仿魔兽世界任务系统。按 `L` 打开任务面板，左下角卷轴按钮（背包图标左侧）快捷进入；右侧常驻任务追踪条实时显示已追踪任务的进度；任务看板支持任务维护；Agent 可经对话直接创建 / 更新 / 完成 / 推进任务。

> 适用于 DSH Web profile（`dsh web`）。与 [@dsh/backpack](https://github.com/)（背包）并列安装互不影响。

## 特性

- 📜 **任务面板**（`L` 键 / 卷轴按钮开合）：左侧「任务看板」+ 右侧任务列表
- 🗺️ **任务看板**（替代游戏内地图）：分类分组、统计（进行中/追踪/完成）、分类与任务维护
- 👁️ **任务追踪条**：屏幕右侧常驻，列出追踪中任务，目标缩进 + 进度 `1/3`，完成变灰划线，可折叠/可隐藏；显示剩余时间
- 🔁 **重复任务**：每日/每周周期，完成后自动重置目标与到期日
- 🔔 **到期提醒**：浏览器 Notification，到期前 30 分钟 / 已到期提醒（按天去重）
- 📊 **完成统计看板**：本周完成 / 平均耗时 / 超期率
- 🤖 **Agent 工具**：`quest_add` / `quest_update` / `quest_complete` / `quest_progress` / `quest_list` / `quest_search`
- 🖱️ **交互**：列表+详情并排（经典 WoW 布局）、目标 +1/-1 绿闪、操作分组、Esc/`/` 快捷键、toast 分色
- ⭐ **WoW 质感**：难度等级 1-5（灰/绿/黄/橙/红）、暗金羊皮纸配色、右键菜单
- 🖱️ **任务维护**：新建 / 编辑 / 删除 / 追踪 / 完成 / 放弃 / 分类管理 / 目标进度 +1 / 勾选完成
- 🤖 **Agent 联动**：`quest_add` / `quest_update` / `quest_complete` / `quest_progress` / `quest_list`
- 💾 数据持久化到 `~/.dsh/quest-state.json`（可在设置中修改路径）

## 环境要求

- DeepSeek Harness（`dsh`），Web profile
- 依赖的 peer 包（DSH 自带）：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-settings`、`@deepseek-ai/schemastery`、`react`

## 安装

与背包插件相同的本地 workspace 方式：

1. 把本仓库放到 profile 的 packages 目录，例如 `~/.dsh/profiles/web/packages/quest`。
2. `pnpm-workspace.yaml` 加入 `packages/*`（若尚未有）。
3. `package.json` 的 `dependencies` 加 `"@dsh/quest": "workspace:*"`，`dsh.profile.bundles` 追加 `"@dsh/quest"`。
4. `pnpm install`。
5. `cordis.patch.yml` 追加：

   ```yaml
   - id: quest
     config: {}
   ```

6. 重启 DSH：`dsh web`。左下角出现卷轴按钮（背包图标左侧 5px）。

## 使用

| 操作 | 方式 |
|---|---|
| 开合任务面板 | `L` 键或左下角卷轴按钮 |
| 追踪条折叠 | 点击追踪条标题「任务 ▾/▸」 |
| 新建任务 | 面板左侧看板「＋ 新建任务」 |
| 维护任务 | 列表行右键菜单 / 点击展开详情（目标 +1、勾选完成、追踪/完成/放弃/编辑/删除） |
| 分类管理 | 看板「＋ 添加分类」；右键分类删除 |
| Agent 联动 | 对话里说「把 XXX 记成任务」「标记 XXX 完成」，或直接调用 quest_* 工具 |

## 配置（设置 → 插件 → 插件配置 → 任务）

| 字段 | 默认 | 说明 |
|---|---|---|
| `statePath` | `~/.dsh/quest-state.json` | 状态文件路径（留空用默认） |

## 数据文件

`~/.dsh/quest-state.json`：

```jsonc
{
  "version": 1,
  "categories": ["主线", "支线", "日常"],
  "quests": [{
    "id": "q-…",
    "title": "进军广场",
    "level": 2,                     // 1-5（灰/绿/黄/橙/红）
    "category": "主线",
    "status": "tracked",            // active | tracked | completed | abandoned
    "description": "…",
    "objectives": [{ "id": "o-…", "text": "击败诅咒狂潮", "target": 3, "current": 1 }],
    "rewards": "经验 +250",
    "order": 0,
    "icon": "",
    "createdAt": 0, "updatedAt": 0, "completedAt": 0
  }]
}
```

目标完成判定：`current >= target`（自动）。

## 开发

- `src/client.js` 为浏览器端可读源码，`lib/client.js` 为构建产物（`pnpm build`）。
- `lib/model.js` 为任务数据模型核心（零依赖，`pnpm test` 单测）。
- Host 逻辑在 `lib/index.js`：设置、持久化、Web API（`/_dsh/quest/api`、`/_dsh/quest/media`）、Agent 工具。

```
lib/index.js       宿主逻辑（设置 / 持久化 / Web API / Agent 工具）
lib/model.js       任务数据模型（种子 / 清洗 / 查找 / 新建，零依赖）
lib/client.js      浏览器 bundle（生成物）
src/client.js      浏览器端可读源码
scripts/build-client.mjs    src → lib 打包
icons/             任务图标（当前复制自背包图标库，未来可替换为专属一套）
tests/quest.test.mjs        数据模型单元测试
cordis.patch.yml   DSH bundle 挂载声明
```

## 许可与致谢

- 代码：MIT。
- 图标：与背包同源的魔兽风格示例图标（AI 生成素材），仅供个人使用与演示；发布/商用前请替换为自有素材或确认素材许可。
