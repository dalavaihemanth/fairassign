import type { Faculty, ExamSlot, Unavailability, Assignment, ScheduleConstraints } from '@/types/invigilation';

interface AllocationResult {
  assignments: Assignment[];
  warnings: string[];
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateOneSchedule(
  faculty: Faculty[],
  slots: ExamSlot[],
  unavailability: Unavailability[],
  constraints: ScheduleConstraints,
  variant: 'least-load' | 'random' | 'round-robin',
  facultyGaps?: Map<string, number>,
  crossExamHistory?: Map<string, number>,
  crossExamSlotBlocks?: Map<string, Set<string>>,
): AllocationResult {
  const warnings: string[] = [];
  const assignments: Assignment[] = [];
  const dutyCount: Record<string, number> = {};
  // Filter out exempt faculty
  const activeFaculty = faculty.filter(f => f.priority !== 'exempt');
  activeFaculty.forEach(f => dutyCount[f.id] = 0);

  // Reduced-load faculty get halved maxDuties
  const effectiveMax = (f: Faculty) => {
    if (f.priority === 'reduced') return Math.max(1, Math.floor(f.maxDuties / 2));
    return f.maxDuties;
  };

  const unavailMap = new Map<string, Set<string>>();
  unavailability.forEach(u => {
    if (!unavailMap.has(u.facultyId)) unavailMap.set(u.facultyId, new Set());
    unavailMap.get(u.facultyId)!.add(`${u.date}_${u.session}`);
  });

  const dayAssignments: Record<string, Set<string>> = {};
  const facultyDates: Record<string, string[]> = {};
  activeFaculty.forEach(f => facultyDates[f.id] = []);

  const sortedSlots = [...slots].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return a.session === 'AM' ? -1 : 1;
  });

  let rrIndex = Math.floor(Math.random() * activeFaculty.length);

  for (const slot of sortedSlots) {
    const key = `${slot.date}_${slot.session}`;

    const eligible = activeFaculty.filter(f => {
      const unavail = unavailMap.get(f.id);
      if (unavail && unavail.has(key)) return false;
      if (constraints.respectMaxDuties && dutyCount[f.id] >= effectiveMax(f)) return false;
      if (constraints.avoidSameDayDouble) {
        if (dayAssignments[slot.date]?.has(f.id)) return false;
      }
      // Cross-exam same-time block
      if (crossExamSlotBlocks?.get(f.id)?.has(`${slot.date}_${slot.session}`)) return false;
      const gap = facultyGaps?.get(f.id) ?? 0;
      if (gap > 0 && facultyDates[f.id]?.length > 0) {
        const slotDate = new Date(slot.date + 'T00:00:00');
        const tooClose = facultyDates[f.id].some(d => {
          const diff = Math.abs(slotDate.getTime() - new Date(d + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24);
          return diff < gap;
        });
        if (tooClose) return false;
      }
      return true;
    });

    let sorted: Faculty[];
    switch (variant) {
      case 'random':
        sorted = shuffle(eligible);
        break;
      case 'round-robin': {
        const ids = activeFaculty.map(f => f.id);
        sorted = [...eligible].sort((a, b) => {
          const ai = ids.indexOf(a.id);
          const bi = ids.indexOf(b.id);
          const da = (ai - rrIndex + ids.length) % ids.length;
          const db = (bi - rrIndex + ids.length) % ids.length;
          return da - db;
        });
        break;
      }
      case 'least-load':
      default:
        sorted = [...eligible].sort((a, b) => {
          // Primary: current exam duty count
          const diff = dutyCount[a.id] - dutyCount[b.id];
          if (diff !== 0) return diff;
          // Tiebreaker: cross-exam cumulative history (fewer past duties = higher priority)
          if (crossExamHistory) {
            const histA = crossExamHistory.get(a.id) ?? 0;
            const histB = crossExamHistory.get(b.id) ?? 0;
            if (histA !== histB) return histA - histB;
          }
          // Second tiebreaker: reduced-load faculty last
          if (a.priority !== b.priority) {
            return a.priority === 'reduced' ? 1 : -1;
          }
          return 0;
        });
        break;
    }

    if (sorted.length < slot.required) {
      warnings.push(
        `Slot ${slot.date} ${slot.session}: Need ${slot.required} faculty, only ${sorted.length} available`
      );
    }

    const toAssign = sorted.slice(0, slot.required);
    for (const f of toAssign) {
      assignments.push({
        id: crypto.randomUUID(),
        facultyId: f.id,
        slotId: slot.id,
      });
      dutyCount[f.id]++;
      if (!dayAssignments[slot.date]) dayAssignments[slot.date] = new Set();
      dayAssignments[slot.date].add(f.id);
      facultyDates[f.id].push(slot.date);
    }
    rrIndex = (rrIndex + toAssign.length) % Math.max(activeFaculty.length, 1);
  }

  // Warn about exempt faculty
  const exemptFaculty = faculty.filter(f => f.priority === 'exempt');
  if (exemptFaculty.length > 0) {
    warnings.push(`${exemptFaculty.length} faculty exempted: ${exemptFaculty.map(f => f.name).join(', ')}`);
  }

  // Warn about reduced-load faculty
  const reducedFaculty = activeFaculty.filter(f => f.priority === 'reduced');
  if (reducedFaculty.length > 0) {
    warnings.push(`${reducedFaculty.length} faculty on reduced load (max halved): ${reducedFaculty.map(f => f.name).join(', ')}`);
  }

  return { assignments, warnings };
}

export interface ScheduleVariant {
  id: string;
  name: string;
  assignments: Assignment[];
  warnings: string[];
  stats: {
    totalAssignments: number;
    avgDuties: number;
    maxDuties: number;
    minDuties: number;
    spread: number;
  };
}

export function generateSchedule(
  faculty: Faculty[],
  slots: ExamSlot[],
  unavailability: Unavailability[],
  constraints: ScheduleConstraints,
  facultyGaps?: Map<string, number>,
  crossExamHistory?: Map<string, number>,
  crossExamSlotBlocks?: Map<string, Set<string>>,
): AllocationResult {
  return generateOneSchedule(faculty, slots, unavailability, constraints, 'least-load', facultyGaps, crossExamHistory, crossExamSlotBlocks);
}

export function generateMultipleSchedules(
  faculty: Faculty[],
  slots: ExamSlot[],
  unavailability: Unavailability[],
  constraints: ScheduleConstraints,
  count: number = 5,
  facultyGaps?: Map<string, number>,
  crossExamHistory?: Map<string, number>,
  crossExamSlotBlocks?: Map<string, Set<string>>,
): ScheduleVariant[] {
  const variants: ScheduleVariant[] = [];
  const strategies: Array<'least-load' | 'random' | 'round-robin'> = ['least-load', 'round-robin', 'random', 'random', 'random'];
  const activeFaculty = faculty.filter(f => f.priority !== 'exempt');

  for (let i = 0; i < count; i++) {
    const strategy = strategies[i % strategies.length];
    const result = generateOneSchedule(faculty, slots, unavailability, constraints, strategy, facultyGaps, crossExamHistory, crossExamSlotBlocks);

    const dutyCount: Record<string, number> = {};
    activeFaculty.forEach(f => dutyCount[f.id] = 0);
    result.assignments.forEach(a => { dutyCount[a.facultyId] = (dutyCount[a.facultyId] ?? 0) + 1; });
    const counts = Object.values(dutyCount);
    const max = Math.max(...counts, 0);
    const min = Math.min(...counts, 0);
    const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;

    const strategyNames: Record<string, string> = {
      'least-load': 'Balanced',
      'round-robin': 'Round Robin',
      'random': 'Randomized',
    };

    variants.push({
      id: crypto.randomUUID(),
      name: `${strategyNames[strategy]} #${i + 1}`,
      assignments: result.assignments,
      warnings: result.warnings,
      stats: {
        totalAssignments: result.assignments.length,
        avgDuties: Math.round(avg * 10) / 10,
        maxDuties: max,
        minDuties: min,
        spread: max - min,
      },
    });
  }

  variants.sort((a, b) => a.stats.spread - b.stats.spread);
  return variants;
}

/**
 * Rebalance a schedule after manual changes.
 */
export function rebalanceSchedule(
  currentAssignments: Assignment[],
  pinnedKeys: Set<string>,
  faculty: Faculty[],
  slots: ExamSlot[],
  unavailability: Unavailability[],
  constraints: ScheduleConstraints,
  lockedTotals?: Map<string, number>,
  facultyGaps?: Map<string, number>,
  crossExamHistory?: Map<string, number>,
  crossExamSlotBlocks?: Map<string, Set<string>>,
): AllocationResult {
  const warnings: string[] = [];
  const result: Assignment[] = [];
  const activeFaculty = faculty.filter(f => f.priority !== 'exempt');
  const dutyCount: Record<string, number> = {};
  activeFaculty.forEach(f => dutyCount[f.id] = 0);
  const dayAssignments: Record<string, Set<string>> = {};
  const facultyDates: Record<string, string[]> = {};
  activeFaculty.forEach(f => facultyDates[f.id] = []);

  const effectiveMax = (f: Faculty) => {
    if (f.priority === 'reduced') return Math.max(1, Math.floor(f.maxDuties / 2));
    return f.maxDuties;
  };

  const unavailMap = new Map<string, Set<string>>();
  unavailability.forEach(u => {
    if (!unavailMap.has(u.facultyId)) unavailMap.set(u.facultyId, new Set());
    unavailMap.get(u.facultyId)!.add(`${u.date}_${u.session}`);
  });

  const slotMap = new Map(slots.map(s => [s.id, s]));

  // First pass: keep all pinned assignments
  for (const a of currentAssignments) {
    const key = `${a.facultyId}:${a.slotId}`;
    if (pinnedKeys.has(key)) {
      result.push(a);
      dutyCount[a.facultyId] = (dutyCount[a.facultyId] ?? 0) + 1;
      const slot = slotMap.get(a.slotId);
      if (slot) {
        if (!dayAssignments[slot.date]) dayAssignments[slot.date] = new Set();
        dayAssignments[slot.date].add(a.facultyId);
        facultyDates[a.facultyId]?.push(slot.date);
      }
    }
  }

  const sortedSlots = [...slots].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return a.session === 'AM' ? -1 : 1;
  });

  for (const slot of sortedSlots) {
    const pinnedForSlot = result.filter(a => a.slotId === slot.id);
    const needed = slot.required - pinnedForSlot.length;
    if (needed <= 0) continue;

    const pinnedFacultyIds = new Set(pinnedForSlot.map(a => a.facultyId));
    const key = `${slot.date}_${slot.session}`;

    const eligible = activeFaculty.filter(f => {
      if (pinnedFacultyIds.has(f.id)) return false;
      const lockedMax = lockedTotals?.get(f.id);
      if (lockedMax !== undefined && dutyCount[f.id] >= lockedMax) return false;
      const unavail = unavailMap.get(f.id);
      if (unavail && unavail.has(key)) return false;
      if (constraints.respectMaxDuties && dutyCount[f.id] >= effectiveMax(f)) return false;
      if (constraints.avoidSameDayDouble && dayAssignments[slot.date]?.has(f.id)) return false;
      // Cross-exam same-time block
      if (crossExamSlotBlocks?.get(f.id)?.has(`${slot.date}_${slot.session}`)) return false;
      const gap = facultyGaps?.get(f.id) ?? 0;
      if (gap > 0 && facultyDates[f.id]?.length > 0) {
        const slotDate = new Date(slot.date + 'T00:00:00');
        const tooClose = facultyDates[f.id].some(d => {
          const diff = Math.abs(slotDate.getTime() - new Date(d + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24);
          return diff < gap;
        });
        if (tooClose) return false;
      }
      return true;
    });

    eligible.sort((a, b) => {
      const diff = dutyCount[a.id] - dutyCount[b.id];
      if (diff !== 0) return diff;
      if (crossExamHistory) {
        const histA = crossExamHistory.get(a.id) ?? 0;
        const histB = crossExamHistory.get(b.id) ?? 0;
        if (histA !== histB) return histA - histB;
      }
      if (a.priority !== b.priority) return a.priority === 'reduced' ? 1 : -1;
      return 0;
    });

    if (eligible.length < needed) {
      warnings.push(`Slot ${slot.date} ${slot.session}: Need ${needed} more faculty, only ${eligible.length} available`);
    }

    for (const f of eligible.slice(0, needed)) {
      result.push({ id: crypto.randomUUID(), facultyId: f.id, slotId: slot.id });
      dutyCount[f.id]++;
      if (!dayAssignments[slot.date]) dayAssignments[slot.date] = new Set();
      dayAssignments[slot.date].add(f.id);
      facultyDates[f.id].push(slot.date);
    }
  }

  return { assignments: result, warnings };
}
