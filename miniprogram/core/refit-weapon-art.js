(function (root) {
  "use strict";

  // Hand-built orthographic armory miniatures. All geometry lives in a 100px square.
  // No image assets, compositing, gradients, fonts, or nonstandard Canvas calls.
  const STEEL = "#3e494f", LIGHT = "#68767b", DARK = "#182126";
  const COPPER = "#8e7153", BLUE = "#577d8b", EDGE = "#91a1a3";

  function polygon(c, points, fill, stroke) {
    c.beginPath();
    c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 0.8; c.stroke(); }
  }
  function rect(c, x, y, w, h, fill) {
    c.fillStyle = fill; c.fillRect(x, y, w, h);
  }
  function line(c, points, color, width) {
    c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.strokeStyle = color; c.lineWidth = width || 1; c.stroke();
  }
  function disc(c, x, y, radius, fill) {
    c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2);
    c.fillStyle = fill; c.fill();
  }
  function bolt(c, x, y) {
    disc(c, x, y, 1.7, DARK); disc(c, x - 0.25, y - 0.3, 0.75, LIGHT);
  }
  function plate(c, outline, inset, accent) {
    polygon(c, outline, DARK, "#0d1519");
    polygon(c, inset, STEEL, LIGHT);
    if (accent) line(c, accent, EDGE, 0.75);
  }
  function vent(c, x, y, count, width) {
    for (let i = 0; i < count; i++) {
      rect(c, x, y + i * 4, width, 2, "#111b20");
      rect(c, x, y + i * 4 + 2, width, 0.65, LIGHT);
    }
  }
  function barrel(c, x, top, width, bottom) {
    rect(c, x, top, width, bottom - top, DARK);
    rect(c, x + 1.5, top + 1, width - 3, bottom - top - 1, STEEL);
    rect(c, x + 2, top + 1, 1.1, bottom - top - 2, LIGHT);
    rect(c, x + width - 3, top + 1, 1.5, bottom - top - 1, "#29353b");
    rect(c, x - 1, top, width + 2, 4, "#526167");
    rect(c, x + 1, top, width - 2, 1.4, "#111a1e");
  }
  function trunnion(c, x, y, width) {
    rect(c, x, y, width, 10, DARK);
    rect(c, x + 1, y + 1, width - 2, 4, LIGHT);
    rect(c, x + 2, y + 5, width - 4, 3, STEEL);
  }
  function foot(c, x, y, width) {
    polygon(c, [x,y,x+width,y,x+width-3,y+9,x+3,y+9], DARK, LIGHT);
    rect(c, x + 4, y + 2, width - 8, 2, STEEL);
  }

  const painters = {
    chuanyun: function (c) {
      foot(c, 37, 80, 26);
      barrel(c, 36, 13, 9, 56); barrel(c, 55, 13, 9, 56);
      for (let y = 27; y <= 39; y += 6) {
        rect(c, 35, y, 11, 2, COPPER); rect(c, 54, y, 11, 2, COPPER);
      }
      trunnion(c, 23, 57, 54);
      plate(c, [31,43,69,43,73,69,62,83,38,83,27,69],
        [34,46,66,46,69,67,60,79,40,79,31,67], [34,46,66,46,69,60]);
      polygon(c, [46,41,54,41,57,68,50,75,43,68], "#29383f", LIGHT);
      rect(c, 48, 48, 4, 15, COPPER);
      vent(c, 34, 58, 4, 7); vent(c, 59, 58, 4, 7);
      bolt(c, 37, 51); bolt(c, 63, 51); bolt(c, 41, 75); bolt(c, 59, 75);
    },
    suixing: function (c) {
      foot(c, 34, 77, 32);
      trunnion(c, 20, 57, 60);
      plate(c, [28,39,72,39,77,67,65,81,35,81,23,67],
        [31,43,69,43,72,65,62,77,38,77,28,65], [31,43,69,43]);
      polygon(c, [35,22,65,22,69,49,61,58,39,58,31,49], DARK, LIGHT);
      for (let i = 0; i < 3; i++) barrel(c, 36 + i * 10, 24, 8, 51);
      rect(c, 33, 34, 34, 5, COPPER);
      rect(c, 34, 35, 32, 1, "#b19a75");
      plate(c, [37,55,63,55,65,72,35,72], [40,57,60,57,62,68,38,68]);
      vent(c, 42, 59, 2, 16); bolt(c, 31, 63); bolt(c, 69, 63);
      line(c, [40,74,46,74], COPPER); line(c, [51,74,60,74], LIGHT);
    },
    bengshan: function (c) {
      foot(c, 33, 79, 34);
      barrel(c, 43, 9, 14, 59);
      polygon(c, [39,10,61,10,61,23,57,27,43,27,39,23], STEEL, LIGHT);
      rect(c, 42, 11, 16, 3, DARK); rect(c, 41, 19, 18, 2, COPPER);
      trunnion(c, 20, 57, 60);
      plate(c, [30,41,70,41,76,70,63,84,37,84,24,70],
        [33,44,67,44,71,68,61,80,39,80,29,68], [33,44,67,44,70,58]);
      rect(c, 39, 36, 6, 27, "#26343a"); rect(c, 40, 38, 2, 23, LIGHT);
      rect(c, 55, 36, 6, 27, "#26343a"); rect(c, 56, 38, 2, 23, LIGHT);
      polygon(c, [43,56,57,56,61,69,56,77,44,77,39,69], "#536269", LIGHT);
      rect(c, 45, 62, 10, 7, DARK); rect(c, 46, 62, 8, 2, COPPER);
      vent(c, 31, 59, 3, 6); vent(c, 63, 59, 3, 6);
      bolt(c, 36, 48); bolt(c, 64, 48); bolt(c, 39, 75); bolt(c, 61, 75);
    },
    zhenhai: function (c) {
      foot(c, 28, 81, 44);
      barrel(c, 31, 10, 14, 61); barrel(c, 55, 10, 14, 61);
      [30,54].forEach(function (x) {
        rect(c, x, 19, 16, 5, "#5b6669"); rect(c, x, 29, 16, 4, COPPER);
        rect(c, x + 2, 37, 12, 13, "#253239");
        rect(c, x + 3, 38, 2, 11, LIGHT);
      });
      trunnion(c, 12, 61, 76);
      plate(c, [22,44,78,44,86,69,71,86,29,86,14,69],
        [25,48,75,48,80,67,68,81,32,81,20,67], [25,48,75,48,80,67]);
      polygon(c, [44,42,56,42,61,76,50,83,39,76], "#27363d", LIGHT);
      rect(c, 47, 50, 6, 18, COPPER); rect(c, 48, 51, 1, 16, "#b29770");
      vent(c, 27, 58, 4, 10); vent(c, 63, 58, 4, 10);
      bolt(c, 25, 53); bolt(c, 75, 53); bolt(c, 32, 77); bolt(c, 68, 77);
      line(c, [43,76,49,78], LIGHT); line(c, [64,52,69,52], "#7c8583");
    },
    lihuo: function (c) {
      foot(c, 34, 79, 32);
      plate(c, [33,33,41,24,59,24,67,33,74,71,62,84,38,84,26,71],
        [36,35,43,29,57,29,64,35,69,69,60,80,40,80,31,69], [36,35,43,29,57,29]);
      barrel(c, 44, 12, 12, 58);
      for (let y = 25; y < 53; y += 7) {
        rect(c, 39, y, 22, 5, DARK); rect(c, 40, y, 20, 2, BLUE);
        rect(c, 41, y, 2, 4, "#79949e"); rect(c, 58, y + 1, 2, 4, "#354c57");
      }
      polygon(c, [31,43,38,40,40,71,34,75,29,67], "#293d45", LIGHT);
      polygon(c, [69,43,62,40,60,71,66,75,71,67], "#293d45", LIGHT);
      vent(c, 32, 48, 5, 4); vent(c, 64, 48, 5, 4);
      disc(c, 50, 67, 10, DARK); disc(c, 50, 66, 7.5, STEEL);
      disc(c, 50, 66, 4, "#416673"); disc(c, 49, 65, 1.7, "#8ea8ae");
      bolt(c, 40, 76); bolt(c, 60, 76);
    },
    fuling: function (c) {
      foot(c, 38, 81, 24);
      plate(c, [37,44,63,44,72,66,63,86,37,86,28,66],
        [40,47,60,47,67,66,60,81,40,81,33,66], [40,47,60,47]);
      polygon(c, [28,13,37,13,41,48,47,58,40,65,29,52,23,23], DARK, LIGHT);
      polygon(c, [72,13,63,13,59,48,53,58,60,65,71,52,77,23], DARK, LIGHT);
      polygon(c, [29,16,34,16,38,48,33,48,27,23], "#53676f");
      polygon(c, [66,16,71,16,73,23,67,48,62,48], "#455960");
      for (let i = 0; i < 5; i++) {
        line(c, [29+i,25+i*5,36+i,24+i*5], BLUE, 2.2);
        line(c, [64-i,24+i*5,71-i,25+i*5], BLUE, 2.2);
      }
      barrel(c, 46, 30, 8, 67);
      rect(c, 48, 34, 4, 20, "#7098a5"); rect(c, 49, 34, 1, 18, "#a1b4b7");
      polygon(c, [42,60,58,60,60,75,50,80,40,75], STEEL, LIGHT);
      vent(c, 45, 64, 3, 10); bolt(c, 37, 68); bolt(c, 63, 68);
    },
    zhaoyao: function (c) {
      foot(c, 38, 76, 24);
      trunnion(c, 22, 58, 56);
      plate(c, [34,49,66,49,71,73,60,82,40,82,29,73],
        [37,51,63,51,66,71,58,78,42,78,34,71], [37,51,63,51]);
      polygon(c, [29,30,39,18,61,18,71,30,70,54,58,65,42,65,30,54], DARK, LIGHT);
      disc(c, 50, 40, 22, "#26333a"); disc(c, 50, 39, 19, "#617279");
      disc(c, 50, 39, 15.5, "#1c2b32"); disc(c, 50, 39, 12.5, "#365360");
      disc(c, 50, 39, 9.5, "#4e7180"); disc(c, 50, 39, 5.5, "#28434f");
      line(c, [43,32,47,29,52,29], "#95aab0", 1.5);
      line(c, [54,47,58,43], "#658c98", 1);
      [ [35,26], [65,26], [35,53], [65,53] ].forEach(function (p) { bolt(c,p[0],p[1]); });
      rect(c, 47, 16, 6, 7, STEEL); rect(c, 48, 17, 4, 2, COPPER);
      vent(c, 41, 67, 2, 18);
    },
    zhuihun: function (c) {
      foot(c, 31, 78, 38);
      trunnion(c, 17, 54, 66);
      plate(c, [23,24,35,17,65,17,77,24,78,72,65,85,35,85,22,72],
        [27,27,37,21,63,21,73,27,74,70,63,80,37,80,26,70], [27,27,37,21,63,21,73,27]);
      rect(c, 47, 24, 6, 53, "#222e35"); rect(c, 48, 25, 1, 50, LIGHT);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const x = 30 + col * 25, y = 27 + row * 16;
          rect(c, x, y, 15, 14, "#111b21");
          line(c, [x,y+13,x,y,x+14,y], "#69767a", 0.9);
          polygon(c, [x+3,y+11,x+3,y+6,x+7,y+2,x+11,y+6,x+11,y+11], "#506068");
          line(c, [x+7,y+3,x+7,y+10], "#8c999b", 0.8);
          rect(c, x+3, y+10, 8, 2, COPPER);
        }
      }
      bolt(c, 29, 74); bolt(c, 71, 74);
      rect(c, 39, 75, 6, 2, COPPER); rect(c, 55, 75, 6, 2, LIGHT);
    },
    // ── v0.4 armoury ──
    poyue: function (c) {
      foot(c, 36, 79, 28);
      barrel(c, 41, 26, 18, 60);
      rect(c, 39, 26, 22, 6, COPPER); rect(c, 40, 27, 20, 1.5, "#b19a75");
      trunnion(c, 26, 58, 48);
      plate(c, [33,46,67,46,71,70,61,83,39,83,29,70],
        [36,49,64,49,67,68,59,79,41,79,33,68], [36,49,64,49]);
      rect(c, 46, 54, 8, 14, DARK); rect(c, 47, 55, 6, 3, COPPER);
      bolt(c, 38, 74); bolt(c, 62, 74);
    },
    liexing: function (c) {
      foot(c, 33, 80, 34);
      for (let i = 0; i < 4; i++) barrel(c, 33 + i * 9, 11 + (i % 2) * 4, 7, 58);
      rect(c, 31, 30, 38, 4, COPPER); rect(c, 31, 44, 38, 3, LIGHT);
      trunnion(c, 20, 57, 60);
      plate(c, [29,45,71,45,75,70,63,84,37,84,25,70],
        [32,48,68,48,71,68,61,80,39,80,29,68], [32,48,68,48,71,60]);
      disc(c, 50, 66, 8, DARK); disc(c, 50, 65.5, 5.5, STEEL); disc(c, 49, 64.5, 2, LIGHT);
      vent(c, 33, 58, 4, 6); vent(c, 61, 58, 4, 6);
    },
    tiansan: function (c) {
      foot(c, 32, 79, 36);
      trunnion(c, 18, 58, 64);
      plate(c, [26,36,74,36,79,68,66,83,34,83,21,68],
        [29,40,71,40,75,66,64,79,36,79,25,66], [29,40,71,40]);
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 4; col++) {
          const x = 30 + col * 10.5, y = 18 + row * 13;
          rect(c, x, y, 8, 11, DARK); rect(c, x + 1.5, y + 1.5, 5, 8, "#111b20");
          rect(c, x, y, 8, 1.4, LIGHT);
        }
      rect(c, 29, 44, 42, 4, COPPER);
      vent(c, 40, 56, 5, 20); bolt(c, 31, 72); bolt(c, 69, 72);
    },
    guanri: function (c) {
      foot(c, 30, 82, 40);
      barrel(c, 44, 9, 12, 66);
      for (let y = 16; y < 58; y += 9) {
        rect(c, 39, y, 22, 4, DARK); rect(c, 40, y, 20, 1.5, BLUE);
      }
      polygon(c, [24,34,38,28,40,62,30,70,22,58], DARK, LIGHT);
      polygon(c, [76,34,62,28,60,62,70,70,78,58], DARK, LIGHT);
      line(c, [27,38,36,34], COPPER, 1.6); line(c, [73,38,64,34], COPPER, 1.6);
      trunnion(c, 14, 62, 72);
      plate(c, [26,52,74,52,82,72,69,87,31,87,18,72],
        [29,56,71,56,77,71,66,83,34,83,23,71], [29,56,71,56]);
      rect(c, 46, 62, 8, 14, COPPER); bolt(c, 30, 76); bolt(c, 70, 76);
    },
    bailei: function (c) {
      foot(c, 28, 82, 44);
      for (let i = 0; i < 3; i++) barrel(c, 28 + i * 16, 14, 12, 60);
      rect(c, 26, 22, 48, 5, COPPER); rect(c, 26, 36, 48, 4, "#5b6669");
      trunnion(c, 12, 60, 76);
      plate(c, [20,46,80,46,86,70,72,87,28,87,14,70],
        [23,50,77,50,81,68,69,83,31,83,19,68], [23,50,77,50,81,68]);
      rect(c, 30, 58, 40, 12, DARK);
      for (let i = 0; i < 6; i++) rect(c, 32 + i * 6.3, 60, 4, 8, i % 2 ? COPPER : LIGHT);
      bolt(c, 25, 76); bolt(c, 75, 76);
    },
    leiting: function (c) {
      foot(c, 35, 80, 30);
      plate(c, [30,30,70,30,76,70,63,85,37,85,24,70],
        [33,34,67,34,72,68,61,81,39,81,28,68], [33,34,67,34]);
      polygon(c, [40,10,60,10,64,40,50,48,36,40], DARK, LIGHT);
      polygon(c, [44,14,56,14,58,37,50,42,42,37], BLUE);
      line(c, [50,14,50,40], "#9cc0cc", 1.4);
      disc(c, 50, 60, 14, DARK); disc(c, 50, 59.5, 11, "#365360");
      disc(c, 50, 59.5, 7, "#4e7180"); disc(c, 49, 58, 2.6, "#a1b4b7");
      vent(c, 31, 46, 5, 4); vent(c, 65, 46, 5, 4);
      bolt(c, 38, 77); bolt(c, 62, 77);
    },
    yingguang: function (c) {
      foot(c, 39, 78, 22);
      trunnion(c, 28, 58, 44);
      plate(c, [36,46,64,46,68,70,59,81,41,81,32,70],
        [39,49,61,49,64,68,57,77,43,77,36,68], [39,49,61,49]);
      barrel(c, 45, 20, 10, 56);
      for (let y = 26; y < 50; y += 8) { rect(c, 42, y, 16, 4, DARK); rect(c, 43, y, 14, 1.5, BLUE); }
      disc(c, 50, 64, 5, "#416673"); disc(c, 49.3, 63.3, 1.6, "#8ea8ae");
    },
    dingshen: function (c) {
      foot(c, 40, 80, 20);
      plate(c, [38,50,62,50,67,70,59,83,41,83,33,70],
        [41,53,59,53,63,69,57,79,43,79,37,69], [41,53,59,53]);
      polygon(c, [34,20,42,16,45,52,39,58,32,46], DARK, LIGHT);
      polygon(c, [66,20,58,16,55,52,61,58,68,46], DARK, LIGHT);
      line(c, [38,22,41,48], BLUE, 2); line(c, [62,22,59,48], BLUE, 2);
      rect(c, 48, 24, 4, 34, "#7098a5"); rect(c, 49, 24, 1, 32, "#a1b4b7");
      disc(c, 50, 66, 6, DARK); disc(c, 50, 65.6, 3.6, "#4e7180");
    },
    pojun: function (c) {
      foot(c, 33, 80, 34);
      trunnion(c, 20, 60, 60);
      plate(c, [30,22,70,22,75,72,63,85,37,85,25,72],
        [33,26,67,26,71,70,61,81,39,81,29,70], [33,26,67,26]);
      polygon(c, [50,12,60,26,60,70,40,70,40,26], "#506068", LIGHT);
      polygon(c, [50,14,57,26,43,26], "#9f4842");
      rect(c, 40, 44, 20, 3, COPPER); rect(c, 40, 62, 20, 4, DARK);
      line(c, [50,28,50,60], "#8c999b", 1);
      bolt(c, 33, 76); bolt(c, 67, 76);
    },
    liuxing: function (c) {
      foot(c, 30, 79, 40);
      trunnion(c, 16, 56, 68);
      plate(c, [22,20,78,20,82,72,68,85,32,85,18,72],
        [25,24,75,24,78,70,66,81,34,81,22,70], [25,24,75,24]);
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 4; col++) {
          const x = 29 + col * 11, y = 27 + row * 12;
          disc(c, x + 4.5, y + 4.5, 4.4, "#111b21");
          disc(c, x + 4.5, y + 4.5, 2.4, (row + col) % 3 ? "#506068" : COPPER);
        }
      rect(c, 28, 75, 44, 2, LIGHT);
    }
  };

  // Later weapons reuse the miniature of their closest relative.
  const ALIAS = {
    chuandun: "pojun", zhuihunxia: "zhuihun", tianhuo: "liuxing", fenhun: "zhuihun",
    mieshi: "pojun", jiuxiao: "zhuihun", wanjian: "liuxing",
    tianfa: "fuling", xingbao: "leiting", ziwei: "lihuo",
  };
  function draw(ctx, weapon, x, y, width, height, options) {
    const raw = typeof weapon === "string" ? weapon : weapon && weapon.id;
    const id = painters[raw] ? raw : ALIAS[raw];
    if (!ctx || !painters[id] || ![x,y,width,height].every(Number.isFinite) || width <= 0 || height <= 0) return false;
    const scale = Math.min(width, height) / 100;
    ctx.save();
    try {
      ctx.translate(x + (width - 100 * scale) / 2, y + (height - 100 * scale) / 2);
      ctx.scale(scale, scale);
      ctx.globalAlpha = 1;
      ctx.lineCap = "butt";
      ctx.lineJoin = "round";
      painters[id](ctx);
      // Selection remains a physical status indicator rather than a glow/filter.
      if (options && options.selected) {
        rect(ctx, 47, 83, 6, 1.5, "#a98b61");
      }
    } finally { ctx.restore(); }
    return true;
  }

  const api = { draw: draw };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.StarRefitWeaponArt = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
