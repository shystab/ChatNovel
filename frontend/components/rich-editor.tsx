"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Heading from "@tiptap/extension-heading";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Blockquote from "@tiptap/extension-blockquote";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import { TextStyle } from "@tiptap/extension-text-style";
import { Chapter, EditorAppearance } from "@/types/api";
import type { Theme, ThemeColors } from "@/hooks/use-theme";
import {
  Save,
  AlignLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Heading1,
  Heading2,
  Plus,
  Quote,
  Code as CodeIcon,
} from "lucide-react";
import { useEffect, useCallback } from "react";

interface RichEditorProps {
  chapter: Chapter | null;
  content: string;
  status: string;
  onChangeContent: (content: string) => void;
  onSave: () => void;
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

function wordCount(text: string) {
  const plain = text.replace(/<[^>]+>/g, "");
  const chinese = (plain.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (plain.match(/\b[a-zA-Z]+\b/g) || []).length;
  return chinese + english;
}

function estimateReadTime(words: number) {
  const mins = Math.ceil(words / 500);
  return mins < 1 ? "< 1 分钟" : `${mins} 分钟`;
}

export default function RichEditor({
  chapter,
  content,
  status,
  onChangeContent,
  onSave,
  previousChapter,
  nextChapter,
  onSelectChapter,
  onCreateChapter,
  theme,
  colors,
  appearance,
}: RichEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bold: false,
        italic: false,
        code: false,
        codeBlock: false,
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Bold,
      Italic,
      Blockquote,
      Code,
      CodeBlock,
      TextStyle,
      Placeholder.configure({
        placeholder: "在这里开启你的创作篇章…",
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChangeContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "novel-writing-surface prose focus:outline-none min-h-full max-w-none",
        spellcheck: "false",
      },
    },
  });

  // 同步外部 content 变化到编辑器（如插入 AI 内容）
  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // 章节切换时自动聚焦到编辑器末尾
  useEffect(() => {
    if (editor && chapter?.id) {
      setTimeout(() => {
        editor.commands.focus("end");
      }, 50);
    }
  }, [chapter?.id, editor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      editor?.commands.insertContent("　　");
    }
  }, [editor, onSave]);

  const paragraphs = content.replace(/<[^>]+>/g, "\n").split(/\n+/).filter(p => p.trim()).length;
  const words = wordCount(content);
  const chars = content.replace(/<[^>]+>/g, "").length;

  const borderClass = theme === 'dark' ? 'border-slate-700/60' : theme === 'sepia' ? 'border-amber-200/50' : 'border-slate-100';
  const textClass = theme === 'dark' ? 'text-slate-300' : theme === 'sepia' ? 'text-amber-700' : 'text-slate-700';
  const headingClass = theme === 'dark' ? 'text-slate-100' : theme === 'sepia' ? 'text-amber-900' : 'text-slate-800';
  const mutedClass = theme === 'dark' ? 'text-slate-500' : theme === 'sepia' ? 'text-amber-500/70' : 'text-slate-350';
  const toolbarBg = theme === 'dark' ? 'bg-slate-800/40' : theme === 'sepia' ? 'bg-amber-100/30' : 'bg-slate-50/80';
  const toolbarBtn = `p-1.5 rounded transition-all ${textClass}`;
  const toolbarBtnActive = theme === 'dark' ? 'bg-slate-700' : theme === 'sepia' ? 'bg-amber-200' : 'bg-slate-200';
  const navButtonClass = `p-1.5 rounded-lg transition-all ${mutedClass} ${
    theme === 'dark' ? 'hover:bg-slate-700/60 hover:text-slate-200 disabled:hover:bg-transparent' :
    theme === 'sepia' ? 'hover:bg-amber-100 hover:text-amber-900 disabled:hover:bg-transparent' :
    'hover:bg-slate-100 hover:text-slate-800 disabled:hover:bg-transparent'
  } disabled:opacity-35 disabled:cursor-not-allowed`;

  const hasBackground = Boolean(appearance?.background_url);
  const rawPaperOpacity = Math.min(Math.max(appearance?.editor_paper_opacity ?? 92, 55), 100) / 100;
  const paperOpacity = hasBackground ? Math.min(rawPaperOpacity, 0.38) : rawPaperOpacity;
  const paperBg = theme === 'dark'
    ? `rgba(15, 23, 42, ${paperOpacity})`
    : theme === 'sepia'
    ? `rgba(255, 251, 235, ${paperOpacity})`
    : hasBackground
    ? `rgba(255, 255, 255, ${paperOpacity})`
    : `rgba(255, 255, 255, ${paperOpacity})`;
  const chromeBg = hasBackground
    ? theme === 'dark' ? 'bg-slate-950/55 backdrop-blur-2xl' : theme === 'sepia' ? 'bg-amber-950/25 backdrop-blur-2xl' : 'bg-slate-950/32 backdrop-blur-2xl'
    : colors.editorBg;

  if (!chapter) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center ${hasBackground ? "bg-transparent" : colors.editorBg} space-y-6 h-full relative overflow-hidden`}>
        <div className={`relative z-10 w-16 h-16 rounded-lg ${theme === 'dark' ? 'bg-slate-800/80' : 'bg-slate-50/90'} flex items-center justify-center`}>
          <FileText size={28} strokeWidth={1.5} className={theme === 'dark' ? 'text-slate-600' : 'text-slate-300'} />
        </div>
        <div className="relative z-10 text-center space-y-1.5">
          <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>选择章节开始写作</p>
          <p className={`text-[11px] ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`}>从左侧目录选择或新建章节</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${hasBackground ? "bg-transparent" : colors.editorBg} relative overflow-hidden`}>
      {/* 顶部工具栏 */}
      <header className={`px-5 py-2.5 border-b ${borderClass} flex justify-between items-center ${chromeBg} z-30 shrink-0`}>
        {/* 左侧：章节标题 */}
        <div className="flex items-center space-x-2 min-w-0">
          <div className="flex items-center space-x-0.5 shrink-0">
            <button
              onClick={() => previousChapter && onSelectChapter?.(previousChapter.id)}
              disabled={!previousChapter}
              className={navButtonClass}
              type="button"
              title={previousChapter ? `上一章：${previousChapter.title}` : "没有上一章"}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => nextChapter && onSelectChapter?.(nextChapter.id)}
              disabled={!nextChapter}
              className={navButtonClass}
              type="button"
              title={nextChapter ? `下一章：${nextChapter.title}` : "没有下一章"}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <h1 className={`font-bold ${headingClass} text-sm tracking-tight truncate max-w-[220px]`}>
            {chapter.title}
          </h1>
          <div className="flex items-center space-x-1.5 shrink-0">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                status === "已同步" ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" :
                status === "保存中..." ? "bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50" :
                status === "保存失败" ? "bg-red-400 shadow-sm shadow-red-400/50" :
                `${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-300'} animate-pulse`
              }`}
            />
            <span className={`text-[10px] font-bold ${mutedClass} uppercase tracking-wider`}>{status}</span>
          </div>
        </div>

        {/* 右侧：编辑工具 + 统计 + 保存 */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* 编辑工具栏 */}
          <div className={`hidden md:flex items-center space-x-0.5 p-1 rounded-lg ${toolbarBg}`}>
            <button
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`${toolbarBtn} ${editor?.isActive('bold') ? toolbarBtnActive : 'hover:bg-black/5'}`}
              title="粗体 (Ctrl+B)" type="button"
            >
              <BoldIcon size={13} />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`${toolbarBtn} ${editor?.isActive('italic') ? toolbarBtnActive : 'hover:bg-black/5'}`}
              title="斜体 (Ctrl+I)" type="button"
            >
              <ItalicIcon size={13} />
            </button>
            <div className="w-px h-3.5 bg-current opacity-15 mx-0.5" />
            <button
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`${toolbarBtn} ${editor?.isActive('heading', { level: 1 }) ? toolbarBtnActive : 'hover:bg-black/5'}`}
              title="标题 1" type="button"
            >
              <Heading1 size={13} />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`${toolbarBtn} ${editor?.isActive('heading', { level: 2 }) ? toolbarBtnActive : 'hover:bg-black/5'}`}
              title="标题 2" type="button"
            >
              <Heading2 size={13} />
            </button>
            <div className="w-px h-3.5 bg-current opacity-15 mx-0.5" />
            <button
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className={`${toolbarBtn} ${editor?.isActive('blockquote') ? toolbarBtnActive : 'hover:bg-black/5'}`}
              title="引用块" type="button"
            >
              <Quote size={13} />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleCode().run()}
              className={`${toolbarBtn} ${editor?.isActive('code') ? toolbarBtnActive : 'hover:bg-black/5'}`}
              title="行内代码" type="button"
            >
              <CodeIcon size={13} />
            </button>
          </div>

          {/* 统计信息 */}
          <div className={`hidden lg:flex items-center space-x-3 text-[10px] font-bold ${mutedClass} uppercase tracking-wider`}>
            <div className="flex items-center space-x-1">
              <AlignLeft size={10} />
              <span>{paragraphs} 段</span>
            </div>
            <span className="opacity-40">·</span>
            <span>{words.toLocaleString()} 字</span>
            <span className="opacity-40">·</span>
            <span>{estimateReadTime(words)}</span>
          </div>

          <button
            onClick={onCreateChapter}
            className={`hidden sm:flex items-center space-x-1.5 text-xs font-bold ${mutedClass} transition-all px-2.5 py-1.5 rounded-lg ${
              theme === 'dark' ? 'hover:bg-slate-700/60 hover:text-slate-200' :
              theme === 'sepia' ? 'hover:bg-amber-100 hover:text-amber-900' :
              'hover:bg-slate-100 hover:text-slate-800'
            }`}
            type="button"
            title="新建章节"
          >
            <Plus size={12} />
            <span>新章</span>
          </button>

          <button
            onClick={onSave}
            className={`flex items-center space-x-1.5 text-xs font-bold ${mutedClass} transition-all px-2.5 py-1.5 rounded-lg ${
              theme === 'dark' ? 'hover:bg-slate-700/60 hover:text-slate-200' :
              theme === 'sepia' ? 'hover:bg-amber-100 hover:text-amber-900' :
              'hover:bg-slate-100 hover:text-slate-800'
            }`}
            type="button"
          >
            <Save size={12} />
            <span>保存</span>
          </button>

        </div>
      </header>

      {/* 编辑区 — 舒适的阅读宽度 + 大行距 */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10" onKeyDown={handleKeyDown}>
        <div className="w-full max-w-[860px] mx-auto py-8 sm:py-12 px-4 sm:px-8 min-h-full">
          <div
            className={`min-h-[72vh] rounded-[10px] ${hasBackground ? 'shadow-lg shadow-black/15 ring-1 ring-white/24 border border-white/18' : ''}`}
            style={{
              backgroundColor: hasBackground ? paperBg : 'transparent',
              backdropFilter: hasBackground ? 'blur(18px) saturate(1.32) contrast(1.02)' : undefined,
              boxShadow: hasBackground
                ? 'inset 0 1px 0 rgba(255,255,255,0.56), inset 0 -1px 0 rgba(255,255,255,0.12), 0 24px 70px rgba(0,0,0,0.18)'
                : undefined,
            }}
          >
          <style>{`
            .novel-writing-surface {
              font-size: 18px;
              line-height: 2.1;
              letter-spacing: 0;
              text-rendering: optimizeLegibility;
              caret-color: currentColor;
              padding: ${hasBackground ? '3rem 3.25rem' : '0'};
            }
            .novel-writing-surface p {
              margin: 0 0 0.8em;
              text-indent: 2em;
            }
            .novel-writing-surface h1,
            .novel-writing-surface h2 {
              text-indent: 0;
              text-align: center;
            }
            .novel-writing-surface h1 { font-size: 1.45em; font-weight: 700; margin: 1.6em 0 1em; line-height: 1.5; }
            .novel-writing-surface h2 { font-size: 1.22em; font-weight: 700; margin: 1.3em 0 0.8em; line-height: 1.5; }
            .novel-writing-surface blockquote {
              border-left: 3px solid currentColor;
              opacity: 0.7;
              padding-left: 1em;
              margin: 1em 0;
              font-style: italic;
            }
            .novel-writing-surface p.is-editor-empty:first-child::before {
              color: #aaa;
              content: attr(data-placeholder);
              float: left;
              text-indent: 0;
              height: 0;
              pointer-events: none;
            }
          `}</style>
          <EditorContent
            editor={editor}
            className={`w-full min-h-[70vh] focus:outline-none ${textClass}`}
          />
          </div>
        </div>
      </main>

      {/* 底部状态栏 */}
      <div className={`px-6 py-2 border-t ${borderClass} flex items-center justify-between shrink-0 relative z-30 ${chromeBg}`}>
        <span className={`text-[10px] font-bold ${mutedClass} uppercase tracking-wider`}>{chars.toLocaleString()} 字符</span>
        <div className="flex items-center space-x-4">
          <span className={`text-[10px] ${mutedClass} hidden sm:block`}>Tab 缩进 · Ctrl+Enter 保存</span>
        </div>
      </div>
    </div>
  );
}
