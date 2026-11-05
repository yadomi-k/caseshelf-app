// アプリ本体: ルーティング・状態管理・ルートガード（試作品）
(function () {
  "use strict";
  var h = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;
  var P = AppPages;
  var C = AppComponents;

  // ---------------- ハッシュルーター ----------------
  function useHashRouter() {
    function currentPath() {
      var hash = window.location.hash;
      return hash && hash.length > 1 ? hash.slice(1) : "/feed";
    }
    var _p = useState(currentPath);
    var path = _p[0],
      setPath = _p[1];

    useEffect(function () {
      function onHashChange() {
        setPath(currentPath());
      }
      window.addEventListener("hashchange", onHashChange);
      return function () {
        window.removeEventListener("hashchange", onHashChange);
      };
    }, []);

    var navigate = useCallback(function (nextPath, opts) {
      opts = opts || {};
      var normalized = nextPath.charAt(0) === "/" ? nextPath : "/" + nextPath;
      if (opts.replace) {
        history.replaceState(null, "", "#" + normalized);
        setPath(normalized);
      } else {
        if (window.location.hash.slice(1) === normalized) return;
        window.location.hash = normalized;
      }
    }, []);

    var pathname = path.split("?")[0];
    var queryString = path.indexOf("?") !== -1 ? path.slice(path.indexOf("?")) : "";
    var query = AppUtils.parseQuery(queryString);

    return { pathname: pathname, query: query, navigate: navigate };
  }

  function matchRoute(pathname) {
    var m;
    if (pathname === "/" || pathname === "") return { name: "feed", params: {} };
    if (pathname === "/login") return { name: "login", params: {} };
    if (pathname === "/feed") return { name: "feed", params: {} };
    if (pathname === "/new") return { name: "new", params: {} };
    if (pathname === "/saved") return { name: "saved", params: {} };
    if (pathname === "/profile") return { name: "profile", params: {} };
    if (pathname === "/admin") return { name: "admin", params: {} };
    m = pathname.match(/^\/project\/([^/]+)$/);
    if (m) return { name: "project", params: { id: decodeURIComponent(m[1]) } };
    m = pathname.match(/^\/edit\/([^/]+)$/);
    if (m) return { name: "edit", params: { id: decodeURIComponent(m[1]) } };
    return { name: "notfound", params: {} };
  }

  var ROUTE_TITLES = {
    feed: null,
    project: "案件詳細",
    new: "案件を投稿",
    edit: "案件を編集",
    saved: "保存した案件",
    profile: "マイページ",
    admin: "管理者画面",
  };

  // ---------------- トースト ----------------
  function useToasts() {
    var _t = useState([]);
    var toasts = _t[0],
      setToasts = _t[1];
    var toast = useCallback(function (message, type) {
      var id = AppData.uid("toast");
      setToasts(function (prev) {
        return prev.concat([{ id: id, message: message, type: type || "info" }]);
      });
      setTimeout(function () {
        setToasts(function (prev) {
          return prev.filter(function (t) {
            return t.id !== id;
          });
        });
      }, 3200);
    }, []);
    return [toasts, toast];
  }

  // ---------------- データストア ----------------
  function useStore(toast) {
    var _users = useState(AppData.loadUsers);
    var users = _users[0],
      setUsers = _users[1];
    var _projects = useState(AppData.loadProjects);
    var projects = _projects[0],
      setProjects = _projects[1];
    var _saves = useState(AppData.loadSaves);
    var saves = _saves[0],
      setSaves = _saves[1];
    var _requests = useState(AppData.loadRequests);
    var requests = _requests[0],
      setRequests = _requests[1];
    var _currentUserId = useState(AppData.getCurrentUserId);
    var currentUserId = _currentUserId[0],
      setCurrentUserId = _currentUserId[1];

    useEffect(
      function () {
        var r = AppData.saveUsers(users);
        if (!r.ok) toast("利用者データの保存に失敗しました（ブラウザの保存容量上限の可能性があります）。", "error");
      },
      [users]
    );
    useEffect(
      function () {
        var r = AppData.saveProjects(projects);
        if (!r.ok)
          toast(
            "保存容量の上限に達した可能性があります。写真のサイズ・枚数を減らしてもう一度お試しください。",
            "error"
          );
      },
      [projects]
    );
    useEffect(
      function () {
        AppData.saveSaves(saves);
      },
      [saves]
    );
    useEffect(
      function () {
        AppData.saveRequests(requests);
      },
      [requests]
    );

    // 未登録の人（Salesforceでの本人確認済み）から、利用登録を依頼する。
    // 同じメールアドレスの未対応の依頼がある場合は、新しく作らない。
    function requestAccount(profile) {
      var key = String(profile.email || "").trim().toLowerCase();
      if (!key) return { ok: false, error: "Salesforceのメールアドレスを取得できませんでした。" };
      var dup = requests.some(function (r) {
        return r.status === "pending" && r.email.toLowerCase() === key;
      });
      if (dup) return { ok: true, duplicate: true };
      var req = {
        id: AppData.uid("req"),
        email: profile.email,
        name: profile.name || "",
        requestedAt: new Date().toISOString(),
        status: "pending",
      };
      setRequests(function (prev) {
        return prev.concat([req]);
      });
      return { ok: true, request: req };
    }

    var pendingRequests = requests.filter(function (r) {
      return r.status === "pending";
    });

    var currentUser =
      users.find(function (u) {
        return u.id === currentUserId;
      }) || null;
    var isAdmin = !!(currentUser && currentUser.role === "admin" && currentUser.status === "active");

    function login(userId) {
      AppData.setCurrentUserId(userId);
      setCurrentUserId(userId);
    }
    function logout() {
      AppData.setCurrentUserId(null);
      setCurrentUserId(null);
    }

    function findByLoginId(loginId) {
      var key = String(loginId || "").trim().toLowerCase();
      return (
        users.find(function (u) {
          return (u.loginId || "").toLowerCase() === key || (u.email || "").toLowerCase() === key;
        }) || null
      );
    }

    // 管理者の緊急用ログイン（ユーザID・パスワード）。結果は Promise で { ok, error } を返す。
    // 通常のログインはSalesforceで行う。パスワードでログインできるのは管理者だけ。
    // IDが存在しない場合とパスワード違いの場合は、同じメッセージを返す
    // （どのIDが存在するかを推測されにくくするため）。
    function authenticate(loginId, password) {
      var user = findByLoginId(loginId);
      var badCred = { ok: false, error: "ユーザIDまたはパスワードが正しくありません。" };
      if (!user || !user.passwordHash) return Promise.resolve(badCred);
      return AppData.hashPassword(user.id, password).then(
        function (hash) {
          if (hash !== user.passwordHash) return badCred;
          if (user.role !== "admin") {
            return { ok: false, error: "パスワードでのログインは管理者のみ使えます。「Salesforceでログイン」からログインしてください。" };
          }
          if (user.status === "suspended") {
            return { ok: false, error: "このアカウントは利用停止されています。管理者にお問い合わせください。" };
          }
          login(user.id);
          return { ok: true };
        },
        function (e) {
          return { ok: false, error: e.message };
        }
      );
    }

    // Salesforceでログインした人を、メールアドレスでこのアプリの利用者と照合してログインする。
    // Salesforceのアカウントがあっても、このアプリに登録されていない人はログインできない。
    function loginWithSalesforce(profile) {
      var key = String(profile.email || "").trim().toLowerCase();
      var user =
        key &&
        users.find(function (u) {
          return (u.email || "").toLowerCase() === key;
        });
      if (!user) {
        return {
          ok: false,
          error: "notRegistered",
          profile: profile,
        };
      }
      if (user.status === "suspended") {
        return { ok: false, error: "このアカウントは利用停止されています。管理者にお問い合わせください。" };
      }
      login(user.id);
      return { ok: true };
    }

    // ログイン中の管理者の緊急用パスワードを設定・変更する。
    // まだ設定していない場合は、現在のパスワードなしで設定できる。
    function changePassword(currentPassword, newPassword) {
      if (!currentUser) return Promise.resolve({ ok: false, error: "ログインしていません。" });
      var me = currentUser;
      if (me.role !== "admin") return Promise.resolve({ ok: false, error: "緊急用パスワードは管理者のみ設定できます。" });
      var check = me.passwordHash ? AppData.hashPassword(me.id, currentPassword) : Promise.resolve(null);
      return check.then(function (hash) {
        if (me.passwordHash && hash !== me.passwordHash) return { ok: false, error: "現在のパスワードが正しくありません。" };
        return AppData.hashPassword(me.id, newPassword).then(function (newHash) {
          setUsers(function (prev) {
            return prev.map(function (u) {
              return u.id === me.id ? Object.assign({}, u, { passwordHash: newHash }) : u;
            });
          });
          return { ok: true };
        });
      });
    }

    function addProject(payload) {
      var now = new Date().toISOString();
      var project = Object.assign({}, payload, {
        id: AppData.uid("proj"),
        authorId: currentUser.id,
        createdAt: now,
        updatedAt: now,
      });
      setProjects(function (prev) {
        return prev.concat([project]);
      });
      return project;
    }

    function updateProject(id, patch) {
      setProjects(function (prev) {
        return prev.map(function (p) {
          return p.id === id ? Object.assign({}, p, patch, { updatedAt: new Date().toISOString() }) : p;
        });
      });
    }

    function deleteProject(id) {
      setProjects(function (prev) {
        return prev.filter(function (p) {
          return p.id !== id;
        });
      });
      setSaves(function (prev) {
        var next = {};
        Object.keys(prev).forEach(function (uid) {
          next[uid] = prev[uid].filter(function (pid) {
            return pid !== id;
          });
        });
        return next;
      });
    }

    function isSaved(projectId) {
      if (!currentUser) return false;
      var list = saves[currentUser.id] || [];
      return list.indexOf(projectId) !== -1;
    }

    function toggleSave(projectId) {
      if (!currentUser) return;
      setSaves(function (prev) {
        var list = prev[currentUser.id] || [];
        var exists = list.indexOf(projectId) !== -1;
        var nextList = exists
          ? list.filter(function (id) {
              return id !== projectId;
            })
          : list.concat([projectId]);
        var next = Object.assign({}, prev);
        next[currentUser.id] = nextList;
        return next;
      });
    }

    function updateProfile(patch) {
      if (!currentUser) return;
      setUsers(function (prev) {
        return prev.map(function (u) {
          return u.id === currentUser.id ? Object.assign({}, u, patch) : u;
        });
      });
    }

    var allTags = (function () {
      var seen = {};
      var out = [];
      projects.forEach(function (p) {
        p.tags.forEach(function (t) {
          var key = AppUtils.tagKey(t);
          if (!seen[key]) {
            seen[key] = true;
            out.push(t);
          }
        });
      });
      return out;
    })();

    var admin = {
      // 利用者を追加する。Salesforceでログインするため、メールアドレス（=Salesforceのメールアドレス）で登録する。
      // Promise で { ok, error } を返す。
      inviteUser: function (data) {
        if (findByLoginId(data.email)) {
          return Promise.resolve({ ok: false, error: "そのメールアドレスは既に登録されています。" });
        }
        var user = {
          id: AppData.uid("u"),
          loginId: data.email,
          email: data.email,
          displayName: data.displayName,
          role: data.role === "admin" ? "admin" : "member",
          status: "active",
          avatarImage: null,
        };
        setUsers(function (prev) {
          return prev.concat([user]);
        });
        return Promise.resolve({ ok: true, user: user });
      },
      // 管理者がパスワードを再設定する（利用者がパスワードを忘れた場合など）。
      resetPassword: function (userId, newPassword) {
        return AppData.hashPassword(userId, newPassword).then(function (hash) {
          setUsers(function (prev) {
            return prev.map(function (u) {
              return u.id === userId ? Object.assign({}, u, { passwordHash: hash }) : u;
            });
          });
          return { ok: true };
        });
      },
      // 依頼を承認して利用者として登録する
      approveRequest: function (reqId, role) {
        var req = requests.find(function (r) {
          return r.id === reqId;
        });
        if (!req) return Promise.resolve({ ok: false, error: "依頼が見つかりません。" });
        return admin
          .inviteUser({ email: req.email, displayName: req.name || req.email, role: role })
          .then(function (res) {
            if (!res.ok) return res;
            setRequests(function (prev) {
              return prev.map(function (r) {
                return r.id === reqId ? Object.assign({}, r, { status: "approved", handledAt: new Date().toISOString() }) : r;
              });
            });
            return res;
          });
      },
      declineRequest: function (reqId) {
        setRequests(function (prev) {
          return prev.map(function (r) {
            return r.id === reqId ? Object.assign({}, r, { status: "declined", handledAt: new Date().toISOString() }) : r;
          });
        });
      },
      setUserStatus: function (userId, status) {
        setUsers(function (prev) {
          return prev.map(function (u) {
            return u.id === userId ? Object.assign({}, u, { status: status }) : u;
          });
        });
      },
      deleteTagGlobally: function (tag) {
        var key = AppUtils.tagKey(tag);
        setProjects(function (prev) {
          return prev.map(function (p) {
            return Object.assign({}, p, {
              tags: p.tags.filter(function (t) {
                return AppUtils.tagKey(t) !== key;
              }),
            });
          });
        });
      },
    };

    return {
      users: users,
      projects: projects,
      saves: saves,
      currentUser: currentUser,
      isAdmin: isAdmin,
      authenticate: authenticate,
      loginWithSalesforce: loginWithSalesforce,
      requestAccount: requestAccount,
      pendingRequests: pendingRequests,
      changePassword: changePassword,
      logout: logout,
      addProject: addProject,
      updateProject: updateProject,
      deleteProject: deleteProject,
      isSaved: isSaved,
      toggleSave: toggleSave,
      updateProfile: updateProfile,
      allTags: allTags,
      admin: admin,
      toast: toast,
    };
  }

  // ---------------- ルートガード付きレイアウト ----------------
  function App() {
    var router = useHashRouter();
    var _toasts = useToasts();
    var toasts = _toasts[0],
      toast = _toasts[1];
    var store = useStore(toast);
    var route = matchRoute(router.pathname);

    // --- アクセス制御（試作品: ローカル状態のみでの疑似実装） ---
    useEffect(
      function () {
        if (!store.currentUser) {
          if (route.name !== "login") router.navigate("/login", { replace: true });
          return;
        }
        if (store.currentUser.status === "suspended") {
          toast("アカウントが停止されているため、ログアウトしました。", "error");
          store.logout();
          router.navigate("/login", { replace: true });
          return;
        }
        if (route.name === "login") {
          router.navigate("/feed", { replace: true });
          return;
        }
        if (route.name === "admin" && !store.isAdmin) {
          toast("管理者のみアクセスできる画面です。", "error");
          router.navigate("/feed", { replace: true });
          return;
        }
      },
      [store.currentUser && store.currentUser.id, store.currentUser && store.currentUser.status, route.name, route.params.id]
    );

    if (!store.currentUser) {
      if (route.name !== "login") {
        return h("div", { className: "center-loading" }, "読み込み中...");
      }
      return h(P.LoginPage, { store: store, route: Object.assign({}, route, router) });
    }

    if (store.currentUser.status === "suspended") {
      return h("div", { className: "center-loading" }, "読み込み中...");
    }

    if (route.name === "login") {
      return h("div", { className: "center-loading" }, "読み込み中...");
    }

    if (route.name === "admin" && !store.isAdmin) {
      return h("div", { className: "center-loading" }, "読み込み中...");
    }

    var activeNavKey =
      route.name === "feed"
        ? "feed"
        : route.name === "new"
        ? "new"
        : route.name === "saved"
        ? "saved"
        : route.name === "profile"
        ? "profile"
        : route.name === "admin"
        ? "admin"
        : null;

    function handleBack() {
      if (window.history.length > 1) window.history.back();
      else router.navigate("/feed");
    }

    var routeProps = { store: store, route: Object.assign({}, { params: route.params, query: router.query }, { navigate: router.navigate }) };

    var page;
    switch (route.name) {
      case "feed":
        page = h(P.FeedPage, routeProps);
        break;
      case "project":
        page = h(P.ProjectDetailPage, routeProps);
        break;
      case "new":
        page = h(P.PostFormPage, routeProps);
        break;
      case "edit":
        page = h(P.PostFormPage, routeProps);
        break;
      case "saved":
        page = h(P.SavedPage, routeProps);
        break;
      case "profile":
        page = h(P.ProfilePage, routeProps);
        break;
      case "admin":
        page = h(P.AdminPage, routeProps);
        break;
      default:
        page = h(P.NotFoundPage, routeProps);
    }

    var showBack = route.name === "project" || route.name === "new" || route.name === "edit";

    return h(
      "div",
      { className: "app-shell" },
      h(C.ProtoBanner, null),
      h(C.TopBar, {
        title: ROUTE_TITLES[route.name],
        onBack: showBack ? handleBack : null,
        active: activeNavKey,
        isAdmin: store.isAdmin,
        pendingCount: store.isAdmin ? store.pendingRequests.length : 0,
        right: h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8 } },
          h(
            "button",
            {
              className: "topbar-icon-btn",
              title: "ログアウト",
              onClick: function () {
                store.logout();
                router.navigate("/login", { replace: true });
              },
            },
            "⏻"
          )
        ),
      }),
      h("main", { className: "content" }, page),
      h(C.BottomNav, { active: activeNavKey }),
      h(C.Toast, { toasts: toasts })
    );
  }

  var root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(h(App));
})();
