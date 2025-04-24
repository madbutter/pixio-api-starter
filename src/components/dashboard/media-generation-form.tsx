// src/components/dashboard/media-generation-form.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertCircle, Image as LucideImage, Film, Sparkles } from 'lucide-react';
import { generateMedia, checkMediaStatus } from '@/lib/actions/media.actions';
import { toast } from 'sonner';
import Image from 'next/image';
import { MediaType } from '@/lib/constants/media';
import { motion, AnimatePresence } from 'framer-motion';

interface MediaGenerationFormProps {
  mediaType: MediaType;
  creditCost: number;
  userCredits: number;
  onGenerationStart?: (mediaId: string) => void;
}

export function MediaGenerationForm({
  mediaType,
  creditCost,
  userCredits,
  onGenerationStart
}: MediaGenerationFormProps) {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false); // Track active polling state
  const [pollingMediaId, setPollingMediaId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');
  
  // Use a ref to track polling timeouts
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Define the polling function
  const pollMediaStatus = async (mediaId: string) => {
    if (!mediaId) return;
    
    console.log(`Polling status for media ${mediaId}...`);
    setIsPolling(true); // Set polling state to true when polling starts
    
    try {
      const result = await checkMediaStatus(mediaId);
      console.log(`Poll result for ${mediaId}:`, result);
      
      setPreviewStatus(result.status as typeof previewStatus);
      
      if (result.status === 'completed') {
        console.log(`Generation completed for ${mediaId}`);
        setPreviewUrl(result.mediaUrl || null);
        toast.success(`${mediaType} generation complete!`);
        // Stop polling on completion
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsPolling(false); // End polling state when complete
      } else if (result.status === 'failed') {
        console.log(`Generation failed for ${mediaId}`);
        toast.error(`Generation failed: ${result.error || 'Unknown reason'}`);
        // Stop polling on failure
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsPolling(false); // End polling state when failed
      } else {
        console.log(`Status is ${result.status}, continuing poll in 5 seconds...`);
        // Continue polling after 5 seconds
        timeoutRef.current = setTimeout(() => pollMediaStatus(mediaId), 5000);
      }
    } catch (error) {
      console.error(`Error polling status:`, error);
      toast.error("Error checking status");
      // We don't stop polling on error, we'll try again
      timeoutRef.current = setTimeout(() => pollMediaStatus(mediaId), 5000);
    }
  };
  
  // Effect to start polling when media ID changes
  useEffect(() => {
    // Clear any existing timeout when dependencies change
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Start polling if we have a media ID
    if (pollingMediaId) {
      console.log(`Starting initial poll for media ${pollingMediaId}`);
      setIsPolling(true); // Set polling flag when we start
      // Start immediately
      pollMediaStatus(pollingMediaId);
    } else {
      setIsPolling(false); // Clear polling flag when no media ID
    }
    
    // Cleanup function to clear timeout when component unmounts or dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [pollingMediaId]); // Only re-run when pollingMediaId changes
  
  // Reset when prompt changes
  useEffect(() => {
    if (prompt && pollingMediaId) {
      setPollingMediaId(null);
      setPreviewStatus('idle');
      setPreviewUrl(null);
      setIsPolling(false);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [prompt, pollingMediaId]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsPolling(false);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!prompt.trim()) { toast.error("Please enter a prompt."); return; }
    if (userCredits < creditCost) { toast.error("Not enough credits to generate."); return; }

    setIsSubmitting(true);
    setPreviewUrl(null);
    setPreviewStatus('pending');
    
    // Clear any existing polling
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPollingMediaId(null);
    setIsPolling(false);

    console.log(`Starting generation for ${mediaType}...`);

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('mediaType', mediaType);

      const result = await generateMedia(formData);
      console.log(`Generation result:`, result);

      if (!result.success || !result.mediaId) {
        toast.error(result.error || 'Failed to start generation');
        setPreviewStatus('failed');
        setIsPolling(false);
      } else {
        toast.info(`Your ${mediaType} generation has started! Checking status every 5 seconds...`);
        // This will trigger the polling effect
        setPollingMediaId(result.mediaId);
        setIsPolling(true);
        
        if (onGenerationStart) {
          onGenerationStart(result.mediaId);
        }
      }
    } catch (error: any) {
      console.error(`Submission error:`, error);
      toast.error('An unexpected error occurred');
      setPreviewStatus('failed');
      setIsPolling(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Use both isSubmitting, isPolling, and status to determine if we're in a loading state
  const isLoading = isSubmitting || isPolling || previewStatus === 'processing' || previewStatus === 'pending';

  return (
    <div className="grid md:grid-cols-2 gap-8 items-start">
      {/* Form Section */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-5"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor={`${mediaType}-prompt`} className="block text-base font-medium mb-2 text-foreground/90">
              Enter your prompt
            </label>
            <Textarea
              id={`${mediaType}-prompt`}
              placeholder={`Describe the ${mediaType} you want to create... e.g., "A mystical forest scene with glowing mushrooms"`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading}
              rows={7}
              className="resize-none glass-input bg-white/5 border-white/15 focus:border-primary/60 focus:ring-primary/30 focus:ring-2 transition-all text-base p-3 rounded-lg"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !prompt.trim() || userCredits < creditCost}
            className="w-full glass-button bg-gradient-to-r from-primary to-secondary text-white hover:opacity-95 hover:shadow-lg transition-all duration-300 shadow-md text-lg py-3 font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {isSubmitting ? 'Starting...' : (isPolling ? 'Generating...' : 'Processing...')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate {mediaType} ({creditCost} credits)
              </>
            )}
          </Button>
        </form>
        
        {/* Credit Info */}
        <div className="text-base text-muted-foreground border-t border-white/15 pt-4 space-y-1 bg-white/5 p-4 rounded-lg shadow-inner">
          <p><span className="font-semibold text-foreground/95">Cost:</span> <span className="text-primary font-medium">{creditCost}</span> credits</p>
          <p><span className="font-semibold text-foreground/95">Available:</span> <span className="text-primary font-medium">{userCredits.toLocaleString()}</span> credits</p>
          {userCredits < creditCost && !isLoading && (
             <p className="text-destructive text-sm flex items-center gap-1 pt-1"><AlertCircle className="w-4 h-4"/> Not enough credits.</p>
          )}
        </div>
      </motion.div>

      {/* Preview Section */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col"
      >
        <label className="block text-base font-medium mb-2 text-foreground/90">
          Result preview
        </label>
        <div className="relative glass-card bg-black/10 border border-white/15 rounded-lg h-72 md:h-80 flex items-center justify-center overflow-hidden shadow-inner p-2">
          <AnimatePresence mode="wait">
            {isLoading && (previewStatus === 'pending' || previewStatus === 'processing' || isPolling) ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="text-center p-4 flex flex-col items-center justify-center absolute inset-0 bg-black/40 backdrop-blur-md rounded-lg"
              >
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-base font-medium text-foreground">Generating your {mediaType}...</p>
                <p className="text-sm text-muted-foreground mt-1">Checking status every 5 seconds...</p>
              </motion.div>
            ) : previewStatus === 'completed' && previewUrl ? (
              <motion.div
                key="completed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative w-full h-full"
              >
                <Image src={previewUrl} alt={prompt || "Generated Media"} fill className="object-contain rounded-md" unoptimized={true} />
              </motion.div>
            ) : previewStatus === 'failed' ? (
              <motion.div
                key="failed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                className="text-center p-4 flex flex-col items-center justify-center absolute inset-0 bg-destructive/20 backdrop-blur-sm rounded-lg"
              >
                <AlertCircle className="h-12 w-12 text-destructive-foreground mb-4" />
                <p className="text-base font-medium text-destructive-foreground">Generation failed.</p>
                <p className="text-sm text-destructive-foreground/80 mt-1">Check library or try again.</p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center p-4 flex flex-col items-center justify-center text-muted-foreground"
              >
                <div className="rounded-full bg-primary/10 p-5 w-fit mx-auto mb-5 border border-primary/20 shadow-sm">
                  {mediaType === 'image' ? <LucideImage className="h-10 w-10 text-primary/80" /> : <Film className="h-10 w-10 text-primary/80" />}
                </div>
                <p className="text-base">
                  Your {mediaType} preview will appear here
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
