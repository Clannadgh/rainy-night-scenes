# 雨夜便利店 · Rainy Night Konbini

**1:80 收藏级微缩场景** —— 一个雨夜里的日式便利店街角，缩在方形展示底座上，
底座正面带有铭牌 `RAIN NIGHT CORNER · KONBINI 1:80`。

纯 **three.js r170** 实现，**全部代码压在一个 HTML 文件里**（1106 行：样式 + importmap + 场景），
适合直接分享或嵌入任意页面。

## 运行

直接用浏览器打开 `rainy-night-konbini.html` 即可（需要联网加载 three.js）。

```bash
# 或者起个本地服务器
python -m http.server 8000    # 然后访问 http://localhost:8000/rainy-night-konbini.html
```

依赖通过 importmap 从 jsDelivr 加载：

```html
<script type="importmap">
{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
}}
</script>
```

> 想完全离线运行，可以把 `three.module.js` 与 `examples/jsm/` 下载到本地并改写 importmap 路径。

## 操作

| 操作 | 效果 |
| --- | --- |
| 左键拖拽 | 环绕旋转 |
| 滚轮 / 双指 | 缩放 |
| 右键拖拽 / 双指拖动 | 平移 |

页面加载后播放约 8 秒的**入场组装动画**：底座 → 地面 → 路面标线 → 便利店 → 街道家具逐层落下就位。

## 场景内容

- **底座**：方形收藏底座 + 发光刻度盘 + 正面铭牌
- **地面**：沥青地块、纵横道路、人行道、路缘石、后巷
- **路面标线**：虚线、黄色实线、斑马线、停车位框线
- **便利店**：发光招牌、玻璃橱窗、雨棚、自动贩卖机
- **街道家具**：路灯、垃圾桶、雨伞架、自行车、护栏、公告栏
- **氛围**：夜间环境反射、ACES Filmic 色调映射（曝光 1.18）、雨丝、地面反射拖影
- **循环动画**：雨与灯光随时间循环（TIMELINE / LOOP）

## 代码结构

单文件内按注释分块：

| 区块 | 说明 |
| --- | --- |
| `renderer / scene / camera` | 渲染器、场景、相机 |
| `environment reflections` | 环境反射贴图 |
| `lights` | 灯光布置 |
| `materials & helpers` | 材质与建模辅助函数 |
| `assembly animation registry` | 组装动画登记表（`act()`） |
| `reflection smear helper` | 招牌与道具的反射拖影 |
| `BASE` / `GROUND` / `ROAD MARKINGS` / `VENDING MACHINES` / `STREET FURNITURE` | 场景各部分 |
| `TIMELINE / LOOP` | 入场时间轴与循环 |

## 关联项目

- [`../minmax/`](../minmax/) —— 同题材的**多文件 + 完全离线**版本（three.js r128）
- [`../jm/`](../jm/) —— 同题材的**工程化 + 完整室内**版本（three.js r169 + esbuild）
