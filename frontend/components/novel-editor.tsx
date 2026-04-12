"use client";

import RichEditor from "./rich-editor";
import { Chapter } from "@/types/api";
import type { Theme, ThemeColors } from "@/hooks/use-theme";

export interface NovelEditorProps {
  chapter: Chapter | null;
  content: string;
  status: string;
  onChangeContent: (content: string) => void;
  onSave: () => void;
  theme: Theme;
  colors: ThemeColors;
  showLeft?: boolean;
  showRight?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}

export default function NovelEditor(props: NovelEditorProps) {
  return <RichEditor {...props} />;
}
