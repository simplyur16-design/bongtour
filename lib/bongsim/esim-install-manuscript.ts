export type EsimInstallBlock =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "img"; alt: string; src: string }
  | { kind: "small"; text: string };

function cells(line: string): string[] {
  const parts = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return parts.map((cell) => cell.trim());
}

function isRule(line: string): boolean {
  return /^\|?\s*:?-{3,}/.test(line.trim());
}

/** 원고 마크다운의 제목·표·목록·그림 순서를 유지한다. */
export function parseEsimInstallManuscript(markdown: string): EsimInstallBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: EsimInstallBlock[] = [];
  let i = 0;

  const pushParagraph = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) blocks.push({ kind: "p", text: trimmed });
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") {
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      blocks.push({ kind: "h", level: heading[1]!.length as 1 | 2 | 3, text: heading[2]!.trim() });
      i += 1;
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (image) {
      blocks.push({ kind: "img", alt: image[1] ?? "", src: image[2] ?? "" });
      i += 1;
      continue;
    }

    const small = /^<small>([\s\S]*)<\/small>$/.exec(trimmed);
    if (small) {
      blocks.push({ kind: "small", text: small[1] ?? "" });
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quotes: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        quotes.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", text: quotes.join(" ").trim() });
      continue;
    }

    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        tableLines.push((lines[i] ?? "").trim());
        i += 1;
      }
      const body = tableLines.filter((row) => !isRule(row));
      const header = cells(body[0] ?? "");
      const rows = body.slice(1).map(cells);
      blocks.push({ kind: "table", header, rows });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    const para: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = (lines[i] ?? "").trim();
      if (
        !next ||
        next === "---" ||
        /^(#{1,3})\s+/.test(next) ||
        next.startsWith("|") ||
        next.startsWith(">") ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        next.startsWith("![") ||
        next.startsWith("<small>")
      ) {
        break;
      }
      para.push(next);
      i += 1;
    }
    pushParagraph(para.join(" "));
  }

  return blocks;
}

export function esimInstallHeadings(markdown: string): string[] {
  return parseEsimInstallManuscript(markdown)
    .filter((block): block is Extract<EsimInstallBlock, { kind: "h" }> => block.kind === "h")
    .map((block) => block.text);
}

/**
 * 공개 페이지용 원고. 순서·표·문구는 유지하고,
 * 카카오 상담 행·24시간 문장·PDF·확인 필요 표시는 빼거나 상품 페이지 안내로 바꾼다.
 */
export function publishEsimInstallManuscript(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (
      line.includes("_fqTkK") ||
      line.includes("_xlxjrxlX") ||
      line.includes("pf.kakao.com") ||
      /\.pdf\b/i.test(line)
    ) {
      continue;
    }
    if (line.trim().startsWith("|") && line.includes("카카오톡")) continue;
    let next = line.replace(/ ?카카오톡 상담은 \*\*24시간 연중무휴\*\*입니다\./g, "");
    if (next.includes("확인 필요")) {
      if (/^#{1,3}\s+/.test(next.trim())) continue;
      if (next.trim().startsWith("|")) {
        next = next
          .split("|")
          .map((cell) => (cell.includes("확인 필요") ? " 상품 페이지 안내를 따르세요 " : cell))
          .join("|");
      } else {
        next = "상품 페이지 안내를 따르세요";
      }
    }
    out.push(next);
  }
  return out.join("\n").replace(/\]\(img\//g, "](/travel/esim/guide/");
}

export function esimInstallPlainText(markdown: string): string {
  return parseEsimInstallManuscript(markdown)
    .map((block) => {
      if (block.kind === "h" || block.kind === "p" || block.kind === "quote" || block.kind === "small") return block.text;
      if (block.kind === "img") return `${block.alt} ${block.src}`;
      if (block.kind === "ul" || block.kind === "ol") return block.items.join("\n");
      return [block.header.join(" | "), ...block.rows.map((row) => row.join(" | "))].join("\n");
    })
    .join("\n");
}
