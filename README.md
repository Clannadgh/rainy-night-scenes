# 雨夜便利店 · Rainy Night Scenes

三个「雨夜日式便利店街角」主题的 **three.js 实时三维微缩场景**合集。全部为纯前端 WebGL 实现，
可拖拽 / 旋转 / 缩放自由观察，不需要后端、不需要构建服务器也能直接跑。

| 目录 | 项目 | 技术栈 | 入口 | 外部依赖 |
| --- | --- | --- | --- | --- |
| [`minmax/`](minmax/) | 雨夜便利店街角 · Rainy Night Corner Store | three.js r128 | `minmax/index.html` | 无（three.js 已本地化到 `vendor/`） |
| [`glm/`](glm/) | 雨夜便利店 · Rainy Night Konbini | three.js r170 | `glm/rainy-night-konbini.html` | CDN（jsDelivr importmap） |
| [`jm/`](jm/) | 月見マート · TSUKIMI MART | three.js r169 + esbuild | `jm/index.html` | 无（已打包为单文件） |

三者是同一题材下的三次迭代：从**可离线单页**（minmax）→ **单文件 CDN 版**（glm）→
**带构建流程与完整室内场景**（jm）。

## 快速开始

```bash
# 1) minmax —— 直接双击 minmax/index.html 即可，全部依赖已本地化
#    需要起服务器时：
cd minmax && python -m http.server 8000

# 2) glm —— 需要联网加载 three.js，直接用浏览器打开
#    glm/rainy-night-konbini.html

# 3) jm —— 打开构建产物 jm/index.html（单文件，已内联压缩）
#    需要改源码时：
cd jm && npm install && npm run build
```

## 三个项目

### `minmax/` — 雨夜便利店街角（three.js r128）

带完整街区的微缩模型：便利店主体（发光招牌、感应门、条纹雨棚）、室内货架与收银台、
自动贩卖机、自行车、雨伞架、路灯、电线杆、悬垂电线、护栏、积水路面镜面反射、
反光斑马线、盲道、行道树等。加载后播放约 6 秒的**入场组装动画**（自底座逐层生长 + 镜头推入）。

依赖 three.js r128 已本地化到 `vendor/`，**双击 `index.html` 即可离线运行**。
`tools/` 下是开发用工具：无头截图（Playwright）、场景自检、PNG 取色。

📖 详细说明见 [`minmax/README.md`](minmax/README.md)。

### `glm/` — 雨夜便利店（three.js r170）

单文件实现（1106 行），一个 HTML 里同时包含样式、importmap 与整个场景。
通过 jsDelivr 加载 three.js r170，适合快速分享或嵌入其他页面。

📖 详细说明见 [`glm/README.md`](glm/README.md)。

### `jm/` — 月見マート（three.js r169 + esbuild）

工程化版本：`src/main.js`（5571 行）用 esbuild 打包成 `dist/app.js`，
再由 `build.mjs` 内联生成单文件 `index.html`。场景在 minmax 的基础上补全了室内空间，
并加入 Bloom / 色调映射后期链、反射地面、可调曝光与相机参数。

`qa/` 保留了全部调试脚本（截图、取参、曝光扫描、帧率测试等），中间截图未纳入版本库。

📖 详细说明见 [`jm/README.md`](jm/README.md)。

## 目录结构

```
rainy-night-scenes/
├── README.md            # 本文件
├── .gitignore
├── minmax/              # 项目一：three.js r128，本地化依赖，离线可跑
│   ├── index.html
│   ├── js/              # main / world / shop / props / rain / lib
│   ├── vendor/          # 本地化的 three.js r128 与后期处理
│   ├── tools/           # 无头截图 / 场景自检 / PNG 取色
│   ├── output/          # 预览渲染图
│   └── README.md
├── glm/                 # 项目二：three.js r170，单文件 + CDN
│   ├── rainy-night-konbini.html
│   └── README.md
└── jm/                  # 项目三：three.js r169 + esbuild 构建
    ├── index.html       # 构建产物（单文件）
    ├── dev.html         # 开发页（引用 dist/app.js）
    ├── build.mjs        # esbuild 构建脚本
    ├── src/main.js
    ├── dist/app.js
    ├── qa/              # 调试脚本
    └── README.md
```

## License

三个子项目均为原创代码，MIT License。
其中 three.js 版权归 three.js 作者所有（MIT），`minmax/vendor/` 下为官方发行文件的本地副本。
