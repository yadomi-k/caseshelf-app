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
      h("rect", { x: 2, y: 2, width: 13, height: 13, rx: 3, fill: "#2f6f4f" }),
      h("rect", {
        x: 9,
        y: 9,
        width: 13,
        height: 13,
        rx: 3,
        fill: "#9bcdb3",
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

  function ProtoBanner(props) {
    return h(
      "div",
      { className: "proto-banner" },
      props.children ||
        "試作品: 投稿はSalesforceに保存され、CaseShelfの利用者全員が閲覧できます。"
    );
  }

  var NAV_ITEMS = [
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
    // props: title, onBack, active, isAdmin, right(node)
    return h(
      "header",
      { className: "topbar" },
      props.onBack
        ? h(
            "button",
            {
              className: "topbar-icon-btn",
              onClick: props.onBack,
              "aria-label": "戻る",
            },
            "←"
          )
        : h(
            "a",
            { className: "brand", href: "#/feed" },
            h(Logo, { size: 20 }),
            "CaseShelf"
          ),
      props.title ? h("div", { className: "title" }, props.title) : h("div", { className: "topbar-spacer" }),
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

  // 一覧の写真に重ねる、リアクションの小さな表示（多い絵文字を最大3つ＋合計数）
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
      { className: "grid-reactions", title: "リアクション " + total + "件" },
      groups.slice(0, 3).map(function (g) {
        return h("span", { key: g.emoji, className: "grid-reaction-emoji" }, g.emoji);
      }),
      h("span", { className: "grid-reaction-count" }, total)
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

  function GridItem(props) {
    var project = props.project;
    var cover =
      project.photos.find(function (p) {
        return p.id === project.coverPhotoId;
      }) || project.photos[0];
    return h(
      "a",
      { className: "grid-item", href: "#/project/" + project.id },
      h(Photo, { photo: cover, alt: project.title, loading: "lazy" }),
      project.photos.length > 1 ? h(MultiBadge, null) : null,
      props.reactions ? h(GridReactions, { groups: props.reactions }) : null,
      h("div", { className: "grid-title" }, project.title)
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
    ReactionBar: ReactionBar,
    PhotoGrid: PhotoGrid,
    Toast: Toast,
    ConfirmDialog: ConfirmDialog,
    TagAutocomplete: TagAutocomplete,
  };
})();
