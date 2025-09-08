/**
 * Handler to generate and return a CSV template for contact imports
 * This provides users with the correct format and headers for their CSV files
 */
export async function getCsvTemplate(): Promise<string> {
  // This is a placeholder declaration! Real code should be implemented here.
  // The goal of this handler is to generate a CSV template with the expected headers
  // Headers: nombre,apellido,email,telefono
  // Should include a sample row to guide users
  
  const headers = 'nombre,apellido,email,telefono';
  const sampleRow = 'Juan,Pérez,juan.perez@email.com,+34123456789';
  
  return `${headers}\n${sampleRow}`;
}