// src/components/dashboard/media-generation-form.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ImageIcon, VideoIcon, AlertCircle, Image as LucideImage, Film, Sparkles, Info } from 'lucide-react';
// Import the server actions
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
  const [isSubmitting, setIsSubmitting] = useState(false); // Tracks initial submission
  const [pollingMediaId, setPollingMediaId] = useState<string | null>(null); // ID being polled
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store interval ID

  // --- DEBUG: Log state changes ---
  useEffect(() => {
      console.log(`Form State Update (${mediaType}): isSubmitting=${isSubmitting}, pollingMediaId=${pollingMediaId}, previewStatus=${previewStatus}, previewUrl=${previewUrl}`);
  }, [isSubmitting, pollingMediaId, previewStatus, previewUrl, mediaType]);
  // --- END DEBUG ---

  // Function to stop polling
  const stopPolling = useCallback((reason: string) => {
    if (intervalRef.current) {
      console.log(`Form (${mediaType}): Stopping polling for media ${pollingMediaId}. Reason: ${reason}`);
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Don't clear pollingMediaId here, it's needed to show the final state
  }, [pollingMediaId, mediaType]); // Include dependencies

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      stopPolling("unmount");
    };
  }, [stopPolling]);

  // The polling function - Calls the server action to check DB status
  const pollStatus = useCallback(async (mediaId: string) => {
    if (!mediaId) return;

    console.log(`Form (${mediaType}): Polling DB status for ${mediaId}...`);
    try {
      // Call the server action which NOW ONLY reads the DB
      const result = await checkMediaStatus(mediaId);
      console.log(`Form (${mediaType}): Poll result from DB for ${mediaId}:`, result);

      setPreviewStatus(result.status as typeof previewStatus);

      if (result.status === 'completed') {
        setPreviewUrl(result.mediaUrl || null);
        toast.success(`Preview updated: ${mediaType} ready!`);
        stopPolling("completed");
      } else if (result.status === 'failed') {
        toast.error(`Generation failed: ${result.error || 'Unknown reason'}`);
        stopPolling("failed");
      } else {
        // Still pending or processing according to DB, continue polling
        console.log(`Form (${mediaType}): Status is ${result.status} (from DB), continuing poll for ${mediaId}`);
      }
    } catch (error) {
      console.error(`Form (${mediaType}): Error during DB polling for ${mediaId}:`, error);
      toast.error("Error checking status.");
      setPreviewStatus('failed'); // Assume failed if polling itself fails
      stopPolling("polling error");
    }
  }, [mediaType, stopPolling]); // Include dependencies

  // Effect to start/stop polling interval based on pollingMediaId
  useEffect(() => {
    if (pollingMediaId) {
      stopPolling("starting new poll"); // Clear any existing interval first
      console.log(`Form (${mediaType}): Starting polling interval for ${pollingMediaId}`);
      // Initial check immediately
      pollStatus(pollingMediaId);
      // Set up interval
      intervalRef.current = setInterval(() => pollStatus(pollingMediaId), 5000); // Poll every 5 seconds
    } else {
        stopPolling("pollingMediaId cleared"); // Stop if ID is cleared
    }

    // Cleanup function for this effect specifically
    return () => stopPolling("pollingMediaId changed or effect re-run");
  }, [pollingMediaId, pollStatus, stopPolling, mediaType]); // Depend on pollingMediaId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!prompt.trim()) { toast.error("Please enter a prompt."); return; }
    if (userCredits < creditCost) { toast.error("Not enough credits to generate."); return; }

    setIsSubmitting(true);
    setPreviewUrl(null);
    setPreviewStatus('pending'); // Set initial status immediately
    setPollingMediaId(null); // Clear previous ID
    stopPolling("new submission"); // Stop any previous polling

    console.log(`Form (${mediaType}): Submitting generation request...`);

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('mediaType', mediaType);

      // Call the server action to initiate generation (deducts credits, creates DB record, invokes Edge Function)
      // This action should return quickly with the mediaId
      const result = await generateMedia(formData);
      console.log(`Form (${mediaType}): generateMedia action result:`, result);

      if (!result.success || !result.mediaId) {
        toast.error(result.error || 'Failed to start generation');
        setPreviewStatus('failed'); // Mark as failed if the initial action fails
      } else {
        toast.info(`Your ${mediaType} generation has started! Monitoring status...`);
        // Set the ID returned by the action to start polling for it
        setPollingMediaId(result.mediaId);
        // The useEffect dependency on pollingMediaId will now start the polling interval
        if (onGenerationStart) {
          onGenerationStart(result.mediaId); // Notify parent (MediaLibrary) about the new item
        }
      }
    } catch (error: any) {
      console.error(`Form (${mediaType}): Error during submission:`, error);
      toast.error('An unexpected error occurred during submission');
      setPreviewStatus('failed'); // Mark as failed on unexpected error
    } finally {
       // Set submitting false once the initial request is done, polling handles subsequent states
       setIsSubmitting(false);
    }
  }

  // Reset preview if prompt changes
  useEffect(() => {
    // Reset preview and stop polling if user types a new prompt
    setPreviewStatus('idle');
    setPreviewUrl(null);
    stopPolling("prompt changed");
    setPollingMediaId(null); // Stop polling any previous item
  }, [prompt, stopPolling]); // Depend only on prompt and stopPolling

  // Determine if the form is effectively in a loading state
  const isLoading = isSubmitting || previewStatus === 'processing' || previewStatus === 'pending';

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
                {isSubmitting ? 'Starting...' : (previewStatus === 'pending' ? 'Pending...' : 'Processing...')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate {mediaType} ({creditCost} credits)
              </>
            )}
          </Button>
        </form>
        {/* Enhanced Credit Info */}
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
            {previewStatus === 'pending' || previewStatus === 'processing' ? (
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
                <p className="text-sm text-muted-foreground mt-1">Monitoring status...</p>
              </motion.div>
            ) : previewStatus === 'completed' && previewUrl ? (
              <motion.div
                key="completed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative w-full h-full"
              >
                {/* Render Image or Video based on mediaType */}
                {mediaType === 'image' ? (
                   <Image src={previewUrl} alt={prompt || "Generated Image"} fill className="object-contain rounded-md" unoptimized={true} />
                ) : (
                   // Assuming video outputs are webp and can be displayed as images for preview
                   <Image src={previewUrl} alt={prompt || "Generated Video Preview"} fill className="object-contain rounded-md" unoptimized={true} />
                   // If you need actual video playback in preview, you'd use a <video> tag here
                )}

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
            ) : ( // 'idle' state
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
