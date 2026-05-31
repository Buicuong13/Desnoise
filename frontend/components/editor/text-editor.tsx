'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Suggestion } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Check, X, Sparkles } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface SuggestionPopupProps {
  suggestion: Suggestion
  onAccept: () => void
  onReject: () => void
  position: { top: number; left: number }
}

export function SuggestionPopup({ suggestion, onAccept, onReject, position }: SuggestionPopupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="absolute z-50 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium text-foreground">AI Suggestion</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {suggestion.confidence}% confident
          </Badge>
        </div>

        {/* Change preview */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Change:</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 font-mono text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-destructive/20 text-destructive line-through">
                {suggestion.originalText}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-success/20 text-success">
                {suggestion.suggestedText}
              </span>
            </div>
          </div>
        </div>

        {/* Reason */}
        {suggestion.reason && (
          <p className="text-xs text-muted-foreground">
            {suggestion.reason}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
            onClick={onAccept}
          >
            <Check className="w-4 h-4 mr-1" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onReject}
          >
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">Tab</kbd> Accept</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">Esc</kbd> Reject</span>
        </div>
      </div>
    </motion.div>
  )
}

interface TextEditorProps {
  text: string
  suggestions: Suggestion[]
  onTextChange: (text: string) => void
  onSuggestionAccept: (id: string) => void
  onSuggestionReject: (id: string) => void
}

export function TextEditorWithSuggestions({
  text,
  suggestions,
  onTextChange,
  onSuggestionAccept,
  onSuggestionReject
}: TextEditorProps) {
  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null)
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 })

  // Filter only pending suggestions
  const pendingSuggestions = useMemo(() => 
    suggestions.filter(s => s.status === 'pending'),
    [suggestions]
  )

  const handleSuggestionHover = useCallback((
    suggestionId: string | null,
    event?: React.MouseEvent
  ) => {
    setHoveredSuggestion(suggestionId)
    if (event && suggestionId) {
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      const container = (event.target as HTMLElement).closest('.editor-container')
      const containerRect = container?.getBoundingClientRect() || { top: 0, left: 0 }
      
      setPopupPosition({
        top: rect.bottom - containerRect.top + 8,
        left: Math.max(0, rect.left - containerRect.left - 100)
      })
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (hoveredSuggestion) {
      if (e.key === 'Tab') {
        e.preventDefault()
        onSuggestionAccept(hoveredSuggestion)
        setHoveredSuggestion(null)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onSuggestionReject(hoveredSuggestion)
        setHoveredSuggestion(null)
      }
    }
  }, [hoveredSuggestion, onSuggestionAccept, onSuggestionReject])

  // Render text with highlighted suggestions
  const renderTextWithSuggestions = useMemo(() => {
    if (pendingSuggestions.length === 0) {
      return <span>{text}</span>
    }

    // Sort suggestions by startIndex
    const sortedSuggestions = [...pendingSuggestions].sort((a, b) => a.startIndex - b.startIndex)
    
    const elements: React.ReactNode[] = []
    let lastIndex = 0

    sortedSuggestions.forEach((suggestion, idx) => {
      // Add text before this suggestion
      if (suggestion.startIndex > lastIndex) {
        elements.push(
          <span key={`text-${idx}`}>
            {text.slice(lastIndex, suggestion.startIndex)}
          </span>
        )
      }

      // Add the suggestion highlight
      elements.push(
        <TooltipProvider key={`suggestion-${suggestion.id}`} delayDuration={0}>
          <Tooltip open={hoveredSuggestion === suggestion.id}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'relative cursor-pointer transition-all duration-200',
                  'bg-suggestion/30 border-b-2 border-dashed border-suggestion',
                  'hover:bg-suggestion/50',
                  hoveredSuggestion === suggestion.id && 'bg-suggestion/50 ring-2 ring-suggestion ring-offset-2'
                )}
                onMouseEnter={(e) => handleSuggestionHover(suggestion.id, e)}
                onMouseLeave={() => handleSuggestionHover(null)}
              >
                {suggestion.originalText}
              </span>
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="max-w-xs p-0 bg-transparent border-none shadow-none"
            >
              <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium">Suggested: </span>
                  <span className="text-xs text-success font-mono">{suggestion.suggestedText}</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs bg-success/10 hover:bg-success/20 text-success"
                    onClick={() => {
                      onSuggestionAccept(suggestion.id)
                      setHoveredSuggestion(null)
                    }}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => {
                      onSuggestionReject(suggestion.id)
                      setHoveredSuggestion(null)
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )

      lastIndex = suggestion.endIndex
    })

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(
        <span key="text-end">
          {text.slice(lastIndex)}
        </span>
      )
    }

    return elements
  }, [text, pendingSuggestions, hoveredSuggestion, handleSuggestionHover, onSuggestionAccept, onSuggestionReject])

  return (
    <div 
      className="editor-container relative"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="p-4 rounded-xl bg-muted/30 border border-border font-mono text-sm leading-relaxed whitespace-pre-wrap min-h-[400px]">
        {renderTextWithSuggestions}
      </div>

      {/* Stats bar */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{text.length} characters</span>
          <span>{text.split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <div className="flex items-center gap-2">
          {pendingSuggestions.length > 0 && (
            <Badge variant="secondary" className="bg-suggestion/10 text-suggestion-foreground">
              <Sparkles className="w-3 h-3 mr-1" />
              {pendingSuggestions.length} suggestions
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
