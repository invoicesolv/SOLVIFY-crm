"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Upload, Image as ImageIcon, Trash2, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Logo {
  id: string;
  name: string;
  url: string;
  width?: number;
  height?: number;
  border_radius?: number;
  created_at: string;
}

interface LogoManagerProps {
  onLogoSelect: (logoUrl: string) => void;
  selectedLogo?: string;
}

export function LogoManager({ onLogoSelect, selectedLogo }: LogoManagerProps) {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [borderRadius, setBorderRadius] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isApplyingToAll, setIsApplyingToAll] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('url');

  // Load logos from database
  const loadLogos = async () => {
    try {
      const response = await fetch('/api/workspace/logos');
      if (response.ok) {
        const data = await response.json();
        setLogos(data.logos || []);
      } else {
        console.error('Failed to load logos');
      }
    } catch (error) {
      console.error('Error loading logos:', error);
    }
  };

  useEffect(() => {
    loadLogos();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an image file - support all common formats
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 
      'image/webp', 'image/bmp', 'image/tiff', 'image/ico', 'image/x-icon'
    ];
    
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPG, PNG, GIF, SVG, WebP, BMP, TIFF, ICO)');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setLoading(true);
    try {
      // Convert to data URL for storage
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        
        // Create image to get dimensions
        const img = new Image();
        img.onload = async () => {
          try {
            const logoName = uploadName.trim() || file.name.replace(/\.[^/.]+$/, "");
            
            // Save to database
            const response = await fetch('/api/workspace/logos', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: logoName,
                url: dataUrl,
                width: img.width,
                height: img.height,
                border_radius: borderRadius
              }),
            });

            if (response.ok) {
              const data = await response.json();
                          setLogos(prev => [data.logo, ...prev]);
            setUploadUrl('');
            setUploadName('');
            setBorderRadius(0);
            setIsDialogOpen(false);
            toast.success('Logo uploaded successfully');
            } else {
              toast.error('Failed to save logo');
            }
          } catch (error) {
            console.error('Error saving logo:', error);
            toast.error('Failed to save logo');
          } finally {
            setLoading(false);
          }
        };
        
        img.onerror = () => {
          toast.error('Invalid image file');
          setLoading(false);
        };
        
        img.src = dataUrl;
      };
      
      reader.onerror = () => {
        toast.error('Failed to read file');
        setLoading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
      setLoading(false);
    }
  };

  const handleAddLogo = async () => {
    if (uploadMethod === 'url') {
      if (!uploadUrl.trim()) {
        toast.error('Please enter a logo URL');
        return;
      }

      if (!uploadName.trim()) {
        toast.error('Please enter a logo name');
        return;
      }

      setLoading(true);
      try {
        // Test if the URL is a valid image
        const img = new Image();
        img.onload = async () => {
          try {
            // Save to database
            const response = await fetch('/api/workspace/logos', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: uploadName,
                url: uploadUrl,
                width: img.width,
                height: img.height,
                border_radius: borderRadius
              }),
            });

            if (response.ok) {
              const data = await response.json();
                          setLogos(prev => [data.logo, ...prev]);
            setUploadUrl('');
            setUploadName('');
            setBorderRadius(0);
            setIsDialogOpen(false);
            toast.success('Logo added successfully');
            } else {
              toast.error('Failed to save logo');
            }
          } catch (error) {
            console.error('Error saving logo:', error);
            toast.error('Failed to save logo');
          } finally {
            setLoading(false);
          }
        };
        
        img.onerror = () => {
          toast.error('Invalid image URL');
          setLoading(false);
        };
        
        img.src = uploadUrl;
      } catch (error) {
        console.error('Error adding logo:', error);
        toast.error('Failed to add logo');
        setLoading(false);
      }
    }
  };

  const handleDeleteLogo = async (logoId: string) => {
    try {
      const response = await fetch(`/api/workspace/logos?id=${logoId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLogos(prev => prev.filter(logo => logo.id !== logoId));
        toast.success('Logo deleted');
      } else {
        toast.error('Failed to delete logo');
      }
    } catch (error) {
      console.error('Error deleting logo:', error);
      toast.error('Failed to delete logo');
    }
  };

  const handleApplyToAllTemplates = async () => {
    if (!selectedLogo) {
      toast.error('Please select a logo first');
      return;
    }

    setIsApplyingToAll(true);
    try {
      // First save the selected logo to workspace
      const saveResponse = await fetch('/api/workspace/logo', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logoUrl: selectedLogo }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save workspace logo');
      }

      // Then apply to all templates
      const applyResponse = await fetch('/api/workspace/apply-logo-to-all-templates', {
        method: 'POST',
      });

      if (!applyResponse.ok) {
        throw new Error('Failed to apply logo to templates');
      }

      const result = await applyResponse.json();
      toast.success(`Logo applied to ${result.updatedCount} templates!`);
    } catch (error) {
      console.error('Error applying logo to templates:', error);
      toast.error('Failed to apply logo to templates');
    } finally {
      setIsApplyingToAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Company Logos</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Logo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Company Logo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="logo-name">Logo Name</Label>
                <Input
                  id="logo-name"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g., Company Logo"
                />
              </div>
              
              {/* Upload Method Selection */}
              <div className="space-y-2">
                <Label>Upload Method</Label>
                <div className="flex gap-2">
                  <Button
                    variant={uploadMethod === 'url' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUploadMethod('url')}
                    className="flex-1"
                    type="button"
                  >
                    🔗 URL
                  </Button>
                  <Button
                    variant={uploadMethod === 'file' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUploadMethod('file')}
                    className="flex-1"
                    type="button"
                  >
                    📁 File Upload
                  </Button>
                </div>
              </div>

              {uploadMethod === 'url' ? (
                <div>
                  <Label htmlFor="logo-url">Logo URL</Label>
                  <Input
                    id="logo-url"
                    value={uploadUrl}
                    onChange={(e) => setUploadUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter a direct URL to your logo image (PNG, JPG, SVG)
                  </p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="logo-file">Select Logo File</Label>
                  <Input
                    id="logo-file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports: JPG, PNG, GIF, SVG, WebP, BMP, TIFF, ICO (max 10MB)
                  </p>
                </div>
              )}

              {/* Border Radius Setting */}
              <div>
                <Label htmlFor="border-radius">Border Radius (px)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="border-radius"
                    type="range"
                    min="0"
                    max="50"
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12 text-center">{borderRadius}px</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  0 = sharp corners, 50 = very rounded corners
                </p>
              </div>

              {/* Live Preview */}
              {(uploadUrl || uploadMethod === 'file') && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="p-4 bg-muted/30 rounded-lg border-2 border-dashed">
                    {uploadUrl && (
                      <img
                        src={uploadUrl}
                        alt="Logo preview"
                        className="w-24 h-16 object-contain mx-auto"
                        style={{ 
                          borderRadius: `${borderRadius}px`,
                          border: '1px solid #e5e7eb'
                        }}
                      />
                    )}
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Preview with {borderRadius}px border radius
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </Button>
                {uploadMethod === 'url' && (
                  <Button 
                    onClick={handleAddLogo}
                    disabled={loading}
                    type="button"
                  >
                    {loading ? 'Adding...' : 'Add Logo'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto">
        {logos.map((logo) => (
          <Card 
            key={logo.id} 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedLogo === logo.url ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onLogoSelect(logo.url)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <img
                    src={logo.url}
                    alt={logo.name}
                    className="w-12 h-8 object-contain bg-gray-50 border"
                    style={{ 
                      borderRadius: `${logo.border_radius || 0}px`
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{logo.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {logo.width && logo.height ? `${logo.width}×${logo.height}` : 'Unknown size'}
                    {logo.border_radius ? ` • ${logo.border_radius}px radius` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedLogo === logo.url && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await handleDeleteLogo(logo.id);
                    }}
                    className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {logos.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No logos added yet</p>
          <p className="text-sm">Add your company logos to use in emails</p>
        </div>
      )}

      {selectedLogo && (
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <img 
              src={selectedLogo} 
              alt="Selected logo"
              className="w-12 h-8 object-contain bg-background border"
              style={{ 
                borderRadius: `${logos.find(l => l.url === selectedLogo)?.border_radius || 0}px`
              }}
            />
            <div>
              <p className="font-medium text-sm">Selected Logo</p>
              <p className="text-xs text-muted-foreground">Ready to use in templates</p>
            </div>
          </div>
          <Button
            onClick={handleApplyToAllTemplates}
            disabled={isApplyingToAll}
            className="w-full"
            size="sm"
          >
            {isApplyingToAll ? 'Applying...' : 'Apply to All Templates'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            This will replace logo placeholders in all existing templates
          </p>
        </div>
      )}
    </div>
  );
} 