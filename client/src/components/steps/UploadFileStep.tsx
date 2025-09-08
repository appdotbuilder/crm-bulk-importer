import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, File, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface UploadFileStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onFileUploaded: (file: File, data: string) => void;
  file: File | null;
}

export function UploadFileStep({ onNext, onPrevious, onFileUploaded, file }: UploadFileStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return 'El archivo debe ser un CSV (.csv)';
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'El archivo es demasiado grande. Máximo 10MB permitido.';
    }

    // Check if file is empty
    if (file.size === 0) {
      return 'El archivo está vacío.';
    }

    return null;
  }, []);

  const readFileContent = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };
      reader.readAsText(file, 'UTF-8');
    });
  }, []);

  const handleFileSelection = useCallback(async (selectedFile: File) => {
    setError(null);
    setIsReading(true);

    try {
      // Validate file
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }

      // Read file content
      const content = await readFileContent(selectedFile);
      
      // Basic content validation
      if (!content.trim()) {
        setError('El archivo está vacío.');
        return;
      }

      // Check if it has at least headers
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        setError('El archivo debe tener al menos una fila de encabezados y una fila de datos.');
        return;
      }

      // Notify parent component
      onFileUploaded(selectedFile, content);
      
    } catch (err) {
      console.error('Error processing file:', err);
      setError('Error al procesar el archivo. Inténtalo de nuevo.');
    } finally {
      setIsReading(false);
    }
  }, [validateFile, readFileContent, onFileUploaded]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelection(selectedFile);
    }
  }, [handleFileSelection]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelection(droppedFile);
    }
  }, [handleFileSelection]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveFile = useCallback(() => {
    onFileUploaded(null as unknown as File, '');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileUploaded]);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Upload className="h-8 w-8 text-green-600" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Sube tu Archivo CSV
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Selecciona el archivo CSV con tus contactos. Asegúrate de que sigue el formato de la plantilla.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Seleccionar Archivo</CardTitle>
          <CardDescription>
            Arrastra y suelta tu archivo CSV aquí o haz clic para seleccionar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${isReading ? 'opacity-50 pointer-events-none' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isReading ? (
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600">Procesando archivo...</p>
              </div>
            ) : file ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-green-600 font-medium">Archivo cargado</span>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <File className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">{file.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-sm text-gray-600">
                    Tamaño: {formatFileSize(file.size)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Arrastra tu archivo CSV aquí
                  </p>
                  <p className="text-gray-600 mb-4">o</p>
                  <Button onClick={handleBrowseClick} variant="outline">
                    Seleccionar archivo
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Máximo 10MB • Solo archivos .csv
                </p>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

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
          onClick={onNext}
          disabled={!file || isReading}
        >
          Siguiente Paso →
        </Button>
      </div>
    </div>
  );
}