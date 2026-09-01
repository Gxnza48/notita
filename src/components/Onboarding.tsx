import { useState } from "react";
import { useDataStore } from "../lib/dataStore";
import { useUiStore } from "../lib/uiStore";

export function Onboarding() {
  const createSubject = useDataStore((s) => s.createSubject);
  const createNote = useDataStore((s) => s.createNote);
  const setView = useUiStore((s) => s.setView);
  const setActiveNoteId = useUiStore((s) => s.setActiveNoteId);

  const [step, setStep] = useState<"intro" | "subject">("intro");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const subject = await createSubject(trimmed);
    const note = await createNote(subject.id);
    setView({ kind: "subject", subjectId: subject.id });
    setActiveNoteId(note.id);
  };

  return (
    <div className="onboarding">
      {step === "intro" ? (
        <div className="onboarding-card" key="intro">
          <div className="onboarding-brand">
            notita<span className="brand-dot">.</span>
          </div>
          <p className="onboarding-tagline">
            Your notes.
            <br />
            Your classes.
            <br />
            Your flow.
          </p>
          <button className="onboarding-cta" onClick={() => setStep("subject")}>
            Get started
          </button>
        </div>
      ) : (
        <div className="onboarding-card" key="subject">
          <div className="onboarding-step-title">What's your first class?</div>
          <input
            autoFocus
            className="onboarding-input"
            placeholder="e.g. Mathematics"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button className="onboarding-cta" onClick={handleCreate} disabled={!name.trim() || busy}>
            Start writing
          </button>
        </div>
      )}
    </div>
  );
}
