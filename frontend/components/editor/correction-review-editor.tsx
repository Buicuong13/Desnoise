'use client'

/**
 * CorrectionReviewEditor (spec §8) — a Tiptap document editor bound to the
 * page's `tiptap_json`. Renders the OCR result as a real document (paragraphs,
 * not a flat list), highlights low-confidence spans, lets the user edit
 * manually, and saves back via PATCH /pages/{id}/tiptap.
 *
 * LLM Keep/Undo is backend-authoritative: the parent bumps `revision` after a
 * review action so this editor reloads the recomputed document.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { EditorContent, Extension, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ApiLowConfidenceWord, TiptapDoc } from '@/lib/api/types'

const lowConfKey = new PluginKey('ocr-low-conf')

/**
 * Highlight low-confidence OCR words. Each paragraph node carries an
 * `attrs.range = [start, end]` (char offsets into the OCR plain text); a
 * low-confidence word inside that range maps to ProseMirror positions
 * `nodeStart + 1 + (offset - rangeStart)`.
 */
function lowConfExtension(getWords: () => ApiLowConfidenceWord[]) {
  return Extension.create({
    name: 'ocrLowConf',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: lowConfKey,
          props: {
            decorations(state) {
              const words = getWords()
              if (!words.length) return DecorationSet.empty
              const decos: Decoration[] = []
              state.doc.descendants((node, pos) => {
                if (node.type.name !== 'paragraph') return
                const range = node.attrs?.range as [number, number] | undefined
                if (!range) return
                const [pstart, pend] = range
                const textLen = node.content.size
                for (const w of words) {
                  if (w.start_offset >= pstart && w.end_offset <= pend) {
                    const from = pos + 1 + (w.start_offset - pstart)
                    const to = pos + 1 + (w.end_offset - pstart)
                    // Guard against drift after edits.
                    if (to <= pos + 1 + textLen) {
                      decos.push(Decoration.inline(from, to, { class: 'ocr-low-conf' }))
                    }
                  }
                }
              })
              return DecorationSet.create(state.doc, decos)
            },
          },
        }),
      ]
    },
  })
}

interface Props {
  value: TiptapDoc | null
  lowConfidenceWords?: ApiLowConfidenceWord[]
  /** Bump to force a reload of `value` (e.g. after Keep/Undo recompute). */
  revision?: number
  editable?: boolean
  onSave?: (doc: TiptapDoc) => Promise<void>
}

const EMPTY_DOC: TiptapDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

export function CorrectionReviewEditor({
  value,
  lowConfidenceWords = [],
  revision = 0,
  editable = true,
  onSave,
}: Props) {
  const wordsRef = useRef<ApiLowConfidenceWord[]>(lowConfidenceWords)
  wordsRef.current = lowConfidenceWords

  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const editor = useEditor({
    extensions: [
      // The paragraph node must accept our custom attrs from the backend.
      StarterKit.configure({}),
      Extension.create({
        name: 'paragraphMeta',
        addGlobalAttributes() {
          return [
            {
              types: ['paragraph'],
              attributes: {
                range: { default: null, rendered: false },
                blockId: { default: null, rendered: false },
                paragraphId: { default: null, rendered: false },
                bbox: { default: null, rendered: false },
                confidence: { default: null, rendered: false },
              },
            },
          ]
        },
      }),
      lowConfExtension(() => wordsRef.current),
    ],
    content: value ?? EMPTY_DOC,
    editable,
    immediatelyRender: false,
    onUpdate: () => setDirty(true),
  })

  // Reload content when the backend recomputes the document (Keep/Undo) or the
  // selected page changes.
  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(value ?? EMPTY_DOC)
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, editor])

  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return
    setSaving(true)
    try {
      await onSave(editor.getJSON() as TiptapDoc)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [editor, onSave])

  return (
    <div className="space-y-2">
      {/* Styles for .ocr-low-conf / .tiptap-editor live in app/globals.css so
          stacked editor instances don't each inject a duplicate <style>. */}
      <div className="tiptap-editor rounded-xl border border-border bg-white p-4 max-h-[560px] overflow-auto">
        <EditorContent editor={editor} />
      </div>

      {editable && onSave && (
        <div className="flex items-center justify-end gap-2">
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save text
          </Button>
        </div>
      )}
    </div>
  )
}
