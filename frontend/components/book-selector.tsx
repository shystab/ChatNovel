"use client";

import React, { useState, useRef, useEffect } from "react";
import { Book } from "@/types/api";
import { api } from "@/lib/api";
import { BookOpen, Plus, Trash2, ChevronDown, Check, X } from "lucide-react";
import type { Theme, ThemeColors } from "@/hooks/use-theme";

interface BookSelectorProps {
  books: Book[];
  activeBookId: number | null;
  onSwitch: (bookId: number) => void;
  onBooksChange: (books: Book[]) => void;
  theme: Theme;
  colors: ThemeColors;
}

export default function BookSelector({
  books,
  activeBookId,
  onSwitch,
  onBooksChange,
  theme,
}: BookSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeBook = books.find((b) => b.id === activeBookId);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setNewTitle("");
        setConfirmDeleteId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 打开新建输入时自动聚焦
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const book = await api.createBook({
        title,
      });
      const updated = [...books, book];
      onBooksChange(updated);
      onSwitch(book.id);
      setIsCreating(false);
      setNewTitle("");
      setIsOpen(false);
    } catch (err) {
      console.error("创建书籍失败", err);
    }
  };

  const handleDelete = async (bookId: number) => {
    if (confirmDeleteId !== bookId) {
      setConfirmDeleteId(bookId);
      return;
    }
    try {
      await api.deleteBook(bookId);
      const updated = books.filter((b) => b.id !== bookId);
      onBooksChange(updated);
      // 如果删的是当前活跃书籍，切到第一本
      if (activeBookId === bookId && updated.length > 0) {
        onSwitch(updated[0].id);
      }
    } catch (err) {
      console.error("删除书籍失败", err);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // 主题色
  const border = theme === "dark" ? "border-slate-700" : theme === "sepia" ? "border-amber-200" : "border-slate-200";
  const text = theme === "dark" ? "text-slate-200" : theme === "sepia" ? "text-amber-900" : "text-slate-800";
  const muted = theme === "dark" ? "text-slate-400" : theme === "sepia" ? "text-amber-600" : "text-slate-500";
  const hoverBg = theme === "dark" ? "hover:bg-slate-800" : theme === "sepia" ? "hover:bg-amber-100" : "hover:bg-slate-100";
  const activeBg = theme === "dark" ? "bg-slate-800" : theme === "sepia" ? "bg-amber-100" : "bg-white";
  const dropdownBg = theme === "dark" ? "bg-slate-900 border-slate-700" : theme === "sepia" ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200";

  return (
    <div
      className={`relative shrink-0 border-b ${border} ${isOpen ? "z-[120]" : "z-10"}`}
      ref={dropdownRef}
    >
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full flex items-center space-x-2 px-3 py-2.5 ${hoverBg} transition-colors`}
        type="button"
      >
        <BookOpen size={13} className={muted} />
        <span className={`flex-1 text-xs font-semibold truncate text-left ${text}`}>
          {activeBook ? activeBook.title : "选择书籍..."}
        </span>
        <ChevronDown
          size={12}
          className={`${muted} transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 right-0 z-[130] border ${dropdownBg} rounded-b-lg shadow-lg overflow-hidden`}
        >
          {/* 书籍列表 */}
          <div className="max-h-48 overflow-y-auto">
            {books.map((book) => (
              <div
                key={book.id}
                className={`flex items-center px-3 py-2 group transition-colors ${
                  book.id === activeBookId ? activeBg : hoverBg
                }`}
              >
                <button
                  className="flex-1 flex items-center space-x-2 text-left min-w-0"
                  onClick={() => {
                    onSwitch(book.id);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  {book.id === activeBookId && (
                    <Check size={11} className="text-emerald-500 shrink-0" />
                  )}
                  <span
                    className={`text-xs truncate ${
                      book.id === activeBookId ? `font-semibold ${text}` : muted
                    }`}
                  >
                    {book.title}
                  </span>
                  <span className={`text-[10px] shrink-0 ${muted} opacity-60`}>
                    {book.chapter_count}章
                  </span>
                </button>

                {/* 删除按钮（只有 >1 本书时显示） */}
                {books.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(book.id);
                    }}
                    className={`shrink-0 ml-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                      confirmDeleteId === book.id
                        ? "text-red-500"
                        : `${muted} hover:text-red-400`
                    }`}
                    title={confirmDeleteId === book.id ? "再次点击确认删除" : "删除书籍"}
                    type="button"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 新建书籍 */}
          <div className={`border-t ${border} p-2`}>
            {isCreating ? (
              <div className="flex items-center space-x-1">
                <input
                  ref={inputRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setIsCreating(false);
                      setNewTitle("");
                    }
                  }}
                  placeholder="书籍名称..."
                  className={`flex-1 text-xs px-2 py-1 rounded border ${border} bg-transparent ${text} focus:outline-none`}
                />
                <button
                  onClick={handleCreate}
                  className="p-1 text-emerald-500 hover:text-emerald-400"
                  type="button"
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewTitle("");
                  }}
                  className={`p-1 ${muted}`}
                  type="button"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className={`w-full flex items-center space-x-2 px-2 py-1.5 text-xs ${muted} ${hoverBg} rounded-lg transition-colors`}
                type="button"
              >
                <Plus size={12} />
                <span>新建书籍</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
