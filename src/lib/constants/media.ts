// src/lib/constants/media.ts

export const DEPLOYMENT_IDS = {
    image: '8f96cb86-5cbb-4ad0-9837-8a79eeb5103a',
    video: 'd07cf1d5-412c-4270-b925-ffd6416abd1c',
    firstLastFrameVideo: '8c463102-0525-4cf1-8535-731fee0f93b4',
  } as const;
  
  export const CREDIT_COSTS = {
    image: 10,
    video: 100,
    firstLastFrameVideo: 100,
  } as const;
  
  export const MEDIA_TYPES = ['image', 'video'] as const;
  
  export type MediaType = typeof MEDIA_TYPES[number];

  export const GENERATION_MODES = ['image', 'video', 'firstLastFrameVideo'] as const;
  export type GenerationMode = typeof GENERATION_MODES[number];
  
  export type MediaStatus = 'pending' | 'processing' | 'completed' | 'failed';
  
  export type GenerationResult = {
    success: boolean;
    mediaId?: string;
    runId?: string;
    status?: string;
    mediaUrl?: string;
    error?: string;
  };
  