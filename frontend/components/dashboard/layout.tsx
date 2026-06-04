'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth-store'
import type { UserRole } from '@/lib/api/types'
import {
  LayoutDashboard,
  FilePlus,
  Library,
  Settings,
  FileText,
  LogOut,
  ChevronUp,
  Users,
  Activity,
  Shield,
} from 'lucide-react'

interface NavItem {
  icon: typeof LayoutDashboard
  label: string
  href: string
  /** Roles allowed to see this item. Empty = visible to all authenticated users. */
  roles?: UserRole[]
}

const userNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: FilePlus, label: 'New Document', href: '/dashboard/editor/new' },
  { icon: Library, label: 'My Documents', href: '/dashboard/history' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
]

const adminNavItems: NavItem[] = [
  { icon: Shield, label: 'Admin Dashboard', href: '/admin' },
  { icon: Users, label: 'Manage Users', href: '/admin/users' },
  { icon: Activity, label: 'Processing Logs', href: '/admin/logs' },
]

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  user: 'Pro user',
  viewer: 'Free viewer',
}

function initials(name: string | null | undefined, email: string): string {
  const base = name?.trim() || email
  return base
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || 'U'
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'admin'

  const displayName = user?.full_name?.trim() || user?.email || 'User'

  // Opening an existing document (/dashboard/editor/{id}) belongs to "My
  // Documents"; the "new" route is the New Document entry.
  const isExistingDoc =
    pathname.startsWith('/dashboard/editor/') && pathname !== '/dashboard/editor/new'
  const navActive = (href: string) =>
    href === '/dashboard/history' ? pathname === href || isExistingDoc : pathname === href

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        {/* Logged-in users land on their dashboard, not the marketing page. */}
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gradient-start to-gradient-end flex items-center justify-center shadow-sm">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight text-sidebar-foreground">
            DocRecover
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={navActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Admin
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={
                          pathname === item.href || pathname.startsWith(item.href + '/')
                        }
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                      {initials(user?.full_name, user?.email ?? '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {initials(user?.full_name, user?.email ?? '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{displayName}</span>
                      <Badge variant="outline" className="w-fit mt-1 text-[10px]">
                        {user ? ROLE_LABEL[user.role] : ''}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export function DashboardHeader() {
  const { user } = useAuth()
  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <div className="flex-1" />
      {user?.role === 'viewer' && (
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          Free viewer · <span className="font-mono">{user.images_used}/10</span> images
        </span>
      )}
      <Button variant="default" size="sm" asChild>
        <Link href="/dashboard/editor/new">
          <FilePlus className="mr-2 h-4 w-4" />
          New Document
        </Link>
      </Button>
    </header>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
