# @ggame/skin

ggame 整合包的**皮肤资源包**：存放 DSH 网页背景图。

- 背景图固定命名为 **`ggame-bg.png`**（也支持 `ggame-bg.jpg` / `ggame-bg.jpeg` / `ggame-bg.webp`）。
- **整合包安装**：`@ggame/backpack` 会自动检测同级的本目录（`packages/skin`），存在背景图则 DSH 网页自动应用（叠加半透明暗色遮罩保证可读性），开箱即用。
- **单体安装**：只装 `@ggame/backpack` / `@ggame/quest` 时没有本目录 → 无背景图，保持默认深色主题。
- **换图**：直接替换 `ggame-bg.png` 同名文件（推荐 16:9 横版、1920×1080+、主体靠边、中央留白）。

> 背景图提示词见 `docs/skin-prompt.md`（用豆包等 AI 生成后命名为 `ggame-bg.png` 放入本目录）。
