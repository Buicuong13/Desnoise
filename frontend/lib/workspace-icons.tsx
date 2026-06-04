/**
 * Workspace appearance catalog. The backend stores only string keys
 * (`documents.icon` / `documents.color`); the actual lucide icon + Tailwind
 * gradient are resolved here so the look stays consistent everywhere.
 *
 * NOTE: color gradients are written as FULL literal class strings so Tailwind's
 * scanner generates them (never build class names dynamically).
 */
import {
  FileText,
  BookOpen,
  ScrollText,
  Newspaper,
  FileSpreadsheet,
  GraduationCap,
  Briefcase,
  Receipt,
  NotebookPen,
  Folder,
  Scale,
  Stamp,
  type LucideIcon,
} from 'lucide-react'

export const WORKSPACE_ICONS: Record<string, LucideIcon> = {
  'file-text': FileText,
  book: BookOpen,
  scroll: ScrollText,
  news: Newspaper,
  sheet: FileSpreadsheet,
  edu: GraduationCap,
  work: Briefcase,
  receipt: Receipt,
  note: NotebookPen,
  folder: Folder,
  legal: Scale,
  stamp: Stamp,
}

export const WORKSPACE_ICON_KEYS = Object.keys(WORKSPACE_ICONS)
export const DEFAULT_ICON = 'file-text'

export function getWorkspaceIcon(key?: string | null): LucideIcon {
  return WORKSPACE_ICONS[key ?? ''] ?? FileText
}

/** key -> gradient classes (full literal strings for Tailwind). */
export const WORKSPACE_COLORS: Record<string, string> = {
  indigo: 'from-[#4648d4] to-[#8b5cf6]',
  blue: 'from-sky-500 to-blue-600',
  emerald: 'from-emerald-500 to-teal-600',
  amber: 'from-amber-500 to-orange-600',
  rose: 'from-rose-500 to-pink-600',
  violet: 'from-violet-500 to-fuchsia-600',
  cyan: 'from-cyan-500 to-sky-600',
  slate: 'from-slate-500 to-slate-700',
}

export const WORKSPACE_COLOR_KEYS = Object.keys(WORKSPACE_COLORS)
export const DEFAULT_COLOR = 'indigo'

export function getWorkspaceColor(key?: string | null): string {
  return WORKSPACE_COLORS[key ?? ''] ?? WORKSPACE_COLORS.indigo
}
