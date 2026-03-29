import { create } from 'zustand'
import type { ChatMessage, KGChanges, Project } from '../types/messages'

type SessionPhase =
  | 'idle'         // waiting for intent
  | 'suggesting'   // director querying KG
  | 'confirming'   // waiting for direction confirmation
  | 'writing'      // streaming scene
  | 'kg_review'    // waiting for KG update confirmation

interface SessionState {
  project: Project | null
  phase: SessionPhase
  messages: ChatMessage[]
  sceneBuffer: string          // accumulates scene_chunk while streaming
  pendingKGChanges: KGChanges | null
  pendingKGRaw: string

  // Editor / persistence
  currentChapterId: string | null
  currentSceneId: string | null
  editorContent: string        // HTML from TipTap, set at scene_end

  setProject: (p: Project) => void
  setPhase: (p: SessionPhase) => void
  addMessage: (m: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  appendSceneChunk: (chunk: string) => void
  finalizeScene: (charCount: number) => void
  setPendingKGChanges: (changes: KGChanges) => void
  clearPendingKG: () => void
  clearSession: () => void

  setCurrentChapterId: (id: string | null) => void
  setCurrentSceneId: (id: string | null) => void
  setEditorContent: (html: string) => void

  savedSignal: number          // incremented after any scene save; ChapterTree watches this
  bumpSavedSignal: () => void
}

let _idCounter = 0
function nextId() { return String(++_idCounter) }

export const useSessionStore = create<SessionState>((set, get) => ({
  project: null,
  phase: 'idle',
  messages: [],
  sceneBuffer: '',
  pendingKGChanges: null,
  pendingKGRaw: '',

  currentChapterId: null,
  currentSceneId: null,
  editorContent: '',
  savedSignal: 0,

  setProject: (p) => set({ project: p }),
  setPhase: (p) => set({ phase: p }),

  addMessage: (m) => set((s) => ({
    messages: [...s.messages, { ...m, id: nextId(), timestamp: Date.now() }],
  })),

  appendSceneChunk: (chunk) => set((s) => ({ sceneBuffer: s.sceneBuffer + chunk })),

  finalizeScene: (charCount) => {
    const { sceneBuffer, addMessage } = get()
    if (sceneBuffer) {
      addMessage({ role: 'scene', content: sceneBuffer })
      addMessage({ role: 'system', content: `Scene complete — ${charCount} characters` })
    }
    set({ sceneBuffer: '', editorContent: sceneBuffer })
  },

  setPendingKGChanges: (changes) => set({ pendingKGChanges: changes }),
  clearPendingKG: () => set({ pendingKGChanges: null, pendingKGRaw: '' }),

  clearSession: () => set({
    phase: 'idle',
    messages: [],
    sceneBuffer: '',
    pendingKGChanges: null,
    pendingKGRaw: '',
    currentChapterId: null,
    currentSceneId: null,
    editorContent: '',
  }),

  setCurrentChapterId: (id) => set({ currentChapterId: id }),
  setCurrentSceneId: (id) => set({ currentSceneId: id }),
  setEditorContent: (html) => set({ editorContent: html }),
  bumpSavedSignal: () => set((s) => ({ savedSignal: s.savedSignal + 1 })),
}))
