'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth-store'
import { api, ApiError } from '@/lib/api'
import type { ApiDocument } from '@/lib/api/types'
import {
  FileText,
  FilePlus,
  CheckCircle,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Layers,
} from 'lucide-react'

const VIEWER_IMAGE_LIMIT = 10
const VIEWER_WORKSPACE_LIMIT = 2

export default function DashboardPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<ApiDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.documents
      .list()
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Failed to load workspaces')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activeDocuments = documents.filter((d) => d.status !== 'archived')
  const recentDocuments = activeDocuments.slice(0, 5)
  const totalPages = activeDocuments.reduce((sum, d) => sum + (d.total_pages ?? 0), 0)

  const isViewer = user?.role === 'viewer'
  const imagesUsed = user?.images_used ?? 0
  const greetingName = user?.full_name?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'there'

  const statsCards = [
    {
      title: 'Workspaces',
      value: activeDocuments.length,
      description: isViewer ? `${activeDocuments.length} / ${VIEWER_WORKSPACE_LIMIT} (free)` : 'active',
      icon: Layers,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Images processed',
      value: totalPages,
      description: 'across all workspaces',
      icon: FileText,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Free quota',
      value: isViewer ? `${imagesUsed} / ${VIEWER_IMAGE_LIMIT}` : 'Unlimited',
      description: isViewer ? 'images used' : 'paid plan',
      icon: Sparkles,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {greetingName}
            </h1>
            <p className="text-muted-foreground">
              {isViewer
                ? "You're on the free viewer tier — upload up to 10 images across 2 workspaces."
                : "Here's what's happening with your documents."}
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/editor/new">
              <FilePlus className="mr-2 h-4 w-4" />
              New Document
            </Link>
          </Button>
        </div>
      </motion.div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {statsCards.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent workspaces</CardTitle>
                <CardDescription>Your most recent documents</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/history">
                  View all
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading…
              </div>
            ) : recentDocuments.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No workspaces yet</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/dashboard/editor/new">Create your first document</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{doc.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(doc.created_at), 'MMM d, yyyy')} · {doc.total_pages}{' '}
                        pages
                      </p>
                    </div>
                    <Badge variant="outline">{doc.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {isViewer && imagesUsed >= VIEWER_IMAGE_LIMIT && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>You&apos;ve used your free quota</AlertTitle>
          <AlertDescription>
            Upgrade to a paid plan to keep processing more documents.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
