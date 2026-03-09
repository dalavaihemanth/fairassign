import { describe, it, expect } from 'vitest';
import { parseCSV } from '@/lib/csv';

describe('parseCSV', () => {
  it('parses simple CSV', () => {
    const text = 'Name,Department,MaxDuties\nDr. Mehta,IT,5\nDr. Rao,CSE,6';
    const rows = parseCSV(text);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(['Name', 'Department', 'MaxDuties']);
    expect(rows[1]).toEqual(['Dr. Mehta', 'IT', '5']);
    expect(rows[2]).toEqual(['Dr. Rao', 'CSE', '6']);
  });

  it('handles quoted fields', () => {
    const text = 'Name,Dept\n"Dr. A, Jr.",CSE';
    const rows = parseCSV(text);
    expect(rows[1]).toEqual(['Dr. A, Jr.', 'CSE']);
  });

  it('handles empty lines and whitespace', () => {
    const text = 'A,B\n  x , y \n';
    const rows = parseCSV(text);
    expect(rows[1]).toEqual(['x', 'y']);
  });

  it('handles Windows line endings', () => {
    const text = 'A,B\r\n1,2\r\n3,4';
    const rows = parseCSV(text);
    expect(rows).toHaveLength(3);
  });
});
