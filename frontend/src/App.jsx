import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import { useChatStore } from "./store/chatStore";
import { useAdminStore } from "./store/adminStore";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const WS_BASE = API_BASE.replace(/^http/i, "ws");

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerApp />} />
      <Route path="/admin" element={<AdminRoute />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AdminRoute() {
  const agentName = useAdminStore((s) => s.agentName);
  return agentName ? <AdminApp /> : <Navigate to="/admin/login" replace />;
}

// ---------------------------------------------------------------------------
// Customer Chat
// ---------------------------------------------------------------------------

function CustomerApp() {
  const navigate = useNavigate();
  const {
    messages, conversation, contact, loading, booting,
    conversationHistory,
    setBooting, setLoading, setConversation, setContact,
    appendMessage, setMessages, clearConversation,
    addToHistory, updateHistoryItem, removeFromHistory,
  } = useChatStore();
  const bottomRef = useRef(null);

  useConversationSocket(conversation?.id, (payload) => {
    const currentId = conversation?.id;
    if (!currentId) return;
    if (payload.type === "message.created" && payload.message?.conversation_id === currentId) {
      appendMessage(payload.message);
    }
    if (payload.type === "conversation.updated" && payload.conversation?.id === currentId) {
      setConversation(payload.conversation);
      updateHistoryItem(payload.conversation);
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const savedId = conversation?.id;
    if (!savedId) { setBooting(false); return; }
    fetchConversation(savedId)
      .then((data) => { setConversation(data.conversation); setMessages(data.messages); })
      .catch(() => clearConversation())
      .finally(() => setBooting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text) {
    const tempMsg = createTempMessage("user", text, contact.guest_name || "You");
    appendMessage(tempMsg);
    setLoading(true);
    try {
      const data = await api("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          conversation_id: conversation?.id ?? null,
          ...contact,
        }),
      });
      setConversation(data.conversation);
      addToHistory(data.conversation, text);
      useChatStore.setState((state) => {
        const without = state.messages.filter((m) => m.id !== tempMsg.id);
        const withUser = data.user_message ? appendUnique(without, data.user_message) : without;
        return { messages: appendUnique(withUser, data.message) };
      });
    } catch (error) {
      appendMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadHistoryConversation(id) {
    if (conversation?.id === id) return;
    setBooting(true);
    try {
      const data = await fetchConversation(id);
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch {
      removeFromHistory(id);
    } finally {
      setBooting(false);
    }
  }

  async function revertToAi() {
    if (!conversation?.id) return;
    setLoading(true);
    try {
      const data = await api(`/chat/${conversation.id}/revert`, { method: "POST" });
      setConversation(data.conversation);
    } catch (error) {
      appendMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell
      title="Codixel AI Concierge"
      subtitle={conversationStatusLabel(conversation?.status)}
      accent="from-amber-400 via-orange-500 to-rose-500"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/login")}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white shadow-sm"
          >
            Admin
          </button>
          {conversation?.status === "assigned_to_agent" && (
            <button
              onClick={revertToAi}
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white shadow-sm"
            >
              Back to AI
            </button>
          )}
        </div>
      }
    >
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 lg:flex-row">
        {/* Main chat panel */}
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-[#0d1220]/95 shadow-lg shadow-black/5 dark:shadow-black/30">
          <StatusBanner conversation={conversation} />

          <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {booting ? (
                <TypingIndicator label="Restoring your conversation..." />
              ) : messages.length === 0 ? (
                <EmptyState onSuggestion={sendMessage} />
              ) : (
                messages.map((msg) => (
                  <ChatMessage
                    key={msg.id ?? `${msg.sender_type}-${msg.created_at}`}
                    role={msg.sender_type}
                    content={msg.content}
                    senderName={msg.sender_name}
                    createdAt={msg.created_at}
                  />
                ))
              )}
              {loading && <TypingIndicator label="Codixel AI is thinking..." />}
              <div ref={bottomRef} />
            </div>
          </main>

          <div className="border-t border-gray-100 dark:border-white/[0.06] bg-gray-50/80 dark:bg-black/20 px-4 py-4 sm:px-6">
            <ContactCard contact={contact} setContact={setContact} />
            <div className="mt-3">
              <ChatInput
                onSend={sendMessage}
                disabled={loading}
                placeholder={
                  conversation?.status === "assigned_to_agent"
                    ? "Reply to the Codixel team..."
                    : "Ask a question or say 'I want to talk to a person'..."
                }
              />
            </div>
          </div>
        </div>

        {/* Conversation history sidebar */}
        <aside className="flex w-full flex-col rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-gray-50 dark:bg-[#0a0e1a]/95 p-4 shadow-lg shadow-black/5 dark:shadow-black/20 lg:w-[280px]">
          <div className="flex items-center justify-between px-1 mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Conversations
            </h2>
            <button
              onClick={clearConversation}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-400/30 hover:text-amber-700 dark:hover:text-amber-300 shadow-sm"
              title="Start a new conversation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              New chat
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {conversationHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">Your past conversations will appear here.</p>
              </div>
            ) : (
              conversationHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadHistoryConversation(item.id)}
                  className={`group relative w-full rounded-xl border px-3.5 py-3 transition-all cursor-pointer ${
                    item.id === conversation?.id
                      ? "border-amber-300 dark:border-amber-400/40 bg-amber-50 dark:bg-amber-500/10"
                      : "border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.06] hover:border-gray-300 dark:hover:border-white/15"
                  }`}
                >
                  <p className={`truncate text-sm font-medium leading-snug ${
                    item.id === conversation?.id
                      ? "text-amber-800 dark:text-amber-100"
                      : "text-gray-800 dark:text-gray-100"
                  }`}>
                    {(item.title && item.title !== "New chat") ? item.title : (item.preview || "Chat")}
                  </p>
                  {item.preview && item.title && item.title !== "New chat" && item.preview !== item.title && (
                    <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{item.preview}</p>
                  )}
                  <p className={`mt-1.5 text-[11px] ${
                    item.id === conversation?.id
                      ? "text-amber-600 dark:text-amber-400/70"
                      : "text-gray-400 dark:text-gray-500"
                  }`}>
                    {formatDate(item.created_at)}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.id === conversation?.id) clearConversation();
                      removeFromHistory(item.id);
                    }}
                    title="Delete conversation"
                    className="absolute right-2.5 top-2.5 hidden rounded-lg p-1.5 text-gray-400 dark:text-gray-500 transition hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400 group-hover:flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Admin Login
// ---------------------------------------------------------------------------

function AdminLoginPage() {
  const navigate = useNavigate();
  const setAuth = useAdminStore((s) => s.setAuth);
  const agentName = useAdminStore((s) => s.agentName);
  const [name, setName] = useState("");

  useEffect(() => {
    if (agentName) navigate("/admin", { replace: true });
  }, [agentName, navigate]);

  function handleLogin(e) {
    e.preventDefault();
    if (name.trim()) {
      setAuth(name.trim());
      navigate("/admin", { replace: true });
    }
  }

  return (
    <Shell
      title="Codixel Admin Inbox"
      subtitle="Secure operator access"
      accent="from-sky-400 via-cyan-400 to-emerald-400"
      action={
        <button
          onClick={() => navigate("/")}
          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white shadow-sm"
        >
          Customer view
        </button>
      }
    >
      <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
        <form
          onSubmit={handleLogin}
          className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1220]/95 p-7 shadow-xl shadow-black/5 dark:shadow-black/30"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Sign in to Admin</h2>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Enter your display name to continue.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Display Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Emon"
                required
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition focus:border-cyan-500 dark:focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/10 dark:focus:ring-cyan-400/10"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-3 text-sm font-semibold text-gray-900 transition-all shadow-md shadow-cyan-500/20 hover:shadow-cyan-400/30"
            >
              Enter Dashboard
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Admin Dashboard
// ---------------------------------------------------------------------------

function AdminApp() {
  const navigate = useNavigate();
  const adminBottomRef = useRef(null);
  const {
    clearAuth,
    conversations, selectedId, selectedDetail, filter, agentName, loadingList,
    replying, setFilter, setLoadingList, setReplying, setAgentName,
    setConversations, setSelectedId, setSelectedDetail,
    updateSelectedMessages, updateConversationInList,
  } = useAdminStore();

  useConversationSocket(selectedId, (payload) => {
    if (!selectedDetail) return;
    if (payload.type === "message.created") updateSelectedMessages(payload.message);
    if (payload.type === "conversation.updated") updateConversationInList(payload.conversation);
  });

  useEffect(() => {
    adminBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedDetail?.messages]);

  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    if (!agentName) return;
    let cancelled = false;
    async function loadList() {
      setLoadingList(true);
      try {
        const data = await adminApi(`/admin/conversations?status=${filter}`);
        if (cancelled) return;
        setConversations(data.conversations);
        if (!selectedIdRef.current && data.conversations.length > 0) {
          setSelectedId(data.conversations[0].id);
        }
      } catch {
        if (!cancelled) setConversations([]);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    loadList();
    const interval = setInterval(loadList, 8000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentName, filter]);

  useEffect(() => {
    if (!selectedId) return;
    fetchConversation(selectedId)
      .then(setSelectedDetail)
      .catch(() => setSelectedDetail(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function acceptConversation() {
    if (!selectedId) return;
    try {
      const data = await adminApi(`/admin/conversations/${selectedId}/accept`, {
        method: "POST",
        body: JSON.stringify({ agent_name: agentName }),
      });
      const current = useAdminStore.getState().selectedDetail;
      setSelectedDetail({
        conversation: data.conversation,
        messages: appendUnique(current?.messages ?? [], data.message),
      });
      updateConversationInList(data.conversation);
    } catch (err) {
      console.error("Accept failed:", err.message);
    }
  }

  async function sendHumanReply(text) {
    if (!selectedId) return;
    setReplying(true);
    try {
      const data = await adminApi(`/admin/conversations/${selectedId}/reply`, {
        method: "POST",
        body: JSON.stringify({ agent_name: agentName, content: text }),
      });
      const current = useAdminStore.getState().selectedDetail;
      setSelectedDetail({
        conversation: data.conversation,
        messages: appendUnique(current?.messages ?? [], data.message),
      });
      updateConversationInList(data.conversation);
    } catch (err) {
      console.error("Reply failed:", err.message);
    } finally {
      setReplying(false);
    }
  }

  async function endHumanChat() {
    if (!selectedId) return;
    const data = await adminApi(`/admin/conversations/${selectedId}/revert`, { method: "POST" });
    setSelectedDetail({
      conversation: data.conversation,
      messages: appendUnique(selectedDetail?.messages ?? [], data.message),
    });
    updateConversationInList(data.conversation);
  }

  function logout() {
    clearAuth();
    navigate("/admin/login", { replace: true });
  }

  return (
    <Shell
      title="Codixel Admin Inbox"
      subtitle={`Logged in as ${agentName}`}
      accent="from-sky-400 via-cyan-400 to-emerald-400"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white shadow-sm"
          >
            Customer view
          </button>
          <button
            onClick={logout}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white shadow-sm"
          >
            Log out
          </button>
        </div>
      }
    >
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 gap-4 px-4 py-4">
        {/* Sidebar */}
        <aside className="flex w-[280px] shrink-0 flex-col rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-gray-50 dark:bg-[#0a0e1a]/95 p-4 shadow-lg shadow-black/5 dark:shadow-none">
          <div className="flex items-center justify-between gap-2 px-1 mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Inbox
            </h2>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-white outline-none cursor-pointer transition focus:border-cyan-400 dark:focus:border-cyan-400/60"
            >
              <option value="all">All</option>
              <option value="waiting_for_agent">Waiting</option>
              <option value="queued_for_business_hours">Queued</option>
              <option value="assigned_to_agent">Assigned</option>
            </select>
          </div>

          <div className="mb-3">
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition focus:border-cyan-400 dark:focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
              placeholder="Your display name"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {loadingList && (
              <p className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500">Refreshing...</p>
            )}
            {conversations.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
                  item.id === selectedId
                    ? "border-cyan-300 dark:border-cyan-400/40 bg-cyan-50 dark:bg-cyan-500/10"
                    : "border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.06] hover:border-gray-300 dark:hover:border-white/15"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium ${
                      item.id === selectedId ? "text-cyan-800 dark:text-cyan-100" : "text-gray-800 dark:text-gray-100"
                    }`}>
                      {item.guest_name || "Website visitor"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {conversationStatusLabel(item.status)}
                    </p>
                    {item.assigned_agent_name && (
                      <p className="mt-0.5 text-xs text-cyan-600 dark:text-cyan-400">
                        ↳ {item.assigned_agent_name}
                      </p>
                    )}
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">{formatDate(item.last_message_at)}</p>
              </button>
            ))}
            {!loadingList && conversations.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">No conversations for this filter.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main panel */}
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-[#0d1220]/95 shadow-lg shadow-black/5 dark:shadow-black/30">
          {!selectedDetail ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5">
                  <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/[0.06] px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {selectedDetail.conversation.guest_name || "Website visitor"}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {conversationStatusLabel(selectedDetail.conversation.status)}
                    {selectedDetail.conversation.assigned_agent_name && (
                      <span className="ml-2 text-cyan-600 dark:text-cyan-400">
                        · handled by {selectedDetail.conversation.assigned_agent_name}
                      </span>
                    )}
                  </p>
                </div>
                {selectedDetail.conversation.status !== "assigned_to_agent" && (
                  <button
                    onClick={acceptConversation}
                    className="rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-sm font-semibold text-gray-900 transition shadow-md shadow-cyan-500/20"
                  >
                    Accept chat
                  </button>
                )}
                {selectedDetail.conversation.status === "assigned_to_agent" && (
                  <button
                    onClick={endHumanChat}
                    className="rounded-xl bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white transition shadow-md shadow-red-500/20"
                  >
                    End Chat
                  </button>
                )}
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[1fr_260px]">
                <div className="min-h-0 overflow-y-auto px-6 py-5">
                  <div className="mx-auto flex max-w-3xl flex-col gap-4">
                    {selectedDetail.messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        role={msg.sender_type}
                        content={msg.content}
                        senderName={msg.sender_name}
                        createdAt={msg.created_at}
                      />
                    ))}
                    <div ref={adminBottomRef} />
                  </div>
                </div>

                <aside className="border-l border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-black/15 p-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    Customer details
                  </h3>
                  <dl className="mt-4 space-y-4">
                    <MetaRow label="Name" value={selectedDetail.conversation.guest_name || "—"} />
                    <MetaRow label="Email" value={selectedDetail.conversation.guest_email || "—"} />
                    <MetaRow label="Phone" value={selectedDetail.conversation.guest_phone || "—"} />
                    <MetaRow
                      label="Assigned to"
                      value={selectedDetail.conversation.assigned_agent_name || "Unassigned"}
                    />
                  </dl>
                </aside>
              </div>

              <div className="border-t border-gray-100 dark:border-white/[0.06] bg-gray-50/80 dark:bg-black/20 px-6 py-4">
                <AgentNameBar agentName={agentName} setAgentName={setAgentName} />
                <div className="mt-3">
                  <ChatInput
                    onSend={sendHumanReply}
                    disabled={replying}
                    placeholder={`Reply as ${agentName || "yourself"}...`}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Agent Name Bar
// ---------------------------------------------------------------------------

function AgentNameBar({ agentName, setAgentName }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(agentName);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const name = draft.trim();
    if (name) setAgentName(name);
    else setDraft(agentName);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
        {(agentName || "?")[0].toUpperCase()}
      </div>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(agentName); setEditing(false); } }}
          className="rounded-lg border border-cyan-300 dark:border-cyan-400/40 bg-white dark:bg-black/30 px-2 py-1 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-400/20"
        />
      ) : (
        <button
          onClick={() => { setDraft(agentName); setEditing(true); }}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 transition hover:text-cyan-600 dark:hover:text-cyan-300"
          title="Click to change your display name"
        >
          <span>Replying as <span className="font-semibold text-cyan-600 dark:text-cyan-300">{agentName || "Agent"}</span></span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared UI Components
// ---------------------------------------------------------------------------

function ContactCard({ contact, setContact }) {
  return (
    <div className="grid gap-3 rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-4 md:grid-cols-3">
      <InputField
        label="Name"
        value={contact.guest_name}
        onChange={(v) => setContact({ ...contact, guest_name: v })}
      />
      <InputField
        label="Email"
        value={contact.guest_email}
        onChange={(v) => setContact({ ...contact, guest_email: v })}
      />
      <InputField
        label="Phone / WhatsApp"
        value={contact.guest_phone}
        onChange={(v) => setContact({ ...contact, guest_phone: v })}
      />
    </div>
  );
}

function InputField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none transition focus:border-amber-400 dark:focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10"
      />
    </label>
  );
}

function Shell({ title, subtitle, accent, action, children }) {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("codixel-theme") !== "light";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("codixel-theme", dark ? "dark" : "light"); } catch (e) { void e; }
  }, [dark]);

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-[#060c18] text-gray-900 dark:text-gray-100">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute inset-x-0 top-0 h-80 bg-linear-to-b ${accent} opacity-[0.06] dark:opacity-[0.13] blur-3xl`} />
        <div className="absolute left-[-8%] top-[25%] h-64 w-64 rounded-full bg-violet-500/[0.04] dark:bg-violet-500/[0.07] blur-3xl" />
        <div className="absolute right-[-5%] top-[55%] h-64 w-64 rounded-full bg-orange-500/[0.04] dark:bg-orange-500/[0.07] blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-gray-200/80 dark:border-white/[0.07] bg-white/95 dark:bg-[#060c18]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br ${accent} shadow-md shadow-black/10 dark:shadow-black/30`}>
              <span className="text-sm font-bold text-white">C</span>
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-snug tracking-tight text-gray-900 dark:text-white">{title}</h1>
              <p className="mt-0.5 text-xs leading-snug text-gray-500 dark:text-gray-400">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {action}
            <button
              onClick={() => setDark((d) => !d)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-500 dark:text-gray-400 shadow-sm transition hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white"
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? (
                <svg className="h-[14px] w-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
                </svg>
              ) : (
                <svg className="h-[14px] w-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex h-[calc(100vh-73px)] flex-col content-stretch">{children}</div>
    </div>
  );
}

function EmptyState({ onSuggestion }) {
  const suggestions = [
    "We need a website redesign for our company.",
    "Can you tell me about your AI automation service?",
    "I want to discuss pricing for a custom web app.",
  ];

  return (
    <div className="flex flex-col items-center gap-8 py-16 text-center">
      <div className="max-w-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400/20 to-rose-500/20 ring-1 ring-gray-200 dark:ring-white/10 shadow-lg shadow-black/5">
          <span className="text-xl font-semibold text-amber-600 dark:text-amber-200">AI</span>
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Start with AI, move to human when needed
        </h2>
        <p className="mt-3 text-sm leading-7 text-gray-500 dark:text-gray-400">
          Ask about services, pricing, timelines, or your project. To speak with a real person,
          just say <span className="font-medium text-amber-600 dark:text-amber-300">"I want to talk to a human"</span> at any point.
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-2.5 md:grid-cols-3">
        {suggestions.map((item) => (
          <button
            key={item}
            onClick={() => onSuggestion(item)}
            className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3.5 text-left text-sm text-gray-600 dark:text-gray-300 shadow-sm transition hover:border-amber-300 dark:hover:border-amber-400/30 hover:bg-amber-50 dark:hover:bg-white/[0.07] hover:text-gray-900 dark:hover:text-white"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBanner({ conversation }) {
  const status = conversation?.status ?? "ai_active";
  const agentName = conversation?.assigned_agent_name;
  const config = {
    ai_active: {
      title: "AI assistant is active",
      text: 'You are chatting with Codixel AI. Say "I want to talk to a person" anytime to connect with a human teammate.',
      cls: "border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100",
      dot: "bg-amber-400",
    },
    waiting_for_agent: {
      title: "Human handoff in progress",
      text: "A human teammate has been notified and will join this conversation shortly.",
      cls: "border-sky-200 dark:border-sky-400/20 bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-100",
      dot: "bg-sky-400",
    },
    queued_for_business_hours: {
      title: "Queued for the next working period",
      text: "The team is offline right now. Your messages are saved and a human will reply next business day.",
      cls: "border-emerald-200 dark:border-emerald-400/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-100",
      dot: "bg-emerald-400",
    },
    assigned_to_agent: {
      title: agentName ? `You're chatting with ${agentName}` : "A human teammate is in the thread",
      text: agentName
        ? `${agentName} from the Codixel team is here to help you.`
        : "This conversation is now being handled by the Codixel team.",
      cls: "border-cyan-200 dark:border-cyan-400/20 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-100",
      dot: "bg-cyan-400",
    },
  }[status];

  return (
    <div className={`mx-4 mt-4 rounded-xl border px-4 py-3 sm:mx-6 ${config.cls}`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot} animate-pulse`} />
        <p className="text-sm font-semibold">{config.title}</p>
      </div>
      <p className="mt-1 pl-3.5 text-xs opacity-80 leading-relaxed">{config.text}</p>
    </div>
  );
}

function TypingIndicator({ label }) {
  return (
    <div className="flex items-start gap-3 msg-enter">
      <AIAvatar />
      <div className="rounded-2xl rounded-tl-sm border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-4 py-3 text-sm text-gray-600 dark:text-gray-300 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-amber-400 dark:bg-amber-300 animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span className="text-xs">{label}</span>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

function StatusPill({ status }) {
  const colors = {
    ai_active: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    waiting_for_agent: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    queued_for_business_hours: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    assigned_to_agent: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[status] || "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white"}`}>
      {conversationStatusLabel(status)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function conversationStatusLabel(status) {
  return (
    {
      ai_active: "AI active",
      waiting_for_agent: "Waiting for agent",
      queued_for_business_hours: "Queued after hours",
      assigned_to_agent: "Assigned to agent",
    }[status] || "New conversation"
  );
}

function appendUnique(messages, msg) {
  return messages.some((m) => String(m.id) === String(msg.id))
    ? messages
    : [...messages, msg];
}

function createTempMessage(sender_type, content, sender_name) {
  return {
    id: `temp-${crypto.randomUUID()}`,
    sender_type,
    sender_name,
    content,
    created_at: new Date().toISOString(),
  };
}

function errorMessage(error) {
  return {
    id: crypto.randomUUID(),
    sender_type: "error",
    content: error.message || "Something went wrong.",
    created_at: new Date().toISOString(),
  };
}

async function api(path, options = {}) {
  const { headers: optHeaders, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(optHeaders || {}) },
    ...rest,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function adminApi(path, options = {}) {
  return api(path, options);
}

async function fetchConversation(conversationId) {
  return api(`/conversations/${conversationId}`, {});
}

function useConversationSocket(conversationId, onEvent) {
  const eventRef = useRef(onEvent);
  useEffect(() => { eventRef.current = onEvent; }, [onEvent]);
  useEffect(() => {
    if (!conversationId) return;
    const socket = new WebSocket(`${WS_BASE}/ws/conversations/${conversationId}`);
    socket.onmessage = (event) => {
      try { eventRef.current(JSON.parse(event.data)); } catch { /* ignore */ }
    };
    return () => socket.close();
  }, [conversationId]);
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function AIAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-rose-500 text-xs font-bold text-white shadow-md shadow-amber-500/20 dark:shadow-black/20">
      AI
    </div>
  );
}

export { AIAvatar };
