import { describe, expect, it } from 'bun:test';
import { getCsvTemplate } from '../handlers/get_csv_template';

describe('getCsvTemplate', () => {
  it('should return a CSV template with correct headers', async () => {
    const result = await getCsvTemplate();
    
    const lines = result.split('\n');
    const headers = lines[0];
    
    expect(headers).toEqual('nombre,apellido,email,telefono');
  });

  it('should include sample data rows', async () => {
    const result = await getCsvTemplate();
    
    const lines = result.split('\n');
    
    // Should have at least 3 lines (header + 2 sample rows)
    expect(lines.length).toBeGreaterThanOrEqual(3);
    
    // Check that we have actual sample data (not just headers)
    expect(lines[1]).toContain('Juan');
    expect(lines[1]).toContain('Pérez');
    expect(lines[1]).toContain('@');
    expect(lines[1]).toContain('+34');
  });

  it('should return valid CSV format', async () => {
    const result = await getCsvTemplate();
    
    const lines = result.split('\n');
    
    // Each line should have 4 comma-separated values
    lines.forEach((line, index) => {
      if (line.trim()) { // Skip empty lines
        const fields = line.split(',');
        expect(fields.length).toEqual(4);
      }
    });
  });

  it('should include multiple sample rows for better guidance', async () => {
    const result = await getCsvTemplate();
    
    const lines = result.split('\n').filter(line => line.trim());
    
    // Should have header + multiple sample rows
    expect(lines.length).toBeGreaterThan(2);
    
    // Verify different sample data exists
    expect(result).toContain('Juan');
    expect(result).toContain('María');
  });

  it('should return consistent format on multiple calls', async () => {
    const result1 = await getCsvTemplate();
    const result2 = await getCsvTemplate();
    
    expect(result1).toEqual(result2);
  });

  it('should include proper email format examples', async () => {
    const result = await getCsvTemplate();
    
    // Should contain email examples with @ symbol
    expect(result).toMatch(/@email\.com/);
  });

  it('should include proper phone format examples', async () => {
    const result = await getCsvTemplate();
    
    // Should contain phone examples with country code format
    expect(result).toMatch(/\+34\d+/);
  });
});