import { useState, useCallback, useMemo, DragEvent } from 'react';
import { useAppState } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { generateSchedule, generateMultipleSchedules, rebalanceSchedule } from '@/lib/scheduler';
import type { ScheduleVariant } from '@/lib/scheduler';
import { formatDate } from '@/types/invigilation';
import type { Assignment } from '@/types/invigilation';
import { Zap, Trash2, AlertTriangle, Download, GripVertical, Info, FileSpreadsheet, Save, FolderOpen, X, Pencil, Undo2, Pin, Send, ArrowLeftRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { utils, writeFile } from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface DragData {
  facultyId: string;
  slotId: string;
}

interface ConflictWarning {
  facultyId: string;
  facultyName: string;
  type: 'same-day-double' | 'max-duties' | 'unavailable' | 'consecutive-gap';
  detail: string;
}

export default function AllocationPage() {
  const { faculty, slots, unavailability, assignments, constraints, setAssignments, setConstraints, clearAssignments, savedSchedules, saveSchedule, loadSchedule, deleteSchedule, renameSchedule, pinnedKeys, setPinnedKeys, lockedTotals, setLockedTotals, facultyGaps, setFacultyGaps, publishedAssignments, publishSchedule, unpublishSchedule, undoStack, setUndoStack, crossExamDutyCount, crossExamSlotBlocks } = useAppState();
  const [generationWarnings, setGenerationWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingScheduleName, setEditingScheduleName] = useState('');
  const [variants, setVariants] = useState<ScheduleVariant[]>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFacultyId, setSwapFacultyId] = useState<string | null>(null);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), [...assignments]]);
  }, [assignments]);

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      const next = [...prev];
      const last = next.pop();
      if (last) setAssignments(last);
      return next;
    });
    setPinnedKeys(new Set());
    setLockedTotals(new Map());
    toast({ title: 'Undone', description: 'Reverted to previous schedule state (pins & locks cleared)' });
  }, [setAssignments]);

  // Detect conflicts in current assignments
  const conflicts = useMemo<ConflictWarning[]>(() => {
    const result: ConflictWarning[] = [];
    const slotMap = new Map(slots.map(s => [s.id, s]));

    // Build per-faculty assignment list
    const facultyAssignments = new Map<string, string[]>();
    assignments.forEach(a => {
      if (!facultyAssignments.has(a.facultyId)) facultyAssignments.set(a.facultyId, []);
      facultyAssignments.get(a.facultyId)!.push(a.slotId);
    });

    for (const f of faculty) {
      const fSlotIds = facultyAssignments.get(f.id) ?? [];
      const fSlots = fSlotIds.map(sid => slotMap.get(sid)).filter(Boolean);

      // Check max duties
      if (fSlotIds.length > f.maxDuties) {
        result.push({
          facultyId: f.id,
          facultyName: f.name,
          type: 'max-duties',
          detail: `${f.name} has ${fSlotIds.length} duties (max: ${f.maxDuties})`,
        });
      }

      // Check same-day double duty
      const dateMap = new Map<string, string[]>();
      for (const s of fSlots) {
        if (!s) continue;
        if (!dateMap.has(s.date)) dateMap.set(s.date, []);
        dateMap.get(s.date)!.push(s.session);
      }
      for (const [date, sessions] of dateMap) {
        if (sessions.length > 1) {
          result.push({
            facultyId: f.id,
            facultyName: f.name,
            type: 'same-day-double',
            detail: `${f.name} assigned both AM & PM on ${formatDate(date)}`,
          });
        }
      }

      // Check unavailability
      for (const s of fSlots) {
        if (!s) continue;
        const isUnavail = unavailability.some(u => u.facultyId === f.id && u.date === s.date && u.session === s.session);
        if (isUnavail) {
          result.push({
            facultyId: f.id,
            facultyName: f.name,
            type: 'unavailable',
            detail: `${f.name} is unavailable on ${formatDate(s.date)} ${s.session}`,
          });
        }
      }

      // Check consecutive gap (PM then next day AM)
      const sortedFSlots = [...fSlots].filter(Boolean).sort((a, b) => {
        const dc = a!.date.localeCompare(b!.date);
        if (dc !== 0) return dc;
        return a!.session === 'AM' ? -1 : 1;
      });
      for (let i = 0; i < sortedFSlots.length - 1; i++) {
        const curr = sortedFSlots[i]!;
        const next = sortedFSlots[i + 1]!;
        if (curr.session === 'PM') {
          const currDate = new Date(curr.date + 'T00:00:00');
          const nextDate = new Date(next.date + 'T00:00:00');
          const diffDays = (nextDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays === 1 && next.session === 'AM') {
            result.push({
              facultyId: f.id,
              facultyName: f.name,
              type: 'consecutive-gap',
              detail: `${f.name} has PM on ${formatDate(curr.date)} then AM on ${formatDate(next.date)} (no gap)`,
            });
          }
        }
      }
    }

    // Check under-staffed slots
    const slotCounts = new Map<string, number>();
    assignments.forEach(a => slotCounts.set(a.slotId, (slotCounts.get(a.slotId) ?? 0) + 1));
    for (const s of slots) {
      const count = slotCounts.get(s.id) ?? 0;
      if (count < s.required) {
        result.push({
          facultyId: '',
          facultyName: '',
          type: 'max-duties',
          detail: `${formatDate(s.date)} ${s.session} has ${count}/${s.required} faculty (under-staffed)`,
        });
      }
    }

    return result;
  }, [assignments, faculty, slots, unavailability]);

  // Set of facultyIds with conflicts for row highlighting
  const conflictFacultyIds = useMemo(() => new Set(conflicts.filter(c => c.facultyId).map(c => c.facultyId)), [conflicts]);

  // Set of "facultyId:slotId" cells that have conflicts
  const conflictCells = useMemo(() => {
    const cells = new Set<string>();
    const slotMap = new Map(slots.map(s => [s.id, s]));

    for (const c of conflicts) {
      if (!c.facultyId) continue;
      if (c.type === 'unavailable') {
        // Mark the specific unavailable cell
        for (const a of assignments) {
          if (a.facultyId !== c.facultyId) continue;
          const s = slotMap.get(a.slotId);
          if (s && unavailability.some(u => u.facultyId === c.facultyId && u.date === s.date && u.session === s.session)) {
            cells.add(`${c.facultyId}:${a.slotId}`);
          }
        }
      } else if (c.type === 'same-day-double') {
        // Mark all cells on the conflicting day
        for (const a of assignments) {
          if (a.facultyId !== c.facultyId) continue;
          const s = slotMap.get(a.slotId);
          if (s && c.detail.includes(formatDate(s.date))) {
            cells.add(`${c.facultyId}:${a.slotId}`);
          }
        }
      }
    }
    return cells;
  }, [conflicts, assignments, slots, unavailability]);

  const handleGenerate = () => {
    pushUndo();
    setPinnedKeys(new Set());
    setLockedTotals(new Map());
    const results = generateMultipleSchedules(faculty, slots, unavailability, constraints, 5, facultyGaps, crossExamDutyCount, crossExamSlotBlocks);
    setVariants(results);
    setShowVariants(true);
    if (results.length > 0) {
      setAssignments(results[0].assignments);
      setGenerationWarnings(results[0].warnings);
    }
  };

  const handleSelectVariant = (v: ScheduleVariant) => {
    setAssignments(v.assignments);
    setGenerationWarnings(v.warnings);
    toast({ title: 'Applied', description: `"${v.name}" schedule applied` });
  };

  const sortedSlots = [...slots].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return a.session === 'AM' ? -1 : 1;
  });

  const assignmentMap = new Map<string, string[]>();
  assignments.forEach(a => {
    if (!assignmentMap.has(a.slotId)) assignmentMap.set(a.slotId, []);
    const f = faculty.find(x => x.id === a.facultyId);
    if (f) assignmentMap.get(a.slotId)!.push(f.name);
  });

  const facultySlotMap = new Map<string, Set<string>>();
  assignments.forEach(a => {
    if (!facultySlotMap.has(a.facultyId)) facultySlotMap.set(a.facultyId, new Set());
    facultySlotMap.get(a.facultyId)!.add(a.slotId);
  });

  const isAssigned = (facultyId: string, slotId: string) =>
    facultySlotMap.get(facultyId)?.has(slotId) ?? false;

  // After manual changes, rebalance the schedule to fix violations
  const checkAndNotifyConflicts = useCallback((nextAssignments: Assignment[], newPinned?: Set<string>) => {
    pushUndo();
    if (newPinned && newPinned.size > 0) {
      const allPinned = new Set([...pinnedKeys, ...newPinned]);
      setPinnedKeys(allPinned);
      const rebalanced = rebalanceSchedule(nextAssignments, allPinned, faculty, slots, unavailability, constraints, lockedTotals, facultyGaps, crossExamDutyCount, crossExamSlotBlocks);
      setAssignments(rebalanced.assignments);
      if (rebalanced.warnings.length > 0) {
        setGenerationWarnings(rebalanced.warnings);
      }
      toast({ title: 'Auto-rebalanced', description: `Schedule adjusted (${allPinned.size} manual assignments preserved)` });
    } else {
      setAssignments(nextAssignments);
    }
  }, [setAssignments, faculty, slots, unavailability, constraints, pushUndo, pinnedKeys, lockedTotals]);

  const onDragStart = useCallback((e: DragEvent, facultyId: string, slotId: string) => {
    const data: DragData = { facultyId, slotId };
    e.dataTransfer.setData('application/json', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
    setDragging(`${facultyId}:${slotId}`);
  }, []);

  const onDragOver = useCallback((e: DragEvent, facultyId: string, slotId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(`${facultyId}:${slotId}`);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(null), []);
  const onDragEnd = useCallback(() => { setDragging(null); setDragOver(null); }, []);

  const onDrop = useCallback((e: DragEvent, targetFacultyId: string, targetSlotId: string) => {
    e.preventDefault();
    setDragOver(null);
    setDragging(null);

    let source: DragData;
    try {
      source = JSON.parse(e.dataTransfer.getData('application/json'));
    } catch { return; }

    if (source.facultyId === targetFacultyId && source.slotId === targetSlotId) return;

    const srcFaculty = faculty.find(f => f.id === source.facultyId);
    const tgtFaculty = faculty.find(f => f.id === targetFacultyId);

    let next = [...assignments];
    const pinned = new Set<string>();

    if (source.facultyId === targetFacultyId) {
      next = next.filter(a => !(a.facultyId === source.facultyId && a.slotId === source.slotId));
      if (!next.some(a => a.facultyId === targetFacultyId && a.slotId === targetSlotId)) {
        next.push({ id: crypto.randomUUID(), facultyId: source.facultyId, slotId: targetSlotId });
      }
      pinned.add(`${source.facultyId}:${targetSlotId}`);
      toast({ title: 'Reassigned', description: `${srcFaculty?.name} moved to different slot` });
    } else if (source.slotId === targetSlotId) {
      const targetIsAssigned = next.some(a => a.facultyId === targetFacultyId && a.slotId === targetSlotId);
      if (targetIsAssigned) {
        next = next.filter(a => !(a.facultyId === source.facultyId && a.slotId === source.slotId));
        next = next.filter(a => !(a.facultyId === targetFacultyId && a.slotId === targetSlotId));
        next.push({ id: crypto.randomUUID(), facultyId: targetFacultyId, slotId: source.slotId });
        next.push({ id: crypto.randomUUID(), facultyId: source.facultyId, slotId: targetSlotId });
        pinned.add(`${targetFacultyId}:${source.slotId}`);
        pinned.add(`${source.facultyId}:${targetSlotId}`);
        toast({ title: 'Swapped', description: `${srcFaculty?.name} ↔ ${tgtFaculty?.name}` });
      } else {
        next = next.filter(a => !(a.facultyId === source.facultyId && a.slotId === source.slotId));
        next.push({ id: crypto.randomUUID(), facultyId: targetFacultyId, slotId: targetSlotId });
        pinned.add(`${targetFacultyId}:${targetSlotId}`);
        toast({ title: 'Reassigned', description: `Slot reassigned to ${tgtFaculty?.name}` });
      }
    } else {
      const targetIsAssigned = next.some(a => a.facultyId === targetFacultyId && a.slotId === targetSlotId);
      next = next.filter(a => !(a.facultyId === source.facultyId && a.slotId === source.slotId));
      if (targetIsAssigned) {
        next = next.filter(a => !(a.facultyId === targetFacultyId && a.slotId === targetSlotId));
        next.push({ id: crypto.randomUUID(), facultyId: source.facultyId, slotId: targetSlotId });
        next.push({ id: crypto.randomUUID(), facultyId: targetFacultyId, slotId: source.slotId });
        pinned.add(`${source.facultyId}:${targetSlotId}`);
        pinned.add(`${targetFacultyId}:${source.slotId}`);
        toast({ title: 'Swapped', description: `${srcFaculty?.name} ↔ ${tgtFaculty?.name}` });
      } else {
        next.push({ id: crypto.randomUUID(), facultyId: targetFacultyId, slotId: targetSlotId });
        pinned.add(`${targetFacultyId}:${targetSlotId}`);
        toast({ title: 'Moved', description: `Duty moved to ${tgtFaculty?.name}` });
      }
    }

    checkAndNotifyConflicts(next, pinned);
  }, [faculty, assignments, checkAndNotifyConflicts]);

  const toggleCell = useCallback((facultyId: string, slotId: string) => {
    const exists = assignments.some(a => a.facultyId === facultyId && a.slotId === slotId);
    if (exists) {
      checkAndNotifyConflicts(assignments.filter(a => !(a.facultyId === facultyId && a.slotId === slotId)), new Set());
    } else {
      const pinned = new Set([`${facultyId}:${slotId}`]);
      checkAndNotifyConflicts([...assignments, { id: crypto.randomUUID(), facultyId, slotId }], pinned);
    }
  }, [assignments, checkAndNotifyConflicts]);

  const [swapConfirm, setSwapConfirm] = useState<{ srcId: string; tgtId: string } | null>(null);

  const handleSwapFaculty = useCallback((facultyId: string) => {
    if (!swapFacultyId) {
      setSwapFacultyId(facultyId);
      return;
    }

    if (swapFacultyId === facultyId) {
      setSwapFacultyId(null);
      return;
    }

    // Show confirmation dialog instead of swapping immediately
    setSwapConfirm({ srcId: swapFacultyId, tgtId: facultyId });
  }, [swapFacultyId]);

  const executeSwap = useCallback(() => {
    if (!swapConfirm) return;
    const { srcId, tgtId } = swapConfirm;
    const srcFaculty = faculty.find(f => f.id === srcId);
    const tgtFaculty = faculty.find(f => f.id === tgtId);

    pushUndo();
    const next = assignments.map(a => {
      if (a.facultyId === srcId) return { ...a, id: crypto.randomUUID(), facultyId: tgtId };
      if (a.facultyId === tgtId) return { ...a, id: crypto.randomUUID(), facultyId: srcId };
      return a;
    });

    setAssignments(next);
    setSwapFacultyId(null);
    setSwapConfirm(null);
    toast({ title: 'Faculty Swapped', description: `${srcFaculty?.name} ↔ ${tgtFaculty?.name} — all assignments exchanged` });
  }, [swapConfirm, assignments, faculty, pushUndo, setAssignments]);

  // Compute swap preview data
  const swapPreview = useMemo(() => {
    if (!swapConfirm) return null;
    const { srcId, tgtId } = swapConfirm;
    const srcFaculty = faculty.find(f => f.id === srcId);
    const tgtFaculty = faculty.find(f => f.id === tgtId);
    const slotMap = new Map(slots.map(s => [s.id, s]));

    const srcSlots = assignments.filter(a => a.facultyId === srcId).map(a => slotMap.get(a.slotId)).filter(Boolean);
    const tgtSlots = assignments.filter(a => a.facultyId === tgtId).map(a => slotMap.get(a.slotId)).filter(Boolean);

    const fmtSlots = (slotList: typeof srcSlots) =>
      slotList.sort((a, b) => a!.date.localeCompare(b!.date) || (a!.session === 'AM' ? -1 : 1))
        .map(s => `${formatDate(s!.date)} ${s!.session}`);

    return {
      srcName: srcFaculty?.name ?? '?',
      tgtName: tgtFaculty?.name ?? '?',
      srcDuties: srcSlots.length,
      tgtDuties: tgtSlots.length,
      srcSlotLabels: fmtSlots(srcSlots),
      tgtSlotLabels: fmtSlots(tgtSlots),
    };
  }, [swapConfirm, faculty, slots, assignments]);

  const handleTotalChange = useCallback((facultyId: string, desiredTotal: number) => {
    const f = faculty.find(x => x.id === facultyId);
    if (!f) return;

    if (desiredTotal > f.maxDuties) {
      toast({ title: 'Max capacity reached', description: `${f.name} can have at most ${f.maxDuties} duties`, variant: 'destructive' });
      return;
    }
    if (desiredTotal < 0) return;

    const currentSlots = assignments.filter(a => a.facultyId === facultyId);
    const currentTotal = currentSlots.length;
    if (desiredTotal === currentTotal) return;

    pushUndo();
    let next = [...assignments];
    const pinned = new Set([...pinnedKeys]);

    if (desiredTotal < currentTotal) {
      // Remove non-pinned assignments first, then pinned if needed
      const toRemove = currentTotal - desiredTotal;
      const nonPinned = currentSlots.filter(a => !pinnedKeys.has(`${a.facultyId}:${a.slotId}`));
      const pinnedOnes = currentSlots.filter(a => pinnedKeys.has(`${a.facultyId}:${a.slotId}`));
      const removeList = [...nonPinned, ...pinnedOnes].slice(0, toRemove);
      const removeIds = new Set(removeList.map(a => a.id));
      next = next.filter(a => !removeIds.has(a.id));
      removeList.forEach(a => pinned.delete(`${a.facultyId}:${a.slotId}`));
      // Pin the remaining assignments for this faculty so rebalance doesn't re-add removed ones
      const remaining = currentSlots.filter(a => !removeIds.has(a.id));
      remaining.forEach(a => pinned.add(`${a.facultyId}:${a.slotId}`));
    } else {
      // Add assignments to available slots
      const toAdd = desiredTotal - currentTotal;
      const assignedSlotIds = new Set(currentSlots.map(a => a.slotId));
      const unavailMap = new Map<string, Set<string>>();
      unavailability.forEach(u => {
        if (!unavailMap.has(u.facultyId)) unavailMap.set(u.facultyId, new Set());
        unavailMap.get(u.facultyId)!.add(`${u.date}_${u.session}`);
      });
      const dayAssigned = new Set<string>();
      currentSlots.forEach(a => {
        const s = slots.find(x => x.id === a.slotId);
        if (s) dayAssigned.add(s.date);
      });

      const availableSlots = sortedSlots.filter(s => {
        if (assignedSlotIds.has(s.id)) return false;
        const unavail = unavailMap.get(facultyId);
        if (unavail && unavail.has(`${s.date}_${s.session}`)) return false;
        if (constraints.avoidSameDayDouble && dayAssigned.has(s.date)) return false;
        return true;
      });

      const added = availableSlots.slice(0, toAdd);
      if (added.length < toAdd) {
        toast({ title: 'Not enough available slots', description: `Could only add ${added.length} of ${toAdd} requested duties for ${f.name}` });
      }
      for (const s of added) {
        const newAssignment = { id: crypto.randomUUID(), facultyId, slotId: s.id };
        next.push(newAssignment);
        pinned.add(`${facultyId}:${s.id}`);
        dayAssigned.add(s.date);
      }
      // Also pin existing assignments for this faculty
      currentSlots.forEach(a => pinned.add(`${a.facultyId}:${a.slotId}`));
    }

    // Lock this faculty's total so future rebalances respect it
    const newLockedTotals = new Map(lockedTotals);
    newLockedTotals.set(facultyId, desiredTotal);
    setLockedTotals(newLockedTotals);

    setPinnedKeys(pinned);
    const rebalanced = rebalanceSchedule(next, pinned, faculty, slots, unavailability, constraints, newLockedTotals, facultyGaps, crossExamDutyCount, crossExamSlotBlocks);
    setAssignments(rebalanced.assignments);
    if (rebalanced.warnings.length > 0) setGenerationWarnings(rebalanced.warnings);
    toast({ title: 'Updated', description: `${f.name} locked to ${desiredTotal} duties` });
  }, [faculty, assignments, slots, unavailability, constraints, pinnedKeys, sortedSlots, pushUndo, setPinnedKeys, setAssignments, setGenerationWarnings]);

  const getExportData = () => {
    const header = ['Faculty', ...sortedSlots.map(s => `${formatDate(s.date)} ${s.session}`), 'Total'];
    const rows = faculty.map(f => {
      const fSlots = facultySlotMap.get(f.id);
      const cells = sortedSlots.map(s => (fSlots?.has(s.id) ? 'X' : ''));
      return [f.name, ...cells, String(fSlots?.size ?? 0)];
    });
    return { header, rows };
  };

  const exportCSV = () => {
    const { header, rows } = getExportData();
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invigilation_schedule.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const { header, rows } = getExportData();
    const ws = utils.aoa_to_sheet([header, ...rows]);
    // Auto-size columns
    ws['!cols'] = header.map((h, i) => ({ wch: Math.max(h.length, ...rows.map(r => (r[i] ?? '').length)) + 2 }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Schedule');
    writeFile(wb, 'invigilation_schedule.xlsx');
  };

  const conflictsByType = useMemo(() => {
    const grouped = { 'same-day-double': [] as ConflictWarning[], 'max-duties': [] as ConflictWarning[], 'unavailable': [] as ConflictWarning[], 'consecutive-gap': [] as ConflictWarning[] };
    conflicts.forEach(c => grouped[c.type].push(c));
    return grouped;
  }, [conflicts]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Allocation Matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">Auto-generate and view invigilation schedule. Drag cells to swap or reassign, click to toggle.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleGenerate} className="gap-2"><Zap size={16} /> Generate</Button>
          {assignments.length > 0 && (
            <>
              <Button variant="outline" onClick={handleUndo} disabled={undoStack.length === 0} className="gap-2"><Undo2 size={16} /> Undo{undoStack.length > 0 ? ` (${undoStack.length})` : ''}</Button>
              {pinnedKeys.size > 0 && (
                <Button variant="outline" onClick={() => setPinnedKeys(new Set())} className="gap-2"><Pin size={16} /> {pinnedKeys.size} pinned</Button>
              )}
              <Button
                variant={swapMode ? 'default' : 'outline'}
                onClick={() => { setSwapMode(!swapMode); setSwapFacultyId(null); }}
                className={`gap-2 ${swapMode ? 'bg-accent text-accent-foreground hover:bg-accent/90' : ''}`}
              >
                <ArrowLeftRight size={16} /> {swapMode ? 'Swap Mode ON' : 'Swap'}
              </Button>
              <Button variant="outline" onClick={exportCSV} className="gap-2"><Download size={16} /> CSV</Button>
              <Button variant="outline" onClick={exportExcel} className="gap-2"><FileSpreadsheet size={16} /> Excel</Button>
              {publishedAssignments.length > 0 ? (
                <Button variant="outline" onClick={() => { unpublishSchedule(); toast({ title: 'Unpublished', description: 'Schedule hidden from faculty view' }); }} className="gap-2 text-destructive"><Send size={16} /> Unpublish</Button>
              ) : (
                <Button variant="default" onClick={() => { publishSchedule(); toast({ title: 'Published!', description: 'Schedule is now visible to faculty on My Schedule' }); }} className="gap-2 bg-success hover:bg-success/90 text-success-foreground"><Send size={16} /> Publish</Button>
              )}
              <Button variant="outline" onClick={() => { pushUndo(); clearAssignments(); setGenerationWarnings([]); }} className="gap-2 text-destructive"><Trash2 size={16} /> Clear</Button>
            </>
          )}
          <Button variant={showSaved ? 'secondary' : 'outline'} onClick={() => setShowSaved(!showSaved)} className="gap-2">
            <FolderOpen size={16} /> Versions{savedSchedules.length > 0 ? ` (${savedSchedules.length})` : ''}
          </Button>
        </div>
      </div>

      {/* Schedule Variants Picker */}
      {showVariants && variants.length > 0 && (
        <div className="glass-card rounded-xl p-5 space-y-3 border border-primary/20">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Choose a Schedule Variant</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowVariants(false)} className="h-7 w-7 p-0"><X size={14} /></Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {variants.length} variants generated using different strategies. Sorted by balance (most even distribution first).
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((v, i) => {
              const isActive = JSON.stringify(assignments.map(a => `${a.facultyId}:${a.slotId}`).sort()) ===
                JSON.stringify(v.assignments.map(a => `${a.facultyId}:${a.slotId}`).sort());
              return (
                <button
                  key={v.id}
                  onClick={() => handleSelectVariant(v)}
                  className={`text-left rounded-lg border p-3 transition-all hover:shadow-md ${isActive
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border bg-background hover:bg-muted/30'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground">{v.name}</p>
                    {isActive && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Active</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <span className="text-muted-foreground">Assignments</span>
                    <span className="text-foreground font-medium">{v.stats.totalAssignments}</span>
                    <span className="text-muted-foreground">Avg Duties</span>
                    <span className="text-foreground font-medium">{v.stats.avgDuties}</span>
                    <span className="text-muted-foreground">Range</span>
                    <span className="text-foreground font-medium">{v.stats.minDuties}–{v.stats.maxDuties}</span>
                    <span className="text-muted-foreground">Spread</span>
                    <span className={`font-medium ${v.stats.spread <= 1 ? 'text-green-600' : v.stats.spread <= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {v.stats.spread} {v.stats.spread <= 1 ? '(excellent)' : v.stats.spread <= 3 ? '(good)' : '(uneven)'}
                    </span>
                  </div>
                  {v.warnings.length > 0 && (
                    <p className="text-[10px] text-destructive mt-1.5 flex items-center gap-1">
                      <AlertTriangle size={10} /> {v.warnings.length} warning{v.warnings.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Save & Load Schedule Versions */}
      {showSaved && (
        <div className="glass-card rounded-xl p-5 space-y-4 border border-border">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Schedule Versions</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowSaved(false)} className="h-7 w-7 p-0"><X size={14} /></Button>
          </div>

          {assignments.length > 0 && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Save current schedule as</Label>
                <Input
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder={`Version ${savedSchedules.length + 1}`}
                  className="mt-1 h-8 text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const name = saveName.trim() || `Version ${savedSchedules.length + 1}`;
                      saveSchedule(name);
                      setSaveName('');
                      toast({ title: 'Saved', description: `Schedule "${name}" saved` });
                    }
                  }}
                />
              </div>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => {
                  const name = saveName.trim() || `Version ${savedSchedules.length + 1}`;
                  saveSchedule(name);
                  setSaveName('');
                  toast({ title: 'Saved', description: `Schedule "${name}" saved` });
                }}
              >
                <Save size={14} /> Save
              </Button>
            </div>
          )}

          {savedSchedules.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No saved versions yet. Generate a schedule and save it.</p>
          ) : (
            <div className="space-y-1.5">
              {savedSchedules.map(s => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background p-2.5 hover:bg-muted/30 transition-colors">
                  {editingScheduleId === s.id ? (
                    <Input
                      value={editingScheduleName}
                      onChange={e => setEditingScheduleName(e.target.value)}
                      className="h-7 text-xs flex-1"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          renameSchedule(s.id, editingScheduleName.trim() || s.name);
                          setEditingScheduleId(null);
                        }
                        if (e.key === 'Escape') setEditingScheduleId(null);
                      }}
                      onBlur={() => {
                        renameSchedule(s.id, editingScheduleName.trim() || s.name);
                        setEditingScheduleId(null);
                      }}
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.assignments.length} assignments · {new Date(s.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => { loadSchedule(s.id); toast({ title: 'Loaded', description: `"${s.name}" loaded` }); }}>
                    <FolderOpen size={12} /> Load
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingScheduleId(s.id); setEditingScheduleName(s.name); }}>
                    <Pencil size={12} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { deleteSchedule(s.id); toast({ title: 'Deleted', description: `"${s.name}" removed` }); }}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Constraints */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Scheduling Constraints</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={constraints.avoidSameDayDouble} onCheckedChange={v => setConstraints({ ...constraints, avoidSameDayDouble: v })} />
            <Label className="text-sm text-muted-foreground">Avoid same-day double duty</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={constraints.respectMaxDuties} onCheckedChange={v => setConstraints({ ...constraints, respectMaxDuties: v })} />
            <Label className="text-sm text-muted-foreground">Respect max duties limit</Label>
          </div>
        </div>
      </div>

      {/* Generation Warnings */}
      {generationWarnings.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-1">
          <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2"><AlertTriangle size={14} /> Generation Warnings</h4>
          {generationWarnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-destructive">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      {/* Conflict Detection */}
      {assignments.length > 0 && conflicts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle size={16} />
            {conflicts.length} Constraint Violation{conflicts.length !== 1 ? 's' : ''} Detected
          </h4>
          {conflictsByType['same-day-double'].length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-destructive/80 uppercase tracking-wide">Same-Day Double Duty</p>
              {conflictsByType['same-day-double'].map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-destructive/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" /> {c.detail}
                </div>
              ))}
            </div>
          )}
          {conflictsByType['max-duties'].length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-destructive/80 uppercase tracking-wide">Duty Limit / Staffing</p>
              {conflictsByType['max-duties'].map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-destructive/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" /> {c.detail}
                </div>
              ))}
            </div>
          )}
          {conflictsByType['unavailable'].length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-destructive/80 uppercase tracking-wide">Unavailability Conflict</p>
              {conflictsByType['unavailable'].map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-destructive/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" /> {c.detail}
                </div>
              ))}
            </div>
          )}
          {conflictsByType['consecutive-gap'].length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-destructive/80 uppercase tracking-wide">Insufficient Gap</p>
              {conflictsByType['consecutive-gap'].map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-destructive/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" /> {c.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No conflicts badge */}
      {assignments.length > 0 && conflicts.length === 0 && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-center gap-2 text-sm text-success">
          <Info size={16} />
          <span className="font-medium">No constraint violations detected — schedule looks good!</span>
        </div>
      )}

      {/* Swap Mode Banner */}
      {swapMode && assignments.length > 0 && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-accent-foreground">
            <ArrowLeftRight size={16} />
            <span className="font-medium">
              {swapFacultyId
                ? `Selected ${faculty.find(f => f.id === swapFacultyId)?.name ?? 'faculty'} — now click another faculty name to swap all their assignments`
                : 'Click a faculty name to select them, then click another to swap all assignments'}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSwapMode(false); setSwapFacultyId(null); }} className="h-7 text-xs">
            <X size={14} className="mr-1" /> Exit Swap
          </Button>
        </div>
      )}

      {/* Matrix */}
      {assignments.length > 0 && sortedSlots.length > 0 && (
        <div className="glass-card rounded-xl overflow-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10">Faculty</th>
                {sortedSlots.map(s => (
                  <th key={s.id} className="text-center p-3 font-medium text-muted-foreground whitespace-nowrap">
                    {formatDate(s.date)}<br />
                    <span className={`text-xs ${s.session === 'AM' ? 'text-primary' : 'text-accent'}`}>{s.session}</span>
                  </th>
                ))}
                <th className="text-center p-3 font-medium text-muted-foreground">Total</th>
                <th className="text-center p-3 font-medium text-muted-foreground whitespace-nowrap" title="Minimum gap in days between duties for this faculty">Gap (d)</th>
              </tr>
            </thead>
            <tbody>
              {faculty.map(f => {
                const fSlots = facultySlotMap.get(f.id);
                const total = fSlots?.size ?? 0;
                const hasConflict = conflictFacultyIds.has(f.id);
                return (
                  <tr key={f.id} className={`border-b border-border/50 transition-colors ${swapMode && swapFacultyId === f.id ? 'bg-accent/10 ring-1 ring-accent/30 ring-inset' :
                    hasConflict ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/30'
                    }`}>
                    <td
                      className={`p-3 font-medium sticky left-0 z-10 whitespace-nowrap ${swapMode
                        ? swapFacultyId === f.id
                          ? 'bg-accent/15 text-accent-foreground cursor-pointer'
                          : swapFacultyId
                            ? 'bg-card text-foreground cursor-pointer hover:bg-accent/10'
                            : 'bg-card text-foreground cursor-pointer hover:bg-accent/5'
                        : hasConflict ? 'text-destructive bg-destructive/5' : 'text-foreground bg-card'
                        }`}
                      onClick={() => swapMode && handleSwapFaculty(f.id)}
                    >
                      {swapMode && (
                        <ArrowLeftRight size={12} className={`inline mr-1.5 -mt-0.5 ${swapFacultyId === f.id ? 'text-accent animate-pulse' : 'text-muted-foreground'}`} />
                      )}
                      {f.name}
                      {hasConflict && !swapMode && <AlertTriangle size={12} className="inline ml-1.5 -mt-0.5" />}
                    </td>
                    {sortedSlots.map(s => {
                      const assigned = isAssigned(f.id, s.id);
                      const cellKey = `${f.id}:${s.id}`;
                      const isOver = dragOver === cellKey;
                      const isDragging_ = dragging === cellKey;
                      const cellConflict = conflictCells.has(cellKey);
                      const isPinned = pinnedKeys.has(cellKey);

                      return (
                        <td
                          key={s.id}
                          className={`text-center p-1.5 transition-all ${isOver ? 'bg-primary/15 ring-2 ring-primary/40 ring-inset rounded' : ''
                            } ${isDragging_ ? 'opacity-40' : ''}`}
                          onDragOver={(e) => onDragOver(e, f.id, s.id)}
                          onDragLeave={onDragLeave}
                          onDrop={(e) => onDrop(e, f.id, s.id)}
                        >
                          {assigned ? (
                            <button
                              draggable={!swapMode}
                              onDragStart={(e) => !swapMode && onDragStart(e, f.id, s.id)}
                              onDragEnd={onDragEnd}
                              onClick={() => !swapMode && toggleCell(f.id, s.id)}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-md font-bold text-xs transition-colors group relative ${swapMode ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                                } ${cellConflict
                                  ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 ring-1 ring-destructive/40'
                                  : isPinned
                                    ? 'bg-primary/20 text-primary hover:bg-primary/30 ring-1 ring-primary/40'
                                    : 'bg-success/20 text-success hover:bg-success/30'
                                }`}
                              title={swapMode ? 'Use faculty name column to swap' : cellConflict ? 'Conflict! Drag to move/swap, click to remove' : isPinned ? 'Pinned (manual). Drag to move/swap, click to remove' : 'Drag to move/swap, click to remove'}
                            >
                              <span>{cellConflict ? '⚠' : isPinned ? '📌' : '✓'}</span>
                              {!swapMode && <GripVertical size={10} className="absolute -right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 text-muted-foreground" />}
                            </button>
                          ) : (
                            <button
                              onClick={() => !swapMode && toggleCell(f.id, s.id)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground/30 hover:bg-muted/50 hover:text-muted-foreground/60 transition-colors"
                              title={swapMode ? '' : 'Click to assign'}
                              disabled={swapMode}
                            >
                              —
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className={`text-center p-2 ${hasConflict ? 'text-destructive' : 'text-foreground'}`}>
                      {(() => {
                        const isLocked = lockedTotals.has(f.id);
                        const lockedVal = lockedTotals.get(f.id);
                        return (
                          <>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleTotalChange(f.id, total - 1)}
                                disabled={total <= 0}
                                className="w-5 h-5 rounded text-xs font-bold bg-muted hover:bg-muted-foreground/20 disabled:opacity-30 transition-colors"
                              >−</button>
                              <span className={`w-6 text-center font-semibold text-sm ${total >= f.maxDuties ? 'text-destructive' : isLocked ? 'text-primary' : ''}`}>
                                {total}
                              </span>
                              <button
                                onClick={() => handleTotalChange(f.id, total + 1)}
                                disabled={total >= f.maxDuties}
                                className="w-5 h-5 rounded text-xs font-bold bg-muted hover:bg-muted-foreground/20 disabled:opacity-30 transition-colors"
                                title={total >= f.maxDuties ? `Max capacity (${f.maxDuties}) reached` : undefined}
                              >+</button>
                            </div>
                            {isLocked ? (
                              <button
                                onClick={() => {
                                  const next = new Map(lockedTotals);
                                  next.delete(f.id);
                                  setLockedTotals(next);
                                  toast({ title: 'Unlocked', description: `${f.name} duty cap removed` });
                                }}
                                className="text-[10px] text-primary hover:text-primary/70 transition-colors cursor-pointer"
                                title="Click to unlock"
                              >
                                🔒{lockedVal}/{f.maxDuties}
                              </button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">/{f.maxDuties}</span>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="text-center p-2">
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={String(facultyGaps.get(f.id) ?? 0)}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          const next = new Map(facultyGaps);
                          if (val <= 0) next.delete(f.id);
                          else next.set(f.id, val);
                          setFacultyGaps(next);
                        }}
                        className="w-14 h-7 text-xs text-center p-1"
                        title={`Min gap in days between duties for ${f.name}`}
                      />
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-medium">
                <td className="p-3 text-muted-foreground sticky left-0 bg-muted/50 z-10">Assigned</td>
                {sortedSlots.map(s => {
                  const assigned = assignmentMap.get(s.id)?.length ?? 0;
                  const ok = assigned >= s.required;
                  return (
                    <td key={s.id} className={`text-center p-3 ${ok ? 'text-success' : 'text-destructive'}`}>
                      {assigned}/{s.required}
                    </td>
                  );
                })}
                <td className="text-center p-3 text-foreground">{assignments.length}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {assignments.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <Zap size={40} className="mx-auto mb-3 opacity-30" />
          <p>Click "Generate Schedule" to create the allocation matrix</p>
        </div>
      )}

      {/* Swap Confirmation Dialog */}
      <Dialog open={!!swapConfirm} onOpenChange={(open) => { if (!open) { setSwapConfirm(null); setSwapFacultyId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight size={18} /> Confirm Faculty Swap
            </DialogTitle>
            <DialogDescription>
              All assignments will be exchanged between these two faculty members.
            </DialogDescription>
          </DialogHeader>
          {swapPreview && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-start">
                {/* Source faculty */}
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm font-semibold text-foreground">{swapPreview.srcName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{swapPreview.srcDuties} duties</p>
                  <div className="mt-2 space-y-0.5">
                    {swapPreview.srcSlotLabels.map((label, i) => (
                      <p key={i} className="text-xs text-foreground bg-success/10 rounded px-1.5 py-0.5">{label}</p>
                    ))}
                    {swapPreview.srcSlotLabels.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No duties</p>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center pt-8">
                  <ArrowLeftRight size={20} className="text-accent" />
                </div>

                {/* Target faculty */}
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm font-semibold text-foreground">{swapPreview.tgtName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{swapPreview.tgtDuties} duties</p>
                  <div className="mt-2 space-y-0.5">
                    {swapPreview.tgtSlotLabels.map((label, i) => (
                      <p key={i} className="text-xs text-foreground bg-primary/10 rounded px-1.5 py-0.5">{label}</p>
                    ))}
                    {swapPreview.tgtSlotLabels.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No duties</p>
                    )}
                  </div>
                </div>
              </div>

              {/* After swap summary */}
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 text-center">
                After swap: <span className="font-medium text-foreground">{swapPreview.srcName}</span> will have {swapPreview.tgtDuties} duties,{' '}
                <span className="font-medium text-foreground">{swapPreview.tgtName}</span> will have {swapPreview.srcDuties} duties
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setSwapConfirm(null); setSwapFacultyId(null); }}>Cancel</Button>
            <Button onClick={executeSwap} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              <ArrowLeftRight size={14} /> Swap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
