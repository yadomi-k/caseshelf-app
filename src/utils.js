// 汎用ユーティリティ（試作品）
window.AppUtils = (function () {
  "use strict";

  // タグ正規化: 前後の空白除去、先頭の#除去、連続空白を1つに。
  // 重複判定は正規化後の小文字で比較する。
  function normalizeTag(raw) {
    var s = String(raw || "").trim();
    s = s.replace(/^#+/, "");
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }

  function tagKey(raw) {
    return normalizeTag(raw).toLowerCase();
  }

  function uniqueTags(list) {
    var seen = {};
    var out = [];
    (list || []).forEach(function (t) {
      var norm = normalizeTag(t);
      if (!norm) return;
      var key = norm.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(norm);
    });
    return out;
  }

  function formatDateTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      var pad = function (n) {
        return String(n).padStart(2, "0");
      };
      return (
        d.getFullYear() +
        "/" +
        pad(d.getMonth() + 1) +
        "/" +
        pad(d.getDate()) +
        " " +
        pad(d.getHours()) +
        ":" +
        pad(d.getMinutes())
      );
    } catch (e) {
      return "";
    }
  }

  function classNames() {
    var args = Array.prototype.slice.call(arguments);
    return args.filter(Boolean).join(" ");
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // クエリ文字列の簡易パーサー / ビルダー（ハッシュルーター用）
  function parseQuery(qs) {
    var out = {};
    if (!qs) return out;
    qs.replace(/^[?]/, "").split("&").forEach(function (pair) {
      if (!pair) return;
      var idx = pair.indexOf("=");
      var k, v;
      if (idx === -1) {
        k = pair;
        v = "";
      } else {
        k = pair.slice(0, idx);
        v = pair.slice(idx + 1);
      }
      out[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
    return out;
  }

  function buildQuery(obj) {
    var parts = [];
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      if (v === undefined || v === null || v === "") return;
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error("read error"));
      };
      reader.readAsDataURL(file);
    });
  }

  // 画像ファイルを、長辺 maxEdge px 以内のJPEGに縮小して data URL で返す
  function compressImage(file, maxEdge, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth,
            h = img.naturalHeight;
          var scale = Math.min(1, maxEdge / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale)),
            ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff"; // 透過部分（PNG等）は白にする
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode error"));
      };
      img.src = url;
    });
  }

  // バイト数を「12.3MB」のような表記にする
  function formatMB(bytes) {
    var mb = (bytes || 0) / (1024 * 1024);
    return (mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10) + "MB";
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  return {
    normalizeTag: normalizeTag,
    tagKey: tagKey,
    uniqueTags: uniqueTags,
    formatDateTime: formatDateTime,
    classNames: classNames,
    clamp: clamp,
    formatBytes: formatBytes,
    parseQuery: parseQuery,
    buildQuery: buildQuery,
    readFileAsDataURL: readFileAsDataURL,
    compressImage: compressImage,
    formatMB: formatMB,
    wait: wait,
  };
})();
