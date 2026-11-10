// Salesforceアカウントでのログイン（OAuth 2.0 認可コード + PKCE）
//
// 流れ:
//  1. 「Salesforceでログイン」→ Salesforceのログイン画面へ移動
//  2. ログイン後、Salesforceが ?code=... を付けてこのアプリに戻す
//  3. code を使ってアクセストークンを取得し、ログインした人の情報（メールアドレス等）を取得
//  4. アプリに登録済みの利用者のメールアドレスと一致すればログイン成功
//  5. 取得したトークンで、CaseShelfのデータ（投稿・写真・利用者など）をSalesforceに読み書きする。
//     トークンはログアウトするまでこのブラウザに保持し（localStorage）、ログアウト時に無効化する。
//     有効期限（Salesforceのセッションタイムアウト）が切れたら、ログインし直す。
//
// サーバーを持たない構成のため、コンシューマの秘密（Client Secret）は使わず、PKCEで保護する。
window.AppSSO = (function () {
  "use strict";

  var SS_KEY = "caseshelf_sf_pkce";
  var TOKEN_KEY = "caseshelf_sf_session_v1";
  var API_VERSION = "v60.0";

  // ページを開いた時点のURLを保存しておく（画面切り替えでURLが変わる前に読み取るため）
  var initialParams = new URLSearchParams(window.location.search);

  function config() {
    var c = (window.AppConfig && window.AppConfig.salesforce) || {};
    return {
      myDomainUrl: String(c.myDomainUrl || "").replace(/\/+$/, ""),
      clientId: String(c.clientId || ""),
    };
  }

  function isConfigured() {
    var c = config();
    return !!(c.myDomainUrl && c.clientId);
  }

  // Salesforceから戻ってくる先。Salesforce側の「コールバックURL」と完全に一致させる必要がある。
  function redirectUri() {
    // 「…/index.html」で開かれた場合も、コールバックURLは「…/」に揃える
    return window.location.origin + window.location.pathname.replace(/index\.html$/, "");
  }

  function base64Url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function randomString(len) {
    var bytes = new Uint8Array(len);
    window.crypto.getRandomValues(bytes);
    return base64Url(bytes);
  }

  function sha256Base64Url(text) {
    return window.crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(text))
      .then(function (buf) {
        return base64Url(new Uint8Array(buf));
      });
  }

  function saveState(obj) {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify(obj));
    } catch (e) {}
  }
  function takeState() {
    try {
      var v = sessionStorage.getItem(SS_KEY);
      sessionStorage.removeItem(SS_KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }

  // 1. Salesforceのログイン画面へ移動する
  function startLogin() {
    if (!isConfigured()) {
      return Promise.reject(
        new Error("Salesforceログインの設定がまだ完了していません。管理者にお問い合わせください（設定方法はREADME参照）。")
      );
    }
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(new Error("このブラウザ環境ではSalesforceログインを使えません（https または localhost で開いてください）。"));
    }
    var c = config();
    var verifier = randomString(48);
    var state = randomString(16);
    return sha256Base64Url(verifier).then(function (challenge) {
      saveState({ verifier: verifier, state: state });
      var params = new URLSearchParams({
        response_type: "code",
        client_id: c.clientId,
        redirect_uri: redirectUri(),
        code_challenge: challenge,
        code_challenge_method: "S256",
        // api: 投稿画面で物件Noから商談（Name・URL）を検索するため
        scope: "openid email profile api",
        state: state,
        prompt: "login",
      });
      window.location.assign(c.myDomainUrl + "/services/oauth2/authorize?" + params.toString());
    });
  }

  // URLから ?code=... などを取り除く（再読み込みで二重処理しないように）
  function cleanUrl() {
    try {
      history.replaceState(null, "", window.location.pathname + "#/login");
    } catch (e) {}
  }

  function postForm(url, data) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data).toString(),
    });
  }

  function networkError() {
    return new Error(
      "Salesforceと通信できませんでした。Salesforce側のCORS設定（このアプリのURLの許可、「OAuthエンドポイントのCORSを有効化」）を確認してください。"
    );
  }

  var consumed = null;

  // 2〜5. Salesforceから戻ってきたときの処理。
  // 戻ってきたのでなければ null を、戻ってきた場合は { email, name, username } を返す。
  function consumeRedirect() {
    if (consumed) return consumed;
    var code = initialParams.get("code");
    var err = initialParams.get("error");
    var returnedState = initialParams.get("state");
    if (!code && !err) {
      consumed = Promise.resolve(null);
      return consumed;
    }
    initialParams = new URLSearchParams();
    cleanUrl();
    var saved = takeState();

    if (err) {
      consumed = Promise.reject(
        new Error(err === "access_denied" ? "Salesforceでのログインがキャンセルされました。" : "Salesforceでのログインに失敗しました（" + err + "）。")
      );
      return consumed;
    }
    if (!saved || returnedState !== saved.state) {
      consumed = Promise.reject(new Error("ログインの確認に失敗しました。もう一度「Salesforceでログイン」を押してください。"));
      return consumed;
    }

    var c = config();
    consumed = postForm(c.myDomainUrl + "/services/oauth2/token", {
      grant_type: "authorization_code",
      code: code,
      client_id: c.clientId,
      redirect_uri: redirectUri(),
      code_verifier: saved.verifier,
    })
      .catch(function () {
        throw networkError();
      })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok || !body.access_token) {
            throw new Error("Salesforceでのログインに失敗しました（" + (body.error_description || body.error || res.status) + "）。");
          }
          return body;
        });
      })
      .then(function (tokenBody) {
        var token = tokenBody.access_token;
        return fetch(c.myDomainUrl + "/services/oauth2/userinfo", {
          headers: { Authorization: "Bearer " + token },
        })
          .catch(function () {
            throw networkError();
          })
          .then(function (res) {
            if (!res.ok) throw new Error("Salesforceの利用者情報を取得できませんでした（" + res.status + "）。");
            return res.json();
          })
          .then(function (info) {
            var profile = {
              email: info.email || "",
              name: info.name || "",
              username: info.preferred_username || "",
              sfUserId: info.user_id || "",
            };
            saveToken({ accessToken: token, instanceUrl: tokenBody.instance_url || c.myDomainUrl, profile: profile });
            return profile;
          });
      });
    return consumed;
  }

  // ------------------------------------------------------------------
  // ログイン中のSalesforce接続
  // ------------------------------------------------------------------
  function saveToken(obj) {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify(obj));
    } catch (e) {}
  }
  function readToken() {
    try {
      var v = localStorage.getItem(TOKEN_KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }
  function dropToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  // ログイン中なら { profile: {email, name, sfUserId}, instanceUrl } を返す
  function getSession() {
    var t = readToken();
    return t && t.accessToken ? { profile: t.profile || {}, instanceUrl: t.instanceUrl } : null;
  }

  // ログアウト時: 保持していたトークンを無効化して消す
  function endSession() {
    var t = readToken();
    dropToken();
    if (t && t.accessToken) {
      postForm(config().myDomainUrl + "/services/oauth2/revoke", { token: t.accessToken }).catch(function () {});
    }
  }

  // 接続の有効期限切れを画面に知らせる
  function expire() {
    dropToken();
    try {
      window.dispatchEvent(new Event("caseshelf-session-expired"));
    } catch (e) {}
  }

  // オブジェクトを参照できないときの案内（利用者が自分で読んで、誰に何を頼めばよいかわかる文にする）
  var OBJECT_LABELS = {
    Opportunity: "商談",
    OpportunityLineItem: "商談商品",
    Product2: "商品",
    Creative_Achievements__c: "プロジェクト管理",
  };
  function objectAccessMessage(objectName) {
    if (/^CaseShelf_/i.test(objectName)) {
      return (
        "このSalesforceアカウントには、CaseShelfを使う権限（権限セット「CaseShelf利用者」）が付いていません。" +
        "Salesforceの管理者に、権限セット「CaseShelf利用者」の割り当てを依頼してください。" +
        "（割り当て後も表示される場合は、Salesforceのユーザーライセンスでカスタムオブジェクトが使えるか確認してください）"
      );
    }
    var label = OBJECT_LABELS[objectName] || objectName;
    return (
      "このSalesforceアカウントには、Salesforceの「" + label + "」を参照する権限がありません。" +
      "必要な場合は、Salesforceの管理者に参照権限の付与を依頼してください。"
    );
  }

  function apiError(res, body) {
    var first = Array.isArray(body) ? body[0] : body;
    var code = (first && first.errorCode) || String(res.status);
    var msg = (first && first.message) || "";
    var text;
    // 「sObject type 'xxx' is not supported」等：そのオブジェクトがこのユーザーから見えない
    // （権限セットが付いていない、ライセンスで使えない、またはオブジェクトが未作成）
    var objMatch = /sObject type '([^']+)'/i.exec(msg);
    if (objMatch && (code === "INVALID_TYPE" || code === "NOT_FOUND")) {
      text = objectAccessMessage(objMatch[1]);
    } else if (code === "INVALID_TYPE" || code === "INVALID_FIELD") {
      text = "Salesforceのオブジェクト・項目の設定が正しくありません（" + msg + "）。docs/salesforce-setup.md を確認してください。";
    } else if (code === "INSUFFICIENT_ACCESS_OR_READONLY" || code === "INSUFFICIENT_ACCESS" || code === "INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY") {
      text = "この操作を行う権限がSalesforceにありません（権限セットを確認してください）。";
    } else if (code === "API_DISABLED_FOR_ORG" || code === "API_CURRENTLY_DISABLED") {
      text = "SalesforceのAPIを利用する権限がありません。管理者にお問い合わせください。";
    } else if (code === "DUPLICATE_VALUE") {
      text = "同じ値が既に登録されています。";
    } else {
      text = "Salesforceとの通信でエラーが発生しました（" + code + (msg ? ": " + msg : "") + "）。";
    }
    var err = new Error(text);
    err.code = code;
    err.status = res.status;
    return err;
  }

  // Salesforce REST API を呼ぶ。path は "/query?q=..." のように /services/data/vXX.X 以降を渡す
  // （"/services/" で始まる完全なパスも可）。
  // opts.raw = true なら Response をそのまま返す（ファイルのダウンロード用）。
  function api(method, path, body, opts) {
    opts = opts || {};
    var t = readToken();
    if (!t || !t.accessToken) {
      expire();
      return Promise.reject(new Error("Salesforceに接続されていません。ログインし直してください。"));
    }
    var base = String(t.instanceUrl || config().myDomainUrl).replace(/\/+$/, "");
    var url = base + (path.indexOf("/services/") === 0 ? path : "/services/data/" + API_VERSION + path);
    var headers = { Authorization: "Bearer " + t.accessToken };
    if (body !== undefined && body !== null) headers["Content-Type"] = "application/json";
    if (!opts.raw) headers.Accept = "application/json";
    return fetch(url, {
      method: method,
      headers: headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    })
      .catch(function () {
        throw new Error("Salesforceと通信できませんでした。ネットワーク、またはSalesforce側のCORS設定（このアプリのURLの許可）を確認してください。");
      })
      .then(function (res) {
        if (res.status === 401) {
          expire();
          var e = new Error("Salesforceの接続の有効期限が切れました。もう一度ログインしてください。");
          e.status = 401;
          throw e;
        }
        if (opts.raw) {
          if (!res.ok) throw apiError(res, null);
          return res;
        }
        if (res.status === 204) return null;
        return res.text().then(function (text) {
          var parsed = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch (e) {}
          if (!res.ok) throw apiError(res, parsed);
          return parsed;
        });
      });
  }

  function opportunityConfig() {
    var o = (window.AppConfig && window.AppConfig.salesforceOpportunity) || {};
    return {
      object: o.object || "Opportunity",
      propertyNoField: o.propertyNoField || "",
      // 物件種別（ハッシュタグに自動入力する）。空なら使わない
      propertyTypeField: o.propertyTypeField === undefined ? "PropertyType__c" : o.propertyTypeField || "",
    };
  }

  // SOQLの文字列リテラル用にエスケープする
  function soqlString(v) {
    return "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  }

  // レコードの画面URL（Lightning）
  function recordUrl(objectName, id) {
    return config().myDomainUrl + "/lightning/r/" + objectName + "/" + id + "/view";
  }

  // 物件Noで商談を検索する。
  // 見つかれば { name, url, id }、見つからなければ null を返す（Promise）。
  function searchOpportunityByPropertyNo(propertyNo) {
    var no = String(propertyNo || "").trim();
    var oc = opportunityConfig();
    if (!no) return Promise.reject(new Error("物件Noを入力してください。"));
    if (!oc.propertyNoField) {
      return Promise.reject(new Error("物件Noの項目名が設定されていません（src/config.js の salesforceOpportunity.propertyNoField）。"));
    }
    if (!/^[A-Za-z0-9_]+$/.test(oc.propertyNoField) || !/^[A-Za-z0-9_]+$/.test(oc.object)) {
      return Promise.reject(new Error("src/config.js の salesforceOpportunity の設定が正しくありません。"));
    }
    var typeField = /^[A-Za-z0-9_]+$/.test(oc.propertyTypeField) && !propertyTypeUnavailable ? oc.propertyTypeField : "";
    function run(withType) {
      var q =
        "SELECT Id, Name" + (withType ? ", " + typeField : "") + " FROM " + oc.object +
        " WHERE " + oc.propertyNoField + " = " + soqlString(no) +
        " LIMIT 2";
      return api("GET", "/query?q=" + encodeURIComponent(q));
    }
    return run(!!typeField)
      .catch(function (e) {
        // 物件種別の項目が無い・参照できない場合は、物件種別なしで検索する
        if (typeField && e.code === "INVALID_FIELD" && e.message.indexOf(typeField) !== -1) {
          propertyTypeUnavailable = true;
          typeField = "";
          return run(false);
        }
        throw e;
      })
      .catch(function (e) {
        if (e.code === "INVALID_FIELD" || e.code === "INVALID_TYPE") {
          throw new Error("物件Noの項目名の設定が正しくありません。src/config.js の salesforceOpportunity.propertyNoField を確認してください。");
        }
        throw e;
      })
      .then(function (body) {
        var recs = (body && body.records) || [];
        if (!recs.length) return null;
        var r = recs[0];
        return {
          id: r.Id,
          name: r.Name || "",
          url: recordUrl(oc.object, r.Id),
          multiple: recs.length > 1,
          propertyTypes: typeField ? cleanPropertyTypes(r[typeField]) : [],
        };
      });
  }

  // 物件種別の値から、先頭（または末尾）の「番号と/」を除く。例: "01/展示会" → "展示会"
  // 複数選択の選択リスト（「;」区切り）にも対応する
  var propertyTypeUnavailable = false;
  function cleanPropertyTypes(value) {
    if (value === null || value === undefined) return [];
    return String(value)
      .split(";")
      .map(function (v) {
        return v
          .replace(/^[\s0-9０-９]+[\s.．_\-ー]*[/／]\s*/, "")
          .replace(/\s*[/／][\s.．_\-ー]*[0-9０-９]+\s*$/, "")
          .trim();
      })
      .filter(Boolean);
  }

  return {
    getSession: getSession,
    endSession: endSession,
    api: api,
    soqlString: soqlString,
    recordUrl: recordUrl,
    searchOpportunityByPropertyNo: searchOpportunityByPropertyNo,
    cleanPropertyTypes: cleanPropertyTypes,
    isConfigured: isConfigured,
    startLogin: startLogin,
    consumeRedirect: consumeRedirect,
    redirectUri: redirectUri,
  };
})();
