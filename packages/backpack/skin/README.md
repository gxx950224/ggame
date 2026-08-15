# ggame 皮肤目录

把 DSH 网页背景图放到本目录，命名为 **`ggame-bg.png`**（也支持 `ggame-bg.jpg` / `ggame-bg.jpeg` / `ggame-bg.webp`）。

- **随整合包发布**：整合包（@ggame/plugins）发布时自带这张图，下载整合包的用户开箱即用——DSH 网页自动以该图为背景（叠加半透明暗色遮罩，保证可读性）。
- **单体安装**：单独安装 `@ggame/backpack` 或 `@ggame/quest` 时，本目录不含图片（或为空），**不会**出现背景图，保持默认深色主题。
- **自定义**：若想换图，直接替换本文件（同名）或修改 `backgroundImage` 配置。

推荐尺寸：16:9 横版，1920×1080 或更高；画面主体靠边、中央留白，避免干扰阅读。

> 背景图提示词见 `docs/skin-prompt.md`（用豆包等 AI 生成后命名为 `ggame-bg.png` 放入本目录）。
