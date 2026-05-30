// ── 书籍 ──────────────────────────────────────────
export interface Book {
  id: number;
  title: string;
  description?: string;
  user_id: string;
  cover_url?: string;
  chapter_count: number;
  create_time: string;
  update_time: string;
}

export interface BookCreate {
  title: string;
  description?: string;
  user_id: string;
  cover_url?: string;
}

export interface BookUpdate {
  title?: string;
  description?: string;
  cover_url?: string;
}

// ── 章节 ──────────────────────────────────────────
export interface Chapter {
  id: number;
  title: string;
  content: string;
  order: number;
  book_id?: number;
  create_time: string;
  update_time: string;
}

export interface ChapterCreate {
  title: string;
  content: string;
  order?: number;
}

export interface ChapterUpdate {
  title?: string;
  content?: string;
  order?: number;
}

// ── 对话 ──────────────────────────────────────────
export interface Conversation {
  id: number;
  user_id: string;
  title: string;
  messages: Array<{ role: string; content: string }>;
  selected_doc_ids: number[];
  create_time: string;
  update_time: string;
}

export interface ConversationCreate {
  title?: string;
  user_id?: string;
  messages?: Array<{ role: string; content: string }>;
}

export interface ConversationUpdate {
  title?: string;
  messages?: Array<{ role: string; content: string }>;
  selected_doc_ids?: number[];
}

// ── AI 章节上下文 ──────────────────────────────────
export interface ChapterContextItem {
  chapter_id: number;
  title: string;
  content: string;
}

export interface AISuggestRequest {
  content: string;
  max_length?: number;
  user_id?: string;
  project_id?: string;
  use_rag?: boolean;
  use_memory?: boolean;
}

export interface AISuggestResponse {
  suggestion: string;
  reason: string;
}

export interface Settings {
  id: number;
  theme: string;
  font_size: number;
  auto_save_interval: number;
  language: string;
  editor_mode: string;
  has_deepseek_key: boolean;
  has_openai_key: boolean;
  ai_provider: string;
  temperature?: number;
  max_tokens?: number;
  summary_auto_generate: boolean;
  summary_generation_style: string;
  workspace_dir: string;
  background_image_path?: string | null;
  background_blur: number;
  background_dim: number;
  editor_paper_opacity: number;
  // 分层记忆
  current_chapter_chars?: number;
  nearby_chapter_count?: number;
  inject_nearby_summaries?: boolean;
  inject_chapter_rag?: boolean;
  // RAG 行为
  suggest_use_external_rag?: boolean;
  chat_use_chapter_rag?: boolean;
  external_rag_weight?: number;
}

export interface SettingsUpdate {
  theme?: string;
  font_size?: number;
  auto_save_interval?: number;
  language?: string;
  editor_mode?: string;
  deepseek_api_key?: string;
  openai_api_key?: string;
  ai_provider?: string;
  temperature?: number;
  max_tokens?: number;
  summary_auto_generate?: boolean;
  summary_generation_style?: string;
  workspace_dir?: string;
  background_image_path?: string | null;
  background_blur?: number;
  background_dim?: number;
  editor_paper_opacity?: number;
  // 分层记忆
  current_chapter_chars?: number;
  nearby_chapter_count?: number;
  inject_nearby_summaries?: boolean;
  inject_chapter_rag?: boolean;
  // RAG 行为
  suggest_use_external_rag?: boolean;
  chat_use_chapter_rag?: boolean;
  external_rag_weight?: number;
}

export interface EditorAppearance {
  background_image_path?: string | null;
  background_blur: number;
  background_dim: number;
  editor_paper_opacity: number;
  background_url?: string;
}

export interface AIWSRequest {
  type: "suggest" | "chat";
  task?: string;
  content?: string;
  messages?: Array<{ role: string; content: string }>;
  max_length?: number;
  analysis_enabled?: boolean;
  analysis_interval_chars?: number;
  analysis_types?: string[];
  user_id?: string;
  project_id?: string;
  use_rag?: boolean;
  use_memory?: boolean;
  use_layered_memory?: boolean;
  use_external_rag?: boolean;
  use_chapter_rag?: boolean;
  external_rag_weight?: number;
  current_chapter_id?: number;
  selected_doc_ids?: number[];
  preset_id?: number;
  book_id?: number;
  chapter_contexts?: ChapterContextItem[];
}

export interface KnowledgeBase {
  id: number;
  title: string;
  user_id: string;
  project_id: string;
  created_at: string | null;
  chunk_count: number;
}

export type AIWSMessage =
  | { type: "token"; text: string }
  | { type: "analysis"; data: unknown }
  | { type: "done" }
  | { type: "error"; message: string };

// ── 人格预设 ─────────────────────────────────────
export interface Persona {
  id: number;
  name: string;
  system_prompt: string;
  enabled: boolean;
  user_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

export interface PersonaCreate {
  name: string;
  system_prompt: string;
  enabled?: boolean;
  user_id: string;
  project_id: string;
}

export interface PersonaUpdate {
  name?: string;
  system_prompt?: string;
  enabled?: boolean;
}
