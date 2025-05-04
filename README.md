# Pixio API Starter

A modern SaaS subscription starter template with Next.js, Supabase Auth, Stripe, and AI media generation powered by ComfyUI.

![Subscription Starter Banner](https://img.mytsi.org/i/A4j7988.png)

<details>
<summary>Overview</summary>

Pixio API Starter is a complete boilerplate for building subscription-based SaaS applications with integrated AI media generation. It includes user authentication, subscription management, a flexible credit system, and a beautiful glassmorphic UI – everything you need to launch your AI-powered SaaS product quickly and efficiently.

</details>

<details>
<summary>Tech Stack</summary>

This project leverages modern technologies for a performant and developer-friendly experience:

- **Frontend Framework**: [Next.js 15](https://nextjs.org/) with App Router and Server Components
- **Authentication & Database**: [Supabase](https://supabase.io/)
- **Payments & Subscriptions**: [Stripe](https://stripe.com/)
- **AI Generation**: [ComfyUI](https://comfyui.com/) via [Pixio API](https://api.myapps.ai/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) validation

</details>

<details>
<summary>Features</summary>

- ✅ **User Authentication**: Sign up, login, and user profile management
- ✅ **Subscription Management**: Tiered pricing plans with monthly/yearly billing
- ✅ **Stripe Integration**: Secure payment processing with webhooks and customer portal
- ✅ **Credit System**: Flexible credit-based usage for AI features with purchased packs and subscription allocation
- ✅ **AI Media Generation**: Generate images and videos from text prompts using integrated ComfyUI workflows
- ✅ **Media Library**: View and manage generated media with status tracking and real-time updates
- ✅ **Responsive Design**: Looks great on all devices
- ✅ **Dark Mode Support**: Light and dark theme options
- ✅ **TypeScript**: Type-safe code for better developer experience
- ✅ **Server Components**: Leverages Next.js 15 server components for improved performance
- ✅ **Row Level Security**: Secure database access with Supabase RLS
- ✅ **Supabase Edge Function**: Handles asynchronous AI generation requests and polling
- ✅ **Supabase Storage**: Stores generated media files securely

</details>

<details open>
<summary>🚀 Getting Started (For New Forks)</summary>

This section guides you through setting up the project locally after forking the repository.

### Prerequisites

- Node.js 18.0.0 or higher
- npm, yarn, or pnpm
- A [Supabase](https://supabase.io/) account
- A [Stripe](https://stripe.com/) account
- A [Pixio API](https://api.myapps.ai/) account (for AI generation)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local webhook testing)

### 1. Clone and Install

1.  Fork the repository on GitHub.
2.  Clone your forked repository:

    ```bash
    git clone https://github.your-username.com/yourusername/subscription-starter.git
    cd subscription-starter
    ```
3.  Install dependencies:

    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

### 2. Set up Supabase

You'll set up your database, storage, and three Edge Functions in the Supabase UI.

1.  **Create a New Project:**
    *   Go to the [Supabase Dashboard](https://app.supabase.com/).
    *   Click "New project".
    *   Fill in the details and create your project.
    *   Note your project URL and `anon` key from Project Settings > API.
    *   Generate a new `service_role` key under Project Settings > API > Project API keys (if one isn't already listed).
2.  **Set up Database Schema:**
    *   Go to the SQL Editor (`</>`) in your Supabase project dashboard.
    *   Run the SQL script provided in the [Database Schema Setup](#database-schema-setup) section below. This creates all necessary tables, enums, and the `handle_new_user` trigger.
3.  **Create Storage Bucket:**
    *   Go to Storage in your Supabase project dashboard.
    *   Click "New bucket".
    *   Name it `generated-media`.
    *   Choose **Public** or **Private** (the current code expects **Public** for simplicity in displaying media URLs directly).
    *   Click "Create bucket".
    *   Go to policies and create a new policy "Give user access to their own top level folder named uid" and allow SELECT, INSERT, UPDATE, DELETE.
4.  **Create Edge Functions:**
    *   You need to create three edge functions for this application. These functions work together in a chain to handle the media generation process.

    *   **(a) generate-media-handler Function:**
        *   Go to Edge Functions in your Supabase project dashboard.
        *   Click "New Function".
        *   Name it `generate-media-handler`.
        *   Choose a region.
        *   Click "Create function".
        *   This function initiates media generation by submitting jobs to the Pixio API.
        *   Go to the function's settings and add a **Secret** named `COMFY_DEPLOY_API_KEY` with your Pixio API key as the value.
        *   Copy the code from the `supabase-functions/generate-media-handler.ts` file in your project and paste it into the function editor in the Supabase UI.
        *   **Important:** Update the `DEPLOYMENT_IDS` object within the function code with your actual Pixio API workflow IDs for different generation types:
            ```typescript
            const DEPLOYMENT_IDS = {
              image: '8f96cb86-5cbb-4ad0-9837-8a79eeb5103a', // Replace with your ID
              video: 'd07cf1d5-412c-4270-b925-ffd6416abd1c', // Replace with your ID
              firstLastFrameVideo: '8c463102-0525-4cf1-8535-731fee0f93b4', // Replace with your ID
            };
            ```
        *   Deploy the function.

    *   **(b) poll-status-handler Function:**
        *   Click "New Function" again.
        *   Name it `poll-status-handler`.
        *   Choose a region.
        *   Click "Create function".
        *   This function checks the status of generation jobs by polling the Pixio API and triggering the next function when complete.
        *   Copy the code from the `supabase-functions/poll-status-handler.ts` file in your project.
        *   Add the following **Secrets**:
            *   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
            *   `COMFY_DEPLOY_API_KEY`: Your Pixio API key
        *   Deploy the function.

    *   **(c) process-result-handler Function:**
        *   Click "New Function" again.
        *   Name it `process-result-handler`.
        *   Choose a region.
        *   Click "Create function".
        *   This function processes completed generation results by downloading the media, storing it in Supabase Storage, and updating the database.
        *   Copy the code from the `supabase-functions/process-result-handlerts` file in your project.
        *   Add the following **Secret**:
            *   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
        *   Deploy the function.
        
    *   **How these functions work together:**
        *   When a user requests media generation, your app calls the `generate-media-handler` function
        *   The `generate-media-handler` submits the job to Pixio API and triggers the `poll-status-handler`
        *   The `poll-status-handler` periodically checks if generation is complete, and when it is, triggers the `process-result-handler`
        *   The `process-result-handler` downloads the completed media, stores it in your Supabase bucket, and updates the database
  
5.  **Configure Authentication URLs:**
    *   Go to Authentication > URL Configuration.
    *   Set **Site URL** to `http://localhost:3000`.
    *   Add `http://localhost:3000/auth/callback` to the **Redirect URLs**. (Remember to add your production URL here later).

### 3. Set up Stripe

You'll set up your products, prices, and webhooks in the Stripe UI.

1.  **Create Products and Prices:**
    *   Log in to the [Stripe Dashboard](https://dashboard.stripe.com/).
    *   Go to Products.
    *   Create your subscription product tiers (e.g., Pro, Business). For each, add both monthly and yearly **Recurring** prices. Note down the **Price IDs**.
    *   Create one-time products for your Credit Packs (e.g., "1000 Credits"). For each, add a **One-time** price. Note down the **Price IDs**.
2.  **Configure Webhook:**
    *   Go to Developers > Webhooks.
    *   Click "Add endpoint".
    *   For local testing, use the Stripe CLI (see step 4 below). Your local webhook URL will look like `http://localhost:3000/api/webhooks/stripe`.
    *   Select the following events to listen for:
        *   `product.created`, `product.updated`, `product.deleted`
        *   `price.created`, `price.updated`, `price.deleted`
        *   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
        *   `checkout.session.completed`
        *   `invoice.paid`, `invoice.payment_succeeded`
    *   After creating the endpoint, get your **Webhook Signing Secret**.
3.  **Update Price IDs in Code:**
    *   Open `src/lib/config/pricing.ts`.
    *   Update the `STRIPE_PRICE_IDS` object and the `CREDIT_PACKS` array with the actual Price IDs you got from Stripe in step 1.

### 4. Set up Environment Variables (.env.local)

Create a `.env.local` file in the root of your project and add the following variables, using the keys and URLs you obtained from Supabase, Stripe, and Pixio API.

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SIGNING_SECRET

# Stripe Price IDs (from Stripe Dashboard)
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_your_pro_monthly_id
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=price_your_pro_yearly_id
NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY=price_your_business_monthly_id
NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY=price_your_business_yearly_id
NEXT_PUBLIC_STRIPE_PRICE_CREDIT_PACK_1000=price_your_1000_credits_price_id
NEXT_PUBLIC_STRIPE_PRICE_CREDIT_PACK_2500=price_your_2500_credits_price_id
NEXT_PUBLIC_STRIPE_PRICE_CREDIT_PACK_5000=price_your_5000_credits_price_id

# Pixio API Key (from Pixio account)
COMFY_DEPLOY_API_KEY=YOUR_PIXIO_API_KEY

# Application URL (Important for redirects - use http://localhost:3000 for local)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 5. Test Local Webhooks (Optional but Recommended)

Use the Stripe CLI to forward events to your local development server:

1.  Make sure the Stripe CLI is installed and logged in (`stripe login`).
2.  Run the listen command, forwarding to your local webhook route:

    ```bash
    stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
    ```
3.  The CLI will output a webhook signing secret. **This is different from the one in your Stripe dashboard settings.** Update the `STRIPE_WEBHOOK_SECRET` in your `.env.local` file with this local secret while testing locally. Remember to switch it back to your production secret when deploying.

### 6. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You should now have the application running locally with authentication, subscription, credit system, and AI generation capabilities connected to your Supabase, Stripe, and Pixio API accounts!

</details>

<details>
<summary>Project Structure</summary>

The project follows a modular structure using the Next.js App Router:

```
/src
  /app
    /(marketing) - Public marketing pages
      /page.tsx - Landing page
      /pricing/page.tsx - Pricing page
      /layout.tsx - Layout for marketing pages
    /(auth) - Authentication pages
      /login/
        /page.tsx - Login page
        /login-form.tsx - Login form component
      /signup/
        /page.tsx - Signup page
        /signup-form.tsx - Signup form component
      /layout.tsx - Layout for auth pages
      /auth/callback/route.ts - Auth callback handler
    /(app) - Auth-protected application pages
      /dashboard/page.tsx - User dashboard
      /account/
        /page.tsx - Account settings page
        /manage-subscription-button.tsx - Client component for subscription management
        /update-profile-form.tsx - Client component for profile updates
        /success-toast.tsx - Toast notification for successful payments
      /premium/page.tsx - Subscription-protected content
      /layout.tsx - Layout for app pages (includes auth check)
    /api - API routes
      /webhooks/stripe/route.ts - Stripe webhook handler
      /create-checkout-session/route.ts - Create checkout session endpoint
      /create-customer-portal/route.ts - Customer portal session endpoint
      /check-session-status/route.ts - Check Stripe session status endpoint
      /purchase-credits/route.ts - Create credit purchase session endpoint
  /components
    /ui - Shadcn UI components
    /account - Account-related components (UpdateProfileForm, ManageSubscriptionButton, CreditPackCard, SuccessToast)
    /dashboard - Dashboard components (MediaGenerationForm, MediaLibrary, MediaCard)
    /shared - Shared components (Navbar, Footer, CreditsDisplay)
    /pricing - Pricing components (PricingClient)
    /checkout - Checkout components (CheckoutModal)
  /lib
    /actions - Server actions (auth, media, stripe)
    /services - Backend services (media.service)
    /storage - Storage helpers (supabase-storage)
    /supabase - Supabase client/server/middleware setup
    /stripe - Stripe client setup
    /validators - Zod validation schemas
    /config - Configuration files (pricing)
    /constants - Constants (media types, costs, deployment IDs)
    /utils.ts - Utility functions
    /theme.ts - Theme configuration
  /middleware.ts - Next.js middleware for auth protection
  /types
    /db_types.ts - Database and entity type definitions
```

</details>

<details>
<summary>Understanding Route Groups and Protection</summary>

This project uses Next.js App Router with three main route groups:

1. `(marketing)` - Public pages accessible to everyone
2. `(auth)` - Authentication pages for login and signup
3. `(app)` - Protected pages requiring authentication

### How Auth Protection Works

Auth protection is implemented at two levels:

1. **Route Group Layout**: The `(app)/layout.tsx` file checks for authentication and redirects unauthenticated users to login:

```tsx
// src/app/(app)/layout.tsx
import { Navbar } from '@/components/shared/navbar';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pt-16 pb-8">
        {children}
      </main>
    </div>
  );
}
```

2. **Middleware**: The `middleware.ts` file in the root directory provides an additional layer of protection:

```typescript
// src/middleware.ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)',
  ],
};
```

The `updateSession` function checks authentication and redirects accordingly:

```typescript
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/db_types';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser();

  // Optional: Redirect unauthenticated users
  const authPath = request.nextUrl.pathname.startsWith('/login') || 
                   request.nextUrl.pathname.startsWith('/signup') || 
                   request.nextUrl.pathname.startsWith('/auth');
  
  const protectedPaths = ['/dashboard', '/account', '/premium'];
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  // Redirect unauthenticated users from protected routes to login
  if (!user && isProtectedPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users from auth routes to dashboard
  if (user && authPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
```

</details>

<details>
<summary>How to Add New Pages</summary>

### Adding a Regular Auth-Protected Page

To add a new page that requires authentication:

1. Create a new file in the `(app)` route group:

```tsx
// src/app/(app)/new-page/page.tsx
import { createClient } from '@/lib/supabase/server';

export default async function NewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // The (app) layout already ensures user is authenticated,
  // so you can safely use the user object here
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">New Page</h1>
      <p>Welcome, {user.email}!</p>
      {/* Your page content */}
    </div>
  );
}
```

### Adding a Subscription-Protected Page

To add a page that requires an active subscription:

1. Create a new file in the `(app)` route group:

```tsx
// src/app/(app)/subscribers-only/page.tsx
import { isUserSubscribed, getSubscriptionTier } from '@/lib/supabase/subscriptions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function SubscribersOnlyPage() {
  const subscribed = await isUserSubscribed();
  const tier = await getSubscriptionTier(); // You might also want the tier for specific content

  // Show upgrade prompt if user isn't subscribed
  if (!subscribed) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md glass-card"> {/* Added glass-card style */}
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Subscribers Only</CardTitle> {/* Larger title */}
            <CardDescription className="text-base"> {/* Larger description */}
              This content requires an active subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4 pb-6"> {/* Increased spacing */}
            <div className="py-6">
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-base text-muted-foreground"> {/* Larger text */}
                Upgrade your account to access premium features and content.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild className="w-full glass-button bg-gradient-to-r from-primary to-secondary text-white hover:opacity-95 hover:shadow-lg transition-all duration-300 shadow-md text-lg py-3 font-semibold"> {/* Styled button */}
              <Link href="/pricing">View Plans</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Premium Content</h1>
        <p className="text-muted-foreground">
          Welcome to the premium section! You have access to exclusive content.
        </p>
      </div>
      
      <div className="p-4 mb-8 rounded-lg bg-primary-50 border border-primary-200 text-primary-800">
        <div className="flex gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div>
            <h3 className="font-medium">Your Subscription Tier: {tier.toUpperCase()}</h3>
            <p className="text-sm mt-1">
              You have full access to all premium content based on your {tier} subscription.
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Premium Feature 1 */}
        <Card>
          <CardHeader>
            <CardTitle>Advanced Analytics</CardTitle>
            <CardDescription>
              Detailed insights into your data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-primary-50 rounded-md flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="mt-4 text-muted-foreground">
              Unlock deep insights with our advanced analytics tools. Track performance, visualize trends, and make data-driven decisions.
            </p>
          </CardContent>
        </Card>
        
        {/* Premium Feature 2 */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Support</CardTitle>
            <CardDescription>
              Get help when you need it most
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-primary-50 rounded-md flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="mt-4 text-muted-foreground">
              As a premium member, you receive priority support from our team. Get answers quickly and resolve issues faster.
            </p>
          </CardContent>
        </Card>
        
        {tier === 'business' && (
          // Business-only feature
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Enterprise Integration</CardTitle>
              <CardDescription>
                Exclusive to Business Plan subscribers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-accent-50 rounded-md flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-accent-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="mt-4 text-muted-foreground">
                Connect your enterprise systems and enjoy seamless integration with our platform. This feature is exclusively available to Business Plan subscribers.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

### Adding a Tier-Specific Protected Page

To restrict content to specific subscription tiers (e.g., Business tier only):

```tsx
// src/app/(app)/business-features/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionTier } from '@/lib/supabase/subscriptions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function BusinessFeaturesPage() {
  const tier = await getSubscriptionTier();
  
  // Only allow business tier users
  if (tier !== 'business') {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md glass-card"> {/* Added glass-card style */}
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Business Plan Required</CardTitle> {/* Larger title */}
            <CardDescription className="text-base"> {/* Larger description */}
              This content requires a Business plan subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4"> {/* Increased spacing */}
            <p className="text-base text-muted-foreground"> {/* Larger text */}
              Your current plan: <span className="font-semibold">{tier.toUpperCase()}</span>
            </p>
            <p className="text-base text-muted-foreground"> {/* Larger text */}
              Upgrade to our Business plan to access these features.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild className="w-full glass-button bg-gradient-to-r from-primary to-secondary text-white hover:opacity-95 hover:shadow-lg transition-all duration-300 shadow-md text-lg py-3 font-semibold"> {/* Styled button */}
              <Link href="/pricing">Upgrade Plan</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // User has business tier, show the content
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Business Features</h1>
      <p className="mb-6">Welcome to the exclusive Business tier features!</p>
      
      {/* Your business-specific content */}
    </div>
  );
}
```

</details>

<details>
<summary>Setting up Supabase</summary>

### 1. Create a Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/) and create a new project
2. Note your project URL and API keys from the project settings
3. Add these to your `.env.local` file

### 2. Database Schema Setup

Run the following SQL in the Supabase SQL Editor to set up your database schema. This includes tables for users, customers, products, prices, subscriptions, credit purchases, credit usage, and generated media.

```sql
-- Create ENUM types for subscription status and pricing details
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');
CREATE TYPE public.pricing_type AS ENUM ('one_time', 'recurring');
CREATE TYPE public.pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');

-- USERS Table: Stores public user profile information.
CREATE TABLE public.users (
 id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text,
 avatar_url text,
 billing_address jsonb,
 payment_method jsonb,
 -- Credit System Fields
 subscription_credits INTEGER DEFAULT 0,
 purchased_credits INTEGER DEFAULT 0,
 last_credits_reset_date TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON public.users FOR SELECT USING (true);
CREATE POLICY "Can update own user data." ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Can view own user data." ON public.users FOR SELECT USING (auth.uid() = id);

-- Function to automatically create a public user profile when a new auth user signs up
-- This function also initializes credits for the new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
 INSERT INTO public.users (id, full_name, avatar_url, subscription_credits, last_credits_reset_date)
 VALUES (
   new.id,
   new.raw_user_meta_data->>'full_name',
   new.raw_user_meta_data->>'avatar_url',
   -- Initialize with free tier credits (assuming free tier gives 500 credits)
   500,
   timezone('utc'::text, now())
 );
 RETURN new;
END;
$$;

-- Trigger the function after user creation
CREATE TRIGGER on_auth_user_created
 AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CUSTOMERS Table: Maps Supabase auth users to Stripe customer IDs. (Accessed via service_role)
CREATE TABLE public.customers (
 id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 stripe_customer_id text UNIQUE
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
-- No policies needed if accessed only via service_role key.

-- PRODUCTS Table: Stores product information synced from Stripe.
CREATE TABLE public.products (
 id text PRIMARY KEY, -- Stripe Product ID
 active boolean,
 name text,
 description text,
 image text,          -- Stripe Product Image URL
 metadata jsonb
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON public.products FOR SELECT USING (true);

-- PRICES Table: Stores price information synced from Stripe.
CREATE TABLE public.prices (
 id text PRIMARY KEY, -- Stripe Price ID
 product_id text REFERENCES public.products(id) ON DELETE CASCADE,
 active boolean,
 description text,
 unit_amount bigint, -- Amount in cents/smallest currency unit
 currency text CHECK (char_length(currency) = 3),
 type public.pricing_type,
 interval public.pricing_plan_interval,
 interval_count integer,
 trial_period_days integer,
 metadata jsonb
);
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON public.prices FOR SELECT USING (true);

-- SUBSCRIPTIONS Table: Stores user subscription information synced from Stripe.
CREATE TABLE public.subscriptions (
 id text PRIMARY KEY, -- Stripe Subscription ID
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status public.subscription_status,
 metadata jsonb,
 price_id text REFERENCES public.prices(id),
 quantity integer,
 cancel_at_period_end boolean,
 created timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
 current_period_start timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
 current_period_end timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
 ended_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
 cancel_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
 canceled_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
 trial_start timestamp with time zone DEFAULT timezone('utc'::text, now()),
 trial_end timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own subscription data." ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Create table for credit purchases (records one-time credit pack purchases)
CREATE TABLE public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  price_id TEXT NOT NULL, -- Stripe Price ID of the credit pack
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own credit purchases" ON public.credit_purchases FOR SELECT USING (auth.uid() = user_id);

-- Create table for credit usage (records when credits are spent)
CREATE TABLE public.credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Amount of credits used (negative value)
  description TEXT, -- Description of usage (e.g., "Generated image")
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own credit usage" ON public.credit_usage FOR SELECT USING (auth.uid() = user_id);

-- Table for storing generated media
CREATE TABLE public.generated_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')), -- Add other types here if needed
  media_url TEXT NOT NULL, -- Public URL in storage
  storage_path TEXT NOT NULL, -- Path in storage bucket
  credits_used INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT NULL -- Store ComfyUI run_id, error messages, etc.
);
ALTER TABLE public.generated_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own media" ON public.generated_media FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Can insert own media" ON public.generated_media FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Can update own media" ON public.generated_media FOR UPDATE USING (auth.uid() = user_id);
-- Policy for service role to update status/url/path
CREATE POLICY IF NOT EXISTS "Allow service role to update media" 
  ON public.generated_media 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

```

### 3. Authentication Settings

1. Go to Authentication > URL Configuration
2. Set Site URL to your application URL (e.g., `http://localhost:3000` for development)
3. Add a redirect URL: `http://localhost:3000/auth/callback` (add your production URL as well when deploying)
4. Configure email templates if desired

### 4. Create Supabase Storage Bucket

You need a storage bucket to store the generated images and videos.

1. Go to Storage in your Supabase project dashboard.
2. Click "New bucket".
3. Name the bucket `generated-media`.
4. **Important:** Decide on Public vs. Private access.
   - **Public:** Generated media URLs will be publicly accessible without authentication. This is simpler for display but means anyone with the URL can view the media.
   - **Private:** Generated media requires authentication to view. This is more secure but requires signing URLs on the server before displaying them in the frontend. The current implementation assumes **Public** access for simplicity in fetching the `media_url` directly. If you need private storage, you'll need to modify the `MediaCard` component to generate signed URLs.
5. Click "Create bucket".
6. Go to policies and create a new policy "Give user access to their own top level folder named uid" and allow SELECT, INSERT, UPDATE, DELETE.

### 5. Create Supabase Edge Functions

This project uses three Supabase Edge Functions that work together in a chain to handle the asynchronous media generation process. This architecture offloads potentially long-running processes from your Next.js server, keeps API keys secure, and enables reliable background processing.

#### 5.1 generate-media-handler (Initiate Generation)

This function initiates the media generation process by submitting a job to the Pixio API.

1. Go to Edge Functions in your Supabase project dashboard.
2. Click "New Function".
3. Name it `generate-media-handler`.
4. Choose a region.
5. Select "Deno" as the runtime (default).
6. Click "Create function".
7. Once created, navigate to the function's page.
8. Click the "Link to GitHub" button to connect it to your repository (optional but recommended).
9. Add the `COMFY_DEPLOY_API_KEY` as a **Secret** in the function's settings.
10. Copy the code from `supabase-functions/generate-media-handler.ts` into the function editor.
11. **Important:** The function contains a `DEPLOYMENT_IDS` object which maps generation modes to specific Pixio API workflow IDs. Update these IDs with your actual Pixio API workflow deployments:
    ```typescript
    const DEPLOYMENT_IDS = {
      image: '8f96cb86-5cbb-4ad0-9837-8a79eeb5103a', // Replace with your image generation workflow ID
      video: 'd07cf1d5-412c-4270-b925-ffd6416abd1c', // Replace with your video generation workflow ID
      firstLastFrameVideo: '8c463102-0525-4cf1-8535-731fee0f93b4', // Replace with your keyframe video workflow ID
    };
    ```
12. Deploy the function.

This function:
- Validates the user request and parameters
- Creates a record in the database with 'processing' status
- Submits the generation job to Pixio API
- Updates the database with the run ID
- Asynchronously triggers the polling function
- Returns immediately to the client

#### 5.2 poll-status-handler (Check Generation Progress)

This function periodically polls the Pixio API to check the status of a generation job.

1. Go to Edge Functions in your Supabase project dashboard.
2. Click "New Function".
3. Name it `poll-status-handler`.
4. Choose a region.
5. Click "Create function".
6. Copy the code from `supabase-functions/poll-status-handler.ts` into the function editor.
7. Add the following **Secrets** in the function's settings:
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `COMFY_DEPLOY_API_KEY`: Your Pixio API key
8. Deploy the function.

This function:
- Is triggered by the `generate-media-handler` function
- Checks the status of a generation job with the Pixio API
- If the job is still processing, it reschedules itself to check again later
- If the job fails, it updates the database status to 'failed'
- If the job completes, it triggers the `process-result-handler` function
- Implements exponential backoff for retries and handles API errors gracefully

#### 5.3 process-result-handler (Process Completed Media)

This function processes successful generation results from the Pixio API.

1. Go to Edge Functions in your Supabase project dashboard.
2. Click "New Function".
3. Name it `process-result-handler`.
4. Choose a region.
5. Click "Create function".
6. Copy the code from `supabase-functions/process-result-handler.ts` into the function editor.
7. Add the `SUPABASE_SERVICE_ROLE_KEY` as a **Secret** in the function's settings.
8. Deploy the function.

This function:
- Is triggered by the `poll-status-handler` function when a generation completes
- Downloads the generated media from the Pixio API's temporary URL
- Determines the appropriate file extension and content type
- Uploads the file to Supabase Storage
- Updates the database with the completed status, permanent URL, and metadata
- Handles any errors and updates the database if processing fails

### How These Functions Work Together

The three functions form a chain:

1. **Client → generate-media-handler**: The client calls the `generate-media-handler`, which initiates the generation process with the Pixio API and returns immediately with a success response.

2. **generate-media-handler → poll-status-handler**: The `generate-media-handler` asynchronously invokes the `poll-status-handler` to begin checking the status of the generation.

3. **poll-status-handler → poll-status-handler**: The `poll-status-handler` schedules itself to run again if the generation is still in progress, creating a polling loop.

4. **poll-status-handler → process-result-handler**: When the `poll-status-handler` detects the generation is complete, it invokes the `process-result-handler` to download and process the result.

5. **process-result-handler → Database**: The `process-result-handler` updates the database with the final result information, which the client can then query to get the completed media.

This chain ensures reliable processing even if the client disconnects after starting the generation.

### 1. Create Stripe Products and Prices

1. Log in to the [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to Products > Add Product
3. Create your product tiers (e.g., Free, Pro, Business)
4. For each **paid** product, add pricing plans:
   - Create both monthly and yearly **Recurring** prices.
   - Set the appropriate prices.
   - Note the **Price IDs** (e.g., `price_1234567890`) for each plan.
5. Create **one-time** products for your Credit Packs (e.g., "1000 Credits").
6. For each Credit Pack product, add a **One-time** price.
7. Note the **Price IDs** for each credit pack.

### 2. Configure Stripe Webhook

1. In Stripe Dashboard, go to Developers > Webhooks
2. Add an endpoint with your webhook URL:
   - For production: `https://your-domain.com/api/webhooks/stripe`
   - For local development, use Stripe CLI (see step 4 below in Getting Started).
3. Select events to listen for:
   - `product.created`, `product.updated`, `product.deleted`
   - `price.created`, `price.updated`, `price.deleted`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `checkout.session.completed` (Crucial for both subscriptions and one-time credit purchases)
   - `invoice.paid`, `invoice.payment_succeeded` (Important for subscription renewals)
4. After creating the endpoint, get your **Webhook Signing Secret** and add it to your `.env.local` file as `STRIPE_WEBHOOK_SECRET`.

### 3. Update Price IDs in Config

Open `src/lib/config/pricing.ts` and update the `STRIPE_PRICE_IDS` and `CREDIT_PACKS` with your actual Stripe Price IDs from step 1.

```typescript
// src/lib/config/pricing.ts
export interface PricingTier {
  id: 'free' | 'pro' | 'business';
  name: string;
  description: string;
  features: string[];
  popular: boolean;
  credits: number; // Added credits field
  // Each tier can have monthly and yearly pricing options
  pricing: {
    monthly: {
      priceId: string | null; // Stripe Price ID
      amount: number | null;  // Amount in cents
    };
    yearly: {
      priceId: string | null; // Stripe Price ID
      amount: number | null;  // Amount in cents
      discount?: number;      // Optional percentage discount compared to monthly
    };
  };
}

// Read price IDs from environment variables
export const STRIPE_PRICE_IDS = {
  PRO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || '',
  PRO_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || '',
  BUSINESS_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY || '',
  BUSINESS_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY || '',
  // Credit pack price IDs
  CREDIT_PACK_1000: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDIT_PACK_1000 || '',
  CREDIT_PACK_2500: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDIT_PACK_2500 || '',
  CREDIT_PACK_5000: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDIT_PACK_5000 || '',
};

// Define credit packs for purchase
export const CREDIT_PACKS = [
  {
    id: 'credits-1000',
    name: '1000 Credits',
    description: 'Top up with a small credit pack',
    amount: 1000, // Number of credits
    price: 1000, // Price in cents ($10.00)
    priceId: STRIPE_PRICE_IDS.CREDIT_PACK_1000,
  },
  // ... other credit packs
];

// Check if price IDs are configured
const isPricingConfigured = () => {
  return (
    STRIPE_PRICE_IDS.PRO_MONTHLY &&
    STRIPE_PRICE_IDS.PRO_YEARLY &&
    STRIPE_PRICE_IDS.BUSINESS_MONTHLY &&
    STRIPE_PRICE_IDS.BUSINESS_YEARLY
  );
};

// Show warning if price IDs are not configured in production
if (process.env.NODE_ENV === 'production' && !isPricingConfigured()) {
  console.warn('Warning: Stripe price IDs are not configured in environment variables.');
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Essential features for individuals',
    credits: 500, // 500 credits for free tier
    features: [
      'Basic dashboard access',
      'Limited access to features',
      'Community support',
      '500 credits per month',
    ],
    popular: false,
    pricing: {
      monthly: {
        priceId: null,
        amount: null,
      },
      yearly: {
        priceId: null,
        amount: null,
      },
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Perfect for professionals',
    credits: 3000, // 3000 credits for pro tier
    features: [
      'Everything in Free',
      'Advanced features',
      'Priority support',
      'Extended usage limits',
      '3000 credits per month',
    ],
    popular: true,
    pricing: {
      monthly: {
        priceId: STRIPE_PRICE_IDS.PRO_MONTHLY || null,
        amount: 2900, // $29/month
      },
      yearly: {
        priceId: STRIPE_PRICE_IDS.PRO_YEARLY || null,
        amount: 29000, // $290/year
        discount: 16,  // 16% discount compared to monthly
      },
    },
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For teams and organizations',
    credits: 6000, // 6000 credits for business tier
    features: [
      'Everything in Pro',
      'Advanced features', // Updated from 'Everything in Pro' for clarity
      'Dedicated support',
      'Custom integrations',
      'Team management',
      '6000 credits per month',
    ],
    popular: false, // Changed to false as Pro is marked popular
    pricing: {
      monthly: {
        priceId: STRIPE_PRICE_IDS.BUSINESS_MONTHLY || null,
        amount: 5900, // $59/month
      },
      yearly: {
        priceId: STRIPE_PRICE_IDS.BUSINESS_YEARLY || null,
        amount: 59000, // $590/year
        discount: 16,  // 16% discount compared to monthly
      },
    },
  },
];


// Helper function to get a tier by ID
export function getTierById(id: string): PricingTier | undefined {
  return PRICING_TIERS.find(tier => tier.id === id);
}

// Build a mapping of price IDs to tier information for easy lookup
export type PriceIdInfo = {
  tierId: 'free' | 'pro' | 'business';
  interval: 'monthly' | 'yearly';
};

// Create a map of price IDs to tier info
export const PRICE_ID_MAP: Record<string, PriceIdInfo> = {};

// Populate the price ID map
PRICING_TIERS.forEach(tier => {
  // Add monthly price ID if exists
  if (tier.pricing.monthly.priceId) {
    PRICE_ID_MAP[tier.pricing.monthly.priceId] = {
      tierId: tier.id as 'free' | 'pro' | 'business',
      interval: 'monthly'
    };
  }

  // Add yearly price ID if exists
  if (tier.pricing.yearly.priceId) {
    PRICE_ID_MAP[tier.pricing.yearly.priceId] = {
      tierId: tier.id as 'free' | 'pro' | 'business',
      interval: 'yearly'
    };
  }
});

// Helper function to get tier info from a price ID
export function getTierByPriceId(priceId: string | null | undefined): { 
  tier: PricingTier | undefined, 
  interval: 'monthly' | 'yearly' | undefined 
} {
  if (!priceId) {
    // Default to free tier with no interval
    const freeTier = getTierById('free');
    return { tier: freeTier, interval: undefined };
  }

  const priceInfo = PRICE_ID_MAP[priceId];

  if (!priceInfo) {
    // Price ID not found in our configuration
    return { tier: undefined, interval: undefined };
  }

  const tier = getTierById(priceInfo.tierId);

  return { 
    tier,
    interval: priceInfo.interval
  };
}
```

2. Ensure you update the `STRIPE_PRICE_IDS` in the same file with your actual Stripe price IDs.

3. The pricing page itself is in `src/app/(marketing)/pricing/page.tsx` and uses the client component `PricingClient` which you can customize.

### Modifying the Dashboard

Edit `src/app/(app)/dashboard/page.tsx` and the components within `src/components/dashboard` (`media-generation-form.tsx`, `media-library.tsx`) to change the dashboard layout, add new cards, or modify existing components. These files have been significantly updated in the previous steps to match the glassmorphic theme.

### Modifying the Account Page

Edit `src/app/(app)/account/page.tsx` and the components within `src/components/account` (`update-profile-form.tsx`, `manage-subscription-button.tsx`, `credit-pack-card.tsx`) to change the account page layout and styling. These files have been significantly updated in the previous steps to match the glassmorphic theme.

</details>

<details>
<summary>Credit System</summary>

This project includes a robust credit system that allows users to consume credits for various AI generation actions. Each subscription tier includes a monthly allocation of credits, and users can purchase additional credit packs.

### How the Credit System Works

- **Tier-Based Credits**: Each subscription tier (free, pro, business) comes with a monthly allocation of credits defined in `src/lib/config/pricing.ts`.
- **Credit Refresh**: Subscription credits are automatically refreshed to the tier's allocation amount when a subscription becomes `active` or `trialing`, or when it renews (handled by the Stripe webhook).
- **Two Credit Types**:
  - **Subscription Credits**: Reset monthly based on the user's subscription tier.
  - **Purchased Credits**: Never expire and accumulate as users buy credit packs.
- **Credit Usage**: When users consume credits (e.g., generating an image), the system first uses `subscription_credits` before using `purchased_credits`. Usage is recorded in the `credit_usage` table.

### Setting Up the Credit System

Setup involves adding fields and tables to your database schema (covered in [Database Schema Setup](#database-schema-setup)) and configuring credit amounts in `src/lib/config/pricing.ts` (covered in [Update Price IDs in Config](#update-price-ids-in-config)).

### Using the Credit System

- **Displaying Credits**: The user's total credits are displayed in the navigation bar using the `CreditsDisplay` component (`src/components/shared/credits-display.tsx`). The total shown combines both subscription and purchased credits.
- **Managing Credits**: The account page (`src/app/(app)/account/page.tsx`) includes a dedicated credits section where users can view their balances and recent usage.
- **Purchasing Credits**: Users can purchase additional credit packs from the account page. This triggers a Stripe one-time payment checkout session. The Stripe webhook handles adding the purchased credits to the user's `purchased_credits` balance upon successful payment (`src/app/api/webhooks/stripe/route.ts`).
- **Programmatically Using Credits**: The `useCredits` function in `src/lib/credits.ts` is used by server actions (like `generateMedia`) to deduct credits from the user's balance and record the usage.

```typescript
// Example of using credits in a server action
import { useCredits } from '@/lib/credits';

export async function myServerAction() {
  const userId = '...'; // Get the user ID (e.g., from auth.getUser())
  const amount = 50; // Number of credits to use
  const description = 'Generated AI image'; // What the credits were used for

  // Attempt to use credits
  const success = await useCredits(userId, amount, description);

  if (success) {
    // Credits were successfully used, perform the action (e.g., trigger AI generation)
    console.log("Credits used successfully!");
    return { success: true };
  } else {
    // Not enough credits
    console.error("Not enough credits!");
    return { error: 'Not enough credits' };
  }
}
```

### Troubleshooting the Credit System

If users report issues with credits not being added after purchase or not resetting:

1. **Check Stripe Webhooks**: Ensure the webhook endpoint is correctly set up in Stripe and receiving events (especially `checkout.session.completed` for credit packs and `customer.subscription.updated`, `invoice.paid` for subscription renewals).
2. **Verify Webhook Signatures**: Make sure your `STRIPE_WEBHOOK_SECRET` environment variable is correct and matches the secret in your Stripe webhook settings.
3. **Check Supabase Function Logs**: The `generate-media-handler` function logs errors related to credit deduction. Check the Supabase Function logs for issues.
4. **Check Stripe Webhook Logs**: The Stripe dashboard provides logs for each webhook delivery attempt, showing the request, response, and any errors.
5. **Check Supabase Database Logs**: Monitor your Supabase database logs for errors during credit updates (`public.users` table) or purchase/usage inserts (`public.credit_purchases`, `public.credit_usage`).
6. **Manually Add Credits**: If needed for testing or support, you can manually add credits using the Supabase SQL Editor:

   ```sql
   -- Add 1000 purchased credits to a specific user
   UPDATE public.users
   SET purchased_credits = purchased_credits + 1000
   WHERE id = 'user-uuid-here';

   -- Reset subscription credits for a specific user to their tier's amount (e.g., Pro tier = 3000)
   UPDATE public.users
   SET subscription_credits = 3000, -- Replace 3000 with the correct tier amount
       last_credits_reset_date = timezone('utc'::text, now())
   WHERE id = 'user-uuid-here';
   ```

</details>


<details>
<summary>Adding Pixio API Deployments and Modalities</summary>

The application supports generating different types of media (modalities) using ComfyUI workflows deployed via the Pixio API. This section explains how to add new modalities or update existing ones.

### Understanding Deployments and Modalities

- **Deployment**: A specific ComfyUI workflow hosted on Pixio API with a unique ID.
- **Modality**: A type of media that can be generated (e.g., image, video, audio, 3D model).
- **Credit Cost**: Each modality costs a different amount of credits to generate, based on the computational resources required.

### Setting Up New ComfyUI Workflows

1. **Create a ComfyUI Workflow**:
   - Design your workflow for the specific generation task (e.g., a new image model, a different video technique, an audio generation workflow).
   - Test thoroughly in ComfyUI to ensure it produces the expected output files and format.

2. **Deploy to Pixio API**:
   - Sign in to your [Pixio API account](https://api.myapps.ai/).
   - Upload or create your workflow deployment.
   - Note the **Deployment ID** assigned to your workflow. This ID is used to trigger the workflow via the API.

3. **Update Application Configuration**:
   - Add the new Deployment ID to the `DEPLOYMENT_IDS` object in `src/lib/constants/media.ts`.
   - Define the `CREDIT_COSTS` for the new modality in the same file.

```typescript
// src/lib/constants/media.ts

export const DEPLOYMENT_IDS = {
    image: '8f96cb86-5cbb-4ad0-9837-8a79eeb5103a', // Your Image Deployment ID
    video: 'd07cf1d5-412c-4270-b925-ffd6416abd1c',  // Your Video Deployment ID
    // Add your new deployment ID here:
    // audio: 'your-new-audio-deployment-id',
    // three_d: 'your-new-3d-deployment-id',
  } as const;
  
  export const CREDIT_COSTS = {
    image: 10,
    video: 100,
    // Define the credit cost for your new modality:
    // audio: 50,
    // three_d: 150,
  } as const;
  
  // Update the MEDIA_TYPES tuple to include your new modality
  export const MEDIA_TYPES = ['image', 'video'] as const; // Add 'audio', 'three_d', etc.
  
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
```

### Adding a New Modality (Frontend & Backend)

To fully integrate a new modality (e.g., 'audio'):

1.  **Update `src/lib/constants/media.ts`**: Add the new modality to `DEPLOYMENT_IDS`, `CREDIT_COSTS`, and `MEDIA_TYPES` as shown above.
2.  **Update Database Schema**: Modify the `generated_media` table's `media_type` CHECK constraint to include the new type.

    ```sql
    -- Update the check constraint for media_type
    ALTER TABLE public.generated_media 
    DROP CONSTRAINT generated_media_media_type_check,
    ADD CONSTRAINT generated_media_media_type_check 
    CHECK (media_type IN ('image', 'video', 'audio')); -- Add 'audio' and any other new types
    ```
3.  **Update Supabase Edge Function**: Ensure your `generate-media-handler` function can handle the new `mediaType`. You might need to adjust the `fileExtension` and `contentType` logic based on the output format of your new workflow.

    ```typescript
    // Inside supabase/functions/generate-media-handler/index.ts
    import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
    import { corsHeaders } from '../_shared/cors.ts'; // Assuming you have a _shared folder with cors.ts

    // Define your Pixio API Deployment IDs here
    const DEPLOYMENT_IDS = {
      image: '8f96cb86-5cbb-4ad0-9837-8a79eeb5103a', // Replace with your Image Deployment ID
      video: 'd07cf1d5-412c-4270-b925-ffd6416abd1c'  // Replace with your Video Deployment ID
      // Add other modalities here
    };

    // Utility to delay execution
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    serve(async (req) => {
      // Handle CORS preflight request
      if (req.method === 'OPTIONS') {
        return new Response('ok', {
          headers: corsHeaders,
        });
      }

      let mediaId = null; // Keep track of mediaId for error handling

      try {
        // --- Authentication & Input Validation ---
        // Create a Supabase client with the user's JWT to check authentication
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: {
              headers: { Authorization: req.headers.get('Authorization') },
            },
          }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
          console.error('Auth error:', authError);
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 401,
            }
          );
        }
        const userId = user.id;

        const body = await req.json();
        const { prompt, mediaType } = body;
        mediaId = body.mediaId; // Assign mediaId here

        if (!prompt || !mediaType || !mediaId || !Object.keys(DEPLOYMENT_IDS).includes(mediaType)) {
          return new Response(
            JSON.stringify({ error: 'Missing or invalid parameters' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }
        console.log(`Function received: userId=${userId}, mediaId=${mediaId}, type=${mediaType}`);

        // Create a Supabase client with the Service Role Key for admin operations (e.g., updating DB status, Storage)
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // --- Update Status to Processing ---
        // Ensure record exists and belongs to the user before proceeding
        const { error: initialUpdateError } = await supabaseAdmin
          .from('generated_media')
          .update({ status: 'processing' })
          .eq('id', mediaId)
          .eq('user_id', userId); // Ensure we only update the correct user's record

        if (initialUpdateError) {
          console.error(`Error updating initial status for mediaId ${mediaId}:`, initialUpdateError);
          // This is critical, the record might not exist or belong to the user
          throw new Error(`Failed to set initial processing status: ${initialUpdateError.message}`);
        }
        console.log(`Media record ${mediaId} status set to processing.`);


        // --- Trigger ComfyUI API ---
        const deploymentId = DEPLOYMENT_IDS[mediaType];
        const comfyApiKey = Deno.env.get('COMFY_DEPLOY_API_KEY');

        if (!comfyApiKey) {
          throw new Error("COMFY_DEPLOY_API_KEY environment variable not set.");
        }

        const triggerResponse = await fetch("https://api.myapps.ai/api/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${comfyApiKey}`,
          },
          body: JSON.stringify({
            deployment_id: deploymentId,
            inputs: {
              "prompt": prompt,
              // Add other inputs required by your workflow here
            },
          }),
        });

        if (!triggerResponse.ok) {
          const errorBody = await triggerResponse.text();
          console.error(`ComfyUI trigger failed: ${triggerResponse.status} ${triggerResponse.statusText}`, errorBody);
          throw new Error(`ComfyUI trigger failed: ${triggerResponse.statusText}`);
        }

        const triggerResult = await triggerResponse.json();
        const run_id = triggerResult.run_id;

        if (!run_id) {
          throw new Error('ComfyUI did not return a run_id');
        }
        console.log(`ComfyUI run started: ${run_id}`);

        // Update DB with run_id and set status to processing (again, for safety)
        const { error: runIdUpdateError } = await supabaseAdmin
          .from('generated_media')
          .update({
            status: 'processing', // Ensure status is 'processing'
            metadata: { run_id: run_id } // Store the run_id
          })
          .eq('id', mediaId);

        if (runIdUpdateError) {
          console.error(`Error updating record ${mediaId} with run_id ${run_id}:`, runIdUpdateError);
          // Continue processing, but log the error
        }


        // --- Polling for Result ---
        let currentStatus = 'processing'; // Start polling with the expected initial status
        let finalOutput = null;
        const maxAttempts = 90; // ~15 minutes timeout (90 * 10s)
        let attempts = 0;
        let consecutiveApiErrors = 0;
        const maxConsecutiveApiErrors = 10; // Give up polling if API fails 10 times in a row

        while (['processing', 'not-started', 'running', 'uploading', 'queued'].includes(currentStatus) && attempts < maxAttempts) {
          attempts++;
          console.log(`Polling attempt ${attempts}/${maxAttempts} for run ${run_id}. Current status: ${currentStatus}`);
          await delay(10000); // Wait 10 seconds between polls

          try {
            const statusResponse = await fetch(`https://api.myapps.ai/api/run?run_id=${run_id}`, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${comfyApiKey}`,
              },
            });

            if (!statusResponse.ok) {
              consecutiveApiErrors++;
              console.error(`Polling API failed (attempt ${attempts}, consecutive errors ${consecutiveApiErrors}): ${statusResponse.status} ${statusResponse.statusText}`);
              if (consecutiveApiErrors >= maxConsecutiveApiErrors) {
                currentStatus = 'failed'; // Mark as failed if API is consistently unavailable
                finalOutput = { error: `Polling API failed ${maxConsecutiveApiErrors} consecutive times.` };
                break; // Exit loop
              }
              continue; // Skip to next attempt if within error threshold
            }

            // Reset consecutive error count on success
            consecutiveApiErrors = 0;

            finalOutput = await statusResponse.json();
            currentStatus = finalOutput.status || 'unknown'; // Default to 'unknown' if status is missing
            console.log(`Status received for run ${run_id}: ${currentStatus}`);

            // Exit loop immediately if successful or failed
            if (currentStatus === 'success' || currentStatus === 'complete' || currentStatus === 'failed') {
              break;
            }

          } catch (pollError: any) {
            consecutiveApiErrors++;
            console.error(`Network error during polling attempt ${attempts} (consecutive errors ${consecutiveApiErrors}):`, pollError.message);
            if (consecutiveApiErrors >= maxConsecutiveApiErrors) {
              currentStatus = 'failed'; // Mark as failed after too many network errors
              finalOutput = { error: `Polling network error ${maxConsecutiveApiErrors} consecutive times: ${pollError.message}` };
              break; // Exit loop
            }
            // Continue polling if within error threshold
          }
        } // End of while loop

        // --- Handle Final Status ---
        console.log(`Polling finished after ${attempts} attempts. Final status: ${currentStatus}`);

        if (currentStatus === 'success' || currentStatus === 'complete') {
          // Check if output files exist in the response
          if (!finalOutput?.outputs || finalOutput.outputs.length === 0 || !finalOutput.outputs[0].url) {
             console.error(`ComfyUI run ${run_id} reported success but no output URL found.`);
             currentStatus = 'failed'; // Treat as failed if no output URL
             finalOutput = { error: 'Generation reported success but no output file was produced.' };
          }
        }


        if (currentStatus === 'success' || currentStatus === 'complete') {
          // Assuming the first output is the main media file
          const remoteMediaUrl = finalOutput.outputs[0].url;
          let fileExtension;
          let contentType;

          // Determine file extension and content type based on media type
          switch(mediaType) {
              case 'image':
                  fileExtension = '.png'; // Or whatever your workflow outputs
                  contentType = 'image/png';
                  break;
              case 'video':
                  fileExtension = '.webp'; // Or '.mp4', etc.
                  contentType = 'video/webm'; // Or 'video/mp4'
                  break;
              case 'audio':
                  fileExtension = '.mp3'; // Or '.wav', etc.
                  contentType = 'audio/mpeg'; // Or 'audio/wav'
                  break;
              // Add cases for your new modalities
              default:
                  fileExtension = '.bin';
                  contentType = 'application/octet-stream';
          }


          console.log(`Downloading generated ${mediaRecord.media_type} from: ${remoteMediaUrl}`);

          // Download the media from Pixio's CDN
          const mediaResponse = await fetch(remoteMediaUrl, {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache', // Ensure fresh download
              'Pragma': 'no-cache'
            }
          });

          if (!mediaResponse.ok) {
            console.error(`Failed to download media: ${mediaResponse.status} ${mediaResponse.statusText}`);
            throw new Error(`Failed to download media: ${mediaResponse.statusText}`);
          }

          const mediaBuffer = await mediaResponse.arrayBuffer();
          const contentSize = mediaBuffer.byteLength;
          console.log(`Downloaded media size: ${(contentSize / 1024).toFixed(2)} KB`);

          if (contentSize === 0) {
            throw new Error('Downloaded file is empty');
          }

          // Generate a unique filename and storage path
          const timestamp = Date.now();
          const fileName = `${timestamp}-${mediaId.substring(0, 8)}${fileExtension}`;
          const storagePath = `${userId}/${mediaType}s/${fileName}`; // e.g., user_id/images/timestamp-id.png

          console.log(`Uploading to Supabase storage path: ${storagePath}`);


          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from('generated-media') // Your storage bucket name
            .upload(storagePath, mediaBuffer, {
              contentType,
              upsert: true, // Overwrite if a file with the same name exists (less likely with timestamp)
              cacheControl: '3600' // Cache for 1 hour
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error(`Storage upload error: ${uploadError.message}`);
          }
          console.log(`Successfully uploaded to storage: ${uploadData?.path}`);

          // Get public URL
          const { data: publicUrlData } = supabaseAdmin
            .storage
            .from('generated-media') // Your storage bucket name
            .getPublicUrl(storagePath);

          // Update the media record in the database with final status, URL, and path
          const { error: finalUpdateError } = await supabaseAdmin
            .from('generated_media')
            .update({
              status: 'completed',
              media_url: publicUrlData.publicUrl,
              storage_path: storagePath,
              metadata: {
                ...finalOutput?.metadata || {}, // Keep existing metadata
                run_id,
                original_url: remoteMediaUrl, // Store the original Pixio API URL
                file_size: mediaBuffer.byteLength,
                completed_at: new Date().toISOString(),
              }
            })
            .eq('id', mediaId); // Update the specific record

          if (finalUpdateError) {
            console.error(`Failed to update final record ${mediaId}:`, finalUpdateError);
            // Log error but function technically succeeded in generating and uploading
          } else {
            console.log(`Media ${mediaId} completed successfully and record updated.`);
          }

        } else {
          // Generation failed or timed out
          const errorMessage = currentStatus === 'failed' ? finalOutput?.error || 'Generation failed' : attempts >= maxAttempts ? 'Generation timed out' : `Generation stopped with unexpected status: ${currentStatus}`;
          console.error(`Generation failed or timed out for run ${run_id}: ${errorMessage}`);

          // Update the record to mark as failed
          const { error: failUpdateError } = await supabaseAdmin
            .from('generated_media')
            .update({
              status: 'failed',
              metadata: {
                ...finalOutput?.metadata || {}, // Keep existing metadata
                run_id,
                error: errorMessage,
                final_api_status: currentStatus,
                failed_at: new Date().toISOString(),
              }
            })
            .eq('id', mediaId); // Update the specific record

          if (failUpdateError) {
            console.error(`Failed to update record ${mediaId} to failed status:`, failUpdateError);
          } else {
             console.log(`Media ${mediaId} marked as failed.`);
          }
        }

        // --- Return Success (Function execution completed, background task finished) ---
        // The function returns success if it finished processing the request,
        // regardless of whether the generation itself succeeded or failed.
        return new Response(
          JSON.stringify({ success: true, finalStatus: currentStatus }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );

      } catch (error: any) {
        console.error('Supabase Function Error:', error.message);

        // Attempt to update DB record to failed if possible and mediaId is known
        if (mediaId) {
          try {
            const supabaseAdmin = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );
            await supabaseAdmin
              .from('generated_media')
              .update({
                status: 'failed',
                metadata: { error: `Function error: ${error.message}` },
              })
              .eq('id', mediaId);
              console.log(`Media ${mediaId} status updated to failed due to function error.`);
          } catch (updateError) {
            console.error(`Failed to update status to failed on error for mediaId ${mediaId}:`, updateError);
          }
        }

        return new Response(
          JSON.stringify({ error: error.message }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }
    });
    ```

</details>

<details>
<summary>Styling the App</summary>

This project uses [Tailwind CSS](https://tailwindcss.com/) for utility-first styling and a custom theme defined using CSS variables in `src/app/globals.css`.

### Tailwind CSS

Tailwind classes are used directly in JSX components (`className` prop) to apply styles. The `tailwind.config.ts` file extends the default Tailwind theme with custom colors (using OKLCH for perceptual uniformity), border radii, and keyframes for animations.

Key styling concepts used:

- **Utility Classes:** Classes like `flex`, `grid`, `p-4`, `text-lg`, `font-bold`, `bg-primary`, `text-white`, `rounded-md`, `shadow-lg`, `transition`, `duration-300`, `hover:opacity-90`, `dark:bg-black/50`, `backdrop-blur-md`.
- **Custom Colors:** Defined in `tailwind.config.ts` and used via classes like `bg-primary`, `text-secondary`, `border-accent/20`.
- **Custom Utility Classes:** Defined in `src/app/globals.css` using `@layer components` for reusable styles like `glass-card`, `glass-input`, `glass-button`.
- **CSS Variables:** Used in `src/app/globals.css` (`:root`, `.dark`) to define the color palette and other theme values, which are then referenced by Tailwind classes or direct CSS. This allows for easy theme switching (light/dark mode).
- **Animations:** Custom keyframes (`@keyframes`) and Tailwind animation classes (`animation-*`) are defined in `tailwind.config.ts` and used for subtle effects like floating elements, gradient movement, and pulse.

**Example Custom Component Class (`.glass-card`)**:

```css
/* src/app/globals.css */
@layer components {
  .glass-card {
    @apply rounded-xl bg-white/20 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg hover:shadow-xl transition-shadow;
  }
  /* ... other custom classes ... */
}
```
This allows you to apply a complex, consistent style across multiple elements simply by adding the `glass-card` class.

By modifying `tailwind.config.ts` and `src/app/globals.css`, you can easily adjust the visual appearance of the entire application, update the color palette, change border styles, or add new reusable components and animations.

</details>

<details>
<summary>Deployment</summary>

### Deploying to Vercel

1. Push your code to a GitHub repository.
2. Sign up for [Vercel](https://vercel.com) and import your repository.
3. Set the environment variables in the Vercel dashboard. **Make sure to set ALL variables from your `.env.local`, including the Stripe price IDs and the Pixio API Key.**
4. Deploy the project.

After deployment, update your Supabase and Stripe configurations with your production URL:
1. Update the Site URL and redirect URLs in Supabase Auth settings.
2. Update the webhook endpoint URL in Stripe.
3. Update the `NEXT_PUBLIC_SITE_URL` environment variable in Vercel to your production domain.

</details>

<details>
<summary>Acknowledgments</summary>

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.io/)
- [Stripe](https://stripe.com/)
- [Shadcn UI](https://ui.shadcn.com/)
- [ComfyUI](https://comfyui.com/)
- [Pixio API](https://api.myapps.ai/)
- [Framer Motion](https://www.framer.com/motion/)

</details>
