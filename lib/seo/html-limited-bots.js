/**
 * Next 15 `htmlLimitedBots` — 이 UA 에는 metadata(title·canonical·og·robots)를 스트리밍하지 않고 <head>에 바로 넣는다.
 * Next 기본 목록에는 `Googlebot`(단독)·`bingbot`(소문자)·`Daum`·`NaverBot` 이 빠져 있어,
 * 구글 원본 HTML 에서 rel=canonical 이 <body> 로 내려가 "사용자가 선택한 표준 없는 중복"이 생겼다.
 * REGRESSION-FREEZE[seo-html-limited-bots-googlebot]: Googlebot 계열은 head 메타 — next.config.js htmlLimitedBots
 * CommonJS — next.config.js(require) 와 vitest 가 같이 쓴다.
 */
const NEXT_DEFAULT_HTML_LIMITED_BOTS_SOURCE =
  '[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight'

/** 검색·AI 크롤러 추가분 (대소문자 무시) */
const SEO_EXTRA_HTML_LIMITED_BOTS_SOURCE =
  'Googlebot|Storebot-Google|AdsBot-Google|Mediapartners-Google|GoogleOther|bingbot|msnbot|NaverBot|Daum|Daumoa|DuckAssistBot|Applebot|GPTBot|OAI-SearchBot|ChatGPT-User|PerplexityBot|ClaudeBot|Claude-SearchBot|CCBot|Amazonbot|Bytespider|SeznamBot|PetalBot'

const SEO_HTML_LIMITED_BOTS = new RegExp(
  `${NEXT_DEFAULT_HTML_LIMITED_BOTS_SOURCE}|${SEO_EXTRA_HTML_LIMITED_BOTS_SOURCE}`,
  'i',
)

module.exports = { SEO_HTML_LIMITED_BOTS, NEXT_DEFAULT_HTML_LIMITED_BOTS_SOURCE }
