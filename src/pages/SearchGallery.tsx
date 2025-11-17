import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

interface ImageData {
  project: string;
  date: string;
  phase: string;
  base64: string;
  name: string;
}

export default function SearchGallery() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [slideshowVisible, setSlideshowVisible] = useState(false);
  const [currentSlideshowImages, setCurrentSlideshowImages] = useState<ImageData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const savedImages = localStorage.getItem('savedImages');
    if (savedImages) {
      setImages(JSON.parse(savedImages));
    }
  }, []);

  const filterImages = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return images;
    return images.filter(img =>
      (img.project && img.project.toLowerCase().includes(q)) ||
      (img.date && img.date.toLowerCase().includes(q)) ||
      (img.phase && img.phase.toLowerCase().includes(q))
    );
  };

  const groupByProject = (imgs: ImageData[]) => {
    return imgs.reduce((acc, img) => {
      if (!acc[img.project]) acc[img.project] = [];
      acc[img.project].push(img);
      return acc;
    }, {} as Record<string, ImageData[]>);
  };

  const parseDateVal = (dateStr: string) => {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return 0;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = 2000 + parseInt(parts[2], 10);
    return new Date(year, month, day).getTime();
  };

  const phaseOrder = ['Planning', 'Foundation', 'Structure', 'Exterior', 'Interior', 'Completion'];
  const phaseIndex = (phase: string) => {
    const idx = phaseOrder.indexOf(phase);
    return idx === -1 ? 999 : idx;
  };

  const openSlideshow = (projectImages: ImageData[]) => {
    setCurrentSlideshowImages(projectImages);
    setCurrentSlideIndex(0);
    setSlideshowVisible(true);
  };

  const closeSlideshow = () => {
    setSlideshowVisible(false);
  };

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => 
      (prev + 1) % currentSlideshowImages.length
    );
  };

  const prevSlide = () => {
    setCurrentSlideIndex((prev) => 
      (prev - 1 + currentSlideshowImages.length) % currentSlideshowImages.length
    );
  };

  const filteredImages = filterImages(searchQuery);
  const grouped = groupByProject(filteredImages);
  const projects = Object.keys(grouped).sort();

  // Sort images within each project
  projects.forEach(project => {
    grouped[project].sort((a, b) => {
      const dateDiff = parseDateVal(a.date) - parseDateVal(b.date);
      if (dateDiff !== 0) return dateDiff;
      return phaseIndex(a.phase) - phaseIndex(b.phase);
    });
  });

  return (
    <div className="min-h-screen bg-background p-8 flex justify-center">
      <div className="max-w-4xl w-full bg-card p-6 rounded-xl shadow-lg">
        <div className="mb-6 text-center">
          <Button 
            onClick={() => navigate('/dashboard')} 
            variant="outline" 
            className="mb-4"
          >
            ← Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-card-foreground mb-6">Search Images</h1>
        </div>

        <Input
          type="text"
          placeholder="Type to search by project, date, or phase"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-base p-3 rounded-lg border mb-8 bg-background border-border text-white placeholder:text-muted-foreground"
        />

        <div className="space-y-8">
          {filteredImages.length === 0 ? (
            <p className="text-center text-xl text-muted-foreground">No images match your search.</p>
          ) : (
            projects.map(project => {
              const projectImages = grouped[project];
              return (
                <div
                  key={project}
                  className="bg-card rounded-xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => openSlideshow(projectImages)}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-card-foreground lowercase">
                      {project}
                    </h2>
                    <span className="text-muted-foreground">
                      {projectImages.length} image{projectImages.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex overflow-x-auto gap-4 pb-2">
                    {projectImages.map((img, idx) => (
                      <div key={idx} className="flex-shrink-0 w-40 rounded-xl overflow-hidden shadow-sm bg-background">
                        <img
                          src={img.base64}
                          alt={img.name}
                          className="w-full h-24 object-cover"
                        />
                        <div className="bg-black/70 text-white text-xs p-2 flex justify-between items-center">
                          <span className="flex-grow truncate">{img.date}</span>
                          <span className="bg-success text-white px-2 py-1 rounded text-xs font-semibold ml-2">
                            {img.phase}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Slideshow Modal */}
      {slideshowVisible && currentSlideshowImages.length > 0 && (
        <div className="fixed inset-0 bg-black/85 flex justify-center items-center z-50">
          <div className="relative max-w-4xl max-h-[80vh]">
            <button
              onClick={closeSlideshow}
              className="absolute -top-10 right-0 text-white text-3xl font-bold cursor-pointer hover:text-gray-300"
            >
              ×
            </button>

            <img
              src={currentSlideshowImages[currentSlideIndex].base64}
              alt={currentSlideshowImages[currentSlideIndex].name}
              className="w-full h-auto max-h-[80vh] rounded-xl"
            />

            <div className="text-white text-center mt-2 font-semibold">
              {currentSlideshowImages[currentSlideIndex].project} | {' '}
              {currentSlideshowImages[currentSlideIndex].date} | {' '}
              {currentSlideshowImages[currentSlideIndex].phase}
            </div>

            <div className="absolute top-1/2 transform -translate-y-1/2 w-full flex justify-between px-4">
              <button
                onClick={prevSlide}
                className="bg-success/80 hover:bg-success text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold transition-colors"
              >
                ‹
              </button>
              <button
                onClick={nextSlide}
                className="bg-success/80 hover:bg-success text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold transition-colors"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}