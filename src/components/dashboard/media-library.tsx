// src/components/dashboard/media-library.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchUserMedia, deleteMedia } from '@/lib/actions/media.actions';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ImageIcon, VideoIcon, Loader2, Calendar, Download, Copy, Check, AlertCircle, Trash2, Library, Film } from 'lucide-react'; // Added Library, Film
import Image from 'next/image';
import { toast } from 'sonner';
import { GeneratedMedia } from '@/types/db_types';
import { MediaType } from '@/lib/constants/media';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from 'framer-motion'; // Import motion

interface MediaLibraryProps {
  initialMedia?: GeneratedMedia[];
}

export function MediaLibrary({ initialMedia = [] }: MediaLibraryProps) {
  const [media, setMedia] = useState<GeneratedMedia[]>(initialMedia);
  const [loading, setLoading] = useState(initialMedia.length === 0);
  const [activeTab, setActiveTab] = useState<'all' | MediaType>('all');
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, [supabase]);

  useEffect(() => {
    async function loadInitialMedia() {
      if (initialMedia.length > 0 || !userId) {
        if (initialMedia.length > 0 && loading) setLoading(false);
        return;
      }

      console.log("MediaLibrary: No initial media, fetching...");
      setLoading(true);
      try {
        const result = await fetchUserMedia();
        if (result.success) {
          setMedia(result.media ?? []);
        } else {
          toast.error(result.error || 'Failed to load media');
          setMedia([]);
        }
      } catch (error) {
        console.error('Error loading initial media:', error);
        toast.error('Failed to load media library');
        setMedia([]);
      } finally {
        setLoading(false);
      }
    }
    loadInitialMedia();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      console.log("MediaLibrary: No user ID, skipping Realtime subscription.");
      return;
    }

    console.log(`MediaLibrary: Setting up Realtime for user ${userId}`);
    const channel = supabase
      .channel(`media-updates-for-${userId}`)
      .on<GeneratedMedia>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generated_media',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('MediaLibrary: Realtime payload received:', payload);
          const newMedia = payload.new as GeneratedMedia;
          const oldMedia = payload.old as GeneratedMedia & { id: string };
          const eventType = payload.eventType;

          setMedia((currentMedia) => {
            let updatedMedia = [...currentMedia];

            if (eventType === 'INSERT') {
              if (!updatedMedia.some(item => item.id === newMedia.id)) {
                updatedMedia = [newMedia, ...updatedMedia];
                console.log(`MediaLibrary: Inserted new media ${newMedia.id}`);
              }
            } else if (eventType === 'UPDATE') {
              const index = updatedMedia.findIndex(item => item.id === newMedia.id);
              if (index !== -1) {
                updatedMedia[index] = newMedia;
                console.log(`MediaLibrary: Updated media ${newMedia.id}`);
              } else {
                 updatedMedia = [newMedia, ...updatedMedia];
                 console.log(`MediaLibrary: Received update for unknown media ${newMedia.id}, inserting.`);
              }
            } else if (eventType === 'DELETE') {
              if (oldMedia?.id) {
                 updatedMedia = updatedMedia.filter(item => item.id !== oldMedia.id);
                 console.log(`MediaLibrary: Deleted media ${oldMedia.id}`);
              } else {
                 console.warn("MediaLibrary: Received DELETE event without old record ID.");
              }
            }
            return updatedMedia.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`MediaLibrary: Realtime channel SUBSCRIBED for user ${userId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('MediaLibrary: Realtime channel error:', err);
          toast.error('Realtime connection error. Library might not update.');
        }
        if (status === 'TIMED_OUT') {
          console.warn('MediaLibrary: Realtime connection timed out.');
        }
      });

    return () => {
      console.log(`MediaLibrary: Unsubscribing from Realtime channel for user ${userId}`);
      if (channel) {
        supabase.removeChannel(channel).catch(err => console.error("Error removing channel:", err));
      }
    };
  }, [supabase, userId]);

  const handleItemDeleted = useCallback((deletedMediaId: string) => {
    setMedia((prevMedia) => prevMedia.filter(item => item.id !== deletedMediaId));
    toast.info("Media removed.");
  }, []);

  const filteredMedia = activeTab === 'all'
    ? media
    : media.filter(item => item.media_type === activeTab);

  return (
    <div className="mt-10 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Library className="w-6 h-6 text-primary/80" />
          Media Library
        </h2>
        <Tabs
          defaultValue="all"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'all' | MediaType)}
          className="w-full sm:w-auto"
        >
          {/* Restyled TabsList */}
          <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10 p-1 rounded-lg backdrop-blur-sm">
             <TabsTrigger value="all" className="data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md rounded-md transition-all">All</TabsTrigger>
             <TabsTrigger value="image" className="data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md rounded-md transition-all">Images</TabsTrigger>
             <TabsTrigger value="video" className="data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md rounded-md transition-all">Videos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <AnimatePresence>
          {filteredMedia.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="glass-card border-dashed border-white/20">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 mb-4 rounded-full bg-primary/10 border border-primary/20 shadow-sm">
                    {activeTab === 'image' ? (
                      <ImageIcon className="h-10 w-10 text-primary/80" />
                    ) : activeTab === 'video' ? (
                      <Film className="h-10 w-10 text-primary/80" />
                    ) : (
                       <Library className="h-10 w-10 text-primary/80" />
                    )}
                  </div>
                  <h3 className="text-xl font-medium mb-2 text-foreground">No media yet</h3>
                  <p className="text-muted-foreground max-w-md">
                    Generate some {activeTab === 'all' ? 'images or videos' : activeTab + 's'} using the tool above, and your creations will appear here.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              layout // Animate layout changes when items are added/removed
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" // Slightly increased gap
            >
              {filteredMedia.map((item, index) => (
                 <motion.div
                    key={item.id}
                    layout // Animate individual item layout changes
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }} // Stagger animation
                 >
                    <MediaCard item={item} onDeleted={() => handleItemDeleted(item.id)} />
                 </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// --- MediaCard Component (Redesigned) ---
interface MediaCardProps {
  item: GeneratedMedia;
  onDeleted: () => void;
}

function MediaCard({ item, onDeleted }: MediaCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const formattedDate = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const downloadMedia = async (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info("Starting download...");
    try {
      const response = await fetch(item.media_url, { mode: 'cors' });
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const extension = item.media_type === 'image' ? '.png' : '.webp';
      a.download = `${item.media_type}-${item.id.substring(0, 8)}${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${item.media_type} downloaded`);
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(`Download failed: ${error.message}`);
    }
  };

  const copyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.prompt) { toast.error("No prompt available."); return; }
    navigator.clipboard.writeText(item.prompt)
      .then(() => {
        setIsCopied(true);
        toast.success('Prompt copied!');
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((error) => {
        console.error('Failed to copy:', error);
        toast.error('Failed to copy prompt');
      });
  };

  const handleDeleteConfirm = async () => {
    if (!item.id) { toast.error("Cannot delete: Missing ID."); return; }
    setIsDeleting(true);
    console.log(`Attempting to delete media: ${item.id}, path: ${item.storage_path || 'N/A'}`);
    try {
      const result = await deleteMedia(item.id, item.storage_path);
      if (result.success) {
        onDeleted(); // Parent handles optimistic update and success toast
      } else {
        toast.error(`Failed to delete: ${result.error}`);
        setIsDeleting(false);
      }
    } catch (error: any) {
      toast.error(`Error deleting media: ${error.message}`);
      setIsDeleting(false);
    }
  };

  const isLoading = item.status === 'pending' || item.status === 'processing';
  const isFailed = item.status === 'failed';
  const isCompleted = item.status === 'completed';
  const showActions = isCompleted || isFailed;

  return (
    <motion.div
        whileHover={{ y: -5, scale: 1.03 }} // Lift effect on hover
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`glass-card group relative overflow-hidden rounded-lg border border-white/10 shadow-md transition-all duration-300 flex flex-col
                    ${isLoading ? 'opacity-60 animate-pulse' : ''}
                    ${isFailed ? 'border-destructive/50' : ''}`}
    >
      {/* Image/Video Area */}
      <div className="relative aspect-square overflow-hidden bg-black/10">
        {/* Status Overlays */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              key="loading-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10 p-4 text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-xs font-medium text-primary-foreground">{item.status}...</span>
            </motion.div>
          )}
          {isFailed && (
            <motion.div
              key="failed-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/40 backdrop-blur-sm z-10 p-4 text-center"
            >
              <AlertCircle className="h-8 w-8 text-destructive-foreground mb-2" />
              <span className="text-xs font-medium text-destructive-foreground">Failed</span>
              {typeof item.metadata === 'object' && item.metadata !== null && 'error' in item.metadata && (
                   <p className="text-[10px] text-destructive-foreground/80 mt-1 line-clamp-2" title={String(item.metadata.error)}>
                       {String(item.metadata.error)}
                   </p>
               )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Media display */}
        {isCompleted && item.media_url ? (
          <Image
            src={item.media_url}
            alt={item.prompt || 'Generated media'}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105" // Subtle zoom on hover
            unoptimized={true}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          !isFailed && !isLoading && (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
              {item.media_type === 'image' ? <ImageIcon className="h-16 w-16" /> : <VideoIcon className="h-16 w-16" />}
            </div>
          )
        )}

         {/* Media type badge */}
         <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium flex items-center gap-1 z-20 text-white/90 border border-white/10">
           {item.media_type === 'image' ? <ImageIcon className="h-3 w-3" /> : <VideoIcon className="h-3 w-3" />}
           <span className="capitalize">{item.media_type}</span>
         </div>
      </div>

      {/* Content Area */}
      <CardContent className="p-3 flex flex-col flex-grow">
         {/* Prompt */}
        <p className="text-xs text-muted-foreground line-clamp-2 h-8 flex-grow mb-2" title={item.prompt}>
          {item.prompt || 'No prompt provided'}
        </p>

        {/* Date and Actions */}
        <div className="flex items-center justify-between mt-auto border-t border-white/10 pt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formattedDate}</span>
          </div>

          {/* Actions */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex gap-1"
              >
                {isCompleted && item.media_url && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={downloadMedia} title="Download" disabled={isDeleting}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
                {item.prompt && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={copyPrompt} title="Copy prompt" disabled={isDeleting}>
                    {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10" title="Delete" disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card border-destructive/30">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Media?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The media record and associated file (if any) will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </motion.div>
  );
}
