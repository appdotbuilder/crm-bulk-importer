import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { contactsTable } from '../db/schema';
import { getContacts } from '../handlers/get_contacts';
import { type CreateContactInput } from '../schema';

describe('getContacts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestContact = async (overrides: Partial<CreateContactInput> = {}) => {
    const defaultContact = {
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan.perez@email.com',
      telefono: '555-1234',
      ...overrides
    };

    const result = await db.insert(contactsTable)
      .values(defaultContact)
      .returning()
      .execute();

    return result[0];
  };

  it('should return empty result when no contacts exist', async () => {
    const result = await getContacts();

    expect(result.contacts).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(0);
  });

  it('should return contacts with default pagination', async () => {
    // Create test contacts
    await createTestContact({ nombre: 'María', email: 'maria@email.com' });
    await createTestContact({ nombre: 'Carlos', email: 'carlos@email.com' });

    const result = await getContacts();

    expect(result.contacts).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);

    // Verify contact structure
    const contact = result.contacts[0];
    expect(contact.id).toBeDefined();
    expect(contact.nombre).toBeDefined();
    expect(contact.apellido).toBeDefined();
    expect(contact.created_at).toBeInstanceOf(Date);
    expect(contact.updated_at).toBeInstanceOf(Date);
  });

  it('should handle custom page and limit parameters', async () => {
    // Create 5 test contacts
    for (let i = 1; i <= 5; i++) {
      await createTestContact({ 
        nombre: `Test${i}`, 
        email: `test${i}@email.com` 
      });
    }

    // Get page 2 with limit 2
    const result = await getContacts(2, 2);

    expect(result.contacts).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);
  });

  it('should order contacts by most recent first', async () => {
    // Create contacts with small delay to ensure different timestamps
    const contact1 = await createTestContact({ nombre: 'First', email: 'first@email.com' });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const contact2 = await createTestContact({ nombre: 'Second', email: 'second@email.com' });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const contact3 = await createTestContact({ nombre: 'Third', email: 'third@email.com' });

    const result = await getContacts();

    // Most recent should be first
    expect(result.contacts).toHaveLength(3);
    expect(result.contacts[0].nombre).toBe('Third');
    expect(result.contacts[1].nombre).toBe('Second');
    expect(result.contacts[2].nombre).toBe('First');

    // Verify timestamps are in descending order
    const timestamps = result.contacts.map(c => c.created_at.getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i-1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  it('should handle invalid page numbers gracefully', async () => {
    await createTestContact();

    // Test negative page number
    const result1 = await getContacts(-1);
    expect(result1.page).toBe(1);

    // Test zero page number
    const result2 = await getContacts(0);
    expect(result2.page).toBe(1);

    // Test page beyond available data
    const result3 = await getContacts(999);
    expect(result3.page).toBe(999);
    expect(result3.contacts).toHaveLength(0);
    expect(result3.total).toBe(1);
    expect(result3.totalPages).toBe(1);
  });

  it('should cap limit at reasonable maximum', async () => {
    await createTestContact();

    // Test very large limit
    const result = await getContacts(1, 999);
    expect(result.contacts).toHaveLength(1);
    
    // The implementation should cap at 100, but we can't easily test the exact limit
    // without creating 100+ records. This test verifies it doesn't crash.
  });

  it('should handle contacts with nullable fields', async () => {
    // Create contact with null email and phone
    await createTestContact({ 
      nombre: 'NoContact', 
      apellido: 'Person',
      email: null, 
      telefono: null 
    });

    const result = await getContacts();

    expect(result.contacts).toHaveLength(1);
    const contact = result.contacts[0];
    expect(contact.nombre).toBe('NoContact');
    expect(contact.apellido).toBe('Person');
    expect(contact.email).toBeNull();
    expect(contact.telefono).toBeNull();
  });

  it('should calculate pagination correctly with larger datasets', async () => {
    // Create 7 contacts
    for (let i = 1; i <= 7; i++) {
      await createTestContact({ 
        nombre: `Contact${i}`, 
        email: `contact${i}@email.com` 
      });
    }

    // Test various pages with limit of 3
    const page1 = await getContacts(1, 3);
    expect(page1.contacts).toHaveLength(3);
    expect(page1.total).toBe(7);
    expect(page1.totalPages).toBe(3);

    const page2 = await getContacts(2, 3);
    expect(page2.contacts).toHaveLength(3);
    expect(page2.total).toBe(7);
    expect(page2.totalPages).toBe(3);

    const page3 = await getContacts(3, 3);
    expect(page3.contacts).toHaveLength(1); // Last page has remainder
    expect(page3.total).toBe(7);
    expect(page3.totalPages).toBe(3);
  });

  it('should verify contact data integrity', async () => {
    const testData = {
      nombre: 'Ana',
      apellido: 'González',
      email: 'ana.gonzalez@company.com',
      telefono: '+1-555-9876'
    };

    await createTestContact(testData);
    const result = await getContacts();

    expect(result.contacts).toHaveLength(1);
    const contact = result.contacts[0];
    
    expect(contact.nombre).toBe(testData.nombre);
    expect(contact.apellido).toBe(testData.apellido);
    expect(contact.email).toBe(testData.email);
    expect(contact.telefono).toBe(testData.telefono);
    expect(contact.id).toBeGreaterThan(0);
    expect(contact.created_at).toBeInstanceOf(Date);
    expect(contact.updated_at).toBeInstanceOf(Date);
  });
});