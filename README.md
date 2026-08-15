# DSH 插件整合包（ggame）

DeepSeek Harness 插件集合（monorepo）：背包、任务等单体插件。既可安装**整合包**，也可**单独安装**某个单体插件。

## 组成

| 包 | 说明 | 独立安装 |
|---|---|---|
| `@ggame/plugins` | 整合包元包（依赖全部单体） | ✅ |
| `@ggame/backpack` | 背包：物品栏 / 袋子 / 货币 / 全会话费用记账 | ✅ |
| `@ggame/quest` | 任务：任务面板 / 追踪条 / Agent 联动 / 到期提醒 | ✅ |
| `@ggame/ui-core`（规划） | 共享 UI 壳 / useStore / 拖拽 / WoW 主题 | — |
| `@ggame/icons`（规划） | 共享图标源与许可 | — |

## 安装

### 方式一：整合包（全部插件）
```bash
# 在 DSH web profile 目录
pnpm add @ggame/plugins
```

### 方式二：单体插件（只装其中一个）
```bash
pnpm add @ggame/backpack
# 或
pnpm add @ggame/quest
```

然后编辑 profile 的 `package.json`（`dsh.profile.bundles` 加入要用的包）、`cordis.patch.yml` 加入对应行，重启 DSH。详见各包 README。

## 特性一览

**@ggame/backpack（背包）**
- 物品栏/袋子管理/虚空仓库、拖拽放置预览、悬停快速操作条、Shift 批量多选、搜索（/ 快捷键）/过滤/排序、一键整理
- 全会话 token 费用记账（DeepSeek 官方动态定价 + 峰谷计价、旋转批次增量扫描）、📊 费用可视化（每日趋势/模型占比）、usageLog 归档、.bak 轮换备份
- Agent 工具：backpack_add / backpack_money / backpack_search

**@ggame/quest（任务）**
- 任务面板（L 键）/看板/列表+详情并排、目标 +1/-1 绿闪、操作分组、右键菜单
- 追踪条（可折叠/隐藏、剩余时间）、到期浏览器通知、重复任务（每日/每周）、完成统计看板、任务模板
- Agent 联动闭环：发送对话 → 自动检测（get-quest 轻轮询）→ 自动完成
- Agent 工具：quest_add / quest_update / quest_complete / quest_progress / quest_list / quest_search

## 开发与测试

```bash
pnpm install            # 安装 workspace 依赖
pnpm build              # 构建各包客户端 bundle
pnpm test               # 单元测试（定价/数据模型）
pnpm test:integration   # 集成测试（需 DSH Web 运行中）
pnpm check              # 语法检查
node _shots/cdp-tour.mjs  # 全交互截图测试（需 CDP Chrome，见 _shots/cdp-shot.mjs）
```

## 许可

MIT。图标为示例素材，发布/商用前请替换（见各包 README）。
