!(function (e) {
  var t = {};
  function n(r) {
    if (t[r]) return t[r].exports;
    var o = (t[r] = { i: r, l: !1, exports: {} });
    return e[r].call(o.exports, o, o.exports, n), (o.l = !0), o.exports;
  }
  (n.m = e),
    (n.c = t),
    (n.d = function (e, t, r) {
      n.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: r });
    }),
    (n.r = function (e) {
      'undefined' != typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
        Object.defineProperty(e, '__esModule', { value: !0 });
    }),
    (n.t = function (e, t) {
      if ((1 & t && (e = n(e)), 8 & t)) return e;
      if (4 & t && 'object' == typeof e && e && e.__esModule) return e;
      var r = Object.create(null);
      if ((n.r(r), Object.defineProperty(r, 'default', { enumerable: !0, value: e }), 2 & t && 'string' != typeof e))
        for (var o in e)
          n.d(
            r,
            o,
            function (t) {
              return e[t];
            }.bind(null, o)
          );
      return r;
    }),
    (n.n = function (e) {
      var t =
        e && e.__esModule
          ? function () {
              return e.default;
            }
          : function () {
              return e;
            };
      return n.d(t, 'a', t), t;
    }),
    (n.o = function (e, t) {
      return Object.prototype.hasOwnProperty.call(e, t);
    }),
    (n.p = ''),
    n((n.s = 21));
})([
  function (e) {
    e.exports = JSON.parse(
      '{"l":{"UT_IFRAME":"utif_","UT_DIV":"div_utif_"},"i":{"WARN":"WARN"},"e":{"DEBUG_MODE":"ast_debug","AST_DONGLE":"ast_dongle","AST_DEBUG_MEMBER":"ast_debug_member","AST_DEBUG_BIDDER":"ast_debug_bidder","AST_TEST":"ast_test","AST_TOOLKIT":"ast_toolkit","AST_OVERRIDE":{"BASE":"ast_override_","DIV":"div","INDEX":"index","TAG_ID":"tag_id","INV_CODE":"inv_code","PUBLISHER_ID":"publisher_id"}},"k":{"UNDEFINED":"undefined","OBJECT":"object","STRING":"string","NUMBER":"number"},"f":{"UT_BASE":"/ut/v3","IMPBUS":"ib.adnxs.com","IMPBUS_SIMPLE":"ib.adnxs-simple.com","UT_PREBID":"/ut/v3/prebid"},"p":{"MEDIA_TYPE":"media_type","CREATIVE_ID":"creative_id","AD_TYPE":"ad_type","BANNER":"banner","VIDEO":"video","CONTENT":"content","UUID":"uuid"},"j":{"BANNER":"banner","NATIVE":"native","VIDEO":"video"},"a":{"CREATIVE_ID":"creative_id","NOTIFY":"notify_url","NOAD":"no_ad_url","IMP_URLS":"impression_urls","TRACKERS":"trackers"},"d":{"RTB":"rtb","CSM":"csm","SSM":"ssm"},"b":{"BANNER":"banner","NATIVE":"native","VIDEO":"video"},"h":{"VIDEO_MEDIATION_JS":"//acdn.adnxs-simple.com/video/astMediation/AstMediationManager.js","BANNER_MEDIATION_JS":"//acdn.adnxs-simple.com/ast/mediation/0.66.0/mediation.js","SAFE_FRAME_URL":"https://adsdkprod.azureedge.net/assets/sf/v1.0.0/safeframe-v2.html","TOPICS_URL":"https://adsdkprod.azureedge.net/assets/topics/v1.0.0/topics.html","JOIN_INTEREST_GROUP_URL":"https://adsdkprod.azureedge.net/assets/ig/v1.0.0/joinInterestGroup.html","GET_COOKIES_URL":"https://adsdkprod.azureedge.net/assets/getCookies/v1.0.0/getCookies.html","USERSYNC_URL":"https://acdn.adnxs.com/dmp/async_usersync.html","CDN_ORIGIN":"acdn.adnxs-simple.com","OMID_URL":"https://adsdkprod.azureedge.net/assets/scripts/om/omid-verification-client-v1.js"},"o":{"ARRAY":"Array","STRING":"String","FUNC":"Function","NUM":"Number","OBJ":"Object","BOOL":"Boolean"},"m":{"DEFAULT_ZINDEX":3000,"STATUS":{"READY":"ready","NOTIFY_EXPANDED":"expanded","NOTIFY_COLLAPSED":"collapsed","NOTIFY_ERROR":"error","FOCUS_CHANGE":"focus-change","GEOM_UPDATE":"geom-update","CMP":"cmp"}},"g":{"CREATIVE":"creative"},"c":{"NATIVE_VIEWABILITY":{"AD_RESPONSE":"adresponse","IMPRESSION":"impression"}},"n":{"ERROR_TYPES":{"AD_RESPONSE_ERROR":"adResponseError","ENDPOINT_ERROR":"endpointError","OMID_LOAD_ERROR":"omidLoadError","LOGGING_ERROR":"loggingError"}}}'
    );
  },
  function (e, t, n) {
    'use strict';
    Object.defineProperty(t, '__esModule', { value: !0 }),
      (t.getRawNetworkEffectiveType =
        t.screenInfo =
        t.getTopLevelUrl =
        t.stringifyLogBody =
        t.allowTelemetry =
        t.createTelemetryType =
        t.isAdSdkUrl =
          void 0),
      (t.isAdSdkUrl = function (e = '') {
        return (
          e.includes('adsdk.microsoft.com') ||
          e.includes('adsdkprod.azureedge.net') ||
          e.includes('adsdkprprod.azureedge.net') ||
          e.includes('acdn.adnxs.com/ast/ast.js') ||
          e.includes('acdn.adnxs-simple.com/ast/ast.js') ||
          location.href.includes('pleaseTrackMeAdTelemetry')
        );
      }),
      (t.createTelemetryType = function (...e) {
        return e.filter(Boolean).join('.');
      }),
      (t.allowTelemetry = function () {
        var e, n;
        return (
          null !==
            (n = null === (e = (0, t.getTopLevelUrl)()) || void 0 === e ? void 0 : e.includes('allowAdTelemetry=1')) &&
          void 0 !== n &&
          n
        );
      }),
      (t.stringifyLogBody = function (e) {
        return JSON.stringify(e, (e, t) => (t instanceof Error ? { name: t.name, message: t.message, stack: t.stack } : t));
      });
    (t.getTopLevelUrl = () => {
      var e, t;
      try {
        return null === (e = window.top) || void 0 === e ? void 0 : e.location.href;
      } catch (e) {
        return (null === (t = window.location.ancestorOrigins) || void 0 === t ? void 0 : t.length) > 0
          ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
          : window.location.href;
      }
    }),
      (t.screenInfo = function () {
        return {
          devicePixelRatio: (null === window || void 0 === window ? void 0 : window.devicePixelRatio) || 1,
          width: null === window || void 0 === window ? void 0 : window.screen.width,
          height: null === window || void 0 === window ? void 0 : window.screen.height,
        };
      }),
      (t.getRawNetworkEffectiveType = function () {
        var e;
        const t =
          (null === navigator || void 0 === navigator ? void 0 : navigator.connection) ||
          (null === navigator || void 0 === navigator ? void 0 : navigator.mozConnection) ||
          (null === navigator || void 0 === navigator ? void 0 : navigator.webkitConnection) ||
          null;
        return null !== (e = null == t ? void 0 : t.effectiveType) && void 0 !== e ? e : 'none';
      });
  },
  function (e, t, n) {
    'use strict';
    Object.defineProperty(t, '__esModule', { value: !0 }),
      (t.initTelemetry =
        t.PerformanceTelemetry =
        t.commonTelemetryEvents =
        t.mediationTelemetryEvents =
        t.ErrorsTelemetryClass =
        t.ErrorsTelemetry =
        t.EventsTelemetry =
        t.TelemetrySharedData =
          void 0);
    const r = n(5);
    Object.defineProperty(t, 'TelemetrySharedData', {
      enumerable: !0,
      get: function () {
        return r.TelemetrySharedData;
      },
    });
    const o = n(12);
    Object.defineProperty(t, 'EventsTelemetry', {
      enumerable: !0,
      get: function () {
        return o.EventsTelemetry;
      },
    });
    const i = n(16);
    Object.defineProperty(t, 'ErrorsTelemetry', {
      enumerable: !0,
      get: function () {
        return i.ErrorsTelemetry;
      },
    }),
      Object.defineProperty(t, 'ErrorsTelemetryClass', {
        enumerable: !0,
        get: function () {
          return i.ErrorsTelemetryClass;
        },
      });
    const a = n(18);
    Object.defineProperty(t, 'commonTelemetryEvents', {
      enumerable: !0,
      get: function () {
        return a.commonTelemetryEvents;
      },
    }),
      Object.defineProperty(t, 'mediationTelemetryEvents', {
        enumerable: !0,
        get: function () {
          return a.mediationTelemetryEvents;
        },
      });
    const s = n(19);
    Object.defineProperty(t, 'PerformanceTelemetry', {
      enumerable: !0,
      get: function () {
        return s.PerformanceTelemetry;
      },
    });
    t.initTelemetry = (e, t) => {
      if (r.TelemetrySharedData.inited) throw Error('Telemetry is already inited.');
      r.TelemetrySharedData.setSampleRate(e),
        (r.TelemetrySharedData.inited = !0),
        (0, i.initListenUnhandledErrors)(i.ErrorsTelemetry),
        s.PerformanceTelemetry.init(),
        o.EventsTelemetry.trackEvent({ type: a.commonTelemetryEvents.sdkInit, data: t });
    };
  },
  function (e, t) {
    var n,
      r,
      o = (e.exports = {});
    function i() {
      throw new Error('setTimeout has not been defined');
    }
    function a() {
      throw new Error('clearTimeout has not been defined');
    }
    function s(e) {
      if (n === setTimeout) return setTimeout(e, 0);
      if ((n === i || !n) && setTimeout) return (n = setTimeout), setTimeout(e, 0);
      try {
        return n(e, 0);
      } catch (t) {
        try {
          return n.call(null, e, 0);
        } catch (t) {
          return n.call(this, e, 0);
        }
      }
    }
    !(function () {
      try {
        n = 'function' == typeof setTimeout ? setTimeout : i;
      } catch (e) {
        n = i;
      }
      try {
        r = 'function' == typeof clearTimeout ? clearTimeout : a;
      } catch (e) {
        r = a;
      }
    })();
    var c,
      l = [],
      d = !1,
      u = -1;
    function f() {
      d && c && ((d = !1), c.length ? (l = c.concat(l)) : (u = -1), l.length && m());
    }
    function m() {
      if (!d) {
        var e = s(f);
        d = !0;
        for (var t = l.length; t; ) {
          for (c = l, l = []; ++u < t; ) c && c[u].run();
          (u = -1), (t = l.length);
        }
        (c = null),
          (d = !1),
          (function (e) {
            if (r === clearTimeout) return clearTimeout(e);
            if ((r === a || !r) && clearTimeout) return (r = clearTimeout), clearTimeout(e);
            try {
              r(e);
            } catch (t) {
              try {
                return r.call(null, e);
              } catch (t) {
                return r.call(this, e);
              }
            }
          })(e);
      }
    }
    function p(e, t) {
      (this.fun = e), (this.array = t);
    }
    function g() {}
    (o.nextTick = function (e) {
      var t = new Array(arguments.length - 1);
      if (arguments.length > 1) for (var n = 1; n < arguments.length; n++) t[n - 1] = arguments[n];
      l.push(new p(e, t)), 1 !== l.length || d || s(m);
    }),
      (p.prototype.run = function () {
        this.fun.apply(null, this.array);
      }),
      (o.title = 'browser'),
      (o.browser = !0),
      (o.env = {}),
      (o.argv = []),
      (o.version = ''),
      (o.versions = {}),
      (o.on = g),
      (o.addListener = g),
      (o.once = g),
      (o.off = g),
      (o.removeListener = g),
      (o.removeAllListeners = g),
      (o.emit = g),
      (o.prependListener = g),
      (o.prependOnceListener = g),
      (o.listeners = function (e) {
        return [];
      }),
      (o.binding = function (e) {
        throw new Error('process.binding is not supported');
      }),
      (o.cwd = function () {
        return '/';
      }),
      (o.chdir = function (e) {
        throw new Error('process.chdir is not supported');
      }),
      (o.umask = function () {
        return 0;
      });
  },
  function (e, t, n) {
    'use strict';
    (function (e) {
      Object.defineProperty(t, '__esModule', { value: !0 }), (t.BaseTelemetryClass = void 0);
      const r = n(5),
        o = n(8),
        i = n(15),
        a = n(1);
      t.BaseTelemetryClass = class {
        skipLogging() {
          var t;
          return (
            !(
              e.env.IS_DEV ||
              e.env.IS_TESTS ||
              !(null === (t = r.TelemetrySharedData.getSessionData().url) || void 0 === t
                ? void 0
                : t.includes('//localhost'))
            ) || r.TelemetrySharedData.skipLogging
          );
        }
        log(t, { id: n } = {}) {
          const s = Object.assign(
            Object.assign(
              Object.assign(
                Object.assign({}, r.TelemetrySharedData.getSessionData()),
                r.TelemetrySharedData.getPlacementData(n)
              ),
              t
            ),
            { timestamp: new Date().getTime() }
          );
          if (!r.TelemetrySharedData.inited)
            throw Error(`Telemetry is not inited, call initTelemetry first. Event with type=${s.type} is ignored.`);
          this.skipLogging() ||
            (e.env.IS_DEV
              ? (0, i.showDebugMessage)(s)
              : fetch(o.config.telemetry.endpoint, {
                  method: 'POST',
                  body: (0, a.stringifyLogBody)(s),
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'omit',
                }));
        }
      };
    }).call(this, n(3));
  },
  function (e, t, n) {
    'use strict';
    (function (e) {
      Object.defineProperty(t, '__esModule', { value: !0 }), (t.TelemetrySharedData = t.TelemetrySharedDataClass = void 0);
      const r = n(9),
        o = n(1);
      class i {
        constructor() {
          (this.sessionData = {}),
            (this.placementData = {}),
            (this.sampleRate = 1),
            (this.skipLogging = !1),
            (this.inited = !1),
            this.populateSessionData();
        }
        populateSessionData() {
          var t, n;
          const i = (0, o.screenInfo)(),
            a = (0, o.getRawNetworkEffectiveType)();
          this.sessionData = {
            sessionUuid: (0, r.v4)(),
            ua: window.navigator.userAgent,
            url: (0, o.getTopLevelUrl)(),
            sdkType: e.env.TEMPORARY_SDK_TYPE || e.env.NAME || 'unknown',
            sdkVersion: e.env.VERSION || 'unknown',
            screenWidth: Math.floor(null !== (t = i.width) && void 0 !== t ? t : 0),
            screenHeight: Math.floor(null !== (n = i.height) && void 0 !== n ? n : 0),
            dpr: i.devicePixelRatio,
            networkType: a,
            lang: navigator.language,
          };
        }
        setSampleRate(t) {
          (this.sampleRate = e.env.IS_DEV || e.env.IS_TESTS || (0, o.allowTelemetry)() ? 1 : t),
            (this.skipLogging = this.skipLoggingBySampleRate());
        }
        skipLoggingBySampleRate() {
          return Math.random() > this.sampleRate;
        }
        addSessionData(e) {
          this.sessionData = Object.assign(Object.assign({}, this.sessionData), e);
        }
        addPlacementData(e, t) {
          this.placementData[e] || (this.placementData[e] = {}),
            (this.placementData[e] = Object.assign(Object.assign({}, this.placementData[e]), t));
        }
        getSessionData() {
          return this.sessionData;
        }
        getPlacementData(e = '') {
          var t;
          return null !== (t = this.placementData[e]) && void 0 !== t ? t : {};
        }
      }
      (t.TelemetrySharedDataClass = i), (t.TelemetrySharedData = new i());
    }).call(this, n(3));
  },
  function (e, t) {
    var n =
      ('undefined' != typeof crypto && crypto.getRandomValues && crypto.getRandomValues.bind(crypto)) ||
      ('undefined' != typeof msCrypto &&
        'function' == typeof window.msCrypto.getRandomValues &&
        msCrypto.getRandomValues.bind(msCrypto));
    if (n) {
      var r = new Uint8Array(16);
      e.exports = function () {
        return n(r), r;
      };
    } else {
      var o = new Array(16);
      e.exports = function () {
        for (var e, t = 0; t < 16; t++)
          0 == (3 & t) && (e = 4294967296 * Math.random()), (o[t] = (e >>> ((3 & t) << 3)) & 255);
        return o;
      };
    }
  },
  function (e, t) {
    for (var n = [], r = 0; r < 256; ++r) n[r] = (r + 256).toString(16).substr(1);
    e.exports = function (e, t) {
      var r = t || 0,
        o = n;
      return [
        o[e[r++]],
        o[e[r++]],
        o[e[r++]],
        o[e[r++]],
        '-',
        o[e[r++]],
        o[e[r++]],
        '-',
        o[e[r++]],
        o[e[r++]],
        '-',
        o[e[r++]],
        o[e[r++]],
        '-',
        o[e[r++]],
        o[e[r++]],
        o[e[r++]],
        o[e[r++]],
        o[e[r++]],
        o[e[r++]],
      ].join('');
    };
  },
  function (e, t, n) {
    'use strict';
    (function (e) {
      Object.defineProperty(t, '__esModule', { value: !0 }), (t.config = void 0);
      const r = n(13),
        o = n(14);
      let i = r.configProd;
      (t.config = i), e.env.IS_DEV && (t.config = i = o.configDev);
    }).call(this, n(3));
  },
  function (e, t, n) {
    var r = n(10),
      o = n(11),
      i = o;
    (i.v1 = r), (i.v4 = o), (e.exports = i);
  },
  function (e, t, n) {
    var r,
      o,
      i = n(6),
      a = n(7),
      s = 0,
      c = 0;
    e.exports = function (e, t, n) {
      var l = (t && n) || 0,
        d = t || [],
        u = (e = e || {}).node || r,
        f = void 0 !== e.clockseq ? e.clockseq : o;
      if (null == u || null == f) {
        var m = i();
        null == u && (u = r = [1 | m[0], m[1], m[2], m[3], m[4], m[5]]), null == f && (f = o = 16383 & ((m[6] << 8) | m[7]));
      }
      var p = void 0 !== e.msecs ? e.msecs : new Date().getTime(),
        g = void 0 !== e.nsecs ? e.nsecs : c + 1,
        v = p - s + (g - c) / 1e4;
      if (
        (v < 0 && void 0 === e.clockseq && (f = (f + 1) & 16383),
        (v < 0 || p > s) && void 0 === e.nsecs && (g = 0),
        g >= 1e4)
      )
        throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
      (s = p), (c = g), (o = f);
      var y = (1e4 * (268435455 & (p += 122192928e5)) + g) % 4294967296;
      (d[l++] = (y >>> 24) & 255), (d[l++] = (y >>> 16) & 255), (d[l++] = (y >>> 8) & 255), (d[l++] = 255 & y);
      var h = ((p / 4294967296) * 1e4) & 268435455;
      (d[l++] = (h >>> 8) & 255),
        (d[l++] = 255 & h),
        (d[l++] = ((h >>> 24) & 15) | 16),
        (d[l++] = (h >>> 16) & 255),
        (d[l++] = (f >>> 8) | 128),
        (d[l++] = 255 & f);
      for (var w = 0; w < 6; ++w) d[l + w] = u[w];
      return t || a(d);
    };
  },
  function (e, t, n) {
    var r = n(6),
      o = n(7);
    e.exports = function (e, t, n) {
      var i = (t && n) || 0;
      'string' == typeof e && ((t = 'binary' === e ? new Array(16) : null), (e = null));
      var a = (e = e || {}).random || (e.rng || r)();
      if (((a[6] = (15 & a[6]) | 64), (a[8] = (63 & a[8]) | 128), t)) for (var s = 0; s < 16; ++s) t[i + s] = a[s];
      return t || o(a);
    };
  },
  function (e, t, n) {
    'use strict';
    var r =
      (this && this.__rest) ||
      function (e, t) {
        var n = {};
        for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
        if (null != e && 'function' == typeof Object.getOwnPropertySymbols) {
          var o = 0;
          for (r = Object.getOwnPropertySymbols(e); o < r.length; o++)
            t.indexOf(r[o]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[o]) && (n[r[o]] = e[r[o]]);
        }
        return n;
      };
    Object.defineProperty(t, '__esModule', { value: !0 }), (t.EventsTelemetry = t.EventsTelemetryClass = void 0);
    const o = n(4),
      i = n(1);
    class a extends o.BaseTelemetryClass {
      trackEvent(e, t) {
        this.log('string' == typeof e ? { type: e } : e, { id: t });
      }
      trackCustomEvent(e, t) {
        var { type: n } = e,
          o = r(e, ['type']);
        this.log({ type: (0, i.createTelemetryType)('custom', n), data: o }, { id: t });
      }
    }
    (t.EventsTelemetryClass = a), (t.EventsTelemetry = new a());
  },
  function (e, t, n) {
    'use strict';
    Object.defineProperty(t, '__esModule', { value: !0 }),
      (t.configProd = void 0),
      (t.configProd = { telemetry: { endpoint: 'https://bat.bing.net/adsdk/logs' } });
  },
  function (e, t, n) {
    'use strict';
    Object.defineProperty(t, '__esModule', { value: !0 }),
      (t.configDev = void 0),
      (t.configDev = { telemetry: { endpoint: 'https://bat.bing-int.net/adsdk/logs' } });
  },
  function (e, t, n) {
    'use strict';
    Object.defineProperty(t, '__esModule', { value: !0 }), (t.showDebugMessage = void 0);
    const r = n(1),
      o = (e) => ({
        debug: '#888888',
        log: e ? '#FFFFFF' : '#000000',
        info: '#0000FF',
        warning: '#FFA500',
        error: '#FF0000',
        exception: '#8B0000',
      });
    t.showDebugMessage = function (e) {
      var t, n, i;
      const a = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
        s = 'custom' === e.type ? `[${e.type}] ${null === (t = e.data) || void 0 === t ? void 0 : t.subtype}` : e.type,
        c =
          'custom' === e.type
            ? o(a).debug
            : 'event' === e.type
              ? o(a).info
              : 'unhandledError' === e.type
                ? o(a).exception
                : 'handledError' === e.type
                  ? o(a).error
                  : o(a).log,
        l = /error/i.test(String(e.type)),
        d = 'Telemetry logging: %c' + s,
        u = `font-size: 15px; font-weight: bold; color: ${c};`;
      if (
        (l ? console.group(d, u) : console.groupCollapsed(d, u),
        console.log('body', 'object' == typeof e ? JSON.parse((0, r.stringifyLogBody)(e)) : e),
        'string' == typeof e.data)
      ) {
        const t = JSON.parse(e.data);
        if ((console.log('body.data:', t), l)) {
          let e = t;
          for (; e; ) {
            const t = new Error();
            (t.name = e.name),
              (t.message = e.message),
              (t.filename = e.filename),
              (t.lineno = e.lineno),
              (t.colno = e.colno),
              (t.stack = e.stack || (null === (n = e.error) || void 0 === n ? void 0 : n.stack)),
              (t.type = e.type),
              console.error(t),
              (null === (i = e.debugData) || void 0 === i ? void 0 : i.cause)
                ? (console.log('--\x3e Caused by:'), (e = e.debugData.cause))
                : (e = void 0);
          }
        }
      }
      console.groupEnd(), console.log('--------------------');
    };
  },
  function (e, t, n) {
    'use strict';
    Object.defineProperty(t, '__esModule', { value: !0 }),
      (t.ErrorsTelemetry = t.ErrorsTelemetryClass = t.initListenUnhandledErrors = void 0);
    const r = n(1),
      o = n(4),
      i = n(17);
    t.initListenUnhandledErrors = function (e) {
      var t;
      window.addEventListener('error', (t) => {
        (0, r.isAdSdkUrl)(t.filename) && e.trackCriticalError('unhandled', t);
      }),
        (null === (t = (0, r.getTopLevelUrl)()) || void 0 === t ? void 0 : t.includes('give_me_error_please')) &&
          setTimeout(() => {
            throw new Error("I'm error from the prod");
          }, 1e3);
    };
    class a extends o.BaseTelemetryClass {
      logError(e, t, n, o) {
        var i;
        const a = n;
        this.log(
          {
            severity: e,
            type: (0, r.createTelemetryType)('error', t),
            message: null == n ? void 0 : n.message,
            data: n
              ? {
                  filename: null == a ? void 0 : a.filename,
                  lineno: null == a ? void 0 : a.lineno,
                  colno: null == a ? void 0 : a.colno,
                  stack:
                    (null == a ? void 0 : a.stack) ||
                    (null === (i = null == n ? void 0 : n.error) || void 0 === i ? void 0 : i.stack),
                  type: null == n ? void 0 : n.type,
                  debugData: null == n ? void 0 : n.debugData,
                }
              : void 0,
          },
          { id: o }
        );
      }
      trackCriticalError(e, t, n) {
        this.logError(i.Severity.Critical, e, t, n);
      }
      trackHighImpactError(e, t, n) {
        this.logError(i.Severity.HighImpact, e, t, n);
      }
      trackAlertError(e, t, n) {
        this.logError(i.Severity.Alert, e, t, n);
      }
    }
    (t.ErrorsTelemetryClass = a), (t.ErrorsTelemetry = new a());
  },
  function (e, t, n) {
    'use strict';
    Object.defineProperty(t, '__esModule', { value: !0 }),
      (t.Severity = void 0),
      (function (e) {
        (e[(e.Critical = 1)] = 'Critical'), (e[(e.HighImpact = 2)] = 'HighImpact'), (e[(e.Alert = 3)] = 'Alert');
      })(t.Severity || (t.Severity = {}));
  },
  function (e, t, n) {
    'use strict';
    Object.defineProperty(t, '__esModule', { value: !0 }), (t.mediationTelemetryEvents = t.commonTelemetryEvents = void 0);
    const r = n(1);
    t.commonTelemetryEvents = {
      sdkInit: 'sdkInit',
      adServerRequest: 'adServerRequest',
      adServerRequestFill: 'adServerRequestFill',
      adServerRequestNoFill: 'adServerRequestNoFill',
      impression: 'impression',
      mrcView: 'mrcView',
      adClick: 'adClick',
    };
    const o = (e) => (0, r.createTelemetryType)('mediation', e);
    t.mediationTelemetryEvents = {
      mediationOptIn: o('optIn'),
      mediationOptOut: o('optOut'),
      mediationAdServerRequest: o('adServerRequest'),
      mediationAdServerRequestFill: o('adServerRequestFill'),
      mediationAdServerRequestNoFill: o('adServerRequestNoFill'),
      mediationImpression: o('impression'),
      mediationMrcView: o('mrcView'),
      mediationAdClick: o('adClick'),
      mediationTimeout: o('timeout'),
    };
  },
  function (e, t, n) {
    'use strict';
    (function (e) {
      Object.defineProperty(t, '__esModule', { value: !0 }), (t.PerformanceTelemetry = t.PerformanceTelemetryClass = void 0);
      const r = n(4),
        o = n(8),
        i = n(1),
        a = n(20);
      class s extends r.BaseTelemetryClass {
        constructor() {
          super(...arguments),
            (this.resourcesToTrackFilters = { sdksFiles: i.isAdSdkUrl }),
            (this.logResourcePerf = (e) => {
              const { duration: t, name: n } = e;
              if (!n.includes(o.config.telemetry.endpoint))
                for (const [e, r] of Object.entries(this.resourcesToTrackFilters))
                  if (r(n)) {
                    this.log({
                      type: (0, i.createTelemetryType)('perf', a.PerformanceTypes.resource, e),
                      data: { duration: Math.ceil(t), name: n },
                    });
                    break;
                  }
            });
        }
        disconnectPerfObserver() {
          this.observer && this.observer.disconnect();
        }
        createStartMark(e) {
          performance.mark(e + '_start');
        }
        trackMark(e, t, n) {
          performance.mark(e + '_end'),
            this.logMarks({ measureName: e, startMarkName: e + '_start', endMarkName: e + '_end' }, t, n);
        }
        logMarks({ measureName: t, startMarkName: n, endMarkName: r }, o, s) {
          const c = performance.measure(t, n, r);
          if (!c) {
            if (e.env.IS_DEV) throw new Error(`Measure ${t} was not created`);
            return;
          }
          const { duration: l } = c;
          this.log(
            {
              type: (0, i.createTelemetryType)('perf', a.PerformanceTypes.measure, t),
              data: Object.assign(Object.assign({}, o), { duration: Math.ceil(l) }),
            },
            { id: s }
          );
        }
        init() {
          this.connectPerfObserver(), this.sendResourcesTiming();
        }
        sendResourcesTiming() {
          if (!performance.getEntriesByType) return;
          window.performance.getEntriesByType('resource').forEach(this.logResourcePerf);
        }
        connectPerfObserver() {
          window.PerformanceObserver &&
            ((this.observer = new PerformanceObserver((e) => {
              e.getEntries().forEach(this.logResourcePerf);
            })),
            this.observer.observe({ entryTypes: ['resource'] }));
        }
        addResourceToTrack(e, t) {
          this.resourcesToTrackFilters[e] = t;
        }
      }
      (t.PerformanceTelemetryClass = s), (t.PerformanceTelemetry = new s());
    }).call(this, n(3));
  },
  function (e, t, n) {
    'use strict';
    Object.defineProperty(t, '__esModule', { value: !0 }),
      (t.PerformanceTypes = void 0),
      (function (e) {
        (e.resource = 'resource'), (e.measure = 'measure');
      })(t.PerformanceTypes || (t.PerformanceTypes = {}));
  },
  function (e, t, n) {
    'use strict';
    n.r(t);
    var r = n(0),
      o =
        (n(2),
        r.d.RTB,
        r.p.BANNER,
        r.p.CONTENT,
        window.document.location.protocol,
        function (e) {
          var t = e.strategy,
            n = e.data,
            r = e.postMsgPayload,
            o = e.responseCb,
            a = F().document.createElement('iframe');
          return (
            (r || o) &&
              (function (e, t, n) {
                var r = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : 'https://acdn.adnxs.com',
                  o = new MessageChannel(),
                  i = o.port1;
                e.addEventListener(
                  'load',
                  function () {
                    var a = JSON.stringify({ astMsg: { payload: t } });
                    e.contentWindow.postMessage('port setup', r, [o.port2]),
                      'function' == typeof n && (i.onmessage = n),
                      i.postMessage(a);
                  },
                  { once: !0 }
                );
              })(a, r, o),
            (a.width = 0),
            (a.height = 0),
            (a.border = '0'),
            (a.hspace = '0'),
            (a.vspace = '0'),
            (a.tabIndex = '-1'),
            (a.marginWidth = '0'),
            (a.marginHeight = '0'),
            (a.style.border = '0'),
            (a.style.display = 'none'),
            (a.scrolling = 'no'),
            (a.frameBorder = '0'),
            'WithContent' === t &&
              (function (e, t) {
                i(e), e.contentWindow.document.open(), e.contentWindow.document.write(t), e.contentWindow.document.close();
              })(a, n),
            'WithAttributes' === t &&
              (function (e, t) {
                (e.src = t.src), (e.id = t.id), (e.name = t.name), t.allow && (e.allow = t.allow);
                t.sandbox && (e.sandbox = t.sandbox);
                i(e);
              })(a, n),
            'WithContentAndAttributes' === t &&
              (function (e, t) {
                var n = t.content,
                  r = t.attributes;
                i(e),
                  n &&
                    (e.contentWindow.document.open(), e.contentWindow.document.write(n), e.contentWindow.document.close());
                for (var o in r) r.hasOwnProperty(o) && e.setAttribute(o, r[o]);
              })(a, n),
            a
          );
        });
    function i(e) {
      var t = F().document.getElementsByTagName('body');
      t.length && t[0].appendChild(e);
    }
    var a = r.o.ARRAY,
      s = r.o.STRING,
      c = r.o.FUNC,
      l = r.o.NUM,
      d = r.o.OBJ,
      u = Object.prototype.hasOwnProperty,
      f = !1,
      m = r.e.DEBUG_MODE,
      p = r.k.UNDEFINED,
      g = (r.d.RTB, r.d.CSM, r.d.SSM, r.g, null);
    try {
      g = 'object' == typeof console.info && null !== console.info ? console.info : console.info.bind(window.console);
    } catch (e) {}
    var v = function (e, t, n, r) {
        e.addEventListener ? e.addEventListener(t, n, r) : e.attachEvent && e.attachEvent('on' + t, n);
      },
      y = function (e, t, n, r) {
        e.removeEventListener ? e.removeEventListener(t, n, r) : e.detachEvent && e.detachEvent('on' + t, n);
      },
      h = function (e, t) {
        return Object.prototype.toString.call(e) === '[object ' + t + ']';
      },
      w = function (e) {
        return h(e, d);
      },
      T = function (e) {
        return h(e, c);
      },
      b = function (e) {
        return h(e, s);
      },
      E = function (e) {
        return h(e, a);
      };
    var S = function (e) {
        if (!e) return !0;
        if (E(e) || b(e)) return 0 === e.length;
        for (var t in e) if (u.call(e, t)) return !1;
        return !0;
      },
      I = function () {
        return window.console && window.console.log;
      },
      _ = function () {
        var e = new Date();
        return '[' + e.getHours() + ':' + e.getMinutes() + ':' + e.getSeconds() + ':' + e.getMilliseconds() + '] ';
      },
      O = function (e) {
        if (x() && I()) {
          for (
            var t,
              n = _(),
              r = U() ? 'SAFEFRAME MESSAGE: ' : 'MESSAGE: ',
              o = arguments.length,
              i = Array(o > 1 ? o - 1 : 0),
              a = 1;
            a < o;
            a++
          )
            i[a - 1] = arguments[a];
          (t = console).log.apply(t, [n + r + e].concat(i));
        }
      },
      N = function (e) {
        if (x() && I()) {
          for (
            var t,
              n,
              r = _(),
              o = U() ? 'SAFEFRAME WARN: ' : 'WARN: ',
              i = arguments.length,
              a = Array(i > 1 ? i - 1 : 0),
              s = 1;
            s < i;
            s++
          )
            a[s - 1] = arguments[s];
          if (console.warn) (t = console).warn.apply(t, [r + o + e].concat(a));
          else (n = console).log.apply(n, [r + o + e].concat(a));
        }
      },
      A = function (e, t) {
        if (x() && I()) {
          for (
            var n,
              r,
              o = t || 'GENERAL_ERROR',
              i = _(),
              a = U() ? 'SAFEFRAME ' : '',
              s = arguments.length,
              c = Array(s > 2 ? s - 2 : 0),
              l = 2;
            l < s;
            l++
          )
            c[l - 2] = arguments[l];
          if (console.error) (n = console).error.apply(n, [i + a + o + ': ' + e].concat(c));
          else (r = console).log.apply(r, [i + a + o + ': ' + e].concat(c));
        }
      },
      D = function (e, t) {
        if (x() && I()) {
          var n = _();
          if (g) {
            (t && 0 !== t.length) || (t = '');
            var r = U() ? 'SAFEFRAME INFO: ' : 'INFO: ';
            g(n + r + e + ('' === t ? '' : ' : params : '), t);
          }
        }
      },
      k = function (e, t, n) {
        var r = e.document,
          o = r.createElement('script');
        (o.type = 'text/javascript'),
          (o.async = !0),
          n &&
            'function' == typeof n &&
            (o.readyState
              ? (o.onreadystatechange = function () {
                  ('loaded' !== o.readyState && 'complete' !== o.readyState) || ((o.onreadystatechange = null), n());
                })
              : (o.onload = function () {
                  n();
                })),
          (o.src = t);
        var i = r.getElementsByTagName('head');
        return (i = i.length ? i : r.getElementsByTagName('body')).length && (i = i[0]).insertBefore(o, i.firstChild), o;
      },
      R = function (e, t) {
        if (!S(e)) {
          if (T(e.forEach)) return e.forEach(t);
          var n = 0,
            r = e.length;
          if (r > 0) for (; n < r; n++) t(e[n], n, e);
          else for (n in e) u.call(e, n) && t(e[n], n, e);
        }
      },
      x = function () {
        return (
          !!U() ||
          ((F().apntag = F().apntag || {}),
          apntag && !1 === apntag.debug && !1 === f && ((apntag.debug = 'TRUE' === P(m).toUpperCase()), (f = !0)),
          !(!apntag || !apntag.debug))
        );
      },
      P = function (e, t) {
        var n = new RegExp('[\\?&]' + e + '=([^&#]*)').exec(
          t ||
            (function () {
              try {
                return window.top.location.search;
              } catch (e) {
                try {
                  return window.location.search;
                } catch (e) {
                  return '';
                }
              }
            })()
        );
        return null === n ? '' : decodeURIComponent(n[1].replace(/\+/g, ' '));
      },
      M = function (e, t) {
        return e.hasOwnProperty ? e.hasOwnProperty(t) : typeof e[t] !== p && e.constructor.prototype[t] !== e[t];
      },
      C = function (e, t, n, r) {
        return null == t
          ? r
          : h(t, n)
            ? t
            : (N('Unsuported type for param: ' + e + ' required type: ' + n), n === l && (t = Number(t)), isNaN(t) ? r : t);
      },
      F = function () {
        return window;
      };
    function U() {
      return !(typeof $sf === p || !$sf.ext) && !!$sf.ext.debug;
    }
    var L,
      j = function () {
        return F().document.location.protocol + '//' + r.h.CDN_ORIGIN;
      },
      B = function (e, t) {
        var n = void 0;
        if (T(e))
          return function () {
            return e && ((n = e.apply(t || this, arguments)), (e = null)), n;
          };
      };
    L = 0;
    function V(e) {
      var t = ['auto', 'auto'];
      if (e) {
        var n = (function (e) {
          var t = void 0,
            n = void 0;
          if (Array.isArray(e) && e.length > 0)
            if (Array.isArray(e[0]) && e[0].length > 0) {
              var r = e[0];
              2 === r.length && 'number' == typeof r[0] && 'number' == typeof r[1] && ((n = r[0]), (t = r[1]));
            } else 2 === e.length && 'number' == typeof e[0] && 'number' == typeof e[1] && ((n = e[0]), (t = e[1]));
          return [n, t];
        })(e);
        0 !== n[0] && 1 !== n[0] && 0 !== n[1] && 1 !== n[1] && 2 !== n[1] && (t = n);
      }
      return t;
    }
    var W,
      G =
        ((W = void 0),
        {
          setCallback: function (e) {
            this.getInstance().creativeCb = e;
          },
          getInstance: function (e) {
            if (((e = e || null), !W))
              try {
                W = (function (e) {
                  return {
                    targetId: e.targetId,
                    host: e.host,
                    ad: e.ad,
                    geom: e.geom,
                    debug: e.debug,
                    supports: e.hostSfSupport,
                    meta: e.meta,
                    status: 'ready',
                    creativeCb: function () {},
                    hasFocus: !1,
                  };
                })(e);
              } catch (e) {
                A('No arguments passed', null, e);
              }
            return W;
          },
        });
    function J(e, t, n, r) {
      return { eventType: e, targetId: t, data: n, exception: r };
    }
    var Y =
      'https:' ===
      (function () {
        try {
          return F().top.document.location.protocol;
        } catch (e) {
          return F().document.location.protocol;
        }
      })()
        ? 'https:'
        : 'http:';
    r.h.VIDEO_MEDIATION_JS, r.h.BANNER_MEDIATION_JS, r.p.AD_TYPE, r.b.BANNER, r.b.VIDEO;
    var H = (function () {
        var e = void 0,
          t = {};
        return {
          getInstance: function () {
            return (
              e ||
                (e = {
                  add: function (e, n) {
                    t[e] = n;
                  },
                  getIframe: function (e) {
                    return M(t, e) ? t[e] : null;
                  },
                  getIframes: function () {
                    return t;
                  },
                  resetInstance: function () {
                    t = {};
                  },
                  removeIframe: function (e) {
                    return M(t, e) ? (delete t[e], t) : null;
                  },
                }),
              e
            );
          },
        };
      })(),
      q = window.document,
      X = 'auto',
      $ = 'scroll',
      z = 'getAttribute',
      K = 'setAttribute',
      Z = 'removeAttribute',
      Q = window.Number,
      ee = Q && Q.MAX_VALUE,
      te = -1 * ee,
      ne = 'toLowerCase',
      re = 'toFixed',
      oe = 'length',
      ie = 'overflow',
      ae = window.String,
      se = window.Math,
      ce = Math.max,
      le = Math.min,
      de = Math.round,
      ue = window,
      fe = window.navigator,
      me = fe.userAgent || '',
      pe = !(!window.ActiveXObject && 'ActiveXObject' in window) && ue && 'ActiveXObject' in ue,
      ge = (function () {
        var e,
          t = {};
        (t.ie =
          t.opera =
          t.gecko =
          t.webkit =
          t.safari =
          t.chrome =
          t.air =
          t.ipod =
          t.ipad =
          t.iphone =
          t.android =
          t.webos =
          t.silk =
          t.nodejs =
          t.phantomjs =
            0),
          (t.mobile = t.ios = t.caja = fe && fe.cajaVersion);
        var n = me;
        n &&
          (Re(/KHTML/, n) && (t.webkit = 1),
          Re(/IEMobile|XBLWP7/, n) && (t.mobile = 'windows'),
          Re(/Fennec/, n) && (t.mobile = 'gecko'),
          (e = ke(n, /AppleWebKit\/([^\s]*)/, 1)) &&
            ((t.webkit = De(e)),
            (t.safari = t.webkit),
            Re(/PhantomJS/, n) && (e = ke(n, /PhantomJS\/([^\s]*)/, 1)) && (t.phantomjs = De(e)),
            Re(/ Mobile\//, n) || Re(/iPad|iPod|iPhone/, n)
              ? ((t.mobile = 'Apple'),
                (e = (e = ke(n, /OS ([^\s]*)/, 1)) && De(e.replace('_', '.'))),
                (t.ios = e),
                (t.ipad = t.ipod = t.iphone = 0),
                (e = ke(n, /iPad|iPod|iPhone/, 0)) && (t[e[ne]()] = t.ios))
              : ((e = ke(n, /NokiaN[^\/]*|Android \d\.\d|webOS\/\d\.\d/, 0)) && (t.mobile = e),
                Re(/webOS/, n) && ((t.mobile = 'WebOS'), (e = ke(n, /webOS\/([^\s]*);/, 1)) && (t.webos = De(e))),
                Re(/ Android/, n) && ((t.mobile = 'Android'), (e = ke(n, /Android ([^\s]*);/, 1)) && (t.android = De(e))),
                Re(/Silk/, n) && (e = ke(n, /Silk\/([^\s]*)\)/, 1)) && (t.silk = De(e))),
            (e = n.match(/(Chrome|CrMo)\/([^\s]*)/)) && e[1] && e[2]
              ? ((t.chrome = De(e[2])), (t.safari = 0), 'CrMo' === e[1] && (t.mobile = 'chrome'))
              : (e = ke(n, /AdobeAIR\/([^\s]*)/)) && (t.air = e[0])),
          t.webkit ||
            ((e = ke(n, /Opera[\s\/]([^\s]*)/, 1))
              ? ((t.opera = De(e)), (e = ke(n, /Opera Mini[^;]*/, 0)) && (t.mobile = e))
              : (e = ke(n, /MSIE\s([^;]*)/, 1))
                ? (t.ie = De(e))
                : (e = ke(n, /Gecko\/([^\s]*)/)) && ((t.gecko = 1), (e = ke(n, /rv:([^\s\)]*)/, 1)) && (t.gecko = De(e)))));
        return t;
      })(),
      ve = ge.ie || 0,
      ye = ge.webkit || 0,
      he = ge.gecko || 0,
      we = ge.opera || 0,
      Te = 0,
      be = {},
      Ee = 'clientWidth',
      Se = 'clientHeight';
    function Ie(e) {
      var t,
        n,
        r,
        o,
        i,
        a,
        s,
        c,
        l,
        d = { t: 0, l: 0, r: 0, b: 0, w: 0, h: 0, z: 0 },
        u = 'getBoundingClientRect',
        f = 0,
        m = 0,
        p = 0,
        g = 0,
        v = !1,
        y = Fe(e) || ue.document,
        h = y.compatMode,
        w = y.documentMode || 0;
      if (_e(e))
        try {
          if (
            ((i = Pe(e)),
            (t = Ue(e)),
            (n = Ge(e)),
            (d.l = e.offsetLeft || 0),
            (d.t = e.offsetTop || 0),
            (r = e),
            (o = null),
            (v = he || ye > 519),
            !(e === t) && e[u])
          )
            pe && (!w || (w > 0 && w < 8) || 'BackCompat' === h) && ((s = t.clientLeft), (c = t.clientTop)),
              (l = e[u]()),
              (d.t = l.top),
              (d.l = l.left),
              (s || c) && ((d.l -= s), (d.t -= c)),
              (n.y || n.x) && (!ge.ios || ge.ios >= 4.2) && ((d.l += n.x), (d.t += n.y));
          else {
            for (; (r = r.offsetParent) && _e(r) && o !== r; )
              (s = r.offsetLeft), (c = r.offsetTop), (d.t += c), (d.l += s), v && (d = Me(r, d)), (o = r);
            if ('fixed' != i.position) {
              for (r = e, o = null; (r = r.parentNode) && _e(r) && o !== r && r != t; )
                (f = r.scrollTop),
                  (m = r.scrollLeft),
                  he && 'visible' != (a = Pe(r))[ie] && (d = Me(r, d, a)),
                  (f || m) && ((d.l -= m), (d.t -= f)),
                  (o = r);
              (d.l += n.x), (d.t += n.y);
            } else (d.l += n.x), (d.t += n.y);
          }
          e == t ? ((g = e[Se]), (p = e[Ee])) : ((g = e.offsetHeight), (p = e.offsetWidth)),
            (d.b = d.t + g),
            (d.r = d.l + p),
            (d.w = ce(p, 0)),
            (d.h = ce(g, 0)),
            (d.z = i.zIndex);
        } catch (e) {
          d = { t: 0, l: 0, r: 0, b: 0, w: 0, h: 0, z: 0 };
        }
      return d;
    }
    function _e(e) {
      return 1 === Oe(e);
    }
    function Oe(e) {
      return je(e && e.nodeType, -1);
    }
    function Ne(e) {
      return !(!(e = Ae(e)) || -1 != e.search(/\D+/g)) || !(!e || -1 == e.search(/px/gi)) || void 0;
    }
    function Ae(e) {
      var t = typeof e;
      return 'string' == t
        ? e
        : 'number' != t || e
          ? 'object' == t && e && e.join
            ? e.join('')
            : !1 === e
              ? 'false'
              : !0 === e
                ? 'true'
                : e
                  ? ae(e)
                  : ''
          : '0';
    }
    function De(e) {
      var t = 0;
      return parseFloat(
        e.replace(/\./g, function () {
          return 1 == t++ ? '' : '.';
        })
      );
    }
    function ke(e, t, n) {
      var r = e && e.match(t);
      return null == n ? r : (r && r[n]) || null;
    }
    function Re(e, t) {
      return e.test(t);
    }
    function xe(e) {
      var t,
        n = null;
      try {
        e &&
          ((n = e.parentWindow || e.defaultView || null) ||
            (n = ((t = Fe(e)) && (t.parentWindow || t.defaultView)) || null));
      } catch (e) {
        n = null;
      }
      return n;
    }
    function Pe(e) {
      var t;
      if (xe(e).getComputedStyle)
        try {
          t = xe(e).getComputedStyle(e, null);
        } catch (e) {
          t = null;
        }
      else
        try {
          t = e.currentStyle;
        } catch (e) {
          t = null;
        }
      return t;
    }
    function Me(e, t, n) {
      var r = 0,
        o = 0;
      return (
        (n = n || Pe(e)) &&
          ((r = n.borderTopWidth),
          (o = n.borderLeftWidth),
          (r = Ne(r) ? je(r, 0) : 0),
          (o = Ne(o) ? je(o, 0) : 0),
          he && /^t(?:able|d|h|r|head|foot)$/i.test(Ve(e)) && (r = o = 0)),
        ((t = t || { t: 0, l: 0 }).t += r),
        (t.l += o),
        t
      );
    }
    function Ce(e) {
      return e && (e.parentNode || e.parentElement);
    }
    function Fe(e) {
      var t = null;
      try {
        e && (t = 9 == Oe(e) ? e : e.document || e.ownerDocument || null);
      } catch (e) {
        t = null;
      }
      return t;
    }
    function Ue(e) {
      var t = (e && Fe(e)) || q,
        n = t.compatMode,
        r = t.documentElement;
      return n && !we && 'CSS1Compat' != n && (r = t.body), r;
    }
    function Le(e) {
      var t,
        n,
        r,
        o,
        i = [-1, -1, -1, -1],
        a = ['clipTop', 'clipRight', 'clipBottom', 'clipLeft'],
        s = 0;
      if (!e) return i;
      if (ve) for (; (n = a[s]); ) Ne((t = e[n])) && (t = je(t, -1)) >= 0 && (i[s] = t), s++;
      else if ((t = e.clip) && -1 != t.search(/\d+/g))
        for (
          o = (i = (i = (t = t.replace(/\w+\(([^\)]*?)\)/g, '$1')).split(' '))[oe] <= 1 ? i.split(',') : i)[oe], s = 0;
          o--;

        )
          Ne((r = i[s])) ? (i[s] = je(r, -1)) : (i[s] = -1), s++;
      return i;
    }
    function je(e, t, n, r) {
      if ('number' != typeof e)
        try {
          e = e ? parseFloat(e) : Q.NaN;
        } catch (t) {
          e = Q.NaN;
        }
      return null == r && (r = ee), null == n && (n = te), (isNaN(e) || e < n || e > r) && null != t ? t : e;
    }
    function Be(e, t) {
      var n = !1,
        r = (e && e.nodeType) || -1,
        o = (t && t.nodeType) || -1;
      if (1 == r && -1 != o)
        if (e.contains)
          if (we || 1 == o) n = e.contains(t);
          else
            for (; t; ) {
              if (e === t) {
                n = !0;
                break;
              }
              t = t.parentNode;
            }
        else e.compareDocumentPosition && (n = e === t || !!(16 & e.compareDocumentPosition(t)));
      return n;
    }
    function Ve(e) {
      return (e && 1 == e.nodeType && e.tagName[ne]()) || '';
    }
    function We(e, t, n) {
      try {
        arguments[oe] > 2
          ? null === n
            ? e[Z](t)
            : ((n = Ae(n)), 'class' == t[ne]() ? (e.className = n) : e[K](t, n))
          : (n = Ae(e[z](t)));
      } catch (e) {
        n = '';
      }
      return n;
    }
    function Ge(e) {
      var t,
        n,
        r,
        o,
        i = { x: 0, y: 0, w: 0, h: 0 },
        a = { scrollLeft: 0, scrollTop: 0, scrollWidth: 0, scrollHeight: 0 },
        s = 0,
        c = 0;
      return (
        (n = (t = Fe(e) || q).documentElement || a),
        (o = t.body || a),
        (r = t.defaultView) && ((s = je(r.pageXOffset, 0)), (c = je(r.pageYOffset, 0))),
        (i.x = ce(n.scrollLeft, o.scrollLeft, s)),
        (i.y = ce(n.scrollTop, o.scrollTop, c)),
        (i.w = ce(n.scrollWidth, o.scrollWidth, 0)),
        (i.h = ce(n.scrollHeight, o.scrollHeight, 0)),
        i
      );
    }
    function Je(e, t, n) {
      var r,
        o,
        i,
        a,
        s,
        c,
        l,
        d,
        u,
        f,
        m,
        p,
        g,
        v,
        y,
        h,
        w,
        T,
        b,
        E,
        S,
        I,
        _,
        O,
        N,
        A,
        D,
        k,
        R,
        x,
        P,
        M,
        C,
        F,
        U,
        L = e && Ce(e),
        j = Ue(e),
        B = Ie(e),
        V = Ie(j),
        W = Ge(j),
        G = (function (e) {
          var t = Ue(e),
            n = 0,
            r = 0;
          return t && ((n = t.scrollWidth || 0), (r = t.scrollHeight || 0)), { t: 0, l: 0, b: r, r: n, w: n, h: r };
        })(e),
        J = { t: 0, l: 0, r: 0, b: 0, w: 0, h: 0 },
        Y = { t: 0, l: 0, r: 0, b: 0, xs: 0, ys: 0, xiv: 0, yiv: 0, iv: 0, w: 0, h: 0 },
        H = [],
        q = !1,
        z = { left: null, right: null, top: null, bottom: null };
      if (((t = t && 'object' == typeof t ? t : {}), L))
        for (
          r = V.t, o = V.l, i = V.r, a = V.b;
          (l = Pe(L)) &&
          (('block' != l.display && 'absolute' != l.position && 'none' == l.float && 'none' == l.clear) ||
            ((q = L == j),
            (f = (F = Ie(L)).t),
            (m = F.l),
            (p = F.r),
            (g = F.b),
            (E = l[ie + 'X']),
            (S = l[ie + 'Y']),
            (I = l[ie]),
            (_ = q ? [-1, -1, -1, -1] : Le(l)),
            (U = !1),
            q ? ((v = W.w), (w = W.h)) : ((v = L.scrollWidth), (w = L.scrollHeight)),
            (y = L.offsetWidth),
            (T = L.offsetHeight),
            (h = L[Ee]),
            (b = L[Se]),
            !c && y > h && (c = y - h),
            !s && T > b && (s = T - b),
            q
              ? (v > h && ((m = 0) > o && (o = m), (p = (ue.innerWidth || y) + W.x) < i && (i = p)),
                w > b && ((f = 0) > r && (r = f), (g = (ue.innerHeight || T) + W.y) < a && (a = g)))
              : (c && p - m == y && (p -= c),
                s && g - f == T && (g -= s),
                ('hidden' != E && E != $ && E != X && 'hidden' != I && I != $ && I != X) ||
                  (m > o && ((o = m), (z.left = L)),
                  p < i && ((i = p), (z.right = L)),
                  (E == $ || I == $ || ((E == X || I == X) && v > h)) && (H.push(L), (U = !0))),
                _[3] > 0 && (k = m + _[3]) > o && ((o = k), (z.left = L)),
                _[1] > 0 && (R = p + _[1]) < i && ((i = R), (z.right = L)),
                ('hidden' != S && S != $ && S != X && 'hidden' != I && I != $ && I != X) ||
                  (f > r && ((r = f), (z.top = L)),
                  g < a && ((a = g), (z.bottom = L)),
                  U || ((S == $ || I == $ || ((S == X || I == X) && w > b)) && (H.push(L), (U = !0)))),
                _[0] > 0 && (A = f + _[0]) > r && ((r = A), (z.top = L)),
                _[2] > 0 && (D = F.t + _[2]) < a && ((a = D), (z.bottom = L)))),
          L != j) &&
          (L = Ce(L)) &&
          Ve(L);

        );
      return (
        ((J = { t: ce(r, 0), l: ce(o, 0), r: ce(i, 0), b: ce(a, 0) }).w = ce(J.r - J.l, 0)),
        (J.h = ce(J.b - J.t, 0)),
        (m = B.l),
        (p = B.r),
        (f = B.t),
        (d = p - m),
        (u = (g = B.b) - f),
        (k = J.l),
        (R = J.r),
        (A = J.t),
        R - k,
        (D = J.b) - A,
        (N = (N = (N = le(g, D) - ce(f, A)) < 0 ? 0 : N) > u ? u : N),
        (O = (O = (O = le(p, R) - ce(m, k)) < 0 ? 0 : O) > d ? d : O),
        (Y.t = A < f ? (D <= f ? 0 : ce(f - A, 0)) : 0),
        (Y.b = D > g ? (g <= A ? 0 : ce(D - g, 0)) : 0),
        (Y.l = k < m ? (R <= m || D <= f || g <= A ? 0 : ce(m - k, 0)) : 0),
        (Y.r = R > p ? (p <= k || D <= f ? 0 : ce(R - p, 0)) : 0),
        (Y.w = ce(Y.r - Y.l, 0)),
        (Y.h = ce(Y.b - Y.t, 0)),
        (Y.xiv = d > 0 ? je((O / d)[re](2)) : 0),
        (Y.yiv = u > 0 ? je((N / u)[re](2)) : 0),
        (Y.iv = d > 0 || u > 0 ? je(((O * N) / (d * u))[re](2)) : 0),
        (Y.civ = 0),
        n &&
          Y.iv > 0.49 &&
          ((x = (C = (function (e) {
            var t,
              n,
              r,
              o,
              i,
              a,
              s,
              c,
              l,
              d,
              u,
              f,
              m,
              p,
              g,
              v,
              y = Ie(e),
              h = Fe(e),
              w = Ue(h),
              T = y.t,
              b = y.l,
              E = [],
              S = 0;
            if (
              ((E.on = 0),
              (t = y.w),
              (n = y.h),
              (i = r = de(t / 10)),
              (a = o = de(n / 10)),
              t <= 1 || n <= 1 || r < 1 || o < 1)
            )
              return E;
            if (((g = (v = Ge()).y), (p = v.x), (f = b + t), (m = T + n), h && w && h.elementFromPoint)) {
              for (; i < t; ) {
                for (a = o; a < n; ) (c = T + a), (s = b + i) <= f && c <= m && E.push({ x: s, y: c, on: 0 }), (a += o);
                i += r;
              }
              for (; (l = E[S++]); )
                (s = ce(l.x - p, 0)),
                  (s = le(s, l.x)),
                  (c = ce(l.y - g, 0)),
                  (c = le(c, l.y)),
                  0 != s
                    ? 0 != c
                      ? (u = h.elementFromPoint(s, c)) &&
                        u !== w &&
                        u !== e &&
                        !Be(u, e) &&
                        ((d = We(u, 'id')) ||
                          We(
                            u,
                            'id',
                            (d = Ae([
                              'geom_inter' || '',
                              '_',
                              new Date().getTime(),
                              '_',
                              se.round(100 * se.random()),
                              '_',
                              Te++,
                            ]))
                          ),
                        (l.on = d),
                        E.on++)
                      : ((l.on = '!y-offscreen'), E.on++)
                    : ((l.on = '!x-offscreen'), E.on++);
            }
            return E;
          })(e))[oe]),
          (P = je(C.on, 0)) && ((M = 1 - je((P / x)[re](2), 0)), (Y.civ = Y.iv = M))),
        (t.rect = B),
        (t.clipRect = J),
        (t.docRect = G),
        H[oe]
          ? ((t.isRoot = !1), (t.canScroll = !0), (Y.xs = !!s), (Y.ys = !!c))
          : V.b >= J.b || V.r >= J.r
            ? ((t.isRoot = !0),
              (Y.xs = !!(G.w > V.w && s)),
              (Y.ys = !!(G.h > V.h && c)),
              (t.canScroll = G.w > V.w || G.h > V.h))
            : (Y.ys = Y.xs = t.isRoot = t.canScroll = !1),
        (t.scrollNodes = H),
        (t.clipNodes = z),
        (t.expRect = Y),
        Y
      );
    }
    function Ye(e, t, n) {
      var r,
        o,
        i,
        a,
        s,
        c,
        l,
        d,
        u,
        f,
        m,
        p,
        g = {},
        y = {};
      if ((Je(t, y, !0), !n && !y.isRoot && y.canScroll && ((o = y.expRect).xs || o.ys))) {
        qe(e), (r = []), (be[e] = r);
        for (var h = 0; h < y.scrollNodes.length; h++) {
          var w = y.scrollNodes[h],
            T = {};
          (T.node = w),
            (T.onscroll = function (t) {
              He(t, e, w);
            }),
            v(w, $, T.onscroll),
            r.push(T);
        }
      }
      return (
        (g.win =
          ((s = (a && xe(a)) || ue),
          (c = s.innerHeight || 0),
          (l = s.innerWidth || 0),
          (d = s.screenY || s.screenTop || 0),
          (u = c + d),
          (f = s.screenX || s.screenLeft || 0),
          (m = l + f),
          (p = Ue(a)),
          c || l || !p || ((c = p.clientHeight || 0), (m = f + (l = p.clientWidth || 0)), (u = d + c)),
          { t: d, l: f, b: u, r: m, w: l, h: c })),
        (g.par = y.clipRect),
        (o = y.expRect),
        ((i = y.rect).iv = o.iv),
        (i.xiv = o.xiv),
        (i.yiv = o.yiv),
        delete o.iv,
        delete o.xiv,
        delete o.yiv,
        (g.exp = o),
        (g.self = i),
        g
      );
    }
    function He(e, t, n) {
      var r = be[t];
      if (r)
        for (var o = 0; o < r.length; o++) {
          var i = r[o];
          if (i.node === n) {
            i.tID && (clearTimeout(i.tID), delete i.tID),
              (i.tID = setTimeout(function () {
                var e = H.getInstance().getIframe(t);
                e && at(e.iframe, t, Ye(t, e.iframe, !0));
              }, et));
            break;
          }
        }
    }
    function qe(e) {
      var t,
        n = be[e];
      if (n)
        for (; (t = n.pop()); )
          t.tID && clearTimeout(t.tID), y(t.node, $, t.onscroll), (t.node = t.onscroll = null), (be[e] = null);
      delete be[e];
    }
    var Xe = F();
    B(function () {
      v(Xe, 'focus', nt),
        v(Xe, 'blur', rt),
        v(Xe, 'resize', st),
        v(Xe, 'scroll', st),
        v(Xe, 'pagehide', function () {
          try {
            y(Xe, 'focus', nt), y(Xe, 'blur', rt), y(Xe, 'resize', st), y(Xe, 'scroll', st), ct();
          } catch (e) {}
        });
    }),
      F();
    var $e = null,
      ze = function () {
        return $e;
      };
    r.o.NUM;
    var Ke = 0,
      Ze = 0,
      Qe = 0,
      et = 500;
    var tt = function (e, t) {
        var n = Ye(e, t);
        return (
          (n.anx = (function () {
            try {
              if (void 0 !== window.top.location.href) {
                var e = window,
                  t = 0,
                  n = 0;
                do {
                  (t += e.pageYOffset || e.document.documentElement.scrollTop || e.document.body.scrollTop),
                    (n += e.pageXOffset || e.document.documentElement.scrollLeft || e.document.body.scrollLeft),
                    (e = e.parent);
                } while (e.parent !== window.top);
                return { scrollTop: t, scrollLeft: n };
              }
            } catch (e) {}
            return { scrollTop: 0, scrollLeft: 0 };
          })()),
          n
        );
      },
      nt = function () {
        ot(!0);
      },
      rt = function () {
        ot(!1);
      };
    function ot(e) {
      it(),
        (Ze = window.setTimeout(function () {
          var t, n;
          (t = e),
            (n = H.getInstance().getIframes()),
            R(n, function (e, n) {
              var o = apntag.requests.tags[n];
              if (o.alwaysUseXDomainIframe || o.enableSafeFrame) {
                var i = e.iframe.contentWindow,
                  a = {};
                (a.targetId = n), (a.value = t), (a.status = r.m.STATUS.FOCUS_CHANGE), dt(i, JSON.stringify(a), j());
              }
            }),
            it();
        }, 2));
    }
    function it() {
      Ze && (clearTimeout(Ze), (Ze = 0));
    }
    var at = function (e, t, n) {
      var o = e.contentWindow,
        i = {};
      (i.targetId = t), (i.geom = n), (i.status = r.m.STATUS.GEOM_UPDATE), dt(o, JSON.stringify(i), j());
    };
    var st = function () {
        Ke || (Ke = window.setTimeout(lt, et));
      },
      ct = function () {
        var e = H.getInstance().getIframes();
        R(e, function (e, t) {
          var n = apntag.requests.tags[t];
          (n.alwaysUseXDomainIframe || n.enableSafeFrame) && (clearInterval(Qe), (Qe = 0), qe(t));
        });
      };
    function lt() {
      var e = H.getInstance().getIframes();
      R(e, function (e, t) {
        var n = apntag.requests.tags[t];
        (n.alwaysUseXDomainIframe || n.enableSafeFrame) &&
          (function (e, t) {
            at(e, t, tt(t, e));
          })(e.iframe, t);
      }),
        Ke && (clearTimeout(Ke), (Ke = 0));
    }
    var dt = function (e, t, n) {
        'string' != typeof t && (t = JSON.stringify(t)), e ? e.postMessage(t, n) : O('Safeframe not yet rendered');
      },
      ut = (function () {
        var e = {},
          t = [],
          n = '';
        return {
          invokeNotify: function (n, r, o) {
            t.push(s(n, r, o)),
              R(e, function (e) {
                e.addNotifyMessage(s(n, r, o)), 'loading' !== e.status && a(e);
              });
          },
          loadRenderer: function (t, n) {
            var r = n.renderer_id;
            if (t.enableSafeFrame && (!window.$sf || !window.$sf.ext))
              return (
                (r = (function (e, t) {
                  return t.renderer_id + '_' + e.targetId;
                })(t, n)),
                void (e[r] = l(n.renderer_url, r, t))
              );
            var a = e[r];
            if (a) {
              var s = e[r];
              'loaded' === a.status ? (u(t), o(s, t, i), (t.displayed = !0)) : a.addTag(t);
            } else k(window, n.renderer_url), (e[r] = l(n.renderer_url, r, t));
          },
          setRendererStatus: function (t, n) {
            var r = e[t];
            r && ((r.status = n), a(r));
          },
          registerRenderer: function (t, s, c) {
            if (((n = c), (s = r(s)), t && e[t] && w(s))) {
              var l = e[t];
              (l.renderFn = s.renderAd),
                (l.notifyFn = s.notify),
                (l.status = 'loaded'),
                window.currentTag &&
                  window.currentTag.enableSafeFrame &&
                  ((d = window.currentTag),
                  (f = t),
                  (m = 'loaded'),
                  (p = { name: 'updateRenderStatus', targetId: d.targetId, rId: f, status: m }),
                  dt(window.parent, p, n)),
                a(l),
                R(l.getTags(), function (e) {
                  e.displayed ||
                    (u(e),
                    o(l.renderFn, e, function (e, t) {
                      i(e, t, l);
                    }),
                    (e.displayed = !0));
                });
            } else A('ast.js', null, 'registerRenderer must be called with (id, cbFn)');
            var d, f, m, p;
          },
          clearState: function () {
            (e = {}), (t = []);
          },
        };
        function r(e) {
          return T(e)
            ? { renderAd: e, notify: function () {} }
            : w(e) && T(e.renderAd)
              ? { renderAd: e.renderAd, notify: e.notify }
              : void 0;
        }
        function o(e, t, n) {
          T(e)
            ? e.call(apntag, t, n)
            : w(e) &&
              (T(e.renderFn)
                ? e.renderFn.call(apntag, t, n)
                : A('Error invoking rendererObj.renderAd(). renderAd must be a function'));
        }
        function i(e, t, r) {
          r && r.isSafeFrame
            ? (function (e, t, r) {
                var o = { name: 'emitEvent', cmd: [e, t] };
                if ((dt(window.parent, o, n), apntag.mockSfListner && apntag.mockSfListner.handler)) {
                  apntag.mockSfListner.handler(apntag.mockSfListner.adObj);
                  var i = { name: 'resizeAd', targetId: e, cmd: V(r.safeFrameSizes) };
                  dt(window.parent, i, n);
                }
              })(e, t, r)
            : apntag.emitEvent(e, t);
        }
        function a(e) {
          T(e.notifyFn) &&
            R(e.getNotifyMessages(), function (t) {
              t.sent || ((t.sent = !0), e.notifyFn(t.messageType, t.messagePayload, t.targetId));
            });
        }
        function s(e, t, n) {
          return { messageType: e, messagePayload: t, targetId: n, sent: !1 };
        }
        function c(e, t, n) {
          var r = [],
            o = [];
          (this.getTags = function () {
            return r;
          }),
            (this.addTag = function (e) {
              r.push(e);
            }),
            (this.addNotifyMessage = function (e) {
              o.push(e);
            }),
            (this.getNotifyMessages = function () {
              return o;
            }),
            (this.url = e),
            (this.id = t),
            (this.status = 'loading'),
            (this.renderFn = function () {}),
            (this.notifyFn = d),
            (this.isSafeFrame = n.enableSafeFrame || !1),
            (this.safeFrameSizes = n.sizes),
            this.addTag(n);
        }
        function l(e, n, r) {
          var o = new c(e, n, r);
          return (
            (function (e) {
              R(t, function (t) {
                e.addNotifyMessage(t);
              });
            })(o),
            o
          );
        }
        function d(e, t, n) {
          !(function (e, t, n) {
            var r = H.getInstance().getIframe(n).iframe.contentWindow;
            dt(r, { messageType: e, messagePayload: t, status: 'notify', targetId: n }, j());
          })(e, t, (n = n || this.getTags()[0].targetId));
        }
        function u(e) {
          if (!e || !e.isMediated) {
            var t = (function (e) {
              return e.isMediated || e.isRtbVideoFallback ? e.adResponse.ad : e.adResponse.ads[0];
            })(e);
            !(function (e, t, n) {
              var r = void 0;
              if (((n = 'anx_' + n + new Date().getTime()), e && t)) {
                ((r = new Image()).id = n), (r.src = t), (r.height = 0), (r.width = 0), (r.style.display = 'none');
                try {
                  e.insertBefore(r, e.firstChild);
                  var o = setTimeout(function () {
                    if (r.parentNode)
                      try {
                        r.parentNode.removeChild(r);
                      } catch (e) {}
                    clearTimeout(o);
                  }, 5e3);
                } catch (e) {
                  A('Error logging impression for tag: ' + n + ' :' + e.message);
                }
              }
            })(window.document.body, t[ft], t[mt]);
          }
        }
      })(),
      ft = r.a.NOTIFY,
      mt = r.a.CREATIVE_ID;
    function pt(e) {
      return {
        adType: e.ad_type,
        buyerMemberId: e.buyer_member_id,
        source: e.content_source,
        cpm: e.cpm,
        cpm_publisher_currency: e.cpm_publisher_currency,
        publisher_currency_code: e.publisher_currency_code,
        creativeId: e.creative_id,
        mediaSubtypeId: e.media_subtype_id,
        mediaTypeId: e.media_type_id,
        brandCategoryId: e.brand_category_id,
        dealId: e.deal_id,
        isExclusive: e.is_sov,
        isRoadblock: e.is_roadblock,
      };
    }
    function gt(e) {
      return {
        type: e.type,
        title: e.title,
        body: e.desc,
        desc2: e.desc2,
        fullText: e.full_text,
        icon: e.icon,
        image: e.main_img,
        cta: e.ctatext,
        sponsoredBy: e.sponsored,
        impressionTrackers: e.impression_trackers,
        clickTrackers: e.link && e.link.click_trackers,
        clickUrl: e.link && e.link.url,
        clickFallbackUrl: e.link && e.link.fallback_url,
        javascriptTrackers: e.javascript_trackers,
        video: e.video,
        privacyLink: e.privacy_link,
        rating: e.rating,
        displayUrl: e.displayurl,
        likes: e.likes,
        downloads: e.downloads,
        price: e.price,
        salePrice: e.saleprice,
        phone: e.phone,
        address: e.address,
        customTitle1: e.title1,
        customTitle2: e.title2,
        customTitle3: e.title3,
        customTitle4: e.title4,
        customTitle5: e.title5,
        customBody1: e.body1,
        customBody2: e.body2,
        customBody3: e.body3,
        customBody4: e.body4,
        customBody5: e.body5,
        customCta1: e.ctatext1,
        customCta2: e.ctatext2,
        customCta3: e.ctatext3,
        customCta4: e.ctatext4,
        customCta5: e.ctatext5,
        customDisplayUrl1: e.displayurl1,
        customDisplayUrl2: e.displayurl2,
        customDisplayUrl3: e.displayurl3,
        customDisplayUrl4: e.displayurl4,
        customDisplayUrl5: e.displayurl5,
        customSocialUrl1: e.socialurl1,
        customSocialUrl2: e.socialurl2,
        customSocialUrl3: e.socialurl3,
        customSocialUrl4: e.socialurl4,
        customSocialUrl5: e.socialurl5,
        customImage1: e.image1,
        customImage2: e.image2,
        customImage3: e.image3,
        customImage4: e.image4,
        customImage5: e.image5,
        customIcon1: e.icon1,
        customIcon2: e.icon2,
        customIcon3: e.icon3,
        customIcon4: e.icon4,
        customIcon5: e.icon5,
        customSocialIcon1: e.socialicon1,
        customSocialIcon2: e.socialicon2,
        customSocialIcon3: e.socialicon3,
        customSocialIcon4: e.socialicon4,
        customSocialIcon5: e.socialicon5,
      };
    }
    var vt = function (e, t) {
        if (e.viewability && e.viewability.config) {
          var n = e.viewability.config;
          if ('string' == typeof t) {
            n = n.replace('%native_dom_id%', t);
            var r = /https?:\/\/.?cdn\.adnxs(-simple)?\.com\/.*?\/.*?\/[\d]*?\/trk.js/;
            ze() && n.match(r) && (n = n.replace(r, ze())),
              x() &&
                null === document.getElementById(t) &&
                N(
                  'No element found in the page for the native creative ' +
                    t +
                    ", see https://docs.xandr.com/bundle/seller-tag/page/seller-tag/define-tag.html 'targetId'"
                );
          }
          o({ strategy: 'WithContentAndAttributes', data: { content: n, attributes: { 'data-anxtracker': t || '' } } });
        }
      },
      yt = null,
      ht = null;
    var wt = ((window.apntag = window.apntag || {}), window.apntag);
    function Tt() {
      var e = void 0;
      try {
        e = ht.currentTag.adResponse.ads;
      } catch (e) {
        O('could not get adResponseBids' + e);
      }
      var t = void 0;
      return (
        e &&
          e.length &&
          (ht.isMediated
            ? (t = e[e.length - 1]) &&
              2 === t.renderer_id &&
              ((ht.currentTag.adResponse.ads = [t]), (yt.supports.expansionByPush = !0))
            : (t = e[0])),
        t
      );
    }
    (wt.registerRenderer = function (e, t) {
      ut.registerRenderer(e, t, yt.host);
    }),
      (wt.onEvent = function (e, t, n) {
        if ('adLoaded' === e) {
          var r = (function (e, t) {
            var n = {};
            return (
              (n.targetId = t),
              R(pt(e), function (e, t) {
                n[t] = e;
              }),
              e.rtb && e.rtb.native && (n.native = gt(e.rtb.native)),
              vt(e, t),
              n
            );
          })(Tt(), t);
          wt.mockSfListner = { targetId: t, handler: n, adObj: r };
        }
      }),
      (wt.offEvent = function (e, t, n) {
        'adLoaded' === e && delete wt.mockSfListner;
      });
    var bt = function () {
        var e = document.getElementById('sf_align');
        if (e) {
          var t = document.createElement('div');
          t.setAttribute('id', yt.targetId), e.appendChild(t);
        } else document.write("<div id='sf_align'><div id=" + yt.targetId + '></div></div>');
        var n = { name: 'setParentDivStyleDefaultProp', cmd: { height: 0 }, targetId: yt.targetId };
        (n = JSON.stringify(n)), Et(window.parent, n, yt.host);
        var r = Tt();
        ut.loadRenderer(ht.currentTag, r), (window.currentTag = ht.currentTag);
      },
      Et = function (e, t, n) {
        e.postMessage(t, n);
      },
      St = function (e) {
        var t,
          n,
          r = G.getInstance(),
          o = ((t = 'adError'), (n = r.targetId), new J(t, n, { data: 'data' }, e));
        return (o = JSON.stringify(o)), Et(window.parent, o, r.host), !0;
      },
      It = function (e) {
        if (e.source === window.parent) {
          var t = void 0;
          try {
            t = JSON.parse(e.data);
          } catch (e) {
            return void A(e);
          }
          var n = G.getInstance();
          if (t.targetId === n.targetId)
            switch (t.status) {
              case 'expanded':
                (n.status = r.m.STATUS.NOTIFY_EXPANDED), (n.geom = t.geom), n.creativeCb(r.m.STATUS.NOTIFY_EXPANDED);
                break;
              case 'collapsed':
                n.status === r.m.STATUS.NOTIFY_EXPANDED &&
                  ((n.status = r.m.STATUS.NOTIFY_COLLAPSED), (n.geom = t.geom), n.creativeCb(r.m.STATUS.NOTIFY_COLLAPSED));
                break;
              case r.m.STATUS.CMP:
                (n.gdpr_consent = t.gdpr_consent), n.creativeCb(r.m.STATUS.CMP, n.gdpr_consent);
                break;
              case r.m.STATUS.FOCUS_CHANGE:
                (n.hasFocus = t.value), n.creativeCb(r.m.STATUS.FOCUS_CHANGE);
                break;
              case r.m.STATUS.GEOM_UPDATE:
                (n.geom = t.geom), n.creativeCb(r.m.STATUS.GEOM_UPDATE);
                break;
              case 'nativeAssembly':
                bt();
                break;
              case 'error':
                break;
              case 'notify':
                ut.invokeNotify(t.messageType, t.messagePayload, t.targetId);
            }
        } else N('Received post message from invalid host');
      },
      _t = r.o.NUM,
      Ot = function (e) {
        this.name = e.name;
        var t = G.getInstance();
        (this.targetId = t.targetId), (this.ext = e.ext);
      },
      Nt = function (e) {
        return F().document.getElementById(e);
      };
    function At(e, t) {
      var n = void 0,
        r = void 0;
      (n = e ? 'right:0px;' : 'left:0px;'),
        (r = t ? 'bottom:0px;' : 'top:0px;'),
        (Nt('sf_align').style.cssText = 'position:absolute;' + n + r);
    }
    var Dt = null,
      kt = null;
    var Rt = ((window.apntag = window.apntag || {}), window.apntag),
      xt = ((window.$sf = window.$sf || {}), (window.$sf.ext = window.$sf.ext || {}), (window.$sf.ast = !0), window.$sf.ext);
    function Pt(e) {
      window.addEventListener(
        'load',
        function () {
          window.addEventListener('click', function () {
            var t = { name: 'emitEvent', cmd: [e.targetId, 'click'] };
            Et(window.parent, JSON.stringify(t), e.host);
          });
        },
        { once: !0 }
      );
    }
    (xt.debug = !1),
      (xt.geom = function () {
        return O('geom called for targetId : ' + Dt.targetId), Dt.geom;
      }),
      (xt.inViewPercentage = function () {
        return O('inViewPercentage called for targetId : ' + Dt.targetId), Math.floor(100 * Dt.geom.self.iv);
      }),
      (xt.supports = function () {
        O('Support Called for targetId : ' + Dt.targetId);
        var e = {};
        return (
          (e['exp-ovr'] = Dt.supports.expansionByOverlay),
          (e['exp-push'] = Dt.supports.expansionByPush),
          (e['read-cookie'] = !1),
          (e['write-cookie'] = !1),
          e
        );
      }),
      (xt.cmp = function () {
        O('cmp Called for targetId : ' + Dt.targetId);
        var e = { name: 'cmp', targetId: Dt.targetId };
        Et(window.parent, JSON.stringify(e), Dt.host);
      }),
      (xt.expand = function (e) {
        O('Expand called for targetId : ' + Dt.targetId);
        var t = this.status();
        if (t === r.m.STATUS.READY || t === r.m.STATUS.NOTIFY_COLLAPSED) {
          var n = (function (e) {
            var t = G.getInstance();
            D('Expand options ', JSON.stringify(e));
            var n = F(),
              r = !1,
              o = !1,
              i = 0,
              a = 0;
            if (
              (M(e, 'left') || M(e, 'l')) &&
              (M(e, 'right') || M(e, 'r')) &&
              (M(e, 'top') || M(e, 't')) &&
              (M(e, 'bottom') || M(e, 'b')) &&
              M(e, 'push')
            ) {
              var s = n.$sf.ext.supports();
              if (!e.push || s['exp-push'])
                if (e.push || s['exp-ovr']) {
                  if (s['exp-push'] || s['exp-ovr']) {
                    var c = {};
                    c.push = e.push;
                    var l = C('options.left', e.left || e.l, _t),
                      d = C('options.right', e.right || e.r, _t),
                      u = C('options.top', e.top || e.t, _t),
                      f = C('options.bottom', e.bottom || e.b, _t);
                    if (
                      (!d && l && ((r = !0), (i = -1 * l)),
                      d && !l && (i = d),
                      !f && u && ((o = !0), (a = -1 * u)),
                      f && !u && (a = f),
                      !((u && f) || (l && d)))
                    )
                      (c.multiDir = !1), At(r, o), (c.x = i), (c.y = a);
                    else {
                      (c.multiDir = !0), (c.left = l), (c.right = d), (c.top = u), (c.bottom = f);
                      var m = Nt('sf_align'),
                        p = m && m.style,
                        g = ['position:absolute;'];
                      u && f ? g.push('top:' + u + 'px;') : u ? g.push('bottom:0px;') : f && g.push('top:0px;'),
                        l && d ? g.push('left:' + l + 'px;') : l ? g.push('right:0px;') : f && g.push('left:0px;'),
                        p && (p.cssText = g.join(' '));
                    }
                    var v = { name: 'expand', ext: e.ext },
                      y = new Ot(v);
                    return (y.bounds = c), y;
                  }
                  A('Invalid Safeframe Config, Expansion disabled for both methods for targetId : ' + t.targetId);
                } else A('Invalid Safeframe Config for Expansion by Overlay for targetId : ' + t.targetId);
              else A('Invalid Safeframe Config for Expansion by Push for targetId : ' + t.targetId);
            } else A('Invalid expand arguments passed for targetId : ' + t.targetId);
          })(e);
          if (typeof n !== r.k.UNDEFINED) {
            try {
              n = JSON.stringify(n);
            } catch (e) {
              A('Could not stringify command', null, e);
            }
            Et(window.parent, n, Dt.host);
          }
        }
      }),
      (xt.collapse = function (e) {
        if ((O('Collapse called for targetId : ' + Dt.targetId), this.status() === r.m.STATUS.NOTIFY_EXPANDED)) {
          var t = (function (e) {
            At(0, 0);
            var t = { name: 'collapse', ext: e && e.ext ? e.ext : void 0 };
            return new Ot(t);
          })(e);
          if (typeof t !== r.k.UNDEFINED) {
            try {
              t = JSON.stringify(t);
            } catch (e) {
              A('Could not stringify command', null, e);
            }
            Et(window.parent, t, Dt.host);
          }
        }
      }),
      (xt.register = function (e, t, n) {
        O('Register called for targetId : ' + Dt.targetId), 'function' == typeof n && G.setCallback(n);
      }),
      (xt.status = function () {
        return O('Status called for targetId : ' + Dt.targetId), Dt.status;
      }),
      (xt.winHasFocus = function () {
        return O('winHasFocus called for targetId : ' + Dt.targetId), Dt.hasFocus || document.hasFocus();
      }),
      (xt.meta = function (e, t) {
        if ((O('meta called for targetId : ' + Dt.targetId), Dt.meta !== r.k.UNDEFINED))
          return 2 === arguments.length ? (Dt.meta[t] ? Dt.meta[t][e] : r.k.UNDEFINED) : Dt.meta.shared && Dt.meta.shared[e];
      }),
      (function () {
        var e;
        if (
          (O('Safeframe initialized'),
          (kt = JSON.parse(window.name)),
          (window.name = ''),
          (Dt = G.getInstance(kt)),
          (yt = Dt),
          (ht = kt),
          (xt.debug = Dt.debug),
          (Rt.debug = Dt.debug),
          (e = window),
          v(e, 'message', It),
          (window.onerror = St),
          kt.rendererUrl)
        )
          bt();
        else if (kt.isMediated && kt.currentTag.isBannerMediation)
          (window.APN_macros = {}),
            (window.APN_macros.uuid = kt.targetId),
            (window.APN_macros.ads = kt.ad),
            (window.APN_macros.enableMediationEvents = kt.enableMediationEvents),
            (window.APN_macros.expandByCreative = kt.expandByCreative),
            (window.MediationData = {}),
            (window.MediationData.host = kt.host),
            document.write("<div id='sf_align'><script src=\"" + r.h.BANNER_MEDIATION_JS + '"><\/script></div>'),
            Pt(Dt);
        else
          try {
            var t = Dt.ad;
            document.write("<div id='sf_align'>" + t + '</div>'), Pt(Dt);
          } catch (e) {
            A('Error generating safeframe ad', null, e);
          }
      })();
  },
]);
