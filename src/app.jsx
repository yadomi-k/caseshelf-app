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
    if (pathname === "/timeline") return { name: "timeline", params: {} };
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

  // ---------------- データストア（Salesforce） ----------------
  // 投稿・利用者・保存・利用登録の依頼は、すべてSalesforceに保存する（src/sfdata.js）。
  // ログイン時（と、しばらくしてから画面に戻ったとき）に読み込み、変更はその都度Salesforceに書き込む。
  var REFRESH_AFTER_MS = 60 * 1000;
  var EMPTY = [];

  function lower(s) {
    return String(s || "").trim().toLowerCase();
  }

  function initialAdminEmails() {
    var list = (window.AppConfig && window.AppConfig.initialAdminEmails) || [];
    return list.map(lower);
  }

  function useStore(toast) {
    // phase: "signedOut" | "loading" | "ready" | "error"
    var _phase = useState(function () {
      return AppSSO.getSession() ? "loading" : "signedOut";
    });
    var phase = _phase[0],
      setPhase = _phase[1];
    var _err = useState(null);
    var loadError = _err[0],
      setLoadError = _err[1];
    var _loginMsg = useState(null); // ログイン画面に出すメッセージ（有効期限切れ・停止など）
    var loginMessage = _loginMsg[0],
      setLoginMessage = _loginMsg[1];
    var _me = useState(null);
    var currentUser = _me[0],
      setCurrentUser = _me[1];
    var _users = useState([]);
    var users = _users[0],
      setUsers = _users[1];
    var _posts = useState([]);
    var posts = _posts[0],
      setPosts = _posts[1];
    var _saves = useState([]);
    var saves = _saves[0],
      setSaves = _saves[1];
    var _requests = useState([]);
    var requests = _requests[0],
      setRequests = _requests[1];
    var _reactions = useState([]);
    var reactions = _reactions[0],
      setReactions = _reactions[1];
    // Salesforceにリアクション用のオブジェクトが無い（設定前）・読めない場合は false。リアクション欄を出さない
    var _reactOk = useState(true);
    var reactionsAvailable = _reactOk[0],
      setReactionsAvailable = _reactOk[1];
    var reactionBusyRef = React.useRef({});
    var lastLoadedRef = React.useRef(0);
    var profileRef = React.useRef(null);

    function resetData() {
      setCurrentUser(null);
      setUsers([]);
      setPosts([]);
      setSaves([]);
      setRequests([]);
      setReactions([]);
    }

    // ログインした人のデータを読み込む。
    // { ok: true } / { ok: false, error: "notRegistered", profile } / { ok: false, error: "メッセージ" } を返す
    function loadAll(profile) {
      profileRef.current = profile;
      return AppSF.findUserByEmail(profile.email)
        .then(function (me) {
          if (me) return me;
          // 最初の管理者（src/config.js の initialAdminEmails）は、初回ログイン時に自動で登録する
          if (initialAdminEmails().indexOf(lower(profile.email)) !== -1) {
            return AppSF.createUser({ email: profile.email, displayName: profile.name || profile.email, role: "admin" });
          }
          return null;
        })
        .then(function (me) {
          if (!me) return { ok: false, error: "notRegistered", profile: profile };
          if (me.status === "suspended") {
            return { ok: false, error: "このアカウントは利用停止されています。管理者にお問い合わせください。" };
          }
          var isAdminUser = me.role === "admin";
          return Promise.all([
            AppSF.loadUsers(),
            AppSF.loadPosts(),
            AppSF.loadMySaves(profile.sfUserId),
            isAdminUser ? AppSF.loadPendingRequests() : Promise.resolve([]),
            // リアクションが読めなくても、ほかの機能は使えるようにする
            AppSF.loadReactions().catch(function (e) {
              if (e && e.status === 401) throw e;
              return null;
            }),
          ]).then(function (r) {
            setCurrentUser(me);
            setUsers(r[0]);
            setPosts(r[1]);
            // 投稿が削除されて空になった保存は消す
            r[2].forEach(function (sv) {
              if (!sv.postId) AppSF.removeSave(sv.id).catch(function () {});
            });
            setSaves(
              r[2].filter(function (sv) {
                return !!sv.postId;
              })
            );
            setRequests(r[3]);
            if (r[4]) {
              // 投稿が削除されて空になった自分のリアクションは消す
              r[4].forEach(function (rc) {
                if (!rc.postId && rc.createdById && rc.createdById === profile.sfUserId) {
                  AppSF.removeReaction(rc.id).catch(function () {});
                }
              });
              // リアクションは1投稿につき1人1つまで。以前の版で自分が複数付けていた投稿は、いちばん新しいものだけ残す
              var myLatest = {};
              r[4].forEach(function (rc) {
                if (rc.postId && rc.createdById && rc.createdById === profile.sfUserId) myLatest[rc.postId] = rc.id;
              });
              var extra = r[4].filter(function (rc) {
                return rc.postId && rc.createdById && rc.createdById === profile.sfUserId && myLatest[rc.postId] !== rc.id;
              });
              extra.forEach(function (rc) {
                AppSF.removeReaction(rc.id).catch(function () {});
              });
              setReactions(
                r[4].filter(function (rc) {
                  return !!rc.postId && extra.indexOf(rc) === -1;
                })
              );
              setReactionsAvailable(true);
            } else {
              setReactions([]);
              setReactionsAvailable(false);
            }
            lastLoadedRef.current = Date.now();
            setPhase("ready");
            return { ok: true };
          });
        });
    }

    function logout(message) {
      AppSSO.endSession();
      resetData();
      setPhase("signedOut");
      setLoadError(null);
      setLoginMessage(message || null);
    }

    // ページを開いたとき、ログイン済みならデータを読み込む
    useEffect(function () {
      var s = AppSSO.getSession();
      if (!s) return;
      loadAll(s.profile).then(
        function (res) {
          if (!res.ok) logout(res.error === "notRegistered" ? null : res.error);
        },
        function (e) {
          if (e.status === 401) return; // 有効期限切れ（下のイベントで処理）
          setLoadError(e.message);
          setPhase("error");
        }
      );
    }, []);

    // 接続の有効期限が切れたらログイン画面へ
    useEffect(function () {
      function onExpired() {
        resetData();
        setPhase("signedOut");
        setLoginMessage("Salesforceの接続の有効期限が切れました。もう一度ログインしてください。");
      }
      window.addEventListener("caseshelf-session-expired", onExpired);
      return function () {
        window.removeEventListener("caseshelf-session-expired", onExpired);
      };
    }, []);

    // しばらくしてから画面に戻ったら、他の人の投稿などを読み込み直す
    useEffect(
      function () {
        function onFocus() {
          if (phase !== "ready" || !profileRef.current) return;
          if (Date.now() - lastLoadedRef.current < REFRESH_AFTER_MS) return;
          refresh();
        }
        window.addEventListener("focus", onFocus);
        return function () {
          window.removeEventListener("focus", onFocus);
        };
      },
      [phase]
    );

    function refresh() {
      if (!profileRef.current) return Promise.resolve();
      lastLoadedRef.current = Date.now();
      return loadAll(profileRef.current).then(
        function (res) {
          if (!res.ok) {
            toast(res.error === "notRegistered" ? "CaseShelfの利用者登録が見つからないため、ログアウトしました。" : res.error, "error");
            logout(res.error === "notRegistered" ? null : res.error);
          }
        },
        function () {}
      );
    }

    function reloadPosts() {
      return AppSF.loadPosts().then(function (list) {
        setPosts(list);
        return list;
      });
    }

    // Salesforceでログインした人を、メールアドレスでCaseShelfの利用者と照合してデータを読み込む
    function loginWithSalesforce(profile) {
      setLoginMessage(null);
      return loadAll(profile).then(function (res) {
        if (!res.ok && res.error !== "notRegistered") AppSSO.endSession();
        return res;
      });
    }

    // 未登録の人（Salesforceでの本人確認済み）から、利用登録を依頼する
    function requestAccount(profile) {
      if (!profile || !profile.email) {
        return Promise.resolve({ ok: false, error: "Salesforceのメールアドレスを取得できませんでした。" });
      }
      return AppSF.createRequest(profile).then(
        function (r) {
          return { ok: true, duplicate: !!r.duplicate };
        },
        function (e) {
          return { ok: false, error: e.message };
        }
      );
    }

    var isAdmin = !!(currentUser && currentUser.role === "admin" && currentUser.status === "active");

    // 投稿に、CaseShelfの利用者（投稿者）を対応させる。サンプル投稿を後ろに付ける。
    var projects = React.useMemo(
      function () {
        var byEmail = {};
        users.forEach(function (u) {
          byEmail[lower(u.email)] = u;
        });
        return posts
          .map(function (p) {
            var u = byEmail[lower(p.authorEmail)];
            return Object.assign({}, p, { authorId: u ? u.id : null });
          })
          .concat(AppData.sampleProjects());
      },
      [posts, users]
    );

    // 投稿者の表示用情報（登録が無い場合はSalesforceの名前、サンプルは「サンプル」）
    function authorOf(project) {
      var u =
        project.authorId &&
        users.find(function (x) {
          return x.id === project.authorId;
        });
      return u || { displayName: project.authorName || project.authorEmail || "不明な利用者", email: project.authorEmail || "" };
    }

    // デザイン担当者に対応する CaseShelf の利用者（Salesforceのメールアドレスで結び付ける。
    // メールアドレスが無いときは、表示名が同じ人が1人だけならその人）。見つからなければ null
    function userForStaff(person) {
      if (!person) return null;
      if (person.email) {
        var byMail = users.find(function (u) {
          return lower(u.email) === lower(person.email);
        });
        if (byMail) return byMail;
      }
      var key = String(person.name || "").replace(/\s+/g, "");
      if (!key) return null;
      var same = users.filter(function (u) {
        return String(u.displayName || "").replace(/\s+/g, "") === key;
      });
      return same.length === 1 ? same[0] : null;
    }

    function canEdit(project) {
      if (!currentUser || !project || project.isSample) return false;
      var mySfId = profileRef.current && profileRef.current.sfUserId;
      if (isAdmin) return true;
      // 編集・削除できるのは、Salesforce上の投稿の所有者と管理者。
      // 代理投稿では、投稿者に選ばれた人が所有者になる（代理で投稿した人は、投稿後は編集できない）
      if (mySfId && project.ownerId) return project.ownerId === mySfId;
      return lower(project.ownerEmail || project.creatorEmail) === lower(currentUser.email);
    }

    function wrap(promise) {
      return promise.then(
        function (v) {
          return { ok: true, value: v };
        },
        function (e) {
          return { ok: false, error: e.message };
        }
      );
    }

    // payload.photos: [{ id, size, dataUrl? }]
    // 代理投稿：投稿者に選んだ人を、Salesforce上の投稿の所有者にする。
    // 所有者を変えられなくても投稿自体は保存済みなので、その旨を知らせて続ける
    function transferOwnerIfNeeded(postId, targetEmail) {
      var target = lower(targetEmail);
      var post = posts.find(function (p) {
        return p.id === postId;
      });
      return AppSF.loadPosts().then(function (list) {
        var saved = list.find(function (p) {
          return p.id === postId;
        });
        var current = lower((saved && saved.ownerEmail) || (post && post.ownerEmail));
        if (!target || !saved || target === current) return list;
        return AppSF.changePostOwner(postId, target).then(
          function () {
            return AppSF.loadPosts();
          },
          function (e) {
            toast("投稿は保存しましたが、所有者を変更できませんでした（" + e.message + "）", "error");
            return list;
          }
        );
      });
    }

    // payload.photos: [{ id, size, dataUrl? }]。payload.ownerEmail: 所有者にする人（代理投稿）
    function addProject(payload) {
      return wrap(
        AppSF.createPost(payload).then(function (id) {
          return transferOwnerIfNeeded(id, payload.ownerEmail).then(function (list) {
            setPosts(list);
            return { id: id };
          });
        })
      );
    }

    function updateProject(id, payload, removedPhotoIds) {
      return wrap(
        AppSF.updatePost(id, payload, removedPhotoIds).then(function () {
          return transferOwnerIfNeeded(id, payload.ownerEmail).then(function (list) {
            setPosts(list);
          });
        })
      );
    }

    function deleteProject(id) {
      var p = posts.find(function (x) {
        return x.id === id;
      });
      var photoIds = p
        ? p.photos.map(function (ph) {
            return ph.id;
          })
        : [];
      var mine = saves.filter(function (s) {
        return s.postId === id;
      });
      return wrap(
        Promise.all(
          mine.map(function (s) {
            return AppSF.removeSave(s.id).catch(function () {});
          })
        )
          .then(function () {
            // この投稿のリアクションも消す（他の人のリアクションは管理者以外は消せないので、失敗しても続ける。
            // 消せなかったものは、リアクションした人が次にログインしたときに消える）
            return Promise.all(
              reactions
                .filter(function (rc) {
                  return rc.postId === id;
                })
                .map(function (rc) {
                  return AppSF.removeReaction(rc.id).catch(function () {});
                })
            );
          })
          .then(function () {
            return AppSF.deletePost(id, photoIds);
          })
          .then(function () {
            setReactions(function (prev) {
              return prev.filter(function (rc) {
                return rc.postId !== id;
              });
            });
            setPosts(function (prev) {
              return prev.filter(function (x) {
                return x.id !== id;
              });
            });
            setSaves(function (prev) {
              return prev.filter(function (s) {
                return s.postId !== id;
              });
            });
          })
      );
    }

    var savedIds = saves
      .map(function (s) {
        return s.postId;
      })
      .filter(Boolean);

    function isSaved(projectId) {
      return savedIds.indexOf(projectId) !== -1;
    }

    function toggleSave(projectId) {
      var existing = saves.find(function (s) {
        return s.postId === projectId;
      });
      if (existing) {
        setSaves(function (prev) {
          return prev.filter(function (s) {
            return s.id !== existing.id;
          });
        });
        return AppSF.removeSave(existing.id).catch(function (e) {
          setSaves(function (prev) {
            return prev.concat([existing]);
          });
          toast(e.message, "error");
        });
      }
      var tmp = { id: AppData.uid("tmp"), postId: projectId };
      setSaves(function (prev) {
        return prev.concat([tmp]);
      });
      return AppSF.addSave(projectId).then(
        function (id) {
          setSaves(function (prev) {
            return prev.map(function (s) {
              return s.id === tmp.id ? { id: id, postId: projectId } : s;
            });
          });
        },
        function (e) {
          setSaves(function (prev) {
            return prev.filter(function (s) {
              return s.id !== tmp.id;
            });
          });
          toast(e.message, "error");
        }
      );
    }

    // ---------------- リアクション ----------------
    function isMyReaction(rc) {
      var mySfId = profileRef.current && profileRef.current.sfUserId;
      if (mySfId && rc.createdById) return rc.createdById === mySfId;
      return !!currentUser && lower(rc.email) === lower(currentUser.email);
    }

    // 投稿のリアクションを絵文字ごとにまとめる（最初にリアクションされた順）。
    // [{ emoji, count, mine, names: [表示名] }]
    var reactionGroups = React.useMemo(
      function () {
        var byEmail = {};
        users.forEach(function (u) {
          byEmail[lower(u.email)] = u;
        });
        // リアクションは1投稿につき1人1つまで。以前の版で複数付けていた場合は、いちばん新しいものだけを数える
        // （reactions は古い順に並んでいる）
        var latest = {};
        reactions.forEach(function (rc) {
          if (!rc.postId || !rc.emoji) return;
          latest[rc.postId + "|" + (rc.createdById || lower(rc.email) || rc.id)] = rc.id;
        });
        var byPost = {};
        var index = {};
        reactions.forEach(function (rc) {
          if (!rc.postId || !rc.emoji) return;
          if (latest[rc.postId + "|" + (rc.createdById || lower(rc.email) || rc.id)] !== rc.id) return;
          var list = byPost[rc.postId] || (byPost[rc.postId] = []);
          var k = rc.postId + "|" + rc.emoji;
          var g = index[k];
          if (!g) {
            g = index[k] = { emoji: rc.emoji, count: 0, mine: false, names: [], people: {} };
            list.push(g);
          }
          // 同じ人の同じ絵文字は1つとして数える
          var who = rc.createdById || lower(rc.email) || rc.id;
          if (g.people[who]) return;
          g.people[who] = true;
          g.count += 1;
          var mine = isMyReaction(rc);
          if (mine) g.mine = true;
          var u = byEmail[lower(rc.email)];
          g.names.push(mine ? "あなた" : (u && u.displayName) || rc.name || "不明な利用者");
        });
        return byPost;
      },
      [reactions, users, currentUser]
    );

    function reactionsFor(projectId) {
      return reactionGroups[projectId] || EMPTY;
    }

    // 自分のリアクションを付ける／付け替える／外す。リアクションは1投稿につき1人1つまで。
    // - まだ付けていない → 付ける
    // - 別の絵文字を付けている → 付け替える（前のリアクションは外す）
    // - 同じ絵文字を付けている → 外す
    function toggleReaction(projectId, emoji) {
      var key = projectId;
      if (reactionBusyRef.current[key]) return Promise.resolve();
      var mineList = reactions.filter(function (rc) {
        return rc.postId === projectId && isMyReaction(rc);
      });
      var ids = mineList.map(function (rc) {
        return rc.id;
      });
      var removing = mineList.some(function (rc) {
        return rc.emoji === emoji;
      });
      reactionBusyRef.current[key] = true;
      function done() {
        delete reactionBusyRef.current[key];
      }
      function removeAll(list) {
        return Promise.all(
          list.map(function (rid) {
            return AppSF.removeReaction(rid);
          })
        );
      }
      function restore(e, tmpId) {
        done();
        setReactions(function (prev) {
          return prev
            .filter(function (rc) {
              return rc.id !== tmpId && ids.indexOf(rc.id) === -1;
            })
            .concat(mineList);
        });
        toast(e.message, "error");
      }

      // 画面には先に反映する（自分の今のリアクションを外す）
      setReactions(function (prev) {
        return prev.filter(function (rc) {
          return ids.indexOf(rc.id) === -1;
        });
      });

      if (removing) {
        return removeAll(ids).then(done, function (e) {
          restore(e, null);
        });
      }

      var profile = profileRef.current || {};
      var tmp = {
        id: AppData.uid("tmp"),
        postId: projectId,
        emoji: emoji,
        createdById: profile.sfUserId || "",
        email: (currentUser && currentUser.email) || profile.email || "",
        name: (currentUser && currentUser.displayName) || profile.name || "",
      };
      setReactions(function (prev) {
        return prev.concat([tmp]);
      });
      return AppSF.addReaction(projectId, emoji).then(
        function (id) {
          setReactions(function (prev) {
            return prev.map(function (rc) {
              return rc.id === tmp.id ? Object.assign({}, tmp, { id: id }) : rc;
            });
          });
          // 新しいリアクションを保存できてから、前のリアクションを外す
          // （外せなかった場合も、表示は新しいリアクションだけになる）
          return removeAll(ids).then(done, function () {
            done();
          });
        },
        function (e) {
          restore(e, tmp.id);
        }
      );
    }

    // 詳細画面を開いたとき、その投稿のリアクションを最新にする
    function refreshPostReactions(projectId) {
      if (!reactionsAvailable) return Promise.resolve();
      return AppSF.loadPostReactions(projectId).then(
        function (list) {
          setReactions(function (prev) {
            // 送信中（仮ID）の自分のリアクションは残す
            var pending = prev.filter(function (rc) {
              return rc.postId === projectId && String(rc.id).indexOf("tmp_") === 0;
            });
            return prev
              .filter(function (rc) {
                return rc.postId !== projectId;
              })
              .concat(list, pending);
          });
        },
        function () {}
      );
    }

    function patchUserLocal(userId, patch) {
      setUsers(function (prev) {
        return prev.map(function (u) {
          return u.id === userId ? Object.assign({}, u, patch) : u;
        });
      });
      setCurrentUser(function (me) {
        return me && me.id === userId ? Object.assign({}, me, patch) : me;
      });
    }

    // patch: { displayName } または { avatarDataUrl }
    function updateProfile(patch) {
      if (!currentUser) return Promise.resolve({ ok: false, error: "ログインしていません。" });
      var me = currentUser;
      if (patch.avatarDataUrl) {
        return wrap(
          AppSF.uploadImage(patch.avatarDataUrl, me.id, "CaseShelfプロフィール画像").then(function (vid) {
            return AppSF.updateUser(me.id, { avatarVersionId: vid }).then(function () {
              patchUserLocal(me.id, { avatarVersionId: vid });
              if (me.avatarVersionId) AppSF.deleteFiles([me.avatarVersionId]);
            });
          })
        );
      }
      return wrap(
        AppSF.updateUser(me.id, { displayName: patch.displayName }).then(function () {
          patchUserLocal(me.id, { displayName: patch.displayName });
        })
      );
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

    var pendingRequests = requests.filter(function (r) {
      return r.status === "pending";
    });

    var admin = {
      // 利用者を追加する。Salesforceでログインするため、メールアドレス（=Salesforceのメールアドレス）で登録する。
      // Promise で { ok, error, user } を返す。
      inviteUser: function (data) {
        var dup = users.some(function (u) {
          return lower(u.email) === lower(data.email);
        });
        if (dup) return Promise.resolve({ ok: false, error: "そのメールアドレスは既に登録されています。" });
        return AppSF.createUser(data).then(
          function (user) {
            setUsers(function (prev) {
              return prev.concat([user]);
            });
            return { ok: true, user: user };
          },
          function (e) {
            return {
              ok: false,
              error: e.code === "DUPLICATE_VALUE" ? "そのメールアドレスは既に登録されています。" : e.message,
            };
          }
        );
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
            return AppSF.setRequestStatus(reqId, "approved").then(
              function () {
                setRequests(function (prev) {
                  return prev.filter(function (r) {
                    return r.id !== reqId;
                  });
                });
                return res;
              },
              function () {
                return res;
              }
            );
          });
      },
      declineRequest: function (reqId) {
        return wrap(
          AppSF.setRequestStatus(reqId, "declined").then(function () {
            setRequests(function (prev) {
              return prev.filter(function (r) {
                return r.id !== reqId;
              });
            });
          })
        );
      },
      setUserStatus: function (userId, status) {
        return wrap(
          AppSF.updateUser(userId, { status: status }).then(function () {
            patchUserLocal(userId, { status: status });
          })
        );
      },
      deleteTagGlobally: function (tag) {
        var key = AppUtils.tagKey(tag);
        var targets = posts.filter(function (p) {
          return p.tags.some(function (t) {
            return AppUtils.tagKey(t) === key;
          });
        });
        return wrap(
          targets
            .reduce(function (chain, p) {
              return chain.then(function () {
                return AppSF.updatePostTags(
                  p.id,
                  p.tags.filter(function (t) {
                    return AppUtils.tagKey(t) !== key;
                  })
                );
              });
            }, Promise.resolve())
            .then(function () {
              return reloadPosts();
            })
        );
      },
    };

    return {
      phase: phase,
      loadError: loadError,
      loginMessage: loginMessage,
      users: users,
      projects: projects,
      savedIds: savedIds,
      currentUser: currentUser,
      isAdmin: isAdmin,
      authorOf: authorOf,
      userForStaff: userForStaff,
      canEdit: canEdit,
      loginWithSalesforce: loginWithSalesforce,
      requestAccount: requestAccount,
      pendingRequests: pendingRequests,
      logout: logout,
      refresh: refresh,
      addProject: addProject,
      updateProject: updateProject,
      deleteProject: deleteProject,
      isSaved: isSaved,
      toggleSave: toggleSave,
      reactionsAvailable: reactionsAvailable,
      reactionsFor: reactionsFor,
      toggleReaction: toggleReaction,
      refreshPostReactions: refreshPostReactions,
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

    // --- アクセス制御 ---
    useEffect(
      function () {
        if (store.phase === "loading" || store.phase === "error") return;
        if (!store.currentUser) {
          if (route.name !== "login") router.navigate("/login", { replace: true });
          return;
        }
        if (store.currentUser.status === "suspended") {
          store.logout("アカウントが停止されているため、ログアウトしました。");
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
      [store.phase, store.currentUser && store.currentUser.id, store.currentUser && store.currentUser.status, route.name, route.params.id]
    );

    if (store.phase === "loading") {
      return h("div", { className: "center-loading" }, "Salesforceからデータを読み込み中...");
    }
    if (store.phase === "error") {
      return h(
        "div",
        { className: "center-loading load-error" },
        h("p", null, "データを読み込めませんでした。"),
        h("p", { className: "load-error-detail" }, store.loadError),
        h(
          "button",
          {
            className: "btn",
            onClick: function () {
              window.location.reload();
            },
          },
          "再読み込み"
        ),
        h(
          "button",
          {
            className: "btn ghost",
            onClick: function () {
              store.logout();
              router.navigate("/login", { replace: true });
            },
          },
          "ログアウト"
        )
      );
    }

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
        : route.name === "timeline"
        ? "timeline"
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
      case "timeline":
        page = h(P.TimelinePage, routeProps);
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
        onBack: showBack ? handleBack : null,
        active: activeNavKey,
        isAdmin: store.isAdmin,
        pendingCount: store.isAdmin ? store.pendingRequests.length : 0,
        right: h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
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
