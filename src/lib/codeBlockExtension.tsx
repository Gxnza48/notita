import { useState } from "react";
import CodeBlock from "@tiptap/extension-code-block";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { CheckIcon, CopyIcon } from "../components/icons";

function CodeBlockView({ node }: NodeViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — nothing more we can do
    }
  };

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <button
        type="button"
        className={"code-block-copy" + (copied ? " copied" : "")}
        onClick={handleCopy}
        aria-label={copied ? "Copiado" : "Copiar código"}
        contentEditable={false}
      >
        {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
      </button>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlockWithCopy = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});
