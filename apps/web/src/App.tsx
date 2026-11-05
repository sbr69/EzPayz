import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { AppShell } from "@/components/layout/AppShell";
import { ToastHost } from "@/components/ui/Feedback";
import Landing from "@/features/marketing/Landing";
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
import { ApiReference, Quickstart } from "@/features/developers/DocsPages";
import {
  BusinessSettings,
  CheckoutSettings,
  GasSponsorshipSettings,
  NotificationSettings,
  SecuritySettings,
  WalletSettings,
} from "@/features/settings/SettingsPages";
import Checkout from "@/features/checkout/Checkout";
import SubscriptionCheckout from "@/features/checkout/SubscriptionCheckout";
import { ReceiptPage } from "@/features/checkout/Receipt";
import { CustomerSubscriptionPage } from "@/features/customer/CustomerSubscription";
import Roadmap from "@/features/roadmap/Roadmap";

export function App() {
  return (
    <WalletProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />

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
          <Route path="/checkout/:sessionId" element={<Checkout />} />
          <Route path="/l/:slug" element={<Checkout />} />
          <Route path="/subscribe/:planId" element={<SubscriptionCheckout />} />
          <Route path="/receipt/:id" element={<ReceiptPage />} />
          <Route path="/customer/subscriptions/:id" element={<CustomerSubscriptionPage />} />
          <Route path="/order/:id" element={<CustomerOrderView />} />
          <Route path="/roadmap" element={<Roadmap />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastHost />
      </HashRouter>
    </WalletProvider>
  );
}

export default App;
