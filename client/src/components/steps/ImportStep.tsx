import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { Play, CheckCircle, XCircle, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import type { BatchValidationResult, ImportProgress } from '../../../../server/src/schema';

interface ImportStepProps {
  onPrevious: () => void;
  csvFile: File | null;
  csvData: string;
  validationResult: BatchValidationResult | null;
  onImportStarted: (batchId: number) => void;
  importBatchId: number | null;
  onReset: () => void;
}

export function ImportStep({
  onPrevious,
  csvFile,
  csvData,
  validationResult,
  onImportStarted,
  importBatchId,
  onReset
}: ImportStepProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Poll for import progress
  const pollProgress = useCallback(async (batchId: number) => {
    try {
      const progress = await trpc.getImportStatus.query({ batchId });
      setImportProgress(progress);

      // Stop polling if completed or failed
      if (progress?.status === 'completed' || progress?.status === 'failed') {
        if (pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
        setIsImporting(false);
      }
    } catch (err) {
      console.error('Error polling progress:', err);
    }
  }, [pollInterval]);

  // Start polling when import begins
  useEffect(() => {
    if (importBatchId && isImporting && !pollInterval) {
      // Initial poll
      pollProgress(importBatchId);
      
      // Set up interval
      const interval = setInterval(() => {
        pollProgress(importBatchId);
      }, 2000); // Poll every 2 seconds
      
      setPollInterval(interval);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [importBatchId, isImporting, pollInterval, pollProgress]);

  const startImport = useCallback(async () => {
    if (!csvFile || !csvData || !validationResult) return;

    setIsImporting(true);
    setError(null);

    try {
      // Convert CSV data to base64
      const base64Data = btoa(unescape(encodeURIComponent(csvData)));
      
      const importBatch = await trpc.startImport.mutate({
        csvData: base64Data,
        filename: csvFile.name
      });

      onImportStarted(importBatch.id);
      
      // Initial progress state
      setImportProgress({
        batchId: importBatch.id,
        status: 'processing',
        totalRecords: validationResult.validRows.length,
        processedRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        errors: []
      });

    } catch (err) {
      console.error('Error starting import:', err);
      setError('Error al iniciar la importación. Inténtalo de nuevo.');
      setIsImporting(false);
    }
  }, [csvFile, csvData, validationResult, onImportStarted]);

  const downloadImportLog = useCallback(async () => {
    if (!importBatchId) return;

    try {
      const csvContent = await trpc.downloadImportLog.query({ batchId: importBatchId });
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `import_log_${importBatchId}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error downloading log:', err);
      setError('Error al descargar el log. Inténtalo de nuevo.');
    }
  }, [importBatchId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
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

  const progressPercentage = importProgress 
    ? (importProgress.processedRecords / importProgress.totalRecords) * 100 
    : 0;

  // If import hasn't started yet
  if (!importBatchId && !isImporting) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Play className="h-8 w-8 text-green-600" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Listo para Importar
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Todos los datos están validados. Haz clic en "Iniciar Importación" para procesar 
              los contactos válidos.
            </p>
          </div>
        </div>

        {validationResult && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Resumen de Importación</CardTitle>
              <CardDescription>
                Lo que se procesará en esta importación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total de filas:</span>
                    <Badge variant="outline">{validationResult.totalRows}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-green-600">Contactos a importar:</span>
                    <Badge className="bg-green-100 text-green-800">{validationResult.validRows.length}</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-red-600">Filas con errores:</span>
                    <Badge variant="destructive">{validationResult.invalidRows.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-orange-600">Duplicados:</span>
                    <Badge variant="secondary">
                      {validationResult.duplicateEmails.length + validationResult.duplicatePhones.length}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={onPrevious}>
            ← Paso Anterior
          </Button>
          
          <Button
            onClick={startImport}
            disabled={!validationResult || validationResult.validRows.length === 0}
            className="bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <Play className="h-5 w-5 mr-2" />
            Iniciar Importación
          </Button>
        </div>
      </div>
    );
  }

  // Import in progress or completed
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
          importProgress?.status === 'completed' 
            ? 'bg-green-100' 
            : importProgress?.status === 'failed'
            ? 'bg-red-100'
            : 'bg-blue-100'
        }`}>
          {importProgress?.status === 'completed' ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : importProgress?.status === 'failed' ? (
            <XCircle className="h-8 w-8 text-red-600" />
          ) : (
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          )}
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {importProgress?.status === 'completed' 
              ? '¡Importación Completada!'
              : importProgress?.status === 'failed'
              ? 'Importación Fallida'
              : 'Importando Contactos...'}
          </h2>
          <p className="text-gray-600">
            {importProgress?.status === 'completed' 
              ? 'Los contactos han sido importados exitosamente.'
              : importProgress?.status === 'failed'
              ? 'Ocurrió un error durante la importación.'
              : 'Por favor espera mientras procesamos tus contactos.'}
          </p>
        </div>
      </div>

      {importProgress && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Estado de la Importación</CardTitle>
              <Badge className={getStatusColor(importProgress.status)}>
                {getStatusText(importProgress.status)}
              </Badge>
            </div>
            <CardDescription>
              Batch ID: #{importProgress.batchId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso</span>
                <span>{importProgress.processedRecords} de {importProgress.totalRecords}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-center text-sm text-gray-600">
                {Math.round(progressPercentage)}% completado
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {importProgress.successfulRecords}
                </div>
                <div className="text-sm text-gray-600">Exitosos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {importProgress.failedRecords}
                </div>
                <div className="text-sm text-gray-600">Fallidos</div>
              </div>
            </div>

            {/* Errors */}
            {importProgress.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">Errores encontrados:</div>
                    <ul className="list-disc list-inside text-sm">
                      {importProgress.errors.slice(0, 3).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {importProgress.errors.length > 3 && (
                        <li>... y {importProgress.errors.length - 3} más</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" className="max-w-2xl mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-center gap-4">
        {importProgress?.status === 'completed' && (
          <>
            <Button
              variant="outline"
              onClick={downloadImportLog}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar Log
            </Button>
            <Button onClick={onReset} className="bg-blue-600 hover:bg-blue-700">
              Nueva Importación
            </Button>
          </>
        )}
        
        {importProgress?.status === 'failed' && (
          <>
            <Button
              variant="outline"
              onClick={downloadImportLog}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar Log de Errores
            </Button>
            <Button variant="outline" onClick={onPrevious}>
              ← Volver
            </Button>
            <Button onClick={onReset}>
              Intentar de Nuevo
            </Button>
          </>
        )}

        {importProgress?.status === 'processing' && (
          <Button variant="outline" disabled>
            Importación en Progreso...
          </Button>
        )}
      </div>
    </div>
  );
}