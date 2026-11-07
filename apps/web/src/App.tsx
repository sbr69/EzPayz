import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { Providers } from "@/providers";
import { RealCheckout } from "@/features/checkout/RealCheckout";
import { RealSubscriptionCheckout } from "@/features/checkout/RealSubscriptionCheckout";
import { PaymentLinkResolver } from "@/features/checkout/PaymentLinkResolver";
import { AppShell } from "@/components/layout/AppShell";
import { ToastHost } from "@/components/ui/Feedback";
import { MarketingLayout } from "@/features/marketing/MarketingLayout";
import Landing from "@/features/marketing/Landing";
import { BuildPage } from "@/features/marketing/BuildPage";
import { GaslessPage } from "@/features/marketing/GaslessPage";
import { ProductPage } from "@/features/marketing/ProductPage";
import { SecurityPage } from "@/features/marketing/SecurityPage";
import { ForgotPassword, SignIn, SignUp } from "@/features/auth/AuthPages";
import Onboarding from "@/features/onboarding/Onboarding";
import Dashboard from "@/features/dashboard/Dashboard";
import { PaymentDetail, PaymentsList } from "@/features/payments/PaymentPages";
import { PaymentLinkDetail, PaymentLinkForm, PaymentLinksList } from "@/features/payment-links/PaymentLinkPages";
import { InvoiceDetail, InvoiceForm, InvoicesList } from "@/features/invoices/InvoicePages";
import { CustomerDetail, CustomersList } from "@/features/customers/CustomerPages";
import { ProductDetail, ProductsList } from "@/features/products/ProductPages";
import { PlanForm, PlanList, PlansListPage } from "@/features/subscriptions/PlanPages";
import { SubscriptionDetail, SubscriptionsList } from "@/features/subscriptions/SubscriptionPages";
import { RefundDetail, RefundsList } from "@/features/refunds/RefundPages";
import { FulfilmentDetail, FulfilmentList } from "@/features/fulfilment/FulfilmentPages";
import { CustomerOrderView } from "@/features/fulfilment/CustomerOrderView";
import { ExceptionDetail, ExceptionsList } from "@/features/exceptions/ExceptionPages";
import Analytics from "@/features/analytics/Analytics";
import GasGuard from "@/features/gasguard/GasGuard";
import { ApiKeysPage, DeveloperOverview, EventsPage, WebhooksPage } from "@/features/developers/DeveloperPages";
import { X402Page } from "@/features/developers/x402/X402Page";
import { ApiReference, Quickstart } from "@/features/developers/DocsPages";
import {
  BusinessSettings,
  CheckoutSettings,
  GasSponsorshipSettings,
  NotificationSettings,
  SecuritySettings,
  WalletSettings,
} from "@/features/settings/SettingsPages";
import { ReceiptPage } from "@/features/checkout/Receipt";
import { CustomerSubscriptionPage } from "@/features/customer/CustomerSubscription";

/** Reset scroll on route change — marketing navigation is real routes now. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <Providers>
    <WalletProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/product" element={<ProductPage />} />
            <Route path="/gasless" element={<GaslessPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/build" element={<BuildPage />} />
          </Route>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Dashboard routes — auth guarded via AppShell (checks signedIn + JWT) */}
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/payments" element={<PaymentsList />} />
            <Route path="/payments/:id" element={<PaymentDetail />} />
            <Route path="/payment-links" element={<PaymentLinksList />} />
            <Route path="/payment-links/new" element={<PaymentLinkForm />} />
            <Route path="/payment-links/:id" element={<PaymentLinkDetail />} />
            <Route path="/invoices" element={<InvoicesList />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/customers" element={<CustomersList />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/products" element={<ProductsList />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/subscriptions" element={<SubscriptionsList />} />
            <Route path="/subscriptions/plans" element={<PlansListPage />} />
            <Route path="/subscriptions/plans/new" element={<PlanForm />} />
            <Route path="/subscriptions/plans/:id" element={<PlanList />} />
            <Route path="/subscriptions/:id" element={<SubscriptionDetail />} />
            <Route path="/refunds" element={<RefundsList />} />
            <Route path="/refunds/:id" element={<RefundDetail />} />
            <Route path="/fulfilment" element={<FulfilmentList />} />
            <Route path="/fulfilment/:id" element={<FulfilmentDetail />} />
            <Route path="/exceptions" element={<ExceptionsList />} />
            <Route path="/exceptions/:id" element={<ExceptionDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/gasguard" element={<GasGuard />} />
            <Route path="/developers" element={<DeveloperOverview />} />
            <Route path="/developers/api-keys" element={<ApiKeysPage />} />
            <Route path="/developers/webhooks" element={<WebhooksPage />} />
            <Route path="/developers/events" element={<EventsPage />} />
            <Route path="/developers/x402" element={<X402Page />} />
            <Route path="/developers/quickstart" element={<Quickstart />} />
            <Route path="/developers/api-reference" element={<ApiReference />} />
            <Route path="/settings/business" element={<BusinessSettings />} />
            <Route path="/settings/wallet" element={<WalletSettings />} />
            <Route path="/settings/checkout" element={<CheckoutSettings />} />
            <Route path="/settings/notifications" element={<NotificationSettings />} />
            <Route path="/settings/security" element={<SecuritySettings />} />
            <Route path="/settings/gas-sponsorship" element={<GasSponsorshipSettings />} />
          </Route>

          {/* Customer-facing experiences (standalone layout) */}
          {/* Legacy mock routes redirect to real ones */}
          <Route path="/checkout/:sessionId" element={<Navigate to="/sign-in" replace />} />
          <Route path="/subscribe/:planId" element={<Navigate to="/sign-in" replace />} />
          {/* Real customer-facing routes */}
          <Route path="/l/:slug" element={<PaymentLinkResolver />} />
          <Route path="/real-checkout/:slug" element={<RealCheckout />} />
          <Route path="/real-subscription-checkout/:slug" element={<RealSubscriptionCheckout />} />
          <Route path="/receipt/:id" element={<ReceiptPage />} />
          <Route path="/customer/subscriptions/:id" element={<CustomerSubscriptionPage />} />
          <Route path="/order/:id" element={<CustomerOrderView />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastHost />
      </BrowserRouter>
    </WalletProvider>
    </Providers>
  );
}

export default App;
