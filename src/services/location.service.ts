import {
  getCitiesOfState,
  getCountries,
  getStatesOfCountry,
  isValidCountryCode,
  isValidStateCode,
} from "@countrystatecity/countries";

export interface LocationCountry {
  code: string;
  name: string;
  emoji?: string;
  phoneCode?: string;
}

export interface LocationState {
  code: string;
  name: string;
  countryCode: string;
}

export interface LocationCity {
  name: string;
  stateCode: string;
  countryCode: string;
}

export async function listCountries(): Promise<LocationCountry[]> {
  const countries = await getCountries();
  return countries
    .map((country) => ({
      code: country.iso2,
      name: country.name,
      emoji: country.emoji,
      phoneCode: country.phonecode,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listStates(countryCode: string): Promise<LocationState[]> {
  const normalizedCountryCode = countryCode.toUpperCase();
  const isValid = await isValidCountryCode(normalizedCountryCode);
  if (!isValid) {
    throw new Error("Invalid country code");
  }

  const states = await getStatesOfCountry(normalizedCountryCode);
  return states
    .map((state) => ({
      code: state.iso2,
      name: state.name,
      countryCode: normalizedCountryCode,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCities(countryCode: string, stateCode: string): Promise<LocationCity[]> {
  const normalizedCountryCode = countryCode.toUpperCase();
  const normalizedStateCode = stateCode.toUpperCase();
  const isValid = await isValidStateCode(normalizedCountryCode, normalizedStateCode);
  if (!isValid) {
    throw new Error("Invalid state code");
  }

  const cities = await getCitiesOfState(normalizedCountryCode, normalizedStateCode);
  return cities
    .map((city) => ({
      name: city.name,
      stateCode: normalizedStateCode,
      countryCode: normalizedCountryCode,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
