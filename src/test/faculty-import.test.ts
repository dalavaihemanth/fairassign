import { describe, it, expect, vi } from 'vitest';

describe('Faculty import with single name column', () => {
  it('should use defaults when only name is provided', () => {
    const addFaculty = vi.fn();
    const rows = [
      ['Dr. Test1', '', ''],
      ['Dr. Test2'],
      ['Dr. Test3', '', ''],
    ];

    let success = 0;
    const errors: string[] = [];

    rows.forEach((row, i) => {
      const [name, department, maxDutiesStr] = row;
      if (!name?.trim()) {
        errors.push(`Row ${i + 2}: Missing name`);
        return;
      }
      const dept = department?.trim() || 'General';
      const maxDuties = parseInt(maxDutiesStr) || 6;
      if (maxDuties < 1 || maxDuties > 20) {
        errors.push(`Row ${i + 2}: Max duties must be 1–20`);
        return;
      }
      addFaculty({ name: name.trim(), department: dept, maxDuties });
      success++;
    });

    expect(success).toBe(3);
    expect(errors).toHaveLength(0);
    expect(addFaculty).toHaveBeenCalledTimes(3);
    expect(addFaculty).toHaveBeenCalledWith({ name: 'Dr. Test1', department: 'General', maxDuties: 6 });
    expect(addFaculty).toHaveBeenCalledWith({ name: 'Dr. Test2', department: 'General', maxDuties: 6 });
    expect(addFaculty).toHaveBeenCalledWith({ name: 'Dr. Test3', department: 'General', maxDuties: 6 });
  });

  it('should reject empty names', () => {
    const rows = [[''], ['  '], ['Dr. Valid']];
    let success = 0;
    const errors: string[] = [];

    rows.forEach((row, i) => {
      const [name, department, maxDutiesStr] = row;
      if (!name?.trim()) {
        errors.push(`Row ${i + 2}: Missing name`);
        return;
      }
      const dept = department?.trim() || 'General';
      const maxDuties = parseInt(maxDutiesStr) || 6;
      success++;
    });

    expect(success).toBe(1);
    expect(errors).toHaveLength(2);
  });

  it('should use provided department when available', () => {
    const addFaculty = vi.fn();
    const rows = [['Dr. A', 'CSE', '5']];

    rows.forEach((row) => {
      const [name, department, maxDutiesStr] = row;
      const dept = department?.trim() || 'General';
      const maxDuties = parseInt(maxDutiesStr) || 6;
      addFaculty({ name: name.trim(), department: dept, maxDuties });
    });

    expect(addFaculty).toHaveBeenCalledWith({ name: 'Dr. A', department: 'CSE', maxDuties: 5 });
  });
});
