import { useState } from 'react';
import { ContactImportWizard } from '@/components/ContactImportWizard';
import { ImportHistory } from '@/components/ImportHistory';
import { ContactList } from '@/components/ContactList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, History } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('import');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📊 CRM Contact Importer
          </h1>
          <p className="text-gray-600 text-lg">
            Importa masivamente contactos desde archivos CSV con validación completa
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar Contactos
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Contactos
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-600" />
                  Asistente de Importación
                </CardTitle>
                <CardDescription>
                  Sigue los pasos para importar contactos desde un archivo CSV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactImportWizard />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  Lista de Contactos
                </CardTitle>
                <CardDescription>
                  Todos los contactos importados en el sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-purple-600" />
                  Historial de Importaciones
                </CardTitle>
                <CardDescription>
                  Revisa el historial completo de importaciones y descarga logs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImportHistory />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;