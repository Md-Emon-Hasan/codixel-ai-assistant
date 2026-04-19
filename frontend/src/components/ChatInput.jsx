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
      className={`flex items-end gap-2 rounded-xl border px-4 py-3 transition-all duration-200 bg-white dark:bg-gray-800/80 ${
        overLimit
          ? "border-red-300 dark:border-red-500/60 focus-within:border-red-400 dark:focus-within:border-red-500"
          : "border-gray-200 dark:border-gray-700/60 focus-within:border-violet-400 dark:focus-within:border-violet-500/70 focus-within:ring-2 focus-within:ring-violet-400/10 dark:focus-within:ring-violet-500/10"
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
        className="flex-1 min-h-6 max-h-40 resize-none bg-transparent text-sm leading-relaxed outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 disabled:opacity-40"
      />

      <div className="flex shrink-0 items-center gap-2">
        {nearLimit && (
          <span className={`font-mono text-[11px] ${overLimit ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
            {remaining}
          </span>
        )}
        <button
          onClick={submit}
          disabled={!text.trim() || disabled || overLimit}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm shadow-violet-500/20 transition-all duration-150 hover:bg-violet-500 hover:shadow-md hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
