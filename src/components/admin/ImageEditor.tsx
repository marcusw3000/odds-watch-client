import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Move, Upload, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ImageEditorProps {
  value?: string;
  onChange: (imageData: { url: string; zoom: number; position: { x: number; y: number } }) => void;
  error?: string;
}

interface ImageData {
  url: string;
  zoom: number;
  position: { x: number; y: number };
}

export function ImageEditor({ value, onChange, error }: ImageEditorProps) {
  const [imageData, setImageData] = useState<ImageData>({
    url: value || '',
    zoom: 1,
    position: { x: 50, y: 50 },
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [previewOpen, setPreviewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && value !== imageData.url) {
      setImageData(prev => ({ ...prev, url: value }));
    }
  }, [value]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newData = {
          url: event.target?.result as string,
          zoom: 1,
          position: { x: 50, y: 50 },
        };
        setImageData(newData);
        onChange(newData);
      };
      reader.readAsDataURL(file);
    }
  }, [onChange]);

  const handleZoomChange = useCallback((value: number[]) => {
    const newData = { ...imageData, zoom: value[0] };
    setImageData(newData);
    onChange(newData);
  }, [imageData, onChange]);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(imageData.zoom + 0.1, 3);
    const newData = { ...imageData, zoom: newZoom };
    setImageData(newData);
    onChange(newData);
  }, [imageData, onChange]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(imageData.zoom - 0.1, 0.5);
    const newData = { ...imageData, zoom: newZoom };
    setImageData(newData);
    onChange(newData);
  }, [imageData, onChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!imageData.url) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [imageData.url]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;
    
    const newX = Math.max(0, Math.min(100, imageData.position.x - deltaX));
    const newY = Math.max(0, Math.min(100, imageData.position.y - deltaY));
    
    const newData = {
      ...imageData,
      position: { x: newX, y: newY },
    };
    setImageData(newData);
    onChange(newData);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, imageData, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleRemove = useCallback(() => {
    const newData = { url: '', zoom: 1, position: { x: 50, y: 50 } };
    setImageData(newData);
    onChange(newData);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onChange]);

  return (
    <div className="space-y-4">
      <Label>Imagem do Card *</Label>
      
      {/* Image Upload/Preview Area */}
      <div
        ref={containerRef}
        className={cn(
          "relative w-full aspect-video rounded-xl border-2 border-dashed overflow-hidden cursor-move transition-colors",
          error ? "border-destructive" : "border-border hover:border-primary/50",
          !imageData.url && "cursor-pointer"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => !imageData.url && fileInputRef.current?.click()}
      >
        {imageData.url ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-no-repeat transition-transform"
              style={{
                backgroundImage: `url(${imageData.url})`,
                backgroundPosition: `${imageData.position.x}% ${imageData.position.y}%`,
                transform: `scale(${imageData.zoom})`,
              }}
            />
            {/* Overlay with drag hint */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <div className="bg-background/90 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                <Move className="h-4 w-4" />
                Arraste para ajustar
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Upload className="h-8 w-8" />
            <span className="text-sm">Clique para selecionar uma imagem</span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Controls */}
      {imageData.url && (
        <div className="flex items-center gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2 flex-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Slider
              value={[imageData.zoom]}
              onValueChange={handleZoomChange}
              min={0.5}
              max={3}
              step={0.1}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Preview do Card</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  <CardPreview imageData={imageData} />
                </div>
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Trocar
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Card Preview Component
function CardPreview({ imageData }: { imageData: ImageData }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Image */}
      <div 
        className="w-full aspect-[4/3] bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url(${imageData.url})`,
          backgroundPosition: `${imageData.position.x}% ${imageData.position.y}%`,
          transform: `scale(${imageData.zoom})`,
          transformOrigin: 'center',
        }}
      />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Economia</span>
        </div>
        <h3 className="text-sm font-semibold line-clamp-2">
          Exemplo de título do mercado preditivo
        </h3>
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Sim</span>
            <span className="font-bold text-green-500">65%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Não</span>
            <span className="font-bold text-red-500">35%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
