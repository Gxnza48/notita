import type { JSONContent } from "@tiptap/core";
import type { MarkerInput } from "./types";

export interface DocAnalysis {
  contentText: string;
  conceptCount: number;
  tasks: MarkerInput[];
  questions: MarkerInput[];
  important: MarkerInput[];
}

function nodeText(node: JSONContent): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(nodeText).join("");
}

export function analyzeDoc(doc: JSONContent): DocAnalysis {
  const tasks: MarkerInput[] = [];
  const questions: MarkerInput[] = [];
  const important: MarkerInput[] = [];
  const textParts: string[] = [];
  let conceptCount = 0;

  function walk(node: JSONContent) {
    if (node.type === "heading") {
      const text = nodeText(node).trim();
      if (text) conceptCount += 1;
    }

    if (node.type === "paragraph" && node.attrs?.markerType) {
      const text = nodeText(node).trim();
      if (text) {
        const entry: MarkerInput = { text, done: false };
        if (node.attrs.markerType === "important") important.push(entry);
        else if (node.attrs.markerType === "question") questions.push(entry);
        else if (node.attrs.markerType === "task") tasks.push(entry);
      }
    }

    const text = nodeText(node);
    if (node.type && !node.content && text) {
      textParts.push(text);
    }

    if (node.content) {
      for (const child of node.content) walk(child);
      if (["paragraph", "heading", "listItem", "taskItem", "codeBlock", "blockquote"].includes(node.type ?? "")) {
        textParts.push("\n");
      }
    }
  }

  walk(doc);

  return {
    contentText: textParts.join(" ").replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim(),
    conceptCount,
    tasks,
    questions,
    important,
  };
}
