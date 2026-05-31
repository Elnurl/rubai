import { createClient } from "@replit/revenuecat-sdk/client";
import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "RubAI - AI Goal Coach";
const APP_STORE_APP_NAME = "RubAI iOS";
const APP_STORE_BUNDLE_ID = "com.elnur11.rubai";
const PLAY_STORE_APP_NAME = "RubAI Android";
const PLAY_STORE_PACKAGE_NAME = "com.elnur11.rubai";

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

interface PlanConfig {
  productIdentifier: string;
  playStoreIdentifier: string;
  displayName: string;
  title: string;
  duration: string;
  entitlementIdentifier: string;
  entitlementDisplayName: string;
  offeringIdentifier: string;
  offeringDisplayName: string;
  packageIdentifier: string;
  packageDisplayName: string;
  prices: { amount_micros: number; currency: string }[];
}

const PLANS: PlanConfig[] = [
  {
    productIdentifier: "rubai_pro_monthly",
    playStoreIdentifier: "rubai_pro_monthly:monthly",
    displayName: "RubAI Pro Monthly",
    title: "RubAI Pro",
    duration: "P1M",
    entitlementIdentifier: "pro",
    entitlementDisplayName: "Pro Access",
    offeringIdentifier: "pro",
    offeringDisplayName: "Pro Offering",
    packageIdentifier: "$rc_monthly",
    packageDisplayName: "Pro Monthly",
    prices: [
      { amount_micros: 9990000, currency: "USD" },
      { amount_micros: 8990000, currency: "EUR" },
    ],
  },
  {
    productIdentifier: "rubai_premium_monthly",
    playStoreIdentifier: "rubai_premium_monthly:monthly",
    displayName: "RubAI Premium Monthly",
    title: "RubAI Premium",
    duration: "P1M",
    entitlementIdentifier: "premium",
    entitlementDisplayName: "Premium Access",
    offeringIdentifier: "premium",
    offeringDisplayName: "Premium Offering",
    packageIdentifier: "$rc_monthly",
    packageDisplayName: "Premium Monthly",
    prices: [
      { amount_micros: 19990000, currency: "USD" },
      { amount_micros: 17990000, currency: "EUR" },
    ],
  },
];

async function seedRevenueCat() {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) throw new Error("REVENUECAT_API_KEY is not set");

  const client = createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects: " + JSON.stringify(listProjectsError));

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (error) throw new Error("Failed to create project: " + JSON.stringify(error));
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  let testStoreApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testStoreApp) throw new Error("No test store app found");
  console.log("Test store app:", testStoreApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: APP_STORE_APP_NAME, type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: PLAY_STORE_APP_NAME, type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app:", playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (targetApp: App, label: string, identifier: string, isTest: boolean, plan: PlanConfig): Promise<Product> => {
    const existing = existingProducts.items?.find((p) => p.store_identifier === identifier && p.app_id === targetApp.id);
    if (existing) {
      console.log(`${label} product already exists:`, existing.id);
      return existing;
    }
    const body: CreateProductData["body"] = {
      store_identifier: identifier,
      app_id: targetApp.id,
      type: "subscription",
      display_name: plan.displayName,
    };
    if (isTest) {
      body.subscription = { duration: plan.duration };
      body.title = plan.title;
    }
    const { data: created, error } = await createProduct({ client, path: { project_id: project.id }, body });
    if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
    console.log(`Created ${label} product:`, created.id);
    return created;
  };

  for (const plan of PLANS) {
    console.log(`\n--- Setting up plan: ${plan.displayName} ---`);

    const testProduct = await ensureProduct(testStoreApp, "Test Store", plan.productIdentifier, true, plan);
    const appProduct = await ensureProduct(appStoreApp, "App Store", plan.productIdentifier, false, plan);
    const playProduct = await ensureProduct(playStoreApp, "Play Store", plan.playStoreIdentifier, false, plan);

    const { data: _priceData, error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testProduct.id },
      body: { prices: plan.prices },
    });
    if (priceError) {
      if (typeof priceError === "object" && "type" in priceError && priceError["type"] === "resource_already_exists") {
        console.log("Test store prices already exist");
      } else {
        throw new Error("Failed to add test store prices: " + JSON.stringify(priceError));
      }
    } else {
      console.log("Added test store prices");
    }

    const { data: existingEntitlements, error: entErr } = await listEntitlements({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });
    if (entErr) throw new Error("Failed to list entitlements");

    let entitlement: Entitlement;
    const existingEnt = existingEntitlements.items?.find((e) => e.lookup_key === plan.entitlementIdentifier);
    if (existingEnt) {
      console.log("Entitlement already exists:", existingEnt.id);
      entitlement = existingEnt;
    } else {
      const { data: newEnt, error } = await createEntitlement({
        client,
        path: { project_id: project.id },
        body: { lookup_key: plan.entitlementIdentifier, display_name: plan.entitlementDisplayName },
      });
      if (error) throw new Error("Failed to create entitlement: " + JSON.stringify(error));
      console.log("Created entitlement:", newEnt.id);
      entitlement = newEnt;
    }

    const { error: attachEntErr } = await attachProductsToEntitlement({
      client,
      path: { project_id: project.id, entitlement_id: entitlement.id },
      body: { product_ids: [testProduct.id, appProduct.id, playProduct.id] },
    });
    if (attachEntErr) {
      if (attachEntErr.type === "unprocessable_entity_error") {
        console.log("Products already attached to entitlement");
      } else {
        throw new Error("Failed to attach products to entitlement: " + JSON.stringify(attachEntErr));
      }
    } else {
      console.log("Attached products to entitlement");
    }

    const { data: existingOfferings, error: offErr } = await listOfferings({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });
    if (offErr) throw new Error("Failed to list offerings");

    let offering: Offering;
    const existingOff = existingOfferings.items?.find((o) => o.lookup_key === plan.offeringIdentifier);
    if (existingOff) {
      console.log("Offering already exists:", existingOff.id);
      offering = existingOff;
    } else {
      const { data: newOff, error } = await createOffering({
        client,
        path: { project_id: project.id },
        body: { lookup_key: plan.offeringIdentifier, display_name: plan.offeringDisplayName },
      });
      if (error) throw new Error("Failed to create offering: " + JSON.stringify(error));
      console.log("Created offering:", newOff.id);
      offering = newOff;
    }

    if (!offering.is_current && plan.offeringIdentifier === "pro") {
      const { error } = await updateOffering({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { is_current: true },
      });
      if (error) throw new Error("Failed to set offering as current");
      console.log("Set pro offering as current");
    }

    const { data: existingPkgs, error: pkgErr } = await listPackages({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      query: { limit: 20 },
    });
    if (pkgErr) throw new Error("Failed to list packages");

    let pkg: Package;
    const existingPkg = existingPkgs.items?.find((p) => p.lookup_key === plan.packageIdentifier);
    if (existingPkg) {
      console.log("Package already exists:", existingPkg.id);
      pkg = existingPkg;
    } else {
      const { data: newPkg, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: plan.packageIdentifier, display_name: plan.packageDisplayName },
      });
      if (error) throw new Error("Failed to create package: " + JSON.stringify(error));
      console.log("Created package:", newPkg.id);
      pkg = newPkg;
    }

    const { error: attachPkgErr } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: testProduct.id, eligibility_criteria: "all" },
          { product_id: appProduct.id, eligibility_criteria: "all" },
          { product_id: playProduct.id, eligibility_criteria: "all" },
        ],
      },
    });
    if (attachPkgErr) {
      if (attachPkgErr.type === "unprocessable_entity_error") {
        console.log("Products already attached to package");
      } else {
        throw new Error("Failed to attach products to package: " + JSON.stringify(attachPkgErr));
      }
    } else {
      console.log("Attached products to package");
    }
  }

  const { data: testKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: testStoreApp.id } });
  const { data: appKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: appStoreApp.id } });
  const { data: playKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: playStoreApp.id } });

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log("Test Store App ID:", testStoreApp.id);
  console.log("App Store App ID:", appStoreApp.id);
  console.log("Play Store App ID:", playStoreApp.id);
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY:", testKeys?.items.map((k) => k.key).join(", ") ?? "N/A");
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:", appKeys?.items.map((k) => k.key).join(", ") ?? "N/A");
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:", playKeys?.items.map((k) => k.key).join(", ") ?? "N/A");
  console.log("REVENUECAT_PROJECT_ID:", project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID:", testStoreApp.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID:", appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID:", playStoreApp.id);
  console.log("====================\n");
}

seedRevenueCat().catch(console.error);
