// アプリの設定（試作品）
// Salesforceログインを使うには、Salesforce側で接続アプリケーションを作成し、
// 以下の2つを設定してください。手順は README の「Salesforceでログイン」を参照。
window.AppConfig = {
  salesforce: {
    // 会社のSalesforceの「私のドメイン」のURL（例: "https://shoei-bijutsu.my.salesforce.com"）
    // ※ login.salesforce.com ではなく、必ず私のドメインのURLを指定する
    myDomainUrl: "https://shoei.my.salesforce.com",
    // 接続アプリケーションの「コンシューマ鍵」
    clientId: "3MVG9YDQS5WtC11pWkeuHxMae_.5kSdZ6uN6lnE7Sd.prc3wWdF.mIDSsrzVOCz._nlBnGuYhFXM2fFmr4Arw",
  },
  // 投稿画面の「物件Noで検索」で使う、Salesforceの商談の設定
  salesforceOpportunity: {
    // 検索するオブジェクト（商談 = Opportunity）
    object: "Opportunity",
    // 物件Noが入っている項目の「API参照名」（Salesforceの 設定 → オブジェクトマネージャ → 商談 → 項目とリレーション で確認）
    // ※ 仮の値です。実際の項目のAPI参照名に書き換えてください
    propertyNoField: "PropertyNo__c",
  },
  // デザイン担当者（投稿画面の「Salesforceで検索」で自動入力する）
  // 商談 → 商談商品（商品名＝課名）→ プロジェクト管理（基案件で商談商品につながる）→ 所有者 の順にたどる
  designStaff: {
    // デザイン部門（商談商品の商品名がこの名前のものを対象にする。この順に投稿画面へ並ぶ）
    departments: ["スペースデザイン課", "グラフィックデザイン課", "プランニング課"],
    // プロジェクト管理オブジェクトのAPI参照名
    projectObject: "Creative_Achievements__c",
    // プロジェクト管理の、商談商品を参照する項目（基案件）のAPI参照名
    lineItemField: "Base_opportunity__c",
  },
  // 最初の管理者のメールアドレス（Salesforceと同じもの）。
  // この人は、CaseShelfの利用者がまだ登録されていなくても、初回ログイン時に自動で「管理者」として登録される。
  // ※Salesforce側で「CaseShelf管理者」の権限セットが付与されている必要がある
  initialAdminEmails: ["yadomi-k@shoei-bijutsu.co.jp"],
  // 公開実績ページをもとにしたサンプル投稿を一覧に表示するか（閲覧専用）。不要になったら false にする
  showSamplePosts: true,
  // 未登録の人が「利用登録を依頼」したときに、依頼メールの宛先にするアドレス
  // （管理者のアドレスや、アカウント作成依頼を受け付けている共有アドレス）
  accountRequestEmail: "yadomi-k@shoei-bijutsu.co.jp",
};
