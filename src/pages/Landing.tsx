import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-5 text-center">
      <header className="mb-10">
        <h1 className="text-5xl font-bold tracking-wide mb-4">Wright Here Wright Now</h1>
        <p className="text-xl">Welcome to WI Project Management</p>
      </header>

      <nav className="flex justify-center flex-wrap gap-4 w-full max-w-2xl">
        <Button 
          onClick={() => navigate('/auth')} 
          variant="outline" 
          className="text-lg px-6 py-3 border-2 border-accent text-accent hover:bg-accent hover:text-background"
        >
          Login
        </Button>
        <Button 
          onClick={() => navigate('/dashboard')} 
          variant="outline"
          className="text-lg px-6 py-3 border-2 border-accent text-accent hover:bg-accent hover:text-background"
        >
          Projects
        </Button>
        <Button 
          onClick={() => navigate('/gallery')} 
          variant="outline"
          className="text-lg px-6 py-3 border-2 border-accent text-accent hover:bg-accent hover:text-background"
        >
          Project Gallery Uploads
        </Button>
        <Button 
          onClick={() => navigate('/search')} 
          variant="outline"
          className="text-lg px-6 py-3 border-2 border-accent text-accent hover:bg-accent hover:text-background"
        >
          Gallery
        </Button>
      </nav>

      <footer className="mt-auto pt-4 text-sm text-muted-foreground">
        &copy; 2025 Wright Right Wright Now. All rights reserved.
      </footer>
    </div>
  );
}