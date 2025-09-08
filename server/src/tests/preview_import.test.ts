import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { contactsTable } from '../db/schema';
import { type PreviewImportInput } from '../schema';
import { previewImport } from '../handlers/preview_import';

describe('previewImport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createCsvBase64 = (csvContent: string): string => {
    return Buffer.from(csvContent, 'utf-8').toString('base64');
  };

  it('should handle empty CSV', async () => {
    const csvContent = 'nombre,apellido,email,telefono\n';
    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'empty.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(0);
    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.duplicateEmails).toHaveLength(0);
    expect(result.duplicatePhones).toHaveLength(0);
  });

  it('should validate valid CSV data correctly', async () => {
    const csvContent = `nombre,apellido,email,telefono
Juan,Pérez,juan@test.com,123456789
María,González,maria@test.com,987654321`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'valid.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toHaveLength(2);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.duplicateEmails).toHaveLength(0);
    expect(result.duplicatePhones).toHaveLength(0);

    // Check first valid row
    expect(result.validRows[0].rowNumber).toBe(1);
    expect(result.validRows[0].data.nombre).toBe('Juan');
    expect(result.validRows[0].data.apellido).toBe('Pérez');
    expect(result.validRows[0].data.email).toBe('juan@test.com');
    expect(result.validRows[0].data.telefono).toBe('123456789');

    // Check second valid row
    expect(result.validRows[1].rowNumber).toBe(2);
    expect(result.validRows[1].data.nombre).toBe('María');
    expect(result.validRows[1].data.apellido).toBe('González');
    expect(result.validRows[1].data.email).toBe('maria@test.com');
    expect(result.validRows[1].data.telefono).toBe('987654321');
  });

  it('should handle rows with missing required fields', async () => {
    const csvContent = `nombre,apellido,email,telefono
,Pérez,juan@test.com,123456789
María,,maria@test.com,987654321
Carlos,López,,`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'missing_fields.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(1); // Only Carlos López is valid
    expect(result.invalidRows).toHaveLength(2);

    // Check invalid rows
    expect(result.invalidRows[0].rowNumber).toBe(1);
    expect(result.invalidRows[0].errors).toContain('nombre: Nombre es obligatorio');
    expect(result.invalidRows[0].data['nombre']).toBe('');
    expect(result.invalidRows[0].data['apellido']).toBe('Pérez');

    expect(result.invalidRows[1].rowNumber).toBe(2);
    expect(result.invalidRows[1].errors).toContain('apellido: Apellido es obligatorio');
    expect(result.invalidRows[1].data['nombre']).toBe('María');
    expect(result.invalidRows[1].data['apellido']).toBe('');

    // Check valid row
    expect(result.validRows[0].rowNumber).toBe(3);
    expect(result.validRows[0].data.nombre).toBe('Carlos');
    expect(result.validRows[0].data.apellido).toBe('López');
    expect(result.validRows[0].data.email).toBe(null);
    expect(result.validRows[0].data.telefono).toBe(null);
  });

  it('should handle invalid email formats', async () => {
    const csvContent = `nombre,apellido,email,telefono
Juan,Pérez,invalid-email,123456789
María,González,maria@,987654321
Carlos,López,@test.com,555666777`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'invalid_emails.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(3);

    result.invalidRows.forEach(row => {
      expect(row.errors.some(error => error.includes('Email inválido'))).toBe(true);
    });
  });

  it('should detect duplicate emails within CSV', async () => {
    const csvContent = `nombre,apellido,email,telefono
Juan,Pérez,duplicate@test.com,123456789
María,González,maria@test.com,987654321
Carlos,López,duplicate@test.com,555666777`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'duplicate_emails.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(3);
    expect(result.duplicateEmails).toHaveLength(1);
    expect(result.duplicatePhones).toHaveLength(0);

    expect(result.duplicateEmails[0].email).toBe('duplicate@test.com');
    expect(result.duplicateEmails[0].rowNumbers).toEqual([1, 3]);
  });

  it('should detect duplicate phone numbers within CSV', async () => {
    const csvContent = `nombre,apellido,email,telefono
Juan,Pérez,juan@test.com,123456789
María,González,maria@test.com,123456789
Carlos,López,carlos@test.com,555666777`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'duplicate_phones.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(3);
    expect(result.duplicateEmails).toHaveLength(0);
    expect(result.duplicatePhones).toHaveLength(1);

    expect(result.duplicatePhones[0].telefono).toBe('123456789');
    expect(result.duplicatePhones[0].rowNumbers).toEqual([1, 2]);
  });

  it('should detect duplicates against existing database records', async () => {
    // Create existing contact in database
    await db.insert(contactsTable).values({
      nombre: 'Existing',
      apellido: 'Contact',
      email: 'existing@test.com',
      telefono: '999888777'
    }).execute();

    const csvContent = `nombre,apellido,email,telefono
Juan,Pérez,existing@test.com,123456789
María,González,maria@test.com,999888777
Carlos,López,carlos@test.com,555666777`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'database_duplicates.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(3);
    expect(result.duplicateEmails).toHaveLength(1);
    expect(result.duplicatePhones).toHaveLength(1);

    expect(result.duplicateEmails[0].email).toBe('existing@test.com');
    expect(result.duplicateEmails[0].rowNumbers).toEqual([1]);

    expect(result.duplicatePhones[0].telefono).toBe('999888777');
    expect(result.duplicatePhones[0].rowNumbers).toEqual([2]);
  });

  it('should handle mixed case email duplicates correctly', async () => {
    const csvContent = `nombre,apellido,email,telefono
Juan,Pérez,DUPLICATE@test.com,123456789
María,González,maria@test.com,987654321
Carlos,López,duplicate@TEST.com,555666777`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'case_duplicates.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(3);
    expect(result.duplicateEmails).toHaveLength(1);

    expect(result.duplicateEmails[0].email).toBe('duplicate@test.com');
    expect(result.duplicateEmails[0].rowNumbers).toEqual([1, 3]);
  });

  it('should handle CSV with whitespace and trim values', async () => {
    const csvContent = `nombre,apellido,email,telefono
" Juan ",  Pérez  , juan@test.com , 123456789 
María," González ",maria@test.com,987654321`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'whitespace.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toHaveLength(2);
    expect(result.invalidRows).toHaveLength(0);

    expect(result.validRows[0].data.nombre).toBe('Juan');
    expect(result.validRows[0].data.apellido).toBe('Pérez');
    expect(result.validRows[0].data.email).toBe('juan@test.com');
    expect(result.validRows[0].data.telefono).toBe('123456789');

    expect(result.validRows[1].data.nombre).toBe('María');
    expect(result.validRows[1].data.apellido).toBe('González');
  });

  it('should handle null/empty optional fields correctly', async () => {
    const csvContent = `nombre,apellido,email,telefono
Juan,Pérez,,
María,González,"",""
Carlos,López,carlos@test.com,`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'empty_optional.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(3);
    expect(result.invalidRows).toHaveLength(0);

    // Check that empty strings are converted to null
    expect(result.validRows[0].data.email).toBe(null);
    expect(result.validRows[0].data.telefono).toBe(null);

    expect(result.validRows[1].data.email).toBe(null);
    expect(result.validRows[1].data.telefono).toBe(null);

    expect(result.validRows[2].data.email).toBe('carlos@test.com');
    expect(result.validRows[2].data.telefono).toBe(null);
  });

  it('should handle complex scenario with multiple issues', async () => {
    // Create existing contact
    await db.insert(contactsTable).values({
      nombre: 'Existing',
      apellido: 'User',
      email: 'existing@test.com',
      telefono: '999888777'
    }).execute();

    const csvContent = `nombre,apellido,email,telefono
Juan,Pérez,invalid-email,123456789
,González,maria@test.com,987654321
Carlos,López,duplicate@test.com,555666777
Ana,Martín,duplicate@test.com,555666777
Luis,Rodríguez,existing@test.com,999888777
Sofia,Castro,sofia@test.com,111222333`;

    const input: PreviewImportInput = {
      csvData: createCsvBase64(csvContent),
      filename: 'complex.csv'
    };

    const result = await previewImport(input);

    expect(result.totalRows).toBe(6);
    expect(result.validRows).toHaveLength(4); // Carlos, Ana, Luis, Sofia
    expect(result.invalidRows).toHaveLength(2); // Juan (invalid email), González (missing nombre)

    // Check duplicates within CSV
    expect(result.duplicateEmails).toHaveLength(2);
    expect(result.duplicatePhones).toHaveLength(2); // Carlos+Ana internal duplicate, Luis database duplicate

    // Internal CSV duplicates
    const internalEmailDupe = result.duplicateEmails.find(d => d.email === 'duplicate@test.com');
    expect(internalEmailDupe).toBeDefined();
    expect(internalEmailDupe!.rowNumbers).toEqual([3, 4]);

    const internalPhoneDupe = result.duplicatePhones.find(d => d.telefono === '555666777');
    expect(internalPhoneDupe).toBeDefined();
    expect(internalPhoneDupe!.rowNumbers).toEqual([3, 4]);

    // Database duplicates
    const dbEmailDupe = result.duplicateEmails.find(d => d.email === 'existing@test.com');
    expect(dbEmailDupe).toBeDefined();
    expect(dbEmailDupe!.rowNumbers).toEqual([5]);

    const dbPhoneDupe = result.duplicatePhones.find(d => d.telefono === '999888777');
    expect(dbPhoneDupe).toBeDefined();
    expect(dbPhoneDupe!.rowNumbers).toEqual([5]);
  });
});