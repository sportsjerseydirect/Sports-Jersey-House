import {
  isShopifyReadAllowed,
  parseShopifyConfig,
  testShopifyConnection
} from "../index";

async function main(): Promise<void> {
  const config = parseShopifyConfig(process.env);

  const gates = {
    syncEnabled: config.enableShopifySync === true,
    sampleEnabled: config.enableShopifySampleImport === true,
    readAllowed: isShopifyReadAllowed(config),
    credentialsConfigured: Boolean(
      config.storeDomain && config.clientId && config.clientSecret
    ),
    usesClientCredentialsOnly: true
  };

  console.log(JSON.stringify({ gates }, null, 2));

  if (config.enableShopifySync) {
    console.error("ABORT: ENABLE_SHOPIFY_SYNC must remain false");
    process.exitCode = 2;
    return;
  }

  if (!config.enableShopifySampleImport) {
    console.error("ABORT: ENABLE_SHOPIFY_SAMPLE_IMPORT is not true");
    process.exitCode = 2;
    return;
  }

  const result = await testShopifyConnection(config);
  console.log(JSON.stringify({ connection: result }, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Connection test failed.");
  process.exitCode = 1;
});
