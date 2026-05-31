import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const RC_ENTITLEMENT_PRO = "pro";
export const RC_ENTITLEMENT_PREMIUM = "premium";
export const RC_OFFERING_PRO = "pro";
export const RC_OFFERING_PREMIUM = "premium";

function getRevenueCatApiKey(): string {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error("RevenueCat Public API Keys not found");
  }
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY;
  }
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
}

export type ActiveTier = "free" | "pro" | "premium";

function deriveActiveTier(entitlements: Record<string, unknown>): ActiveTier {
  if (entitlements[RC_ENTITLEMENT_PREMIUM] !== undefined) return "premium";
  if (entitlements[RC_ENTITLEMENT_PRO] !== undefined) return "pro";
  return "free";
}

function useSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: () => Purchases.getCustomerInfo(),
    staleTime: 60_000,
  });

  const proOfferingQuery = useQuery({
    queryKey: ["revenuecat", "offering", "pro"],
    queryFn: async () => {
      const all = await Purchases.getOfferings();
      return all.all[RC_OFFERING_PRO] ?? null;
    },
    staleTime: 300_000,
  });

  const premiumOfferingQuery = useQuery({
    queryKey: ["revenuecat", "offering", "premium"],
    queryFn: async () => {
      const all = await Purchases.getOfferings();
      return all.all[RC_OFFERING_PREMIUM] ?? null;
    },
    staleTime: 300_000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const activeEntitlements = customerInfoQuery.data?.entitlements.active ?? {};
  const activeTier: ActiveTier = deriveActiveTier(activeEntitlements);

  return {
    customerInfo: customerInfoQuery.data,
    proOffering: proOfferingQuery.data,
    premiumOffering: premiumOfferingQuery.data,
    activeTier,
    isLoading: customerInfoQuery.isLoading || proOfferingQuery.isLoading || premiumOfferingQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetchCustomerInfo: customerInfoQuery.refetch,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
