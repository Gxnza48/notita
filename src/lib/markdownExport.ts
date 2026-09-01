const MARKER_GLYPH: Record<string, string> = { important: "!", question: "?", task: "→" };

function inline(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map(inline).join("");
  switch (tag) {
    case "strong":
    case "b":
      return `**${children}**`;
    case "em":
    case "i":
      return `*${children}*`;
    case "code":
      return `\`${children}\``;
    case "a":
      return `[${children}](${el.getAttribute("href") ?? ""})`;
    case "br":
      return "\n";
    default:
      return children;
  }
}

function block(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const text = () => Array.from(el.childNodes).map(inline).join("").trim();

  switch (tag) {
    case "h1":
      return `# ${text()}`;
    case "h2":
      return `## ${text()}`;
    case "h3":
      return `### ${text()}`;
    case "p": {
      const marker = el.getAttribute("data-marker-type");
      const glyph = marker ? MARKER_GLYPH[marker] : "";
      return glyph ? `${glyph} ${text()}` : text();
    }
    case "blockquote":
      return `> ${text()}`;
    case "pre":
      return "```\n" + (el.textContent ?? "") + "\n```";
    case "ul":
      return Array.from(el.children)
        .map((li) => renderListItem(li, "-"))
        .join("\n");
    case "ol": {
      let i = 1;
      return Array.from(el.children)
        .map((li) => renderListItem(li, `${i++}.`))
        .join("\n");
    }
    default:
      return text();
  }
}

function renderListItem(li: Element, marker: string): string {
  const checkbox = li.querySelector('input[type="checkbox"]');
  const label = checkbox ? (checkbox.getAttribute("checked") !== null ? "[x]" : "[ ]") : null;
  const contentEl = li.querySelector("label")?.nextElementSibling ?? li;
  const text = Array.from(contentEl.childNodes).map(inline).join("").trim();
  return label ? `${marker} ${label} ${text}` : `${marker} ${text}`;
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: string[] = [];
  for (const child of Array.from(doc.body.children)) {
    blocks.push(block(child));
  }
  return blocks.filter((b) => b.length > 0).join("\n\n");
}
