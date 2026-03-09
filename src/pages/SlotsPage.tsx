import { useState } from 'react';
import { toast } from 'sonner';
import { useAppState } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil, CalendarPlus, X } from 'lucide-react';
import { formatDate } from '@/types/invigilation';
import type { ExamSlot, Session } from '@/types/invigilation';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export default function SlotsPage() {
  const { slots, addSlot, updateSlot, removeSlot } = useAppState();
  const [editing, setEditing] = useState<ExamSlot | null>(null);
  const [form, setForm] = useState({ date: '', session: 'AM' as Session, required: '4' });

  // Multi-date add mode
  const [multiDates, setMultiDates] = useState<Date[]>([]);
  const [multiSession, setMultiSession] = useState<'AM' | 'PM' | 'BOTH'>('BOTH');
  const [multiRequiredAM, setMultiRequiredAM] = useState('4');
  const [multiRequiredPM, setMultiRequiredPM] = useState('4');
  const [showMulti, setShowMulti] = useState(false);

  const existingSlotKeys = new Set(slots.map(s => `${s.date}_${s.session}`));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) return;
    if (editing) {
      updateSlot({ ...editing, date: form.date, session: form.session, required: parseInt(form.required) || 4 });
      setEditing(null);
    } else {
      const key = `${form.date}_${form.session}`;
      if (existingSlotKeys.has(key)) {
        toast.error(`Slot for ${form.date} ${form.session} already exists`);
        return;
      }
      addSlot({ date: form.date, session: form.session, required: parseInt(form.required) || 4 });
    }
    setForm({ date: '', session: 'AM', required: '4' });
  };

  const startEdit = (s: ExamSlot) => {
    setEditing(s);
    setForm({ date: s.date, session: s.session, required: String(s.required) });
  };

  const handleAddMulti = () => {
    if (multiDates.length === 0) return;
    const reqAM = parseInt(multiRequiredAM) || 4;
    const reqPM = parseInt(multiRequiredPM) || 4;
    const sessions: Session[] = multiSession === 'BOTH' ? ['AM', 'PM'] : [multiSession];
    let added = 0;
    let skipped = 0;

    multiDates.forEach(d => {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      sessions.forEach(session => {
        const key = `${dateStr}_${session}`;
        if (existingSlotKeys.has(key)) {
          skipped++;
          return;
        }
        addSlot({ date: dateStr, session, required: session === 'AM' ? reqAM : reqPM });
        existingSlotKeys.add(key);
        added++;
      });
    });

    if (skipped > 0) toast.warning(`${skipped} duplicate slot${skipped > 1 ? 's' : ''} skipped`);
    if (added > 0) toast.success(`${added} slot${added > 1 ? 's' : ''} added`);
    setMultiDates([]);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Exam Slots</h1>
          <p className="text-sm text-muted-foreground mt-1">Define exam dates, sessions, and required faculty</p>
        </div>
        <Button
          variant={showMulti ? 'secondary' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => { setShowMulti(!showMulti); setMultiDates([]); }}
        >
          <CalendarPlus size={14} /> {showMulti ? 'Hide Multi-Add' : 'Add Multiple Dates'}
        </Button>
      </div>

      {/* Multi-date add section */}
      {showMulti && (
        <div className="glass-card rounded-xl p-5 space-y-4 border border-border">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarPlus size={16} /> Select Multiple Exam Dates
            </h4>
            <Button variant="ghost" size="sm" onClick={() => { setShowMulti(false); setMultiDates([]); }} className="h-7 w-7 p-0">
              <X size={14} />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">Click dates on the calendar to select/deselect. Slots will be created for each selected date.</p>

          <div className="flex flex-wrap gap-5 items-start">
            <Calendar
              mode="multiple"
              selected={multiDates}
              onSelect={(dates) => setMultiDates(dates || [])}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className={cn("p-3 pointer-events-auto rounded-lg border border-border")}
            />

            <div className="space-y-4 min-w-[180px]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Session</Label>
                <select
                  value={multiSession}
                  onChange={e => setMultiSession(e.target.value as 'AM' | 'PM' | 'BOTH')}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="BOTH">Both AM & PM</option>
                  <option value="AM">AM only</option>
                  <option value="PM">PM only</option>
                </select>
              </div>

              {multiSession === 'BOTH' ? (
                <div className="flex gap-3">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs text-muted-foreground">AM Required</Label>
                    <Input
                      type="number" min="1" max="50"
                      value={multiRequiredAM}
                      onChange={e => setMultiRequiredAM(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs text-muted-foreground">PM Required</Label>
                    <Input
                      type="number" min="1" max="50"
                      value={multiRequiredPM}
                      onChange={e => setMultiRequiredPM(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Required Faculty</Label>
                  <Input
                    type="number" min="1" max="50"
                    value={multiSession === 'AM' ? multiRequiredAM : multiRequiredPM}
                    onChange={e => multiSession === 'AM' ? setMultiRequiredAM(e.target.value) : setMultiRequiredPM(e.target.value)}
                    className="w-full"
                  />
                </div>
              )}

              {multiDates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    {multiDates.length} date{multiDates.length > 1 ? 's' : ''} selected
                    → {multiDates.length * (multiSession === 'BOTH' ? 2 : 1)} slot{multiDates.length * (multiSession === 'BOTH' ? 2 : 1) > 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {multiDates
                      .sort((a, b) => a.getTime() - b.getTime())
                      .map(d => (
                        <span key={d.toISOString()} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleAddMulti}
                disabled={multiDates.length === 0}
                className="w-full gap-2"
              >
                <Plus size={14} /> Add {multiDates.length * (multiSession === 'BOTH' ? 2 : 1)} Slot{multiDates.length * (multiSession === 'BOTH' ? 2 : 1) !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single slot form */}
      <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="mt-1" />
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
        <div className="w-28">
          <Label className="text-xs text-muted-foreground">Required</Label>
          <Input type="number" min="1" max="50" value={form.required} onChange={e => setForm(p => ({ ...p, required: e.target.value }))} className="mt-1" />
        </div>
        <Button type="submit" className="gap-2">
          <Plus size={16} /> {editing ? 'Update' : 'Add'}
        </Button>
        {editing && (
          <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm({ date: '', session: 'AM', required: '4' }); }}>
            Cancel
          </Button>
        )}
      </form>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Session</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Required Faculty</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.map(s => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="p-3 font-medium text-foreground">{formatDate(s.date)}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.session === 'AM' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent-foreground'}`}>
                    {s.session}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">{s.required}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(s)}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeSlot(s.id)}><Trash2 size={14} /></Button>
                </td>
              </tr>
            ))}
            {slots.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No exam slots defined</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
