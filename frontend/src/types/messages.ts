// WebSocket message types shared between frontend and backend

// ── Client → Server ──────────────────────────────────────────
export type ClientMessage =
  | { type: 'intent'; content: string }
  | { type: 'confirm_direction'; direction: string; pov_character?: string; location?: string; target_words?: number }
  | { type: 'refine_intent'; content: string }
  | { type: 'skip' }
  | { type: 'confirm_kg_updates'; apply: boolean }
  | { type: 'status_request' }
  | { type: 'quit' }

// ── Server → Client ──────────────────────────────────────────
export type ServerMessage =
  | { type: 'session_start'; project: Project }
  | { type: 'suggestions'; content: string; kg_nodes: string[] }
  | { type: 'scene_start' }
  | { type: 'scene_chunk'; content: string }
  | { type: 'scene_end'; char_count: number; session_id: string; draft_path: string }
  | { type: 'kg_suggestions'; changes: KGChanges }
  | { type: 'kg_updates_applied'; results: string[] }
  | { type: 'status'; message: string }
  | { type: 'project_status'; characters: CharacterStatus[]; active_threads: ThreadStatus[] }
  | { type: 'error'; message: string }
  | { type: 'session_end'; summary: string }

// ── Domain types ─────────────────────────────────────────────
export interface Project {
  id: string
  name: string
  description?: string
  genre?: string
  language?: string
  summary?: {
    character_count: number
    active_thread_count: number
    location_count: number
    faction_count: number
  }
}

export interface KGChanges {
  character_state_changes?: CharacterStateChange[]
  relationship_changes?: RelationshipChange[]
  new_plot_threads?: NewPlotThread[]
  resolved_plot_threads?: ResolvedPlotThread[]
}

export interface CharacterStateChange {
  character_id: string
  character_name: string
  old_state: string
  new_state: string
}

export interface RelationshipChange {
  char_a: string
  char_b: string
  trust_delta: number
  reason?: string
}

export interface NewPlotThread {
  name: string
  description: string
  planted_at?: string
}

export interface ResolvedPlotThread {
  thread_id: string
  thread_name: string
  resolution_summary?: string
}

export interface CharacterStatus {
  name: string
  current_state: string
}

export interface ThreadStatus {
  name: string
}

// ── KG entity types (for KG Manager UI) ─────────────────────

export interface KGCharacter {
  id: string
  project_id: string
  name: string
  role: string
  gender: string
  age: string
  appearance: string
  core_desire: string
  core_fear: string
  wound: string
  belief: string
  moral_code: string
  behavior_pattern: string
  speech_style: string
  speech_samples: string[]
  arc_start: string
  arc_end: string
  current_state: string
  faction_id: string
  aliases: string[]
}

export interface KGFaction {
  id: string
  project_id: string
  name: string
  ideology: string
  goals: string
  resources: string
  members: string[]
  power_level: number
}

export interface KGLocation {
  id: string
  project_id: string
  name: string
  description: string
  atmosphere: string
  parent_location: string
  significance: string
}

export interface KGPlotThread {
  id: string
  project_id: string
  name: string
  planted_in: string
  planted_at: string
  status: string
  resolution_scene: string
  description: string
}

export interface KGArtifact {
  id: string
  project_id: string
  name: string
  description: string
  power: string
  history: string
  current_owner: string
}

// ── Chat message (UI display) ────────────────────────────────
export type ChatRole = 'user' | 'agent' | 'system' | 'scene' | 'error'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  // Optional extra data for specific message types
  kg_nodes?: string[]
  kg_changes?: KGChanges
  applied_results?: string[]
}
