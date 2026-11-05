// Salesforceアカウントでのログイン（OAuth 2.0 認可コード + PKCE）
//
// 流れ:
//  1. 「Salesforceでログイン」→ Salesforceのログイン画面へ移動
//  2. ログイン後、Salesforceが ?code=... を付けてこのアプリに戻す
//  3. code を使ってアクセストークンを取得し、ログインした人の情報（メールアドレス等）を取得
//  4. アプリに登録済みの利用者のメールアドレスと一致すればログイン成功
//  5. 取得したトークンはすぐに無効化する（このアプリはSalesforceのデータを読まない）
//
// サーバーを持たない構成のため、コンシューマの秘密（Client Secret）は使わず、PKCEで保護する。
window.AppSSO = (function () {
  "use strict";

  var SS_KEY = "caseshelf_sf_pkce";

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
        scope: "openid email profile",
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
          return body.access_token;
        });
      })
      .then(function (token) {
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
            // このアプリはSalesforceのデータを読まないので、トークンはすぐ無効化する
            postForm(c.myDomainUrl + "/services/oauth2/revoke", { token: token }).catch(function () {});
            return {
              email: info.email || "",
              name: info.name || "",
              username: info.preferred_username || "",
            };
          });
      });
    return consumed;
  }

  return {
    isConfigured: isConfigured,
    startLogin: startLogin,
    consumeRedirect: consumeRedirect,
    redirectUri: redirectUri,
  };
})();
