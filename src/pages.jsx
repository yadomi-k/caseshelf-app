// 画面コンポーネント（試作品）
window.AppPages = (function () {
  "use strict";
  var h = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var useMemo = React.useMemo;
  var C = AppComponents;
  var cx = AppUtils.classNames;

  // ====================================================================
  // Login
  // ====================================================================
  // Salesforceのロゴではなく、雲の形の簡単なマーク
  function SalesforceMark() {
    return h(
      "svg",
      { width: 22, height: 16, viewBox: "0 0 22 16", "aria-hidden": "true", className: "sf-mark" },
      h("path", {
        fill: "currentColor",
        d: "M9 2.2A4.2 4.2 0 0 1 12.2.8c1.6 0 3 .9 3.7 2.2a5 5 0 0 1 2-.4C20.2 2.6 22 4.5 22 6.9s-1.8 4.3-4.1 4.3h-.8a3.5 3.5 0 0 1-4.6 1.6A4 4 0 0 1 5 12.4a3.6 3.6 0 0 1-1 .1C1.8 12.5 0 10.6 0 8.3a4.2 4.2 0 0 1 2.4-3.8A4.3 4.3 0 0 1 9 2.2z",
      })
    );
  }

  // 依頼メールの内容（件名・本文）。Outlookで受け取って処理しやすいよう、項目を決まった形で書く。
  function requestMailHref(profile) {
    var to = (window.AppConfig && window.AppConfig.accountRequestEmail) || "";
    var now = new Date();
    var stamp =
      now.getFullYear() + "/" + (now.getMonth() + 1) + "/" + now.getDate() + " " +
      now.getHours() + ":" + String(now.getMinutes()).padStart(2, "0");
    var subject = "【RecordPOOL】アカウント作成依頼";
    var body = [
      "RecordPOOLのアカウント作成をお願いします。",
      "",
      "依頼内容: RecordPOOLアカウント作成",
      "氏名: " + (profile.name || ""),
      "メールアドレス: " + profile.email,
      "依頼日時: " + stamp,
      "",
      "※RecordPOOLのログイン画面から送信された依頼です（Salesforceで本人確認済み）。",
    ].join("\n");
    return { to: to, href: "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body) };
  }

  // 登録した本人へ送る「登録完了」メール（件名・本文）。
  // サーバーを持たない構成のため、メールソフト（Outlook等）で作成して管理者が送信する。
  function appLoginUrl() {
    return window.AppSSO ? AppSSO.redirectUri() : window.location.origin + window.location.pathname;
  }
  function registeredMailHref(user) {
    var loginUrl = appLoginUrl();
    var subject = "【RecordPOOL】RecordPOOLアカウント登録完了";
    var body = [
      (user.displayName || user.email) + " 様",
      "",
      "RecordPOOLアカウント登録完了",
      "",
      "RecordPOOLのアカウント登録が完了しました。",
      "下記のURLを開き、「Salesforceでログイン」からログインしてください。",
      "",
      "RecordPOOLログインURL",
      loginUrl,
      "",
      "登録メールアドレス: " + user.email,
      "※ログインには、上記メールアドレスのSalesforceアカウントを使用します。",
    ].join("\n");
    return {
      to: user.email,
      href: "mailto:" + encodeURIComponent(user.email) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body),
    };
  }

  // 登録直後に表示する「登録完了メールを作成する」パネル
  function RegisteredMailNotice(props) {
    var user = props.user;
    var mail = registeredMailHref(user);
    return h(
      "div",
      { className: "registered-notice", role: "status" },
      h(
        "p",
        null,
        "「" + (user.displayName || user.email) + "」（" + user.email + "）を登録しました。本人に登録完了メールを送ってください。"
      ),
      h(
        "div",
        { className: "registered-actions" },
        h("a", { className: "btn primary sm", href: mail.href }, "登録完了メールを作成する"),
        h("button", { type: "button", className: "btn ghost sm", onClick: props.onClose }, "閉じる")
      ),
      h("p", { className: "form-hint" }, "メールソフトが開き、件名「【RecordPOOL】RecordPOOLアカウント登録完了」とログインURL入りの本文が作成されます。内容を確認して送信してください。")
    );
  }

  function RequestAccountCard(props) {
    var p = props.profile;
    var mail = requestMailHref(p);
    var done = !!props.result;
    return h(
      "div",
      { className: "login-card request-card" },
      h("h2", null, done ? "利用登録を依頼しました" : "RecordPOOLの利用登録がまだです"),
      h(
        "div",
        { className: "request-who" },
        h("div", { className: "request-name" }, p.name || "（名前なし）"),
        h("div", { className: "request-email" }, p.email)
      ),
      !done &&
        h(
          React.Fragment,
          null,
          h(
            "p",
            { className: "request-text" },
            "Salesforceでの本人確認はできました。RecordPOOLを使うには、管理者による利用登録が必要です。"
          ),
          props.error && h("div", { className: "login-error", role: "alert" }, props.error),
          h(
            "button",
            { type: "button", className: "btn primary block", onClick: props.onRequest, disabled: props.busy },
            props.busy ? "送信中..." : "管理者に利用登録を依頼する"
          )
        ),
      done &&
        h(
          React.Fragment,
          null,
          h(
            "p",
            { className: "request-text" },
            props.result === "duplicate"
              ? "このアカウントの依頼は既に受け付けています。管理者が登録するまでお待ちください。"
              : "依頼を受け付けました。管理者が登録すると、「Salesforceでログイン」から使えるようになります。"
          ),
          mail.to &&
            h(
              "div",
              { className: "request-mail" },
              h("p", null, "管理者に確実に届くよう、依頼メールも送ってください。"),
              h("a", { className: "btn block", href: mail.href }, "依頼メールを作成する"),
              h("p", { className: "request-mail-to" }, "宛先: ", h("span", { className: "selectable" }, mail.to))
            )
        ),
      h(
        "button",
        { type: "button", className: "link-button request-back", onClick: props.onBack },
        "ログイン画面に戻る"
      )
    );
  }

  function LoginPage(props) {
    var store = props.store;
    var _err = useState(null);
    var error = _err[0],
      setError = _err[1];
    var _sf = useState(false);
    var sfBusy = _sf[0],
      setSfBusy = _sf[1];
    var _nr = useState(null); // Salesforceで本人確認できたが未登録の人
    var notRegistered = _nr[0],
      setNotRegistered = _nr[1];
    var _rq = useState(null); // 依頼の結果
    var requestResult = _rq[0],
      setRequestResult = _rq[1];
    var _rb = useState(false);
    var requestBusy = _rb[0],
      setRequestBusy = _rb[1];

    // Salesforceから戻ってきた場合の処理
    useEffect(function () {
      var cancelled = false;
      var pending = AppSSO.consumeRedirect();
      pending
        .then(function (profile) {
          if (cancelled || !profile) return;
          setSfBusy(true);
          return store.loginWithSalesforce(profile).then(function (res) {
            if (cancelled) return;
            setSfBusy(false);
            if (!res.ok) {
              if (res.error === "notRegistered") {
                setNotRegistered(res.profile);
                return;
              }
              setError(res.error);
              return;
            }
            props.route.navigate("/feed", { replace: true });
          });
        })
        .catch(function (e) {
          if (cancelled) return;
          setSfBusy(false);
          setError(e.message);
        });
      // 通信中は「確認中」を表示する
      if (new URLSearchParams(window.location.search).get("code")) setSfBusy(true);
      return function () {
        cancelled = true;
      };
    }, []);

    function startSalesforce() {
      setError(null);
      setSfBusy(true);
      AppSSO.startLogin().catch(function (e) {
        setSfBusy(false);
        setError(e.message);
      });
    }

    function sendRequest() {
      setRequestBusy(true);
      setError(null);
      store.requestAccount(notRegistered).then(function (res) {
        setRequestBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setRequestResult(res.duplicate ? "duplicate" : "created");
      });
    }

    var logo = h(
      "div",
      { className: "login-logo" },
      h("img", { className: "login-logo-img", src: "./assets/logo-vertical.png", alt: "RecordPOOL" }),
      h("div", { className: "tagline" }, "社内事例写真を、探しやすく。")
    );

    if (notRegistered) {
      return h(
        "div",
        { className: "login-screen" },
        logo,
        h(RequestAccountCard, {
          profile: notRegistered,
          result: requestResult,
          error: error,
          busy: requestBusy,
          onRequest: sendRequest,
          onBack: function () {
            AppSSO.endSession();
            setNotRegistered(null);
            setRequestResult(null);
            setError(null);
          },
        })
      );
    }

    var message = error || store.loginMessage;
    return h(
      "div",
      { className: "login-screen" },
      logo,
      h(
        "div",
        { className: "login-card" },
        h("h2", null, "ログイン"),
        h(
          "button",
          { type: "button", className: "btn block sf-login", onClick: startSalesforce, disabled: sfBusy },
          h(SalesforceMark, null),
          sfBusy ? "Salesforceで確認中..." : "Salesforceでログイン"
        ),
        h("p", { className: "login-help" }, "会社のSalesforceアカウントでログインします。"),
        message && h("div", { className: "login-error login-error-top", role: "alert" }, message)
      ),
      h(
        "p",
        { className: "login-note" },
        "RecordPOOLを使うには、管理者による利用者登録が必要です。投稿した内容は、RecordPOOLの利用者全員が閲覧できます。"
      )
    );
  }

  // ====================================================================
  // Feed（一覧・検索）
  // ====================================================================
  // f: { q, tag, ptype（物件種別）, venue（会場） }
  function filterProjects(projects, users, f) {
    var q = f.q,
      tag = f.tag;
    var qKey = AppUtils.tagKey(q || "");
    var tagFilterKey = tag ? AppUtils.tagKey(tag) : "";
    return projects.filter(function (p) {
      if (f.ptype && (p.propertyTypes || []).indexOf(f.ptype) === -1) return false;
      if (f.venue && p.venue !== f.venue) return false;
      // 売上金額（金額帯）の範囲。金額が入っていない投稿は対象外
      if (f.amin !== "" && f.amin !== undefined || f.amax !== "" && f.amax !== undefined) {
        if (typeof p.salesBand !== "number") return false;
        if (f.amin !== "" && f.amin !== undefined && p.salesBand < Number(f.amin)) return false;
        if (f.amax !== "" && f.amax !== undefined && p.salesBand > Number(f.amax)) return false;
      }
      if (tagFilterKey) {
        var hasTag = p.tags.some(function (t) {
          return AppUtils.tagKey(t) === tagFilterKey;
        });
        if (!hasTag) return false;
      }
      if (qKey) {
        var titleMatch = p.title.toLowerCase().indexOf(qKey) !== -1;
        var tagMatch = p.tags.some(function (t) {
          return AppUtils.tagKey(t).indexOf(qKey) !== -1;
        });
        var staffMatch = (p.designStaff || []).some(function (d) {
          if (String(d.name).toLowerCase().indexOf(qKey) !== -1) return true;
          var u =
            d.email &&
            (users || []).find(function (x) {
              return String(x.email).toLowerCase() === String(d.email).toLowerCase();
            });
          return !!u && String(u.displayName).toLowerCase().indexOf(qKey) !== -1;
        });
        var placeMatch =
          String(p.venue || "").toLowerCase().indexOf(qKey) !== -1 ||
          (p.propertyTypes || []).some(function (t) {
            return t.toLowerCase().indexOf(qKey) !== -1;
          });
        if (!titleMatch && !tagMatch && !staffMatch && !placeMatch) return false;
      }
      return true;
    });
  }

  function sortNewestFirst(list) {
    return list.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function FeedPage(props) {
    var store = props.store;
    var route = props.route;
    var q = route.query.q || "";
    var tag = route.query.tag || "";
    var ptype = route.query.ptype || "";
    var venueF = route.query.venue || "";
    var amin = route.query.amin || "";
    var amax = route.query.amax || "";
    var qsKey = "caseshelf_feed_scroll:" + q + "|" + tag + "|" + ptype + "|" + venueF + "|" + amin + "|" + amax;
    // 今の検索条件に patch を重ねたもの
    function withQuery(patch) {
      return Object.assign({ q: q, tag: tag, ptype: ptype, venue: venueF, amin: amin, amax: amax }, patch);
    }

    var _input = useState(q);
    var inputVal = _input[0],
      setInputVal = _input[1];

    useEffect(
      function () {
        setInputVal(q);
      },
      [q]
    );

    function readFeedState(key) {
      try {
        var raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }
    function persistFeedState(key, patch) {
      try {
        var prev = readFeedState(key) || {};
        sessionStorage.setItem(key, JSON.stringify(Object.assign({}, prev, patch)));
      } catch (e) {}
    }

    var restoredOnMount = useMemo(
      function () {
        return readFeedState(qsKey);
      },
      [qsKey]
    );
    var initialVisibleCountForKey =
      restoredOnMount && restoredOnMount.visibleCount ? restoredOnMount.visibleCount : 18;
    var lastVisibleCountRef = useRef(initialVisibleCountForKey);
    // qsKeyが変わったら（新しい検索条件に切り替わったら）参照値もその条件のものに合わせる
    useEffect(
      function () {
        lastVisibleCountRef.current = initialVisibleCountForKey;
      },
      [qsKey]
    );

    var filtered = useMemo(
      function () {
        return sortNewestFirst(
          filterProjects(store.projects, store.users, { q: q, tag: tag, ptype: ptype, venue: venueF, amin: amin, amax: amax })
        );
      },
      [store.projects, q, tag, ptype, venueF, amin, amax]
    );

    // 検索条件（qsKey）が変わるたび、その条件で保存していたスクロール位置を復元する。
    // 初めての検索条件であれば保存値がないため、先頭にスクロールする。
    useEffect(
      function () {
        var data = readFeedState(qsKey);
        if (data && data.scrollY) {
          var raf1 = requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              window.scrollTo(0, data.scrollY);
            });
          });
          return function () {
            cancelAnimationFrame(raf1);
          };
        }
        window.scrollTo(0, 0);
      },
      [qsKey]
    );

    useEffect(
      function () {
        function onScroll() {
          persistFeedState(qsKey, { scrollY: window.scrollY, visibleCount: lastVisibleCountRef.current });
        }
        window.addEventListener("scroll", onScroll, { passive: true });
        return function () {
          window.removeEventListener("scroll", onScroll);
        };
      },
      [qsKey]
    );

    function handleVisibleCountChange(vc) {
      lastVisibleCountRef.current = vc;
      persistFeedState(qsKey, { visibleCount: vc });
    }

    function applyQuery(next) {
      route.navigate("/feed" + AppUtils.buildQuery(next), { replace: true });
    }

    var debounceRef = useRef(null);
    function onInputChange(e) {
      var v = e.target.value;
      setInputVal(v);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(function () {
        applyQuery(withQuery({ q: v }));
      }, 300);
    }

    var hasFilter = !!(q || tag || ptype || venueF || amin || amax);

    // PCでは、検索サイドバーを閉じたり開いたりできる（閉じた状態はこのブラウザに覚えておく）
    var SIDEBAR_PREF = "caseshelf_feed_sidebar_closed";
    var _closed = useState(function () {
      try {
        return localStorage.getItem(SIDEBAR_PREF) === "1";
      } catch (e) {
        return false;
      }
    });
    var sidebarClosed = _closed[0],
      setSidebarClosed = _closed[1];
    function setClosedPref(v) {
      setSidebarClosed(v);
      try {
        localStorage.setItem(SIDEBAR_PREF, v ? "1" : "0");
      } catch (e) {}
    }
    function isDesktop() {
      return window.matchMedia && window.matchMedia("(min-width: 860px)").matches;
    }

    // スマートフォンでは、検索サイドバーを「検索・絞り込み」ボタンで開く
    var _panel = useState(false);
    var panelOpen = _panel[0],
      setPanelOpen = _panel[1];
    useEffect(
      function () {
        if (!panelOpen) return;
        function onKey(e) {
          if (e.key === "Escape") setPanelOpen(false);
        }
        document.addEventListener("keydown", onKey);
        document.body.classList.add("no-scroll");
        return function () {
          document.removeEventListener("keydown", onKey);
          document.body.classList.remove("no-scroll");
        };
      },
      [panelOpen]
    );

    // サイドバーに出すハッシュタグ（投稿数の多い順）
    var tagCounts = useMemo(
      function () {
        var map = {};
        var list = [];
        store.projects.forEach(function (p) {
          p.tags.forEach(function (t) {
            var k = AppUtils.tagKey(t);
            if (!map[k]) {
              map[k] = { tag: t, key: k, count: 0 };
              list.push(map[k]);
            }
            map[k].count += 1;
          });
        });
        return list.sort(function (a, b) {
          return b.count - a.count;
        });
      },
      [store.projects]
    );

    function clearQ() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setInputVal("");
      applyQuery(withQuery({ q: "" }));
    }
    function clearAll() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setInputVal("");
      applyQuery({});
    }
    function selectTag(t) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      var same = tag && AppUtils.tagKey(tag) === AppUtils.tagKey(t);
      applyQuery(withQuery({ q: inputVal, tag: same ? "" : t }));
    }
    function selectPtype(t) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      applyQuery(withQuery({ q: inputVal, ptype: ptype === t ? "" : t }));
    }
    function setAmountRange(min, max, changed) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // 下限が上限より大きくなったら、もう一方の条件を外す
      if (min !== "" && max !== "" && Number(min) > Number(max)) {
        if (changed === "min") max = "";
        else min = "";
      }
      applyQuery(withQuery({ q: inputVal, amin: min, amax: max }));
    }
    var salesBands = useMemo(
      function () {
        return store.projects
          .map(function (p) {
            return p.salesBand;
          })
          .filter(function (b) {
            return typeof b === "number";
          });
      },
      [store.projects]
    );
    function selectVenue(v) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      applyQuery(withQuery({ q: inputVal, venue: venueF === v ? "" : v }));
    }

    // 物件種別・会場ごとの件数（多い順）
    function countBy(getValues) {
      var map = {};
      var list = [];
      store.projects.forEach(function (p) {
        getValues(p).forEach(function (v) {
          if (!v) return;
          if (!map[v]) {
            map[v] = { value: v, count: 0 };
            list.push(map[v]);
          }
          map[v].count += 1;
        });
      });
      return list.sort(function (a, b) {
        return b.count - a.count || a.value.localeCompare(b.value, "ja");
      });
    }
    var ptypeCounts = useMemo(
      function () {
        return countBy(function (p) {
          return p.propertyTypes || [];
        });
      },
      [store.projects]
    );
    var venueCounts = useMemo(
      function () {
        return countBy(function (p) {
          return p.venue ? [p.venue] : [];
        });
      },
      [store.projects]
    );

    var sidebar = h(SearchSidebar, {
      inputVal: inputVal,
      onInputChange: onInputChange,
      onClearQ: clearQ,
      onClearAll: clearAll,
      tag: tag,
      q: q,
      hasFilter: hasFilter,
      tagCounts: tagCounts,
      onSelectTag: selectTag,
      ptype: ptype,
      ptypeCounts: ptypeCounts,
      onSelectPtype: selectPtype,
      showPtype: AppSF.propertyTypeFieldAvailable(),
      venue: venueF,
      venueCounts: venueCounts,
      onSelectVenue: selectVenue,
      showVenue: AppSF.venueFieldAvailable(),
      showAmount: AppSF.salesBandAvailable(),
      amin: amin,
      amax: amax,
      salesBands: salesBands,
      onAmountRange: setAmountRange,
      resultCount: filtered.length,
      onClose: function () {
        if (isDesktop()) setClosedPref(true);
        else setPanelOpen(false);
      },
    });

    var filterBar = h(
      "div",
      { className: "feed-mobile-bar" },
      h(
        "button",
        {
          type: "button",
          className: cx("btn sm feed-filter-btn", !sidebarClosed && "pc-open"),
          "aria-expanded": isDesktop() ? !sidebarClosed : panelOpen,
          onClick: function () {
            if (isDesktop()) setClosedPref(!sidebarClosed);
            else setPanelOpen(true);
          },
        },
        h(SearchIcon, null),
        h("span", { className: "sp-only" }, "検索・絞り込み"),
        h("span", { className: "pc-only" }, sidebarClosed ? "検索・絞り込みを開く" : "検索・絞り込みを閉じる")
      ),
      hasFilter
        ? h(
            "div",
            { className: "feed-mobile-conds" },
            q ? h("span", { className: "cond" }, "「" + q + "」") : null,
            tag ? h("span", { className: "cond" }, "#" + tag) : null,
            ptype ? h("span", { className: "cond" }, "種別: " + ptype) : null,
            venueF ? h("span", { className: "cond" }, "会場: " + venueF) : null,
            amin || amax ? h("span", { className: "cond" }, "予算: " + amountRangeLabel(amin, amax)) : null,
            h(
              "button",
              { type: "button", className: "link-btn", onClick: clearAll },
              "解除"
            )
          )
        : null,
      h("span", { className: "feed-mobile-count" }, filtered.length + "件")
    );

    return h(
      "div",
      { className: cx("feed-layout", sidebarClosed && "sidebar-closed") },
      h(
        "aside",
        { className: cx("feed-sidebar", panelOpen && "open"), "aria-label": "検索・絞り込み" },
        sidebar
      ),
      panelOpen
        ? h("div", {
            className: "feed-sidebar-overlay",
            onClick: function () {
              setPanelOpen(false);
            },
          })
        : null,
      h(
        "div",
        { className: "feed-main" },
        filterBar,
        h(C.PhotoGrid, {
          key: qsKey,
          projects: filtered,
          reactionsFor: store.reactionsAvailable ? store.reactionsFor : null,
          pageSize: 18,
          initialVisibleCount: initialVisibleCountForKey,
          onVisibleCountChange: handleVisibleCountChange,
          emptyMessage: hasFilter
            ? "条件に一致する案件が見つかりませんでした。検索条件を変えてお試しください。"
            : "まだ案件が投稿されていません。",
        })
      )
    );
  }

  function SearchIcon() {
    return h(
      "svg",
      { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", "aria-hidden": true },
      h("circle", { cx: 11, cy: 11, r: 7 }),
      h("path", { d: "M20 20l-3.5-3.5" })
    );
  }

  // 一覧の検索サイドバー（PCは左側に常に表示。スマートフォンは左から開くパネル）
  var SIDEBAR_TAGS = 15;
  var SIDEBAR_VENUES = 10;
  var SECTION_PREF = "caseshelf_sidebar_sections";

  // 折りたたみできる見出し付きの区画（開閉の状態はこのブラウザに覚えておく）
  function SidebarSection(props) {
    var _open = useState(function () {
      try {
        var saved = JSON.parse(localStorage.getItem(SECTION_PREF) || "{}");
        if (saved[props.id] !== undefined) return !!saved[props.id];
      } catch (e) {}
      return props.defaultOpen !== false;
    });
    var open = _open[0],
      setOpen = _open[1];
    function toggle() {
      var next = !open;
      setOpen(next);
      try {
        var saved = JSON.parse(localStorage.getItem(SECTION_PREF) || "{}");
        saved[props.id] = next;
        localStorage.setItem(SECTION_PREF, JSON.stringify(saved));
      } catch (e) {}
    }
    var bodyId = "sidebar-sec-" + props.id;
    return h(
      "div",
      { className: cx("sidebar-section", "collapsible", open && "open") },
      h(
        "button",
        { type: "button", className: "sidebar-sec-head", onClick: toggle, "aria-expanded": open, "aria-controls": bodyId },
        h("span", { className: "sidebar-label" }, props.title),
        // 閉じていても、選択中の条件がわかるようにする
        !open && props.active ? h("span", { className: "sidebar-sec-active" }, props.active) : null,
        h("span", { className: "sidebar-sec-chevron", "aria-hidden": true }, open ? "▾" : "▸")
      ),
      open ? h("div", { className: "sidebar-sec-body", id: bodyId }, props.children) : null
    );
  }

  // 件数付きの選択肢の一覧（物件種別・会場・ハッシュタグ）
  function SidebarChoiceList(props) {
    var selectedKey = props.selectedKey || "";
    return h(
      "ul",
      { className: "sidebar-tags" },
      h(
        "li",
        null,
        h(
          "button",
          {
            type: "button",
            className: cx("sidebar-tag", !selectedKey && "active"),
            onClick: function () {
              if (selectedKey) props.onClear();
            },
          },
          h("span", null, "すべて")
        )
      ),
      props.items.map(function (t) {
        var on = t.key === selectedKey;
        return h(
          "li",
          { key: t.key },
          h(
            "button",
            {
              type: "button",
              className: cx("sidebar-tag", on && "active"),
              "aria-pressed": on,
              onClick: function () {
                props.onSelect(t);
              },
            },
            h("span", { className: "sidebar-tag-name" }, t.label),
            h("span", { className: "sidebar-tag-count" }, t.count)
          )
        );
      })
    );
  }

  // 売上金額の選択肢（金額帯）：0〜450万は50万円ごと、500万円以上は100万円ごと（投稿の最大の帯か3000万円まで）
  function amountOptions(bands) {
    var max = Math.max.apply(null, [30000000].concat(bands || []));
    var out = [];
    for (var v = 0; v < 5000000; v += 500000) out.push(v);
    for (var w = 5000000; w <= max; w += 1000000) out.push(w);
    return out;
  }
  function amountRangeLabel(min, max) {
    var a = min !== "" ? AppUtils.formatManYen(Number(min)) : "";
    var b = max !== "" ? AppUtils.formatManYen(AppUtils.salesBandEnd(Number(max))) : "";
    return a + "〜" + b;
  }

  // 売上金額の範囲（いくら〜いくら）
  function AmountRange(props) {
    var opts = amountOptions(props.salesBands);
    var count = (props.salesBands || []).filter(function (b) {
      return (props.amin === "" || b >= Number(props.amin)) && (props.amax === "" || b <= Number(props.amax));
    }).length;
    return h(
      "div",
      { className: "amount-range" },
      h(
        "div",
        { className: "amount-selects" },
        h(
          "select",
          {
            className: "text-input",
            "aria-label": "予算の下限",
            value: props.amin,
            onChange: function (e) {
              props.onChange(e.target.value, props.amax, "min");
            },
          },
          h("option", { value: "" }, "下限なし"),
          opts.map(function (v) {
            return h("option", { key: v, value: String(v) }, AppUtils.formatManYen(v) + "〜");
          })
        ),
        h("span", { className: "amount-tilde" }, "〜"),
        h(
          "select",
          {
            className: "text-input",
            "aria-label": "予算の上限",
            value: props.amax,
            onChange: function (e) {
              props.onChange(props.amin, e.target.value, "max");
            },
          },
          h("option", { value: "" }, "上限なし"),
          opts.map(function (v) {
            return h("option", { key: v, value: String(v) }, "〜" + AppUtils.formatManYen(AppUtils.salesBandEnd(v)));
          })
        )
      ),
      h(
        "div",
        { className: "sidebar-hint" },
        props.salesBands.length
          ? "該当 " + count + " 件（予算が入っている投稿 " + props.salesBands.length + " 件のうち）"
          : "予算が入った投稿はまだありません"
      ),
      props.amin || props.amax
        ? h(
            "button",
            {
              type: "button",
              className: "link-btn",
              onClick: function () {
                props.onChange("", "");
              },
            },
            "予算の条件を解除"
          )
        : null
    );
  }

  function SearchSidebar(props) {
    var _all = useState(false);
    var showAll = _all[0],
      setShowAll = _all[1];
    var _vq = useState("");
    var venueQ = _vq[0],
      setVenueQ = _vq[1];

    // ハッシュタグ
    var tagKey = props.tag ? AppUtils.tagKey(props.tag) : "";
    var tagList = showAll ? props.tagCounts : props.tagCounts.slice(0, SIDEBAR_TAGS);
    // 選択中のタグが表示範囲外なら先頭に出す
    if (tagKey && !tagList.some(function (t) { return t.key === tagKey; })) {
      var sel = props.tagCounts.find(function (t) {
        return t.key === tagKey;
      });
      tagList = [sel || { tag: props.tag, key: tagKey, count: 0 }].concat(tagList);
    }

    // 会場：キーワードで絞り込み、多い順に最大10件表示
    var vKey = venueQ.trim().toLowerCase();
    var venueMatches = (props.venueCounts || []).filter(function (v) {
      return !vKey || v.value.toLowerCase().indexOf(vKey) !== -1;
    });
    var venueShown = venueMatches.slice(0, SIDEBAR_VENUES);
    if (props.venue && !venueShown.some(function (v) { return v.value === props.venue; })) {
      var vsel = (props.venueCounts || []).find(function (v) {
        return v.value === props.venue;
      });
      venueShown = [vsel || { value: props.venue, count: 0 }].concat(venueShown);
    }

    return h(
      "div",
      { className: "sidebar-inner" },
      h(
        "div",
        { className: "sidebar-head" },
        h("div", { className: "sidebar-title" }, "検索・絞り込み"),
        h(
          "button",
          { type: "button", className: "topbar-icon-btn sidebar-close", onClick: props.onClose, "aria-label": "閉じる" },
          "×"
        )
      ),
      h(
        "div",
        { className: "sidebar-section" },
        h("label", { className: "sidebar-label", htmlFor: "feed-search" }, "キーワード"),
        h(
          "div",
          { className: "search-input-wrap" },
          h(SearchIcon, null),
          h("input", {
            id: "feed-search",
            type: "search",
            value: props.inputVal,
            onChange: props.onInputChange,
            placeholder: "案件名・タグ・会場など",
            enterKeyHint: "search",
          }),
          props.inputVal
            ? h(
                "button",
                { type: "button", className: "topbar-icon-btn", onClick: props.onClearQ, "aria-label": "検索語をクリア" },
                "×"
              )
            : null
        ),
        h("div", { className: "sidebar-hint" }, "#は省略できます")
      ),
      props.showPtype
        ? h(
            SidebarSection,
            { id: "ptype", title: "物件種別", active: props.ptype },
            props.ptypeCounts.length
              ? h(SidebarChoiceList, {
                  items: props.ptypeCounts.map(function (t) {
                    return { key: t.value, label: t.value, count: t.count };
                  }),
                  selectedKey: props.ptype,
                  onSelect: function (t) {
                    props.onSelectPtype(t.key);
                  },
                  onClear: function () {
                    props.onSelectPtype(props.ptype);
                  },
                })
              : h("div", { className: "sidebar-hint" }, "物件種別が入った投稿はまだありません")
          )
        : null,
      props.showAmount
        ? h(
            SidebarSection,
            { id: "amount", title: "予算", active: props.amin || props.amax ? amountRangeLabel(props.amin, props.amax) : "" },
            h(AmountRange, { amin: props.amin, amax: props.amax, salesBands: props.salesBands, onChange: props.onAmountRange })
          )
        : null,
      props.showVenue
        ? h(
            SidebarSection,
            { id: "venue", title: "会場", active: props.venue },
            h(
              "div",
              { className: "search-input-wrap sm" },
              h(SearchIcon, null),
              h("input", {
                type: "search",
                value: venueQ,
                "aria-label": "会場を検索",
                onChange: function (e) {
                  setVenueQ(e.target.value);
                },
                placeholder: "会場名で検索",
              }),
              venueQ
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "topbar-icon-btn",
                      onClick: function () {
                        setVenueQ("");
                      },
                      "aria-label": "会場の検索語をクリア",
                    },
                    "×"
                  )
                : null
            ),
            props.venueCounts.length
              ? venueShown.length
                ? h(SidebarChoiceList, {
                    items: venueShown.map(function (v) {
                      return { key: v.value, label: v.value, count: v.count };
                    }),
                    selectedKey: props.venue,
                    onSelect: function (t) {
                      props.onSelectVenue(t.key);
                    },
                    onClear: function () {
                      props.onSelectVenue(props.venue);
                    },
                  })
                : h("div", { className: "sidebar-hint" }, "「" + venueQ + "」に一致する会場はありません")
              : h("div", { className: "sidebar-hint" }, "会場が入った投稿はまだありません"),
            venueMatches.length > SIDEBAR_VENUES
              ? h("div", { className: "sidebar-hint" }, "ほか " + (venueMatches.length - SIDEBAR_VENUES) + " 件。会場名を入力して絞り込んでください")
              : null
          )
        : null,
      h(
        SidebarSection,
        { id: "tags", title: "ハッシュタグ", active: props.tag ? "#" + props.tag : "" },
        props.tagCounts.length
          ? h(SidebarChoiceList, {
              items: tagList.map(function (t) {
                return { key: t.key, label: "#" + t.tag, count: t.count, tag: t.tag };
              }),
              selectedKey: tagKey,
              onSelect: function (t) {
                props.onSelectTag(t.tag);
              },
              onClear: function () {
                props.onSelectTag(props.tag);
              },
            })
          : h("div", { className: "sidebar-hint" }, "タグはまだありません"),
        props.tagCounts.length > SIDEBAR_TAGS
          ? h(
              "button",
              {
                type: "button",
                className: "link-btn",
                onClick: function () {
                  setShowAll(!showAll);
                },
              },
              showAll ? "少なく表示" : "すべてのタグを表示（" + props.tagCounts.length + "件）"
            )
          : null
      ),
      h(
        "div",
        { className: "sidebar-foot" },
        h("div", { className: "sidebar-count" }, props.resultCount + "件の案件"),
        props.hasFilter
          ? h("button", { type: "button", className: "btn ghost sm", onClick: props.onClearAll }, "条件をすべて解除")
          : null,
        h(
          "button",
          { type: "button", className: "btn primary sidebar-done", onClick: props.onClose },
          props.resultCount + "件の結果を見る"
        )
      )
    );
  }

  // 利用者のページへのリンク。RecordPOOL に登録されている人だけリンクにし、未登録の人は名前の表示だけにする
  function userHref(store, user) {
    if (!user || !user.id) return null;
    var registered = store.users.some(function (u) {
      return u.id === user.id;
    });
    if (!registered) return null;
    return store.currentUser && store.currentUser.id === user.id ? "#/profile" : "#/user/" + encodeURIComponent(user.id);
  }
  function UserLink(props) {
    var href = userHref(props.store, props.user);
    if (!href) return h("span", { className: props.className, title: props.title }, props.children);
    return h(
      "a",
      { className: cx(props.className, "user-link"), href: href, title: props.title || props.user.displayName + " さんのページを見る" },
      props.children
    );
  }

  // 物件種別・会場の表示（案件詳細・タイムライン）。押すと、その条件で一覧を絞り込む
  function PostMeta(props) {
    var p = props.project;
    var types = p.propertyTypes || [];
    if (!types.length && !p.venue) return null;
    return h(
      "div",
      { className: cx("post-meta-links", props.compact && "compact") },
      types.length
        ? h(
            "span",
            { className: "post-meta-item" },
            h("span", { className: "post-meta-label" }, "物件種別"),
            types.map(function (t) {
              return h("a", { key: t, className: "post-meta-link", href: "#/feed" + AppUtils.buildQuery({ ptype: t }) }, t);
            })
          )
        : null,
      p.venue
        ? h(
            "span",
            { className: "post-meta-item" },
            h("span", { className: "post-meta-label" }, "会場"),
            h("a", { className: "post-meta-link", href: "#/feed" + AppUtils.buildQuery({ venue: p.venue }) }, p.venue)
          )
        : null
    );
  }

  // デザイン担当者の表示（案件詳細・タイムライン）。
  // RecordPOOL の利用者と結び付いた人は、プロフィール画像と RecordPOOL の表示名で表示する
  function DesignStaffList(props) {
    var store = props.store;
    var list = props.staff || [];
    if (!list.length) return null;
    var groups = [];
    var index = {};
    list.forEach(function (p) {
      var g = index[p.dept];
      if (!g) {
        g = index[p.dept] = { dept: p.dept, people: [] };
        groups.push(g);
      }
      g.people.push(p);
    });
    return h(
      "div",
      { className: cx("design-staff", props.compact && "compact") },
      h("span", { className: "design-staff-label" }, "デザイン担当"),
      h(
        "ul",
        null,
        groups.map(function (g) {
          return h(
            "li",
            { key: g.dept },
            g.dept ? h("span", { className: "design-staff-dept" }, g.dept) : null,
            g.people.map(function (p, i) {
              var u = store.userForStaff(p);
              return h(
                UserLink,
                {
                  key: p.name + i,
                  store: store,
                  user: u,
                  className: cx("design-staff-person", u && "linked"),
                  title: u ? u.displayName + " さんのページを見る" : p.name + "（RecordPOOL未登録）",
                },
                h(C.Avatar, { user: u || { displayName: p.name }, size: "sm" }),
                h("span", { className: "design-staff-name" }, u ? u.displayName : p.name)
              );
            })
          );
        })
      )
    );
  }

  // ====================================================================
  // タイムライン（新しい投稿から順に、写真・内容・投稿者を眺める）
  // ====================================================================
  var TL_PAGE = 8;
  var TL_STATE_KEY = "caseshelf_timeline_state";

  function relativeTime(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    var diff = Math.max(0, Date.now() - t) / 1000;
    if (diff < 60) return "たった今";
    if (diff < 3600) return Math.floor(diff / 60) + "分前";
    if (diff < 86400) return Math.floor(diff / 3600) + "時間前";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + "日前";
    var d = new Date(t);
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function TimelinePost(props) {
    var store = props.store;
    var project = props.project;
    var route = props.route;
    var author = store.authorOf(project);
    var saved = store.isSaved(project.id);
    var _more = useState(false);
    var expanded = _more[0],
      setExpanded = _more[1];
    var desc = String(project.description || "");
    var longDesc = desc.length > 90 || desc.split(/\r?\n/).length > 3;

    return h(
      "article",
      { className: "tl-post" },
      h(
        "header",
        { className: "tl-head" },
        h(UserLink, { store: store, user: author, className: "tl-avatar-link" }, h(C.Avatar, { user: author, size: "sm" })),
        h(
          "div",
          { className: "tl-head-text" },
          h("div", { className: "tl-author" }, h(UserLink, { store: store, user: author }, author.displayName)),
          h(
            "div",
            { className: "tl-meta" },
            relativeTime(project.createdAt),
            project.propertyNo ? " · 物件No " + project.propertyNo : ""
          )
        ),
        project.isSample ? h("span", { className: "sample-badge" }, "サンプル") : null
      ),
      h(C.PhotoCarousel, { photos: project.photos, alt: project.title, className: "tl-photos", loading: "lazy" }),
      h(
        "div",
        { className: "tl-body" },
        h(
          "div",
          { className: "tl-actions" },
          !project.isSample && store.reactionsAvailable
            ? h(C.ReactionBar, {
                groups: store.reactionsFor(project.id),
                onToggle: function (emoji) {
                  store.toggleReaction(project.id, emoji);
                },
              })
            : h("div", null),
          !project.isSample
            ? h(
                "button",
                {
                  type: "button",
                  className: cx("tl-save", saved && "saved"),
                  onClick: function () {
                    store.toggleSave(project.id);
                  },
                  "aria-pressed": saved,
                  title: saved ? "保存を解除" : "保存",
                },
                saved ? "★" : "☆",
                h("span", null, saved ? "保存済み" : "保存")
              )
            : null
        ),
        h("a", { className: "tl-title", href: "#/project/" + project.id }, project.title),
        h(PostMeta, { project: project, compact: true }),
        h(DesignStaffList, { staff: project.designStaff, store: store, compact: true }),
        desc
          ? h(
              "p",
              { className: cx("tl-desc", !expanded && longDesc && "clamped") },
              desc
            )
          : null,
        desc && longDesc
          ? h(
              "button",
              {
                type: "button",
                className: "link-btn tl-more",
                onClick: function () {
                  setExpanded(!expanded);
                },
              },
              expanded ? "閉じる" : "続きを読む"
            )
          : null,
        project.tags.length
          ? h(
              "div",
              { className: "tl-tags" },
              project.tags.map(function (t) {
                return h(
                  "a",
                  { key: t, className: "tl-tag", href: "#/feed" + AppUtils.buildQuery({ tag: t }) },
                  "#" + t
                );
              })
            )
          : null,
        h("a", { className: "tl-detail-link", href: "#/project/" + project.id }, "詳細を見る ›")
      )
    );
  }

  function TimelinePage(props) {
    var store = props.store;
    var list = useMemo(
      function () {
        return sortNewestFirst(store.projects);
      },
      [store.projects]
    );

    function readState() {
      try {
        return JSON.parse(sessionStorage.getItem(TL_STATE_KEY) || "null");
      } catch (e) {
        return null;
      }
    }
    var restored = useMemo(readState, []);
    var _count = useState((restored && restored.count) || TL_PAGE);
    var count = _count[0],
      setCount = _count[1];
    var countRef = useRef(count);
    countRef.current = count;
    var sentinelRef = useRef(null);

    // 前回見ていた位置に戻す（詳細画面から戻ったとき）
    useEffect(function () {
      if (restored && restored.scrollY) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            window.scrollTo(0, restored.scrollY);
          });
        });
      } else {
        window.scrollTo(0, 0);
      }
      function onScroll() {
        try {
          sessionStorage.setItem(TL_STATE_KEY, JSON.stringify({ count: countRef.current, scrollY: window.scrollY }));
        } catch (e) {}
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      return function () {
        window.removeEventListener("scroll", onScroll);
      };
    }, []);

    // 下までスクロールしたら続きを表示する
    useEffect(
      function () {
        var el = sentinelRef.current;
        if (!el) return;
        var obs = new IntersectionObserver(
          function (entries) {
            if (entries[0].isIntersecting) {
              setCount(function (c) {
                return Math.min(list.length, c + TL_PAGE);
              });
            }
          },
          { rootMargin: "800px" }
        );
        obs.observe(el);
        return function () {
          obs.disconnect();
        };
      },
      [list.length, count]
    );

    if (!list.length) {
      return h(
        "div",
        { className: "empty-state" },
        h("div", null, "まだ案件が投稿されていません。"),
        h("a", { className: "btn primary", href: "#/new" }, "案件を投稿する")
      );
    }

    var visible = list.slice(0, count);
    return h(
      "div",
      { className: "timeline" },
      visible.map(function (p) {
        return h(TimelinePost, { key: p.id, project: p, store: store, route: props.route });
      }),
      count < list.length
        ? h(
            React.Fragment,
            null,
            h("div", { className: "grid-loading-more" }, "読み込み中..."),
            h("div", { className: "grid-sentinel", ref: sentinelRef })
          )
        : h("div", { className: "tl-end" }, "すべての投稿を表示しました")
    );
  }

  // ====================================================================
  // 案件詳細
  // ====================================================================
  function ProjectDetailPage(props) {
    var store = props.store;
    var route = props.route;
    var project = store.projects.find(function (p) {
      return p.id === route.params.id;
    });
    var _confirm = useState(false);
    var confirmOpen = _confirm[0],
      setConfirmOpen = _confirm[1];

    useEffect(
      function () {
        // 他の人が付けたリアクションを反映するため、開いたときに読み込み直す
        if (project && !project.isSample) store.refreshPostReactions(project.id);
      },
      [project && project.id]
    );

    if (!project) {
      return h(
        "div",
        { className: "empty-state" },
        h("div", null, "案件が見つかりませんでした。削除された可能性があります。"),
        h(
          "a",
          { className: "btn primary", href: "#/feed" },
          "一覧へ戻る"
        )
      );
    }

    var author = store.authorOf(project);
    var canEdit = store.canEdit(project);
    var saved = store.isSaved(project.id);

    function handleDelete() {
      setConfirmOpen(false);
      store.deleteProject(project.id).then(function (res) {
        if (!res.ok) {
          store.toast(res.error, "error");
          return;
        }
        store.toast("案件を削除しました。", "success");
        route.navigate("/feed", { replace: true });
      });
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "detail-layout" },
      h(C.PhotoCarousel, { photos: project.photos, alt: project.title, resetKey: project.id, className: "detail-photos" }),
      h(
        "div",
        { className: "detail-body" },
        h(
          "div",
          { className: "detail-header" },
          h("h1", { className: "detail-title" }, project.title),
          project.isSample
            ? h("span", { className: "sample-badge" }, "サンプル")
            : h(
                "button",
                {
                  className: cx("btn", saved ? "primary" : "ghost", "sm"),
                  onClick: function () {
                    store.toggleSave(project.id);
                  },
                },
                saved ? "★ 保存済み" : "☆ 保存"
              )
        ),
        h(
          "div",
          { className: "detail-author-row" },
          h(
            UserLink,
            { store: store, user: author, className: "detail-author" },
            h(C.Avatar, { user: author, size: "sm" }),
            h("span", null, author.displayName)
          ),
          h("span", null, "·"),
          h("span", null, AppUtils.formatDateTime(project.createdAt)),
          project.propertyNo ? h("span", null, "·") : null,
          project.propertyNo ? h("span", null, "物件No " + project.propertyNo) : null,
          // 売上金額（金額帯）。正確な金額ではなく、帯で表示する
          typeof project.salesBand === "number" ? h("span", null, "·") : null,
          typeof project.salesBand === "number"
            ? h("span", { className: "sales-band", title: "予算（金額帯）" }, "予算 " + AppUtils.salesBandLabel(project.salesBand))
            : null
        ),
        h(PostMeta, { project: project }),
        h(DesignStaffList, { staff: project.designStaff, store: store }),
        h(
          "div",
          { className: "tag-list" },
          project.tags.map(function (t) {
            return h(C.Chip, {
              key: t,
              label: t,
              clickable: true,
              onClick: function () {
                route.navigate("/feed" + AppUtils.buildQuery({ tag: t }));
              },
            });
          })
        ),
        project.description
          ? h("p", { className: "detail-desc" }, project.description)
          : null,
        !project.isSample && store.reactionsAvailable
          ? h(C.ReactionBar, {
              groups: store.reactionsFor(project.id),
              onToggle: function (emoji) {
                store.toggleReaction(project.id, emoji);
              },
            })
          : null,
        h(
          "div",
          { className: "detail-actions" },
          project.salesforceUrl
            ? h(
                "a",
                {
                  className: "btn",
                  href: project.salesforceUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                "Salesforceで案件を見る"
              )
            : null,
          canEdit
            ? h(
                "a",
                { className: "btn", href: "#/edit/" + project.id },
                "編集"
              )
            : null,
          canEdit
            ? h(
                "button",
                {
                  className: "btn danger",
                  onClick: function () {
                    setConfirmOpen(true);
                  },
                },
                "削除"
              )
            : null
        )
      )
      ),
      h(C.ConfirmDialog, {
        open: confirmOpen,
        title: "この案件を削除しますか？",
        message: "「" + project.title + "」と登録されたすべての写真が削除されます。この操作は取り消せません。",
        danger: true,
        confirmLabel: "削除する",
        onCancel: function () {
          setConfirmOpen(false);
        },
        onConfirm: handleDelete,
      })
    );
  }

  // ====================================================================
  // 投稿・編集フォーム
  // ====================================================================
  function uploadStatusLabel(ph) {
    if (ph.status === "uploading") return "アップロード中...";
    if (ph.status === "error") return ph.errorMessage || "エラー";
    return "";
  }

  // 写真の元ファイルの容量（バイト）。以前の投稿で記録が無い場合は、保存データの大きさから見積もる。
  function photoOriginalSize(p) {
    if (typeof p.size === "number") return p.size;
    if (p.url && p.url.indexOf("data:") === 0) return Math.round(p.url.length * 0.75);
    return 0;
  }
  function totalPhotoSize(list) {
    return list.reduce(function (sum, p) {
      return p.status === "error" ? sum : sum + (p.size || 0);
    }, 0);
  }

  function PostFormPage(props) {
    var store = props.store;
    var route = props.route;
    var editId = route.params.id || null;
    var existing = editId
      ? store.projects.find(function (p) {
          return p.id === editId;
        })
      : null;

    var isEdit = !!editId;
    var notAllowed = isEdit && (!existing || !store.canEdit(existing));
    var _saving = useState(false);
    var saving = _saving[0],
      setSaving = _saving[1];

    var _title = useState(existing ? existing.title : "");
    var title = _title[0],
      setTitle = _title[1];
    var _desc = useState(existing ? existing.description : "");
    var desc = _desc[0],
      setDesc = _desc[1];
    var _sfdc = useState(existing ? existing.salesforceUrl : "");
    var sfdc = _sfdc[0],
      setSfdc = _sfdc[1];
    var _propNo = useState(existing ? existing.propertyNo || "" : "");
    var propNo = _propNo[0],
      setPropNo = _propNo[1];
    // 物件Noでの検索の状態: { state: "idle" | "searching" | "found" | "notFound" | "error", message }
    var _sfSearch = useState({ state: "idle", message: "" });
    var sfSearch = _sfSearch[0],
      setSfSearch = _sfSearch[1];
    var searchSeqRef = useRef(0);
    // 物件Noで検索したときの売上金額の金額帯 { no, band }
    var salesRef = useRef(null);
    // デザイン担当者 { 部門名: 担当者名 }
    var departments = AppSF.designDepartments();
    var _staff = useState(function () {
      var m = {};
      ((existing && existing.designStaff) || []).forEach(function (d) {
        m[d.dept] = m[d.dept] ? m[d.dept] + "、" + d.name : d.name;
      });
      return m;
    });
    // 担当者名 → Salesforceのメールアドレス（RecordPOOLの利用者と結び付けるため、保存時に一緒に記録する）
    var staffEmailRef = useRef(null);
    if (!staffEmailRef.current) {
      staffEmailRef.current = {};
      ((existing && existing.designStaff) || []).forEach(function (d) {
        if (d.email) staffEmailRef.current[d.name] = d.email;
      });
    }
    var staff = _staff[0],
      setStaff = _staff[1];
    var staffEnabled = AppSF.designStaffAvailable() && departments.length > 0;

    // 物件種別（カテゴリ）・会場
    var typeEnabled = AppSF.propertyTypeFieldAvailable();
    var venueEnabled = AppSF.venueFieldAvailable();
    var _ptypes = useState(existing && existing.propertyTypes ? existing.propertyTypes.slice() : []);
    var propertyTypes = _ptypes[0],
      setPropertyTypes = _ptypes[1];
    var _venue = useState(existing ? existing.venue || "" : "");
    var venue = _venue[0],
      setVenue = _venue[1];
    // 物件種別の選択肢：Salesforceの選択リストの値＋投稿で使われている値
    var _typeOpts = useState([]);
    var typeOptions = _typeOpts[0],
      setTypeOptions = _typeOpts[1];
    useEffect(function () {
      if (!typeEnabled) return;
      var alive = true;
      AppSSO.loadPropertyTypeOptions().then(function (list) {
        if (alive) setTypeOptions(list);
      });
      return function () {
        alive = false;
      };
    }, []);
    var allTypeOptions = useMemo(
      function () {
        var out = typeOptions.slice();
        store.allPropertyTypes.concat(propertyTypes).forEach(function (t) {
          if (out.indexOf(t) === -1) out.push(t);
        });
        return out;
      },
      [typeOptions, store.allPropertyTypes, propertyTypes]
    );

    // 投稿者（代理で投稿するときに、表示する人を選ぶ）。新規は自分、編集は今の投稿者
    // 代理投稿は、Salesforce上の所有者を変えるため管理者（RecordPOOL管理者の権限セットを持つ人）だけが行える
    var authorEnabled = AppSF.authorFieldAvailable() && store.isAdmin;
    var creatorEmail = existing ? existing.creatorEmail : (store.currentUser && store.currentUser.email) || "";
    var _author = useState(existing ? existing.authorEmail : creatorEmail);
    var authorEmail = _author[0],
      setAuthorEmail = _author[1];
    var authorChoices = useMemo(
      function () {
        var list = store.users
          .filter(function (u) {
            return u.status === "active" || String(u.email).toLowerCase() === String(authorEmail).toLowerCase();
          })
          .map(function (u) {
            return Object.assign({}, u, { department: store.departmentOf(u) });
          })
          .sort(function (a, b) {
            return String(a.displayName).localeCompare(String(b.displayName), "ja");
          });
        // 選択中の人が利用者一覧にいない場合（登録が削除された等）も選択肢に残す
        if (
          authorEmail &&
          !list.some(function (u) {
            return String(u.email).toLowerCase() === String(authorEmail).toLowerCase();
          })
        ) {
          list.unshift({ id: "keep", email: authorEmail, displayName: authorEmail });
        }
        return list;
      },
      [store.users, authorEmail]
    );
    var _tags = useState(existing ? existing.tags.slice() : []);
    var tags = _tags[0],
      setTags = _tags[1];
    var _photos = useState(
      existing
        ? existing.photos.map(function (p) {
            return { id: p.id, status: "done", size: photoOriginalSize(p) };
          })
        : []
    );
    var photos = _photos[0],
      setPhotos = _photos[1];
    var _cover = useState(existing ? existing.coverPhotoId : null);
    var coverId = _cover[0],
      setCoverId = _cover[1];
    var _errors = useState({});
    var errors = _errors[0],
      setErrors = _errors[1];
    var _dragOver = useState(false);
    var dragOver = _dragOver[0],
      setDragOver = _dragOver[1];
    var fileInputRef = useRef(null);

    useEffect(
      function () {
        if (!coverId && photos.length) setCoverId(photos[0].id);
      },
      [photos, coverId]
    );

    if (notAllowed) {
      return h(
        "div",
        { className: "empty-state" },
        h("div", null, "この案件を編集する権限がありません。"),
        h("a", { className: "btn primary", href: "#/feed" }, "一覧へ戻る")
      );
    }

    function addFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      if (!files.length) return;
      var limits = AppData.LIMITS;
      var maxBytes = limits.maxProjectSizeMB * 1024 * 1024;
      // 選択した写真を順に受け付け、枚数・合計容量の上限を超えるものは受け付けない
      var count = photos.filter(function (p) {
        return p.status !== "error";
      }).length;
      var total = totalPhotoSize(photos);
      var countErrorShown = false;
      files.forEach(function (file) {
        if (count >= limits.maxPhotosPerProject) {
          if (!countErrorShown) {
            store.toast("写真は1投稿あたり最大" + limits.maxPhotosPerProject + "枚までです。", "error");
            countErrorShown = true;
          }
          return;
        }
        if (limits.acceptedTypes.indexOf(file.type) === -1) {
          store.toast("「" + file.name + "」は対応していない形式です（JPEG/PNG/WEBP/GIFのみ）。", "error");
          return;
        }
        if (total + file.size > maxBytes) {
          store.toast(
            "「" + file.name + "」（" + AppUtils.formatMB(file.size) + "）を追加すると、1投稿あたりの上限" +
              limits.maxProjectSizeMB + "MBを超えます（現在の合計 " + AppUtils.formatMB(total) + "）。",
            "error"
          );
          return;
        }
        count++;
        total += file.size;
        var localId = AppData.uid("tmp");
        setPhotos(function (prev) {
          return prev.concat([{ id: localId, url: null, status: "uploading", progress: 0, size: file.size }]);
        });
        var startedAt = Date.now();
        var interval = setInterval(function () {
          setPhotos(function (prev) {
            return prev.map(function (p) {
              if (p.id !== localId || p.status !== "uploading") return p;
              var elapsed = Date.now() - startedAt;
              var progress = Math.min(100, Math.round((elapsed / 700) * 100));
              return Object.assign({}, p, { progress: progress });
            });
          });
        }, 80);
        AppUtils.compressImage(file, limits.storeMaxEdgePx, limits.storeJpegQuality)
          .then(function (dataUrl) {
            return AppUtils.wait(650).then(function () {
              return dataUrl;
            });
          })
          .then(function (dataUrl) {
            clearInterval(interval);
            setPhotos(function (prev) {
              return prev.map(function (p) {
                return p.id === localId
                  ? { id: localId, url: dataUrl, status: "done", size: file.size }
                  : p;
              });
            });
          })
          .catch(function () {
            clearInterval(interval);
            setPhotos(function (prev) {
              return prev.map(function (p) {
                return p.id === localId
                  ? Object.assign({}, p, { status: "error", errorMessage: "読み込みに失敗しました" })
                  : p;
              });
            });
          });
      });
    }

    function removePhoto(id) {
      setPhotos(function (prev) {
        return prev.filter(function (p) {
          return p.id !== id;
        });
      });
      if (coverId === id) setCoverId(null);
    }

    function movePhoto(id, dir) {
      setPhotos(function (prev) {
        var idx = prev.findIndex(function (p) {
          return p.id === id;
        });
        var newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= prev.length) return prev;
        var next = prev.slice();
        var tmp = next[idx];
        next[idx] = next[newIdx];
        next[newIdx] = tmp;
        return next;
      });
    }

    // 物件NoでSalesforceの商談を検索し、案件名・Salesforce案件URLを自動入力する
    function searchByPropertyNo() {
      var no = propNo.trim();
      if (!no) {
        setSfSearch({ state: "error", message: "物件Noを入力してください。" });
        return;
      }
      var seq = ++searchSeqRef.current;
      setSfSearch({ state: "searching", message: "" });
      AppSSO.searchOpportunityByPropertyNo(no).then(
        function (opp) {
          if (seq !== searchSeqRef.current) return;
          if (!opp) {
            setSfSearch({
              state: "notFound",
              message: "物件No「" + no + "」の商談が見つかりませんでした。物件Noを確認するか、案件名・URLを手入力してください。",
            });
            return;
          }
          setTitle(opp.name);
          setSfdc(opp.url);
          setErrors(function (prev) {
            return Object.assign({}, prev, { title: null });
          });
          salesRef.current = { no: no, band: AppUtils.salesBand(opp.amount) };
          // 物件種別・会場を入力する（Salesforceに値が無いときは、入力済みの内容を残す）
          var types = opp.propertyTypes || [];
          if (types.length && typeEnabled) setPropertyTypes(types);
          if (opp.venue && venueEnabled) setVenue(opp.venue);
          var baseMsg =
            "商談「" + opp.name + "」が見つかりました。案件名とSalesforce案件URLを入力しました。" +
            (types.length && typeEnabled ? " 物件種別「" + types.join("・") + "」を入力しました。" : "") +
            (opp.venue && venueEnabled ? " 会場「" + opp.venue + "」を入力しました。" : "") +
            (opp.multiple ? "（同じ物件Noの商談が複数あったため、1件目を使いました）" : "");
          if (!staffEnabled) {
            setSfSearch({ state: "found", message: baseMsg });
            return;
          }
          setSfSearch({ state: "found", message: baseMsg + " デザイン担当者を検索しています..." });
          AppSF.findDesignStaff(opp.id).then(
            function (found) {
              if (seq !== searchSeqRef.current) return;
              // 見つかった部門の担当者で置き換える（見つからなかった部門は、入力済みの内容を残す）
              var byDept = {};
              found.forEach(function (d) {
                if (d.email) staffEmailRef.current[d.name] = d.email;
                byDept[d.dept] = byDept[d.dept] ? byDept[d.dept] + "、" + d.name : d.name;
              });
              setStaff(function (prev) {
                return Object.assign({}, prev, byDept);
              });
              setSfSearch({
                state: "found",
                message:
                  baseMsg +
                  (found.length
                    ? " デザイン担当者（" +
                      Object.keys(byDept)
                        .map(function (k) {
                          return k + "：" + byDept[k];
                        })
                        .join("／") +
                      "）を入力しました。"
                    : " デザイン担当者はSalesforceに登録されていませんでした（必要なら手入力してください）。"),
              });
            },
            function (e) {
              if (seq !== searchSeqRef.current) return;
              setSfSearch({
                state: "found",
                message: baseMsg + " ただし、デザイン担当者は取得できませんでした（" + e.message + "）。必要なら手入力してください。",
              });
            }
          );
        },
        function (e) {
          if (seq !== searchSeqRef.current) return;
          setSfSearch({ state: "error", message: e.message });
        }
      );
    }

    function validate() {
      var errs = {};
      if (!title.trim()) errs.title = "案件名を入力してください。";
      var doneDonePhotos = photos.filter(function (p) {
        return p.status === "done";
      });
      if (doneDonePhotos.length === 0) errs.photos = "写真を1枚以上登録してください。";
      else if (doneDonePhotos.length > AppData.LIMITS.maxPhotosPerProject)
        errs.photos = "写真は1投稿あたり最大" + AppData.LIMITS.maxPhotosPerProject + "枚までです。不要な写真を削除してください。";
      else if (totalPhotoSize(doneDonePhotos) > AppData.LIMITS.maxProjectSizeMB * 1024 * 1024)
        errs.photos = "写真の合計容量が" + AppData.LIMITS.maxProjectSizeMB + "MBを超えています。写真を減らしてください。";
      if (tags.length === 0) errs.tags = "ハッシュタグを1つ以上設定してください。";
      if (photos.some(function (p) { return p.status === "uploading"; })) {
        errs.uploading = "アップロード完了までお待ちください。";
      }
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }

    function handleSubmit(e) {
      e.preventDefault();
      if (!validate()) {
        store.toast("入力内容をご確認ください。", "error");
        return;
      }
      if (saving) return;
      // 新しく追加した写真（仮ID "tmp_..."）は dataUrl を付けて渡し、保存時にSalesforceへ送る
      var finalPhotos = photos
        .filter(function (p) {
          return p.status === "done";
        })
        .map(function (p) {
          var isNew = String(p.id).indexOf("tmp_") === 0;
          return isNew ? { id: p.id, size: p.size || 0, dataUrl: p.url } : { id: p.id, size: p.size || 0 };
        });
      var finalCoverId =
        finalPhotos.some(function (p) { return p.id === coverId; }) ? coverId : finalPhotos[0].id;

      var payload = {
        title: title.trim(),
        description: desc.trim(),
        tags: AppUtils.uniqueTags(tags),
        photos: finalPhotos,
        coverPhotoId: finalCoverId,
        salesforceUrl: sfdc.trim(),
        propertyNo: propNo.trim(),
        propertyTypes: typeEnabled ? propertyTypes : undefined,
        venue: venueEnabled ? venue.trim() : undefined,
        // 投稿者が実際に投稿した人と同じなら空（代理投稿ではない）
        authorEmail: authorEnabled
          ? String(authorEmail).toLowerCase() === String(creatorEmail).toLowerCase()
            ? ""
            : authorEmail
          : undefined,
        // 選んだ投稿者を、Salesforce上の投稿の所有者にする（代理投稿）
        ownerEmail: authorEnabled ? authorEmail : undefined,
        designStaff: departments.reduce(function (acc, d) {
          return acc.concat(
            AppSF.splitNames(staff[d]).map(function (name) {
              var email = staffEmailRef.current[name] || "";
              if (!email) {
                // 手入力した名前が RecordPOOL の利用者の表示名と一致すれば、その人として記録する
                var u = store.userForStaff({ name: name });
                if (u) email = u.email;
              }
              return { dept: d, name: name, email: email };
            })
          );
        }, []),
      };

      setSaving(true);
      resolveSalesBand().then(function (band) {
        if (band !== undefined) payload.salesBand = band;
        submitPayload(payload);
      });
    }

    // 売上金額の金額帯（画面には出さず、検索に使う）。
    // 物件Noで検索済みならその結果、そうでなければ保存時にSalesforceから読み取る。
    // 取れなかったときは undefined（今の値をそのまま残す）
    function resolveSalesBand() {
      if (!AppSF.salesBandAvailable()) return Promise.resolve(undefined);
      var no = propNo.trim();
      if (!no) return Promise.resolve(null);
      if (salesRef.current && salesRef.current.no === no) return Promise.resolve(salesRef.current.band);
      return AppSSO.searchOpportunityByPropertyNo(no).then(
        function (opp) {
          return opp ? AppUtils.salesBand(opp.amount) : undefined;
        },
        function () {
          return undefined;
        }
      );
    }

    function submitPayload(payload) {
      var finalPhotos = payload.photos;
      if (isEdit) {
        var keptIds = finalPhotos.map(function (p) {
          return p.id;
        });
        var removedIds = existing.photos
          .map(function (p) {
            return p.id;
          })
          .filter(function (id) {
            return keptIds.indexOf(id) === -1;
          });
        store.updateProject(existing.id, payload, removedIds).then(function (res) {
          setSaving(false);
          if (!res.ok) {
            store.toast("保存できませんでした。" + res.error, "error");
            return;
          }
          store.toast("案件を更新しました。", "success");
          route.navigate("/project/" + existing.id, { replace: true });
        });
      } else {
        store.addProject(payload).then(function (res) {
          setSaving(false);
          if (!res.ok) {
            store.toast("投稿できませんでした。" + res.error, "error");
            return;
          }
          store.toast("案件を投稿しました。", "success");
          route.navigate("/project/" + res.value.id, { replace: true });
        });
      }
    }

    return h(
      "form",
      { className: "form-page", onSubmit: handleSubmit },
      h("h1", { style: { fontSize: "1.125rem", margin: "0.375rem 0 1.125rem" } }, isEdit ? "案件を編集" : "案件を新規投稿"),

      // ① Salesforceから自動入力（物件Noで検索 → 案件名・物件種別・会場・デザイン担当者・URL）
      h(
        "section",
        { className: "form-step" },
        h(
          "div",
          { className: "form-step-head" },
          h("span", { className: "form-step-no" }, "1"),
          h(
            "div",
            null,
            h("h2", { className: "form-step-title" }, "物件Noを入れてSalesforceから取り込む"),
            h("p", { className: "form-step-desc" }, "検索すると、下の「自動入力」の項目が埋まります。違っていれば直せます。")
          )
        ),
      h(
        "div",
        { className: "field" },
        h("label", { htmlFor: "post-property-no" }, "物件No"),
        h(
          "div",
          { className: "propno-row" },
          h("input", {
            id: "post-property-no",
            className: "text-input",
            value: propNo,
            autoFocus: !isEdit,
            onChange: function (e) {
              setPropNo(e.target.value);
              if (sfSearch.state !== "searching") setSfSearch({ state: "idle", message: "" });
            },
            onKeyDown: function (e) {
              // Enterで投稿せず、検索する
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                searchByPropertyNo();
              }
            },
            placeholder: "例: 12345",
          }),
          h(
            "button",
            {
              type: "button",
              className: "btn",
              onClick: searchByPropertyNo,
              disabled: sfSearch.state === "searching",
            },
            sfSearch.state === "searching" ? "検索中..." : "Salesforceで検索"
          )
        ),
        sfSearch.message
          ? h(
              "div",
              { className: sfSearch.state === "found" ? "propno-result found" : "error", role: "status" },
              sfSearch.message
            )
          : h(
              "div",
              { className: "hint" },
              "物件Noを入力して検索すると、Salesforceの商談から案件名・Salesforce案件URL" +
                (typeEnabled ? "・物件種別" : "") +
                (venueEnabled ? "・会場" : "") +
                (staffEnabled ? "・デザイン担当者" : "") +
                "が自動で入力されます。"
            )
      ),

        h(
          "div",
          { className: cx("auto-fields", sfSearch.state === "found" && "filled") },
      h(
        "div",
        { className: "field" },
        h("label", null, "案件名 ", h("span", { className: "req" }, "必須"), " ", h("span", { className: "auto-badge" }, "自動入力")),
        h("input", {
          className: "text-input",
          value: title,
          onChange: function (e) {
            setTitle(e.target.value);
          },
          placeholder: "例: ○○株式会社 展示会ブース装飾",
        }),
        errors.title ? h("div", { className: "error" }, errors.title) : null
      ),

      typeEnabled
        ? h(
            "div",
            { className: "field" },
            h("label", null, "物件種別 ", h("span", { className: "auto-badge" }, "自動入力")),
            allTypeOptions.length
              ? h(
                  "div",
                  { className: "type-choices", role: "group", "aria-label": "物件種別" },
                  allTypeOptions.map(function (t) {
                    var on = propertyTypes.indexOf(t) !== -1;
                    return h(
                      "button",
                      {
                        key: t,
                        type: "button",
                        className: cx("type-choice", on && "on"),
                        "aria-pressed": on,
                        onClick: function () {
                          setPropertyTypes(function (prev) {
                            return on
                              ? prev.filter(function (x) {
                                  return x !== t;
                                })
                              : prev.concat([t]);
                          });
                        },
                      },
                      on ? "✓ " + t : t
                    );
                  })
                )
              : h("div", { className: "hint" }, "物件Noで検索すると自動で入力されます。"),
            h("div", { className: "hint" }, "押すと選択・解除できます。一覧の検索・絞り込みで、物件種別から探せます。")
          )
        : null,

      venueEnabled
        ? h(
            "div",
            { className: "field" },
            h("label", { htmlFor: "post-venue" }, "会場 ", h("span", { className: "auto-badge" }, "自動入力")),
            h("input", {
              id: "post-venue",
              className: "text-input",
              value: venue,
              maxLength: 255,
              list: "venue-suggest",
              onChange: function (e) {
                setVenue(e.target.value);
              },
              placeholder: "例: 東京ビッグサイト",
            }),
            h(
              "datalist",
              { id: "venue-suggest" },
              store.allVenues.map(function (v) {
                return h("option", { key: v, value: v });
              })
            ),
            h("div", { className: "hint" }, "一覧の検索・絞り込みで、会場から探せます。")
          )
        : null,

      staffEnabled
        ? h(
            "div",
            { className: "field" },
            h("label", null, "デザイン担当者 ", h("span", { className: "auto-badge" }, "自動入力")),
            h(
              "div",
              { className: "staff-inputs" },
              departments.map(function (d, i) {
                var id = "post-staff-" + i;
                return h(
                  "div",
                  { key: d, className: "staff-row" },
                  h("label", { htmlFor: id, className: "staff-dept" }, d),
                  h("input", {
                    id: id,
                    className: "text-input",
                    value: staff[d] || "",
                    maxLength: 200,
                    onChange: function (e) {
                      var v = e.target.value;
                      setStaff(function (prev) {
                        var next = Object.assign({}, prev);
                        next[d] = v;
                        return next;
                      });
                    },
                    placeholder: "担当者名",
                  })
                );
              })
            ),
            h("div", { className: "hint" }, "複数人いる場合は「、」で区切って入力してください。空欄の部門は表示されません。")
          )
        : null,

      h(
        "div",
        { className: "field" },
        h("label", null, "Salesforce案件URL ", h("span", { className: "auto-badge" }, "自動入力")),
        h("input", {
          className: "text-input",
          value: sfdc,
          onChange: function (e) {
            setSfdc(e.target.value);
          },
          placeholder: "https://...",
        }),
        h("div", { className: "hint" }, "入力すると案件詳細に「Salesforceで案件を見る」ボタンが表示されます。")
      ),

        )
      ),

      // ② 投稿する人が入力する項目
      h(
        "section",
        { className: "form-step" },
        h(
          "div",
          { className: "form-step-head" },
          h("span", { className: "form-step-no" }, "2"),
          h(
            "div",
            null,
            h("h2", { className: "form-step-title" }, "写真とハッシュタグを入力する"),
            h("p", { className: "form-step-desc" }, "ここはSalesforceから入らないので、投稿する人が入力してください。")
          )
        ),
      h(
        "div",
        { className: "field" },
        h("label", null, "写真 ", h("span", { className: "req" }, "必須"), h("span", { className: "label-note" }, "複数枚OK")),
        h(
          "div",
          {
            className: cx("dropzone", dragOver && "dragover"),
            onClick: function () {
              fileInputRef.current && fileInputRef.current.click();
            },
            onDragOver: function (e) {
              e.preventDefault();
              setDragOver(true);
            },
            onDragLeave: function () {
              setDragOver(false);
            },
            onDrop: function (e) {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            },
          },
          "タップして写真を選択 / PCではドラッグ＆ドロップ",
          h(
            "div",
            { className: "hint" },
            "JPEG/PNG/WEBP/GIF・最大" + AppData.LIMITS.maxPhotosPerProject + "枚・1投稿の合計" + AppData.LIMITS.maxProjectSizeMB + "MBまで"
          )
        ),
        h("input", {
          ref: fileInputRef,
          type: "file",
          accept: "image/*",
          multiple: true,
          style: { display: "none" },
          onChange: function (e) {
            addFiles(e.target.files);
            e.target.value = "";
          },
        }),
        photos.length
          ? h(
              "div",
              { className: "photo-edit-list" },
              photos.map(function (p, i) {
                return h(
                  "div",
                  { key: p.id, className: cx("photo-edit-item", p.id === coverId && "cover") },
                  p.status === "done"
                    ? h(C.Photo, { photo: p, alt: "写真" + (i + 1) })
                    : h("div", { style: { width: "100%", height: "100%", background: "#ddd" } }),
                  p.id === coverId ? h("span", { className: "cover-badge" }, "代表") : null,
                  h(
                    "div",
                    { className: "photo-overlay" },
                    h(
                      "div",
                      { style: { display: "flex", gap: "0.1875rem", justifyContent: "flex-end" } },
                      h(
                        "button",
                        {
                          type: "button",
                          className: "photo-mini-btn",
                          onClick: function () {
                            removePhoto(p.id);
                          },
                        },
                        "削除"
                      )
                    ),
                    h(
                      "div",
                      { style: { display: "flex", gap: "0.1875rem", justifyContent: "space-between" } },
                      h(
                        "button",
                        {
                          type: "button",
                          className: "photo-mini-btn",
                          disabled: i === 0,
                          onClick: function () {
                            movePhoto(p.id, -1);
                          },
                        },
                        "←"
                      ),
                      p.status === "done"
                        ? h(
                            "button",
                            {
                              type: "button",
                              className: "photo-mini-btn",
                              onClick: function () {
                                setCoverId(p.id);
                              },
                            },
                            "代表に設定"
                          )
                        : null,
                      h(
                        "button",
                        {
                          type: "button",
                          className: "photo-mini-btn",
                          disabled: i === photos.length - 1,
                          onClick: function () {
                            movePhoto(p.id, 1);
                          },
                        },
                        "→"
                      )
                    )
                  ),
                  p.status === "uploading"
                    ? h(
                        "div",
                        { className: "upload-progress-bar" },
                        h("div", { className: "fill", style: { width: (p.progress || 0) + "%" } })
                      )
                    : null,
                  p.status === "error"
                    ? h("div", { className: "upload-error-badge" }, uploadStatusLabel(p))
                    : null
                );
              })
            )
          : null,
        photos.length
          ? h(
              "div",
              { className: "hint photo-usage" },
              photos.filter(function (p) { return p.status !== "error"; }).length + " / " + AppData.LIMITS.maxPhotosPerProject +
                "枚・合計 " + AppUtils.formatMB(totalPhotoSize(photos)) + " / " + AppData.LIMITS.maxProjectSizeMB + "MB"
            )
          : null,
        errors.photos ? h("div", { className: "error" }, errors.photos) : null,
        errors.uploading ? h("div", { className: "error" }, errors.uploading) : null
      ),

      h(
        "div",
        { className: "field" },
        h("label", null, "ハッシュタグ ", h("span", { className: "req" }, "必須"), h("span", { className: "label-note" }, "複数設定OK")),
        h(C.TagAutocomplete, {
          value: tags,
          onChange: setTags,
          allTags: store.allTags,
        }),
        h("div", { className: "hint" }, "先頭の#は付けても付けなくても構いません。同じタグは自動的にまとめられます。"),
        errors.tags ? h("div", { className: "error" }, errors.tags) : null
      ),

      h(
        "div",
        { className: "field" },
        h("label", null, "案件説明 ", h("span", { className: "opt" }, "任意")),
        h("textarea", {
          className: "textarea",
          value: desc,
          onChange: function (e) {
            setDesc(e.target.value);
          },
          placeholder: "案件の概要、工夫した点などを記入してください。",
        })
      ),

      ),

      // ③ 投稿者（管理者が代理で投稿するときだけ）
      authorEnabled
        ? h(
            "section",
            { className: "form-step" },
            h(
              "div",
              { className: "form-step-head" },
              h("span", { className: "form-step-no" }, "3"),
              h(
                "div",
                null,
                h("h2", { className: "form-step-title" }, "投稿者（代理で投稿するときだけ変更）"),
                h("p", { className: "form-step-desc" }, "ふだんは変更不要です。")
              )
            ),
      authorEnabled
        ? h(
            "div",
            { className: "field" },
            h("label", { htmlFor: "post-author" }, "投稿者"),
            h(C.UserPicker, {
              id: "post-author",
              users: authorChoices,
              value: authorEmail,
              onChange: setAuthorEmail,
              suffixFor: function (u) {
                return String(u.email).toLowerCase() === String(creatorEmail).toLowerCase() ? (isEdit ? "（実際に投稿した人）" : "（自分）") : "";
              },
            }),
            h(
              "div",
              { className: "hint" },
              "案件の担当者に代わって投稿するときは、担当者を選んでください。選んだ人がこの投稿の所有者になり、" +
                "投稿者として表示され（マイページにも表示）、編集・削除できるようになります。"
            )
          )
        : null,

          )
        : null,

      h(
        "div",
        { className: "form-sticky-footer" },
        h(
          "a",
          { className: "btn ghost block", href: isEdit ? "#/project/" + existing.id : "#/feed" },
          "キャンセル"
        ),
        h(
          "button",
          { type: "submit", className: "btn primary block", disabled: saving },
          saving ? "保存中..." : isEdit ? "更新する" : "投稿する"
        )
      ),
      saving
        ? h(
            "div",
            { className: "saving-overlay", role: "status" },
            h("div", { className: "saving-card" }, "Salesforceに保存しています...", h("br"), "（写真の送信に少し時間がかかります）")
          )
        : null
    );
  }

  // ====================================================================
  // 保存した案件
  // ====================================================================
  function SavedPage(props) {
    var store = props.store;
    var savedIds = store.savedIds;
    var projects = sortNewestFirst(
      store.projects.filter(function (p) {
        return savedIds.indexOf(p.id) !== -1;
      })
    );
    return h(C.PhotoGrid, {
      projects: projects,
      reactionsFor: store.reactionsAvailable ? store.reactionsFor : null,
      emptyMessage: "保存した案件はまだありません。気になる案件を保存してみましょう。",
    });
  }

  // ====================================================================
  // プロフィール
  // ====================================================================
  function ProfilePage(props) {
    var store = props.store;
    var user = store.currentUser;
    var _editing = useState(false);
    var editing = _editing[0],
      setEditing = _editing[1];
    var _name = useState(user.displayName);
    var name = _name[0],
      setName = _name[1];
    var avatarInputRef = useRef(null);

    var myProjects = postsBy(store, user);
    var savedCount = store.savedIds.length;

    function onAvatarFile(e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      if (AppData.LIMITS.acceptedTypes.indexOf(file.type) === -1) {
        store.toast("対応していない画像形式です。", "error");
        return;
      }
      AppUtils.compressImage(file, AppData.LIMITS.avatarMaxEdgePx, 0.85)
        .then(function (dataUrl) {
          return store.updateProfile({ avatarDataUrl: dataUrl });
        })
        .then(
          function (res) {
            if (!res.ok) store.toast(res.error, "error");
            else store.toast("プロフィール画像を更新しました。", "success");
          },
          function () {
            store.toast("画像を読み込めませんでした。", "error");
          }
        );
    }

    function saveName() {
      if (!name.trim()) {
        store.toast("表示名を入力してください。", "error");
        return;
      }
      store.updateProfile({ displayName: name.trim() }).then(function (res) {
        if (!res.ok) {
          store.toast(res.error, "error");
          return;
        }
        setEditing(false);
        store.toast("表示名を更新しました。", "success");
      });
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "profile-header" },
        h(
          "div",
          {
            style: { position: "relative", cursor: "pointer" },
            onClick: function () {
              avatarInputRef.current && avatarInputRef.current.click();
            },
            title: "クリックしてプロフィール画像を変更",
          },
          h(C.Avatar, { user: user, size: "lg" })
        ),
        h("input", {
          ref: avatarInputRef,
          type: "file",
          accept: "image/*",
          style: { display: "none" },
          onChange: onAvatarFile,
        }),
        h(
          "div",
          { className: "info" },
          editing
            ? h(
                "div",
                { style: { display: "flex", gap: "0.375rem" } },
                h("input", {
                  className: "text-input",
                  value: name,
                  onChange: function (e) {
                    setName(e.target.value);
                  },
                  autoFocus: true,
                }),
                h("button", { className: "btn primary sm", onClick: saveName, type: "button" }, "保存"),
                h(
                  "button",
                  {
                    className: "btn ghost sm",
                    type: "button",
                    onClick: function () {
                      setName(user.displayName);
                      setEditing(false);
                    },
                  },
                  "キャンセル"
                )
              )
            : h(
                "div",
                { className: "display-name" },
                user.displayName,
                " ",
                h(
                  "button",
                  {
                    className: "btn ghost sm",
                    type: "button",
                    onClick: function () {
                      setEditing(true);
                    },
                  },
                  "編集"
                )
              ),
          store.departmentOf(user) ? h("div", { className: "department" }, store.departmentOf(user)) : null,
          h("div", { className: "email" }, user.email)
        )
      ),
      h(ProfilePosts, {
        store: store,
        user: user,
        extraStat: h("div", null, h("b", null, savedCount), " 件の保存"),
        emptyPosts: "まだ案件を投稿していません。",
      })
    );
  }

  // 利用者が投稿した案件（代理投稿では、投稿者に選ばれた人の投稿）
  function postsBy(store, user) {
    return sortNewestFirst(
      store.projects.filter(function (p) {
        return p.authorId === user.id;
      })
    );
  }
  // 利用者がデザイン担当した案件
  function designedBy(store, user) {
    return sortNewestFirst(
      store.projects.filter(function (p) {
        return (p.designStaff || []).some(function (d) {
          var u = store.userForStaff(d);
          return u && u.id === user.id;
        });
      })
    );
  }

  // マイページ・利用者のページの「投稿」「デザイン担当」の切り替えと一覧
  function ProfilePosts(props) {
    var store = props.store;
    var user = props.user;
    var posts = postsBy(store, user);
    var designed = designedBy(store, user);
    // 「デザイン担当」はクリエイティブ部の人だけに表示する。
    // 部署データを読めなかった場合は、デザイン担当した案件がある人にだけ表示する
    var creative = store.isCreative(user);
    var showDesigned = creative === null ? designed.length > 0 : creative;
    var _tab = useState("posts");
    var tab = showDesigned ? _tab[0] : "posts",
      setTab = _tab[1];
    var list = tab === "posts" ? posts : designed;
    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "profile-stats" },
        h("div", null, h("b", null, posts.length), " 件の投稿"),
        showDesigned ? h("div", null, h("b", null, designed.length), " 件のデザイン担当") : null,
        props.extraStat || null
      ),
      showDesigned
        ? h(
        "div",
        { className: "profile-tabs", role: "tablist" },
        [
          { key: "posts", label: "投稿", count: posts.length },
          { key: "designed", label: "デザイン担当", count: designed.length },
        ].map(function (t) {
          return h(
            "button",
            {
              key: t.key,
              type: "button",
              role: "tab",
              "aria-selected": tab === t.key,
              className: cx("profile-tab", tab === t.key && "active"),
              onClick: function () {
                setTab(t.key);
              },
            },
            t.label,
            h("span", { className: "profile-tab-count" }, t.count)
          );
        })
      )
        : null,
      h(C.PhotoGrid, {
        key: tab,
        projects: list,
        reactionsFor: store.reactionsAvailable ? store.reactionsFor : null,
        emptyMessage: tab === "posts" ? props.emptyPosts : "デザイン担当した案件はまだありません。",
      })
    );
  }

  // 他の利用者のページ（閲覧のみ）
  function UserPage(props) {
    var store = props.store;
    var id = props.route.params.id;
    var user = store.users.find(function (u) {
      return u.id === id;
    });
    useEffect(
      function () {
        window.scrollTo(0, 0);
        // 自分のページはマイページへ
        if (user && store.currentUser && user.id === store.currentUser.id) props.route.navigate("/profile", { replace: true });
      },
      [id]
    );
    if (!user) {
      return h(
        "div",
        { className: "empty-state" },
        h("div", null, "この利用者は見つかりませんでした。"),
        h("a", { className: "btn primary", href: "#/timeline" }, "タイムラインへ戻る")
      );
    }
    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "profile-header" },
        h(C.Avatar, { user: user, size: "lg" }),
        h(
          "div",
          { className: "info" },
          h(
            "div",
            { className: "display-name" },
            user.displayName,
            user.status === "suspended" ? h("span", { className: "status-pill suspended", style: { marginLeft: "0.5rem" } }, "利用停止中") : null
          ),
          store.departmentOf(user) ? h("div", { className: "department" }, store.departmentOf(user)) : null,
          h("div", { className: "email" }, user.email)
        )
      ),
      h(ProfilePosts, {
        key: user.id,
        store: store,
        user: user,
        emptyPosts: user.displayName + " さんの投稿はまだありません。",
      })
    );
  }

  // ====================================================================
  // 管理者画面
  // ====================================================================
  function formatDateTime(iso) {
    var d = new Date(iso);
    return (
      d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " +
      d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0")
    );
  }

  function RequestRow(props) {
    var store = props.store;
    var r = props.request;
    var _role = useState("member");
    var role = _role[0],
      setRole = _role[1];
    var selectId = "req-role-" + r.id;
    return h(
      "tr",
      null,
      h("td", null, r.name || "（名前なし）"),
      h("td", null, r.email),
      h("td", { className: "num" }, formatDateTime(r.requestedAt)),
      h(
        "td",
        null,
        h(
          "div",
          { className: "request-actions" },
          h("label", { htmlFor: selectId, className: "visually-hidden" }, "権限"),
          h(
            "select",
            {
              id: selectId,
              className: "text-input sm-select",
              value: role,
              onChange: function (e) {
                setRole(e.target.value);
              },
            },
            h("option", { value: "member" }, "利用者"),
            h("option", { value: "admin" }, "管理者")
          ),
          h(
            "button",
            {
              className: "btn primary sm",
              onClick: function () {
                store.admin.approveRequest(r.id, role).then(function (res) {
                  store.toast(
                    res.ok ? "「" + r.email + "」を登録しました。Salesforceでログインできるようになります。" : res.error,
                    res.ok ? "success" : "error"
                  );
                  if (res.ok && props.onRegistered) props.onRegistered(res.user);
                });
              },
            },
            "登録する"
          ),
          h(
            "button",
            {
              className: "btn sm",
              onClick: function () {
                store.admin.declineRequest(r.id).then(function (res) {
                  store.toast(res.ok ? "依頼を見送りにしました。" : res.error, res.ok ? "success" : "error");
                });
              },
            },
            "見送る"
          )
        )
      )
    );
  }

  function RequestList(props) {
    var store = props.store;
    var list = store.pendingRequests;
    return h(
      "section",
      { className: "request-section" },
      h("h2", null, "利用登録の依頼", list.length ? h("span", { className: "nav-badge" }, list.length) : null),
      list.length === 0
        ? h("p", { className: "form-hint" }, "未対応の依頼はありません。")
        : h(
            "div",
            { className: "table-scroll" },
            h(
              "table",
              { className: "admin-table" },
              h(
                "thead",
                null,
                h("tr", null, h("th", null, "名前"), h("th", null, "メール"), h("th", null, "依頼日時"), h("th", null, "操作"))
              ),
              h(
                "tbody",
                null,
                list.map(function (r) {
                  return h(RequestRow, { key: r.id, store: store, request: r, onRegistered: props.onRegistered });
                })
              )
            )
          )
    );
  }

  // 利用者の編集（管理者のみ）：表示名・メールアドレス・権限
  function EditUserDialog(props) {
    var store = props.store;
    var u = props.user;
    var isSelf = u.id === store.currentUser.id;
    var _name = useState(u.displayName);
    var name = _name[0],
      setName = _name[1];
    var _email = useState(u.email);
    var email = _email[0],
      setEmail = _email[1];
    var _role = useState(u.role);
    var role = _role[0],
      setRole = _role[1];
    var _saving = useState(false);
    var saving = _saving[0],
      setSaving = _saving[1];
    var _err = useState("");
    var err = _err[0],
      setErr = _err[1];

    function save(e) {
      e.preventDefault();
      if (saving) return;
      setSaving(true);
      setErr("");
      store.admin.updateUser(u.id, { displayName: name, email: email, role: role }).then(function (res) {
        setSaving(false);
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        if (!res.unchanged) {
          store.toast(
            "「" + name.trim() + "」さんの情報を更新しました。" +
              (role === "admin" && u.role !== "admin"
                ? "代理投稿などを行う場合は、Salesforceで権限セット「RecordPOOL管理者」も割り当ててください。"
                : ""),
            "success"
          );
        }
        props.onClose();
      });
    }

    return h(
      "div",
      {
        className: "modal-overlay",
        onClick: function (e) {
          if (e.target === e.currentTarget && !saving) props.onClose();
        },
      },
      h(
        "form",
        { className: "modal-card edit-user-card", onSubmit: save },
        h("h3", null, "利用者の編集"),
        h(
          "div",
          { className: "field" },
          h("label", { htmlFor: "edit-user-name" }, "表示名"),
          h("input", {
            id: "edit-user-name",
            className: "text-input",
            value: name,
            maxLength: 80,
            onChange: function (e) {
              setName(e.target.value);
            },
          })
        ),
        h(
          "div",
          { className: "field" },
          h("label", { htmlFor: "edit-user-email" }, "メールアドレス（Salesforceと同じ）"),
          h("input", {
            id: "edit-user-email",
            className: "text-input",
            type: "email",
            value: email,
            disabled: isSelf,
            onChange: function (e) {
              setEmail(e.target.value);
            },
          }),
          isSelf ? h("div", { className: "hint" }, "自分自身のメールアドレスは変更できません（ログインできなくなるため）。") : null
        ),
        h(
          "div",
          { className: "field" },
          h("label", { htmlFor: "edit-user-role" }, "権限"),
          h(
            "select",
            {
              id: "edit-user-role",
              className: "text-input",
              value: role,
              disabled: isSelf,
              onChange: function (e) {
                setRole(e.target.value);
              },
            },
            h("option", { value: "member" }, "利用者"),
            h("option", { value: "admin" }, "管理者")
          ),
          isSelf
            ? h("div", { className: "hint" }, "自分自身の管理者権限は外せません。ほかの管理者に依頼してください。")
            : h(
                "div",
                { className: "hint" },
                "管理者にすると、管理者画面・すべての投稿の編集・削除・代理投稿ができます。Salesforceの権限セット「RecordPOOL管理者」の割り当ても必要です。"
              )
        ),
        err ? h("div", { className: "error", role: "alert" }, err) : null,
        h(
          "div",
          { className: "modal-actions" },
          h("button", { type: "button", className: "btn ghost", onClick: props.onClose, disabled: saving }, "キャンセル"),
          h("button", { type: "submit", className: "btn primary", disabled: saving }, saving ? "保存中..." : "保存する")
        )
      )
    );
  }

  function AdminPage(props) {
    var store = props.store;
    var _inviteEmail = useState("");
    var inviteEmail = _inviteEmail[0],
      setInviteEmail = _inviteEmail[1];
    var _inviteName = useState("");
    var inviteName = _inviteName[0],
      setInviteName = _inviteName[1];
    var _inviteRole = useState("member");
    var inviteRole = _inviteRole[0],
      setInviteRole = _inviteRole[1];
    var _confirmTarget = useState(null);
    var confirmTarget = _confirmTarget[0],
      setConfirmTarget = _confirmTarget[1];
    var _userQ = useState(""); // 利用者一覧の絞り込み
    var userQ = _userQ[0],
      setUserQ = _userQ[1];
    var _editing = useState(null); // 編集中の利用者
    var editingUser = _editing[0],
      setEditingUser = _editing[1];
    var _deleting = useState(null); // 削除の確認中の利用者
    var deletingUser = _deleting[0],
      setDeletingUser = _deleting[1];
    var _registered = useState(null); // 直前に登録した利用者（登録完了メールの作成用）
    var registered = _registered[0],
      setRegistered = _registered[1];

    // サンプル投稿は管理の対象外
    var realProjects = store.projects.filter(function (p) {
      return !p.isSample;
    });
    var tagCounts = {};
    realProjects.forEach(function (p) {
      p.tags.forEach(function (t) {
        var key = AppUtils.tagKey(t);
        if (!tagCounts[key]) tagCounts[key] = { label: t, count: 0 };
        tagCounts[key].count++;
      });
    });
    var tagList = Object.keys(tagCounts)
      .map(function (k) {
        return tagCounts[k];
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });

    function handleInvite(e) {
      e.preventDefault();
      var email = inviteEmail.trim();
      if (!email || !inviteName.trim()) {
        store.toast("メールアドレスと表示名を入力してください。", "error");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        store.toast("メールアドレスの形式が正しくありません。", "error");
        return;
      }
      store.admin
        .inviteUser({ email: email, displayName: inviteName.trim(), role: inviteRole })
        .then(function (res) {
          if (!res.ok) {
            store.toast(res.error, "error");
            return;
          }
          setInviteEmail("");
          setInviteName("");
          setInviteRole("member");
          setRegistered(res.user);
          store.toast("「" + email + "」を追加しました。Salesforceでログインできるようになります。", "success");
        });
    }

    // 利用者一覧（名前・メール・部で絞り込み。管理者→利用者、名前順）
    var userKey = userQ.trim().toLowerCase().replace(/\s+/g, "");
    var userRows = store.users
      .filter(function (u) {
        if (!userKey) return true;
        return [u.displayName, u.email, store.departmentOf(u)].some(function (v) {
          return String(v || "").toLowerCase().replace(/\s+/g, "").indexOf(userKey) !== -1;
        });
      })
      .sort(function (a, b) {
        if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
        return String(a.displayName).localeCompare(String(b.displayName), "ja");
      });

    function handleDeleteUser() {
      var u = deletingUser;
      setDeletingUser(null);
      if (!u) return;
      store.admin.deleteUser(u.id).then(function (res) {
        store.toast(res.ok ? "「" + u.displayName + "」さんを削除しました。" : res.error, res.ok ? "success" : "error");
      });
    }

    function handleDeleteTag(tag) {
      setConfirmTarget(null);
      store.admin.deleteTagGlobally(tag).then(function (res) {
        store.toast(
          res.ok ? "タグ「" + tag + "」をすべての案件から削除しました。" : res.error,
          res.ok ? "success" : "error"
        );
      });
    }

    return h(
      "div",
      { className: "admin-section" },
      h(C.ProtoBanner, null, "管理者画面: 利用者・投稿のデータはSalesforceに保存されます。利用者を登録すると、本人宛ての登録完了メールをメールソフトで作成できます（自動送信はしません）。"),

      registered
        ? h(RegisteredMailNotice, {
            user: registered,
            onClose: function () {
              setRegistered(null);
            },
          })
        : null,

      h(RequestList, { store: store, onRegistered: setRegistered }),

      h("h2", null, "利用者の登録・編集"),
      h(
        "form",
        { className: "inline-form", onSubmit: handleInvite },
        h("input", {
          className: "text-input",
          placeholder: "メールアドレス（Salesforceと同じ）",
          value: inviteEmail,
          onChange: function (e) {
            setInviteEmail(e.target.value);
          },
        }),
        h("input", {
          className: "text-input",
          placeholder: "表示名",
          value: inviteName,
          onChange: function (e) {
            setInviteName(e.target.value);
          },
        }),
        h(
          "select",
          {
            className: "text-input",
            value: inviteRole,
            onChange: function (e) {
              setInviteRole(e.target.value);
            },
          },
          h("option", { value: "member" }, "利用者"),
          h("option", { value: "admin" }, "管理者")
        ),
        h("button", { className: "btn primary", type: "submit" }, "登録する"),
        h(
          "p",
          { className: "form-hint" },
          "メールアドレスは、その人がSalesforceに登録しているメールアドレスと同じものを入力してください。ログインはSalesforceで行うため、パスワードは不要です。"
        )
      ),
      h(
        "div",
        { className: "admin-user-tools" },
        h(
          "div",
          { className: "search-input-wrap" },
          h(SearchIcon, null),
          h("input", {
            type: "search",
            value: userQ,
            "aria-label": "利用者を検索",
            placeholder: "名前・メールアドレス・部で検索",
            onChange: function (e) {
              setUserQ(e.target.value);
            },
          })
        ),
        h("span", { className: "admin-user-count" }, userRows.length + " / " + store.users.length + " 名")
      ),
      h(
        "div",
        { className: "admin-table-wrap" },
        h(
          "table",
          { className: "admin-table" },
          h(
            "thead",
            null,
            h(
              "tr",
              null,
              h("th", null, "利用者"),
              h("th", null, "メール"),
              h("th", null, "権限"),
              h("th", null, "状態"),
              h("th", null, "操作")
            )
          ),
          h(
            "tbody",
            null,
            userRows.map(function (u) {
              var isSelf = u.id === store.currentUser.id;
              return h(
                "tr",
                { key: u.id },
                h(
                  "td",
                  null,
                  h(UserLink, { store: store, user: u }, u.displayName),
                  isSelf ? h("span", { className: "self-badge" }, "自分") : null,
                  store.departmentOf(u) ? h("div", { className: "admin-dept" }, store.departmentOf(u)) : null
                ),
                h("td", null, u.email),
                h("td", null, h("span", { className: cx("role-badge", u.role) }, u.role === "admin" ? "管理者" : "利用者")),
                h(
                  "td",
                  null,
                  h("span", { className: cx("status-pill", u.status) }, u.status === "active" ? "有効" : "停止中")
                ),
                h(
                  "td",
                  { className: "admin-actions" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "btn sm",
                      onClick: function () {
                        setEditingUser(u);
                      },
                    },
                    "編集"
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "btn sm",
                      disabled: isSelf,
                      title: isSelf ? "自分自身は停止できません" : "",
                      onClick: function () {
                        var wasActive = u.status === "active";
                        store.admin.setUserStatus(u.id, wasActive ? "suspended" : "active").then(function (res) {
                          store.toast(
                            !res.ok ? res.error : wasActive ? "利用を停止しました。" : "利用停止を解除しました。",
                            res.ok ? "success" : "error"
                          );
                        });
                      },
                    },
                    u.status === "active" ? "停止" : "復帰"
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "btn sm danger",
                      disabled: isSelf,
                      title: isSelf ? "自分自身は削除できません" : "",
                      onClick: function () {
                        setDeletingUser(u);
                      },
                    },
                    "削除"
                  )
                )
              );
            })
          )
        )
      ),
      userRows.length === 0 ? h("p", { className: "form-hint" }, "「" + userQ + "」に一致する利用者はいません。") : null,

      editingUser
        ? h(EditUserDialog, {
            key: editingUser.id,
            store: store,
            user: editingUser,
            onClose: function () {
              setEditingUser(null);
            },
          })
        : null,
      h(C.ConfirmDialog, {
        open: !!deletingUser,
        title: "この利用者を削除しますか？",
        message: deletingUser
          ? "「" + deletingUser.displayName + "（" + deletingUser.email + "）」さんを削除します。" +
            "この人はRecordPOOLにログインできなくなります（もう一度登録すれば使えます）。" +
            "この人が投稿した案件・保存・リアクションは削除されません。一時的に使えなくしたいだけの場合は「停止」を使ってください。"
          : "",
        danger: true,
        confirmLabel: "削除する",
        onCancel: function () {
          setDeletingUser(null);
        },
        onConfirm: handleDeleteUser,
      }),

      h("h2", null, "投稿の管理"),
      h(
        "table",
        { className: "admin-table" },
        h(
          "thead",
          null,
          h("tr", null, h("th", null, "案件名"), h("th", null, "投稿者"), h("th", null, "操作"))
        ),
        h(
          "tbody",
          null,
          sortNewestFirst(realProjects).map(function (p) {
            var author = store.authorOf(p);
            return h(
              "tr",
              { key: p.id },
              h("td", null, p.title),
              h("td", null, author ? author.displayName : "不明"),
              h(
                "td",
                { style: { display: "flex", gap: "0.375rem" } },
                h("a", { className: "btn sm", href: "#/project/" + p.id }, "表示"),
                h("a", { className: "btn sm", href: "#/edit/" + p.id }, "編集"),
                h(
                  "button",
                  {
                    className: "btn sm danger",
                    onClick: function () {
                      setConfirmTarget({ type: "project", id: p.id, title: p.title });
                    },
                  },
                  "削除"
                )
              )
            );
          })
        )
      ),

      h("h2", null, "タグの管理"),
      h(
        "table",
        { className: "admin-table" },
        h("thead", null, h("tr", null, h("th", null, "タグ"), h("th", null, "使用件数"), h("th", null, "操作"))),
        h(
          "tbody",
          null,
          tagList.map(function (t) {
            return h(
              "tr",
              { key: t.label },
              h("td", null, "#" + t.label),
              h("td", null, t.count),
              h(
                "td",
                null,
                h(
                  "button",
                  {
                    className: "btn sm danger",
                    onClick: function () {
                      setConfirmTarget({ type: "tag", id: t.label, title: "#" + t.label });
                    },
                  },
                  "削除"
                )
              )
            );
          })
        )
      ),

      h(C.ConfirmDialog, {
        open: !!confirmTarget,
        title: "削除してもよいですか？",
        message: confirmTarget
          ? confirmTarget.type === "project"
            ? "案件「" + confirmTarget.title + "」を削除します。この操作は取り消せません。"
            : "タグ「" + confirmTarget.title + "」をすべての案件から削除します。"
          : "",
        danger: true,
        confirmLabel: "削除する",
        onCancel: function () {
          setConfirmTarget(null);
        },
        onConfirm: function () {
          if (!confirmTarget) return;
          if (confirmTarget.type === "project") {
            setConfirmTarget(null);
            store.deleteProject(confirmTarget.id).then(function (res) {
              store.toast(res.ok ? "案件を削除しました。" : res.error, res.ok ? "success" : "error");
            });
          } else {
            handleDeleteTag(confirmTarget.id);
          }
        },
      })
    );
  }

  function NotFoundPage() {
    return h(
      "div",
      { className: "empty-state" },
      h("div", null, "ページが見つかりませんでした。"),
      h("a", { className: "btn primary", href: "#/feed" }, "一覧へ戻る")
    );
  }

  return {
    BUILD: "2026.11.26b",
    LoginPage: LoginPage,
    FeedPage: FeedPage,
    TimelinePage: TimelinePage,
    ProjectDetailPage: ProjectDetailPage,
    PostFormPage: PostFormPage,
    SavedPage: SavedPage,
    ProfilePage: ProfilePage,
    UserPage: UserPage,
    AdminPage: AdminPage,
    NotFoundPage: NotFoundPage,
  };
})();
