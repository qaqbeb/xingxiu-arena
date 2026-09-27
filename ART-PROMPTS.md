# 原创舰船贴图生成记录

开头为 v0.1–v0.2 历史生成记录；当前运行素材见后文 v0.3 新版章节。

以下 v0.1 记录保留作为历史；当前运行资源使用本文末尾的 v0.3 新版。

生成方式：内置 image_gen 工具，每艘单独一次请求，共四次；未使用 API CLI。原始 PNG 保留在 Codex generated_images 中，复制到项目后使用 macOS sips 等比缩放至 512 × 512，保留原始透明 alpha。舰首统一朝上，运行时按航向旋转。无文字、背景、投影或喷焰；喷焰由运行时绘制。

## 验证结果

四张均为 512 × 512、8-bit RGBA PNG；直接解码 PNG alpha 验证范围均为 0–255，确认真实透明而非棋盘格背景。总计 1,053,751 字节（约 1.00 MiB）。

| 文件 | 字节 | 完全透明像素 |
| --- | ---: | ---: |
| miniprogram/assets/ships/xia.png | 187989 | 76.6% |
| miniprogram/assets/ships/xie.png | 392445 | 42.0% |
| miniprogram/assets/ships/tian.png | 179168 | 75.4% |
| miniprogram/assets/ships/shen.png | 294149 | 62.2% |

## 精确提示词

### xia.png — 虾兵级 赤螯

```text
Use case: stylized-concept. Asset type: production-ready top-down 2D spacecraft sprite for an original Chinese mythology space autobattler. A single complete ship, alone. Scene/backdrop: TRUE TRANSPARENT BACKGROUND with alpha, including empty hull gaps; no colored background, no checkerboard pixels. Style: exceptionally detailed physical hard-surface spacecraft miniature, realistic machined material texture, crisp panels, deep mechanical recesses, beautifully shaded volume, high-end game sprite; not flat vector, not cartoon. Composition: SQUARE canvas, strict TOP-DOWN ORTHOGRAPHIC camera, ship forward nose points straight UP, symmetric overall but nuanced industrial details, complete hull centered with its longest extent occupying 85% of canvas, safe transparent margin on every side. Neutral directional soft lighting for readable shaded depth. No perspective, no environment, no ground shadow, no stars, no text or labels or logos or watermark, no exhaust or glow outside hull. All lights restricted to hull. Original design, no existing franchise ships. Subject: Low-tech nimble frigate with elongated crustacean-inspired silhouette. Narrow segmented armored body, tapered forward nose, two substantial forward-facing cannons mounted along either side, small rear engine block. Weathered copper and rusty dark iron armor plating, industrial pipes and exposed mechanical joints, restrained burnt-orange paint on plates, contrasting silver worn edges. Visually agile and elongated, beautifully convincing used industrial machine, not a literal shrimp.
```

### xie.png — 蟹将级 玄甲

```text
Use case: stylized-concept. Asset type: production-ready top-down 2D spacecraft sprite for an original Chinese mythology space autobattler. A single complete ship, alone. Scene/backdrop: TRUE TRANSPARENT BACKGROUND with alpha, including empty hull gaps; no colored background, no checkerboard pixels. Style: exceptionally detailed physical hard-surface spacecraft miniature, realistic machined material texture, crisp panels, deep mechanical recesses, beautifully shaded volume, high-end game sprite; not flat vector, not cartoon. Composition: SQUARE canvas, strict TOP-DOWN ORTHOGRAPHIC camera, ship forward nose points straight UP, symmetric overall but nuanced industrial details, complete hull centered with its longest extent occupying 85% of canvas, safe transparent margin on every side. Neutral directional soft lighting for readable shaded depth. No perspective, no environment, no ground shadow, no stars, no text or labels or logos or watermark, no exhaust or glow outside hull. All lights restricted to hull. Original design, no existing franchise ships. Subject: Low-tech bulky broad crab-inspired combat hull. Wide low-profile armored body and two enormous front-side pincer-like artillery arms projecting upward, strong massive blackened gunmetal overlapping plates with bronze abrasion, recessed amber-orange lights, exposed thick recoil mechanisms. Compact stern engines, heavily armored spinal reactor, broad powerful silhouette distinct from an elongated frigate. Military spacecraft not a literal crab.
```

### tian.png — 天兵级 羽林

```text
Use case: stylized-concept. Asset type: production-ready top-down 2D spacecraft sprite for an original Chinese mythology space autobattler. A single complete ship, alone. Scene/backdrop: TRUE TRANSPARENT BACKGROUND with alpha, including empty hull gaps; no colored background, no checkerboard pixels. Style: exceptionally detailed physical hard-surface spacecraft miniature, realistic machined material texture, crisp panels, deep mechanical recesses, beautifully shaded volume, high-end game sprite; not flat vector, not cartoon. Composition: SQUARE canvas, strict TOP-DOWN ORTHOGRAPHIC camera, ship forward nose points straight UP, symmetric overall but nuanced industrial details, complete hull centered with its longest extent occupying 85% of canvas, safe transparent margin on every side. Neutral directional soft lighting for readable shaded depth. No perspective, no environment, no ground shadow, no stars, no text or labels or logos or watermark, no exhaust or glow outside hull. All lights restricted to hull. Original design, no existing franchise ships. Subject: Mid-tech precision military destroyer, elegant long arrowhead hull with layered feather-like wing planes, sleek coherent silhouette, long central spear bow, clearly visible inset gun turrets and engine machinery. Cold gray composite panels with exact seams, brushed steel edge strips, restrained brass-gold stripes and small restrained cyan inset lights. Clean manufactured precision with subtle wear, refined engineering visually between rugged industrial and exotic futuristic. Not a literal bird.
```

### shen.png — 星宿级 参水猿

```text
Use case: stylized-concept. Asset type: production-ready top-down 2D spacecraft sprite for an original Chinese mythology space autobattler. A single complete ship, alone. Scene/backdrop: TRUE TRANSPARENT BACKGROUND with alpha, including empty hull gaps; no colored background, no checkerboard pixels. Style: exceptionally detailed physical hard-surface spacecraft miniature, realistic machined material texture, crisp panels, deep mechanical recesses, beautifully shaded volume, high-end game sprite; not flat vector, not cartoon. Composition: SQUARE canvas, strict TOP-DOWN ORTHOGRAPHIC camera, ship forward nose points straight UP, symmetric overall but nuanced industrial details, complete hull centered with its longest extent occupying 85% of canvas, safe transparent margin on every side. Neutral directional soft lighting for readable shaded depth. No perspective, no environment, no ground shadow, no stars, no text or labels or logos or watermark, no exhaust or glow outside hull. All lights restricted to hull. Original design, no existing franchise ships. Subject: High-tech extraordinary curved fork-shaped catamaran hull: two slender curved prongs extending upward around a deep empty central channel, integrated rear connecting core in deep-blue glass, plus a split segmented levitating halo around rear sides. Teal-white porcelain armor, graphite mechanical undersides, deep blue glossy center, intricate luminous cyan circuits contained within hull. Graceful alien-level Chinese celestial engineering, highly sophisticated advanced materials. Clearly readable clean fork silhouette and separated halo segments. No animal face and no literal ape.
```


## v0.3 新版舰图与星云背景

来源：本次内置 image_gen 独立生成的原创资源。以下原始文件全部保留在 `/Users/shiwenjie/.codex/generated_images/01a0d815-616e-7202-8591-0ab2bcda04e8/`；运行文件只用 macOS `sips` 做等比缩放或编码，没有去背、重绘、裁切或复制原版游戏美术。

| 运行资源 | 原始文件 |
| --- | --- |
| ships/xia.png | exec-66df73a9-8832-400d-9d20-03da8b97bdf7.png |
| ships/tian.png | exec-d4caea43-9c45-4f4b-af21-932a7b37e383.png |
| ships/shen.png | exec-6a9529e7-d23e-4577-8e33-c7bd4a861cf3.png |
| ships/xie.png | exec-71bb1c1e-8429-47d3-9796-792971c3a206.png |
| backgrounds/nebula.jpg | exec-9884eaa2-9acb-4f08-a3ca-24edb67e2480.png |

### 提示词摘要

四舰均为原创、严格俯视、舰首朝上、完整舰身居中、真实透明背景的高细节硬表面舰船；明确舰尾喷口，喷焰交给运行时表现。赤螯采用磨损铜红狭长船体和五喷口；羽林采用冷灰白装甲、细金属识别线和三喷口；参水猿采用白瓷装甲、石墨机械骨架、青色内嵌细节及三喷口；玄甲采用宽厚黑铁金属装甲、暗金标识、重型炮塔和五喷口。星云背景为深色低对比中央战斗留白，蓝灰星云沿四周分布，稀疏小星点，无文字或界面。以上为新版生成意图摘要，不冒充逐字提示词记录。

### 尺寸、alpha 与包体积

四张原图都是 1254 × 1254 RGBA，逐像素读取 alpha 范围 0–255。舰体主体以 alpha ≥128 测量，边缘少量接近透明的采样像素不计入主体：赤螯 `(392,14)–(864,1224)`；羽林 `(346,13)–(908,1226)`；参水猿 `(239,10)–(1015,1236)`；玄甲 `(127,11)–(1128,1237)`。背景原图为 1672 × 941 RGB。

舰图用 `sips -Z 512` 保留 RGBA PNG；背景保留完整分辨率，以 JPEG quality 88 编码。运行文件再次检验 alpha 仍为 0–255。

| 运行资源 | 分辨率 | 字节 | 完全透明像素 |
| --- | --- | ---: | ---: |
| xia.png | 512 × 512 | 172,396 | 77.03% |
| tian.png | 512 × 512 | 170,203 | 74.95% |
| shen.png | 512 × 512 | 285,476 | 58.31% |
| xie.png | 512 × 512 | 367,174 | 43.79% |
| backgrounds/nebula.jpg | 1672 × 941 | 348,820 | 无 alpha（背景） |

本次校准完成时 `miniprogram/` 全部文件合计 **1,761,433 字节（1.68 MiB）**，低于 4 MB；包含舰图、星云背景、全部音效及代码。

### 喷口坐标与碰撞宽度校准

渲染器方形贴图边长为 `length × spriteScale`，当前四舰统一显式设置 `spriteScale = 1.04`，使原图 96.5–97.8% 高度对应约 1.00–1.02 倍物理舰长。使用原图像素喷口中心 `(u,v)`、画布尺寸 `1254`，映射到舰体 +X 朝前、+Y 为画面右侧：

`x = (0.5 - v/1254) × length × 1.04`

`y = (u/1254 - 0.5) × length × 1.04`

喷口宽度按同一缩放变换；火焰长度是独立美术表现值，不参与物理碰撞。喷口中心取可见尾部开口内部，保留贴图喷口唇边遮挡关系。

| 舰型 | 从左至右喷口中心（原图像素） | 喷口数 | 主体可见宽度 / 物理 width |
| --- | --- | ---: | --- |
| xia | (450,1153), (523,1143), (627,1195), (731,1143), (802,1153) | 5 | 39.1 / 40 |
| tian | (517,1195), (628,1213), (736,1195) | 3 | 69.9 / 70 |
| shen | (482,1200), (627,1201), (772,1200) | 3 | 90.1 / 90 |
| xie | (302,1170), (452,1190), (627,1205), (804,1190), (954,1170) | 5 | 199.2 / 200 |

物理舰长、速度、转向、装甲、幅能、武器参数与部署预算不变。仅收敛碰撞椭圆宽度至新版外形，避免窄舰看似未碰撞却过早挡弹，或宽舰可见外侧超出碰撞轮廓。


### 新版甲板武器位置校准

新版舰体较窄，旧版武器局部坐标可能落在透明区。因此将全部炮位中心按上述同一像素到舰体坐标公式，重新放到可见炮塔或实心甲板上；不改变炮位数量、尺寸、类型、默认武器、射界、固定/旋转方式、组别或预算。

赤螯两门连弩对应左右圆形炮塔，中央导弹位位于前部中轴武器平台。羽林主炮与能量炮对应前部成对武器台，后向近防位放在尾部中央实心甲板。参水猿两门中型武器对应外侧圆形平台，小型近防对应内侧机械台。玄甲主炮对应前部中央重型炮塔，两门近防位对应左右重型甲板武器平台，导弹位置于中央装甲段。

| 舰型 / 炮位 | 原图坐标 (u,v) | 舰体坐标 (x,y) |
| --- | --- | --- |
| xia / b1 | (512, 614) | (1.08, -9.54) |
| xia / b2 | (744, 614) | (1.08, 9.70) |
| xia / m1 | (627, 455) | (14.26, 0.00) |
| tian / b1 | (555, 425) | (25.13, -8.96) |
| tian / e1 | (697, 425) | (25.13, 8.71) |
| tian / b2 | (627, 935) | (-38.32, 0.00) |
| shen / e1 | (399, 573) | (6.27, -26.47) |
| shen / e2 | (855, 573) | (6.27, 26.47) |
| shen / e3 | (484, 468) | (18.46, -16.60) |
| shen / e4 | (769, 468) | (18.46, 16.49) |
| xie / b1 | (627, 383) | (48.57, 0.00) |
| xie / b2 | (406, 775) | (-29.46, -43.99) |
| xie / b3 | (854, 775) | (-29.46, 45.18) |
| xie / m1 | (627, 606) | (4.18, 0.00) |

表中均为武器旋转/发射原点，按当前贴图可见中心标定；喷口校准和物理舰宽保持不变。
