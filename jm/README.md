# 月見マート · TSUKIMI MART

**雨夜の街角** —— 一个雨夜里的日式便利店街角微缩场景。

three.js r169 + esbuild 工程化版本：源码在 `src/main.js`（5571 行），
打包为 `dist/app.js`，再由 `build.mjs` 内联生成**单文件** `index.html`。

在 `minmax` 的街区基础上补全了**店内空间**（货架、收银台、后场、门口细节），
并加入完整的**后期处理链**（Bloom / 色调映射）与**反射地面**。

![预览](preview.png)

## 运行

直接打开构建产物 `index.html`（单文件，无需服务器、无需联网）。

```bash
npm install
npm run build     # 产出 dist/app.js + dev.html + index.html
```

| 产物 | 用途 |
| --- | --- |
| `index.html` | 发布用单文件（脚本已压缩内联，约 860 KB） |
| `dev.html` | 开发用页面，引用未压缩的 `dist/app.js`，便于断点调试 |
| `dist/app.js` | esbuild 打包产物（IIFE，未压缩） |

`build.mjs` 里可以用 URL 参数跳过入场动画：`index.html?skipIntro`。
系统开启了「减少动态效果」时也会自动跳过。

## 操作

| 操作 | 效果 |
| --- | --- |
| 左键拖拽 | 环绕旋转 |
| 滚轮 / 双指 | 缩放 |
| 右键拖拽 / 双指拖动 | 平移 |

## 场景内容

按 `src/main.js` 中的分块注释：

| 区块 | 内容 |
| --- | --- |
| `the plinth` | 展示底座 |
| `wet asphalt` | 湿沥青地面 |
| `road paint` | 路面标线 |
| `the convenience store` | 便利店主体 |
| `store interior` / `convenience-store dressing pass` | 店内货架、商品、收银台、后场、门口细节、时钟与门帘 |
| `signs & canopy` | 招牌与雨棚 |
| `rooftop plant` | 屋顶设备 |
| `second-floor apartments` | 二层住户 |
| `street lamp` / `telephone pole` / `overhead wires` / `guardrails` | 街道设施 |
| `the glowing vending machine` / `recycling station` / `umbrella stand` / `bicycle` | 街边道具 |
| `a cat, waiting out the rain` | 躲雨的猫 |
| `the alley & the old neighbour` | 后巷与老邻居 |
| `rain` / `rain rings` / `puddle glints` / `coloured light pools` | 雨、涟漪、积水反光、湿地彩色光斑 |
| `post processing` | Bloom / 色调映射等后期链 |
| `intro assembly` | 入场组装动画 |

## qa/ 调试工具

`qa/` 下保留了全部开发期调试脚本（Playwright 驱动）：

| 脚本 | 用途 |
| --- | --- |
| `shot.cjs` / `final_capture.cjs` | 无头浏览器截图 |
| `inspect.cjs` / `inspect_interior.cjs` | 场景对象自检 |
| `exposure.js` / `tonemap.js` | 曝光与色调映射调试 |
| `def_sweep.cjs` / `comp_sweep.cjs` / `front_sweep.cjs` / `window_sweep.cjs` | 相机机位扫描 |
| `fps_lights.cjs` / `fps_scale.cjs` / `perf.js` | 帧率与性能测试 |
| `eval_refl.js` / `fill.js` / `warm.js` / `interact.cjs` | 反射、补光、预热、交互测试 |

> 脚本产出的中间截图（`qa/*.png`）体积很大（约 220 MB），已通过 `.gitignore` 排除，不入库。

## 关联项目

- [`../minmax/`](../minmax/) —— 同题材的**多文件 + 完全离线**版本（three.js r128）
- [`../glm/`](../glm/) —— 同题材的**单文件 + CDN** 版本（three.js r170）
