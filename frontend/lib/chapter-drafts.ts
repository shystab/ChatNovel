export interface ChapterDraft {
  userId: string;
  bookId: number;
  chapterId: number;
  content: string;
  updatedAt: number;
}

const PREFIX = "novelcat-draft";

function key(userId: string, bookId: number, chapterId: number) {
  return `${PREFIX}:${userId}:${bookId}:${chapterId}`;
}

export function loadChapterDraft(userId: string, bookId: number, chapterId: number): ChapterDraft | null {
  try {
    const raw = localStorage.getItem(key(userId, bookId, chapterId));
    return raw ? JSON.parse(raw) as ChapterDraft : null;
  } catch {
    return null;
  }
}

export function saveChapterDraft(userId: string, bookId: number, chapterId: number, content: string) {
  try {
    const draft: ChapterDraft = { userId, bookId, chapterId, content, updatedAt: Date.now() };
    localStorage.setItem(key(userId, bookId, chapterId), JSON.stringify(draft));
  } catch {
    // Local storage can be unavailable or full; server auto-save remains the fallback.
  }
}

export function clearChapterDraft(userId: string, bookId: number, chapterId: number) {
  try {
    localStorage.removeItem(key(userId, bookId, chapterId));
  } catch {}
}
