import { periodBuckets, tagPalette, tagTextPalette } from "./constants";
import { GoalPlanType, PeriodBucketKey } from "./types";

export const hashString = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

export const getTagStyle = (tag: string) => {
  const index = hashString(tag) % tagPalette.length;
  return {
    background: tagPalette[index],
    color: tagTextPalette[index]
  };
};

export const createId = () => Math.random().toString(36).slice(2, 10);

export const buildDefaultTags = (title: string, kind: GoalPlanType) => {
  const words = title
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 2);
  const base = kind === "goal" ? "цель" : "план";
  return Array.from(new Set([base, ...words]));
};

export const getBucketKey = (period: string): PeriodBucketKey => {
  const value = period.toLowerCase();
  if (value.includes("день") || value.includes("сегодня")) {
    return "day";
  }
  if (value.includes("нед")) {
    return "week";
  }
  if (value.includes("месяц")) {
    return "month";
  }
  if (value.includes("год")) {
    return "year";
  }
  return "life";
};

export const normalizePeriodLabel = (period: string) => {
  const key = getBucketKey(period);
  const bucket = periodBuckets.find((item) => item.key === key);
  return bucket ? bucket.label : period;
};
