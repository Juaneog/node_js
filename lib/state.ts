/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Agent, Charlotte, Paul, Shane, Penny, SocratesAdvisor, JorgeRestrepoPhD, CostCraftAI, AGENT_COLORS, INTERLOCUTOR_VOICES } from './presets/agents';

/**
 * User
 */
export type User = {
  name?: string;
  info?: string;
};

interface UserState extends User {
  setName: (name: string) => void;
  setInfo: (info: string) => void;
}

// Type for the state that is actually persisted for User
type UserPersistedState = User;

export const useUser = create(
  persist<UserState, [], [], UserPersistedState>(
    (set) => ({
      name: '',
      info: '',
      setName: name => set({ name }),
      setInfo: info => set({ info }),
    }),
    {
      name: 'user-storage', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state): UserPersistedState => ({ name: state.name, info: state.info }), // only persist these fields
    }
  )
);

/**
 * Agents
 */
function getAgentById(id: string) {
  const { availablePersonal, availablePresets } = useAgent.getState();
  return (
    availablePersonal.find(agent => agent.id === id) ||
    availablePresets.find(agent => agent.id === id)
  );
}

interface AgentState {
  current: Agent;
  availablePresets: Agent[];
  availablePersonal: Agent[];
  setCurrent: (agent: Agent | string) => void;
  addAgent: (agent: Agent) => void;
  update: (agentId: string, adjustments: Partial<Agent>) => void;
}

// Type for the state that is actually persisted for Agent
interface AgentPersistedState {
  current: Agent;
  availablePersonal: Agent[];
}

export const useAgent = create(
  persist<AgentState, [], [], AgentPersistedState>(
    (set, get) => ({
      current: SocratesAdvisor,
      availablePresets: [SocratesAdvisor, JorgeRestrepoPhD, CostCraftAI, Paul, Charlotte, Shane, Penny],
      availablePersonal: [],

      addAgent: (agent: Agent) => {
        set(state => ({
          ...state,
          availablePersonal: [...state.availablePersonal, agent],
          current: agent,
        }));
      },
      setCurrent: (agentOrId: Agent | string) => {
        let agentToSet: Agent | undefined;
        if (typeof agentOrId === 'string') {
          // Note: getAgentById uses useAgent.getState(). For internal store actions,
          // using the `get()` from the creator is often preferred.
          agentToSet = getAgentById(agentOrId);
        } else {
          agentToSet = agentOrId;
        }
        if (agentToSet) {
          set({ current: agentToSet });
        } else {
          console.warn(`Agent with ID ${agentOrId} not found. Defaulting to SocratesAdvisor.`);
          set({ current: SocratesAdvisor });
        }
      },
      update: (agentId: string, adjustments: Partial<Agent>) => {
        const currentAgentsState = get();
        let agentToUpdate =
          currentAgentsState.availablePersonal.find(a => a.id === agentId) ||
          currentAgentsState.availablePresets.find(a => a.id === agentId);

        if (!agentToUpdate) return;

        const updatedAgent = { ...agentToUpdate, ...adjustments };

        set(state => ({
          ...state,
          availablePresets: state.availablePresets.map(a =>
            a.id === agentId ? updatedAgent : a
          ),
          availablePersonal: state.availablePersonal.map(a =>
            a.id === agentId ? updatedAgent : a
          ),
          current: state.current.id === agentId ? updatedAgent : state.current,
        }));
      },
    }),
    {
      name: 'agent-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): AgentPersistedState => ({
        current: state.current,
        availablePersonal: state.availablePersonal,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Error rehydrating agent-storage:", error);
          return;
        }
        if (state) {
          const initialPresets = [SocratesAdvisor, JorgeRestrepoPhD, CostCraftAI, Paul, Charlotte, Shane, Penny];
          const presetMatch = initialPresets.find(p => p.id === state.current.id);

          if (presetMatch && JSON.stringify(presetMatch) !== JSON.stringify(state.current)) {
            // If the current agent is a preset and has been modified from the default, revert it.
            // This could be adjusted if persisted preset modifications are desired.
            state.current = presetMatch;
          }
          // Ensure all personal agents have default color/voice if missing (e.g. from older persisted state)
          state.availablePersonal = state.availablePersonal.map(agent => ({
            ...agent,
            bodyColor: agent.bodyColor || AGENT_COLORS[0],
            voice: agent.voice || INTERLOCUTOR_VOICES[0],
          }));
           // Ensure current agent (if not a fresh preset) also has default color/voice
           if (state.current && (!state.current.bodyColor || !state.current.voice)) {
            state.current = {
              ...state.current,
              bodyColor: state.current.bodyColor || AGENT_COLORS[0],
              voice: state.current.voice || INTERLOCUTOR_VOICES[0],
            };
          }
        }
      }
    }
  )
);

/**
 * UI
 */
interface UIState {
  showUserConfig: boolean;
  setShowUserConfig: (show: boolean) => void;
  showAgentEdit: boolean;
  setShowAgentEdit: (show: boolean) => void;
}

interface UIPersistedState {
  showUserConfig: boolean;
}

export const useUI = create(
  persist<UIState, [], [], UIPersistedState>(
    (set) => ({
      showUserConfig: true,
      setShowUserConfig: (show: boolean) => set({ showUserConfig: show }),
      showAgentEdit: false,
      setShowAgentEdit: (show: boolean) => set({ showAgentEdit: show }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): UIPersistedState => ({ showUserConfig: state.showUserConfig }),
    }
  )
);