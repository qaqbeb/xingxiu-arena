// Hull geometry matched to the sprites in assets/ships2.
// Written by tools/calibrate_ship.py (and by tools/kitbash_ships.py for
// placeholder art). Edit through those tools, not by hand.
(function (root) {
  const geometry = {
    "tieao": {
      "length": 150,
      "width": 126,
      "engineSlots": [
        {
          "x": -68.79,
          "y": -25.88,
          "width": 11.94,
          "length": 60,
          "style": "low"
        },
        {
          "x": -69.54,
          "y": 0.0,
          "width": 15.67,
          "length": 78,
          "style": "low"
        },
        {
          "x": -68.79,
          "y": 25.88,
          "width": 11.94,
          "length": 60,
          "style": "low"
        }
      ],
      "mountPoints": {
        "b3": [
          -29.23,
          -40.68
        ],
        "b4": [
          -29.23,
          40.68
        ],
        "b1": [
          3.48,
          -21.52
        ],
        "b2": [
          3.48,
          21.52
        ],
        "m1": [
          32.59,
          0.0
        ]
      }
    },
    "fuyue": {
      "length": 330,
      "width": 261,
      "engineSlots": [
        {
          "x": -152.44,
          "y": -77.45,
          "width": 22.44,
          "length": 112,
          "style": "low"
        },
        {
          "x": -152.72,
          "y": -43.24,
          "width": 26.27,
          "length": 131,
          "style": "low"
        },
        {
          "x": -151.35,
          "y": 0.0,
          "width": 31.75,
          "length": 159,
          "style": "low"
        },
        {
          "x": -152.72,
          "y": 43.24,
          "width": 26.27,
          "length": 131,
          "style": "low"
        },
        {
          "x": -152.44,
          "y": 77.45,
          "width": 22.44,
          "length": 112,
          "style": "low"
        }
      ],
      "mountPoints": {
        "b1": [
          10.13,
          -62.4
        ],
        "b7": [
          -65.14,
          -79.64
        ],
        "b3": [
          -62.4,
          -30.11
        ],
        "m2": [
          -34.76,
          -55.83
        ],
        "b2": [
          10.13,
          62.4
        ],
        "b4": [
          -62.4,
          30.11
        ],
        "b8": [
          -65.14,
          79.64
        ],
        "m3": [
          -34.76,
          55.83
        ],
        "m1": [
          55.01,
          0.0
        ],
        "b5": [
          24.08,
          -26.27
        ],
        "b6": [
          24.08,
          26.27
        ]
      }
    },
    "shaoji": {
      "length": 92,
      "width": 46,
      "engineSlots": [
        {
          "x": -41.43,
          "y": -7.55,
          "width": 5.04,
          "length": 25,
          "style": "mid"
        },
        {
          "x": -44.25,
          "y": 0.0,
          "width": 6.41,
          "length": 32,
          "style": "mid"
        },
        {
          "x": -41.43,
          "y": 7.63,
          "width": 5.04,
          "length": 25,
          "style": "mid"
        }
      ],
      "mountPoints": {
        "b1": [
          0.15,
          -9.16
        ],
        "e1": [
          0.15,
          9.16
        ],
        "m1": [
          12.74,
          0.0
        ]
      }
    },
    "zhenyue": {
      "length": 220,
      "width": 139,
      "engineSlots": [
        {
          "x": -100.9,
          "y": -56.38,
          "width": 14.96,
          "length": 75,
          "style": "mid"
        },
        {
          "x": -100.9,
          "y": -18.98,
          "width": 14.96,
          "length": 75,
          "style": "mid"
        },
        {
          "x": -103.82,
          "y": 0.0,
          "width": 15.69,
          "length": 78,
          "style": "mid"
        },
        {
          "x": -100.9,
          "y": 18.98,
          "width": 14.96,
          "length": 75,
          "style": "mid"
        },
        {
          "x": -100.9,
          "y": 56.38,
          "width": 14.96,
          "length": 75,
          "style": "mid"
        }
      ],
      "mountPoints": {
        "b2": [
          -6.02,
          -43.61
        ],
        "e2": [
          -12.59,
          -24.08
        ],
        "m1": [
          -84.48,
          -55.65
        ],
        "e3": [
          -12.59,
          24.08
        ],
        "b3": [
          -6.02,
          43.61
        ],
        "m2": [
          -84.48,
          55.65
        ],
        "b1": [
          33.02,
          -16.97
        ],
        "e1": [
          33.02,
          16.97
        ],
        "b4": [
          -48.72,
          0.0
        ]
      }
    },
    "lingxiao": {
      "length": 320,
      "width": 205,
      "engineSlots": [
        {
          "x": -154.19,
          "y": -49.1,
          "width": 16.99,
          "length": 85,
          "style": "mid"
        },
        {
          "x": -154.19,
          "y": -24.68,
          "width": 16.99,
          "length": 85,
          "style": "mid"
        },
        {
          "x": -154.19,
          "y": 0.0,
          "width": 16.99,
          "length": 85,
          "style": "mid"
        },
        {
          "x": -154.19,
          "y": 24.68,
          "width": 16.99,
          "length": 85,
          "style": "mid"
        },
        {
          "x": -154.19,
          "y": 49.1,
          "width": 16.99,
          "length": 85,
          "style": "mid"
        }
      ],
      "mountPoints": {
        "b3": [
          -99.26,
          -67.67
        ],
        "b4": [
          -99.26,
          67.67
        ],
        "b1": [
          50.69,
          0.0
        ],
        "m1": [
          0.53,
          0.0
        ],
        "b2": [
          97.13,
          -18.05
        ],
        "e1": [
          97.13,
          18.05
        ],
        "e2": [
          -70.33,
          0.0
        ]
      }
    },
    "xinyue": {
      "length": 96,
      "width": 58,
      "engineSlots": [
        {
          "x": -41.88,
          "y": -2.95,
          "width": 3.98,
          "length": 20,
          "style": "high"
        },
        {
          "x": -41.88,
          "y": 2.95,
          "width": 3.98,
          "length": 20,
          "style": "high"
        }
      ],
      "mountPoints": {
        "e1": [
          1.99,
          -7.64
        ],
        "e2": [
          1.99,
          7.64
        ],
        "e3": [
          27.71,
          0.0
        ]
      }
    },
    "kuimu": {
      "length": 210,
      "width": 187,
      "engineSlots": [
        {
          "x": -66.01,
          "y": -74.19,
          "width": 10.45,
          "length": 52,
          "style": "high"
        },
        {
          "x": -72.97,
          "y": -27.52,
          "width": 12.19,
          "length": 61,
          "style": "high"
        },
        {
          "x": -72.97,
          "y": 0.0,
          "width": 12.89,
          "length": 64,
          "style": "high"
        },
        {
          "x": -72.97,
          "y": 27.52,
          "width": 12.19,
          "length": 61,
          "style": "high"
        },
        {
          "x": -66.01,
          "y": 74.19,
          "width": 10.45,
          "length": 52,
          "style": "high"
        }
      ],
      "mountPoints": {
        "e3": [
          -27.0,
          -69.84
        ],
        "m1": [
          -30.13,
          -19.85
        ],
        "m2": [
          -30.13,
          19.85
        ],
        "e4": [
          -27.0,
          69.84
        ],
        "e1": [
          11.32,
          -30.3
        ],
        "e2": [
          11.32,
          30.3
        ],
        "e5": [
          28.39,
          -17.59
        ],
        "e6": [
          28.39,
          17.59
        ]
      }
    },
    "kangjin": {
      "length": 300,
      "width": 226,
      "engineSlots": [
        {
          "x": -135.52,
          "y": -69.28,
          "width": 9.72,
          "length": 49,
          "style": "high"
        },
        {
          "x": -132.36,
          "y": -55.18,
          "width": 9.72,
          "length": 49,
          "style": "high"
        },
        {
          "x": -130.66,
          "y": -34.76,
          "width": 18.96,
          "length": 95,
          "style": "high"
        },
        {
          "x": -130.9,
          "y": 0.0,
          "width": 20.42,
          "length": 102,
          "style": "high"
        },
        {
          "x": -130.66,
          "y": 34.76,
          "width": 18.96,
          "length": 95,
          "style": "high"
        },
        {
          "x": -132.36,
          "y": 55.18,
          "width": 9.72,
          "length": 49,
          "style": "high"
        },
        {
          "x": -135.52,
          "y": 69.28,
          "width": 9.72,
          "length": 49,
          "style": "high"
        }
      ],
      "mountPoints": {
        "e5": [
          -35.13,
          -84.84
        ],
        "m1": [
          -48.74,
          -20.66
        ],
        "e7": [
          -17.38,
          -65.39
        ],
        "e8": [
          -21.27,
          -31.6
        ],
        "m2": [
          -48.74,
          20.66
        ],
        "e6": [
          -35.13,
          84.84
        ],
        "e9": [
          -21.27,
          31.6
        ],
        "e10": [
          -17.38,
          65.39
        ],
        "e1": [
          30.51,
          -39.38
        ],
        "e2": [
          30.51,
          39.38
        ],
        "e3": [
          58.46,
          -23.34
        ],
        "e4": [
          58.46,
          23.34
        ]
      }
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = geometry;
  else root.StarShipGeometry = geometry;
})(typeof globalThis !== "undefined" ? globalThis : this);
