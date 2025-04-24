// src/app/(app)/account/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/supabase/subscriptions';
import { formatPrice } from '@/lib/utils';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UpdateProfileForm } from '@/components/account/update-profile-form';
import { SuccessToastWrapper } from '@/components/account/success-toast';
import { ManageSubscriptionButton } from '@/components/account/manage-subscription-button';
import { getUserCredits } from '@/lib/credits';
import { CREDIT_PACKS } from '@/lib/config/pricing';
import { CreditPackCard } from '@/components/account/credit-pack-card';
import { User as UserIcon, CreditCard, Zap, Wallet } from 'lucide-react'; // Added icons

export default async function AccountPage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch data concurrently
  const [profileResult, subscriptionResult, userCreditsResult, creditUsageResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    getUserSubscription(), // Fetches subscription with price and product
    getUserCredits(),
    supabase
      .from('credit_usage')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const profile = profileResult.data;
  const subscription = subscriptionResult; // Already includes nested data
  const userCredits = userCreditsResult;
  const creditUsage = creditUsageResult.data;

  return (
    <div className="container mx-auto px-4 py-10 space-y-10"> {/* Consistent padding and spacing */}
      {/* Client component to handle URL parameters and show toast */}
      <SuccessToastWrapper />

      {/* Page Header */}
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent inline-block">
          Account Settings
        </h1>
        <p className="text-xl text-muted-foreground">
          Manage your profile, subscription, and credits.
        </p>
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Main Content Column (Profile, Credits, Security) */}
        <div className="md:col-span-2 space-y-8"> {/* Increased spacing */}

          {/* Profile Card */}
          <Card className="glass-card border border-white/15 shadow-xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-white/15 bg-gradient-to-b from-white/5 to-transparent flex flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center border border-white/15 shadow-inner">
                 <UserIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                 <CardTitle className="text-2xl text-foreground/95">Profile Information</CardTitle>
                 <CardDescription className="text-base text-muted-foreground">
                   Update your account details
                 </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <UpdateProfileForm profile={profile} />
            </CardContent>
          </Card>

          {/* Credits Card */}
          <Card className="glass-card border border-white/15 shadow-xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-white/15 bg-gradient-to-b from-white/5 to-transparent flex flex-row items-center gap-4">
               <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent/30 to-primary/30 flex items-center justify-center border border-white/15 shadow-inner">
                  <Wallet className="w-6 h-6 text-accent-foreground" />
               </div>
               <div>
                  <CardTitle className="text-2xl text-foreground/95">Your Credits</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                     Manage and view your credit balance and usage.
                  </CardDescription>
               </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6"> {/* Increased spacing */}
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-lg text-foreground/95">Total Credits Available</h3> {/* Larger text */}
                  <p className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary inline-block">{userCredits.total.toLocaleString()}</p> {/* Larger, gradient text */}
                </div>
              </div>

              <Separator className="bg-white/15" /> {/* Glassy separator */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6"> {/* Responsive grid */}
                <div>
                  <h3 className="font-medium text-foreground/95 text-lg">Subscription Credits</h3> {/* Larger text */}
                  <p className="text-xl text-primary font-bold">{userCredits.subscriptionCredits.toLocaleString()}</p> {/* Larger, colored text */}
                  <p className="text-sm text-muted-foreground mt-1">Refreshes monthly based on your plan</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground/95 text-lg">Purchased Credits</h3> {/* Larger text */}
                  <p className="text-xl text-accent/90 font-bold">{userCredits.purchasedCredits.toLocaleString()}</p> {/* Larger, colored text */}
                  <p className="text-sm text-muted-foreground mt-1">Never expires</p>
                </div>
              </div>

              {creditUsage && creditUsage.length > 0 && (
                <>
                  <Separator className="bg-white/15" /> {/* Glassy separator */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-foreground/95">Recent Usage</h3> {/* Larger text */}
                    <div className="space-y-3 max-h-40 overflow-y-auto pr-2 styled-scrollbars"> {/* Added max height and scrollbar class */}
                      {creditUsage.map((usage) => (
                        <div key={usage.id} className="flex justify-between items-center text-sm text-foreground/80 border-b border-white/5 pb-2 last:border-b-0"> {/* Added subtle border */}
                          <span>{usage.description || 'Credit usage'}</span>
                          <span className="font-medium text-destructive/80 shrink-0">-{usage.amount}</span> {/* Styled usage amount */}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Purchase Credits Card */}
          <Card className="glass-card border border-white/15 shadow-xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-white/15 bg-gradient-to-b from-white/5 to-transparent flex flex-row items-center gap-4">
               <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary/30 to-accent/30 flex items-center justify-center border border-white/15 shadow-inner">
                  <CreditCard className="w-6 h-6 text-secondary-foreground" />
               </div>
               <div>
                  <CardTitle className="text-2xl text-foreground/95">Purchase More Credits</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                     Top up your balance with one-time credit packs.
                  </CardDescription>
               </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6"> {/* Adjusted grid for smaller screens */}
                {CREDIT_PACKS.map((pack) => (
                  // CreditPackCard is now a client component and styled internally
                  <CreditPackCard key={pack.id} creditPack={pack} />
                ))}
              </div>
            </CardContent>
          </Card>

           {/* Account Security Card (Optional - can be combined or kept separate) */}
           {/* Keeping it simple for now, focusing on Profile/Credits/Subscription */}
           {/* If needed, add a similar Card structure here */}

        </div>

        {/* Subscription Card Column */}
        <div>
          <Card className="glass-card border border-white/15 shadow-xl overflow-hidden sticky top-24"> {/* Added sticky positioning */}
            <CardHeader className="pb-4 border-b border-white/15 bg-gradient-to-b from-white/5 to-transparent flex flex-row items-center gap-4">
               <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary/30 to-primary/30 flex items-center justify-center border border-white/15 shadow-inner">
                  <Zap className="w-6 h-6 text-secondary-foreground" />
               </div>
               <div>
                  <CardTitle className="text-2xl text-foreground/95">Subscription</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                     Manage your plan and billing.
                  </CardDescription>
               </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6"> {/* Increased spacing */}
              {subscription ? (
                <>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground/95">Current Plan</h3> {/* Larger text */}
                    {/* Use optional chaining for safety */}
                    <p className="text-2xl font-bold text-primary">{subscription.prices?.products?.name || 'Unknown Plan'}</p> {/* Larger text */}
                    <p className="text-base text-muted-foreground mt-1"> {/* Larger text */}
                      {subscription.prices?.unit_amount ? formatPrice(subscription.prices.unit_amount) : '$0.00'}
                      / {subscription.prices?.interval || 'month'}
                    </p>
                  </div>

                  <Separator className="bg-white/15" /> {/* Glassy separator */}

                  <div>
                    <h3 className="font-semibold text-lg text-foreground/95">Status</h3> {/* Larger text */}
                    <div className="flex items-center gap-2 mt-2"> {/* Increased gap */}
                      <div className={`w-3 h-3 rounded-full ${
                        subscription.status === 'active' ? 'bg-green-500' :
                        subscription.status === 'trialing' ? 'bg-blue-500' : 'bg-red-500'
                      }`}></div>
                      <p className="capitalize text-base text-foreground/95">{subscription.status}</p> {/* Larger text */}
                    </div>
                  </div>

                   <Separator className="bg-white/15" /> {/* Glassy separator */}

                   {/* Manage Subscription Button */}
                   {/* ManageSubscriptionButton is now a client component and styled internally */}
                   <ManageSubscriptionButton />

                </>
              ) : (
                <>
                  <div className="text-center py-4 space-y-4"> {/* Increased spacing */}
                    <h3 className="font-semibold text-lg text-foreground/95">Free Plan</h3> {/* Larger text */}
                    <p className="text-base text-muted-foreground"> {/* Larger text */}
                      You are currently on our free plan with limited features.
                    </p>
                    <Button asChild className="w-full glass-button bg-gradient-to-r from-primary to-secondary text-white hover:opacity-95 hover:shadow-lg transition-all duration-300 shadow-md text-lg py-3 font-semibold"> {/* Styled button */}
                      <Link href="/pricing">Upgrade Plan</Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
