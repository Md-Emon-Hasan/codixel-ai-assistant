import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAdminStore = create(
  persist(
    (set) => ({
      token: null,
      agent: null,

      conversations: [],
      selectedId: null,
      selectedDetail: null,
      filter: "all",
      agentName: "",
      loadingList: false,
      replying: false,

      setAuth: (token, agent) =>
        set({
          token,
          agent,
          agentName: agent.display_name || agent.username,
        }),
      clearAuth: () =>
        set({
          token: null,
          agent: null,
          conversations: [],
          selectedId: null,
          selectedDetail: null,
          agentName: "",
        }),

      setFilter: (filter) => set({ filter }),
      setAgentName: (agentName) => set({ agentName }),
      setLoadingList: (loadingList) => set({ loadingList }),
      setReplying: (replying) => set({ replying }),
      setConversations: (conversations) => set({ conversations }),
      setSelectedId: (selectedId) =>
        set((state) => ({
          selectedId,
          // preserve detail when clicking the same conversation — useEffect won't re-fire for the same ID
          selectedDetail: selectedId === state.selectedId ? state.selectedDetail : null,
        })),
      setSelectedDetail: (selectedDetail) => set({ selectedDetail }),

      updateSelectedMessages: (msg) =>
        set((state) => {
          if (!state.selectedDetail) return {};
          const msgs = state.selectedDetail.messages;
          if (msgs.some((m) => String(m.id) === String(msg.id))) return {};
          return {
            selectedDetail: { ...state.selectedDetail, messages: [...msgs, msg] },
          };
        }),

      updateConversationInList: (conversation) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversation.id ? conversation : c
          ),
          selectedDetail:
            state.selectedDetail?.conversation?.id === conversation.id
              ? { ...state.selectedDetail, conversation }
              : state.selectedDetail,
        })),
    }),
    {
      name: "codixel-admin-v2",
      partialize: (state) => ({
        token: state.token,
        agent: state.agent,
        agentName: state.agentName,
      }),
    }
  )
);
