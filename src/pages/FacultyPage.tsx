import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAppState } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Faculty } from '@/types/invigilation';
import CSVImport from '@/components/CSVImport';

export default function FacultyPage() {
  const { faculty, addFaculty, updateFaculty, removeFaculty } = useAppState();
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [form, setForm] = useState({ name: '', department: '', maxDuties: '6', priority: 'normal' as Faculty['priority'] });
  const [importDept, setImportDept] = useState('General');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDept, setBulkDept] = useState('');
  const [bulkMaxDuties, setBulkMaxDuties] = useState('');

  const existingNames = useMemo(() => new Set(faculty.map(f => f.name.toLowerCase().trim())), [faculty]);

  const isDuplicate = (name: string, excludeId?: string) => {
    const norm = name.toLowerCase().trim();
    return faculty.some(f => f.name.toLowerCase().trim() === norm && f.id !== excludeId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.department.trim()) return;
    if (editing) {
      if (isDuplicate(form.name, editing.id)) {
        toast.error(`Faculty "${form.name.trim()}" already exists`);
        return;
      }
      updateFaculty({ ...editing, name: form.name.trim(), department: form.department.trim(), maxDuties: parseInt(form.maxDuties) || 6, priority: form.priority });
      setEditing(null);
    } else {
      if (isDuplicate(form.name)) {
        toast.error(`Faculty "${form.name.trim()}" already exists`);
        return;
      }
      addFaculty({ name: form.name.trim(), department: form.department.trim(), maxDuties: parseInt(form.maxDuties) || 6, priority: form.priority });
    }
    setForm({ name: '', department: '', maxDuties: '6', priority: 'normal' });
  };

  const startEdit = (f: Faculty) => {
    setEditing(f);
    setForm({ name: f.name, department: f.department, maxDuties: String(f.maxDuties), priority: f.priority ?? 'normal' });
  };

  const handleImport = useCallback((rows: string[][]) => {
    let success = 0;
    const errors: string[] = [];
    const seen = new Set(faculty.map(f => f.name.toLowerCase().trim()));

    rows.forEach((row, i) => {
      const [name, department, maxDutiesStr] = row;
      if (!name?.trim()) {
        errors.push(`Row ${i + 2}: Missing name`);
        return;
      }
      const normName = name.trim().toLowerCase();
      if (seen.has(normName)) {
        errors.push(`Row ${i + 2}: "${name.trim()}" already exists (skipped)`);
        return;
      }
      const dept = importDept.trim() || 'General';
      const maxDuties = parseInt(maxDutiesStr) || 6;
      if (maxDuties < 1 || maxDuties > 20) {
        errors.push(`Row ${i + 2}: Max duties must be 1–20 (got "${maxDutiesStr}")`);
        return;
      }
      addFaculty({ name: name.trim(), department: dept, maxDuties, priority: 'normal' });
      seen.add(normName);
      success++;
    });

    return { success, errors };
  }, [addFaculty, importDept, faculty]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Faculty Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Add and manage faculty members</p>
        </div>
        <CSVImport
          label="Faculty"
          templateFilename="faculty_template.csv"
          templateHeaders={['Name']}
          templateSampleRows={[
            ['Dr. Example'],
            ['Dr. Sample'],
          ]}
          fields={[
            { name: 'Name', required: true },
          ]}
          expectedColumns="Name (required)"
          onImport={handleImport}
          extraOptions={
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Department (applied to all)</Label>
                <Input
                  value={importDept}
                  onChange={e => setImportDept(e.target.value)}
                  placeholder="e.g. CSE"
                  className="w-48 h-8 text-xs"
                />
              </div>
            </div>
          }
        />
      </div>

      <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Dr. Name" className="mt-1" />
        </div>
        <div className="flex-1 min-w-[120px]">
          <Label className="text-xs text-muted-foreground">Department</Label>
          <Input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} placeholder="CSE" className="mt-1" />
        </div>
        <div className="w-24">
          <Label className="text-xs text-muted-foreground">Max Duties</Label>
          <Input type="number" min="1" max="20" value={form.maxDuties} onChange={e => setForm(p => ({ ...p, maxDuties: e.target.value }))} className="mt-1" />
        </div>
        <div className="w-32">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <select
            value={form.priority}
            onChange={e => setForm(p => ({ ...p, priority: e.target.value as Faculty['priority'] }))}
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="normal">Normal</option>
            <option value="reduced">Reduced Load</option>
            <option value="exempt">Exempt</option>
          </select>
        </div>
        <Button type="submit" className="gap-2">
          <Plus size={16} /> {editing ? 'Update' : 'Add'}
        </Button>
        {editing && (
          <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm({ name: '', department: '', maxDuties: '6', priority: 'normal' }); }}>
            Cancel
          </Button>
        )}
      </form>

      {/* Bulk Edit Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          variant={bulkMode ? 'secondary' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); setBulkDept(''); setBulkMaxDuties(''); }}
        >
          <CheckSquare size={14} /> {bulkMode ? 'Cancel Bulk Edit' : 'Bulk Edit'}
        </Button>

        {bulkMode && selected.size > 0 && (
          <>
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Set Department</Label>
                <Input
                  value={bulkDept}
                  onChange={e => setBulkDept(e.target.value)}
                  placeholder="e.g. CSE"
                  className="w-32 h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Set Max Duties</Label>
                <Input
                  type="number" min="1" max="20"
                  value={bulkMaxDuties}
                  onChange={e => setBulkMaxDuties(e.target.value)}
                  placeholder="e.g. 6"
                  className="w-20 h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  let count = 0;
                  selected.forEach(id => {
                    const f = faculty.find(x => x.id === id);
                    if (!f) return;
                    const updated = { ...f };
                    if (bulkDept.trim()) updated.department = bulkDept.trim();
                    if (bulkMaxDuties) updated.maxDuties = parseInt(bulkMaxDuties) || f.maxDuties;
                    updateFaculty(updated);
                    count++;
                  });
                  toast.success(`Updated ${count} faculty members`);
                  setSelected(new Set());
                  setBulkDept('');
                  setBulkMaxDuties('');
                  setBulkMode(false);
                }}
              >
                Apply to {selected.size}
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                selected.forEach(id => removeFaculty(id));
                toast.success(`Removed ${selected.size} faculty members`);
                setSelected(new Set());
                setBulkMode(false);
              }}
            >
              <Trash2 size={14} /> Delete Selected
            </Button>
          </>
        )}
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {bulkMode && (
                <th className="p-3 w-10">
                  <Checkbox
                    checked={faculty.length > 0 && selected.size === faculty.length}
                    onCheckedChange={(v) => {
                      if (v) setSelected(new Set(faculty.map(f => f.id)));
                      else setSelected(new Set());
                    }}
                  />
                </th>
              )}
              <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Department</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Max Duties</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Priority</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {faculty.map(f => (
              <tr key={f.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${selected.has(f.id) ? 'bg-primary/5' : ''}`}>
                {bulkMode && (
                  <td className="p-3 w-10">
                    <Checkbox
                      checked={selected.has(f.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v) next.add(f.id);
                        else next.delete(f.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                )}
                <td className="p-3 font-medium text-foreground">{f.name}</td>
                <td className="p-3 text-muted-foreground">{f.department}</td>
                <td className="p-3 text-muted-foreground">{f.maxDuties}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${(f.priority ?? 'normal') === 'exempt' ? 'bg-destructive/10 text-destructive' :
                      (f.priority ?? 'normal') === 'reduced' ? 'bg-accent/10 text-accent-foreground' :
                        'bg-muted text-muted-foreground'
                    }`}>
                    {(f.priority ?? 'normal') === 'normal' ? 'Normal' : (f.priority ?? 'normal') === 'reduced' ? 'Reduced' : 'Exempt'}
                  </span>
                </td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(f)}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeFaculty(f.id)}><Trash2 size={14} /></Button>
                </td>
              </tr>
            ))}
            {faculty.length === 0 && (
              <tr><td colSpan={bulkMode ? 6 : 5} className="p-8 text-center text-muted-foreground">No faculty added yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
