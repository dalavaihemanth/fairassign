import { useAppState } from '@/context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

const COLORS = ['#1e3a5f', '#2d5a8e', '#3d7abd', '#e8a317', '#c4891a', '#2e8b57', '#3ba272', '#5b8c5a'];

export default function ReportsPage() {
  const { faculty, slots, assignments } = useAppState();

  const dutyData = faculty.map(f => ({
    name: f.name,
    duties: assignments.filter(a => a.facultyId === f.id).length,
    max: f.maxDuties,
  })).sort((a, b) => b.duties - a.duties);

  const totalDuties = assignments.length;
  const avgDuties = faculty.length ? (totalDuties / faculty.length).toFixed(1) : '0';
  const maxDuties = dutyData.length ? dutyData[0].duties : 0;
  const minDuties = dutyData.length ? dutyData[dutyData.length - 1].duties : 0;

  const exportReportExcel = () => {
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Assignments', totalDuties],
      ['Avg per Faculty', avgDuties],
      ['Max Duties', maxDuties],
      ['Min Duties', minDuties],
    ];
    const detailData = [
      ['Faculty', 'Department', 'Duties Assigned', 'Max Allowed', 'Load %'],
      ...dutyData.map(d => {
        const f = faculty.find(x => x.name === d.name);
        const pct = d.max > 0 ? Math.round((d.duties / d.max) * 100) : 0;
        return [d.name, f?.department ?? '', d.duties, d.max, `${pct}%`];
      }),
    ];
    const wb = utils.book_new();
    const wsSummary = utils.aoa_to_sheet(summaryData);
    const wsDetail = utils.aoa_to_sheet(detailData);
    wsDetail['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 8 }];
    utils.book_append_sheet(wb, wsSummary, 'Summary');
    utils.book_append_sheet(wb, wsDetail, 'Faculty Details');
    writeFile(wb, 'invigilation_report.xlsx');
  };

  const exportReportCSV = () => {
    const header = ['Faculty', 'Department', 'Duties Assigned', 'Max Allowed', 'Load %'];
    const rows = dutyData.map(d => {
      const f = faculty.find(x => x.name === d.name);
      const pct = d.max > 0 ? Math.round((d.duties / d.max) * 100) : 0;
      return [d.name, f?.department ?? '', d.duties, d.max, `${pct}%`].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invigilation_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Workload distribution and statistics</p>
        </div>
        {dutyData.some(d => d.duties > 0) && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportReportCSV} className="gap-2"><Download size={14} /> CSV</Button>
            <Button variant="outline" size="sm" onClick={exportReportExcel} className="gap-2"><FileSpreadsheet size={14} /> Excel</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Assignments', value: totalDuties },
          { label: 'Avg per Faculty', value: avgDuties },
          { label: 'Max Duties', value: maxDuties },
          { label: 'Min Duties', value: minDuties },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-display font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {dutyData.length > 0 && dutyData.some(d => d.duties > 0) ? (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Duty Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dutyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 87%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={80} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="duties" radius={[4, 4, 0, 0]}>
                {dutyData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          Generate a schedule first to see reports
        </div>
      )}

      {dutyData.length > 0 && dutyData.some(d => d.duties > 0) && (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Faculty</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Duties Assigned</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Max Allowed</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Load</th>
              </tr>
            </thead>
            <tbody>
              {dutyData.map(d => {
                const pct = d.max > 0 ? Math.round((d.duties / d.max) * 100) : 0;
                return (
                  <tr key={d.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">{d.name}</td>
                    <td className="p-3 text-foreground">{d.duties}</td>
                    <td className="p-3 text-muted-foreground">{d.max}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-destructive' : pct > 50 ? 'bg-accent' : 'bg-success'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
