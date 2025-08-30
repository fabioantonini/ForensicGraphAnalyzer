import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SignatureCropper } from "./signature-cropper";

interface CropCalibrationDialogProps {
  signatureId: number;
  originalFilename?: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function CropCalibrationDialog({ 
  signatureId, 
  originalFilename,
  onClose,
  onUpdate
}: CropCalibrationDialogProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Modifica Crop Manuale</DialogTitle>
        <DialogDescription>
          Seleziona l'area della firma da analizzare utilizzando gli strumenti di ritaglio.
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        <SignatureCropper
          signatureId={signatureId}
          imagePath={`/uploads/signatures/${signatureId}`}
          onCropComplete={(result) => {
            if (result.success) {
              // Chiudi il dialog quando il crop è completato con successo
              onClose();
            }
          }}
        />
      </div>
    </>
  );
}