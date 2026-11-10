// 共有UIコンポーネント（試作品）
window.AppComponents = (function () {
  "use strict";
  var h = React.createElement;
  var cx = AppUtils.classNames;

  function Logo(props) {
    var size = props.size || 22;
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none" },
      h("rect", { x: 2, y: 2, width: 13, height: 13, rx: 3, fill: "#1d5fc4" }),
      h("rect", {
        x: 9,
        y: 9,
        width: 13,
        height: 13,
        rx: 3,
        fill: "#9dc1f2",
        stroke: "#fff",
        strokeWidth: 1.5,
      })
    );
  }

  // 写真を表示する。photo.url があればそのURLを、無ければSalesforceのファイル（photo.id）を取得して表示する。
  function Photo(props) {
    var photo = props.photo || {};
    var direct = photo.dataUrl || photo.url || null;
    var _src = React.useState(direct);
    var src = _src[0],
      setSrc = _src[1];
    var _failed = React.useState(false);
    var failed = _failed[0],
      setFailed = _failed[1];
    React.useEffect(
      function () {
        if (direct) {
          setSrc(direct);
          return;
        }
        if (!photo.id) return;
        var alive = true;
        setSrc(null);
        setFailed(false);
        AppSF.imageUrl(photo.id).then(
          function (u) {
            if (alive) setSrc(u);
          },
          function () {
            if (alive) setFailed(true);
          }
        );
        return function () {
          alive = false;
        };
      },
      [photo.id, direct]
    );
    if (!src) {
      return h(
        "div",
        { className: cx("photo-placeholder", props.className), role: "img", "aria-label": props.alt || "" },
        failed ? "表示できません" : ""
      );
    }
    return h("img", { src: src, alt: props.alt || "", className: props.className, loading: props.loading });
  }

  function Avatar(props) {
    // user: {displayName, avatarVersionId}, size: 'sm'|'md'|'lg'
    var user = props.user || {};
    var size = props.size || "md";
    var cls = cx("avatar", size === "sm" && "sm", size === "lg" && "lg");
    var initial = (user.displayName || "?").trim().charAt(0);
    var color = AppData.avatarColor(user.id || user.displayName || "x");
    if (user.avatarVersionId) {
      return h(
        "div",
        { className: cls, style: { background: color } },
        h(Photo, { photo: { id: user.avatarVersionId }, alt: user.displayName })
      );
    }
    return h(
      "div",
      { className: cls, style: { background: color } },
      initial
    );
  }

  // 写真のスライド表示（スマートフォンはスワイプ、PCは左右の矢印）。案件詳細とタイムラインで使う
  // props: photos, alt, className, resetKey（変わったら1枚目に戻す）
  function PhotoCarousel(props) {
    var photos = props.photos || [];
    var total = photos.length;
    var _idx = React.useState(0);
    var idx = _idx[0],
      setIdx = _idx[1];
    var _drag = React.useState(0);
    var dragX = _drag[0],
      setDragX = _drag[1];
    var touchStartX = React.useRef(null);
    var touchDeltaX = React.useRef(0);

    React.useEffect(
      function () {
        setIdx(0);
      },
      [props.resetKey]
    );

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
      transition: dragX ? "none" : undefined,
    };

    return h(
      "div",
      {
        className: cx("detail-carousel", props.className),
        onTouchStart: onTouchStart,
        onTouchMove: onTouchMove,
        onTouchEnd: onTouchEnd,
      },
      h(
        "div",
        { className: "track", style: trackStyle },
        photos.map(function (ph, i) {
          return h(
            "div",
            { className: "slide", key: ph.id },
            // 今の写真と前後の写真だけ読み込む
            Math.abs(i - idx) <= 1 ? h(Photo, { photo: ph, alt: props.alt, loading: props.loading }) : null
          );
        })
      ),
      idx > 0
        ? h(
            "button",
            { type: "button", className: "nav-arrow left", onClick: function () { go(-1); }, "aria-label": "前の写真" },
            "‹"
          )
        : null,
      idx < total - 1
        ? h(
            "button",
            { type: "button", className: "nav-arrow right", onClick: function () { go(1); }, "aria-label": "次の写真" },
            "›"
          )
        : null,
      total > 1 ? h("div", { className: "counter" }, idx + 1 + " / " + total) : null,
      total > 1
        ? h(
            "div",
            { className: "carousel-dots", "aria-hidden": true },
            photos.map(function (ph, i) {
              return h("span", { key: ph.id, className: cx("dot", i === idx && "active") });
            })
          )
        : null
    );
  }

  // 利用者を文字で検索して選ぶ入力欄（利用者が多くても探せるように）
  // props: users [{id, email, displayName, avatarVersionId}], value（選択中のメールアドレス）, onChange(email),
  //        id, suffixFor(user) → 名前の後ろに付ける文字（例「（自分）」）, maxResults
  function normalizeForSearch(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[\s\u3000]+/g, "")
      // 全角英数字を半角に
      .replace(/[Ａ-Ｚａ-ｚ０-９＠．]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
      });
  }

  function UserPicker(props) {
    var users = props.users || [];
    var maxResults = props.maxResults || 30;
    var _open = React.useState(false);
    var open = _open[0],
      setOpen = _open[1];
    var _q = React.useState("");
    var q = _q[0],
      setQ = _q[1];
    var _active = React.useState(0);
    var active = _active[0],
      setActive = _active[1];
    var wrapRef = React.useRef(null);
    var inputRef = React.useRef(null);
    var listRef = React.useRef(null);

    var selected = users.find(function (u) {
      return String(u.email).toLowerCase() === String(props.value || "").toLowerCase();
    });

    var matches = React.useMemo(
      function () {
        var key = normalizeForSearch(q);
        var list = !key
          ? users
          : users.filter(function (u) {
              return (
                normalizeForSearch(u.displayName).indexOf(key) !== -1 ||
                normalizeForSearch(u.email).indexOf(key) !== -1 ||
                normalizeForSearch(u.department).indexOf(key) !== -1
              );
            });
        return list;
      },
      [users, q]
    );
    var shown = matches.slice(0, maxResults);

    // 外を押したら閉じる
    React.useEffect(
      function () {
        if (!open) return;
        function onDown(e) {
          if (wrapRef.current && !wrapRef.current.contains(e.target)) {
            setOpen(false);
            setQ("");
          }
        }
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        return function () {
          document.removeEventListener("mousedown", onDown);
          document.removeEventListener("touchstart", onDown);
        };
      },
      [open]
    );

    // 選択中の候補が見えるようにスクロールする
    React.useEffect(
      function () {
        if (!open || !listRef.current) return;
        var el = listRef.current.children[active];
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
      },
      [active, open]
    );

    function choose(u) {
      props.onChange(u.email);
      setOpen(false);
      setQ("");
      if (inputRef.current) inputRef.current.blur();
    }

    function onKeyDown(e) {
      if (e.nativeEvent && e.nativeEvent.isComposing) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setActive(function (i) {
          return Math.min(shown.length - 1, i + 1);
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(function (i) {
          return Math.max(0, i - 1);
        });
      } else if (e.key === "Enter") {
        // フォームを送信しない
        e.preventDefault();
        if (open && shown[active]) choose(shown[active]);
      } else if (e.key === "Escape") {
        setOpen(false);
        setQ("");
      }
    }

    var suffix = function (u) {
      return props.suffixFor ? props.suffixFor(u) || "" : "";
    };

    return h(
      "div",
      { className: cx("user-picker", open && "open"), ref: wrapRef },
      h(
        "div",
        { className: "user-picker-field" },
        !open && selected ? h(Avatar, { user: selected, size: "sm" }) : h("span", { className: "user-picker-icon", "aria-hidden": true }, "🔍"),
        h("input", {
          id: props.id,
          ref: inputRef,
          className: "user-picker-input",
          type: "text",
          role: "combobox",
          autoComplete: "off",
          "aria-expanded": open,
          "aria-autocomplete": "list",
          value: open ? q : selected ? selected.displayName + suffix(selected) : props.value || "",
          placeholder: open ? "名前・部・メールアドレスで検索" : "投稿者を選択",
          onFocus: function () {
            setOpen(true);
            setQ("");
            setActive(0);
          },
          onChange: function (e) {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          },
          onKeyDown: onKeyDown,
        }),
        !open && selected ? h("span", { className: "user-picker-email" }, selected.email) : null
      ),
      open
        ? h(
            "div",
            { className: "user-picker-pop" },
            shown.length
              ? h(
                  "ul",
                  { className: "user-picker-list", role: "listbox", ref: listRef },
                  shown.map(function (u, i) {
                    var isSel = selected && selected.email === u.email;
                    return h(
                      "li",
                      {
                        key: u.email,
                        role: "option",
                        "aria-selected": isSel,
                        className: cx("user-picker-item", i === active && "active", isSel && "selected"),
                        onMouseDown: function (e) {
                          // 入力欄のフォーカスが外れる前に選ぶ
                          e.preventDefault();
                          choose(u);
                        },
                        onMouseEnter: function () {
                          setActive(i);
                        },
                      },
                      h(Avatar, { user: u, size: "sm" }),
                      h(
                        "span",
                        { className: "user-picker-text" },
                        h("span", { className: "user-picker-name" }, u.displayName + suffix(u)),
                        h("span", { className: "user-picker-mail" }, (u.department ? u.department + " · " : "") + u.email)
                      ),
                      isSel ? h("span", { className: "user-picker-check", "aria-hidden": true }, "✓") : null
                    );
                  })
                )
              : h("div", { className: "user-picker-empty" }, "「" + q + "」に一致する利用者がいません"),
            matches.length > shown.length
              ? h(
                  "div",
                  { className: "user-picker-more" },
                  "ほか " + (matches.length - shown.length) + " 名。名前を入力して絞り込んでください"
                )
              : null
          )
        : null
    );
  }

  function ProtoBanner(props) {
    return h(
      "div",
      { className: "proto-banner" },
      props.children ||
        "試作品: 投稿はSalesforceに保存され、CaseShelfの利用者全員が閲覧できます。"
    );
  }

  var NAV_ITEMS = [
    { key: "timeline", label: "タイムライン", path: "#/timeline", icon: "☰" },
    { key: "feed", label: "一覧", path: "#/feed", icon: "⊞" },
    { key: "new", label: "投稿", path: "#/new", icon: "➕" },
    { key: "saved", label: "保存", path: "#/saved", icon: "★" },
    { key: "profile", label: "マイページ", path: "#/profile", icon: "●" },
  ];

  function BottomNav(props) {
    var active = props.active;
    return h(
      "nav",
      { className: "bottom-nav" },
      NAV_ITEMS.map(function (item) {
        return h(
          "a",
          {
            key: item.key,
            href: item.path,
            className: cx(active === item.key && "active"),
          },
          h("span", { "aria-hidden": true }, item.icon),
          h("span", null, item.label)
        );
      })
    );
  }

  function DesktopNav(props) {
    var active = props.active;
    var isAdmin = props.isAdmin;
    var items = NAV_ITEMS.slice();
    if (isAdmin) {
      items = items.concat([{ key: "admin", label: "管理者", path: "#/admin", badge: props.pendingCount }]);
    }
    return h(
      "nav",
      { className: "desktop-nav" },
      items.map(function (item) {
        return h(
          "a",
          {
            key: item.key,
            href: item.path,
            className: cx(active === item.key && "active"),
          },
          item.label,
          item.badge ? h("span", { className: "nav-badge", "aria-label": "未対応の依頼 " + item.badge + "件" }, item.badge) : null
        );
      })
    );
  }

  function TopBar(props) {
    // props: onBack, active, isAdmin, right(node)
    // 画面名（案件詳細・タイムラインなど）は出さず、常にロゴと「CaseShelf」を表示する
    return h(
      "header",
      { className: "topbar" },
      props.onBack
        ? h(
            "button",
            {
              type: "button",
              className: "back-btn",
              onClick: props.onBack,
              "aria-label": "戻る",
              title: "戻る",
            },
            h(
              "svg",
              { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
              h("path", { d: "M19 12H5" }),
              h("path", { d: "M11 6l-6 6 6 6" })
            )
          )
        : null,
      h(
        "a",
        { className: "brand", href: "#/timeline" },
        h(Logo, { size: 20 }),
        "CaseShelf"
      ),
      h("div", { className: "topbar-spacer" }),
      h(DesktopNav, { active: props.active, isAdmin: props.isAdmin, pendingCount: props.pendingCount }),
      props.right || null
    );
  }

  function Chip(props) {
    return h(
      "button",
      {
        type: "button",
        className: cx("chip", props.clickable && "clickable"),
        onClick: props.onClick,
        disabled: !props.onClick,
      },
      "#" + props.label,
      props.onRemove
        ? h(
            "span",
            {
              className: "chip-x",
              onClick: function (e) {
                e.stopPropagation();
                props.onRemove();
              },
            },
            "×"
          )
        : null
    );
  }

  function MultiBadge() {
    return h(
      "span",
      { className: "multi-badge", title: "複数枚の写真があります" },
      h(
        "svg",
        { width: 16, height: 16, viewBox: "0 0 24 24", fill: "currentColor" },
        h("rect", { x: 3, y: 5, width: 14, height: 14, rx: 2, opacity: 0.55 }),
        h("rect", { x: 7, y: 3, width: 14, height: 14, rx: 2 })
      )
    );
  }

  // 一覧のカードに出す、リアクションの小さな表示（多い絵文字を最大3つ＋合計数）
  function GridReactions(props) {
    var groups = (props.groups || []).slice();
    if (!groups.length) return null;
    var total = groups.reduce(function (sum, g) {
      return sum + g.count;
    }, 0);
    groups.sort(function (a, b) {
      return b.count - a.count;
    });
    return h(
      "span",
      { className: "card-reactions", title: "リアクション " + total + "件" },
      groups.slice(0, 3).map(function (g) {
        return h("span", { key: g.emoji, className: "card-reaction-emoji" }, g.emoji);
      }),
      h("span", { className: "card-reaction-count" }, total)
    );
  }

  function reactionTitle(g) {
    return g.names.join("、") + " が " + g.emoji + " でリアクションしました";
  }

  // 投稿へのリアクション（Slackのリアクションのように、絵文字ごとの人数を表示し、押すと付ける／外す）
  // リアクションは1投稿につき1人1つまで。別の絵文字を選ぶと付け替わる
  // props: groups（store.reactionsFor の結果）, onToggle(emoji), disabled
  function ReactionBar(props) {
    var groups = props.groups || [];
    var _open = React.useState(false);
    var pickerOpen = _open[0],
      setPickerOpen = _open[1];
    var _who = React.useState(false);
    var showWho = _who[0],
      setShowWho = _who[1];
    var wrapRef = React.useRef(null);

    // 選択画面の外を押したら・Escキーで閉じる
    React.useEffect(
      function () {
        if (!pickerOpen) return;
        function onDown(e) {
          if (wrapRef.current && !wrapRef.current.contains(e.target)) setPickerOpen(false);
        }
        function onKey(e) {
          if (e.key === "Escape") setPickerOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        document.addEventListener("keydown", onKey);
        return function () {
          document.removeEventListener("mousedown", onDown);
          document.removeEventListener("touchstart", onDown);
          document.removeEventListener("keydown", onKey);
        };
      },
      [pickerOpen]
    );

    var mineSet = {};
    groups.forEach(function (g) {
      if (g.mine) mineSet[g.emoji] = true;
    });
    var hasMine = Object.keys(mineSet).length > 0;

    return h(
      "div",
      { className: "reaction-area" },
      h(
        "div",
        { className: "reaction-bar", ref: wrapRef },
        groups.map(function (g) {
          return h(
            "button",
            {
              key: g.emoji,
              type: "button",
              className: cx("reaction-pill", g.mine && "mine"),
              title: reactionTitle(g),
              "aria-pressed": g.mine,
              "aria-label":
                g.emoji + " " + g.count + "件" + (g.mine ? "（あなたのリアクション。押すと取り消し）" : hasMine ? "（押すとこの絵文字に変更）" : ""),
              disabled: props.disabled,
              onClick: function () {
                props.onToggle(g.emoji);
              },
            },
            h("span", { className: "reaction-emoji" }, g.emoji),
            h("span", { className: "reaction-count" }, g.count)
          );
        }),
        h(
          "button",
          {
            type: "button",
            className: cx("reaction-add", pickerOpen && "open"),
            title: hasMine ? "リアクションを変更" : "リアクションを追加",
            "aria-label": hasMine ? "リアクションを変更" : "リアクションを追加",
            "aria-expanded": pickerOpen,
            disabled: props.disabled,
            onClick: function () {
              setPickerOpen(!pickerOpen);
            },
          },
          h(
            "svg",
            { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" },
            h("circle", { cx: 11, cy: 12, r: 8 }),
            h("path", { d: "M8 14.5c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" }),
            h("circle", { cx: 8.5, cy: 10, r: 0.6, fill: "currentColor" }),
            h("circle", { cx: 13.5, cy: 10, r: 0.6, fill: "currentColor" }),
            h("path", { d: "M20 2v5M17.5 4.5h5", strokeWidth: 1.6 })
          ),
          groups.length ? null : h("span", { className: "reaction-add-label" }, "リアクション")
        ),
        pickerOpen
          ? h(
              "div",
              { className: "reaction-picker", role: "dialog", "aria-label": "リアクションを選ぶ" },
              h(
                "div",
                { className: "reaction-picker-note" },
                hasMine ? "リアクションは1人1つまでです。別の絵文字を選ぶと変更されます。" : "リアクションは1人1つまでです。"
              ),
              AppData.REACTION_EMOJIS.map(function (r) {
                return h(
                  "button",
                  {
                    key: r.emoji,
                    type: "button",
                    className: cx("reaction-choice", mineSet[r.emoji] && "mine"),
                    title: r.label,
                    "aria-label": r.label + (mineSet[r.emoji] ? "（あなたのリアクション。選ぶと取り消し）" : ""),
                    onClick: function () {
                      setPickerOpen(false);
                      props.onToggle(r.emoji);
                    },
                  },
                  r.emoji
                );
              })
            )
          : null
      ),
      groups.length
        ? h(
            "button",
            {
              type: "button",
              className: "reaction-who-toggle",
              onClick: function () {
                setShowWho(!showWho);
              },
            },
            showWho ? "リアクションした人を隠す" : "リアクションした人を見る"
          )
        : null,
      showWho && groups.length
        ? h(
            "ul",
            { className: "reaction-who" },
            groups.map(function (g) {
              return h(
                "li",
                { key: g.emoji },
                h("span", { className: "reaction-who-emoji" }, g.emoji),
                h("span", null, g.names.join("、"))
              );
            })
          )
        : null
    );
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
  }

  // 一覧のカード（上に写真、下に案件名・説明・タグ。文字が写真に重ならないようにする）
  var CARD_MAX_TAGS = 3;
  function GridItem(props) {
    var project = props.project;
    var cover =
      project.photos.find(function (p) {
        return p.id === project.coverPhotoId;
      }) || project.photos[0];
    var tags = project.tags.slice(0, CARD_MAX_TAGS);
    var moreTags = project.tags.length - tags.length;
    var desc = String(project.description || "").split(/\r?\n/)[0];
    return h(
      "a",
      { className: "work-card", href: "#/project/" + project.id },
      h(
        "div",
        { className: "work-card-photo" },
        h(Photo, { photo: cover, alt: project.title, loading: "lazy" }),
        project.photos.length > 1 ? h(MultiBadge, null) : null,
        project.isSample ? h("span", { className: "work-card-sample" }, "サンプル") : null
      ),
      h(
        "div",
        { className: "work-card-body" },
        h("div", { className: "work-card-title" }, project.title),
        desc ? h("div", { className: "work-card-desc" }, desc) : null,
        tags.length
          ? h(
              "div",
              { className: "work-card-tags" },
              tags.map(function (t) {
                return h("span", { key: t, className: "work-card-tag" }, "#" + t);
              }),
              moreTags > 0 ? h("span", { className: "work-card-tag more" }, "+" + moreTags) : null
            )
          : null,
        h(
          "div",
          { className: "work-card-foot" },
          h("span", { className: "work-card-date" }, formatDate(project.createdAt)),
          props.reactions ? h(GridReactions, { groups: props.reactions }) : null,
          h("span", { className: "work-card-arrow", "aria-hidden": true }, "›")
        )
      )
    );
  }

  function PhotoGrid(props) {
    // props: projects (全件・絞り込み後), pageSize,
    //        initialVisibleCount/onVisibleCountChange（呼び出し側でスクロール位置とともに保持したい場合）
    var projects = props.projects || [];
    var pageSize = props.pageSize || 18;
    var controlled = typeof props.onVisibleCountChange === "function";
    var React_ = React;
    var _s = React_.useState(props.initialVisibleCount || pageSize);
    var visibleCount = _s[0],
      setVisibleCountRaw = _s[1];
    var sentinelRef = React_.useRef(null);
    var prevProjectsRef = React_.useRef(projects);

    function setVisibleCount(updater) {
      setVisibleCountRaw(function (prev) {
        var next = typeof updater === "function" ? updater(prev) : updater;
        if (controlled) props.onVisibleCountChange(next);
        return next;
      });
    }

    React_.useEffect(function () {
      // 絞り込み結果（projects参照）が変わったらページ数を先頭に戻す
      // （呼び出し側が key で明示的に再マウントを制御している場合はここに到達しない）
      if (prevProjectsRef.current !== projects) {
        prevProjectsRef.current = projects;
        setVisibleCount(pageSize);
      }
    }, [projects, pageSize]);

    React_.useEffect(function () {
      var el = sentinelRef.current;
      if (!el) return;
      var obs = new IntersectionObserver(
        function (entries) {
          if (entries[0].isIntersecting) {
            setVisibleCount(function (c) {
              return Math.min(projects.length, c + pageSize);
            });
          }
        },
        { rootMargin: "300px" }
      );
      obs.observe(el);
      return function () {
        obs.disconnect();
      };
    }, [projects.length, pageSize]);

    if (projects.length === 0) {
      return h(
        "div",
        { className: "empty-state" },
        h("div", { style: { fontSize: "2rem" } }, "\u{1F4F7}"),
        h("div", null, props.emptyMessage || "該当する案件が見つかりませんでした。")
      );
    }

    var visible = projects.slice(0, visibleCount);
    var hasMore = visibleCount < projects.length;

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "photo-grid" },
        visible.map(function (p) {
          return h(GridItem, {
            key: p.id,
            project: p,
            reactions: props.reactionsFor && !p.isSample ? props.reactionsFor(p.id) : null,
          });
        })
      ),
      hasMore
        ? h(
            React.Fragment,
            null,
            h("div", { className: "grid-loading-more" }, "読み込み中..."),
            h("div", { className: "grid-sentinel", ref: sentinelRef })
          )
        : null
    );
  }

  function Toast(props) {
    // props: toasts: [{id, type, message}]
    return h(
      "div",
      { className: "toast-stack" },
      (props.toasts || []).map(function (t) {
        return h(
          "div",
          { key: t.id, className: cx("toast", t.type) },
          t.message
        );
      })
    );
  }

  function ConfirmDialog(props) {
    if (!props.open) return null;
    return h(
      "div",
      {
        className: "modal-overlay",
        onClick: function (e) {
          if (e.target === e.currentTarget && props.onCancel) props.onCancel();
        },
      },
      h(
        "div",
        { className: "modal-card" },
        h("h3", null, props.title || "確認"),
        h("p", null, props.message || ""),
        h(
          "div",
          { className: "modal-actions" },
          h(
            "button",
            { className: "btn ghost", onClick: props.onCancel },
            props.cancelLabel || "キャンセル"
          ),
          h(
            "button",
            {
              className: cx("btn", props.danger ? "danger" : "primary"),
              onClick: props.onConfirm,
            },
            props.confirmLabel || "OK"
          )
        )
      )
    );
  }

  function TagAutocomplete(props) {
    // props: value: [tags], onChange(tags), allTags: [string]
    var React_ = React;
    var _i = React_.useState("");
    var inputVal = _i[0],
      setInputVal = _i[1];
    var _f = React_.useState(false);
    var focused = _f[0],
      setFocused = _f[1];

    var value = props.value || [];
    var allTags = props.allTags || [];

    function commit(raw) {
      var norm = AppUtils.normalizeTag(raw);
      if (!norm) return;
      var exists = value.some(function (t) {
        return AppUtils.tagKey(t) === AppUtils.tagKey(norm);
      });
      if (!exists) {
        props.onChange(value.concat([norm]));
      }
      setInputVal("");
    }

    function handleKeyDown(e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commit(inputVal);
      } else if (e.key === "Backspace" && inputVal === "" && value.length) {
        props.onChange(value.slice(0, -1));
      }
    }

    var suggestions = allTags
      .filter(function (t) {
        return (
          inputVal.trim() &&
          AppUtils.tagKey(t).indexOf(AppUtils.tagKey(inputVal)) !== -1 &&
          !value.some(function (v) {
            return AppUtils.tagKey(v) === AppUtils.tagKey(t);
          })
        );
      })
      .slice(0, 6);

    return h(
      "div",
      { className: "tag-input-wrap" },
      h(
        "div",
        { className: "tag-chip-input" },
        value.map(function (t, i) {
          return h(
            "span",
            { key: t + i, className: "chip removable" },
            "#" + t,
            h(
              "button",
              {
                type: "button",
                onClick: function () {
                  props.onChange(value.filter(function (_, idx) {
                    return idx !== i;
                  }));
                },
              },
              "×"
            )
          );
        }),
        h("input", {
          value: inputVal,
          placeholder: value.length ? "" : "タグを入力してEnter（例: 展示会）",
          onChange: function (e) {
            setInputVal(e.target.value);
          },
          onKeyDown: handleKeyDown,
          onFocus: function () {
            setFocused(true);
          },
          onBlur: function () {
            setTimeout(function () {
              setFocused(false);
            }, 120);
          },
        })
      ),
      focused && suggestions.length
        ? h(
            "div",
            { className: "tag-suggest-list" },
            suggestions.map(function (s) {
              return h(
                "button",
                {
                  key: s,
                  type: "button",
                  onClick: function () {
                    commit(s);
                  },
                },
                "#" + s
              );
            })
          )
        : null
    );
  }

  return {
    Logo: Logo,
    Avatar: Avatar,
    Photo: Photo,
    ProtoBanner: ProtoBanner,
    BottomNav: BottomNav,
    DesktopNav: DesktopNav,
    TopBar: TopBar,
    Chip: Chip,
    MultiBadge: MultiBadge,
    PhotoCarousel: PhotoCarousel,
    UserPicker: UserPicker,
    ReactionBar: ReactionBar,
    PhotoGrid: PhotoGrid,
    Toast: Toast,
    ConfirmDialog: ConfirmDialog,
    TagAutocomplete: TagAutocomplete,
  };
})();
