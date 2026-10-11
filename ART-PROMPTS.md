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


## 2026-10-11 · v0.6 八舰正式图生成与部分交付

使用内置 `image_gen` 逐艘单独生成，共15张；先哨戟、负岳，再铁鳌、镇岳、凌霄、心月狐、奎木狼、亢金龙。原图目录：`/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/`。开工前已查看 xia、xie、tian、shen 四张基准。以下为提示词摘要，不冒充逐字提示词。

共同要求：原创、严格正交俯视、舰艏朝上、镜像轮廓、真透明正方形RGBA，顶部偏左柔光、真实金属陶瓷硬表面，无文字/喷焰/外部投影；指定炮座数量、百分比位置和直径。未做去背、裁切、拼接、重绘等后期修补。仅校准工具等比缩到512并写入几何。

### 已安装原图与校验

| 舰船 | 原图 | 占高 | 镜像轮廓重合 | 运行PNG字节 |
| --- | --- | ---: | ---: | ---: |
| shaoji | `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-5dbb3f76-f6aa-4534-aad4-11af6c41c98e.png` | 97.45% | 99.82% | 154,435 |
| zhenyue | `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-066e5bfd-e09e-4e15-8872-10d80d41eac7.png` | 95.45% | 99.19% | 200,517 |
| xinyue | `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-6c345ae0-3d37-4471-8ac1-879a32cf2648.png` | 96.97% | 99.09% | 142,999 |
| kuimu | `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-86a8f4fe-5b71-4a2c-9f24-9757e5e9f780.png` | 98.25% | 99.15% | 259,609 |

以上原图均1254×1254 RGBA，已安装四舰校准无PROBLEM，并逐张打开 `tools/preview/<id>-check.png` 确认十字圈居中、橙色椭圆套住喷口。奎木狼依据初版预览缩小喷口宽度并重跑。

### 提示词摘要与像素坐标

坐标均为原图像素，左上角为原点；炮位 `(u,v)`，喷口 `(u,v,width)`。喷焰长度沿用工具默认5倍喷口宽度。

#### shaoji

灰白短戟护卫，细金线，后三分之一后掠翼，三座武器基座，三喷口。

| 炮位编号 | 原图中心(u,v) |
| --- | --- |
| b1 | (507,625) |
| e1 | (747,625) |
| m1 | (627,460) |

| 喷口（左至右） | 原图中心与宽度(u,v,width) |
| --- | --- |
| 1 | (528,1170,66) |
| 2 | (627,1207,84) |
| 3 | (727,1170,66) |

复现命令：

```sh
python3 tools/calibrate_ship.py shaoji --image /Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-5dbb3f76-f6aa-4534-aad4-11af6c41c98e.png --mounts "b1:507,625; e1:747,625; m1:627,460" --engines "528,1170,66; 627,1207,84; 727,1170,66"
```

#### zhenyue

灰白模块化十字巡洋舰，中央武器甲板与桁架外挂舱，九武器位、五喷口。重生成修正导弹舱位置。

| 炮位编号 | 原图中心(u,v) |
| --- | --- |
| b1 | (534,446) |
| e1 | (720,446) |
| b2 | (388,660) |
| b3 | (866,660) |
| m1 | (322,1090) |
| m2 | (932,1090) |
| e2 | (495,696) |
| e3 | (759,696) |
| b4 | (627,894) |

| 喷口（左至右） | 原图中心与宽度(u,v,width) |
| --- | --- |
| 1 | (318,1180,82) |
| 2 | (523,1180,82) |
| 3 | (627,1196,86) |
| 4 | (731,1180,82) |
| 5 | (936,1180,82) |

复现命令：

```sh
python3 tools/calibrate_ship.py zhenyue --image /Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-066e5bfd-e09e-4e15-8872-10d80d41eac7.png --mounts "b1:534,446; e1:720,446; b2:388,660; b3:866,660; m1:322,1090; m2:932,1090; e2:495,696; e3:759,696; b4:627,894" --engines "318,1180,82; 523,1180,82; 627,1196,86; 731,1180,82; 936,1180,82"
```

#### xinyue

白瓷石墨针形护卫，狐尾弧翼、青色细线，两半球炮座及前部镜面发射口。重生成改为两个横向尾部喷口。

| 炮位编号 | 原图中心(u,v) |
| --- | --- |
| e1 | (531,602) |
| e2 | (723,602) |
| e3 | (627,279) |

| 喷口（左至右） | 原图中心与宽度(u,v,width) |
| --- | --- |
| 1 | (590,1153,50) |
| 2 | (664,1153,50) |

复现命令：

```sh
python3 tools/calibrate_ship.py xinyue --image /Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-6c345ae0-3d37-4471-8ac1-879a32cf2648.png --mounts "e1:531,602; e2:723,602; e3:627,279" --engines "590,1153,50; 664,1153,50"
```

#### kuimu

白瓷狼首巡洋，巨大后掠弧翼和石墨骨架，青色导管，六圆形炮座加两斜切导弹口、五喷口。重生成将前主炮向外移。

| 炮位编号 | 原图中心(u,v) |
| --- | --- |
| e1 | (453,562) |
| e2 | (801,562) |
| e3 | (226,782) |
| e4 | (1028,782) |
| m1 | (513,800) |
| m2 | (741,800) |
| e5 | (526,464) |
| e6 | (728,464) |

| 喷口（左至右） | 原图中心与宽度(u,v,width) |
| --- | --- |
| 1 | (201,1006,60) |
| 2 | (469,1046,70) |
| 3 | (627,1046,74) |
| 4 | (785,1046,70) |
| 5 | (1053,1006,60) |

复现命令：

```sh
python3 tools/calibrate_ship.py kuimu --image /Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-86a8f4fe-5b71-4a2c-9f24-9757e5e9f780.png --mounts "e1:453,562; e2:801,562; e3:226,782; e4:1028,782; m1:513,800; m2:741,800; e5:526,464; e6:728,464" --engines "201,1006,60; 469,1046,70; 627,1046,74; 785,1046,70; 1053,1006,60"
```

### 首轮旧规则下的暂缓记录（已由下文新规则补交取代）

**fuyue**：黑铁暗金整体巨龟盾形主力，碑脊、十一炮位、五喷口。 首版外侧近防炮座约27%/73%，超出15%/86%建议范围±6%；第二版多出两座圆形炮座。未安装。 原占位图及该舰几何保留，没有为不合格图伪造坐标表。
- `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-df33f41c-0bce-4022-a3af-278d1690ebec.png`
- `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-360b17a5-22f3-4c79-990f-44daa6088204.png`
**tieao**：铜红黑铁龟甲炮舰，钝楔撞角、六边形背甲、五炮位、三喷口。 首版1024×1536且有背景；第二版额外六座侧炮，固定炮方向也错误。未安装。 原占位图及该舰几何保留，没有为不合格图伪造坐标表。
- `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-9f38a443-c5b9-4f2e-ba0e-fd4448bdaad2.png`
- `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-afde718c-196c-419a-be0a-3ff35ed4a8a3.png`
**lingxiao**：灰白细金旗舰，阶梯指挥建筑，七炮位、3×3垂发阵列、五喷口，密集小面板。 两版炮座均有超出建议±6%的偏移，第二版侧炮约80%纵向，要求66%±6%。未安装。 原占位图及该舰几何保留，没有为不合格图伪造坐标表。
- `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-ca754dac-2087-4dbd-bd39-d58847a7a0f6.png`
- `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-0bd74f76-fcb4-42fd-b630-5243629f8c9e.png`
**kangjin**：白瓷金线龙脊双角主力，每侧两层弧翼，十二武器位、七喷口。 首版占高99.28%，超过任务书99%上限（工具容许到99.5%，此处以任务书为准）；第二版少两座中型炮位，中央喷口纵向，占高93.70%不足94%。未安装。 原占位图及该舰几何保留，没有为不合格图伪造坐标表。
- `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-9ef16d31-9054-4ab7-94d0-04691036f51b.png`
- `/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-df5c20d7-e124-44d6-8874-3994579dccf1.png`

成功舰的弃用首版：镇岳 `exec-a208ba23-3dba-4b3b-b890-dad0a2144ff1.png`（导弹位偏前）；心月狐 `exec-9dda160a-e2c1-4d16-a446-aec98e82dc57.png`（纵向喷口）；奎木狼 `exec-19d1b755-05ad-4104-ad3e-3d5398f329ad.png`（主炮偏内）。均位于上述原图目录。

### 首轮测试与验收限制（历史状态，当前结果见下文）

`npm test`：114/114通过，0失败；日志 `tools/preview/codex-test.log`。首次113通过/1失败，原断言要求所有船至少3喷口，与任务书允许心月狐2喷口冲突；仅将 `tests/combat.test.js` 此断言对xinyue放宽到2，其余船仍至少3，没有改变舰船数值或武器。

`miniprogram/assets/ships2/` 合计1,943,423字节，低于3.2MB。`tools/preview/codex-image-metrics.json` 记录全部原图技术检测。

已生成并目检 `tools/preview/codex-silhouettes.png`（12舰同尺寸剪影）与 `tools/preview/codex-families.png`（按科技线/等级排列）；这些仅为检查图，不改变资源。四艘新图各有独立轮廓，中/高科技材质接近基准；心月狐和奎木狼翼展较建议宽，工具分别重算width为58、187，建议人工审美确认。四艘仍是占位，故全舰正式美术及主力舰细节密度验收未完成。

`npm run preview` 因沙箱拒绝监听127.0.0.1:8765（PermissionError: Operation not permitted）无法启动，未完成选船/配装/试炼场开火与战术缩放的游戏内动态目检；不可将静态预览等同于此项验收。

未运行kitbash脚本、未修改ships.js或原四图、未做武器图标、未git commit。进度见 `tools/preview/codex-progress.md`。

## 2026-10-11 · 新规则复核：剩余四舰全部安装

依据修订后的第4节表格说明和第5节第4步：建议位置仅作参考，多余炮座可作装饰，固定武器可对应前部开阔的炮塔基座，贴边可使用`--fit`。本轮复用用户指定的四张内置image_gen原图，无重新生成。此前四舰保留占位的结论已被本节取代；shaoji、zhenyue、xinyue、kuimu已获用户验收，本轮不改其图片、预览或几何。

所有坐标均按1254×1254原图量取，原点左上，u向右、v向下；左右配对围绕u=627镜像。喷口记录(u,v,width)，默认火焰长度为宽度5倍。炮位编号按任务书逐项对应，没有增减游戏武器位。

### fuyue

原图：`/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-df33f41c-0bce-4022-a3af-278d1690ebec.png`

提示词摘要与炮座对应：黑铁暗金整体巨龟盾形主力、中央碑脊、密集金属面板。左右最大炮座对应b1/b2，中轴鱼雷井m1，双联导弹箱m2/m3；后内侧中炮b3/b4，前内侧小炮b5/b6，后外侧小炮b7/b8。

结果：已安装，11炮位、5喷口，校准无`PROBLEM`。已打开`tools/preview/fuyue-check.png`确认全部十字圈在对应炮座中心，橙色椭圆套住喷口。512×512运行图348,299字节，占高98.83%。

| 炮位编号 | 原图中心(u,v) |
| --- | --- |
| b1 | (399,590) |
| b2 | (855,590) |
| m1 | (627,426) |
| m2 | (423,754) |
| m3 | (831,754) |
| b3 | (517,855) |
| b4 | (737,855) |
| b5 | (531,539) |
| b6 | (723,539) |
| b7 | (336,865) |
| b8 | (918,865) |

| 喷口（左至右） | 原图(u,v,width) |
| --- | --- |
| 1 | (344,1184,82) |
| 2 | (469,1185,96) |
| 3 | (627,1180,116) |
| 4 | (785,1185,96) |
| 5 | (910,1184,82) |

```sh
python3 tools/calibrate_ship.py fuyue --image /Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-df33f41c-0bce-4022-a3af-278d1690ebec.png --mounts "b1:399,590; b2:855,590; m1:627,426; m2:423,754; m3:831,754; b3:517,855; b4:737,855; b5:531,539; b6:723,539; b7:336,865; b8:918,865" --engines "344,1184,82; 469,1185,96; 627,1180,116; 785,1185,96; 910,1184,82"
```

### tieao

原图：`/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-afde718c-196c-419a-be0a-3ff35ed4a8a3.png`

提示词摘要与炮座对应：铜红六边形龟甲炮舰、黑铁机械骨架、四联发射口。两座大炮塔基座b1/b2，四联开口整体中心m1，后部左右小炮座b3/b4；舷侧额外炮架仅为装饰。

结果：已安装，5炮位、3喷口，校准无`PROBLEM`。已打开`tools/preview/tieao-check.png`确认全部十字圈在对应炮座中心，橙色椭圆套住喷口。512×512运行图365,056字节，占高97.85%。

| 炮位编号 | 原图中心(u,v) |
| --- | --- |
| b1 | (454,599) |
| b2 | (800,599) |
| m1 | (627,365) |
| b3 | (300,862) |
| b4 | (954,862) |

| 喷口（左至右） | 原图(u,v,width) |
| --- | --- |
| 1 | (419,1180,96) |
| 2 | (627,1186,126) |
| 3 | (835,1180,96) |

```sh
python3 tools/calibrate_ship.py tieao --image /Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-afde718c-196c-419a-be0a-3ff35ed4a8a3.png --mounts "b1:454,599; b2:800,599; m1:627,365; b3:300,862; b4:954,862" --engines "419,1180,96; 627,1186,126; 835,1180,96"
```

### lingxiao

原图：`/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-0bd74f76-fcb4-42fd-b630-5243629f8c9e.png`

提示词摘要与炮座对应：灰白细金旗舰、长楔形舰艏、阶梯指挥建筑。最大前部中轴炮座b1，舰艏成对中炮b2/e1，中央3×3垂发阵列m1，后两舷中炮b3/b4，后中轴中炮e2。

结果：已安装，7炮位、5喷口，校准无`PROBLEM`。已打开`tools/preview/lingxiao-check.png`确认全部十字圈在对应炮座中心，橙色椭圆套住喷口。512×512运行图255,898字节，占高97.07%。

| 炮位编号 | 原图中心(u,v) |
| --- | --- |
| b1 | (627,436) |
| b2 | (559,261) |
| e1 | (695,261) |
| m1 | (627,625) |
| b3 | (372,1001) |
| b4 | (882,1001) |
| e2 | (627,892) |

| 喷口（左至右） | 原图(u,v,width) |
| --- | --- |
| 1 | (442,1208,64) |
| 2 | (534,1208,64) |
| 3 | (627,1208,64) |
| 4 | (720,1208,64) |
| 5 | (812,1208,64) |

```sh
python3 tools/calibrate_ship.py lingxiao --image /Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-0bd74f76-fcb4-42fd-b630-5243629f8c9e.png --mounts "b1:627,436; b2:559,261; e1:695,261; m1:627,625; b3:372,1001; b4:882,1001; e2:627,892" --engines "442,1208,64; 534,1208,64; 627,1208,64; 720,1208,64; 812,1208,64"
```

### kangjin

原图：`/Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-9ef16d31-9054-4ab7-94d0-04691036f51b.png`

提示词摘要与炮座对应：白瓷金线龙脊主力、双角和分层弧翼、青色导管。最大成对聚焦环e1/e2，前内侧中炮e3/e4，蜂巢导弹井m1/m2，外翼中炮e5/e6，四小炮按左外/左内/右内/右外对应e7/e8/e9/e10。

结果：已安装，12炮位、7喷口，校准无`PROBLEM`。已打开`tools/preview/kangjin-check.png`确认全部十字圈在对应炮座中心，橙色椭圆套住喷口。512×512运行图317,769字节，占高96.88%。

| 炮位编号 | 原图中心(u,v) |
| --- | --- |
| e1 | (465,501) |
| e2 | (789,501) |
| e3 | (531,386) |
| e4 | (723,386) |
| m1 | (542,827) |
| m2 | (712,827) |
| e5 | (278,771) |
| e6 | (976,771) |
| e7 | (358,698) |
| e8 | (497,714) |
| e9 | (757,714) |
| e10 | (896,698) |

| 喷口（左至右） | 原图(u,v,width) |
| --- | --- |
| 1 | (342,1184,40) |
| 2 | (400,1171,40) |
| 3 | (484,1164,78) |
| 4 | (627,1165,84) |
| 5 | (770,1164,78) |
| 6 | (854,1171,40) |
| 7 | (912,1184,40) |

亢金龙按用户要求使用`--fit`，工具将舰体等比缩放并居中到约97%；上述坐标与宽度仍为原图值，变换由工具处理，没有手工改几何或原图。

```sh
python3 tools/calibrate_ship.py kangjin --fit --image /Users/shiwenjie/.codex/generated_images/01a12ae2-1502-7aa3-a018-81e36f876313/exec-9ef16d31-9054-4ab7-94d0-04691036f51b.png --mounts "e1:465,501; e2:789,501; e3:531,386; e4:723,386; m1:542,827; m2:712,827; e5:278,771; e6:976,771; e7:358,698; e8:497,714; e9:757,714; e10:896,698" --engines "342,1184,40; 400,1171,40; 484,1164,78; 627,1165,84; 770,1164,78; 854,1171,40; 912,1184,40"
```

### 本轮验证

- `npm test`：114/114通过，0失败；日志`tools/preview/codex-test.log`。本轮未修改测试。
- 全部8张正式舰图现已安装，`ships2`合计2,044,637字节，低于3.2MB；单图均低于420KB。
- 哈希和几何对象比较确认：已验收四舰的PNG、check预览和几何保持不变；原四张舰图和ships.js保持不变。
- 未运行kitbash、未修改舰船数值、未git commit。
- 本轮完成四舰静态校准及叠加预览；没有补做游戏内动态目检，上一轮记录的沙箱端口限制仍属未验证项。


## 2026-10-11 · 28 件武器图标（Codex / 内置 image_gen）

生成方式：使用内置 `image_gen`，逐件单独调用，`transparent_background=true`；先制作 chuanyun、fuling、jiuxiao 并检查总览，再制作其余。开工前目检 ships/tian.png、ships/shen.png、ships2/kangjin.png、ships2/lingxiao.png 作为风格基准。共生成 35 张候选图，最终采用 28 张。未使用拼装舰图脚本。

统一提示词摘要：原创硬表面实体武器模型；正方形 RGBA、真透明背景；正交正俯视，前端和炮口朝画面上方，炮管平行画面；左右对称、居中、清晰轮廓；左上柔光、凹槽深阴影、适量磨损；仅武器和旋转基座，不画舰体甲板、文字、数字、边框、投影、火焰、弹道或发光特效。实弹用铁灰黑钢与铜件；能量用白瓷、石墨及不发光青紫镜面；导弹用冷灰装甲和红橙弹头。

小型强调单一紧凑模块；中型强调宽基座和炮盾/侧箱；大型强调多层结构。逐张目检后使用 `python3 tools/install_weapon_art.py <id> --image <原图>` 安装为 192×192。每约三件运行 `--sheet` 并查看，最终另检查约 40 像素缩略图。

| id | 名称 / 尺寸 | 单件提示词摘要 | 最终原图路径 |
|---|---|---|---|
| `chuanyun` | 穿云连弩 / 小 | 双联细长炮管并列，后部一个小弹鼓。速射机炮的感觉 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-1d5d89a9-1531-47c6-b3a8-c0d30708b617.png` |
| `suixing` | 碎星霰炮 / 小 | 三根短粗炮管呈品字或一排，喇叭形炮口。近防霰弹炮 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-9e946174-be2b-4be0-9578-d38d122866b1.png` |
| `poyue` | 破岳短炮 / 小 | 单根粗短的大口径炮管，厚炮盾。短管迫击炮的感觉 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-cb2c52aa-9889-4112-b759-26213bd4dfd7.png` |
| `bengshan` | 崩山炮 / 中 | 单根长重炮管，带炮口制退器和方形炮盾 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-6228f987-132b-4dae-ab98-7368f4783a5a.png` |
| `liexing` | 裂星机炮 / 中 | 四管并列的转管或排管机炮，两侧弹链箱 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-67c7fde2-5d6d-4c64-beef-6b925d921efd.png` |
| `tiansan` | 天散霰阵 / 中 | 2×4 的短管方阵嵌在一个宽扁箱体里。防空霰弹阵 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-ba1df24f-feab-4507-b282-29724a831258.png` |
| `zhenhai` | 镇海重炮 / 大 | 双联巨型炮管，厚重的多边形炮塔，炮塔顶有测距仪 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-efcae38b-6c48-4766-945e-f1a52e4c9289.png` |
| `guanri` | 贯日弩炮 / 大 | 单根极长的轨道炮管，两侧夹着弩臂状的加速轨，整体像一张巨弩 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-8fb9d7a7-fff2-4628-9067-0960cbd12158.png` |
| `bailei` | 百雷连炮 / 大 | 三联中口径炮管，炮塔后部突出一个大弹仓 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-155a138a-10cf-455f-8a02-d32ef668a0c2.png` |
| `zhaoyao` | 照妖灯 / 小 | 一个圆形大镜面嵌在半球基座里，像探照灯。近防光束 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-2a0251cd-9092-431c-a968-5f8bbcf7cea1.png` |
| `yingguang` | 萤光脉冲 / 小 | 单根短炮管，炮口有三道聚焦环 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-4fb91a0a-a06f-4e40-9311-be6d339c490e.png` |
| `dingshen` | 定身束 / 小 | 两片细长的平行导轨夹着一条细缝，像音叉 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-a2c01d7b-4f76-41bd-8d42-e91ec315fb0f.png` |
| `lihuo` | 离火脉冲 / 中 | 单根粗炮管套着多层散热环，后部圆形电容 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-4d44d678-6519-42d1-b9f9-9052a4a78219.png` |
| `fuling` | 缚灵束 / 中 | 两片弧形聚焦臂向前合抱，中间一根光束导管，像钳子 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-b299fa96-384b-4563-a9ad-12bf3a78bfcd.png` |
| `leiting` | 雷霆重脉 / 中 | 粗短的蓄能炮身，前端是菱形发射口，后部一个大型球形电容 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-4c533c70-d376-4533-a758-1218919829f7.png` |
| `tianfa` | 天罚光矛 / 大 | 一根占满画面长度的长矛形聚焦轨，末端大口径镜面，两侧多组稳定翼 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-1a903570-0d89-4ef2-bf4e-ef3c909660f7.png` |
| `xingbao` | 星爆重炮 / 大 | 巨大的环形加速器套着一根短粗炮管，俯视像一个靶环 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-9a7ef31c-a93a-4c5d-b73f-2fe932cc6594.png` |
| `ziwei` | 紫微连脉 / 大 | 四联并列能量炮管，带成排的散热鳍片 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-7a3f3823-ac68-44b9-9c77-d7d77f3f434c.png` |
| `zhuihun` | 追魂雷 / 小 | 单管发射架，露出一枚带弹翼的导弹 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-1327b745-a8fb-4fd1-9879-d34069dfbbb5.png` |
| `pojun` | 破军鱼雷 / 小 | 一枚粗大的鱼雷躺在开放式滑轨上，红色弹头，几乎和发射架一样大 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-ce43779b-fc0f-4e88-aa33-be859c293589.png` |
| `liuxing` | 流星火矢 / 小 | 3×3 的小孔蜂巢发射箱 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-334f68ee-f0fe-474c-8709-849a8f03d4cb.png` |
| `chuandun` | 穿盾梭 / 小 | 细长的封闭式发射管，管口露出尖锥形的梭状弹头 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-755f55f0-df95-4f31-bb1c-6fffda9d403b.png` |
| `zhuihunxia` | 追魂雷匣 / 中 | 双联箱式发射器，两个并排的方形弹仓各露出一枚导弹 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-028eab27-a8f3-4727-b3c2-fd3a353008d4.png` |
| `tianhuo` | 天火箭巢 / 中 | 五管火箭巢，管口呈梅花形排列，圆筒外形 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-9a11b335-c4a4-4900-a1ed-3d6c5721cd0c.png` |
| `fenhun` | 分魂雷 / 中 | 单枚粗大的母弹，弹体上能看到四个子弹头的舱盖 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-4323cd89-6603-4909-9c33-8d31c2f63d8d.png` |
| `mieshi` | 灭世鱼雷 / 大 | 一枚占满整个发射井的巨型鱼雷，暗红色弹头，井壁有固定卡爪 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-4206b523-c657-4750-b312-1c2e8cbf6f04.png` |
| `jiuxiao` | 九霄雷阵 / 大 | 垂直发射阵列：3×3 的方形井盖，其中几个打开露出弹头 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-cf1a7f43-1665-42a8-ba1b-6fe8ed01881a.png` |
| `wanjian` | 万箭齐发 / 大 | 宽大的蜂巢发射面，至少十六个密集小孔，像蜂窝；最终为 4×6 共 24 孔，横向宽蜂巢 | `/Users/shiwenjie/.codex/generated_images/01a12b0c-f543-7901-a825-9bff7bddd2d8/exec-129c63a8-c0f9-4351-85e8-6b6df4137836.png` |

重画记录：suixing、poyue 首版炮口倾斜；tiansan 前两版分别炮管抬起、下排反向；xingbao 首版炮管抬起；zhuihunxia 首版侧壁透视明显，均弃用。bengshan 在总览中体量偏细，重画加宽方形炮盾后替换。具体完成与原图记录见 `tools/preview/codex-weapons-progress.md`。

最终资源验证：28/28，全部 192×192 RGBA，alpha 范围 0–255、四角透明，安装无 PROBLEM；PNG 合计 1,099,146 字节，小于 1.6 MB。总览为 `tools/preview/weapons-sheet.png`。分包入口 game.js 保留。

验证：`npm test` 114 项通过，0 失败。未修改代码、测试、数值或已有舰图，未执行 git commit。
