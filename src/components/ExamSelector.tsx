import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Archive, ArchiveRestore, Trash2, Pencil, Check, X, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ExamSelector() {
  const {
    examinations, currentExamId,
    createExamination, switchExamination,
    renameExamination, archiveExamination, unarchiveExamination, deleteExamination,
  } = useAppState();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const currentExam = examinations.find(e => e.id === currentExamId);
  const activeExams = examinations.filter(e => e.status === 'active');
  const archivedExams = examinations.filter(e => e.status === 'archived');

  const handleCreate = () => {
    const name = newName.trim() || `Exam ${examinations.length + 1}`;
    createExamination(name);
    setNewName('');
    setShowCreate(false);
  };

  if (examinations.length === 0 && !showCreate) {
    return (
      <div className="px-3 py-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2 text-xs h-8 border-dashed border-sidebar-border bg-sidebar-accent/20 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} /> Create First Examination
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Current exam selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent text-sm text-sidebar-foreground transition-colors text-left">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-medium">Examination</p>
              <p className="font-semibold truncate text-xs mt-0.5">
                {currentExam?.name ?? 'Select exam...'}
              </p>
            </div>
            <ChevronDown size={14} className="shrink-0 text-sidebar-foreground/50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {activeExams.map(exam => (
            <DropdownMenuItem
              key={exam.id}
              className={`gap-2 ${exam.id === currentExamId ? 'bg-accent' : ''}`}
              onClick={() => switchExamination(exam.id)}
            >
              <span className="flex-1 truncate">{exam.name}</span>
              {exam.id === currentExamId && <Check size={14} className="text-primary" />}
            </DropdownMenuItem>
          ))}
          {activeExams.length === 0 && (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">No active exams</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreate(true)} className="gap-2">
            <Plus size={14} /> New Examination
          </DropdownMenuItem>
          {archivedExams.length > 0 && (
            <DropdownMenuItem onClick={() => setShowArchived(!showArchived)} className="gap-2">
              <Archive size={14} /> Archived ({archivedExams.length})
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create form */}
      {showCreate && (
        <div className="flex gap-1.5">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Mid-Sem Oct 2025"
            className="h-7 text-xs flex-1 bg-sidebar-accent/30 border-sidebar-border"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowCreate(false);
            }}
          />
          <Button size="sm" className="h-7 w-7 p-0" onClick={handleCreate}>
            <Check size={12} />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowCreate(false)}>
            <X size={12} />
          </Button>
        </div>
      )}

      {/* Current exam actions */}
      {currentExam && (
        <div className="flex gap-1">
          {editingId === currentExam.id ? (
            <div className="flex gap-1 flex-1">
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="h-6 text-[10px] flex-1 bg-sidebar-accent/30 border-sidebar-border"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    renameExamination(currentExam.id, editName.trim() || currentExam.name);
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-sidebar-foreground/60" onClick={() => {
                renameExamination(currentExam.id, editName.trim() || currentExam.name);
                setEditingId(null);
              }}>
                <Check size={10} />
              </Button>
            </div>
          ) : (
            <>
              <Button
                size="sm" variant="ghost"
                className="h-6 w-6 p-0 text-sidebar-foreground/40 hover:text-sidebar-foreground"
                onClick={() => { setEditingId(currentExam.id); setEditName(currentExam.name); }}
                title="Rename"
              >
                <Pencil size={10} />
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-6 w-6 p-0 text-sidebar-foreground/40 hover:text-sidebar-foreground"
                onClick={() => archiveExamination(currentExam.id)}
                title="Archive"
              >
                <Archive size={10} />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Archived exams */}
      {showArchived && archivedExams.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-sidebar-border">
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium px-1">Archived</p>
          {archivedExams.map(exam => (
            <div key={exam.id} className="flex items-center gap-1 px-1">
              <span className="text-[11px] text-sidebar-foreground/50 truncate flex-1">{exam.name}</span>
              <Button
                size="sm" variant="ghost"
                className="h-5 w-5 p-0 text-sidebar-foreground/40 hover:text-sidebar-foreground"
                onClick={() => { unarchiveExamination(exam.id); switchExamination(exam.id); }}
                title="Restore"
              >
                <ArchiveRestore size={10} />
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-5 w-5 p-0 text-destructive/60 hover:text-destructive"
                onClick={() => deleteExamination(exam.id)}
                title="Delete permanently"
              >
                <Trash2 size={10} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
