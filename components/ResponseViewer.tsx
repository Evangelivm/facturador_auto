'use client';

import React from 'react';
import { NubeFactResponse } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CircleCheckIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from 'lucide-react';

interface ResponseViewerProps {
  response: NubeFactResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, loading, error, onClose }) => {
  const open = !!response || loading || !!error;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Resultado de la Operación</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Enviando a NubeFact...</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <OctagonXIcon />
            <AlertTitle>Error en la solicitud</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {response && !loading && (
          <div className="flex flex-col gap-4">
            {response.aceptada_por_sunat ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 [&_svg]:text-emerald-600">
                <CircleCheckIcon />
                <AlertTitle>¡Comprobante Aceptado!</AlertTitle>
                <AlertDescription className="text-emerald-700">{response.sunat_description}</AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 [&_svg]:text-amber-600">
                <TriangleAlertIcon />
                <AlertTitle>Respuesta del Sistema</AlertTitle>
                <AlertDescription className="text-amber-700">{response.sunat_description || response.errors}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {response.enlace_del_pdf && (
                <Button variant="default" render={<a href={response.enlace_del_pdf} target="_blank" rel="noreferrer" />}>
                  Ver PDF
                </Button>
              )}
              {response.enlace_del_xml && (
                <Button variant="secondary" render={<a href={response.enlace_del_xml} target="_blank" rel="noreferrer" />}>
                  Descargar XML
                </Button>
              )}
              {response.enlace_del_cdr && (
                <Button variant="outline" render={<a href={response.enlace_del_cdr} target="_blank" rel="noreferrer" />}>
                  Descargar CDR
                </Button>
              )}
            </div>

            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium text-foreground">Detalles Técnicos</p>
              <div className="max-h-40 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
                <pre>{JSON.stringify(response, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
