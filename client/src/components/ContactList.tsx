import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/utils/trpc';
import { RefreshCw, Search, User, Mail, Phone, Calendar, ChevronLeft, ChevronRight, Users, AlertTriangle } from 'lucide-react';
import type { Contact } from '../../../server/src/schema';

export function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);

  const loadContacts = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await trpc.getContacts.query({ page, limit: 50 });
      setContacts(result.contacts);
      setPagination({
        page: result.page,
        limit: 50,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrevious: result.page > 1
      });
      setFilteredContacts(result.contacts);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError('Error al cargar los contactos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter contacts based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter((contact: Contact) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        contact.nombre.toLowerCase().includes(searchLower) ||
        contact.apellido.toLowerCase().includes(searchLower) ||
        (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
        (contact.telefono && contact.telefono.toLowerCase().includes(searchLower))
      );
    });

    setFilteredContacts(filtered);
  }, [contacts, searchTerm]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handlePageChange = useCallback((newPage: number) => {
    loadContacts(newPage);
  }, [loadContacts]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  if (isLoading && contacts.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Cargando contactos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (contacts.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay contactos
        </h3>
        <p className="text-gray-600 mb-4">
          Cuando importes contactos, aparecerán aquí listados.
        </p>
        <Button variant="outline" onClick={() => loadContacts()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{pagination.total.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Contactos</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {contacts.filter((c: Contact) => c.email).length}
                </div>
                <div className="text-sm text-gray-600">Con Email</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Phone className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {contacts.filter((c: Contact) => c.telefono).length}
                </div>
                <div className="text-sm text-gray-600">Con Teléfono</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{pagination.page}</div>
                <div className="text-sm text-gray-600">de {pagination.totalPages} páginas</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Controls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista de Contactos</CardTitle>
            <CardDescription>
              Todos los contactos importados en el sistema
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => loadContacts(pagination.page)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, apellido, email o teléfono..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Results info */}
            <div className="flex justify-between items-center text-sm text-gray-600">
              <div>
                {searchTerm ? (
                  <>
                    Mostrando {filteredContacts.length} de {contacts.length} contactos filtrados
                  </>
                ) : (
                  <>
                    Mostrando {contacts.length} contactos de {pagination.total} totales
                  </>
                )}
              </div>
              <div>
                Página {pagination.page} de {pagination.totalPages}
              </div>
            </div>

            {/* Contacts Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Registrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact: Contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-mono text-sm">#{contact.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {contact.nombre} {contact.apellido}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="font-mono text-sm">{contact.email}</span>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Sin email</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.telefono ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="font-mono text-sm">{contact.telefono}</span>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Sin teléfono</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(contact.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* No results */}
            {filteredContacts.length === 0 && searchTerm && (
              <div className="text-center py-8">
                <div className="text-gray-500">
                  No se encontraron contactos que coincidan con "{searchTerm}"
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setSearchTerm('')}
                  className="mt-2"
                >
                  Limpiar búsqueda
                </Button>
              </div>
            )}

            {/* Pagination */}
            {!searchTerm && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-gray-600">
                  Contactos {((pagination.page - 1) * pagination.limit) + 1} al{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                  {pagination.total}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevious || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNext || isLoading}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}