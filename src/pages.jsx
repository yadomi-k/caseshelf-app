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
  var MIN_PASSWORD_LENGTH = 8;
  function validateNewPassword(pw) {
    if (!pw || pw.length < MIN_PASSWORD_LENGTH) {
      return "パスワードは" + MIN_PASSWORD_LENGTH + "文字以上で入力してください。";
    }
    return null;
  }

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
    var subject = "【CaseShelf】アカウント作成依頼";
    var body = [
      "CaseShelfのアカウント作成をお願いします。",
      "",
      "依頼内容: CaseShelfアカウント作成",
      "氏名: " + (profile.name || ""),
      "メールアドレス: " + profile.email,
      "依頼日時: " + stamp,
      "",
      "※CaseShelfのログイン画面から送信された依頼です（Salesforceで本人確認済み）。",
    ].join("\n");
    return { to: to, href: "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body) };
  }

  function RequestAccountCard(props) {
    var p = props.profile;
    var mail = requestMailHref(p);
    var done = !!props.result;
    return h(
      "div",
      { className: "login-card request-card" },
      h("h2", null, done ? "利用登録を依頼しました" : "CaseShelfの利用登録がまだです"),
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
            "Salesforceでの本人確認はできました。CaseShelfを使うには、管理者による利用登録が必要です。"
          ),
          props.error && h("div", { className: "login-error", role: "alert" }, props.error),
          h("button", { type: "button", className: "btn primary block", onClick: props.onRequest }, "管理者に利用登録を依頼する")
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
    var _id = useState("");
    var loginId = _id[0],
      setLoginId = _id[1];
    var _pw = useState("");
    var password = _pw[0],
      setPassword = _pw[1];
    var _err = useState(null);
    var error = _err[0],
      setError = _err[1];
    var _busy = useState(false);
    var busy = _busy[0],
      setBusy = _busy[1];
    var _show = useState(false);
    var showPw = _show[0],
      setShowPw = _show[1];
    var _sf = useState(false);
    var sfBusy = _sf[0],
      setSfBusy = _sf[1];
    var _nr = useState(null); // Salesforceで本人確認できたが未登録の人
    var notRegistered = _nr[0],
      setNotRegistered = _nr[1];
    var _rq = useState(null); // 依頼の結果
    var requestResult = _rq[0],
      setRequestResult = _rq[1];
    var _fb = useState(false);
    var showFallback = _fb[0],
      setShowFallback = _fb[1];

    // Salesforceから戻ってきた場合の処理
    useEffect(function () {
      var cancelled = false;
      var pending = AppSSO.consumeRedirect();
      pending.then(
        function (profile) {
          if (cancelled || !profile) return;
          setSfBusy(true);
          var res = store.loginWithSalesforce(profile);
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
        },
        function (e) {
          if (!cancelled) setError(e.message);
        }
      );
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

    function submit(e) {
      e.preventDefault();
      if (!loginId.trim() || !password) {
        setError("ユーザIDとパスワードを入力してください。");
        return;
      }
      setBusy(true);
      setError(null);
      store.authenticate(loginId, password).then(function (res) {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          setPassword("");
          return;
        }
        props.route.navigate("/feed", { replace: true });
      });
    }

    function sendRequest() {
      var res = store.requestAccount(notRegistered);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRequestResult(res.duplicate ? "duplicate" : "created");
    }

    var logo = h(
      "div",
      { className: "login-logo" },
      h(C.Logo, { size: 40 }),
      h("div", { className: "name" }, "CaseShelf"),
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
          onRequest: sendRequest,
          onBack: function () {
            setNotRegistered(null);
            setRequestResult(null);
            setError(null);
          },
        })
      );
    }

    return h(
      "div",
      { className: "login-screen" },
      h(
        "div",
        { className: "login-logo" },
        h(C.Logo, { size: 40 }),
        h("div", { className: "name" }, "CaseShelf"),
        h("div", { className: "tagline" }, "社内事例写真を、探しやすく。")
      ),
      h(
        "div",
        { className: "login-card" },
        h("h2", null, "ログイン"),
        h(
          "button",
          { type: "button", className: "btn block sf-login", onClick: startSalesforce, disabled: sfBusy || busy },
          h(SalesforceMark, null),
          sfBusy ? "Salesforceで確認中..." : "Salesforceでログイン"
        ),
        h("p", { className: "login-help" }, "会社のSalesforceアカウントでログインします。"),
        !showFallback && error && h("div", { className: "login-error login-error-top", role: "alert" }, error)
      ),
      showFallback
        ? h(
            "form",
            { className: "login-card fallback-card", onSubmit: submit, noValidate: true },
            h("h2", null, "管理者の緊急用ログイン"),
            h(
              "p",
              { className: "fallback-note" },
              "Salesforceにログインできないときに、管理者だけが使えます。"
            ),
            h(
              "div",
              { className: "field" },
              h("label", { htmlFor: "login-id" }, "ユーザID（メールアドレス）"),
              h("input", {
                id: "login-id",
                className: "text-input",
                autoComplete: "username",
                autoCapitalize: "none",
                value: loginId,
                onChange: function (e) {
                  setLoginId(e.target.value);
                },
                autoFocus: true,
              })
            ),
            h(
              "div",
              { className: "field" },
              h("label", { htmlFor: "login-pw" }, "緊急用パスワード"),
              h(
                "div",
                { className: "password-row" },
                h("input", {
                  id: "login-pw",
                  className: "text-input",
                  type: showPw ? "text" : "password",
                  autoComplete: "current-password",
                  value: password,
                  onChange: function (e) {
                    setPassword(e.target.value);
                  },
                }),
                h(
                  "button",
                  {
                    type: "button",
                    className: "btn ghost sm",
                    onClick: function () {
                      setShowPw(!showPw);
                    },
                  },
                  showPw ? "隠す" : "表示"
                )
              )
            ),
            error && h("div", { className: "login-error", role: "alert" }, error),
            h(
              "button",
              { className: "btn primary block", type: "submit", disabled: busy },
              busy ? "確認中..." : "ログイン"
            ),
            h(
              "button",
              {
                type: "button",
                className: "link-button",
                onClick: function () {
                  setShowFallback(false);
                  setError(null);
                  setPassword("");
                },
              },
              "閉じる"
            )
          )
        : h(
            "button",
            {
              type: "button",
              id: "open-fallback",
              className: "link-button",
              onClick: function () {
                setShowFallback(true);
                setError(null);
              },
            },
            "管理者の緊急用ログイン"
          ),
      h(
        "p",
        { className: "login-note" },
        "CaseShelfを使うには、管理者による利用者登録が必要です。※試作品のため、データはこの端末のブラウザ内にのみ保存されます。"
      )
    );
  }

  // ====================================================================
  // Feed（一覧・検索）
  // ====================================================================
  function filterProjects(projects, users, q, tag) {
    var qKey = AppUtils.tagKey(q || "");
    var tagFilterKey = tag ? AppUtils.tagKey(tag) : "";
    return projects.filter(function (p) {
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
        if (!titleMatch && !tagMatch) return false;
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
    var qsKey = "caseshelf_feed_scroll:" + q + "|" + tag;

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
        return sortNewestFirst(filterProjects(store.projects, store.users, q, tag));
      },
      [store.projects, q, tag]
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
        applyQuery({ q: v, tag: tag });
      }, 300);
    }

    var hasFilter = !!(q || tag);

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "search-bar" },
        h(
          "div",
          { className: "search-input-wrap" },
          h("span", { "aria-hidden": true }, "\u{1F50D}"),
          h("input", {
            value: inputVal,
            onChange: onInputChange,
            placeholder: "案件名・ハッシュタグで検索（#は省略可）",
          }),
          inputVal
            ? h(
                "button",
                {
                  className: "topbar-icon-btn",
                  onClick: function () {
                    setInputVal("");
                    applyQuery({ q: "", tag: tag });
                  },
                  "aria-label": "検索語をクリア",
                },
                "×"
              )
            : null
        ),
        hasFilter
          ? h(
              "div",
              { className: "search-chips" },
              q
                ? h(C.Chip, {
                    label: "検索: " + q,
                    onRemove: function () {
                      setInputVal("");
                      applyQuery({ q: "", tag: tag });
                    },
                  })
                : null,
              tag
                ? h(C.Chip, {
                    label: tag,
                    onRemove: function () {
                      applyQuery({ q: q, tag: "" });
                    },
                  })
                : null,
              h(
                "button",
                {
                  className: "btn ghost sm",
                  onClick: function () {
                    setInputVal("");
                    applyQuery({});
                  },
                },
                "すべて解除"
              )
            )
          : null
      ),
      h(C.PhotoGrid, {
        key: qsKey,
        projects: filtered,
        pageSize: 18,
        initialVisibleCount: initialVisibleCountForKey,
        onVisibleCountChange: handleVisibleCountChange,
        emptyMessage: hasFilter
          ? "条件に一致する案件が見つかりませんでした。検索条件を変えてお試しください。"
          : "まだ案件が投稿されていません。",
      })
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
    var _idx = useState(0);
    var idx = _idx[0],
      setIdx = _idx[1];
    var touchStartX = useRef(null);
    var touchDeltaX = useRef(0);
    var _drag = useState(0);
    var dragX = _drag[0],
      setDragX = _drag[1];
    var _confirm = useState(false);
    var confirmOpen = _confirm[0],
      setConfirmOpen = _confirm[1];

    useEffect(
      function () {
        setIdx(0);
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

    var photos = project.photos;
    var total = photos.length;
    var author = store.users.find(function (u) {
      return u.id === project.authorId;
    });
    var canEdit = store.currentUser && (store.currentUser.id === project.authorId || store.isAdmin);
    var saved = store.isSaved(project.id);

    function go(delta) {
      setIdx(function (i) {
        return AppUtils.clamp(i + delta, 0, total - 1);
      });
    }

    function onTouchStart(e) {
      touchStartX.current = e.touches[0].clientX;
      touchDeltaX.current = 0;
    }
    function onTouchMove(e) {
      if (touchStartX.current == null) return;
      touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
      setDragX(touchDeltaX.current);
    }
    function onTouchEnd() {
      var d = touchDeltaX.current;
      if (d < -50 && idx < total - 1) setIdx(idx + 1);
      else if (d > 50 && idx > 0) setIdx(idx - 1);
      touchStartX.current = null;
      touchDeltaX.current = 0;
      setDragX(0);
    }

    var trackStyle = {
      transform: "translateX(calc(-" + idx * 100 + "% + " + dragX + "px))",
    };

    function handleDelete() {
      store.deleteProject(project.id);
      setConfirmOpen(false);
      store.toast("案件を削除しました。", "success");
      route.navigate("/feed", { replace: true });
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        {
          className: "detail-carousel",
          onTouchStart: onTouchStart,
          onTouchMove: onTouchMove,
          onTouchEnd: onTouchEnd,
        },
        h(
          "div",
          { className: "track", style: trackStyle },
          photos.map(function (ph) {
            return h(
              "div",
              { className: "slide", key: ph.id },
              h("img", { src: ph.url, alt: project.title })
            );
          })
        ),
        idx > 0
          ? h(
              "button",
              { className: "nav-arrow left", onClick: function () { go(-1); }, "aria-label": "前の写真" },
              "‹"
            )
          : null,
        idx < total - 1
          ? h(
              "button",
              { className: "nav-arrow right", onClick: function () { go(1); }, "aria-label": "次の写真" },
              "›"
            )
          : null,
        total > 1 ? h("div", { className: "counter" }, (idx + 1) + " / " + total) : null
      ),
      h(
        "div",
        { className: "detail-body" },
        h(
          "div",
          { className: "detail-header" },
          h("h1", { className: "detail-title" }, project.title),
          h(
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
          h(C.Avatar, { user: author || { displayName: "不明な利用者" }, size: "sm" }),
          h("span", null, author ? author.displayName : "不明な利用者"),
          h("span", null, "·"),
          h("span", null, AppUtils.formatDateTime(project.createdAt))
        ),
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
    var notAllowed =
      isEdit &&
      (!existing || (store.currentUser && existing.authorId !== store.currentUser.id && !store.isAdmin));

    var _title = useState(existing ? existing.title : "");
    var title = _title[0],
      setTitle = _title[1];
    var _desc = useState(existing ? existing.description : "");
    var desc = _desc[0],
      setDesc = _desc[1];
    var _sfdc = useState(existing ? existing.salesforceUrl : "");
    var sfdc = _sfdc[0],
      setSfdc = _sfdc[1];
    var _tags = useState(existing ? existing.tags.slice() : []);
    var tags = _tags[0],
      setTags = _tags[1];
    var _photos = useState(
      existing
        ? existing.photos.map(function (p) {
            return { id: p.id, url: p.url, status: "done" };
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
      var currentCount = photos.length;
      files.forEach(function (file, i) {
        if (currentCount + i >= limits.maxPhotosPerProject) {
          store.toast(
            "写真は案件あたり最大" + limits.maxPhotosPerProject + "枚までです（試作品の上限案）。",
            "error"
          );
          return;
        }
        if (limits.acceptedTypes.indexOf(file.type) === -1) {
          store.toast("「" + file.name + "」は対応していない形式です（JPEG/PNG/WEBP/GIFのみ）。", "error");
          return;
        }
        if (file.size > limits.maxPhotoSizeMB * 1024 * 1024) {
          store.toast(
            "「" + file.name + "」は" + limits.maxPhotoSizeMB + "MBを超えています（試作品の上限案）。",
            "error"
          );
          return;
        }
        var localId = AppData.uid("tmp");
        setPhotos(function (prev) {
          return prev.concat([{ id: localId, url: null, status: "uploading", progress: 0 }]);
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
        AppUtils.readFileAsDataURL(file)
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
                  ? { id: localId, url: dataUrl, status: "done" }
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

    function validate() {
      var errs = {};
      if (!title.trim()) errs.title = "案件名を入力してください。";
      var doneDonePhotos = photos.filter(function (p) {
        return p.status === "done";
      });
      if (doneDonePhotos.length === 0) errs.photos = "写真を1枚以上登録してください。";
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
      var finalPhotos = photos
        .filter(function (p) {
          return p.status === "done";
        })
        .map(function (p, i) {
          return { id: p.id, url: p.url, order: i };
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
      };

      if (isEdit) {
        store.updateProject(existing.id, payload);
        store.toast("案件を更新しました。", "success");
        route.navigate("/project/" + existing.id, { replace: true });
      } else {
        var created = store.addProject(payload);
        store.toast("案件を投稿しました。", "success");
        route.navigate("/project/" + created.id, { replace: true });
      }
    }

    return h(
      "form",
      { className: "form-page", onSubmit: handleSubmit },
      h("h1", { style: { fontSize: 18, margin: "6px 0 18px" } }, isEdit ? "案件を編集" : "案件を新規投稿"),

      h(
        "div",
        { className: "field" },
        h("label", null, "案件名 ※必須"),
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

      h(
        "div",
        { className: "field" },
        h("label", null, "写真 ※必須・複数枚対応"),
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
          h("div", { className: "hint" }, "JPEG/PNG/WEBP/GIF・1枚" + AppData.LIMITS.maxPhotoSizeMB + "MBまで・最大" + AppData.LIMITS.maxPhotosPerProject + "枚（試作品の上限案）")
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
                  p.url
                    ? h("img", { src: p.url, alt: "写真" + (i + 1) })
                    : h("div", { style: { width: "100%", height: "100%", background: "#ddd" } }),
                  p.id === coverId ? h("span", { className: "cover-badge" }, "代表") : null,
                  h(
                    "div",
                    { className: "photo-overlay" },
                    h(
                      "div",
                      { style: { display: "flex", gap: 3, justifyContent: "flex-end" } },
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
                      { style: { display: "flex", gap: 3, justifyContent: "space-between" } },
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
        errors.photos ? h("div", { className: "error" }, errors.photos) : null,
        errors.uploading ? h("div", { className: "error" }, errors.uploading) : null
      ),

      h(
        "div",
        { className: "field" },
        h("label", null, "ハッシュタグ ※必須・複数設定可"),
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
        h("label", null, "案件説明（任意）"),
        h("textarea", {
          className: "textarea",
          value: desc,
          onChange: function (e) {
            setDesc(e.target.value);
          },
          placeholder: "案件の概要、工夫した点などを記入してください。",
        })
      ),

      h(
        "div",
        { className: "field" },
        h("label", null, "Salesforce案件URL（任意）"),
        h("input", {
          className: "text-input",
          value: sfdc,
          onChange: function (e) {
            setSfdc(e.target.value);
          },
          placeholder: "https://...",
        }),
        h("div", { className: "hint" }, "入力すると案件詳細に「Salesforceで案件を見る」ボタンが表示されます（自動連携は行わず、URLを開くだけです）。")
      ),

      h(
        "div",
        { className: "form-sticky-footer" },
        h(
          "a",
          { className: "btn ghost block", href: isEdit ? "#/project/" + existing.id : "#/feed" },
          "キャンセル"
        ),
        h("button", { type: "submit", className: "btn primary block" }, isEdit ? "更新する" : "投稿する")
      )
    );
  }

  // ====================================================================
  // 保存した案件
  // ====================================================================
  function SavedPage(props) {
    var store = props.store;
    var savedIds = store.saves[store.currentUser.id] || [];
    var projects = sortNewestFirst(
      store.projects.filter(function (p) {
        return savedIds.indexOf(p.id) !== -1;
      })
    );
    return h(C.PhotoGrid, {
      projects: projects,
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

    var myProjects = sortNewestFirst(
      store.projects.filter(function (p) {
        return p.authorId === user.id;
      })
    );
    var savedCount = (store.saves[user.id] || []).length;

    function onAvatarFile(e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      if (AppData.LIMITS.acceptedTypes.indexOf(file.type) === -1) {
        store.toast("対応していない画像形式です。", "error");
        return;
      }
      AppUtils.readFileAsDataURL(file).then(function (dataUrl) {
        store.updateProfile({ avatarImage: dataUrl });
        store.toast("プロフィール画像を更新しました。", "success");
      });
    }

    function saveName() {
      if (!name.trim()) {
        store.toast("表示名を入力してください。", "error");
        return;
      }
      store.updateProfile({ displayName: name.trim() });
      setEditing(false);
      store.toast("表示名を更新しました。", "success");
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
                { style: { display: "flex", gap: 6 } },
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
          h("div", { className: "email" }, user.email)
        )
      ),
      h(
        "div",
        { className: "profile-stats" },
        h("div", null, h("b", null, myProjects.length), " 件の投稿"),
        h("div", null, h("b", null, savedCount), " 件の保存")
      ),
      user.role === "admin" && h(PasswordChangeForm, { store: store }),
      h(C.PhotoGrid, {
        projects: myProjects,
        emptyMessage: "まだ案件を投稿していません。",
      })
    );
  }

  function PasswordChangeForm(props) {
    var store = props.store;
    var _open = useState(false);
    var open = _open[0],
      setOpen = _open[1];
    var _cur = useState("");
    var cur = _cur[0],
      setCur = _cur[1];
    var _next = useState("");
    var next = _next[0],
      setNext = _next[1];
    var _conf = useState("");
    var conf = _conf[0],
      setConf = _conf[1];
    var _err = useState(null);
    var error = _err[0],
      setError = _err[1];

    function reset() {
      setCur("");
      setNext("");
      setConf("");
      setError(null);
    }

    function submit(e) {
      e.preventDefault();
      var pwErr = validateNewPassword(next);
      var hasPw = !!store.currentUser.passwordHash;
      if (hasPw && !cur) return setError("現在のパスワードを入力してください。");
      if (pwErr) return setError(pwErr);
      if (next !== conf) return setError("新しいパスワード（確認）が一致しません。");
      if (next === cur) return setError("現在と異なるパスワードを入力してください。");
      store.changePassword(cur, next).then(function (res) {
        if (!res.ok) return setError(res.error);
        reset();
        setOpen(false);
        store.toast("緊急用パスワードを保存しました。", "success");
      });
    }

    if (!open) {
      return h(
        "div",
        { className: "password-section" },
        h(
          "button",
          {
            type: "button",
            className: "btn sm",
            onClick: function () {
              setOpen(true);
            },
          },
          store.currentUser.passwordHash ? "緊急用パスワードを変更" : "緊急用パスワードを設定"
        ),
        h(
          "span",
          { className: "form-hint", style: { marginLeft: 8 } },
          "Salesforceにログインできないときの管理者用"
        )
      );
    }

    function pwField(id, label, value, setter, ac) {
      return h(
        "div",
        { className: "field" },
        h("label", { htmlFor: id }, label),
        h("input", {
          id: id,
          className: "text-input",
          type: "password",
          autoComplete: ac,
          value: value,
          onChange: function (e) {
            setter(e.target.value);
          },
        })
      );
    }

    return h(
      "form",
      { className: "password-section password-form", onSubmit: submit, noValidate: true },
      h("h3", null, "緊急用パスワード"),
      h("p", { className: "fallback-note" }, "Salesforceにログインできないときに、ログイン画面の「管理者の緊急用ログイン」で使います。"),
      store.currentUser.passwordHash && pwField("pw-cur", "現在のパスワード", cur, setCur, "current-password"),
      pwField("pw-new", "新しいパスワード（8文字以上）", next, setNext, "new-password"),
      pwField("pw-conf", "新しいパスワード（確認）", conf, setConf, "new-password"),
      error && h("div", { className: "login-error", role: "alert" }, error),
      h(
        "div",
        { style: { display: "flex", gap: 8 } },
        h("button", { className: "btn primary sm", type: "submit" }, "変更する"),
        h(
          "button",
          {
            className: "btn ghost sm",
            type: "button",
            onClick: function () {
              reset();
              setOpen(false);
            },
          },
          "キャンセル"
        )
      )
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
                store.admin.declineRequest(r.id);
                store.toast("依頼を見送りにしました。", "success");
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
                  return h(RequestRow, { key: r.id, store: store, request: r });
                })
              )
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
    var _resetTarget = useState(null);
    var resetTarget = _resetTarget[0],
      setResetTarget = _resetTarget[1];
    var _resetPw = useState("");
    var resetPw = _resetPw[0],
      setResetPw = _resetPw[1];
    var _inviteRole = useState("member");
    var inviteRole = _inviteRole[0],
      setInviteRole = _inviteRole[1];
    var _confirmTarget = useState(null);
    var confirmTarget = _confirmTarget[0],
      setConfirmTarget = _confirmTarget[1];

    var tagCounts = {};
    store.projects.forEach(function (p) {
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
          store.toast("「" + email + "」を追加しました。Salesforceでログインできるようになります。", "success");
        });
    }

    function handleResetPassword(e) {
      e.preventDefault();
      var pwErr = validateNewPassword(resetPw);
      if (pwErr) {
        store.toast(pwErr, "error");
        return;
      }
      var target = resetTarget;
      store.admin.resetPassword(target.id, resetPw).then(function () {
        setResetTarget(null);
        setResetPw("");
        store.toast("「" + target.displayName + "」のパスワードを再設定しました。新しいパスワードを本人に伝えてください。", "success");
      });
    }

    function handleDeleteTag(tag) {
      store.admin.deleteTagGlobally(tag);
      setConfirmTarget(null);
      store.toast("タグ「" + tag + "」をすべての案件から削除しました。", "success");
    }

    return h(
      "div",
      { className: "admin-section" },
      h(C.ProtoBanner, null, "管理者画面（試作品）: 利用者の追加は実際のメール送信を行いません。すべてこの端末内のデータに対する操作です。"),

      h(RequestList, { store: store }),

      h("h2", null, "利用者の登録・停止"),
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
      resetTarget &&
        h(
          "form",
          { className: "inline-form reset-form", onSubmit: handleResetPassword },
          h("label", { htmlFor: "reset-pw" }, "「" + resetTarget.displayName + "」の新しい緊急用パスワード"),
          h("input", {
            id: "reset-pw",
            className: "text-input",
            type: "text",
            placeholder: "8文字以上",
            autoComplete: "new-password",
            value: resetPw,
            autoFocus: true,
            onChange: function (e) {
              setResetPw(e.target.value);
            },
          }),
          h("button", { className: "btn primary", type: "submit" }, "再設定する"),
          h(
            "button",
            {
              className: "btn ghost",
              type: "button",
              onClick: function () {
                setResetTarget(null);
                setResetPw("");
              },
            },
            "キャンセル"
          )
        ),
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
          store.users.map(function (u) {
            var isSelf = u.id === store.currentUser.id;
            return h(
              "tr",
              { key: u.id },
              h("td", null, u.displayName),
              h("td", null, u.email),
              h("td", null, u.role === "admin" ? "管理者" : "利用者"),
              h(
                "td",
                null,
                h("span", { className: cx("status-pill", u.status) }, u.status === "active" ? "有効" : "停止中")
              ),
              h(
                "td",
                null,
                h(
                  "button",
                  {
                    className: "btn sm",
                    disabled: isSelf,
                    title: isSelf ? "自分自身は停止できません" : "",
                    onClick: function () {
                      store.admin.setUserStatus(u.id, u.status === "active" ? "suspended" : "active");
                      store.toast(
                        u.status === "active" ? "利用を停止しました。" : "利用停止を解除しました。",
                        "success"
                      );
                    },
                  },
                  u.status === "active" ? "停止する" : "復帰させる"
                ),
                u.role === "admin" && " ",
                u.role === "admin" &&
                  h(
                    "button",
                    {
                      className: "btn sm",
                      title: "管理者の緊急用パスワードを再設定します",
                      onClick: function () {
                        setResetTarget(u);
                        setResetPw("");
                      },
                    },
                    "緊急用PW"
                  )
              )
            );
          })
        )
      ),

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
          sortNewestFirst(store.projects).map(function (p) {
            var author = store.users.find(function (u) {
              return u.id === p.authorId;
            });
            return h(
              "tr",
              { key: p.id },
              h("td", null, p.title),
              h("td", null, author ? author.displayName : "不明"),
              h(
                "td",
                { style: { display: "flex", gap: 6 } },
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
            store.deleteProject(confirmTarget.id);
            setConfirmTarget(null);
            store.toast("案件を削除しました。", "success");
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
    LoginPage: LoginPage,
    FeedPage: FeedPage,
    ProjectDetailPage: ProjectDetailPage,
    PostFormPage: PostFormPage,
    SavedPage: SavedPage,
    ProfilePage: ProfilePage,
    AdminPage: AdminPage,
    NotFoundPage: NotFoundPage,
  };
})();
