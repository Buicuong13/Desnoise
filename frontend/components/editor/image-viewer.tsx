'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageViewerProps {
  originalUrl: string
  denoisedUrl: string
  title?: string
}

export function ImageViewer({ originalUrl, denoisedUrl, title }: ImageViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [showOriginal, setShowOriginal] = useState(false)
  const [activeTab, setActiveTab] = useState<'original' | 'denoised'>('denoised')

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title || 'Document Preview'}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(Math.max(50, zoom - 25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(Math.min(200, zoom + 25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(100)}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'original' | 'denoised')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="original" className="text-xs">
              Original
              <Badge variant="outline" className="ml-2 text-xs">Blurry</Badge>
            </TabsTrigger>
            <TabsTrigger value="denoised" className="text-xs">
              Denoised
              <Badge variant="secondary" className="ml-2 text-xs bg-success/10 text-success">Enhanced</Badge>
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-4 flex-1 overflow-auto rounded-lg border border-border bg-muted/30">
            <TabsContent value="original" className="m-0 h-full">
              <div 
                className="relative w-full h-full min-h-[300px] flex items-center justify-center p-4"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}
              >
                {/* Mock blurry document */}
                <div className="w-full max-w-md aspect-[3/4] rounded-lg bg-white shadow-lg p-6 blur-[1px] opacity-80">
                  <div className="space-y-3">
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-5/6" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-8 my-4" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-4/5" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                    Original - Noisy/Blurry
                  </Badge>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="denoised" className="m-0 h-full">
              <div 
                className="relative w-full h-full min-h-[300px] flex items-center justify-center p-4"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}
              >
                {/* Mock clear document */}
                <div className="w-full max-w-md aspect-[3/4] rounded-lg bg-white shadow-lg p-6">
                  <div className="space-y-3">
                    <div className="h-6 bg-foreground/80 rounded w-3/4" />
                    <div className="h-4 bg-foreground/60 rounded w-full" />
                    <div className="h-4 bg-foreground/60 rounded w-5/6" />
                    <div className="h-4 bg-foreground/60 rounded w-full" />
                    <div className="h-4 bg-foreground/60 rounded w-2/3" />
                    <div className="h-8 my-4" />
                    <div className="h-4 bg-foreground/60 rounded w-full" />
                    <div className="h-4 bg-foreground/60 rounded w-4/5" />
                    <div className="h-4 bg-foreground/60 rounded w-full" />
                    <div className="h-4 bg-foreground/60 rounded w-3/4" />
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    Enhanced - AI Denoised
                  </Badge>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Zoom slider */}
        <div className="flex items-center gap-4">
          <ZoomOut className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[zoom]}
            onValueChange={([value]) => setZoom(value)}
            min={50}
            max={200}
            step={10}
            className="flex-1"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}
