// src/components/dashboard/media-generation-form.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Image as LucideImage, Film, Sparkles, Upload, X } from 'lucide-react';
import { generateMedia, checkMediaStatus } from '@/lib/actions/media.actions';
import { toast } from 'sonner';
import Image from 'next/image';
import { MediaType, MediaStatus, GenerationMode, CREDIT_COSTS } from '@/lib/constants/media';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageSelectorPopover } from './image-selector-popover';
import imageCompression from 'browser-image-compression';
// Import Supabase client
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid'; // For unique filenames

interface MediaGenerationFormProps {
  generationMode: GenerationMode;
  creditCost: number;
  userCredits: number;
  onGenerationStart?: (mediaId: string) => void;
}

// Helper function for direct Supabase upload
async function uploadDirectlyToSupabase(
    file: File,
    userId: string,
    type: 'start' | 'end'
): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!file || !userId) {
        return { success: false, error: 'User ID and file are required.' };
    }

    const supabase = createClient(); // Initialize Supabase client

    try {
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'bin';
        // Use UUID for more robust uniqueness
        const fileName = `${type}-${uuidv4()}.${fileExtension}`;
        const storagePath = `${userId}/inputs/${fileName}`; // Store in user-specific inputs folder

        console.log(`Uploading input image directly to: ${storagePath}`);
        const uploadToastId = toast.info(`Uploading ${type} image...`, { duration: 60000 }); // Show toast with longer duration

        const { data, error: uploadError } = await supabase.storage
            .from('generated-media') // Your bucket name
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false, // Don't upsert, use unique names
                contentType: file.type,
            });

        toast.dismiss(uploadToastId); // Dismiss upload toast immediately after attempt

        if (uploadError) {
            console.error(`Direct upload error (${type}):`, uploadError);
            throw new Error(`Direct upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from('generated-media')
            .getPublicUrl(storagePath);

        if (!publicUrlData?.publicUrl) {
            throw new Error('Failed to get public URL for uploaded input image.');
        }

        console.log(`Direct upload success (${type}): ${publicUrlData.publicUrl}`);
        // toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} image uploaded.`); // Optional success toast

        return { success: true, url: publicUrlData.publicUrl };

    } catch (error: any) {
        console.error(`Error in uploadDirectlyToSupabase (${type}):`, error);
        // toast.dismiss(); // Ensure any related toasts are dismissed
        toast.error(`Failed to upload ${type} image.`);
        return { success: false, error: error.message };
    }
}


export function MediaGenerationForm({
  generationMode,
  creditCost,
  userCredits,
  onGenerationStart
}: MediaGenerationFormProps) {
  const [prompt, setPrompt] = useState('');
  const [startImageFile, setStartImageFile] = useState<File | null>(null);
  const [endImageFile, setEndImageFile] = useState<File | null>(null);
  const [startImageUrl, setStartImageUrl] = useState<string | null>(null);
  const [endImageUrl, setEndImageUrl] = useState<string | null>(null);
  const [startImagePreview, setStartImagePreview] = useState<string | null>(null);
  const [endImagePreview, setEndImagePreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingMediaId, setPollingMediaId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<MediaStatus | 'idle'>('idle');
  const [pollFailCount, setPollFailCount] = useState(0); // Track consecutive failed polls

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startFileInputRef = useRef<HTMLInputElement>(null);
  const endFileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null); // State for user ID

  const supabase = createClient(); // Initialize client for getting user ID

  // Get user ID on mount
   useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      if (!user) console.warn("MediaGenerationForm: User not found on mount.");
    };
    getUser();
  }, [supabase]);


  const generatedMediaType: MediaType = generationMode === 'image' ? 'image' : 'video';

  // --- Image Handling ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (type === 'start') { setStartImageFile(file); setStartImageUrl(null); setStartImagePreview(result); }
        else { setEndImageFile(file); setEndImageUrl(null); setEndImagePreview(result); }
      };
      reader.readAsDataURL(file);
    } else {
         if (type === 'start') { setStartImageFile(null); setStartImagePreview(null); }
         else { setEndImageFile(null); setEndImagePreview(null); }
    }
  };
  const handleImageSelection = useCallback((url: string | null, type: 'start' | 'end') => {
    if (type === 'start') { setStartImageUrl(url); setStartImageFile(null); setStartImagePreview(url); }
    else { setEndImageUrl(url); setEndImageFile(null); setEndImagePreview(url); }
  }, []);
  const clearImage = (type: 'start' | 'end') => {
    if (type === 'start') { setStartImageFile(null); setStartImageUrl(null); setStartImagePreview(null); if (startFileInputRef.current) startFileInputRef.current.value = ""; }
    else { setEndImageFile(null); setEndImageUrl(null); setEndImagePreview(null); if (endFileInputRef.current) endFileInputRef.current.value = ""; }
  };

  // --- Polling Logic (MODIFIED) ---
  const pollMediaStatus = useCallback(async (mediaId: string) => {
     if (!mediaId) return;
    setIsPolling(true);
    try {
      const result = await checkMediaStatus(mediaId);
      setPreviewStatus(result.status as typeof previewStatus); // Update status regardless

      if (result.status === 'completed') {
        setPreviewUrl(result.mediaUrl || null);
        toast.success(`${generatedMediaType} generation complete!`);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        setIsPolling(false);
        setPollFailCount(0); // Reset fail count on success
      } else if (result.status === 'failed') {
          // --- MODIFICATION START ---
          // Check if we should retry polling after a failure
          if (pollFailCount < 2) { // Allow 1 retry after seeing 'failed'
              console.warn(`MediaGenerationForm: Received 'failed' status for ${mediaId}, retrying poll once more... (Attempt ${pollFailCount + 1})`);
              setPollFailCount(prev => prev + 1);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              // Retry after a slightly longer delay
              timeoutRef.current = setTimeout(() => pollMediaStatus(mediaId), 7000);
          } else {
              // Stop polling after retry limit exceeded
              console.error(`MediaGenerationForm: Received 'failed' status for ${mediaId} after retry. Stopping poll.`);
              toast.error(`Generation failed: ${result.error || 'Unknown reason'}`);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
              setIsPolling(false);
              setPollFailCount(0); // Reset fail count
          }
          // --- MODIFICATION END ---
      } else {
        // Still processing or pending, continue polling
        setPollFailCount(0); // Reset fail count if status is not 'failed'
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => pollMediaStatus(mediaId), 5000);
      }
    } catch (error) {
      console.error(`Error polling status:`, error);
      toast.error("Error checking status");
      // Still attempt to poll again after an error during the check
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => pollMediaStatus(mediaId), 8000); // Longer delay after error
    }
  }, [generatedMediaType, pollFailCount]); // Added pollFailCount dependency

  // Effect to start/stop polling based on pollingMediaId
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (pollingMediaId) {
        setIsPolling(true);
        setPollFailCount(0); // Reset fail count when starting a new poll
        // Use requestAnimationFrame to ensure state update happens before first poll
        requestAnimationFrame(() => pollMediaStatus(pollingMediaId));
    }
    else {
        setIsPolling(false);
        setPollFailCount(0); // Reset fail count when polling stops
    }
    // Cleanup function to clear timeout on unmount or when pollingMediaId changes
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [pollingMediaId, pollMediaStatus]); // pollMediaStatus is now stable due to useCallback

  // Effect to reset preview if inputs change while polling
  useEffect(() => {
    const hasInputs = prompt || startImageFile || endImageFile || startImageUrl || endImageUrl;
    if (hasInputs && pollingMediaId) {
        console.log("MediaGenerationForm: Inputs changed during polling, resetting preview.");
        setPollingMediaId(null); // This will trigger the cleanup in the above useEffect
        setPreviewStatus('idle');
        setPreviewUrl(null);
        // No need to clear timeout here, the pollingMediaId change handles it
    }
  }, [prompt, startImageFile, endImageFile, startImageUrl, endImageUrl, pollingMediaId]);

  // General cleanup effect
  useEffect(() => {
    return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsPolling(false); // Ensure polling stops on unmount
        setPollFailCount(0);
    };
  }, []);

  // --- Submission Logic ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) { toast.error("User not identified. Please refresh."); return; }

    // Validation
    if (generationMode === 'firstLastFrameVideo') {
      if (!startImageFile && !startImageUrl) { toast.error("Please provide a start image."); return; }
      if (!endImageFile && !endImageUrl) { toast.error("Please provide an end image."); return; }
      if (!prompt.trim()) { toast.error("Please enter a prompt."); return; }
    } else {
      if (!prompt.trim()) { toast.error("Please enter a prompt."); return; }
    }
    if (userCredits < creditCost) { toast.error("Not enough credits to generate."); return; }

    setIsSubmitting(true);
    setPreviewUrl(null);
    setPreviewStatus('pending');
    setPollFailCount(0); // Reset fail count before starting

    // Clear any existing polling timeout and reset polling ID
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPollingMediaId(null);
    setIsPolling(false); // Explicitly set polling to false initially

    let finalStartImageUrl = startImageUrl;
    let finalEndImageUrl = endImageUrl;

    try {
      // Image Compression & Direct Upload
      if (generationMode === 'firstLastFrameVideo') {
        const compressionOptions = { maxSizeMB: 0.95, maxWidthOrHeight: 1920, useWebWorker: true };

        if (startImageFile) {
          let compressedStartFile = startImageFile;
          try {
            const compressToastId = toast.loading("Compressing start image...");
            compressedStartFile = await imageCompression(startImageFile, compressionOptions);
            toast.dismiss(compressToastId);
          } catch (compressionError) { console.error("Start image compression failed:", compressionError); toast.error("Failed to compress start image. Using original."); }
          const uploadResult = await uploadDirectlyToSupabase(compressedStartFile, userId, 'start');
          if (!uploadResult.success || !uploadResult.url) throw new Error(uploadResult.error || "Failed to upload start image.");
          finalStartImageUrl = uploadResult.url;
        }

        if (endImageFile) {
          let compressedEndFile = endImageFile;
           try {
            const compressToastId = toast.loading("Compressing end image...");
            compressedEndFile = await imageCompression(endImageFile, compressionOptions);
            toast.dismiss(compressToastId);
          } catch (compressionError) { console.error("End image compression failed:", compressionError); toast.error("Failed to compress end image. Using original."); }
          const uploadResult = await uploadDirectlyToSupabase(compressedEndFile, userId, 'end');
           if (!uploadResult.success || !uploadResult.url) throw new Error(uploadResult.error || "Failed to upload end image.");
          finalEndImageUrl = uploadResult.url;
        }

        if (!finalStartImageUrl || !finalEndImageUrl) throw new Error("Missing required image URLs after processing uploads.");
      }

      // Prepare FormData
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('generationMode', generationMode);
      formData.append('mediaType', generatedMediaType);
      if (generationMode === 'firstLastFrameVideo') {
        formData.append('startImageUrl', finalStartImageUrl!);
        formData.append('endImageUrl', finalEndImageUrl!);
      }

      // Call server action
      const result = await generateMedia(formData);

      if (!result.success || !result.mediaId) {
        toast.error(result.error || 'Failed to start generation');
        setPreviewStatus('failed');
        setIsPolling(false); // Ensure polling is off
      } else {
        toast.info(`Your ${generatedMediaType} generation has started! Checking status...`);
        setPollingMediaId(result.mediaId); // This will trigger the useEffect to start polling
        if (onGenerationStart) onGenerationStart(result.mediaId);
      }
    } catch (error: any) {
      console.error(`Submission error:`, error);
      toast.error(error.message || 'An unexpected error occurred during submission.');
      setPreviewStatus('failed');
      setIsPolling(false); // Ensure polling is off on error
      setPollingMediaId(null); // Clear polling ID on error
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = isSubmitting || isPolling; // Simplified loading state
  const isFirstLastMode = generationMode === 'firstLastFrameVideo';

  // --- Render Image Input Helper ---
  const renderImageInput = (type: 'start' | 'end') => {
    const previewSrc = type === 'start' ? startImagePreview : endImagePreview;
    const fileInputRef = type === 'start' ? startFileInputRef : endFileInputRef;
    const selectedUrl = type === 'start' ? startImageUrl : endImageUrl;
    return (
      <div className="space-y-2">
        <Label htmlFor={`${type}-image-input`} className="text-base font-medium text-foreground/90"> {type === 'start' ? 'Start Image' : 'End Image'} </Label>
        <div className="flex items-center gap-2">
           <Input id={`${type}-image-input`} ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/webp, image/gif" onChange={(e) => handleFileChange(e, type)} className="hidden" disabled={isLoading}/>
           <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="glass-input bg-white/5 border-white/15 hover:bg-white/10 text-foreground/80 flex-grow"> <Upload className="mr-2 h-4 w-4" /> Upload </Button>
           <span className="text-xs text-muted-foreground mx-1">OR</span>
           <ImageSelectorPopover selectedUrl={selectedUrl} onImageSelect={(url) => handleImageSelection(url, type)} triggerText="Select Existing" disabled={isLoading}/>
        </div>
        <div className="mt-2" style={{ minHeight: '100px' }}>
            <AnimatePresence>
              {previewSrc && (
                <motion.div key={`${type}-preview`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: '100px' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="relative border border-white/15 rounded-md overflow-hidden p-1 bg-black/10" style={{ width: '100px' }}>
                  <Image src={previewSrc} alt={`${type} image preview`} fill sizes="100px" className="object-contain" onError={(e) => console.error(`Error loading ${type} preview image:`, e)}/>
                  <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6 bg-black/50 text-white hover:bg-black/70 hover:text-destructive rounded-full m-1 z-10" onClick={() => clearImage(type)} disabled={isLoading} title={`Remove ${type} image`}> <X className="h-4 w-4" /> </Button>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      </div>
    );
  };

  // --- Main Return JSX ---
  return (
     <div className="grid md:grid-cols-2 gap-8 items-start">
      {/* Form Section */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {isFirstLastMode && ( <> {renderImageInput('start')} {renderImageInput('end')} </> )}
          <div>
            <Label htmlFor={`${generationMode}-prompt`} className="block text-base font-medium mb-2 text-foreground/90"> {isFirstLastMode ? 'Describe the transition or style' : 'Enter your prompt'} </Label>
            <Textarea id={`${generationMode}-prompt`} placeholder={isFirstLastMode ? 'e.g., "Smooth transition..."' : `Describe the ${generatedMediaType}...`} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading} rows={isFirstLastMode ? 3 : 7} className="resize-none glass-input bg-white/5 border-white/15 focus:border-primary/60 focus:ring-primary/30 focus:ring-2 transition-all text-base p-3 rounded-lg"/>
          </div>
          <Button type="submit" disabled={isLoading || !userId || userCredits < creditCost || (isFirstLastMode ? (!startImageFile && !startImageUrl) || (!endImageFile && !endImageUrl) || !prompt.trim() : !prompt.trim())} className="w-full glass-button bg-gradient-to-r from-primary to-secondary text-white hover:opacity-95 hover:shadow-lg transition-all duration-300 shadow-md text-lg py-3 font-semibold">
            {isLoading ? ( <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {isSubmitting ? 'Starting...' : 'Generating...'}</> ) : ( <><Sparkles className="mr-2 h-5 w-5" /> Generate ({creditCost} credits)</> )}
          </Button>
        </form>
        <div className="text-base text-muted-foreground border-t border-white/15 pt-4 space-y-1 bg-white/5 p-4 rounded-lg shadow-inner">
          <p><span className="font-semibold text-foreground/95">Cost:</span> <span className="text-primary font-medium">{creditCost}</span> credits</p>
          <p><span className="font-semibold text-foreground/95">Available:</span> <span className="text-primary font-medium">{userCredits.toLocaleString()}</span> credits</p>
          {userCredits < creditCost && !isLoading && ( <p className="text-destructive text-sm flex items-center gap-1 pt-1"><AlertCircle className="w-4 h-4"/> Not enough credits.</p> )}
        </div>
      </motion.div>

      {/* Preview Section */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex flex-col">
        <label className="block text-base font-medium mb-2 text-foreground/90"> Result preview </label>
        <div className="relative glass-card bg-black/10 border border-white/15 rounded-lg aspect-video md:aspect-square flex items-center justify-center overflow-hidden shadow-inner p-2">
          <AnimatePresence mode="wait">
            {/* Loading State */}
            {isLoading && (previewStatus === 'pending' || previewStatus === 'processing') && (
              <motion.div key="loading" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3 }} className="text-center p-4 flex flex-col items-center justify-center absolute inset-0 bg-black/40 backdrop-blur-md rounded-lg"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-base font-medium text-foreground">Generating your {generatedMediaType}...</p> <p className="text-sm text-muted-foreground mt-1">Checking status...</p> </motion.div>
            )}
            {/* Completed State */}
            {previewStatus === 'completed' && previewUrl && (
              <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="relative w-full h-full">
                {generatedMediaType === 'video' ? ( <video src={previewUrl} controls className="w-full h-full object-contain rounded-md" preload="metadata" /> ) : ( <Image src={previewUrl} alt={prompt || "Generated Media"} fill className="object-contain rounded-md" unoptimized={true} /> )}
              </motion.div>
            )}
            {/* Failed State */}
            {previewStatus === 'failed' && !isLoading && ( // Only show failed if not actively loading/polling
              <motion.div key="failed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.3 }} className="text-center p-4 flex flex-col items-center justify-center absolute inset-0 bg-destructive/20 backdrop-blur-sm rounded-lg"> <AlertCircle className="h-12 w-12 text-destructive-foreground mb-4" /> <p className="text-base font-medium text-destructive-foreground">Generation failed.</p> <p className="text-sm text-destructive-foreground/80 mt-1">Check library or try again.</p> </motion.div>
            )}
            {/* Idle State */}
            {previewStatus === 'idle' && !isLoading && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-center p-4 flex flex-col items-center justify-center text-muted-foreground"> <div className="rounded-full bg-primary/10 p-5 w-fit mx-auto mb-5 border border-primary/20 shadow-sm"> {generatedMediaType === 'image' ? <LucideImage className="h-10 w-10 text-primary/80" /> : <Film className="h-10 w-10 text-primary/80" />} </div> <p className="text-base"> Your {generatedMediaType} preview will appear here </p> </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
