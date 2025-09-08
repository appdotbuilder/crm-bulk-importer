import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/utils/trpc';
import { Eye, AlertTriangle, CheckCircle, XCircle, Mail, Phone } from 'lucide-react';
import type { BatchValidationResult } from '../../../../server/src/schema';

interface PreviewStepProps {
  onNext: () => void;
  onPrevious: () => void;
  csvFile: File | null;
  csvData: string;
  onValidationComplete: (result: BatchValidationResult) => void;
  validationResult: BatchValidationResult | null;
}

export function PreviewStep({
  onNext,
  onPrevious,
  csvFile,
  csvData,
  onValidationComplete,
  validationResult
}: PreviewStepProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateData = useCallback(async () => {
    if (!csvFile || !csvData) return;

    setIsValidating(true);
    setError(null);

    try {
      // Convert CSV data to base64
      const base64Data = btoa(unescape(encodeURIComponent(csvData)));
      
      const result = await trpc.previewImport.mutate({
        csvData: base64Data,
        filename: csvFile.name
      });

      onValidationComplete(result);
    } catch (err) {
      console.error('Error validating data:', err);
      setError('Error al validar los datos. Inténtalo de nuevo.');
    } finally {
      setIsValidating(false);
    }
  }, [csvFile, csvData, onValidationComplete]);

  useEffect(() => {
    if (csvFile && csvData && !validationResult) {
      validateData();
    }
  }, [csvFile, csvData, validationResult, validateData]);

  const renderValidRows = () => {
    if (!validationResult || validationResult.validRows.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No hay filas válidas para mostrar
        </div>
      );
    }

    return (
      <ScrollArea className="h-96">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fila</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Apellido</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validationResult.validRows.slice(0, 50).map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="font-mono text-sm">#{row.rowNumber}</TableCell>
                <TableCell>{row.data.nombre}</TableCell>
                <TableCell>{row.data.apellido}</TableCell>
                <TableCell>{row.data.email || '-'}</TableCell>
                <TableCell>{row.data.telefono || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {validationResult.validRows.length > 50 && (
          <div className="text-center py-4 text-sm text-gray-500">
            Mostrando primeras 50 filas de {validationResult.validRows.length} válidas
          </div>
        )}
      </ScrollArea>
    );
  };

  const renderInvalidRows = () => {
    if (!validationResult || validationResult.invalidRows.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          ¡Excelente! No hay errores de validación
        </div>
      );
    }

    return (
      <ScrollArea className="h-96">
        <div className="space-y-4">
          {validationResult.invalidRows.map((row) => (
            <Card key={row.rowNumber} className="border-red-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Fila #{row.rowNumber}
                  </CardTitle>
                  <Badge variant="destructive">
                    {row.errors.length} error{row.errors.length > 1 ? 'es' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Datos originales:</span>
                      <div className="bg-gray-50 rounded p-2 mt-1">
                        {Object.entries(row.data).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-mono">{key}:</span> {value || '(vacío)'}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-red-600">Errores:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {row.errors.map((error, index) => (
                          <li key={index} className="text-red-600 text-sm">{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    );
  };

  const renderDuplicates = () => {
    const hasEmailDuplicates = validationResult?.duplicateEmails.length ?? 0 > 0;
    const hasPhoneDuplicates = validationResult?.duplicatePhones.length ?? 0 > 0;

    if (!hasEmailDuplicates && !hasPhoneDuplicates) {
      return (
        <div className="text-center py-8 text-gray-500">
          ¡Excelente! No se encontraron duplicados
        </div>
      );
    }

    return (
      <ScrollArea className="h-96">
        <div className="space-y-6">
          {hasEmailDuplicates && (
            <div>
              <h4 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Emails Duplicados ({validationResult!.duplicateEmails.length})
              </h4>
              <div className="space-y-3">
                {validationResult!.duplicateEmails.map((duplicate, index) => (
                  <Card key={index} className="border-orange-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{duplicate.email}</span>
                        <Badge variant="outline" className="text-orange-600">
                          Filas: {duplicate.rowNumbers.join(', ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {hasPhoneDuplicates && (
            <div>
              <h4 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Teléfonos Duplicados ({validationResult!.duplicatePhones.length})
              </h4>
              <div className="space-y-3">
                {validationResult!.duplicatePhones.map((duplicate, index) => (
                  <Card key={index} className="border-orange-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{duplicate.telefono}</span>
                        <Badge variant="outline" className="text-orange-600">
                          Filas: {duplicate.rowNumbers.join(', ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    );
  };

  if (isValidating) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Validando Datos
            </h2>
            <p className="text-gray-600">
              Analizando tu archivo CSV y validando los datos...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={onPrevious}>
            ← Paso Anterior
          </Button>
          <Button onClick={validateData}>
            Reintentar Validación
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
          <Eye className="h-8 w-8 text-purple-600" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Previsualización y Validación
          </h2>
          <p className="text-gray-600">
            Revisa los datos validados antes de proceder con la importación
          </p>
        </div>
      </div>

      {validationResult && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div className="text-sm font-medium text-gray-600">Total</div>
                </div>
                <div className="text-2xl font-bold">{validationResult.totalRows}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="text-sm font-medium text-green-600">Válidas</div>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {validationResult.validRows.length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div className="text-sm font-medium text-red-600">Errores</div>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {validationResult.invalidRows.length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <div className="text-sm font-medium text-orange-600">Duplicados</div>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {validationResult.duplicateEmails.length + validationResult.duplicatePhones.length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Detailed Tabs */}
          <Tabs defaultValue="valid" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="valid">
                Datos Válidos ({validationResult.validRows.length})
              </TabsTrigger>
              <TabsTrigger value="errors">
                Errores ({validationResult.invalidRows.length})
              </TabsTrigger>
              <TabsTrigger value="duplicates">
                Duplicados ({validationResult.duplicateEmails.length + validationResult.duplicatePhones.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="valid" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filas Válidas</CardTitle>
                  <CardDescription>
                    Estas filas serán importadas correctamente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderValidRows()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="errors" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Errores de Validación</CardTitle>
                  <CardDescription>
                    Estas filas contienen errores y no serán importadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderInvalidRows()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="duplicates" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Duplicados Detectados</CardTitle>
                  <CardDescription>
                    Valores que ya existen en la base de datos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderDuplicates()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {validationResult.validRows.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{validationResult.validRows.length} contactos</strong> están listos para ser importados.
                {validationResult.invalidRows.length > 0 && (
                  <> {validationResult.invalidRows.length} filas con errores serán omitidas.</>
                )}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={onPrevious}>
          ← Paso Anterior
        </Button>
        
        <Button
          onClick={onNext}
          disabled={!validationResult || validationResult.validRows.length === 0}
        >
          Proceder con Importación →
        </Button>
      </div>
    </div>
  );
}