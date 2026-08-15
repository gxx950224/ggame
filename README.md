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

## 开发

```bash
pnpm install   # 安装 workspace 依赖
pnpm build     # 构建各包客户端 bundle
pnpm test      # 运行全部单测
pnpm check     # 语法检查
```

## 许可

MIT。图标为示例素材，发布/商用前请替换（见各包 README）。
