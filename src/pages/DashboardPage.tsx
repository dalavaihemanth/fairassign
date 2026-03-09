import { useAppState } from '@/context/AppContext';
import { Users, Calendar, ClipboardCheck, AlertTriangle, BookOpen, TrendingUp, BarChart3, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

export default function DashboardPage() {
  const { faculty, slots, assignments, unavailability, examinations, currentExamId, crossExamDutyCount } = useAppState();

  const currentExam = examinations.find(e => e.id === currentExamId);
  const totalDuties = assignments.length;
  const stats = [
    { label: 'Total Faculty', value: faculty.length, icon: Users, color: 'from-blue-500/20 to-indigo-500/20 text-indigo-500 border-indigo-500/20', iconBg: 'bg-indigo-500/10' },
    { label: 'Exam Slots', value: slots.length, icon: Calendar, color: 'from-amber-500/20 to-orange-500/20 text-orange-500 border-orange-500/20', iconBg: 'bg-orange-500/10' },
    { label: 'Assignments', value: totalDuties, icon: ClipboardCheck, color: 'from-emerald-500/20 to-teal-500/20 text-teal-500 border-teal-500/20', iconBg: 'bg-teal-500/10' },
    { label: 'Unavailabilities', value: unavailability.length, icon: AlertTriangle, color: 'from-rose-500/20 to-red-500/20 text-red-500 border-red-500/20', iconBg: 'bg-red-500/10' },
  ];

  const amDuties = assignments.filter(a => {
    const slot = slots.find(s => s.id === a.slotId);
    return slot?.session === 'AM';
  }).length;
  const pmDuties = totalDuties - amDuties;

  // Prepare chart data: Top 10 faculty by duty count
  const chartData = faculty
    .map(f => ({
      name: f.name.split(' ')[0],
      fullName: f.name,
      duties: crossExamDutyCount.get(f.id) ?? 0,
      current: assignments.filter(a => a.facultyId === f.id).length
    }))
    .sort((a, b) => b.duties - a.duties)
    .slice(0, 8);

  if (!currentExam) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of the invigilation system</p>
        </div>
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No examination selected</p>
          <p className="text-xs mt-1">Create an examination from the sidebar to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            {currentExam.name} · <span className="text-primary/70">Overview</span>
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-wider animate-pulse">
          <TrendingUp size={12} />
          Real-time Sync Active
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map(({ label, value, icon: Icon, color, iconBg }, i) => (
          <div
            key={label}
            className="glass-card hover-lift rounded-2xl p-6 relative overflow-hidden group border-white/10"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-20 group-hover:opacity-40 transition-opacity duration-500`} />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-4xl font-display font-bold text-foreground tracking-tighter">{value}</p>
              </div>
              <div className={`p-4 rounded-2xl ${iconBg} shadow-inner border border-white/5`}>
                <Icon size={24} className="opacity-80 group-hover:scale-110 transition-transform duration-500" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-6 border-white/10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <BarChart3 size={18} className="text-primary" />
                  Duty Distribution
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">Top performing faculty across all exams</p>
              </div>
            </div>

            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 500, fill: 'currentColor', opacity: 0.6 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 500, fill: 'currentColor', opacity: 0.6 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="glass-card p-3 border-primary/20 shadow-xl rounded-xl">
                            <p className="text-xs font-bold text-foreground mb-1">{payload[0].payload.fullName}</p>
                            <div className="space-y-1">
                              <p className="text-[10px] text-primary flex items-center justify-between gap-4 font-medium">
                                Total Duties: <span className="font-bold">{payload[0].value}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground flex items-center justify-between gap-4 font-medium">
                                Current Exam: <span className="font-bold text-foreground/80">{payload[1].value}</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="duties" radius={[6, 6, 0, 0]} barSize={32}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - index * 0.08})`} />
                    ))}
                  </Bar>
                  <Bar dataKey="current" fill="currentColor" radius={[6, 6, 0, 0]} barSize={32} opacity={0.15} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Info Column */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <h3 className="text-base font-bold text-foreground mb-6 flex items-center gap-2 relative">
              <TrendingUp size={18} className="text-emerald-500" />
              Session Balance
            </h3>

            <div className="space-y-6 relative">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Morning (AM)</span>
                <span className="text-lg font-bold text-foreground">{amDuties} duties</span>
              </div>
              <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  style={{ width: `${(amDuties / Math.max(1, totalDuties)) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-8">
                <span className="text-sm font-medium text-muted-foreground">Afternoon (PM)</span>
                <span className="text-lg font-bold text-foreground">{pmDuties} duties</span>
              </div>
              <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                  style={{ width: `${(pmDuties / Math.max(1, totalDuties)) * 100}%` }}
                />
              </div>

              <div className="pt-4 border-t border-border mt-6">
                <p className="text-[10px] text-muted-foreground italic font-medium">
                  {Math.abs(amDuties - pmDuties) <= 2
                    ? "✨ Your session load is perfectly balanced!"
                    : "⚠️ Consider rebalancing sessions for fairer distribution."}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 border-white/10">
            <h3 className="text-base font-bold text-foreground mb-4">Quick Insights</h3>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/20 border border-white/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Most Busy Faculty</p>
                <p className="text-sm font-semibold text-foreground">{chartData[0]?.fullName || 'None'}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/20 border border-white/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Least Busy Faculty</p>
                <p className="text-sm font-semibold text-foreground">
                  {faculty
                    .sort((a, b) => (crossExamDutyCount.get(a.id) ?? 0) - (crossExamDutyCount.get(b.id) ?? 0))
                  [0]?.name || 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-exam duty history */}
      {faculty.length > 0 && examinations.length > 1 && (() => {
        // Build per-exam duty counts for each faculty
        const perExamCounts = new Map<string, Map<string, number>>();
        for (const exam of examinations) {
          const source = exam.publishedAssignments.length > 0 ? exam.publishedAssignments : exam.assignments;
          const counts = new Map<string, number>();
          for (const a of source) {
            counts.set(a.facultyId, (counts.get(a.facultyId) ?? 0) + 1);
          }
          perExamCounts.set(exam.id, counts);
        }
        const allExams = examinations;

        return (
          <div className="glass-card rounded-2xl overflow-hidden border-white/10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Cumulative Duty History</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider opacity-60">Distribution across {allExams.length} examinations</p>
              </div>
              <BookOpen size={18} className="text-muted-foreground/30" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="text-left p-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px] sticky left-0 bg-muted/95 backdrop-blur z-20">Faculty</th>
                    {allExams.map(exam => (
                      <th key={exam.id} className="text-center p-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px] whitespace-nowrap">
                        <span className="truncate max-w-[120px] inline-block" title={exam.name}>{exam.name}</span>
                        {exam.status === 'archived' && <span className="text-[8px] text-rose-500 block font-black">ARCHIVED</span>}
                      </th>
                    ))}
                    <th className="text-center p-4 font-bold text-primary uppercase tracking-widest text-[10px]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {faculty
                    .map(f => ({ ...f, totalDuties: crossExamDutyCount.get(f.id) ?? 0 }))
                    .sort((a, b) => b.totalDuties - a.totalDuties)
                    .map(f => (
                      <tr key={f.id} className="group hover:bg-primary/[0.02] transition-colors">
                        <td className="p-4 font-semibold text-foreground sticky left-0 bg-card z-10 whitespace-nowrap group-hover:bg-muted/50 transition-colors uppercase tracking-tight">{f.name}</td>
                        {allExams.map(exam => {
                          const count = perExamCounts.get(exam.id)?.get(f.id) ?? 0;
                          return (
                            <td key={exam.id} className={`text-center p-4 font-medium ${count > 0 ? 'text-foreground' : 'text-muted-foreground/10'}`}>
                              {count || '—'}
                            </td>
                          );
                        })}
                        <td className="text-center p-4 font-black text-primary bg-primary/5">{f.totalDuties}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Smart Project Workflow */}
      <div className="glass-card rounded-2xl p-8 relative overflow-hidden group border-primary/20 bg-primary/[0.01]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none transition-transform group-hover:scale-125 duration-1000" />
        <h2 className="text-xl font-display font-bold text-foreground mb-8 relative flex items-center gap-3">
          <BookOpen className="text-primary" size={24} />
          Project Workflow
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative">
          {(() => {
            const hasExams = examinations.length > 0;
            const hasFaculty = faculty.length > 0;
            const hasSlots = slots.length > 0;
            const hasUnavailability = unavailability.length > 0;
            const isPublished = currentExam.publishedAssignments.length > 0;

            let currentStepIndex = 1;
            if (!hasExams) currentStepIndex = 1;
            else if (!hasFaculty) currentStepIndex = 2;
            else if (!hasSlots) currentStepIndex = 3;
            else if (!hasUnavailability && !isPublished) currentStepIndex = 4;
            else currentStepIndex = 5;

            return [
              { step: 1, text: "Define the examination (e.g. Mid-Sem)", done: hasExams },
              { step: 2, text: "Onboard faculty and set duty limits", done: hasFaculty },
              { step: 3, text: "Create exam slots and sessions", done: hasSlots },
              { step: 4, text: "Mark unavailability for faculty", done: hasUnavailability || isPublished },
              { step: 5, text: "Generate schedule & Publish", done: isPublished },
            ].map((item, i) => {
              const isActive = currentStepIndex === item.step;
              const isDone = item.done;

              return (
                <div key={i} className={`flex flex-col gap-3 p-4 rounded-xl border transition-all duration-500 
                  ${isActive ? 'bg-primary/10 border-primary/30 shadow-lg scale-105 z-10' : 'bg-white/5 border-white/10 opacity-70'} 
                  ${isDone && !isActive ? 'border-emerald-500/20 bg-emerald-500/[0.02] opacity-100' : ''}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-colors duration-500
                    ${isActive ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.5)]' :
                      isDone ? 'bg-emerald-500 text-white' : 'bg-muted/40 text-muted-foreground border border-white/10'}`}>
                    {isDone && !isActive ? <CheckCircle2 size={16} /> : item.step}
                  </span>
                  <p className={`text-xs font-bold leading-relaxed transition-colors duration-500
                    ${isActive ? 'text-foreground' : isDone ? 'text-emerald-500/80' : 'text-muted-foreground opacity-80'}`}>
                    {item.text}
                  </p>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
