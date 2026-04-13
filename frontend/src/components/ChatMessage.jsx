import ReactMarkdown from "react-markdown";
import { AIAvatar } from "../App";

export default function ChatMessage({ role, content, senderName, createdAt }) {
  const isUser = role === "user";
  const isError = role === "error";
  const isHuman = role === "human";
  const isSystem = role === "system";

  if (isUser) {
    return (
      <div className="flex justify-end msg-enter">
        <div className="max-w-[78%] bg-gradient-to-br from-violet-600 to-violet-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-lg shadow-violet-900/20">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 msg-enter">
      {isError ? (
        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0 text-xs font-bold text-white">
          !
        </div>
      ) : isHuman ? (
        <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-950">
          HM
        </div>
      ) : isSystem ? (
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-emerald-200">
          SYS
        </div>
      ) : (
        <AIAvatar />
      )}

      <div
        className={`max-w-[82%] rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm leading-relaxed ${
          isError
            ? "bg-red-950/60 text-red-300 border border-red-800/60"
            : isHuman
            ? "bg-cyan-950/30 text-cyan-50 border border-cyan-800/40 shadow-sm"
            : isSystem
            ? "bg-emerald-950/30 text-emerald-100 border border-emerald-800/30 shadow-sm"
            : "bg-gray-800/80 text-gray-100 border border-gray-700/40 shadow-sm"
        }`}
      >
        {(senderName || createdAt) && (
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-gray-500">
            {senderName && <span>{senderName}</span>}
            {createdAt && <span>{new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        )}
        {isError ? content : <MarkdownContent content={content} />}
      </div>
    </div>
  );
}

function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-white mt-3 mb-1.5 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-white mt-3 mb-1 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-gray-100 mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => <p className="mb-2 last:mb-0 text-gray-200">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 mb-2 ml-1 text-gray-200">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-2 ml-1 text-gray-200">{children}</ol>
        ),
        li: ({ children }) => <li className="text-gray-200">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
          >
            {children}
          </a>
        ),
        // react-markdown v10: pre handles code block wrapper; code handles both inline + block content
        pre: ({ children }) => (
          <pre className="bg-gray-900/90 border border-gray-700/50 rounded-xl px-4 py-3.5 overflow-x-auto text-xs text-gray-200 font-mono my-3">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          // Code blocks come with a language-* className; inline code does not
          if (className) {
            return <code className={`${className} text-gray-200`}>{children}</code>;
          }
          return (
            <code className="bg-gray-900/70 text-violet-300 rounded-md px-1.5 py-0.5 text-[0.8em] font-mono border border-gray-700/40">
              {children}
            </code>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-violet-500/60 pl-3 italic text-gray-400 my-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-gray-700/50 my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
