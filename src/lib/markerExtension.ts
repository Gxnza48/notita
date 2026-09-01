import Paragraph from "@tiptap/extension-paragraph";
import { InputRule } from "@tiptap/core";

export type MarkerType = "important" | "question" | "task";

const GLYPH: Record<MarkerType, string> = {
  important: "!",
  question: "?",
  task: "→",
};

export const MarkerParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      markerType: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-marker-type"),
        renderHTML: (attrs: { markerType?: MarkerType | null }) => {
          if (!attrs.markerType) return {};
          return {
            "data-marker-type": attrs.markerType,
            "data-marker-glyph": GLYPH[attrs.markerType],
          };
        },
      },
    };
  },

  addInputRules() {
    const makeRule = (find: RegExp, markerType: MarkerType) =>
      new InputRule({
        find,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).updateAttributes(this.name, { markerType }).run();
        },
      });

    return [
      makeRule(/^!\s$/, "important"),
      makeRule(/^\?\s$/, "question"),
      makeRule(/^(->|→)\s$/, "task"),
    ];
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Backspace: () => {
        const { selection } = this.editor.state;
        const { $from, empty } = selection;
        if (!empty || $from.parentOffset !== 0) return false;
        const attrs = $from.parent.attrs as { markerType?: MarkerType | null };
        if (!attrs.markerType) return false;
        return this.editor.commands.updateAttributes(this.name, { markerType: null });
      },
    };
  },
});
