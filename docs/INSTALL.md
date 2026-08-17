# ggame 插件安装指南

在**另一台电脑**上安装 ggame 整合包或单体插件。前提：该电脑已安装 DeepSeek Harness（`dsh`）并初始化过 **web profile**（即存在 `~/.dsh/profiles/web` 目录）。

## 方式一：npm 安装（推荐，正式发布版）

### 整合包（背包 + 任务全部）

```bash
# 1. 进入 web profile 目录
cd ~/.dsh/profiles/web

# 2. 安装整合包（会带上 backpack / quest / ui-core / icons）
pnpm add @ggame/plugins
```

### 单体插件（只装其中一个）

```bash
cd ~/.dsh/profiles/web
pnpm add @ggame/backpack        # 只要背包
# 或
pnpm add @ggame/quest           # 只要任务
```

### 3. 注册 bundle（无论整合包还是单体都要做）

编辑 `~/.dsh/profiles/web/package.json`，在 `dsh.profile.bundles` 数组里追加要用的插件：

```json
{
  "dependencies": {
    "@ggame/backpack": "^1.0.0",
    "@ggame/quest": "^1.0.0"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@ggame/backpack",
        "@ggame/quest"
      ]
    }
  }
}
```

### 4. 追加挂载配置

编辑 `~/.dsh/profiles/web/cordis.patch.yml`，追加：

```yaml
- id: backpack
  config: {}
- id: quest
  config: {}
```

### 5. 安装并重启

```bash
pnpm install
dsh web        # 或重启已有的 dsh web
```

浏览器打开后，右下角出现 🎒 背包按钮和 📜 任务按钮即安装成功。

## 方式二：从 GitHub 源码安装（开发版）

```bash
git clone https://github.com/gxx950224/ggame.git
# 把 packages/backpack、packages/quest 复制到 profile 的 packages/ 目录
cp -r ggame/packages/backpack ggame/packages/quest ~/.dsh/profiles/web/packages/
```

然后在 profile 里按 workspace 方式注册（`pnpm-workspace.yaml` 加 `packages/*`，`dependencies` 用 `"@ggame/backpack": "workspace:*"`），其余步骤同方式一的 3~5。

> 单体仓库：https://github.com/gxx950224/backpack 、https://github.com/gxx950224/quest

## 升级

`@ggame/plugins` 是聚合包，子包更新时会同步发布新版本并抬高依赖。升级时建议三个包一起显式更新：

```bash
cd ~/.dsh/profiles/web
pnpm add @ggame/plugins@latest @ggame/backpack@latest @ggame/quest@latest
pnpm install
```

**建议把子包写为显式依赖**（你实际注册 bundle 的就是它们），并固定具体版本：

```json
"dependencies": {
  "@ggame/plugins": "1.0.3",
  "@ggame/backpack": "1.0.2",
  "@ggame/quest": "1.0.1"
}
```

> 原因：只依赖聚合包时，pnpm 对子包版本的解析受 lockfile 与解析策略影响，`pnpm update --latest` 不一定自动追到最新子包；显式列出 + 固定版本最稳。

## 配置项

- **背包**：`cordis.patch.yml` 的 backpack `config` 支持 `autoScan`（默认 true，定时扫描会话记账）、`scanIntervalSec`（默认 60）、`peakPricing`（默认 true，峰谷计价）、`prices`/`modelPrices`（按模型定价）。
- **任务**：`statePath` 可改状态文件路径（默认 `~/.dsh/quest-state.json`）。

## 卸载

```bash
cd ~/.dsh/profiles/web
pnpm remove @ggame/backpack @ggame/quest
# 并从 package.json 的 bundles 与 cordis.patch.yml 中删除对应行
```
