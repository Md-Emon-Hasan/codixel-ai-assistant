import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import { useChatStore } from "./store/chatStore";
import { useAdminStore } from "./store/adminStore";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
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
  const token = useAdminStore((s) => s.token);
  return token ? <AdminApp /> : <Navigate to="/admin/login" replace />;
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
    // Guard: ignore events that don't belong to the current conversation
    // (prevents stale WebSocket events after "New chat" from restoring old state)
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

  // Restore conversation on page reload
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
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            Admin view
          </button>
          {conversation?.status === "assigned_to_agent" && (
            <button
              onClick={revertToAi}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Back to AI
            </button>
          )}
        </div>
      }
    >
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-white/10 bg-[#121620]/85 shadow-2xl shadow-black/30 backdrop-blur">
          <StatusBanner conversation={conversation} />

          <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
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

          <div className="border-t border-white/10 bg-black/20 px-4 py-4 sm:px-6">
            <ContactCard contact={contact} setContact={setContact} />
            <div className="mt-4">
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

        <aside className="flex w-full flex-col rounded-[28px] border border-white/10 bg-[#10141d]/85 p-4 shadow-xl shadow-black/20 backdrop-blur lg:w-[300px]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200/80">Conversations</h2>
            {messages.length > 0 && (
              <button
                onClick={clearConversation}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/10 hover:text-white"
              >
                + New chat
              </button>
            )}
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {conversationHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-500">
                Your past conversations will appear here.
              </div>
            ) : (
              conversationHistory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadHistoryConversation(item.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    item.id === conversation?.id
                      ? "border-amber-400/40 bg-amber-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-white">
                    {item.title || "Chat"}
                  </p>
                  {item.preview && (
                    <p className="mt-1 truncate text-xs text-gray-400">{item.preview}</p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-500">{formatDate(item.created_at)}</p>
                </button>
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
  const token = useAdminStore((s) => s.token);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) navigate("/admin", { replace: true });
  }, [token, navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Login failed.");
      }
      const data = await res.json();
      setAuth(data.access_token, {
        agent_id: data.agent_id,
        username: data.username,
        display_name: data.display_name,
        is_admin: data.is_admin,
      });
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/10 hover:text-white"
        >
          Customer view
        </button>
      }
    >
      <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
        <form
          onSubmit={handleLogin}
          className="w-full rounded-[28px] border border-white/10 bg-[#10141d]/90 p-6 shadow-xl shadow-black/30"
        >
          <h2 className="text-xl font-semibold text-white">Admin login</h2>
          <p className="mt-2 text-sm text-gray-400">Sign in with your agent credentials.</p>
          {error && (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            required
            className="mt-5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
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
    token, agent, clearAuth,
    conversations, selectedId, selectedDetail, filter, agentName, loadingList,
    replying, setFilter, setAgentName, setLoadingList, setReplying,
    setConversations, setSelectedId, setSelectedDetail,
    updateSelectedMessages, updateConversationInList,
  } = useAdminStore();

  useConversationSocket(selectedId, (payload) => {
    if (!selectedDetail) return;
    if (payload.type === "message.created") updateSelectedMessages(payload.message);
    if (payload.type === "conversation.updated") updateConversationInList(payload.conversation);
  });

  // Auto-scroll to bottom when admin messages update
  useEffect(() => {
    adminBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedDetail?.messages]);

  // Load conversation list (poll every 8s)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function loadList() {
      setLoadingList(true);
      try {
        const data = await adminApi(`/admin/conversations?status=${filter}`, token);
        if (cancelled) return;
        setConversations(data.conversations);
        if (!selectedId && data.conversations.length > 0) {
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
  }, [token, filter]);

  // Load selected conversation detail
  useEffect(() => {
    if (!token || !selectedId) return;
    fetchConversation(selectedId, token)
      .then(setSelectedDetail)
      .catch(() => setSelectedDetail(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedId]);

  async function acceptConversation() {
    if (!selectedId) return;
    try {
      const data = await adminApi(`/admin/conversations/${selectedId}/accept`, token, {
        method: "POST",
        body: JSON.stringify({ agent_name: agentName }),
      });
      // Read latest state to avoid stale closure (WebSocket may update messages between click and response)
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
      const data = await adminApi(`/admin/conversations/${selectedId}/reply`, token, {
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
    const data = await adminApi(`/admin/conversations/${selectedId}/revert`, token, {
      method: "POST",
    });
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
      subtitle={`Logged in as ${agent?.display_name || agent?.username}`}
      accent="from-sky-400 via-cyan-400 to-emerald-400"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            Customer view
          </button>
          <button
            onClick={logout}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            Log out
          </button>
        </div>
      }
    >
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 gap-5 px-4 py-5">
        {/* Sidebar */}
        <aside className="flex w-[300px] shrink-0 flex-col rounded-[28px] border border-white/10 bg-[#10141d]/90 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
              Inbox
            </h2>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none"
            >
              <option value="all">All</option>
              <option value="waiting_for_agent">Waiting</option>
              <option value="queued_for_business_hours">Queued</option>
              <option value="assigned_to_agent">Assigned</option>
            </select>
          </div>

          <div className="mt-4">
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              placeholder="Your display name"
            />
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {loadingList && (
              <p className="px-2 text-xs text-gray-500">Refreshing...</p>
            )}
            {conversations.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  item.id === selectedId
                    ? "border-cyan-400/40 bg-cyan-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {item.guest_name || "Website visitor"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {conversationStatusLabel(item.status)}
                    </p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-2 text-xs text-gray-500">{formatDate(item.last_message_at)}</p>
              </button>
            ))}
            {!loadingList && conversations.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-500">
                No conversations for this filter.
              </div>
            )}
          </div>
        </aside>

        {/* Main panel */}
        <section className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-white/10 bg-[#121620]/85">
          {!selectedDetail ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
              Select a conversation to open the thread.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {selectedDetail.conversation.guest_name || "Website visitor"}
                  </h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {conversationStatusLabel(selectedDetail.conversation.status)}
                  </p>
                </div>
                {selectedDetail.conversation.status !== "assigned_to_agent" && (
                  <button
                    onClick={acceptConversation}
                    className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    Accept chat
                  </button>
                )}                {selectedDetail.conversation.status === "assigned_to_agent" && (
                  <button
                    onClick={endHumanChat}
                    className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                  >
                    End Chat
                  </button>
                )}              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[1fr_260px]">
                <div className="min-h-0 overflow-y-auto px-6 py-5">
                  <div className="mx-auto flex max-w-3xl flex-col gap-5">
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

                <aside className="border-l border-white/10 bg-black/15 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                    Customer details
                  </h3>
                  <dl className="mt-4 space-y-3 text-sm text-gray-300">
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

              <div className="border-t border-white/10 px-6 py-4">
                <ChatInput
                  onSend={sendHumanReply}
                  disabled={replying}
                  placeholder="Reply as a human teammate..."
                />
              </div>
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Shared UI Components
// ---------------------------------------------------------------------------

function ContactCard({ contact, setContact }) {
  return (
    <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 md:grid-cols-3">
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
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400/40"
      />
    </label>
  );
}

function Shell({ title, subtitle, accent, action, children }) {
  return (
    <div className="h-screen overflow-hidden bg-[#060816] text-gray-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute inset-x-0 top-0 h-96 bg-linear-to-b ${accent} opacity-15 blur-3xl`} />
        <div className="absolute left-[-10%] top-[30%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-5%] top-[50%] h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${accent} shadow-lg shadow-black/30`}
            >
              <span className="text-lg font-bold text-slate-950">C</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{title}</h1>
              <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
          </div>
          {action}
        </div>
      </header>

      <div className="relative z-10 flex h-[calc(100vh-81px)] flex-col content-stretch">{children}</div>
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
      <div className="max-w-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-linear-to-br from-amber-400/20 to-rose-500/20 ring-1 ring-white/10">
          <span className="text-2xl font-semibold text-amber-200">AI</span>
        </div>
        <h2 className="mt-6 text-3xl font-semibold text-white">
          Start with AI, move to human when needed
        </h2>
        <p className="mt-3 text-base leading-7 text-gray-400">
          Ask about services, pricing, timelines, or your project. To speak with a real person,
          just say <span className="text-amber-300">"I want to talk to a human"</span> at any point.
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-3 md:grid-cols-3">
        {suggestions.map((item) => (
          <button
            key={item}
            onClick={() => onSuggestion(item)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left text-sm text-gray-300 transition hover:border-amber-400/30 hover:bg-white/10"
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
  const config = {
    ai_active: {
      title: "AI assistant is active",
      text: 'You are chatting with Codixel AI. Say "I want to talk to a person" anytime to connect with a human teammate.',
      className: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    },
    waiting_for_agent: {
      title: "Human handoff in progress",
      text: "A human teammate has been notified and will join this conversation shortly.",
      className: "border-sky-400/20 bg-sky-500/10 text-sky-100",
    },
    queued_for_business_hours: {
      title: "Queued for the next working period",
      text: "The team is offline right now. Your messages are saved and a human will reply next business day.",
      className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    },
    assigned_to_agent: {
      title: "A human teammate is in the thread",
      text: "This conversation is now being handled by the Codixel team.",
      className: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
    },
  }[status];

  return (
    <div className={`mx-4 mt-4 rounded-2xl border px-4 py-3 text-sm sm:mx-6 ${config.className}`}>
      <p className="font-semibold">{config.title}</p>
      <p className="mt-1 opacity-90">{config.text}</p>
    </div>
  );
}

function TypingIndicator({ label }) {
  return (
    <div className="flex items-start gap-3">
      <AIAvatar />
      <div className="rounded-3xl rounded-tl-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-amber-300 animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}


function MetaRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-white">{value}</dd>
    </div>
  );
}

function StatusPill({ status }) {
  const colors = {
    ai_active: "bg-amber-500/15 text-amber-200",
    waiting_for_agent: "bg-sky-500/15 text-sky-200",
    queued_for_business_hours: "bg-emerald-500/15 text-emerald-200",
    assigned_to_agent: "bg-cyan-500/15 text-cyan-200",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${colors[status] || "bg-white/10 text-white"}`}
    >
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

async function adminApi(path, token, options = {}) {
  return api(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
}

async function fetchConversation(conversationId, token) {
  return api(`/conversations/${conversationId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
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
    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 to-rose-500 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20">
      AI
    </div>
  );
}

export { AIAvatar };
