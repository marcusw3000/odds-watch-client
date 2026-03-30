import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Move, Upload, X, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImageEditorProps {
  value?: string;
  onChange: (imageData: { url: string; zoom: number; position: { x: number; y: number } }) => void;
  error?: string;
  initialZoom?: number;
  initialPosition?: { x: number; y: number };
}

interface ImageData {
  url: string;
  zoom: number;
  position: { x: number; y: number };
}

export function ImageEditor({ value, onChange, error, initialZoom = 1, initialPosition }: ImageEditorProps) {
  const [imageData, setImageData] = useState<ImageData>({
    url: value || '',
    zoom: initialZoom,
    position: initialPosition || { x: 50, y: 50 },
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) return;

    setImageData((prev) => {
      if (prev.url === value) {
        return prev;
      }

      return {
        ...prev,
        url: value,
        zoom: initialZoom,
        position: initialPosition || { x: 50, y: 50 }
      };
    });
  }, [value, initialZoom, initialPosition]);

  const uploadToSupabase = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `markets/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('market-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        toast.error('Erro ao fazer upload da imagem');
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('market-images')
        .getPublicUrl(data.path);

      toast.success('Imagem enviada com sucesso');
      return publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    const publicUrl = await uploadToSupabase(file);
    
    if (publicUrl) {
      const newData = {
        url: publicUrl,
        zoom: 1,
        position: { x: 50, y: 50 },
      };
      setImageData(newData);
      onChange(newData);
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
    if (!imageData.url || isUploading) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [imageData.url, isUploading]);

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

  const handleRemove = useCallback(async () => {
    // Note: We don't delete from storage here to avoid complexity
    // Old images can be cleaned up periodically
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
          "relative w-full aspect-video rounded-xl border-2 border-dashed overflow-hidden transition-colors",
          error ? "border-destructive" : "border-border hover:border-primary/50",
          !imageData.url && !isUploading && "cursor-pointer",
          imageData.url && !isUploading && "cursor-move"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => !imageData.url && !isUploading && fileInputRef.current?.click()}
      >
        {isUploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Enviando imagem...</span>
          </div>
        ) : imageData.url ? (
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
            <span className="text-xs text-muted-foreground">Máximo 5MB</span>
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
        disabled={isUploading}
      />

      {/* Controls */}
      {imageData.url && !isUploading && (
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
            <span className="text-xs text-muted-foreground w-12 text-right">
              {Math.round(imageData.zoom * 100)}%
            </span>
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
        className="w-full aspect-[16/10] bg-cover bg-no-repeat overflow-hidden"
        style={{
          backgroundImage: `url(${imageData.url})`,
          backgroundPosition: `${imageData.position.x}% ${imageData.position.y}%`,
          backgroundSize: `${imageData.zoom * 100}%`,
        }}
      />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-md bg-secondary text-xs font-medium">Economia</span>
        </div>
        <h3 className="text-sm font-semibold line-clamp-2">
          Exemplo de título do mercado preditivo
        </h3>
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Sim</span>
            <span className="font-bold text-yes">65%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Não</span>
            <span className="font-bold text-no">35%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
