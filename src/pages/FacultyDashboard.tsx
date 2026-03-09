import { useState, useMemo } from 'react';
import { useAppState } from '@/context/AppContext';
import { formatDate } from '@/types/invigilation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, CheckCircle2, AlertTriangle, User, Clock, Printer, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FacultyDashboard() {
  const { faculty, unavailability, examinations } = useAppState();
  const [selectedId, setSelectedId] = useState<string>('');

  const selectedFaculty = faculty.find(f => f.id === selectedId);

  // Consider it published if at least one exam has published assignments
  const isPublished = examinations.some(e => e.publishedAssignments.length > 0);

  const schedule = useMemo(() => {
    if (!selectedId) return [];

    type UnifiedSlot = { id: string; facultyId: string; slotId: string; examName: string; slot: { id: string; date: string; session: string; required: number } };
    const allMyAssignments: UnifiedSlot[] = [];

    for (const exam of examinations) {
      if (exam.publishedAssignments.length > 0) {
        const myAssignments = exam.publishedAssignments.filter(a => a.facultyId === selectedId);
        myAssignments.forEach(a => {
          const slot = exam.slots.find(s => s.id === a.slotId);
          if (slot) {
            allMyAssignments.push({ ...a, examName: exam.name, slot });
          }
        });
      }
    }

    return allMyAssignments.sort((a, b) => {
      const dc = a.slot.date.localeCompare(b.slot.date);
      if (dc !== 0) return dc;
      return a.slot.session === 'AM' ? -1 : 1;
    });
  }, [selectedId, examinations]);

  const myUnavailability = useMemo(() => {
    if (!selectedId) return [];
    return unavailability.filter(u => u.facultyId === selectedId);
  }, [selectedId, unavailability]);

  const totalDuties = schedule.length;
  const maxDuties = selectedFaculty?.maxDuties ?? 0;

  // Group schedule by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof schedule>();
    schedule.forEach(s => {
      const existing = map.get(s.slot.date) || [];
      existing.push(s);
      map.set(s.slot.date, existing);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [schedule]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">My Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Personal invigilation timeline and duty insights</p>
        </div>
        {selectedFaculty && isPublished && schedule.length > 0 && (
          <Button variant="outline" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 gap-2 text-xs font-bold uppercase tracking-wider no-print" onClick={() => window.print()}>
            <Printer size={14} /> Print Schedule
          </Button>
        )}
      </div>

      {/* Printable Only Header */}
      <div className="hidden print:block mb-8 border-b-2 border-primary pb-4">
        <h1 className="text-3xl font-display font-black text-primary tracking-tight">FairAssign</h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">Official Invigilation Schedule</p>
        <div className="mt-6 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Faculty Member</p>
            <p className="text-lg font-bold text-foreground">{selectedFaculty?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Generated On</p>
            <p className="text-sm font-medium text-foreground">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 border-white/10 relative overflow-hidden group no-print max-w-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 relative">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 shadow-inner">
            <User size={32} className="text-primary" />
          </div>
          <div className="space-y-4 flex-1">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-0.5">Identify Faculty</label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full h-12 rounded-xl bg-white/5 border-white/5 focus:ring-4 focus:ring-primary/10 transition-all font-semibold">
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-white/10 bg-background/95 backdrop-blur-xl">
                  {faculty
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(f => (
                      <SelectItem key={f.id} value={f.id} className="rounded-lg font-medium">{f.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Select Name Message on Print */}
      {!selectedId && (
        <div className="hidden print:block text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-lg font-bold text-gray-400 italic">Please select a faculty name on the screen before printing the official schedule.</p>
        </div>
      )}

      {!selectedFaculty && (
        <div className="glass-card rounded-2xl p-16 text-center border-dashed border-white/10 no-print max-w-2xl">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <User size={32} className="text-muted-foreground opacity-30" />
          </div>
          <p className="font-bold text-foreground">Awaiting Selection</p>
          <p className="text-sm text-muted-foreground mt-1">Please select your name above to generate your invigilation plan.</p>
        </div>
      )}

      {selectedFaculty && !isPublished && (
        <div className="glass-card rounded-2xl p-16 text-center border-white/10 bg-primary/[0.02]">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Clock size={32} className="text-primary" />
          </div>
          <p className="font-bold text-foreground">Schedule Preparation in Progress</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            The administration is currently finalizing the allocations. Check back once the final schedule is published.
          </p>
        </div>
      )}

      {selectedFaculty && isPublished && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
            <div className="glass-card rounded-2xl p-6 border-white/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-40" />
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1 relative underline underline-offset-4 decoration-2">Assigned Duties</p>
              <p className="text-4xl font-display font-black text-foreground relative">{totalDuties}</p>
              <div className="absolute top-4 right-4 text-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                <CheckCircle2 size={32} />
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 border-white/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-40" />
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 relative underline underline-offset-4 decoration-2">Max Threshold</p>
              <p className="text-4xl font-display font-black text-foreground relative">{maxDuties}</p>
              <div className="absolute top-4 right-4 text-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                <Clock size={32} />
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 border-white/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-40" />
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1 relative underline underline-offset-4 decoration-2">Unavailable</p>
              <p className="text-4xl font-display font-black text-foreground relative">{myUnavailability.length}</p>
              <div className="absolute top-4 right-4 text-rose-500/20 group-hover:scale-110 transition-transform duration-500">
                <AlertTriangle size={32} />
              </div>
            </div>
          </div>

          {/* Schedule Timeline - Screen Only */}
          <div className="space-y-4 print:hidden">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                <CalendarDays size={18} className="text-primary" />
                Duty Timeline
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{totalDuties} active sessions</p>
            </div>

            {schedule.length > 0 ? (
              <div className="space-y-3 relative before:absolute before:left-[45px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-primary/30 before:via-primary/5 before:to-primary/30">
                {groupedByDate.map(([date, items], idx) => (
                  <div key={date} className="relative flex gap-6 group animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="w-24 pt-2 text-right relative z-10 bg-background/50 backdrop-blur-sm rounded-lg p-2">
                      <p className="text-xs font-black text-foreground uppercase leading-tight">{formatDate(date).split(' ')[0]}</p>
                      <p className="text-[14px] font-black text-primary leading-none mt-1">{formatDate(date).split(' ')[1]}</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1">
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                      </p>
                    </div>

                    <div className="flex-1 space-y-3 pb-6">
                      {items.map(item => (
                        <div key={item.id} className="glass-card hover-lift rounded-2xl p-5 border-white/10 flex items-center justify-between group/item">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs border ${item.slot.session === 'AM'
                              ? 'bg-primary/10 text-primary border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                              }`}>
                              {item.slot.session}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{item.slot.session === 'AM' ? 'Morning Shift' : 'Afternoon Shift'}</p>
                              <h4 className="text-sm font-bold text-foreground group-hover/item:text-primary transition-colors">{item.examName}</h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <ChevronRight size={16} className="text-muted-foreground opacity-30 group-hover/item:translate-x-1 transition-all" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-20 text-center border-white/5 opacity-60">
                <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarDays size={24} className="text-muted-foreground opacity-20" />
                </div>
                <p className="text-sm font-bold tracking-tight">Zero Duties Assigned</p>
                <p className="text-xs mt-1">Enjoy your free time! No invigilation tasks detected.</p>
              </div>
            )}
          </div>

          {/* Formal Table for Print Only */}
          <table className="hidden print:table print-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th style={{ width: '120px' }}>Date</th>
                <th style={{ width: '100px' }}>Day</th>
                <th style={{ width: '80px' }}>Session</th>
                <th>Examination Name</th>
                <th style={{ width: '130px' }}>Signature</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((item, index) => (
                <tr key={item.id}>
                  <td className="text-center">{index + 1}</td>
                  <td>{formatDate(item.slot.date)}</td>
                  <td>{new Date(item.slot.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}</td>
                  <td className="text-center">
                    <span className="print-badge">
                      {item.slot.session}
                    </span>
                  </td>
                  <td className="font-bold">{item.examName}</td>
                  <td></td>
                </tr>
              ))}
              {schedule.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-black italic bg-gray-50">
                    No duties assigned to this faculty member.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Unavailability - Screen Only */}
          {myUnavailability.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both print:hidden">
              <div className="flex items-center gap-2 mb-4 px-1">
                <AlertTriangle size={18} className="text-rose-500" />
                <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Marked Exceptions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myUnavailability
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map(u => (
                    <div key={u.id} className="glass-card rounded-xl p-4 border-rose-500/10 bg-rose-500/[0.02] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 bg-rose-500/30 rounded-full" />
                        <div>
                          <p className="text-xs font-bold text-foreground uppercase">{formatDate(u.date)}</p>
                          <p className="text-[10px] font-bold text-rose-500/70 uppercase tracking-widest">{u.session} Session</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-rose-500/40 uppercase">Unavailable</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
