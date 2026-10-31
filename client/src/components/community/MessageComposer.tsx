import { useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { preparePostPhoto, type NoteDraft } from "@/lib/community-store";
import { CloseIcon, PhotoIcon } from "./icons";

/**
 * The writing box under a conversation in Messages (and the small Messages window): suggested replies that send in
 * one click, a text area that grows a little, an image attachment and a Send button. Enter sends; Shift+Enter starts
 * a new line. `compact` is the small window's: no attachment, no hint.
 */
export default function MessageComposer({ label, placeholder, onSend, suggestions = [], compact = false }: {
  label: string;
  placeholder: string;
  onSend: (draft: NoteDraft) => void;
  suggestions?: string[];
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const suggestionsId = useId();

  const submit = () => {
    const words = text.trim();
    if (!words && !photo) { field.current?.focus(); return; }
    onSend({ text: words, photo });
    setText(""); setPhoto(null); setProblem("");
  };
  const onSubmit = (event: FormEvent) => { event.preventDefault(); submit(); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
  };
  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try { setPhoto(await preparePostPhoto(file)); setProblem(""); }
    catch (error) { setProblem(error instanceof Error ? error.message : "This image couldn't be added."); }
  };

  return (
    <form className={`cm-dm-compose ${compact ? "is-compact" : ""}`} onSubmit={onSubmit}>
      {suggestions.length > 0 && (
        <div className="cm-dm-quick" role="group" aria-labelledby={suggestionsId}>
          <span id={suggestionsId} className="cm-sr">Suggested replies</span>
          {suggestions.map(words => <button key={words} type="button" className="cm-dm-chip" onClick={() => onSend({ text: words })}>{words}</button>)}
        </div>
      )}
      <div className="cm-dm-box">
        {photo && (
          <div className="cm-dm-attached">
            <img src={photo} alt="The image you chose" />
            <button type="button" className="cm-dm-icon" aria-label="Remove the image" onClick={() => setPhoto(null)}><CloseIcon size={14} /></button>
          </div>
        )}
        <label className="cm-dm-field">
          <span className="cm-sr">{label}</span>
          <textarea ref={field} rows={compact ? 1 : 2} value={text} maxLength={1000} placeholder={placeholder} autoComplete="off"
            onChange={event => { setText(event.target.value); setProblem(""); }} onKeyDown={onKeyDown} />
        </label>
        <div className="cm-dm-tools">
          {!compact && (
            <>
              <button type="button" className="cm-dm-icon" aria-label="Attach an image" onClick={() => picker.current?.click()}><PhotoIcon size={18} /></button>
              <input ref={picker} className="cm-sr" type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-hidden="true" onChange={choose} />
            </>
          )}
          <button type="submit" className="cx-btn cx-btn-primary cm-dm-send">Send</button>
        </div>
      </div>
      {problem && <p className="cm-dm-problem" role="alert">{problem}</p>}
    </form>
  );
}
