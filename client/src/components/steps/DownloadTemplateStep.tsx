import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/utils/trpc';
import { Download, FileText, CheckCircle, Info } from 'lucide-react';

interface DownloadTemplateStepProps {
  onNext: () => void;
  onCompleted: () => void;
}

export function DownloadTemplateStep({ onNext, onCompleted }: DownloadTemplateStepProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    setError(null);
    
    try {
      const csvContent = await trpc.getCsvTemplate.query();
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', 'plantilla_contactos.csv');
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      setHasDownloaded(true);
      onCompleted();
      
    } catch (err) {
      console.error('Error downloading template:', err);
      setError('Error al descargar la plantilla. Inténtalo de nuevo.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <FileText className="h-8 w-8 text-blue-600" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Descarga la Plantilla CSV
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Antes de subir tus contactos, descarga nuestra plantilla CSV para asegurar 
            que tus datos tengan el formato correcto.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Formato de la Plantilla
          </CardTitle>
          <CardDescription>
            La plantilla incluye las siguientes columnas:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="font-medium">nombre</span>
                <span className="text-red-500 text-sm">(obligatorio)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="font-medium">apellido</span>
                <span className="text-red-500 text-sm">(obligatorio)</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                <span className="font-medium">email</span>
                <span className="text-gray-500 text-sm">(opcional)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                <span className="font-medium">telefono</span>
                <span className="text-gray-500 text-sm">(opcional)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert className="max-w-2xl mx-auto">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante:</strong> Los emails y teléfonos no pueden estar duplicados 
          en la base de datos. Los registros duplicados serán marcados como errores 
          durante la validación.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" className="max-w-2xl mx-auto">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-center gap-4">
        <Button
          onClick={handleDownloadTemplate}
          disabled={isDownloading}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isDownloading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Descargando...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Descargar Plantilla CSV
            </div>
          )}
        </Button>

        {hasDownloaded && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span>Plantilla descargada correctamente</span>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onNext}
            disabled={!hasDownloaded}
          >
            Continuar sin descargar
          </Button>
          
          {hasDownloaded && (
            <Button onClick={onNext}>
              Siguiente Paso →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}