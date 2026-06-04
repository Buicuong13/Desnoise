'use client'

/**
 * Create or edit a workspace (title, description, icon, color).
 * Used from the dashboard and the documents list.
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { api, ApiError } from '@/lib/api'
import type { ApiDocument } from '@/lib/api/types'
import {
  DEFAULT_COLOR,
  DEFAULT_ICON,
  WORKSPACE_COLORS,
  WORKSPACE_COLOR_KEYS,
  WORKSPACE_ICONS,
  WORKSPACE_ICON_KEYS,
  getWorkspaceColor,
  getWorkspaceIcon,
} from '@/lib/workspace-icons'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Provide a document to edit; omit to create a new one. */
  document?: ApiDocument | null
  onSaved: (doc: ApiDocument) => void
}

export function WorkspaceDialog({ open, onOpenChange, document, onSaved }: Props) {
  const isEdit = !!document
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<string>(DEFAULT_ICON)
  const [color, setColor] = useState<string>(DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)

  // Sync form state whenever the dialog opens (or the target document changes).
  useEffect(() => {
    if (!open) return
    setTitle(document?.title ?? '')
    setDescription(document?.description ?? '')
    setIcon(document?.icon ?? DEFAULT_ICON)
    setColor(document?.color ?? DEFAULT_COLOR)
  }, [open, document])

  const PreviewIcon = getWorkspaceIcon(icon)

  const handleSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      toast.error('Please enter a title')
      return
    }
    setSaving(true)
    try {
      const saved = isEdit
        ? await api.documents.update(document!.id, {
            title: trimmed,
            description: description.trim() || null,
            icon,
            color,
          })
        : await api.documents.create({
            title: trimmed,
            description: description.trim() || undefined,
            icon,
            color,
          })
      toast.success(isEdit ? 'Workspace updated' : 'Workspace created')
      onSaved(saved)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save workspace')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? 'Edit workspace' : 'New workspace'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the name, icon and color.' : 'Name it and pick an icon & color.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Live preview */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                getWorkspaceColor(color),
              )}
            >
              <PreviewIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display font-bold text-foreground">
                {title.trim() || 'Untitled workspace'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {description.trim() || 'No description'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ws-title">Title</Label>
            <Input
              id="ws-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Truyện Kiều — bản A"
              maxLength={255}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ws-desc">Description (optional)</Label>
            <Textarea
              id="ws-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's in this workspace?"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-2">
              {WORKSPACE_ICON_KEYS.map((key) => {
                const Ico = WORKSPACE_ICONS[key]
                const active = key === icon
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-lg border transition-all',
                      active
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                    aria-label={key}
                  >
                    <Ico className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {WORKSPACE_COLOR_KEYS.map((key) => {
                const active = key === color
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setColor(key)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ring-offset-2 ring-offset-background transition-all',
                      WORKSPACE_COLORS[key],
                      active ? 'ring-2 ring-foreground/40' : 'hover:scale-110',
                    )}
                    aria-label={key}
                  >
                    {active && <Check className="h-4 w-4 text-white" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
