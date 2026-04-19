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
        <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-linear-to-br from-violet-600 to-violet-700 px-4 py-3 text-sm leading-relaxed text-white shadow-md shadow-violet-500/20 dark:shadow-violet-900/30">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 msg-enter">
      {isError ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 dark:bg-red-600 text-xs font-bold text-white shadow-sm">
          !
        </div>
      ) : isHuman ? (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white shadow-sm"
          title={senderName || "Agent"}
        >
          {senderName ? senderName.trim()[0].toUpperCase() : "HM"}
        </div>
      ) : isSystem ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-400/20 bg-emerald-100 dark:bg-emerald-500/20 text-[9px] font-bold text-emerald-700 dark:text-emerald-200">
          SYS
        </div>
      ) : (
        <AIAvatar />
      )}

      <div
        className={`max-w-[82%] rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm leading-relaxed shadow-sm ${
          isError
            ? "border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300"
            : isHuman
            ? "border border-cyan-200 dark:border-cyan-800/40 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-900 dark:text-cyan-50"
            : isSystem
            ? "border border-emerald-200 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-100"
            : "border border-gray-200 dark:border-gray-700/40 bg-gray-100 dark:bg-gray-800/80 text-gray-800 dark:text-gray-100"
        }`}
      >
        {(senderName || createdAt) && (
          <div className="mb-2 flex items-center gap-2">
            {senderName && (
              <span
                className={`text-xs font-semibold ${
                  isHuman
                    ? "text-cyan-600 dark:text-cyan-300"
                    : isSystem
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {senderName}
              </span>
            )}
            {createdAt && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
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
          <h1 className="mb-1.5 mt-3 text-lg font-bold text-gray-900 dark:text-white first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-1 mt-3 text-base font-bold text-gray-900 dark:text-white first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 text-gray-700 dark:text-gray-200">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-600 dark:text-gray-300">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 ml-1 list-inside list-disc space-y-1 text-gray-700 dark:text-gray-200">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-1 list-inside list-decimal space-y-1 text-gray-700 dark:text-gray-200">{children}</ol>
        ),
        li: ({ children }) => <li className="text-gray-700 dark:text-gray-200">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 dark:text-violet-400 underline underline-offset-2 transition-colors hover:text-violet-700 dark:hover:text-violet-300"
          >
            {children}
          </a>
        ),
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/90 px-4 py-3.5 font-mono text-xs text-gray-800 dark:text-gray-200">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          if (className) {
            return <code className={`${className} text-gray-800 dark:text-gray-200`}>{children}</code>;
          }
          return (
            <code className="rounded-md border border-gray-200 dark:border-gray-700/40 bg-gray-100 dark:bg-gray-900/70 px-1.5 py-0.5 font-mono text-[0.8em] text-violet-600 dark:text-violet-300">
              {children}
            </code>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-violet-400 dark:border-violet-500/60 pl-3 italic text-gray-500 dark:text-gray-400">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-gray-200 dark:border-gray-700/50" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
