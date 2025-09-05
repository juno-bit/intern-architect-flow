import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, Download, Share2, ZoomIn, ZoomOut } from "lucide-react";

interface SlideshowImage {
  id: string;
  name: string;
  url: string;
  description?: string;
  phase?: string;
  image_category: string;
  capture_date: string;
  profiles?: { full_name: string };
  projects?: { name: string };
  tasks?: { title: string };
}

interface ImageSlideshowProps {
  images: SlideshowImage[];
  initialIndex: number;
  onClose: () => void;
}

export const ImageSlideshow = ({ images, initialIndex, onClose }: ImageSlideshowProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const currentImage = images[currentIndex];

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setZoom(1);
    setIsLoading(true);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setZoom(1);
    setIsLoading(true);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") goToPrevious();
    if (event.key === "ArrowRight") goToNext();
    if (event.key === "Escape") onClose();
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = currentImage.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentImage.name,
          text: currentImage.description || "Project image",
          url: currentImage.url,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback: copy URL to clipboard
      navigator.clipboard.writeText(currentImage.url);
      // You could show a toast here
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-screen p-0 bg-black/95">
        <div className="relative w-full h-screen flex items-center justify-center">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 z-10 text-white hover:bg-white/20"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 z-10 text-white hover:bg-white/20"
                onClick={goToNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Image */}
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                Loading...
              </div>
            )}
            <img
              src={currentImage.url}
              alt={currentImage.name}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-20 right-4 flex flex-col gap-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setZoom(Math.min(zoom + 0.25, 3))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setZoom(Math.max(zoom - 0.25, 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Image info overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
            <div className="flex justify-between items-end">
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">{currentImage.name}</h3>
                {currentImage.description && (
                  <p className="text-sm text-gray-300 mb-3">{currentImage.description}</p>
                )}
                <div className="flex gap-2 mb-2">
                  {currentImage.phase && (
                    <Badge variant="outline" className="text-white border-white/50">
                      {currentImage.phase}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="bg-white/20 text-white">
                    {currentImage.image_category}
                  </Badge>
                  {currentImage.projects?.name && (
                    <Badge variant="outline" className="text-white border-white/50">
                      {currentImage.projects.name}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  <span>
                    {new Date(currentImage.capture_date).toLocaleDateString()}
                  </span>
                  {currentImage.profiles?.full_name && (
                    <span> • Uploaded by {currentImage.profiles.full_name}</span>
                  )}
                  {currentImage.tasks?.title && (
                    <span> • Task: {currentImage.tasks.title}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};