// アプリ共通のデータ定義
// 投稿・利用者などの実データは Salesforce に保存する（src/sfdata.js）。
// このファイルには、写真の上限などの設定と、サンプル投稿の定義だけを置く。
// サンプル投稿の案件名・クライアント名・ハッシュタグ・写真は、昭栄美術の公開実績ページ
// （https://www.shoei-bijutsu.co.jp/works/）に掲載済みの情報・画像をもとにしたもの。
// 表示するかどうかは src/config.js の showSamplePosts で切り替える。
window.AppData = (function () {
  "use strict";

  function uid(prefix) {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function hashHue(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) % 360;
    }
    return h < 0 ? h + 360 : h;
  }

  function avatarColor(seedStr) {
    var hue = hashHue(seedStr);
    return "hsl(" + hue + ",48%,46%)";
  }

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
      photos: ["2026/03/l_C2A1560.png", "2026/03/l_C2A1554.png", "2026/03/l_C2A1571_1.png", "2026/03/l_C2A1603.png", "2026/03/l_C2A1586.png"],
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
      photos: ["2025/01/C2A8086_web.jpg", "2025/01/C2A8049_web.jpg", "2025/01/C2A8042_web.jpg", "2025/01/C2A8059_web.jpg", "2025/01/C2A8054_web.jpg"],
    },
    {
      title: "国際宝飾展2026 | 株式会社桑山様",
      client: "株式会社桑山",
      tags: ["BtoB", "展示会ブース"],
      author: "u_member2",
      photos: ["2026/02/l_C2A1378.jpg", "2026/02/l_C2A1383.jpg", "2026/02/l_C2A1403.jpg", "2026/02/l_C2A1370.jpg", "2026/02/l_C2A1364.jpg"],
    },
    {
      title: "TICAD BUSINESS EXPO ＆ CONFERENCE",
      client: "独立行政法人日本貿易振興機構（JETRO）",
      tags: ["BtoB"],
      author: "u_member1",
      photos: ["2025/10/20250819_231930096.jpg", "2025/10/20250819_233837280_iOS.jpg", "2025/10/20250820_100500150_iOS.jpg", "2025/10/IMG_8887.jpg", "2025/10/DSC09349.jpg"],
    },
    {
      title: "フーデックス関西2025イタリアパビリオン | イタリア大使館",
      client: "イタリア大使館",
      tags: ["BtoB", "展示会ブース", "インバウンド"],
      author: "u_member2",
      photos: ["2025/11/002.jpeg", "2025/11/001.jpeg", "2025/11/003.jpeg", "2025/11/004.jpeg", "2025/11/005.jpeg"],
    },
  ];

  // サンプル投稿は "seed_01"〜 の固定IDを持つ。閲覧専用（編集・削除・保存はできない）。
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
        authorId: null,
        authorName: "サンプル",
        isSample: true,
        propertyNo: "",
        salesforceUrl: "",
        createdAt: createdAt,
        updatedAt: createdAt,
      };
    });
  }

  var SAMPLE_PROJECTS = makeSeedProjects();

  return {
    uid: uid,
    avatarColor: avatarColor,
    // 表示するサンプル投稿（設定でオフにした場合は空）
    sampleProjects: function () {
      var cfg = window.AppConfig || {};
      return cfg.showSamplePosts === false ? [] : SAMPLE_PROJECTS;
    },
    LIMITS: {
      // 1投稿あたりの写真の枚数と、元の画像ファイルの合計容量の上限
      maxPhotosPerProject: 5,
      maxProjectSizeMB: 100,
      acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      // Salesforceのファイル保存容量を節約するため、保存時に長辺1600pxのJPEGに縮小・圧縮する
      storeMaxEdgePx: 1600,
      storeJpegQuality: 0.8,
      avatarMaxEdgePx: 400,
    },
  };
})();
