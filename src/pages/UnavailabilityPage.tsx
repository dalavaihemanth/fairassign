import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { formatDate } from '@/types/invigilation';
import type { Session } from '@/types/invigilation';

export default function UnavailabilityPage() {
  const { faculty, slots, unavailability, addUnavailability, removeUnavailability } = useAppState();
  const [form, setForm] = useState({ facultyId: '', date: '', session: 'AM' as Session });

  const uniqueDates = [...new Set(slots.map(s => s.date))].sort();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.facultyId || !form.date) return;
    // Prevent duplicates
    const exists = unavailability.some(u => u.facultyId === form.facultyId && u.date === form.date && u.session === form.session);
    if (exists) return;
    addUnavailability({ facultyId: form.facultyId, date: form.date, session: form.session });
    setForm({ facultyId: '', date: '', session: 'AM' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Faculty Unavailability</h1>
        <p className="text-sm text-muted-foreground mt-1">Mark dates when faculty are not available</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Faculty</Label>
          <select
            value={form.facultyId}
            onChange={e => setForm(p => ({ ...p, facultyId: e.target.value }))}
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select faculty...</option>
            {faculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <select
            value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select date...</option>
            {uniqueDates.map(d => <option key={d} value={d}>{formatDate(d)}</option>)}
          </select>
        </div>
        <div className="w-28">
          <Label className="text-xs text-muted-foreground">Session</Label>
          <select
            value={form.session}
            onChange={e => setForm(p => ({ ...p, session: e.target.value as Session }))}
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <Button type="submit" className="gap-2"><Plus size={16} /> Add</Button>
      </form>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Faculty</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Session</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {unavailability.map(u => {
              const f = faculty.find(x => x.id === u.facultyId);
              return (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium text-foreground">{f?.name ?? 'Unknown'}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(u.date)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.session === 'AM' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent-foreground'}`}>
                      {u.session}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeUnavailability(u.id)}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              );
            })}
            {unavailability.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No unavailability marked</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
