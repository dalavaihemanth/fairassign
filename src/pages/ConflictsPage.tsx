import { useAppState } from '@/context/AppContext';
import { useCallback, useMemo } from 'react';
import { AlertTriangle, AlertCircle, Users, CalendarClock, Info, Layers, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/types/invigilation';
import { toast } from '@/hooks/use-toast';

type Severity = 'critical' | 'warning' | 'info';

interface Conflict {
  id: string;
  severity: Severity;
  category: string;
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  affected: string[];
  resolvableAssignmentIds?: string[]; // assignment IDs to remove to resolve
}

export default function ConflictsPage() {
  const { faculty, slots, assignments, setAssignments, constraints, crossExamDateBlocks, examinations, currentExamId } = useAppState();

  const conflicts = useMemo(() => {
    const result: Conflict[] = [];
    const slotMap = new Map(slots.map(s => [s.id, s]));
    const facultyMap = new Map(faculty.map(f => [f.id, f]));

    // 1. Slot shortages — slots with fewer assignments than required
    for (const slot of slots) {
      const assigned = assignments.filter(a => a.slotId === slot.id).length;
      if (assigned < slot.required) {
        result.push({
          id: `shortage-${slot.id}`,
          severity: 'critical',
          category: 'Slot Shortage',
          icon: AlertCircle,
          title: `${formatDate(slot.date)} ${slot.session} — ${slot.required - assigned} faculty short`,
          description: `Requires ${slot.required} invigilators but only ${assigned} assigned.`,
          affected: [],
        });
      }
    }

    // 2. Faculty overloaded — assigned more than maxDuties
    const dutyCount: Record<string, number> = {};
    faculty.forEach(f => (dutyCount[f.id] = 0));
    assignments.forEach(a => {
      dutyCount[a.facultyId] = (dutyCount[a.facultyId] ?? 0) + 1;
    });

    for (const f of faculty) {
      if (f.priority === 'exempt') continue;
      const effectiveMax = f.priority === 'reduced' ? Math.max(1, Math.floor(f.maxDuties / 2)) : f.maxDuties;
      const count = dutyCount[f.id] ?? 0;
      if (count > effectiveMax) {
        result.push({
          id: `overload-${f.id}`,
          severity: 'critical',
          category: 'Overloaded',
          icon: Users,
          title: `${f.name} — ${count}/${effectiveMax} duties`,
          description: `Assigned ${count} duties but effective maximum is ${effectiveMax}${f.priority === 'reduced' ? ' (reduced load)' : ''}.`,
          affected: [f.name],
        });
      }
    }

    // 3. Same-day double duties
    if (constraints.avoidSameDayDouble) {
      const facultyDateSlots: Record<string, Record<string, string[]>> = {};
      for (const a of assignments) {
        const slot = slotMap.get(a.slotId);
        if (!slot) continue;
        if (!facultyDateSlots[a.facultyId]) facultyDateSlots[a.facultyId] = {};
        if (!facultyDateSlots[a.facultyId][slot.date]) facultyDateSlots[a.facultyId][slot.date] = [];
        facultyDateSlots[a.facultyId][slot.date].push(slot.session);
      }
      for (const [fId, dates] of Object.entries(facultyDateSlots)) {
        const f = facultyMap.get(fId);
        if (!f) continue;
        for (const [date, sessions] of Object.entries(dates)) {
          if (sessions.length > 1) {
            result.push({
              id: `double-${fId}-${date}`,
              severity: 'warning',
              category: 'Same-Day Double',
              icon: CalendarClock,
              title: `${f.name} — double duty on ${formatDate(date)}`,
              description: `Assigned to both AM and PM sessions on the same day.`,
              affected: [f.name],
            });
          }
        }
      }
    }

    // 4. Consecutive-day duties
    const facultyDates: Record<string, Set<string>> = {};
    for (const a of assignments) {
      const slot = slotMap.get(a.slotId);
      if (!slot) continue;
      if (!facultyDates[a.facultyId]) facultyDates[a.facultyId] = new Set();
      facultyDates[a.facultyId].add(slot.date);
    }

    for (const [fId, dates] of Object.entries(facultyDates)) {
      const f = facultyMap.get(fId);
      if (!f) continue;
      const sorted = [...dates].sort();
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1] + 'T00:00:00');
        const curr = new Date(sorted[i] + 'T00:00:00');
        const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          result.push({
            id: `consecutive-${fId}-${sorted[i - 1]}-${sorted[i]}`,
            severity: 'info',
            category: 'Consecutive Days',
            icon: CalendarClock,
            title: `${f.name} — consecutive duties`,
            description: `Assigned on ${formatDate(sorted[i - 1])} and ${formatDate(sorted[i])} (back-to-back days).`,
            affected: [f.name],
          });
        }
      }
    }

    // 5. Exempt faculty with assignments (shouldn't happen but flag it)
    for (const f of faculty) {
      if (f.priority === 'exempt' && (dutyCount[f.id] ?? 0) > 0) {
        result.push({
          id: `exempt-assigned-${f.id}`,
          severity: 'critical',
          category: 'Exempt Violation',
          icon: AlertCircle,
          title: `${f.name} — exempt but has ${dutyCount[f.id]} duties`,
          description: `This faculty member is marked exempt but still has assignments.`,
          affected: [f.name],
        });
      }
    }

    // 6. Cross-exam same-day assignments
    if (crossExamDateBlocks && crossExamDateBlocks.size > 0) {
      const otherExamNames = new Map<string, string>();
      for (const exam of examinations) {
        if (exam.id !== currentExamId) {
          for (const s of exam.slots) {
            const source = exam.publishedAssignments.length > 0 ? exam.publishedAssignments : exam.assignments;
            for (const a of source) {
              if (a.slotId === s.id) {
                const key = `${a.facultyId}_${s.date}`;
                otherExamNames.set(key, exam.name);
              }
            }
          }
        }
      }

      for (const a of assignments) {
        const slot = slotMap.get(a.slotId);
        if (!slot) continue;
        const f = facultyMap.get(a.facultyId);
        if (!f) continue;
        const blockedDates = crossExamDateBlocks.get(a.facultyId);
        if (blockedDates?.has(slot.date)) {
          const otherExam = otherExamNames.get(`${a.facultyId}_${slot.date}`) ?? 'another exam';
          result.push({
            id: `cross-exam-${a.facultyId}-${slot.date}`,
            severity: 'warning',
            category: 'Cross-Exam Clash',
            icon: Layers,
            title: `${f.name} — assigned in multiple exams on ${formatDate(slot.date)}`,
            description: `Also assigned in "${otherExam}" on the same day. Remove from current exam to resolve.`,
            affected: [f.name],
            resolvableAssignmentIds: [a.id],
          });
        }
      }
    }

    // Sort: critical first, then warning, then info
    const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
    result.sort((a, b) => order[a.severity] - order[b.severity]);
    return result;
  }, [faculty, slots, assignments, constraints, crossExamDateBlocks, examinations, currentExamId]);

  const resolvableConflicts = conflicts.filter(c => c.resolvableAssignmentIds && c.resolvableAssignmentIds.length > 0);

  const resolveConflict = useCallback((conflict: Conflict) => {
    if (!conflict.resolvableAssignmentIds) return;
    const idsToRemove = new Set(conflict.resolvableAssignmentIds);
    setAssignments(assignments.filter(a => !idsToRemove.has(a.id)));
    toast({ title: 'Resolved', description: `Removed ${conflict.affected[0]}'s conflicting assignment from current exam.` });
  }, [assignments, setAssignments]);

  const resolveAllCrossExam = useCallback(() => {
    const allIds = new Set(resolvableConflicts.flatMap(c => c.resolvableAssignmentIds ?? []));
    if (allIds.size === 0) return;
    setAssignments(assignments.filter(a => !allIds.has(a.id)));
    toast({ title: 'All cross-exam conflicts resolved', description: `Removed ${allIds.size} conflicting assignment(s) from current exam.` });
  }, [resolvableConflicts, assignments, setAssignments]);

  const criticalCount = conflicts.filter(c => c.severity === 'critical').length;
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;
  const infoCount = conflicts.filter(c => c.severity === 'info').length;

  const severityStyles: Record<Severity, { badge: string; border: string; bg: string }> = {
    critical: {
      badge: 'bg-destructive text-destructive-foreground',
      border: 'border-l-destructive',
      bg: 'bg-destructive/5',
    },
    warning: {
      badge: 'bg-accent text-accent-foreground',
      border: 'border-l-accent',
      bg: 'bg-accent/5',
    },
    info: {
      badge: 'bg-primary/15 text-primary',
      border: 'border-l-primary/40',
      bg: 'bg-primary/5',
    },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Conflict Detection</h1>
          <p className="text-sm text-muted-foreground mt-1">Scheduling issues and warnings for the current examination</p>
        </div>
        {resolvableConflicts.length > 1 && (
          <Button size="sm" variant="outline" onClick={resolveAllCrossExam} className="gap-1.5">
            <Zap size={14} />
            Resolve All Cross-Exam ({resolvableConflicts.length})
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <AlertCircle className="mx-auto text-destructive" size={20} />
          <p className="text-2xl font-display font-bold text-foreground mt-1">{criticalCount}</p>
          <p className="text-xs text-muted-foreground">Critical</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <AlertTriangle className="mx-auto text-accent" size={20} />
          <p className="text-2xl font-display font-bold text-foreground mt-1">{warningCount}</p>
          <p className="text-xs text-muted-foreground">Warnings</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <Info className="mx-auto text-primary" size={20} />
          <p className="text-2xl font-display font-bold text-foreground mt-1">{infoCount}</p>
          <p className="text-xs text-muted-foreground">Info</p>
        </div>
      </div>

      {/* Conflict list */}
      {conflicts.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto mb-3 text-success" size={32} />
          <p className="font-medium text-foreground">No conflicts detected</p>
          <p className="text-sm mt-1">Your schedule looks clean. Generate assignments to check for issues.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conflicts.map(c => {
            const styles = severityStyles[c.severity];
            const Icon = c.icon;
            return (
              <div
                key={c.id}
                className={`glass-card rounded-xl border-l-4 ${styles.border} ${styles.bg} p-4 flex items-start gap-3`}
              >
                <Icon size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{c.title}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles.badge} border-0`}>
                      {c.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                </div>
                {c.resolvableAssignmentIds && c.resolvableAssignmentIds.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => resolveConflict(c)} className="shrink-0 text-xs h-7 px-2 gap-1">
                    <Zap size={12} />
                    Resolve
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
