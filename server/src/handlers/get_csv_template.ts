/**
 * Handler to generate and return a CSV template for contact imports
 * This provides users with the correct format and headers for their CSV files
 */
export async function getCsvTemplate(): Promise<string> {
  // Define the CSV headers based on the contact schema
  const headers = 'nombre,apellido,email,telefono';
  
  // Provide a sample row to guide users on the expected format
  const sampleRow = 'Juan,Pérez,juan.perez@email.com,+34123456789';
  const sampleRow2 = 'María,García,maria.garcia@email.com,+34987654321';
  
  // Return the CSV template with headers and sample data
  return `${headers}\n${sampleRow}\n${sampleRow2}`;
}