// src/lib/constants/media.ts

export const DEPLOYMENT_IDS = {
    image: '8f96cb86-5cbb-4ad0-9837-8a79eeb5103a',
    video: 'd07cf1d5-412c-4270-b925-ffd6416abd1c'
  } as const;
  
  export const CREDIT_COSTS = {
    image: 10,
    video: 100
  } as const;
  
  export const MEDIA_TYPES = ['image', 'video'] as const;
  
  export type MediaType = typeof MEDIA_TYPES[number];
  
  export type MediaStatus = 'pending' | 'processing' | 'completed' | 'failed';
  
  export type GenerationResult = {
    success: boolean;
    mediaId?: string;
    runId?: string;
    status?: string;
    mediaUrl?: string;
    error?: string;
  };
  