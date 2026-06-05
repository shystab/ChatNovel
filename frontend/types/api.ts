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
  user_id?: string;
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
  summary?: string;
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

// ── Auth ────────────────────────────────────────
export interface AuthUser {
  username: string;
  display_name?: string | null;
  bio?: string | null;
  current_work?: string | null;
  avatar_color?: string;
  avatar_image_path?: string | null;
  is_admin: boolean;
}

export interface UserProfile {
  username: string;
  display_name?: string | null;
  bio?: string | null;
  current_work?: string | null;
  avatar_color: string;
  avatar_image_path?: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface UserProfileUpdate {
  display_name?: string | null;
  bio?: string | null;
  current_work?: string | null;
  avatar_color?: string | null;
}

export interface DirectMessage {
  id: number;
  sender_username: string;
  recipient_username: string;
  content: string;
  created_at: string;
  read_at?: string | null;
}

export interface ShowcaseCard {
  id: number;
  user_id: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  content: string;
  cover_image_path?: string | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShowcaseCardCreate {
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  content?: string | null;
  is_public?: boolean;
  sort_order?: number;
}

export interface ShowcaseCardUpdate {
  title?: string | null;
  subtitle?: string | null;
  excerpt?: string | null;
  content?: string | null;
  is_public?: boolean;
  sort_order?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface InviteCode {
  code: string;
  max_uses: number;
  uses: number;
  is_active: boolean;
  created_at: string;
  expires_at?: string | null;
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

export type AgentEditAction =
  | "append"
  | "prepend"
  | "replace_all"
  | "insert_before"
  | "insert_after"
  | "replace_text";

export interface AgentEditOperation {
  action: AgentEditAction;
  content: string;
  anchor?: string | null;
  find_text?: string | null;
  reason?: string | null;
}

export interface AgentEditPlan {
  reply?: string;
  summary: string;
  risk: "low" | "medium" | "high";
  operations: AgentEditOperation[];
}

export interface AgentEditRequest {
  instruction: string;
  messages?: Array<{ role: string; content: string }>;
  user_id?: string;
  project_id?: string;
  current_chapter_id?: number | null;
  book_id?: number | null;
  selected_doc_ids?: number[];
  content?: string;
  use_memory?: boolean;
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
  // 检索行为：external 是外部语料 RAG，chapter 是内部全书检索
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
  // 检索行为：external 是外部语料 RAG，chapter 是内部全书检索
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

export interface KnowledgeHealth {
  enabled: boolean;
  vector_ready: boolean;
  model: string;
  persist_dir: string;
  local_files_only: boolean;
  device: string;
  retrieval_mode: "vector";
  user_id: string;
}

export interface KnowledgeReindexResult {
  documents: number;
  vectorized_chunks: number;
  vector_ready: boolean;
  retrieval_mode: "vector";
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
