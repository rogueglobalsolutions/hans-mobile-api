import {
  UPS_ACCOUNT_NUMBER,
  UPS_BASE_URL,
  UPS_CLIENT_ID,
  UPS_CLIENT_SECRET,
  UPS_SHIPPER,
  isUpsConfigured,
} from "../config/ups";
import { getCountries, getStatesOfCountry } from "@countrystatecity/countries";

// UPS OAuth 2.0 "Client Credentials" grant. The token is short-lived (a few
// hours) and shared across requests, so we cache it in memory instead of
// fetching a new one on every rate lookup.
let cachedToken: { value: string; expiresAt: number } | null = null;
const SHIPPING_API_VERSION = "v2409";

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  if (!UPS_CLIENT_ID || !UPS_CLIENT_SECRET) {
    throw new Error("UPS is not configured");
  }

  const basicAuth = Buffer.from(`${UPS_CLIENT_ID}:${UPS_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${UPS_BASE_URL}/security/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[ups.service] Failed to obtain access token:", response.status, text);
    throw new Error("Unable to reach UPS");
  }

  const data = (await response.json()) as { access_token: string; expires_in: string };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
  return cachedToken.value;
}

export interface ShippingAddress {
  address1: string;
  address2?: string | null;
  city: string;
  state: string;
  zipCode: string;
  country?: string | null;
}

async function normalizeDestinationAddress<T extends ShippingAddress>(destination: T) {
  const countryInput = (destination.country || "US").trim();
  const countries = await getCountries();
  const country = countries.find(
    (item) => item.iso2.toLowerCase() === countryInput.toLowerCase() ||
      item.name.toLowerCase() === countryInput.toLowerCase(),
  );
  if (!country) throw new Error("Shipping country is invalid");
  if (country.iso2 !== "US") throw new Error("UPS Ground shipping is currently limited to US addresses");

  const stateInput = destination.state.trim();
  const states = await getStatesOfCountry(country.iso2);
  const state = states.find(
    (item) => item.iso2.toLowerCase() === stateInput.toLowerCase() ||
      item.name.toLowerCase() === stateInput.toLowerCase(),
  );
  if (!state) throw new Error("Shipping state is invalid");

  return { ...destination, country: country.iso2, state: state.iso2 };
}

export interface RateQuote {
  serviceCode: string;
  serviceName: string;
  amountUsd: number;
  currency: string;
}

const GROUND_SERVICE_CODE = "03";

// Rating API - published (non-negotiated) rates for UPS Ground.
// Docs: https://developer.ups.com/api/reference?loc=en_US#operation/Rate
export async function getGroundRate(destination: ShippingAddress, weightLbs: number): Promise<RateQuote> {
  if (!isUpsConfigured()) {
    throw new Error("UPS is not configured");
  }

  const token = await getAccessToken();
  const normalizedDestination = await normalizeDestinationAddress(destination);
  const transactionId = `hans-${Date.now()}`;

  const requestBody = {
    RateRequest: {
      Request: {
        TransactionReference: { CustomerContext: transactionId },
      },
      Shipment: {
        Shipper: {
          Name: UPS_SHIPPER.name,
          ShipperNumber: UPS_ACCOUNT_NUMBER || undefined,
          Address: {
            AddressLine: [UPS_SHIPPER.address1, UPS_SHIPPER.address2].filter(Boolean),
            City: UPS_SHIPPER.city,
            StateProvinceCode: UPS_SHIPPER.state,
            PostalCode: UPS_SHIPPER.zip,
            CountryCode: UPS_SHIPPER.country,
          },
        },
        ShipFrom: {
          Name: UPS_SHIPPER.name,
          Address: {
            AddressLine: [UPS_SHIPPER.address1, UPS_SHIPPER.address2].filter(Boolean),
            City: UPS_SHIPPER.city,
            StateProvinceCode: UPS_SHIPPER.state,
            PostalCode: UPS_SHIPPER.zip,
            CountryCode: UPS_SHIPPER.country,
          },
        },
        ShipTo: {
          Address: {
            AddressLine: [normalizedDestination.address1, normalizedDestination.address2 || ""].filter(Boolean),
            City: normalizedDestination.city,
            StateProvinceCode: normalizedDestination.state,
            PostalCode: normalizedDestination.zipCode,
            CountryCode: normalizedDestination.country,
          },
        },
        Service: { Code: GROUND_SERVICE_CODE, Description: "Ground" },
        Package: {
          PackagingType: { Code: "02", Description: "Package" },
          PackageWeight: {
            UnitOfMeasurement: { Code: "LBS" },
            Weight: Math.max(weightLbs, 0.1).toFixed(1),
          },
        },
      },
    },
  };

  const response = await fetch(`${UPS_BASE_URL}/api/rating/v1/Rate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      transId: transactionId,
      transactionSrc: "hans-mobile",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[ups.service] Rate request failed:", response.status, text);
    throw new Error("Unable to calculate shipping cost");
  }

  const data = await response.json();
  const rated = data?.RateResponse?.RatedShipment;
  const shipment = Array.isArray(rated) ? rated[0] : rated;
  const charge = shipment?.TotalCharges;

  if (!charge?.MonetaryValue) {
    console.error("[ups.service] Unexpected rate response shape:", JSON.stringify(data));
    throw new Error("Unable to calculate shipping cost");
  }

  return {
    serviceCode: GROUND_SERVICE_CODE,
    serviceName: "UPS Ground",
    amountUsd: Number(charge.MonetaryValue),
    currency: charge.CurrencyCode || "USD",
  };
}

export interface ShipmentResult {
  trackingNumber: string;
  shipmentId: string;
  trackingUrl: string;
  serviceCode: string;
  serviceName: string;
  amountUsd: number | null;
  currency: string;
  labelFormat: string;
  labelBase64: string;
}

// Shipping API - creates a real UPS shipment and returns a tracking number +
// a printable label image. Requires a real UPS account/shipper number
// (UPS_ACCOUNT_NUMBER) that's registered to the shipper address - unlike the
// Rating API, UPS validates this strictly since it actually books the pickup.
// Docs: https://developer.ups.com/api/reference?loc=en_US#operation/Shipment
export async function createGroundShipment(
  destination: ShippingAddress & { name?: string; phone?: string },
  weightLbs: number,
): Promise<ShipmentResult> {
  if (!isUpsConfigured()) {
    throw new Error("UPS is not configured");
  }
  if (!UPS_ACCOUNT_NUMBER) {
    throw new Error("UPS account number is not configured");
  }
  if (!UPS_SHIPPER.phone) {
    throw new Error("UPS shipper phone is not configured");
  }

  const token = await getAccessToken();
  const normalizedDestination = await normalizeDestinationAddress(destination);
  const transactionId = `hans-${Date.now()}`;

  const requestBody = {
    ShipmentRequest: {
      Request: {
        RequestOption: "nonvalidate",
        TransactionReference: { CustomerContext: transactionId },
      },
      Shipment: {
        Description: "Product order",
        Shipper: {
          Name: UPS_SHIPPER.name,
          ShipperNumber: UPS_ACCOUNT_NUMBER,
          Phone: { Number: UPS_SHIPPER.phone },
          Address: {
            AddressLine: [UPS_SHIPPER.address1, UPS_SHIPPER.address2].filter(Boolean),
            City: UPS_SHIPPER.city,
            StateProvinceCode: UPS_SHIPPER.state,
            PostalCode: UPS_SHIPPER.zip,
            CountryCode: UPS_SHIPPER.country,
          },
        },
        ShipFrom: {
          Name: UPS_SHIPPER.name,
          Phone: { Number: UPS_SHIPPER.phone },
          Address: {
            AddressLine: [UPS_SHIPPER.address1, UPS_SHIPPER.address2].filter(Boolean),
            City: UPS_SHIPPER.city,
            StateProvinceCode: UPS_SHIPPER.state,
            PostalCode: UPS_SHIPPER.zip,
            CountryCode: UPS_SHIPPER.country,
          },
        },
        ShipTo: {
          Name: normalizedDestination.name || "Customer",
          Phone: normalizedDestination.phone ? { Number: normalizedDestination.phone } : undefined,
          Address: {
            AddressLine: [normalizedDestination.address1, normalizedDestination.address2 || ""].filter(Boolean),
            City: normalizedDestination.city,
            StateProvinceCode: normalizedDestination.state,
            PostalCode: normalizedDestination.zipCode,
            CountryCode: normalizedDestination.country,
          },
        },
        PaymentInformation: {
          ShipmentCharge: [
            {
              Type: "01",
              BillShipper: { AccountNumber: UPS_ACCOUNT_NUMBER },
            },
          ],
        },
        Service: { Code: GROUND_SERVICE_CODE, Description: "Ground" },
        Package: [
          {
            Packaging: { Code: "02", Description: "Package" },
            PackageWeight: {
              UnitOfMeasurement: { Code: "LBS" },
              Weight: Math.max(weightLbs, 0.1).toFixed(1),
            },
          },
        ],
      },
      LabelSpecification: {
        LabelImageFormat: { Code: "GIF", Description: "GIF" },
        LabelStockSize: { Height: "6", Width: "4" },
      },
    },
  };

  const response = await fetch(`${UPS_BASE_URL}/api/shipments/${SHIPPING_API_VERSION}/ship`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      transId: transactionId,
      transactionSrc: "hans-mobile",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[ups.service] Shipment request failed:", response.status, text);
    throw new Error("Unable to generate shipping label");
  }

  const data = await response.json();
  const results = data?.ShipmentResponse?.ShipmentResults;
  const packageResult = Array.isArray(results?.PackageResults) ? results.PackageResults[0] : results?.PackageResults;

  if (!packageResult?.TrackingNumber || !packageResult?.ShippingLabel?.GraphicImage) {
    console.error("[ups.service] Unexpected shipment response shape:", JSON.stringify(data));
    throw new Error("Unable to generate shipping label");
  }

  const trackingNumber = packageResult.TrackingNumber as string;
  const chargeValue = results?.ShipmentCharges?.TotalCharges?.MonetaryValue;

  return {
    trackingNumber,
    shipmentId: results.ShipmentIdentificationNumber,
    trackingUrl: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    serviceCode: GROUND_SERVICE_CODE,
    serviceName: "UPS Ground",
    amountUsd: chargeValue != null ? Number(chargeValue) : null,
    currency: results?.ShipmentCharges?.TotalCharges?.CurrencyCode || "USD",
    labelFormat: "GIF",
    labelBase64: packageResult.ShippingLabel.GraphicImage as string,
  };
}

// UPS must accept the cancellation before callers change local label state.
export async function voidShipment(shipmentId: string, trackingNumber?: string | null): Promise<void> {
  if (!isUpsConfigured()) {
    throw new Error("UPS is not configured");
  }
  if (!shipmentId.trim()) {
    throw new Error("UPS shipment identifier is missing");
  }

  const token = await getAccessToken();
  const transactionId = `hans-${Date.now()}`;
  const query = trackingNumber?.trim()
    ? `?trackingnumber=${encodeURIComponent(trackingNumber.trim().toUpperCase())}`
    : "";
  const response = await fetch(
    `${UPS_BASE_URL}/api/shipments/${SHIPPING_API_VERSION}/void/cancel/${encodeURIComponent(shipmentId.trim().toUpperCase())}${query}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        transId: transactionId,
        transactionSrc: "hans-mobile",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[ups.service] Shipment void failed:", response.status, text);
    throw new Error("Unable to void UPS shipment");
  }
}
