import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/utils/trpc';
import { RefreshCw, Download, Eye, FileText, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import type { ImportBatch, ImportLogEntry } from '../../../server/src/schema';

export function ImportHistory() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [logEntries, setLogEntries] = useState<ImportLogEntry[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(false);

  const loadBatches = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await trpc.getImportBatches.query();
      setBatches(result);
    } catch (err) {
      console.error('Error loading import batches:', err);
      setError('Error al cargar el historial de importaciones.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLogDetails = useCallback(async (batchId: number) => {
    setIsLoadingLog(true);
    
    try {
      const result = await trpc.getImportLog.query({ batchId });
      setLogEntries(result);
    } catch (err) {
      console.error('Error loading log details:', err);
      setError('Error al cargar los detalles del log.');
    } finally {
      setIsLoadingLog(false);
    }
  }, []);

  const downloadLog = useCallback(async (batchId: number) => {
    try {
      const csvContent = await trpc.downloadImportLog.query({ batchId });
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `import_log_${batchId}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error downloading log:', err);
      setError('Error al descargar el log.');
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'failed':
        return 'Fallido';
      case 'processing':
        return 'Procesando';
      case 'pending':
        return 'Pendiente';
      default:
        return status;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const calculateSuccessRate = (batch: ImportBatch) => {
    if (batch.total_records === 0) return 0;
    return Math.round((batch.successful_records / batch.total_records) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Cargando historial...</span>
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

  if (batches.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay importaciones previas
        </h3>
        <p className="text-gray-600 mb-4">
          Cuando realices tu primera importación, aparecerá aquí el historial.
        </p>
        <Button variant="outline" onClick={loadBatches}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>
    );
  }

  // Calculate summary stats
  const totalImports = batches.length;
  const completedImports = batches.filter(b => b.status === 'completed').length;
  const totalRecords = batches.reduce((sum, b) => sum + b.total_records, 0);
  const successfulRecords = batches.reduce((sum, b) => sum + b.successful_records, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div className="text-sm font-medium text-gray-600">Total Importaciones</div>
            </div>
            <div className="text-2xl font-bold">{totalImports}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div className="text-sm font-medium text-green-600">Completadas</div>
            </div>
            <div className="text-2xl font-bold text-green-600">{completedImports}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <div className="text-sm font-medium text-purple-600">Registros Totales</div>
            </div>
            <div className="text-2xl font-bold text-purple-600">{totalRecords.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="text-sm font-medium text-gray-600">Exitosos</div>
            </div>
            <div className="text-2xl font-bold">{successfulRecords.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Batches Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historial de Importaciones</CardTitle>
            <CardDescription>
              Todas las importaciones realizadas ordenadas por fecha
            </CardDescription>
          </div>
          <Button variant="outline" onClick={loadBatches}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Exitosos</TableHead>
                <TableHead>Fallidos</TableHead>
                <TableHead>Tasa de Éxito</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch: ImportBatch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-mono">#{batch.id}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={batch.filename}>
                    {batch.filename}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(batch.status)}>
                      {getStatusText(batch.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{batch.total_records.toLocaleString()}</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    {batch.successful_records.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-red-600 font-medium">
                    {batch.failed_records.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">
                        {calculateSuccessRate(batch)}%
                      </div>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${calculateSuccessRate(batch)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(batch.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBatch(batch);
                              loadLogDetails(batch.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>Detalles de Importación #{batch.id}</DialogTitle>
                            <DialogDescription>
                              {batch.filename} • {formatDate(batch.created_at)}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            {/* Batch Summary */}
                            <div className="grid grid-cols-4 gap-4">
                              <div className="text-center">
                                <div className="text-xl font-bold">{batch.total_records}</div>
                                <div className="text-sm text-gray-600">Total</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-bold text-green-600">{batch.successful_records}</div>
                                <div className="text-sm text-gray-600">Exitosos</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-bold text-red-600">{batch.failed_records}</div>
                                <div className="text-sm text-gray-600">Fallidos</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-bold">{calculateSuccessRate(batch)}%</div>
                                <div className="text-sm text-gray-600">Éxito</div>
                              </div>
                            </div>

                            {/* Log Entries */}
                            {isLoadingLog ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                                Cargando detalles...
                              </div>
                            ) : (
                              <ScrollArea className="h-[400px]">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Fila</TableHead>
                                      <TableHead>Estado</TableHead>
                                      <TableHead>Datos</TableHead>
                                      <TableHead>Error</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {logEntries.map((entry: ImportLogEntry) => (
                                      <TableRow key={entry.id}>
                                        <TableCell className="font-mono">#{entry.row_number}</TableCell>
                                        <TableCell>
                                          <Badge
                                            className={entry.status === 'success' 
                                              ? 'bg-green-100 text-green-800' 
                                              : 'bg-red-100 text-red-800'
                                            }
                                          >
                                            {entry.status === 'success' ? 'Éxito' : 'Error'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[300px]">
                                          <div className="text-sm font-mono bg-gray-50 rounded p-2 truncate">
                                            {entry.raw_data}
                                          </div>
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                          {entry.error_message && (
                                            <div className="text-sm text-red-600 truncate" title={entry.error_message}>
                                              {entry.error_message}
                                            </div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </ScrollArea>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadLog(batch.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}