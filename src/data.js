// データ層（試作品）
// 本来はサーバー上のデータベースに保存するが、第1段階の試作品では
// ブラウザのlocalStorageに保存する。
// 案件名・クライアント名・ハッシュタグ・写真は、昭栄美術の公開実績ページ
// （https://www.shoei-bijutsu.co.jp/works/）に掲載済みの情報・画像をもとにしたサンプル。
// サンプル案件（id が "seed_" で始まるもの）は、ページを開くたびに最新の内容へ
// 自動的に同期される（＝このファイルを更新して公開し直せば、以前そのブラウザを
// 開いたことがある人にも新しい内容が反映される）。利用者が実際に投稿・編集した
// 案件（id が "seed_" で始まらないもの）はこの同期の対象外で、そのまま保持される。
window.AppData = (function () {
  "use strict";

  var KEYS = {
    users: "caseshelf_users_v3",
    projects: "caseshelf_projects_v3",
    saves: "caseshelf_saves_v3",
    currentUser: "caseshelf_current_user_v3",
    seeded: "caseshelf_seeded_v3",
    requests: "caseshelf_account_requests_v1",
  };

  function uid(prefix) {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, function (c) {
      return (
        { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[
          c
        ] || c
      );
    });
  }

  function hashHue(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) % 360;
    }
    return h < 0 ? h + 360 : h;
  }

  // 架空のダミー写真を生成する（本番では実際の案件写真に置き換わる）
  function placeholderPhoto(seedStr, label) {
    var hue = hashHue(seedStr);
    var hue2 = (hue + 46) % 360;
    var svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='hsl(" + hue + ",58%,58%)'/>" +
      "<stop offset='1' stop-color='hsl(" + hue2 + ",55%,38%)'/>" +
      "</linearGradient></defs>" +
      "<rect width='800' height='800' fill='url(#g)'/>" +
      "<text x='50%' y='54%' font-size='58' fill='white' fill-opacity='0.92' " +
      "font-family='sans-serif' text-anchor='middle' dominant-baseline='middle'>" +
      escapeXml(label) +
      "</text></svg>";
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function avatarColor(seedStr) {
    var hue = hashHue(seedStr);
    return "hsl(" + hue + ",48%,46%)";
  }

  // ---------- パスワードのハッシュ化 ----------
  // パスワードはそのまま保存せず、SHA-256でハッシュ化した値だけを保存する。
  // ※試作品ではハッシュ値もこの端末のブラウザ内に保存されるため、本当の意味での
  //   セキュリティ（第三者からの保護）にはならない。本番ではサーバー側で認証する。
  function hashPassword(userId, password) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(
        new Error("このブラウザ環境ではパスワード処理ができません（https または localhost で開いてください）。")
      );
    }
    var bytes = new TextEncoder().encode("caseshelf:" + userId + ":" + password);
    return window.crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) {
          return ("0" + b.toString(16)).slice(-2);
        })
        .join("");
    });
  }

  // ---------- シードデータ（架空の案件・利用者） ----------

  var SEED_USERS = [
    {
      id: "u_yadomi",
      loginId: "yadomi-k@shoei-bijutsu.co.jp",
      email: "yadomi-k@shoei-bijutsu.co.jp",
      displayName: "yadomi-k",
      role: "admin",
      status: "active",
      avatarImage: null,
    },
    {
      id: "u_admin1",
      loginId: "sato",
      email: "admin.sato@example-sei.co.jp",
      displayName: "佐藤 management（管理者）",
      role: "admin",
      status: "active",
      avatarImage: null,
    },
    {
      id: "u_member1",
      loginId: "yamada",
      email: "yamada@example-sei.co.jp",
      displayName: "山田 花子",
      role: "member",
      status: "active",
      avatarImage: null,
    },
    {
      id: "u_member2",
      loginId: "tanaka",
      email: "tanaka@example-sei.co.jp",
      displayName: "田中 次郎",
      role: "member",
      status: "active",
      avatarImage: null,
    },
    {
      id: "u_suspended1",
      loginId: "teishi",
      email: "suspended@example-sei.co.jp",
      displayName: "停止 三郎（利用停止サンプル）",
      role: "member",
      status: "suspended",
      avatarImage: null,
    },
  ];

  // 案件名・クライアント名・ハッシュタグ・写真URLはすべて
  // https://www.shoei-bijutsu.co.jp/works/ の掲載情報・掲載画像より（2026年時点）。
  // 説明文は掲載情報（案件名・クライアント名・掲載タグ）から推測できる範囲のみを記載し、
  // 掲載されていない制作の詳細は記載していない。
  var UP = "https://www.shoei-bijutsu.co.jp/wp_PEavvjPX/wp-content/uploads/";
  var SEED_DEFS = [
    {
      title: "国際物流総合展2026 | 鴻池運輸株式会社",
      client: "鴻池運輸株式会社",
      tags: ["BtoB", "展示会ブース"],
      author: "u_member1",
      photos: ["2026/09/C2A5431.jpg", "2026/09/C2A5424.jpg", "2026/09/C2A5445.jpg", "2026/09/C2A5450.jpg", "2026/09/C2A5532.jpg"],
    },
    {
      title: "下水道展2026 | 株式会社荏原製作所様ブース",
      client: "株式会社荏原製作所",
      tags: ["BtoB", "BtoC", "展示会ブース"],
      author: "u_member2",
      photos: ["2026/09/l_C2A4363.jpg", "2026/09/l_C2A4373.jpg", "2026/09/C2A4353.jpg", "2026/09/l_C2A4383.jpg"],
    },
    {
      title: "第60回スーパーマーケット・トレードショー2026 | 東洋水産株式会社様ブース",
      client: "東洋水産株式会社",
      tags: ["BtoB", "展示会ブース"],
      author: "u_member1",
      photos: ["2026/09/l_C2A2004_1.jpg"],
    },
    {
      title: "ものづくり ワールド2026 イリノイ州パビリオン",
      client: "米国イリノイ州政府駐日事務所",
      tags: ["BtoB", "海外展示会ブース"],
      author: "u_member2",
      photos: ["2026/08/0902_%E3%82%82%E3%81%AE%E3%81%A5%E3%81%8F%E3%82%8A%E3%83%AF%E3%83%BC%E3%83%AB%E3%83%89%E3%82%A4%E3%83%AA%E3%83%8E%E3%82%A4%E5%B7%9E.jpg"],
    },
    {
      title: "rom&nd popup ロムアンド商事〜ジューシーフラッシュ営業部〜",
      client: "株式会社電通ライブ",
      tags: ["BtoC", "ポップアップストア"],
      author: "u_member1",
      photos: ["2026/08/l_260409_romnd0181.jpg", "2026/08/romnd_shoei.jpg"],
    },
    {
      title: "郡山ヒロセ電機 郡山工場2F新設ショールーム",
      client: "郡山ヒロセ電機株式会社",
      tags: ["BtoB", "ショールーム", "ショールーム・内装"],
      author: "u_member2",
      photos: ["2026/05/l_DSC8400.png", "2026/05/l_DSC8440.jpg", "2026/05/l_DSC8589.jpg", "2026/05/l_DSC8464.jpg", "2026/05/l_DSC8490.jpg"],
    },
    {
      title: "HVAC&R JAPAN 2026 | 三菱電機",
      client: "三菱電機株式会社",
      tags: ["BtoB", "展示会ブース"],
      author: "u_member1",
      photos: ["2026/03/l_C2A1560.png", "2026/03/l_C2A1554.png", "2026/03/l_C2A1571_1.png", "2026/03/l_C2A1603.png", "2026/03/l_C2A1586.png", "2026/03/C2A1544_2.png"],
    },
    {
      title: "ABB FIA フォーミュラE世界選手権東京大会2025",
      client: "Formula E Operations Limited",
      tags: ["BtoB", "モータースポーツ"],
      author: "u_member2",
      photos: ["2025/10/1%E3%83%A1%E3%82%A4%E3%83%B3_C2A1091.jpg", "2025/10/2_C2A1078.jpg", "2025/10/3_C2A1014_1.jpg", "2025/10/4_C2A1050.jpg", "2025/10/5_C2A1035.jpg"],
    },
    {
      title: "hololive SUPER EXPO 2025",
      client: "株式会社ツートップ",
      tags: ["BtoC", "PRイベント"],
      author: "u_member1",
      photos: ["2025/04/low_mc_0305_0001.jpg", "2025/04/low_mc_0305_0006.jpg", "2025/04/low_mc_0305_0022.jpg", "2025/04/low_mc_0305_0016.jpg", "2025/04/low_mc_0305_0009.jpg"],
    },
    {
      title: "CEATEC2023 | NEDO",
      client: "国立研究開発法人 新エネルギー・産業技術総合開発機構（NEDO）",
      tags: ["BtoB", "展示会ブース", "サステナビリティ実績"],
      author: "u_member2",
      photos: ["2024/04/HP_%E5%AE%9F%E7%B8%BE_CEATEC2023NEDO%E3%83%96%E3%83%BC%E3%82%B9_0319-03.jpg", "2024/04/HP_%E5%AE%9F%E7%B8%BE_CEATEC2023NEDO%E3%83%96%E3%83%BC%E3%82%B9_0319-04.jpg", "2024/04/HP_%E5%AE%9F%E7%B8%BE_CEATEC2023NEDO%E3%83%96%E3%83%BC%E3%82%B9_0319-05.jpg"],
    },
    {
      title: "WOODコレクション（モクコレ）2024Plus",
      client: "東京都",
      tags: ["行政・自治体・官公庁", "展示会主催工事"],
      author: "u_member1",
      photos: ["2025/01/C2A8086_web.jpg", "2025/01/C2A8049_web.jpg", "2025/01/C2A8042_web.jpg", "2025/01/C2A8059_web.jpg", "2025/01/C2A8054_web.jpg", "2025/01/C2A8066_web.jpg"],
    },
    {
      title: "国際宝飾展2026 | 株式会社桑山様",
      client: "株式会社桑山",
      tags: ["BtoB", "展示会ブース"],
      author: "u_member2",
      photos: ["2026/02/l_C2A1378.jpg", "2026/02/l_C2A1383.jpg", "2026/02/l_C2A1403.jpg", "2026/02/l_C2A1370.jpg", "2026/02/l_C2A1364.jpg", "2026/02/l_C2A1359.jpg"],
    },
    {
      title: "TICAD BUSINESS EXPO ＆ CONFERENCE",
      client: "独立行政法人日本貿易振興機構（JETRO）",
      tags: ["BtoB"],
      author: "u_member1",
      photos: ["2025/10/20250819_231930096.jpg", "2025/10/20250819_233837280_iOS.jpg", "2025/10/20250820_100500150_iOS.jpg", "2025/10/IMG_8887.jpg", "2025/10/DSC09349.jpg", "2025/10/DSC09329.jpg"],
    },
    {
      title: "フーデックス関西2025イタリアパビリオン | イタリア大使館",
      client: "イタリア大使館",
      tags: ["BtoB", "展示会ブース", "インバウンド"],
      author: "u_member2",
      photos: ["2025/11/002.jpeg", "2025/11/001.jpeg", "2025/11/003.jpeg", "2025/11/004.jpeg", "2025/11/005.jpeg", "2025/11/006.jpeg"],
    },
  ];

  // サンプル案件は "seed_01"〜"seed_14" の固定IDを持つ。内容（タイトル・タグ・写真等）が
  // 変わっても同じIDを保つことで、閲覧のたびに最新内容へ同期しつつ、ブックマーク等の
  // 参照も壊れないようにしている。
  function makeSeedProjects() {
    var baseTime = Date.UTC(2026, 9, 20, 9, 0, 0); // 固定基準時刻（毎回同じ並び順になるようにする）
    return SEED_DEFS.map(function (d, idx) {
      var id = "seed_" + String(idx + 1).padStart(2, "0");
      var photos = d.photos.map(function (path, pi) {
        return { id: id + "_ph" + pi, url: UP + path, order: pi };
      });
      var createdAt = new Date(baseTime - idx * 36 * 3600 * 1000).toISOString();
      return {
        id: id,
        title: d.title,
        description: "クライアント: " + d.client + "（会社実績ページ掲載情報によるサンプル投稿）",
        tags: d.tags,
        photos: photos,
        coverPhotoId: photos[0].id,
        authorId: d.author,
        salesforceUrl: "",
        createdAt: createdAt,
        updatedAt: createdAt,
      };
    });
  }

  // 既存の保存データに対し、サンプル案件（id が "seed_" で始まるもの）だけを
  // 最新の内容に差し替える。利用者が自分で投稿・編集した案件（それ以外のid）は触らない。
  function upsertSeedProjects(existingProjects) {
    var nonSeed = (existingProjects || []).filter(function (p) {
      return String(p && p.id).indexOf("seed_") !== 0;
    });
    return makeSeedProjects().concat(nonSeed);
  }

  // ---------- 永続化ヘルパー ----------

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("[AppData] failed to read", key, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (e) {
      console.warn("[AppData] failed to write", key, e);
      return { ok: false, error: e };
    }
  }

  function ensureSeeded() {
    if (!readJSON(KEYS.seeded, false)) {
      writeJSON(KEYS.users, SEED_USERS);
      writeJSON(KEYS.saves, {});
      writeJSON(KEYS.seeded, true);
    }
    // ログインは基本的にSalesforceで行い、パスワードでのログインは管理者の緊急用のみとした。
    // 以前のバージョンでサンプル利用者に付けていた共通パスワードは、抜け道にならないよう削除する。
    var SAMPLE_IDS = ["u_admin1", "u_member1", "u_member2", "u_suspended1"];
    var stored = readJSON(KEYS.users, SEED_USERS);
    var migrated = stored.map(function (u) {
      if (SAMPLE_IDS.indexOf(u.id) === -1 || !u.passwordHash) return u;
      var copy = Object.assign({}, u);
      delete copy.passwordHash;
      return copy;
    });
    // 後から追加したサンプル利用者（例: 実際の利用者アカウント）が無ければ追加する
    SEED_USERS.forEach(function (seed) {
      var exists = migrated.some(function (u) {
        return u.id === seed.id;
      });
      if (!exists) migrated.unshift(seed);
    });
    writeJSON(KEYS.users, migrated);
    // サンプル案件（seed_*）は毎回最新内容に同期する。利用者が投稿した案件はそのまま残す。
    writeJSON(KEYS.projects, upsertSeedProjects(readJSON(KEYS.projects, [])));
  }

  ensureSeeded();

  function loadUsers() {
    return readJSON(KEYS.users, SEED_USERS);
  }
  function saveUsers(list) {
    return writeJSON(KEYS.users, list);
  }
  function loadProjects() {
    return readJSON(KEYS.projects, []);
  }
  function saveProjects(list) {
    return writeJSON(KEYS.projects, list);
  }
  function loadSaves() {
    return readJSON(KEYS.saves, {});
  }
  function saveSaves(obj) {
    return writeJSON(KEYS.saves, obj);
  }
  // 未登録の人からの利用登録の依頼
  function loadRequests() {
    return readJSON(KEYS.requests, []);
  }
  function saveRequests(list) {
    return writeJSON(KEYS.requests, list);
  }
  function getCurrentUserId() {
    try {
      return localStorage.getItem(KEYS.currentUser) || null;
    } catch (e) {
      return null;
    }
  }
  function setCurrentUserId(id) {
    try {
      if (id) localStorage.setItem(KEYS.currentUser, id);
      else localStorage.removeItem(KEYS.currentUser);
    } catch (e) {}
  }

  function resetAllData() {
    try {
      Object.keys(KEYS).forEach(function (k) {
        localStorage.removeItem(KEYS[k]);
      });
    } catch (e) {}
    ensureSeeded();
  }

  return {
    uid: uid,
    placeholderPhoto: placeholderPhoto,
    avatarColor: avatarColor,
    loadUsers: loadUsers,
    saveUsers: saveUsers,
    loadProjects: loadProjects,
    saveProjects: saveProjects,
    loadSaves: loadSaves,
    saveSaves: saveSaves,
    loadRequests: loadRequests,
    saveRequests: saveRequests,
    getCurrentUserId: getCurrentUserId,
    setCurrentUserId: setCurrentUserId,
    resetAllData: resetAllData,
    hashPassword: hashPassword,
    LIMITS: {
      maxPhotosPerProject: 20,
      maxPhotoSizeMB: 5,
      acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    },
  };
})();
