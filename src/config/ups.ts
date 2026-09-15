const UPS_ENV = process.env.UPS_ENV === "production" ? "production" : "sandbox";

export const UPS_BASE_URL =
  UPS_ENV === "production" ? "https://onlinetools.ups.com" : "https://wwwcie.ups.com";

export const UPS_CLIENT_ID = process.env.UPS_CLIENT_ID;
export const UPS_CLIENT_SECRET = process.env.UPS_CLIENT_SECRET;

// UPS shipper/account number ("6-character shipper number"), separate from the API client id/secret.
export const UPS_ACCOUNT_NUMBER = process.env.UPS_ACCOUNT_NUMBER;

// Origin address the package ships from (your warehouse), used on every rate request.
export const UPS_SHIPPER = {
  name: process.env.UPS_SHIPPER_NAME || "Hans Biomed USA",
  address1: process.env.UPS_SHIPPER_ADDRESS1 || "",
  address2: process.env.UPS_SHIPPER_ADDRESS2 || "",
  city: process.env.UPS_SHIPPER_CITY || "",
  state: process.env.UPS_SHIPPER_STATE || "",
  zip: process.env.UPS_SHIPPER_ZIP || "",
  country: process.env.UPS_SHIPPER_COUNTRY || "US",
  // Required by the Shipping API (label generation) even though the Rating API doesn't need it.
  phone: process.env.UPS_SHIPPER_PHONE || "",
};

// Fallback package weight (lbs) used when a product doesn't have weightLbs set.
export const UPS_DEFAULT_PACKAGE_WEIGHT_LBS = Number(process.env.UPS_DEFAULT_PACKAGE_WEIGHT_LBS) || 1;

export function isUpsConfigured(): boolean {
  return Boolean(
    UPS_CLIENT_ID &&
      UPS_CLIENT_SECRET &&
      UPS_SHIPPER.address1 &&
      UPS_SHIPPER.city &&
      UPS_SHIPPER.state &&
      UPS_SHIPPER.zip,
  );
}
