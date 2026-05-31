'use client'

/**
 * The standalone upload page was merged into the end-to-end workspace: upload is
 * now the first step inside the editor (see `PageUploadPanel`). This route is
 * kept only to redirect old links/bookmarks to the new "New Document" entry.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function UploadRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/editor/new')
  }, [router])

  return (
    <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      Redirecting…
    </div>
  )
}
