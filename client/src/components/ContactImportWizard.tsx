import { useState, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DownloadTemplateStep } from '@/components/steps/DownloadTemplateStep';
import { UploadFileStep } from '@/components/steps/UploadFileStep';
import { PreviewStep } from '@/components/steps/PreviewStep';
import { ImportStep } from '@/components/steps/ImportStep';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';
import type { BatchValidationResult } from '../../../server/src/schema';

type WizardStep = 1 | 2 | 3 | 4;

interface WizardStepInfo {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: Record<WizardStep, WizardStepInfo> = {
  1: {
    title: 'Descargar Plantilla',
    description: 'Obtén el archivo CSV de plantilla',
    icon: <Circle className="h-5 w-5" />
  },
  2: {
    title: 'Subir Archivo',
    description: 'Selecciona tu archivo CSV',
    icon: <Circle className="h-5 w-5" />
  },
  3: {
    title: 'Previsualización',
    description: 'Revisa los datos y errores',
    icon: <Circle className="h-5 w-5" />
  },
  4: {
    title: 'Importar',
    description: 'Inicia la importación final',
    icon: <Circle className="h-5 w-5" />
  }
};

export function ContactImportWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string>('');
  const [validationResult, setValidationResult] = useState<BatchValidationResult | null>(null);
  const [importBatchId, setImportBatchId] = useState<number | null>(null);

  const progress = (currentStep / 4) * 100;

  const markStepCompleted = useCallback((step: WizardStep) => {
    setCompletedSteps(prev => {
      if (!prev.includes(step)) {
        return [...prev, step];
      }
      return prev;
    });
  }, []);

  const handleNextStep = useCallback(() => {
    if (currentStep < 4) {
      markStepCompleted(currentStep);
      setCurrentStep((prev) => (prev + 1) as WizardStep);
    }
  }, [currentStep, markStepCompleted]);

  const handlePreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  }, [currentStep]);

  const handleFileUploaded = useCallback((file: File, data: string) => {
    setCsvFile(file);
    setCsvData(data);
  }, []);

  const handleValidationComplete = useCallback((result: BatchValidationResult) => {
    setValidationResult(result);
  }, []);

  const handleImportStarted = useCallback((batchId: number) => {
    setImportBatchId(batchId);
  }, []);

  const resetWizard = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps([]);
    setCsvFile(null);
    setCsvData('');
    setValidationResult(null);
    setImportBatchId(null);
  }, []);

  const getStepIcon = useCallback((step: WizardStep) => {
    if (completedSteps.includes(step)) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    if (step === currentStep) {
      return <Circle className="h-5 w-5 text-blue-600 fill-current" />;
    }
    return <Circle className="h-5 w-5 text-gray-400" />;
  }, [completedSteps, currentStep]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <DownloadTemplateStep
            onNext={handleNextStep}
            onCompleted={() => markStepCompleted(1)}
          />
        );
      case 2:
        return (
          <UploadFileStep
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
            onFileUploaded={handleFileUploaded}
            file={csvFile}
          />
        );
      case 3:
        return (
          <PreviewStep
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
            csvFile={csvFile}
            csvData={csvData}
            onValidationComplete={handleValidationComplete}
            validationResult={validationResult}
          />
        );
      case 4:
        return (
          <ImportStep
            onPrevious={handlePreviousStep}
            csvFile={csvFile}
            csvData={csvData}
            validationResult={validationResult}
            onImportStarted={handleImportStarted}
            importBatchId={importBatchId}
            onReset={resetWizard}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Paso {currentStep} de 4</span>
          <span>{Math.round(progress)}% completado</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Headers */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(Object.keys(STEPS) as unknown as WizardStep[]).map((step) => (
          <Card
            key={step}
            className={`transition-all ${
              step === currentStep
                ? 'ring-2 ring-blue-500 shadow-md'
                : completedSteps.includes(step)
                ? 'bg-green-50 border-green-200'
                : 'opacity-60'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {getStepIcon(step)}
                <CardTitle className="text-sm">{STEPS[step].title}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {STEPS[step].description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Step Content */}
      <div className="min-h-[400px]">
        {renderStepContent()}
      </div>

      {/* Global Status */}
      {validationResult && currentStep >= 3 && (
        <Alert className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Resumen de Validación:</div>
              <div className="text-sm space-y-1">
                <div>• Total de filas: {validationResult.totalRows}</div>
                <div className="text-green-600">• Filas válidas: {validationResult.validRows.length}</div>
                <div className="text-red-600">• Filas con errores: {validationResult.invalidRows.length}</div>
                {validationResult.duplicateEmails.length > 0 && (
                  <div className="text-orange-600">• Emails duplicados: {validationResult.duplicateEmails.length}</div>
                )}
                {validationResult.duplicatePhones.length > 0 && (
                  <div className="text-orange-600">• Teléfonos duplicados: {validationResult.duplicatePhones.length}</div>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}