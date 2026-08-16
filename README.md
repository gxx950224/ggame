# DSH 插件整合包（ggame）

![主页总览](docs/screenshots/主页总览.png)

DeepSeek Harness 插件集合（monorepo）：背包、任务等单体插件。既可安装**整合包**，也可**单独安装**某个单体插件。

## 截图预览

| 背包 | 任务 |
|---|---|
| ![背包面板](docs/screenshots/背包面板.png) | ![任务面板](docs/screenshots/任务面板.png) |

## 组成

| 包 | 说明 | 独立安装 |
|---|---|---|
| `@ggame/plugins` | 整合包元包（依赖全部单体） | ✅ |
| `@ggame/backpack` | 背包：物品栏 / 袋子 / 货币 / 全会话费用记账 | ✅ |
| `@ggame/quest` | 任务：任务面板 / 追踪条 / Agent 联动 / 到期提醒 | ✅ |
| `@ggame/ui-core` | 共享 UI 壳：useStore / 拖拽 / WoW 主题（构建期内联，不独立安装） | — |
| `@ggame/icons` | 共享图标源与许可说明（28 个魔兽风格 PNG） | — |

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

### 🤖 AI 一键安装提示词（复制发给 DSH Agent，让它自动完成安装）

```
请帮我在 DSH 中安装 ggame 整合包插件（背包 + 任务）。请执行：
1. cd ~/.dsh/profiles/web
2. pnpm add @ggame/plugins
3. 编辑 package.json，在 dsh.profile.bundles 数组里追加 "@ggame/backpack" 和 "@ggame/quest"（保留原有项）
4. 编辑 cordis.patch.yml，在末尾追加：
   - id: backpack
     config: {}
   - id: quest
     config: {}
5. 执行 pnpm install
6. 重启 dsh web
```

> 只装背包：把第 2 步换成 `pnpm add @ggame/backpack`，第 3、4 步只追加 backpack；只装任务同理换成 `@ggame/quest`。

## 特性一览

**@ggame/backpack（背包）**
- 物品栏/袋子管理/虚空仓库、拖拽放置预览、Shift 批量多选、搜索（/ 快捷键）/过滤/排序、一键整理
- 右键「查看」详情：按内容自动渲染（链接卡片 / Markdown 富文本 / HTML 沙箱页面 / 纯文本）
- 全会话 token 费用记账（DeepSeek 官方动态定价 + 峰谷计价、旋转批次增量扫描）、悬浮金额卡片查看费用明细（近 7 天每日 + 每模型花费）、usageLog 归档、.bak 轮换备份
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
```

> 交互截图测试脚本（CDP 驱动，需本机 Chrome）位于仓库本地 `_shots/`（未入库，开发自用）。

## 许可

- 代码：MIT（仓库根与各包均含 LICENSE 文件）。
- 图标：`packages/*/icons/` 与 `packages/icons/` 为 AI 生成示例素材（豆包），**仅供个人使用与演示**；发布/商用前请替换为自有素材或确认素材许可（详见各包 README）。
