import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useChatStore = create(
  persist(
    (set) => ({
      messages: [],
      conversation: null,
      contact: { guest_name: "", guest_email: "", guest_phone: "" },
      loading: false,
      booting: true,
      conversationHistory: [], // [{id, title, preview, created_at, status}]

      setBooting: (booting) => set({ booting }),
      setLoading: (loading) => set({ loading }),
      setConversation: (conversation) => set({ conversation }),
      setContact: (contact) => set({ contact }),

      appendMessage: (msg) =>
        set((state) => ({
          messages: state.messages.some((m) => String(m.id) === String(msg.id))
            ? state.messages
            : [...state.messages, msg],
        })),

      setMessages: (messages) => set({ messages }),

      addToHistory: (conversation, preview) =>
        set((state) => {
          const exists = state.conversationHistory.some((h) => h.id === conversation.id);
          if (exists) {
            return {
              conversationHistory: state.conversationHistory.map((h) =>
                h.id === conversation.id
                  ? { ...h, status: conversation.status, updated_at: conversation.last_message_at }
                  : h
              ),
            };
          }
          return {
            conversationHistory: [
              {
                id: conversation.id,
                title: conversation.guest_name || "New chat",
                preview: preview ? preview.slice(0, 80) : "",
                created_at: conversation.created_at,
                status: conversation.status,
              },
              ...state.conversationHistory,
            ].slice(0, 50),
          };
        }),

      updateHistoryItem: (conversation) =>
        set((state) => ({
          conversationHistory: state.conversationHistory.map((h) =>
            h.id === conversation.id
              ? { ...h, status: conversation.status, updated_at: conversation.last_message_at }
              : h
          ),
        })),

      removeFromHistory: (id) =>
        set((state) => ({
          conversationHistory: state.conversationHistory.filter((h) => h.id !== id),
        })),

      clearConversation: () =>
        set({
          messages: [],
          conversation: null,
          contact: { guest_name: "", guest_email: "", guest_phone: "" },
        }),
    }),
    {
      name: "codixel-chat-v2",
      partialize: (state) => ({
        conversation: state.conversation,
        contact: state.contact,
        conversationHistory: state.conversationHistory,
      }),
    }
  )
);
