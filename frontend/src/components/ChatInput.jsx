import { useState, useRef, useEffect } from "react";

const MAX_CHARS = 2000;

export default function ChatInput({ onSend, disabled, placeholder = "Message Codixel AI..." }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [text]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled || trimmed.length > MAX_CHARS) return;
    onSend(trimmed);
    setText("");
  }

  const remaining = MAX_CHARS - text.length;
  const nearLimit = remaining < 200;
  const overLimit = remaining < 0;

  return (
    <div
      className={`flex items-end gap-2 bg-gray-800/80 border rounded-2xl px-4 py-3 transition-all duration-200 ${
        overLimit
          ? "border-red-500/60 focus-within:border-red-500"
          : "border-gray-700/60 focus-within:border-violet-500/70"
      }`}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 resize-none outline-none leading-relaxed min-h-[24px] max-h-[160px] disabled:opacity-40"
      />

      <div className="flex items-center gap-2 shrink-0">
        {nearLimit && (
          <span className={`text-[11px] font-mono ${overLimit ? "text-red-400" : "text-gray-500"}`}>
            {remaining}
          </span>
        )}
        <button
          onClick={submit}
          disabled={!text.trim() || disabled || overLimit}
          className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-600 text-white flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-sm shadow-violet-900/20"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
