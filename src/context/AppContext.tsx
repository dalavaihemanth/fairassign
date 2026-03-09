import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Faculty, ExamSlot, Unavailability, Assignment, ScheduleConstraints, SavedSchedule, Examination, ExamStatus } from '@/types/invigilation';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { ShieldCheck } from 'lucide-react';

interface AppState {
  // Global
  faculty: Faculty[];
  unavailability: Unavailability[];
  examinations: Examination[];
  currentExamId: string | null;

  // Current exam scoped (derived)
  slots: ExamSlot[];
  assignments: Assignment[];
  constraints: ScheduleConstraints;
  savedSchedules: SavedSchedule[];
  pinnedKeys: Set<string>;
  lockedTotals: Map<string, number>;
  facultyGaps: Map<string, number>;
  publishedAssignments: Assignment[];
  undoStack: Assignment[][];

  // Faculty actions (global)
  addFaculty: (f: Omit<Faculty, 'id'>) => void;
  updateFaculty: (f: Faculty) => void;
  removeFaculty: (id: string) => void;

  // Unavailability actions (global)
  addUnavailability: (u: Omit<Unavailability, 'id'>) => void;
  removeUnavailability: (id: string) => void;

  // Exam actions
  createExamination: (name: string, carryForwardFaculty?: boolean) => void;
  switchExamination: (id: string) => void;
  renameExamination: (id: string, name: string) => void;
  archiveExamination: (id: string) => void;
  unarchiveExamination: (id: string) => void;
  deleteExamination: (id: string) => void;

  // Scoped actions (operate on current exam)
  addSlot: (s: Omit<ExamSlot, 'id'>) => void;
  updateSlot: (s: ExamSlot) => void;
  removeSlot: (id: string) => void;
  setAssignments: (a: Assignment[]) => void;
  setConstraints: (c: ScheduleConstraints) => void;
  clearAssignments: () => void;
  saveSchedule: (name: string) => void;
  loadSchedule: (id: string) => void;
  deleteSchedule: (id: string) => void;
  renameSchedule: (id: string, name: string) => void;
  setPinnedKeys: (keys: Set<string>) => void;
  setLockedTotals: (totals: Map<string, number>) => void;
  setFacultyGaps: (gaps: Map<string, number>) => void;
  publishSchedule: () => void;
  unpublishSchedule: () => void;
  setUndoStack: React.Dispatch<React.SetStateAction<Assignment[][]>>;

  // Cross-exam
  crossExamDutyCount: Map<string, number>;
  crossExamSlotBlocks: Map<string, Set<string>>; // facultyId → Set of 'YYYY-MM-DD_Session' assigned in OTHER exams

  // Data Management
  resetData: () => void;
}

const AppContext = createContext<AppState | null>(null);

const uid = () => crypto.randomUUID();

const STORAGE_KEY = 'invigilation_app_data';

const DEFAULT_CONSTRAINTS: ScheduleConstraints = {
  avoidSameDayDouble: true,
  respectMaxDuties: true,
};

function createDefaultExam(name: string): Examination {
  return {
    id: uid(),
    name,
    status: 'active',
    createdAt: new Date().toISOString(),
    slots: [],
    assignments: [],
    constraints: { ...DEFAULT_CONSTRAINTS },
    savedSchedules: [],
    publishedAssignments: [],
    pinnedKeys: [],
    lockedTotals: [],
    facultyGaps: [],
  };
}

interface StorageData {
  faculty: Faculty[];
  unavailability: Unavailability[];
  examinations: Examination[];
  currentExamId: string | null;
}


function loadFromStorageLocalFallback(userId: string): StorageData | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (raw) {
      const data = JSON.parse(raw);
      // Migration: unavailability was per-exam, merge to global
      let globalUnavailability: Unavailability[] = data.unavailability ?? [];
      if (data.examinations) {
        for (const exam of data.examinations) {
          if (exam.unavailability && exam.unavailability.length > 0) {
            globalUnavailability = [...globalUnavailability, ...exam.unavailability];
            delete exam.unavailability;
          }
        }
        // Deduplicate by facultyId+date+session
        const seen = new Set<string>();
        globalUnavailability = globalUnavailability.filter(u => {
          const key = `${u.facultyId}_${u.date}_${u.session}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      return {
        faculty: data.faculty ?? [],
        unavailability: globalUnavailability,
        examinations: data.examinations ?? [],
        currentExamId: data.currentExamId ?? null,
      };
    }
  } catch { }
  return null;
}

async function loadFromSupabase(userId: string): Promise<StorageData | null> {
  try {
    const { data, error } = await supabase.from('invigilation_data').select('data').eq('id', userId).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Row doesn't exist
      console.warn("Supabase fetch warning:", error);
      return null;
    }
    return data?.data as StorageData;
  } catch (err) {
    console.error("Failed to load from Supabase:", err);
    return null;
  }
}

let syncTimeout: NodeJS.Timeout;
function saveToStorage(data: StorageData, userId: string) {
  // Save locally as backup instantly (with user prefix for safety)
  try { localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(data)); } catch { }

  // Debounce Supabase sync to avoid spamming the DB
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await supabase.from('invigilation_data').upsert({
        id: userId,
        data: data,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to sync to Supabase', err);
    }
  }, 1000);
}


export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [unavailability, setUnavailability] = useState<Unavailability[]>([]);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Assignment[][]>([]);

  useEffect(() => {
    // Only initialize if we have a user
    if (!user) {
      setFaculty([]);
      setUnavailability([]);
      setExaminations([]);
      setCurrentExamId(null);
      setUndoStack([]);
      setIsInitializing(false);
      return;
    }

    async function init() {
      setIsInitializing(true);
      // 1. Try loading from Supabase first
      let data = await loadFromSupabase(user.id);

      // 2. Fallback to Local Storage (User Specific) if Supabase is empty
      if (!data) {
        data = loadFromStorageLocalFallback(user.id);
      }

      // 3. Populate state
      if (data) {
        setFaculty(data.faculty || []);
        setUnavailability(data.unavailability || []);
        setExaminations(data.examinations || []);
        setCurrentExamId(data.currentExamId || null);
        saveToStorage(data, user.id);
      } else {
        const exam = createDefaultExam('First Examination');
        setExaminations([exam]);
        setCurrentExamId(exam.id);
        saveToStorage({ faculty: [], unavailability: [], examinations: [exam], currentExamId: exam.id }, user.id);
      }

      setIsInitializing(false);
    }
    init();
  }, [user?.id]);

  // Derive current exam
  const currentExam = examinations.find(e => e.id === currentExamId) ?? null;

  // Scoped getters
  const slots = currentExam?.slots ?? [];
  const assignments = currentExam?.assignments ?? [];
  const constraints = currentExam?.constraints ?? DEFAULT_CONSTRAINTS;
  const savedSchedules = currentExam?.savedSchedules ?? [];
  const publishedAssignments = currentExam?.publishedAssignments ?? [];
  const pinnedKeys = useMemo(() => new Set(currentExam?.pinnedKeys ?? []), [currentExam?.pinnedKeys]);
  const lockedTotals = useMemo(() => new Map(currentExam?.lockedTotals ?? []), [currentExam?.lockedTotals]);
  const facultyGaps = useMemo(() => new Map(currentExam?.facultyGaps ?? []), [currentExam?.facultyGaps]);

  // Cross-exam duty count
  const crossExamDutyCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const exam of examinations) {
      const source = exam.publishedAssignments.length > 0 ? exam.publishedAssignments : exam.assignments;
      for (const a of source) {
        map.set(a.facultyId, (map.get(a.facultyId) ?? 0) + 1);
      }
    }
    return map;
  }, [examinations]);

  // Cross-exam date blocks: exact date & session where faculty are assigned in OTHER exams
  const crossExamSlotBlocks = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const exam of examinations) {
      if (exam.id === currentExamId) continue; // skip current exam
      const slotMap = new Map(exam.slots.map(s => [s.id, s]));
      const source = exam.publishedAssignments.length > 0 ? exam.publishedAssignments : exam.assignments;
      for (const a of source) {
        const slot = slotMap.get(a.slotId);
        if (!slot) continue;
        if (!map.has(a.facultyId)) map.set(a.facultyId, new Set());
        map.get(a.facultyId)!.add(`${slot.date}_${slot.session}`);
      }
    }
    return map;
  }, [examinations, currentExamId]);

  // Helper: update current exam
  const updateCurrentExam = useCallback((updater: (exam: Examination) => Examination) => {
    if (!currentExamId) return;
    setExaminations(prev => prev.map(e => e.id === currentExamId ? updater(e) : e));
  }, [currentExamId]);

  // Persist logic
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitializing || !user) return; // Do not overwrite with empty state during init or if no user
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveToStorage({ faculty, unavailability, examinations, currentExamId }, user.id);
  }, [faculty, unavailability, examinations, currentExamId, isInitializing, user?.id]);

  // Faculty actions (global)
  const addFaculty = useCallback((f: Omit<Faculty, 'id'>) => {
    setFaculty(prev => [...prev, { ...f, id: uid() }]);
  }, []);
  const updateFaculty = useCallback((f: Faculty) => {
    setFaculty(prev => prev.map(x => x.id === f.id ? f : x));
  }, []);
  const removeFaculty = useCallback((id: string) => {
    setFaculty(prev => prev.filter(x => x.id !== id));
    setUnavailability(prev => prev.filter(u => u.facultyId !== id));
    setExaminations(prev => prev.map(exam => ({
      ...exam,
      assignments: exam.assignments.filter(a => a.facultyId !== id),
      publishedAssignments: exam.publishedAssignments.filter(a => a.facultyId !== id),
    })));
  }, []);

  // Unavailability actions (global)
  const addUnavailability = useCallback((u: Omit<Unavailability, 'id'>) => {
    setUnavailability(prev => [...prev, { ...u, id: uid() }]);
  }, []);
  const removeUnavailability = useCallback((id: string) => {
    setUnavailability(prev => prev.filter(x => x.id !== id));
  }, []);

  // Exam actions
  const createExamination = useCallback((name: string, _carryForwardFaculty?: boolean) => {
    const exam = createDefaultExam(name);
    setExaminations(prev => [...prev, exam]);
    setCurrentExamId(exam.id);
    setUndoStack([]);
  }, []);

  const switchExamination = useCallback((id: string) => {
    setCurrentExamId(id);
    setUndoStack([]);
  }, []);

  const renameExamination = useCallback((id: string, name: string) => {
    setExaminations(prev => prev.map(e => e.id === id ? { ...e, name } : e));
  }, []);

  const archiveExamination = useCallback((id: string) => {
    setExaminations(prev => prev.map(e => e.id === id ? { ...e, status: 'archived' as ExamStatus } : e));
    if (currentExamId === id) {
      setExaminations(prev => {
        const active = prev.find(e => e.id !== id && e.status === 'active');
        if (active) setCurrentExamId(active.id);
        else setCurrentExamId(null);
        return prev;
      });
    }
  }, [currentExamId]);

  const unarchiveExamination = useCallback((id: string) => {
    setExaminations(prev => prev.map(e => e.id === id ? { ...e, status: 'active' as ExamStatus } : e));
  }, []);

  const deleteExamination = useCallback((id: string) => {
    setExaminations(prev => prev.filter(e => e.id !== id));
    if (currentExamId === id) {
      setExaminations(prev => {
        const active = prev.find(e => e.status === 'active');
        setCurrentExamId(active?.id ?? null);
        return prev;
      });
    }
  }, [currentExamId]);

  // Scoped actions
  const addSlot = useCallback((s: Omit<ExamSlot, 'id'>) => {
    updateCurrentExam(exam => ({ ...exam, slots: [...exam.slots, { ...s, id: uid() }] }));
  }, [updateCurrentExam]);

  const updateSlot = useCallback((s: ExamSlot) => {
    updateCurrentExam(exam => ({ ...exam, slots: exam.slots.map(x => x.id === s.id ? s : x) }));
  }, [updateCurrentExam]);

  const removeSlot = useCallback((id: string) => {
    updateCurrentExam(exam => ({
      ...exam,
      slots: exam.slots.filter(x => x.id !== id),
      assignments: exam.assignments.filter(a => a.slotId !== id),
    }));
  }, [updateCurrentExam]);

  const setAssignments = useCallback((a: Assignment[]) => {
    updateCurrentExam(exam => ({ ...exam, assignments: a }));
  }, [updateCurrentExam]);

  const setConstraints = useCallback((c: ScheduleConstraints) => {
    updateCurrentExam(exam => ({ ...exam, constraints: c }));
  }, [updateCurrentExam]);

  const clearAssignments = useCallback(() => {
    updateCurrentExam(exam => ({ ...exam, assignments: [] }));
  }, [updateCurrentExam]);

  const saveSchedule = useCallback((name: string) => {
    updateCurrentExam(exam => ({
      ...exam,
      savedSchedules: [...exam.savedSchedules, {
        id: uid(),
        name,
        assignments: [...exam.assignments],
        createdAt: new Date().toISOString(),
      }],
    }));
  }, [updateCurrentExam]);

  const loadSchedule = useCallback((id: string) => {
    if (!currentExam) return;
    const schedule = currentExam.savedSchedules.find(s => s.id === id);
    if (schedule) {
      updateCurrentExam(exam => ({ ...exam, assignments: [...schedule.assignments] }));
    }
  }, [currentExam, updateCurrentExam]);

  const deleteSchedule = useCallback((id: string) => {
    updateCurrentExam(exam => ({ ...exam, savedSchedules: exam.savedSchedules.filter(s => s.id !== id) }));
  }, [updateCurrentExam]);

  const renameSchedule = useCallback((id: string, name: string) => {
    updateCurrentExam(exam => ({
      ...exam,
      savedSchedules: exam.savedSchedules.map(s => s.id === id ? { ...s, name } : s),
    }));
  }, [updateCurrentExam]);

  const setPinnedKeys = useCallback((keys: Set<string>) => {
    updateCurrentExam(exam => ({ ...exam, pinnedKeys: [...keys] }));
  }, [updateCurrentExam]);

  const setLockedTotals = useCallback((totals: Map<string, number>) => {
    updateCurrentExam(exam => ({ ...exam, lockedTotals: [...totals] }));
  }, [updateCurrentExam]);

  const setFacultyGaps = useCallback((gaps: Map<string, number>) => {
    updateCurrentExam(exam => ({ ...exam, facultyGaps: [...gaps] }));
  }, [updateCurrentExam]);

  const publishSchedule = useCallback(() => {
    updateCurrentExam(exam => {
      const timestamp = new Date().toLocaleString();
      return {
        ...exam,
        publishedAssignments: [...exam.assignments],
        savedSchedules: [...exam.savedSchedules, {
          id: uid(),
          name: `Published – ${timestamp}`,
          assignments: [...exam.assignments],
          createdAt: new Date().toISOString(),
        }],
      };
    });
  }, [updateCurrentExam]);

  const unpublishSchedule = useCallback(() => {
    updateCurrentExam(exam => ({ ...exam, publishedAssignments: [] }));
  }, [updateCurrentExam]);

  const resetData = useCallback(() => {
    if (!window.confirm('Are you sure you want to PERMANENTLY delete ALL data in this account? this cannot be undone.')) return;

    const exam = createDefaultExam('First Examination');
    setFaculty([]);
    setUnavailability([]);
    setExaminations([exam]);
    setCurrentExamId(exam.id);
    setUndoStack([]);

    if (user) {
      saveToStorage({ faculty: [], unavailability: [], examinations: [exam], currentExamId: exam.id }, user.id);
    }
  }, [user]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-app-gradient flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-1000">
          <div className="w-24 h-24 rounded-[2.5rem] bg-sidebar-primary shadow-[0_20px_50px_rgba(var(--sidebar-primary),0.3)] flex items-center justify-center border border-white/20 animate-pulse">
            <ShieldCheck size={48} className="text-white drop-shadow-lg" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-display font-black text-foreground tracking-tight">FairAssign</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60">Synchronizing Data Cache</p>
          </div>
          <div className="w-48 h-1 bg-muted/30 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-primary w-1/3 rounded-full animate-[loading_1.5s_infinite_ease-in-out]" />
          </div>
        </div>

        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes loading {
            0% { transform: translateX(-100%); width: 30%; }
            50% { width: 60%; }
            100% { transform: translateX(300%); width: 30%; }
          }
        `}} />
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      faculty, unavailability, examinations, currentExamId,
      slots, assignments, constraints, savedSchedules,
      pinnedKeys, lockedTotals, facultyGaps, publishedAssignments, undoStack,
      crossExamDutyCount, crossExamSlotBlocks,
      addFaculty, updateFaculty, removeFaculty,
      addUnavailability, removeUnavailability,
      createExamination, switchExamination, renameExamination,
      archiveExamination, unarchiveExamination, deleteExamination,
      addSlot, updateSlot, removeSlot,
      setAssignments, setConstraints, clearAssignments,
      saveSchedule, loadSchedule, deleteSchedule, renameSchedule,
      setPinnedKeys, setLockedTotals, setFacultyGaps, publishSchedule, unpublishSchedule, setUndoStack,
      resetData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
