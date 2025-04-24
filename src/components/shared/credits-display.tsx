// src/components/shared/credits-display.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function CreditsDisplay() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchCredits() {
      setLoading(true);
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      // Fetch user credits
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_credits, purchased_credits')
        .eq('id', user.id)
        .single();
      
      if (userData) {
        const subscriptionCredits = userData.subscription_credits || 0;
        const purchasedCredits = userData.purchased_credits || 0;
        setCredits(subscriptionCredits + purchasedCredits);
      }
      
      setLoading(false);
    }
    
    fetchCredits();
    
    // Set up real-time subscription for credits updates
    const supabase = createClient();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchCredits();
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  if (loading) {
    return (
      <div className="bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium">
        Loading...
      </div>
    );
  }
  
  if (credits === null) {
    return null;
  }
  
  return (
    <div className="bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium">
      {credits.toLocaleString()} Credits
    </div>
  );
}
