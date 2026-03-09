import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, ShieldAlert, Grid3X3, BarChart3, Menu, UserCheck, AlertTriangle, LogOut, Database, ShieldCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppContext';
import ExamSelector from '@/components/ExamSelector';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/faculty', icon: Users, label: 'Faculty' },
  { to: '/slots', icon: Calendar, label: 'Exam Slots' },
  { to: '/unavailability', icon: ShieldAlert, label: 'Unavailability' },
  { to: '/allocation', icon: Grid3X3, label: 'Allocation' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/conflicts', icon: AlertTriangle, label: 'Conflicts' },
  { to: '/my-schedule', icon: UserCheck, label: 'My Schedule' },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { resetData } = useAppState();

  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full glass-sidebar text-sidebar-foreground border-r border-white/5">
      <div className="p-7 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-sidebar-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="flex items-center gap-3 relative">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center shadow-[0_8px_20px_rgba(var(--sidebar-primary),0.3)] border border-white/10 group-hover:rotate-12 transition-transform duration-500">
            <ShieldCheck size={22} className="text-white drop-shadow-md" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-display font-black text-sidebar-primary tracking-tight leading-none">FairAssign</h1>
            <p className="text-[9px] font-black text-sidebar-foreground/30 uppercase tracking-[0.2em] mt-1.5 leading-none">Intel System</p>
          </div>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="p-1 rounded-2xl bg-black/20 border border-white/5 shadow-inner">
          <ExamSelector />
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-none">
        {links.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={`flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-[13px] font-bold uppercase tracking-wider transition-all duration-300 ${active
                ? 'bg-sidebar-primary text-white shadow-[0_10px_25px_-5px_rgba(var(--sidebar-primary),0.4)] border border-white/10'
                : 'text-sidebar-foreground/50 hover:bg-white/5 hover:text-sidebar-foreground/80 border border-transparent'
                }`}
            >
              <Icon size={18} className={active ? "text-white" : "opacity-40 group-hover:opacity-100"} />
              <span className={active ? "opacity-100" : "opacity-80"}>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-6 mt-auto">
        <div className="p-4 rounded-[2rem] bg-black/40 border border-white/5 backdrop-blur-md shadow-2xl relative overflow-hidden group/profile">
          <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/10 to-transparent opacity-0 group-hover/profile:opacity-100 transition-opacity duration-500" />

          <div className="flex flex-col items-center gap-3 relative">
            <div className="h-14 w-14 rounded-2xl bg-sidebar-primary/20 flex items-center justify-center border border-sidebar-primary/20 shadow-inner group-hover/profile:scale-110 transition-transform duration-500">
              <span className="text-lg font-black text-sidebar-primary tracking-widest pl-[1px]">
                {initials}
              </span>
            </div>
            <div className="text-center min-w-0 w-full px-1">
              <p className="text-sm font-black text-sidebar-foreground tracking-tight truncate">{fullName}</p>
              <p className="text-[10px] text-sidebar-foreground/30 font-bold tracking-widest uppercase truncate mt-0.5">{user?.email}</p>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2 w-full">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl bg-white/5 text-sidebar-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-all border border-white/5"
                onClick={resetData}
                title="Reset All Data"
              >
                <Database size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl bg-sidebar-primary text-white hover:bg-sidebar-primary/80 shadow-lg shadow-sidebar-primary/20 transition-all border border-white/10"
                onClick={signOut}
                title="Sign Out"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <header className="sticky top-0 z-50 flex items-center gap-4 bg-background/80 backdrop-blur-xl px-5 h-16 md:hidden border-b border-white/5">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/5 border border-white/10">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 border-none">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <ShieldCheck size={18} className="text-white" />
        </div>
        <h1 className="text-sm font-display font-black text-foreground uppercase tracking-widest">FairAssign</h1>
      </div>
    </header>
  );
}

export default function AppSidebar() {
  return (
    <aside className="hidden md:flex w-72 h-screen sticky top-0 flex-col bg-background relative z-30">
      <SidebarNav />
    </aside>
  );
}

