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
          return h(GridItem, { key: p.id, project: p });
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
    PhotoGrid: PhotoGrid,
    Toast: Toast,
    ConfirmDialog: ConfirmDialog,
    TagAutocomplete: TagAutocomplete,
  };
})();
