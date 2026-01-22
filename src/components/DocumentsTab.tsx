import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  FileText, 
  FileSpreadsheet, 
  File, 
  FileImage,
  Download,
  Trash2,
  Edit,
  Plus,
  Search,
  Upload,
  Eye
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  file_path: string;
  url: string;
  file_size: number | null;
  mime_type: string | null;
  file_extension: string | null;
  description: string | null;
  uploaded_by: string;
  project_id: string | null;
  created_at: string;
  projects?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

interface Project {
  id: string;
  name: string;
}

interface DocumentsTabProps {
  userId: string;
  userRole: string;
}

const DocumentsTab = ({ userId, userRole }: DocumentsTabProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    description: '',
    project_id: ''
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchProjects();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select(`
          *,
          projects (name)
        `)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

      const docsWithProfiles = (docsData || []).map(doc => ({
        ...doc,
        profiles: { full_name: profilesMap.get(doc.uploaded_by) || 'Unknown' }
      }));

      setDocuments(docsWithProfiles as Document[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Error loading documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name').order('name');
    setProjects(data || []);
  };

  const getFileIcon = (extension: string | null, mimeType: string | null) => {
    const ext = extension?.toLowerCase();
    const mime = mimeType?.toLowerCase() || '';

    if (ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheet')) {
      return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />;
    }
    if (ext === 'docx' || ext === 'doc' || mime.includes('document')) {
      return <FileText className="h-8 w-8 text-primary" />;
    }
    if (ext === 'pdf' || mime.includes('pdf')) {
      return <FileText className="h-8 w-8 text-destructive" />;
    }
    if (ext === 'dwg' || ext === 'dxf' || ext === 'cad' || ext === 'dwf') {
      return <File className="h-8 w-8 text-amber-500" />;
    }
    if (mime.includes('image')) {
      return <FileImage className="h-8 w-8 text-violet-500" />;
    }
    if (mime.includes('video') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '')) {
      return <File className="h-8 w-8 text-pink-500" />;
    }
    if (mime.includes('audio') || ['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext || '')) {
      return <File className="h-8 w-8 text-violet-500" />;
    }
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const viewDocument = (doc: Document) => {
    setPreviewDoc(doc);
    setPreviewUrl(doc.url);
    setPreviewError(false);
    setIsPreviewOpen(true);
  };

  const handlePreviewError = () => {
    setPreviewError(true);
  };

  const resetPreviewState = () => {
    setPreviewError(false);
  };

  const openInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const downloadFile = () => {
    if (previewUrl && previewDoc) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = previewDoc.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getPreviewContent = () => {
    if (!previewDoc || !previewUrl) return null;
    
    const ext = previewDoc.file_extension?.toLowerCase();
    const mime = previewDoc.mime_type?.toLowerCase() || '';

    // Fallback UI for files that can't be previewed inline
    const renderFallback = (title: string, description: string, icon: React.ReactNode) => (
      <div className="text-center py-12">
        {icon}
        <p className="text-lg font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground mb-6">{description}</p>
        <Button onClick={openInNewTab}>
          <Eye className="h-4 w-4 mr-2" />
          Open File
        </Button>
      </div>
    );

    // If preview errored, show fallback
    if (previewError) {
      return renderFallback(
        'Preview Unavailable',
        'The document could not be previewed. Click to open directly.',
        <File className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
      );
    }
    
    // Images - display directly
    if (mime.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif'].includes(ext || '')) {
      return (
        <img 
          src={previewUrl} 
          alt={previewDoc.name}
          className="max-w-full max-h-[65vh] mx-auto rounded-lg shadow-lg object-contain" 
          onError={handlePreviewError}
        />
      );
    }
    
    // PDFs - display directly
    if (ext === 'pdf' || mime.includes('pdf')) {
      return (
        <object 
          data={previewUrl}
          type="application/pdf"
          className="w-full h-[65vh] rounded-lg"
        >
          <iframe 
            src={previewUrl}
            className="w-full h-[65vh] border-0 rounded-lg" 
            title="PDF Preview"
            onError={handlePreviewError}
          />
        </object>
      );
    }
    
    // Office documents - display directly via iframe
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) {
      return (
        <iframe 
          src={previewUrl}
          className="w-full h-[65vh] border-0 rounded-lg" 
          title="Document Preview"
          onError={handlePreviewError}
        />
      );
    }

    // Text files - display directly
    if (['txt', 'md', 'json', 'xml', 'csv', 'log', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'].includes(ext || '') || 
        mime.includes('text/')) {
      return (
        <iframe 
          src={previewUrl}
          className="w-full h-[65vh] border rounded-lg bg-background" 
          title="Text Preview"
        />
      );
    }
    
    // AutoCAD/CADD files - cannot preview inline
    if (['dwg', 'dxf', 'dwf', 'dgn', 'rvt', 'rfa', 'ifc', 'stp', 'step', 'igs', 'iges', 'sat', '3dm', 'skp', 'pln', 'bim'].includes(ext || '')) {
      return renderFallback(
        'CAD/BIM File',
        `This ${ext?.toUpperCase()} file requires specialized CAD software (AutoCAD, Revit, SketchUp, etc.) to view.`,
        <File className="h-16 w-16 mx-auto text-amber-500 mb-4" />
      );
    }

    // Video files - display directly
    if (mime.includes('video') || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext || '')) {
      return (
        <video 
          src={previewUrl}
          controls
          className="max-w-full max-h-[65vh] mx-auto rounded-lg shadow-lg"
          onError={handlePreviewError}
        >
          Your browser does not support video playback.
        </video>
      );
    }

    // Audio files - display directly
    if (mime.includes('audio') || ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext || '')) {
      return (
        <div className="flex flex-col items-center py-8">
          <File className="h-16 w-16 text-violet-500 mb-4" />
          <p className="text-lg font-medium text-foreground mb-4">{previewDoc.name}</p>
          <audio 
            src={previewUrl}
            controls
            className="w-full max-w-md"
            onError={handlePreviewError}
          >
            Your browser does not support audio playback.
          </audio>
        </div>
      );
    }

    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
      return renderFallback(
        'Archive File',
        'Archive files cannot be previewed. Click to open directly.',
        <File className="h-16 w-16 mx-auto text-amber-500 mb-4" />
      );
    }
    
    // Default fallback for unknown types
    return renderFallback(
      'Preview Not Available',
      `This file type (${ext || 'unknown'}) cannot be previewed inline.`,
      <File className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
    );
  };

  const canUpload = () => true;
  const canManageDocument = () => true;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !editingDocument) {
      toast.error('Please select a file');
      return;
    }

    try {
      setUploading(true);

      if (editingDocument) {
        const { error } = await supabase
          .from('documents')
          .update({
            description: form.description || null,
            project_id: form.project_id || null
          })
          .eq('id', editingDocument.id);

        if (error) throw error;
        toast.success('Document updated successfully');
      } else if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `documents/${userId}/${Date.now()}_${selectedFile.name}`;

        const { error: uploadError } = await supabase.storage
          .from('WI storage')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('WI storage')
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase
          .from('documents')
          .insert({
            name: selectedFile.name,
            file_path: filePath,
            url: urlData.publicUrl,
            file_size: selectedFile.size,
            mime_type: selectedFile.type,
            file_extension: fileExt,
            description: form.description || null,
            uploaded_by: userId,
            project_id: form.project_id || null
          });

        if (insertError) throw insertError;
        toast.success('Document uploaded successfully');
      }

      resetForm();
      fetchDocuments();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error saving document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await supabase.storage.from('WI storage').remove([doc.file_path]);

      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;

      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error deleting document');
    }
  };

  const startEdit = (doc: Document) => {
    setEditingDocument(doc);
    setForm({
      description: doc.description || '',
      project_id: doc.project_id || ''
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setForm({ description: '', project_id: '' });
    setSelectedFile(null);
    setEditingDocument(null);
    setIsDialogOpen(false);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = !projectFilter || projectFilter === 'all' || doc.project_id === projectFilter;
    return matchesSearch && matchesProject;
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground">Document Repository</CardTitle>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background text-foreground"
            />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by project" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading documents...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No documents found. Upload your first document!
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
              >
                {getFileIcon(doc.file_extension, doc.mime_type)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{doc.name}</div>
                  {doc.description && (
                    <div className="text-sm text-muted-foreground truncate">{doc.description}</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>•</span>
                    <span>{format(new Date(doc.created_at), 'MMM d, yyyy h:mm a')}</span>
                    <span>•</span>
                    <span>by {doc.profiles?.full_name}</span>
                    {doc.projects?.name && (
                      <>
                        <span>•</span>
                        <span className="text-primary">Project: {doc.projects.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => viewDocument(doc)}
                    title="View Document"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = doc.url;
                      link.download = doc.name;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => startEdit(doc)}
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(doc)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsDialogOpen(true)}
                    title="Upload New"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-card border-border">
            <DialogHeader className="p-6 border-b border-border">
              <DialogTitle className="text-foreground flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {previewDoc?.name || 'Document Preview'}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                className="w-fit mt-2"
                onClick={openInNewTab}
              >
                <Eye className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            </DialogHeader>
            <div className="p-6 max-h-[70vh] overflow-auto">
              {getPreviewContent()}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingDocument ? 'Edit Document' : 'Upload Document'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              {!editingDocument && (
                <div>
                  <label className="text-sm font-medium text-foreground">File</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="bg-background text-foreground"
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  placeholder="Brief description of this document..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 bg-background text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Project (Optional)</label>
                <Select 
                  value={form.project_id || "none"} 
                  onValueChange={(value) => setForm({ ...form, project_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      {editingDocument ? 'Saving...' : 'Uploading...'}
                    </>
                  ) : (
                    editingDocument ? 'Save Changes' : 'Upload'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default DocumentsTab;
