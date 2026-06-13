import React, { createContext, useContext, useEffect, useRef } from "react";
import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useUser } from "@clerk/expo";
import { customFetch } from "@workspace/api-client-react";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? "";
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";

export const RC_ENTITLEMENT_PRO = "pro";
export const RC_ENTITLEMENT_PREMIUM = "premium";
export const RC_OFFERING_PRO = "pro";
export const RC_OFFERING_PREMIUM = "premium";

function getRevenueCatApiKey(): string {
  // In development and Expo Go, use the sandbox test key.
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    if (!REVENUECAT_TEST_API_KEY) {
      throw new Error("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY is not set");
    }
    return REVENUECAT_TEST_API_KEY;
  }
  // In production native builds, use the platform-specific production key.
  if (Platform.OS === "ios") {
    if (!REVENUECAT_IOS_API_KEY) throw new Error("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is not set");
    return REVENUECAT_IOS_API_KEY;
  }
  if (Platform.OS === "android") {
    if (!REVENUECAT_ANDROID_API_KEY) throw new Error("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY is not set");
    return REVENUECAT_ANDROID_API_KEY;
  }
  throw new Error("Unsupported platform for RevenueCat");
}

const RC_LOG_LEVEL_MAP: Record<string, (typeof Purchases.LOG_LEVEL)[keyof typeof Purchases.LOG_LEVEL]> = {
  DEBUG: Purchases.LOG_LEVEL.DEBUG,
  INFO: Purchases.LOG_LEVEL.INFO,
  WARN: Purchases.LOG_LEVEL.WARN,
  ERROR: Purchases.LOG_LEVEL.ERROR,
};

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  const envLevel = process.env.EXPO_PUBLIC_RC_LOG_LEVEL?.toUpperCase();
  const logLevel =
    envLevel && envLevel in RC_LOG_LEVEL_MAP
      ? RC_LOG_LEVEL_MAP[envLevel]
      : __DEV__
        ? Purchases.LOG_LEVEL.DEBUG
        : Purchases.LOG_LEVEL.WARN;
  Purchases.setLogLevel(logLevel);
  Purchases.configure({ apiKey });
}

export type ActiveTier = "free" | "pro" | "premium";

function deriveActiveTier(entitlements: Record<string, unknown>): ActiveTier {
  if (entitlements[RC_ENTITLEMENT_PREMIUM] !== undefined) return "premium";
  if (entitlements[RC_ENTITLEMENT_PRO] !== undefined) return "pro";
  return "free";
}

async function callSyncTier(): Promise<{ tier: ActiveTier }> {
  return customFetch<{ tier: ActiveTier }>("/api/me/sync-tier", {
    method: "POST",
  });
}

function useSubscriptionContext() {
  const { user } = useUser();
  const userId = user?.id ?? null;

  // Track which userId we've already called logIn for to avoid re-running.
  const loggedInUserId = useRef<string | null>(null);

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

  const syncTierMutation = useMutation({
    mutationFn: callSyncTier,
  });

  // When a Clerk user becomes available, identify them in RevenueCat so
  // server-side entitlement lookups can use the Clerk user ID. Then sync
  // the verified tier into our DB (fire-and-forget — errors are swallowed
  // so they never block the UI).
  useEffect(() => {
    if (!userId) return;
    if (loggedInUserId.current === userId) return;

    loggedInUserId.current = userId;

    Purchases.logIn(userId)
      .then(() => syncTierMutation.mutate())
      .catch(() => {
        // logIn failures are non-fatal — RC still works with anonymous ID.
        // Attempt sync anyway in case the anonymous session already has
        // entitlements mapped.
        syncTierMutation.mutate();
      });
    // syncTierMutation is stable (useMutation ref is stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
    onSuccess: () => {
      customerInfoQuery.refetch();
      syncTierMutation.mutate();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: () => {
      customerInfoQuery.refetch();
      syncTierMutation.mutate();
    },
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
    syncTierWithServer: syncTierMutation.mutate,
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
