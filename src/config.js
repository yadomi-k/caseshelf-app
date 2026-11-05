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
  // 未登録の人が「利用登録を依頼」したときに、依頼メールの宛先にするアドレス
  // （管理者のアドレスや、アカウント作成依頼を受け付けている共有アドレス）
  accountRequestEmail: "yadomi-k@shoei-bijutsu.co.jp",
};
