// src/app/(app)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getUserCredits } from '@/lib/credits';
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MediaGenerationForm } from '@/components/dashboard/media-generation-form';
import { MediaLibrary } from '@/components/dashboard/media-library';
import { fetchUserMedia } from '@/lib/actions/media.actions';
// Import the new constants
import { CREDIT_COSTS, GENERATION_MODES } from '@/lib/constants/media';
import { Sparkles, Bot, Image as ImageIconLucide, Film, StepForward } from 'lucide-react'; // Added StepForward icon

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch profile and credits concurrently
  const [profileResult, creditsResult, initialMediaResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    getUserCredits(),
    fetchUserMedia() // Fetch initial media data on the server
  ]);

  const profile = profileResult.data;
  const { total: totalCredits } = creditsResult;

  // Default active tab
  const defaultTab = GENERATION_MODES[0]; // Default to the first mode ('image')

  return (
    <div className="container mx-auto px-4 py-10 space-y-10">

      {/* Welcome Header */}
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent inline-block">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Creator'}!
        </h1>
        <p className="text-xl text-muted-foreground">
          Let's create something amazing with AI.
        </p>
      </div>

      {/* AI Media Generator Card */}
      <Card className="glass-card border border-white/15 shadow-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-white/15 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center border border-white/15 shadow-inner">
                <Bot className="w-6 h-6 text-primary-foreground" />
             </div>
             <div>
                <CardTitle className="text-2xl md:text-3xl text-foreground/95">AI Media Generator</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Generate images and videos using your credits.
                </CardDescription>
             </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          {/* Update Tabs to include the new mode */}
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-transparent p-0 gap-4"> {/* Changed to grid-cols-3 */}
              <TabsTrigger
                value="image"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-white/20 bg-white/15 text-foreground/80 hover:bg-white/20 hover:text-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/80 data-[state=active]:to-secondary/80 data-[state=active]:text-primary-foreground data-[state=active]:border-transparent data-[state=active]:shadow-lg transition-all duration-300 text-base font-medium"
              >
                <ImageIconLucide className="w-5 h-5 mr-1" /> Image
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-white/20 bg-white/15 text-foreground/80 hover:bg-white/20 hover:text-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/80 data-[state=active]:to-secondary/80 data-[state=active]:text-primary-foreground data-[state=active]:border-transparent data-[state=active]:shadow-lg transition-all duration-300 text-base font-medium"
              >
                 <Film className="w-5 h-5 mr-1" /> Video (Txt2Vid)
              </TabsTrigger>
              {/* New Tab Trigger */}
              <TabsTrigger
                value="firstLastFrameVideo"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-white/20 bg-white/15 text-foreground/80 hover:bg-white/20 hover:text-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/80 data-[state=active]:to-secondary/80 data-[state=active]:text-primary-foreground data-[state=active]:border-transparent data-[state=active]:shadow-lg transition-all duration-300 text-base font-medium"
              >
                 <StepForward className="w-5 h-5 mr-1" /> Video (Img2Vid)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="image" className="mt-0">
              <MediaGenerationForm
                generationMode="image" // Use generationMode prop
                creditCost={CREDIT_COSTS.image}
                userCredits={totalCredits}
              />
            </TabsContent>

            <TabsContent value="video" className="mt-0">
              <MediaGenerationForm
                generationMode="video" // Use generationMode prop
                creditCost={CREDIT_COSTS.video}
                userCredits={totalCredits}
              />
            </TabsContent>

            {/* New Tab Content */}
            <TabsContent value="firstLastFrameVideo" className="mt-0">
              <MediaGenerationForm
                generationMode="firstLastFrameVideo" // Use generationMode prop
                creditCost={CREDIT_COSTS.firstLastFrameVideo}
                userCredits={totalCredits}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Media Library Section */}
      <MediaLibrary initialMedia={initialMediaResult.success ? initialMediaResult.media : []} />
    </div>
  );
}
