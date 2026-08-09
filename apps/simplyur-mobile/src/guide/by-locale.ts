import type { SimplyurLocale } from '@/src/constants/simplyur';
import type { SimplyurGuideMessages } from '@/src/guide/guide-types';
import { GUIDE_EN_HANDOFF } from '@/src/guide/handoff-en';

/** Locale-specific install guide copy (simplyur-branded; no supplier names). */
const GUIDE_BY_LOCALE: Partial<Record<SimplyurLocale, SimplyurGuideMessages>> = {
  ja: {
    title: "eSIMのインストール方法",
    intro: "simplyurのWeb/アプリの実際の流れに沿ったガイドです。プラン選択・アプリ内決済・インストール・サインイン後のMy eSIMまで利用できます。",
    flowPhaseNote: "現在利用可能：韓国プラン閲覧、アプリ内チェックアウト、インストールガイド、サインイン後のMy eSIM（QR・利用量）。",
    tabs: { precheck: "事前確認", iphone: "iPhone", android: "Android" },
    stepsTitle: "インストール手順",
    faqTitle: "よくある質問 — 韓国eSIM",
    regionalFaqTitle: "地域別のお知らせ（将来の多国間プラン用）",
    regionalFaqNote: "simplyur Phase 1は韓国専用です。以下は将来の多国間プラン向けの事前案内で、現在の韓国専用商品には適用されません。",
    supportHint: "お問い合わせ: bongtour24@naver.com（KST 09:00–18:00）",
    quickSteps: [
      "端末がeSIM対応かつSIMロック解除されていることを確認。",
      "安定したWi‑Fiに接続してからインストール。",
      "simplyurメール（またはサインイン後のMy eSIM）のQRを開く。",
      "設定からeSIMを追加 — QRスキャンまたは手動コード入力。",
      "韓国到着後、simplyur回線をONにしモバイルデータ回線に設定。"
    ],
    precheckBlocks: [
      {
        heading: "1. 端末の対応確認",
        paras: ["eSIM対応かつSIMロック解除（またはeSIM追加可能）である必要があります。メニューの対応端末もご確認ください。"],
        bullets: ["iPhone XS以降（14/15/16シリーズ含む）", "Galaxy S20+、Pixel 3+ などeSIM対応Android"]
      },
      {
        heading: "2. 安定したネットワークでインストール",
        paras: ["ホテル・空港ラウンジなど信頼できるWi‑Fiで行ってください。不安定な公共Wi‑Fiでは失敗することがあります。"],
        note: "失敗した場合は端末を再起動し、別のネットワークで再試行してください。"
      },
      {
        heading: "3. いつインストールするか",
        paras: ["多くの韓国プランは出発前にインストール可能です。利用期間は通常、韓国で初めてネットワークに接続した時点から始まります。注文メールをご確認ください。"]
      }
    ],
    precheckFaq: [
      { q: "韓国行き前にインストールできますか？", a: "多くの韓国プランで可能です。仁川空港到着後すぐ使えるよう事前インストールをおすすめします。" },
      { q: "SIMロック解除は必要？", a: "はい。ロック端末ではeSIMを追加できません。設定でeSIM追加を試して確認してください。" }
    ],
    iphoneSteps: [
      {
        title: "eSIMを受け取る",
        blocks: [{
          bullets: ["韓国プラン選択 → チェックアウト", "メール必須（QR送信先）・電話任意（国番号付き）・規約同意 → 決済", "決済・発行後、そのメールのQR/SM-DP+/アクティベーションコードを確認", "任意：同じメールでGoogleサインイン → My eSIM"],
          note: "旅行終了までQRメールを保管し、コードを公開しないでください。"
        }]
      },
      {
        title: "eSIMをインストール",
        blocks: [
          { bullets: ["通話中はインストールできません。", "Wi‑Fiまたはモバイルデータを維持してください。"] },
          {
            heading: "方法A — QRコード",
            paras: ["iPhoneは写真アプリ内のQRを読み取れません。PC・タブレット・同行者の画面に表示するか印刷してください。"],
            bullets: ["設定 → モバイル通信 → eSIMを追加 → QRコードを使用。", "simplyurメールのQRをスキャン。", "画面の指示に従い完了。"]
          },
          {
            heading: "方法B — 手動入力",
            bullets: ["設定 → モバイル通信 → eSIMを追加 → 詳細を手動で入力。", "simplyurメールのSM-DP+アドレスとアクティベーションコードを入力。"]
          }
        ]
      },
      {
        title: "韓国で有効化",
        blocks: [{
          bullets: ["設定 → モバイル通信。", "新しいsimplyur回線をON。", "モバイルデータ回線をsimplyurに設定。", "必要に応じデータローミングをON（注文メール参照）。"],
          note: "接続しない場合は機内モードのON/OFF、または手動でキャリア選択を試してください。"
        }]
      },
      {
        title: "旅行後の削除",
        blocks: [{ note: "旅行が完全に終わってから削除してください。問題がある場合は削除前にサポートへ。", bullets: ["設定 → モバイル通信 → 旅行用eSIM → モバイル通信プランを削除。"] }]
      }
    ],
    androidSteps: [
      { title: "eSIMを受け取る", blocks: [{ bullets: ["プラン選択 → メール必須でチェックアウト", "決済・発行後、QRメールを確認", "同じメールでGoogleサインイン → My eSIM（有効時）"] }] },
      {
        title: "eSIMをインストール",
        blocks: [
          { bullets: ["通話終了後に実施。", "Wi‑Fiまたはモバイルデータに接続。"] },
          { heading: "方法A — QR", bullets: ["設定 → 接続 → SIMマネージャー → eSIMを追加 → QRスキャン。"] },
          { heading: "方法B — 手動", paras: ["スキャン不可時はアクティベーションコードを手入力。"] },
          { note: "Samsung・Pixel等でメニュー名が異なります。SIMマネージャーまたはeSIM追加を探してください。" }
        ]
      },
      { title: "韓国で有効化", blocks: [{ bullets: ["simplyur eSIMを有効化。", "モバイルデータのデフォルト回線に設定。", "必要ならデータローミングON。"], note: "数分待っても接続しない場合は機内モードまたは再起動を試してください。" }] },
      { title: "旅行後の削除", blocks: [{ bullets: ["設定 → 接続 → SIMマネージャー → 削除。"], note: "接続問題がある場合は削除前にサポートへ。" }] }
    ],
    commonFaq: [
      { q: "今simplyurでできることは？", a: "韓国eSIMプラン閲覧、アプリ内チェックアウト、多言語料金、本ガイド、サインイン後のMy eSIM（QR・利用量・未使用キャンセル）。" },
      { q: "購入の流れ", a: "①プラン選択 ②チェックアウト（メール必須・電話任意） ③規約同意 ④決済 ⑤発行後メールとMy eSIMでQR/手動コード。" },
      { q: "購入にサインイン必要？", a: "不要。ゲスト購入（メール）可。My eSIMはGoogle/Apple/メールでサインイン。" },
      { q: "My eSIMとサインイン", a: "チェックアウトと同じメールでサインインすると注文・QR・利用量を表示。未サインイン時はQRメールを使用。" },
      { q: "QRはいつ届く？", a: "決済成功・発行完了後、通常数分以内。チェックアウトメール宛。My eSIMはDelivered後に同内容。" },
      { q: "料金表示", a: "カタログ価格×1.05を各言語の通貨で表示（為替は約12時間ごとに更新）。" },
      { q: "クーポン", a: "simplyurでは利用不可。" },
      { q: "利用開始時期", a: "多くは韓国で初回ネットワーク接続時から。" },
      { q: "仁川空港でインストール", a: "可能。空港Wi‑FiでQRメールを開いて設定から追加。" },
      { q: "ローミング vs 現地回線", a: "Phase 1は韓国内のみ。ローミングはデータローミングONが必要なことが多い。" },
      { q: "データローミング", a: "ローミングプランは通常ON。現地回線はOFFでも可な場合あり。" },
      { q: "自国SIM通話＋simplyurデータ", a: "デュアルSIMで可能。" },
      { q: "端末変更", a: "他端末へ移行不可。" },
      { q: "インストール失敗", a: "再起動・Wi‑Fi・通話終了後再試行。bongtour24@naver.com" },
      { q: "韓国でデータ不可", a: "回線ON、データ回線設定、機内モード、ローミング確認。" },
      { q: "韓国外利用", a: "Phase 1は韓国内専用。" },
      { q: "返金・サポート", a: "未使用は規約内返金可。bongtour24@naver.com KST 09–18時。" }
    ],
    regionalFaq: [
      {
        q: "中国本土データを含むプラン（05コード）の開通ポリシー",
        a: "2026年6月17日 00:00（北京時間）より、中国本土データを含む05コード商品は中国本土内での初回開通不可。入国前に本土外で開通完了。香港・マカオ・台湾は本土外。入国72時間以内の装着、本土外での初回インストール、電源ON後3〜5分以上のネットワーク接続が必要。将来の多国間プラン向け案内であり、現在の韓国専用simplyur商品には適用されません。"
      }
    ]
  },
  zh: {
    title: "如何安装 eSIM",
    intro: "本指南与 simplyur 网站/应用的实际流程一致。可选套餐、应用内结账、安装，以及登录后的 My eSIM。",
    flowPhaseNote: "现已开放：韩国套餐浏览、应用内结账、安装指南、登录后的 My eSIM（二维码与用量）。",
    tabs: { precheck: "安装前", iphone: "iPhone", android: "Android" },
    stepsTitle: "安装步骤",
    faqTitle: "常见问题 — 韩国 eSIM",
    regionalFaqTitle: "地区政策说明（未来多国套餐）",
    regionalFaqNote: "simplyur Phase 1 仅售韩国 eSIM。以下为未来多国套餐预留说明，不适用于当前韩国专用产品。",
    supportHint: "咨询：bongtour24@naver.com（KST 09:00–18:00）",
    quickSteps: [
      "确认手机支持 eSIM 且已解锁。",
      "在稳定 Wi‑Fi 下安装。",
      "打开 simplyur 邮件（或登录后 My eSIM）中的 QR 码。",
      "在设置中添加 eSIM — 扫描二维码或手动输入。",
      "抵达韩国后开启 simplyur 线路并设为移动数据。"
    ],
    precheckBlocks: [
      { heading: "1. 设备兼容性", paras: ["手机须支持 eSIM 且已解锁。请查看菜单中的兼容设备。"], bullets: ["iPhone XS 及更新机型", "Galaxy S20+、Pixel 3+ 等"] },
      { heading: "2. 使用稳定网络", paras: ["建议在酒店、机场等可信 Wi‑Fi 下安装。"], note: "失败请重启手机并换网络重试。" },
      { heading: "3. 何时安装", paras: ["多数韩国套餐可在出发前安装。使用期通常从在韩国首次连网时开始，请查看订单邮件。"] }
    ],
    precheckFaq: [
      { q: "可以在飞韩国前安装吗？", a: "多数韩国套餐可以。建议出发前安装，落地仁川等机场即可使用。" },
      { q: "手机需要解锁吗？", a: "需要。运营商锁定的手机无法添加 eSIM。" }
    ],
    iphoneSteps: [
      { title: "获取 eSIM", blocks: [{ bullets: ["选择韩国套餐 → 结账（邮箱必填，电话选填）", "支付并发行后打开 QR 邮件", "同一邮箱 Google 登录 → My eSIM（启用时）"], note: "请保留 QR 邮件至行程结束。" }] },
      {
        title: "安装 eSIM",
        blocks: [
          { bullets: ["通话中无法安装。", "保持 Wi‑Fi 或蜂窝数据连接。"] },
          { heading: "方式 A — 扫描二维码", paras: ["iPhone 无法扫描相册中的 QR，请在电脑、平板或同伴手机上显示。"], bullets: ["设置 → 蜂窝网络 → 添加 eSIM → 使用 QR 码。", "扫描 simplyur 邮件中的 QR。"] },
          { heading: "方式 B — 手动输入", bullets: ["设置 → 蜂窝网络 → 添加 eSIM → 手动输入详情。", "输入邮件中的 SM-DP+ 地址和激活码。"] }
        ]
      },
      { title: "在韩国激活", blocks: [{ bullets: ["设置 → 蜂窝网络。", "开启 simplyur 线路。", "设为蜂窝数据线路。", "按需开启数据漫游。"], note: "若无网络可开关飞行模式或手动选运营商。" }] },
      { title: "行程结束后删除", blocks: [{ note: "行程完全结束后再删除。有问题请先联系客服。", bullets: ["设置 → 蜂窝网络 → 删除蜂窝号码方案。"] }] }
    ],
    androidSteps: [
      { title: "获取 eSIM", blocks: [{ bullets: ["选套餐 → 邮箱必填结账", "支付发行后查收 QR 邮件", "同邮箱 Google 登录 → My eSIM"] }] },
      {
        title: "安装 eSIM",
        blocks: [
          { bullets: ["结束通话后安装。", "连接 Wi‑Fi 或移动数据。"] },
          { heading: "方式 A — QR", bullets: ["设置 → 连接 → SIM 管理器 → 添加 eSIM → 扫描。"] },
          { heading: "方式 B — 手动", paras: ["扫描失败时手动输入激活码。"] },
          { note: "三星、Pixel 等菜单名称可能不同。" }
        ]
      },
      { title: "在韩国激活", blocks: [{ bullets: ["启用 simplyur eSIM。", "设为默认移动数据。", "按需开启漫游。"] }] },
      { title: "行程后删除", blocks: [{ bullets: ["设置 → SIM 管理器 → 删除。"] }] }
    ],
    commonFaq: [
      { q: "simplyur 现在能做什么？", a: "浏览韩国 eSIM、应用内结账、多语言价格、本指南，以及登录后的 My eSIM（二维码、用量、未使用退款）。" },
      { q: "购买流程", a: "①选套餐 ②结账（邮箱必填、电话选填）③同意条款 ④支付 ⑤发行后邮件与 My eSIM 收 QR/手动码。" },
      { q: "购买需要登录吗？", a: "不需要。可用游客邮箱结账。My eSIM 支持 Google / Apple / 邮箱登录。" },
      { q: "My eSIM 与登录", a: "用结账时相同的邮箱登录即可查看订单与二维码。未登录请使用 QR 邮件。" },
      { q: "何时收到 QR？", a: "支付成功且发行完成后，通常数分钟内发至结账邮箱。My eSIM 在 Delivered 后显示。" },
      { q: "价格如何显示？", a: "目录价×1.05，按所选语言换算货币（汇率约每12小时更新）。" },
      { q: "优惠券？", a: "simplyur 不支持。" },
      { q: "套餐何时开始？", a: "多在韩国首次连网时开始。" },
      { q: "仁川机场安装？", a: "可以，用机场 Wi‑Fi 打开 QR 邮件安装。" },
      { q: "漫游 vs 本地网", a: "Phase 1 仅韩国。漫游常需开数据漫游。" },
      { q: "数据漫游", a: "漫游套餐通常需开启。" },
      { q: "保留本国 SIM 通话", a: "双卡手机可以。" },
      { q: "换手机", a: "不可转移到其他设备。" },
      { q: "安装失败", a: "重启、换 Wi‑Fi、结束通话后重试。联系 bongtour24@naver.com。" },
      { q: "在韩国无网络", a: "确认线路开启、设为移动数据、开关飞行模式、按需开漫游。" },
      { q: "韩国外能用吗？", a: "Phase 1 仅韩国境内。" },
      { q: "退款与客服", a: "未使用可按条款退款。bongtour24@naver.com KST 09–18。" }
    ],
    regionalFaq: [
      {
        q: "含中国大陆数据的套餐（05 代码）开通政策",
        a: "自 2026 年 6 月 17 日 00:00（北京时间）起，含中国大陆数据的 05 代码产品无法在中国大陆境内首次激活。须入境前于境外完成。港澳台视为境外。须入境前 72 小时内插入、境外首次安装、开机后保持网络 3–5 分钟。此为未来多国套餐预留说明，不适用于当前韩国专用 simplyur 产品。"
      }
    ]
  },
  "zh-TW": {
    title: "如何安裝 eSIM",
    intro: "本指南符合 simplyur 網站/應用實際流程。可選方案、應用內結帳、安裝，以及登入後的 My eSIM。",
    flowPhaseNote: "現已開放：韓國方案瀏覽、應用內結帳、安裝指南、登入後的 My eSIM（QR 與用量）。",
    tabs: { precheck: "安裝前", iphone: "iPhone", android: "Android" },
    stepsTitle: "安裝步驟",
    faqTitle: "常見問題 — 韓國 eSIM",
    regionalFaqTitle: "地區政策說明（未來多國方案）",
    regionalFaqNote: "simplyur Phase 1 僅售韓國 eSIM。以下為未來多國方案預留說明，不適用於目前韓國專用商品。",
    supportHint: "諮詢：bongtour24@naver.com（KST 09:00–18:00）",
    quickSteps: [
      "確認手機支援 eSIM 且已解鎖。",
      "在穩定 Wi‑Fi 下安裝。",
      "開啟 simplyur 郵件（或登入後 My eSIM）中的 QR 碼。",
      "在設定中新增 eSIM。",
      "抵達韓國後開啟 simplyur 線路並設為行動數據。"
    ],
    precheckBlocks: [
      { heading: "1. 裝置相容性", paras: ["手機須支援 eSIM 且已解鎖。"], bullets: ["iPhone XS 及更新機型", "Galaxy S20+、Pixel 3+ 等"] },
      { heading: "2. 穩定網路", paras: ["建議在可信 Wi‑Fi 下安裝。"], note: "失敗請重開機並換網路。" },
      { heading: "3. 何時安裝", paras: ["多數韓國方案可出發前安裝。使用期通常自韓國首次連網起算。"] }
    ],
    precheckFaq: [
      { q: "可在出發前安裝嗎？", a: "多數韓國方案可以。建議出發前安裝，抵達仁川機場即可使用。" },
      { q: "手機需要解鎖嗎？", a: "需要。電信鎖定手機無法新增 eSIM。" }
    ],
    iphoneSteps: [
      { title: "取得 eSIM", blocks: [{ bullets: ["選擇韓國方案 → 結帳（Email 必填）", "付款發行後開啟 QR 郵件", "同 Email 之 Google 登入 → My eSIM"] }] },
      { title: "安裝", blocks: [{ heading: "QR 掃描", bullets: ["設定 → 行動服務 → 加入 eSIM → 使用 QR 碼。"] }, { heading: "手動", bullets: ["輸入 SM-DP+ 與啟用碼。"] }] },
      { title: "在韓國啟用", blocks: [{ bullets: ["開啟 simplyur 線路。", "設為行動數據。", "必要時開啟數據漫遊。"] }] },
      { title: "刪除", blocks: [{ bullets: ["設定 → 行動服務 → 移除方案。"] }] }
    ],
    androidSteps: [
      { title: "取得 eSIM", blocks: [{ bullets: ["選方案 → Email 必填結帳", "付款發行後開 QR 郵件", "同 Email Google 登入 → My eSIM"] }] },
      { title: "安裝", blocks: [{ bullets: ["設定 → 連線 → SIM 管理工具 → 新增 eSIM。"] }] },
      { title: "啟用", blocks: [{ bullets: ["設為預設行動數據。"] }] },
      { title: "刪除", blocks: [{ bullets: ["SIM 管理工具 → 刪除。"] }] }
    ],
    commonFaq: [
      { q: "simplyur 現在能做什麼？", a: "瀏覽韓國 eSIM、應用內結帳、價格、安裝指南，以及登入後的 My eSIM（QR、用量、未使用退款）。" },
      { q: "購買流程", a: "選方案 → Email 必填 → 同意條款 → 付款 → 郵件與 My eSIM 收 QR。" },
      { q: "購買需登入？", a: "否。可用訪客 Email 結帳。My eSIM 支援 Google / Apple / 信箱登入。" },
      { q: "My eSIM", a: "用結帳相同 Email 登入即可查看訂單與 QR。未登入請用 QR 郵件。" },
      { q: "QR 何時收到？", a: "付款成功且發行後，通常數分鐘內。" },
      { q: "價格", a: "目錄價×1.05，依語言顯示幣別（匯率約每12小時更新）。優惠券不支援。" },
      { q: "方案開始/仁川安裝/漫遊", a: "多在韓國首次連網開始；可在仁川機場 Wi‑Fi 安裝；漫遊方案常需開數據漫遊。" },
      { q: "換手機/韓國外", a: "不可轉移；Phase 1 僅韓國。" },
      { q: "退款/客服", a: "bongtour24@naver.com KST 09–18。" }
    ],
    regionalFaq: [
      {
        q: "含中國大陸數據方案（05 代碼）開通政策",
        a: "自 2026/6/17 00:00（北京時間）起，含中國大陸數據的 05 代碼商品無法在中國大陸境內首次開通。須入境前於境外完成。港澳台視為境外。此為未來多國方案預留，不適用目前韓國專用 simplyur 商品。"
      }
    ]
  },
  vi: {
    title: "Cách cài eSIM",
    intro: "Hướng dẫn theo đúng luồng simplyur trên web/app. Chọn gói, thanh toán trong app, cài đặt, và My eSIM sau khi đăng nhập.",
    flowPhaseNote: "Đang có: xem gói Hàn Quốc, checkout trong app, hướng dẫn cài, My eSIM sau đăng nhập (QR + dung lượng).",
    tabs: { precheck: "Trước khi cài", iphone: "iPhone", android: "Android" },
    stepsTitle: "Các bước cài đặt",
    faqTitle: "Câu hỏi thường gặp — eSIM Hàn Quốc",
    regionalFaqTitle: "Thông báo theo khu vực (gói đa quốc gia tương lai)",
    regionalFaqNote: "simplyur Phase 1 chỉ bán eSIM Hàn Quốc. Nội dung dưới đây dành cho gói đa quốc gia sau này — không áp dụng sản phẩm Hàn Quốc hiện tại.",
    supportHint: "Hỗ trợ: bongtour24@naver.com (KST 09:00–18:00)",
    quickSteps: [
      "Xác nhận điện thoại hỗ trợ eSIM và đã mở khóa mạng.",
      "Kết nối Wi‑Fi ổn định trước khi cài.",
      "Mở QR từ email simplyur (hoặc My eSIM sau khi đăng nhập).",
      "Thêm eSIM trong Cài đặt — quét QR hoặc nhập mã thủ công.",
      "Khi đến Hàn Quốc, bật line simplyur và đặt làm dữ liệu di động."
    ],
    precheckBlocks: [
      { heading: "1. Tương thích thiết bị", paras: ["Điện thoại phải hỗ trợ eSIM và mở khóa."], bullets: ["iPhone XS trở lên", "Galaxy S20+, Pixel 3+"] },
      { heading: "2. Mạng ổn định", paras: ["Cài trên Wi‑Fi tin cậy (khách sạn, sân bay)."], note: "Thử khởi động lại nếu thất bại." },
      { heading: "3. Thời điểm cài", paras: ["Hầu hết gói Hàn có thể cài trước khi bay. Thời hạn dùng thường bắt đầu khi kết nối mạng tại Hàn."] }
    ],
    precheckFaq: [
      { q: "Cài trước khi bay được không?", a: "Hầu hết gói Hàn Quốc được. Nên cài trước để dùng ngay khi hạ cánh sân bay Incheon." },
      { q: "Cần mở khóa mạng?", a: "Có. Điện thoại khóa mạng không thêm được eSIM." }
    ],
    iphoneSteps: [
      { title: "Nhận eSIM", blocks: [{ bullets: ["Chọn gói Hàn Quốc → Checkout (email bắt buộc)", "Sau thanh toán & phát hành — mở email QR", "Cùng email + Google → My eSIM (khi bật)"] }] },
      {
        title: "Cài eSIM",
        blocks: [
          { bullets: ["Không cài khi đang gọi.", "Giữ Wi‑Fi hoặc dữ liệu di động."] },
          { heading: "Cách A — QR", paras: ["iPhone không quét QR trong Ảnh. Hiển thị trên màn hình khác."], bullets: ["Cài đặt → Di động → Thêm eSIM → Dùng mã QR."] },
          { heading: "Cách B — Thủ công", bullets: ["Nhập SM-DP+ và mã kích hoạt từ email."] }
        ]
      },
      { title: "Kích hoạt tại Hàn Quốc", blocks: [{ bullets: ["Bật line simplyur.", "Đặt làm dữ liệu di động.", "Bật chuyển vùng dữ liệu nếu cần."] }] },
      { title: "Gỡ sau chuyến đi", blocks: [{ bullets: ["Cài đặt → Di động → Gỡ gói cước."] }] }
    ],
    androidSteps: [
      { title: "Nhận eSIM", blocks: [{ bullets: ["Chọn gói → email bắt buộc", "Mở email QR sau thanh toán", "Google cùng email → My eSIM"] }] },
      { title: "Cài", blocks: [{ bullets: ["Cài đặt → Kết nối → Quản lý SIM → Thêm eSIM."] }] },
      { title: "Kích hoạt", blocks: [{ bullets: ["Bật eSIM simplyur.", "Đặt làm dữ liệu mặc định."] }] },
      { title: "Gỡ", blocks: [{ bullets: ["Quản lý SIM → Xóa."] }] }
    ],
    commonFaq: [
      { q: "simplyur hiện làm được gì?", a: "Xem gói eSIM Hàn Quốc, checkout trong app, giá đa ngôn ngữ, hướng dẫn cài, và My eSIM sau đăng nhập (QR, dung lượng, hoàn tiền chưa dùng)." },
      { q: "Luồng mua", a: "Chọn gói → email bắt buộc, SĐT tùy chọn → đồng ý điều khoản → thanh toán → nhận QR qua email và My eSIM." },
      { q: "Cần đăng nhập để mua?", a: "Không. Có thể mua bằng email khách. My eSIM hỗ trợ Google / Apple / email." },
      { q: "My eSIM", a: "Đăng nhập bằng cùng email checkout để xem đơn và QR. Chưa đăng nhập thì dùng email QR." }
      { q: "QR khi nào?", a: "Sau thanh toán thành công & phát hành — thường vài phút." },
      { q: "Giá", a: "Giá catalog ×1.05, quy đổi theo ngôn ngữ (tỷ giá cập nhật ~12 giờ). Không coupon." },
      { q: "Bắt đầu gói / Incheon / roaming", a: "Thường khi kết nối mạng tại Hàn; cài tại sân bay Incheon được; gói roaming thường cần bật chuyển vùng." },
      { q: "Đổi máy / ngoài Hàn", a: "Không chuyển profile; Phase 1 chỉ Hàn Quốc." },
      { q: "Hoàn tiền / hỗ trợ", a: "bongtour24@naver.com KST 09–18." }
    ],
    regionalFaq: [
      {
        q: "Chính sách kích hoạt — gói có dữ liệu Trung Quốc đại lục (mã 05)",
        a: "Từ 17/6/2026 00:00 (giờ Bắc Kinh): sản phẩm mã 05 có dữ liệu đại lục Trung Quốc không thể kích hoạt lần đầu trong đại lục. Phải kích hoạt bên ngoài trước khi nhập cảnh. HK, Ma Cao, Đài Loan được coi là ngoài đại lục. Thông báo dành cho gói đa quốc gia tương lai — không áp dụng eSIM Hàn Quốc simplyur hiện tại."
      }
    ]
  }
};

export function getSimplyurGuideMessages(locale: SimplyurLocale): SimplyurGuideMessages {
  if (locale === 'en') return GUIDE_EN_HANDOFF;
  return GUIDE_BY_LOCALE[locale] ?? GUIDE_EN_HANDOFF;
}
