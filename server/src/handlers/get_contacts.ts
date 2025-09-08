import { db } from '../db';
import { contactsTable } from '../db/schema';
import { type Contact } from '../schema';
import { count, desc } from 'drizzle-orm';

/**
 * Handler to retrieve contacts with pagination support
 * Enables users to view imported contacts and verify import results
 */
export async function getContacts(page: number = 1, limit: number = 50): Promise<{
  contacts: Contact[];
  total: number;
  page: number;
  totalPages: number;
}> {
  try {
    // Validate pagination parameters
    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, Math.min(100, limit)); // Cap at 100 items per page
    const offset = (currentPage - 1) * pageSize;

    // Get total count of contacts
    const totalResult = await db.select({ count: count() })
      .from(contactsTable)
      .execute();
    
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Build paginated query - order by most recent first, then apply pagination
    const contacts = await db.select()
      .from(contactsTable)
      .orderBy(desc(contactsTable.created_at))
      .limit(pageSize)
      .offset(offset)
      .execute();

    return {
      contacts,
      total,
      page: currentPage,
      totalPages
    };
  } catch (error) {
    console.error('Failed to retrieve contacts:', error);
    throw error;
  }
}