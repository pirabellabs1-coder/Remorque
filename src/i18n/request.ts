import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";

import { MARKETS, type Market } from "@/config/markets";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? (requested as Market)
    : routing.defaultLocale;

  const market = MARKETS[locale];

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Formats locaux (section M20) : dates, heures, séparateurs, unités.
    // Aucune conversion implicite de devise : chaque montant porte la sienne.
    timeZone: "Europe/Paris",
    formats: {
      number: {
        currency: {
          style: "currency",
          currency: market.currency,
          minimumFractionDigits: 2,
        },
        distance: {
          style: "unit",
          unit: "kilometer",
          maximumFractionDigits: 0,
        },
        weight: {
          style: "unit",
          unit: "kilogram",
          maximumFractionDigits: 0,
        },
      },
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
      },
    },
  };
});
