import { Mark } from "@tiptap/core";

/**
 * Marks the still-unconfirmed tail of a live dictation. Purely visual (see
 * `.voice-partial-text` in editor.css) — the mark is replaced with plain
 * text once the utterance is finalized by voiceBridge.
 */
export const VoicePartialMark = Mark.create({
  name: "voicePartial",
  inclusive: false,
  excludes: "",

  parseHTML() {
    return [{ tag: "span[data-voice-partial]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, "data-voice-partial": "true", class: "voice-partial-text" }, 0];
  },
});
