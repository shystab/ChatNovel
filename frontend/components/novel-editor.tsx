"use client";

import RichEditor from "./rich-editor";
import { Chapter, EditorAppearance } from "@/types/api";
import type { Theme, ThemeColors } from "@/hooks/use-theme";

export interface NovelEditorProps {
  chapter: Chapter | null;
  content: string;
  status: string;
  onChangeContent: (content: string) => void;
  onSave: () => void;
  onRestoreChapter?: (chapter: Chapter) => void;
  previousChapter?: Chapter | null;
  nextChapter?: Chapter | null;
  onSelectChapter?: (id: number) => void;
  onCreateChapter?: () => void;
  theme: Theme;
  colors: ThemeColors;
  showLeft?: boolean;
  showRight?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
  appearance?: EditorAppearance;
}

export default function NovelEditor(props: NovelEditorProps) {
  return <RichEditor {...props} />;
}
