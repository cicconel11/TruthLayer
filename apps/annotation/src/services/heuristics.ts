import { DomainTypeEnum, FactualConsistencyEnum } from "@truthlayer/schema";
import type { AnnotationRecord } from "@truthlayer/schema";

type DomainType = AnnotationRecord["domainType"];
type FactualConsistency = AnnotationRecord["factualConsistency"];

const GOVERNMENT_TLDS = [".gov", ".gouv", ".gov.uk", ".gov.au", ".mil"];
const ACADEMIC_TLDS = [".edu", ".ac.", ".edu."];

const NEWS_KEYWORDS = [
  "news",
  "times",
  "tribune",
  "guardian",
  "post",
  "journal",
  "chronicle",
  "daily",
  "cnn",
  "bbc",
  "nbc",
  "abc",
  "reuters",
  "apnews",
  "bloomberg",
  "politico"
];

const BLOG_DOMAINS = [
  "medium.com",
  "substack.com",
  "wordpress.com",
  "blogspot.com",
  "tumblr.com",
  "hashnode.dev",
  "dev.to"
];

export function inferDomainType(domain: string): DomainType {
  const normalized = domain.toLowerCase();

  if (GOVERNMENT_TLDS.some((suffix) => normalized.endsWith(suffix))) {
    return DomainTypeEnum.enum.government;
  }

  if (ACADEMIC_TLDS.some((suffix) => normalized.includes(suffix))) {
    return DomainTypeEnum.enum.academic;
  }

  if (BLOG_DOMAINS.some((known) => normalized.endsWith(known))) {
    return DomainTypeEnum.enum.blog;
  }

  if (NEWS_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return DomainTypeEnum.enum.news;
  }

  return DomainTypeEnum.enum.other;
}

export function inferFactualConsistency(snippet?: string | null): FactualConsistency {
  if (!snippet || snippet.trim().length === 0) {
    return FactualConsistencyEnum.enum.not_applicable;
  }

  return FactualConsistencyEnum.enum.unclear;
}

export function coerceDomainType(value: unknown, fallback: DomainType): DomainType {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  const options = DomainTypeEnum.options;
  if (options.includes(normalized as DomainType)) {
    return normalized as DomainType;
  }
  return fallback;
}

export function coerceFactualConsistency(
  value: unknown,
  fallback: FactualConsistency
): FactualConsistency {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  const options = FactualConsistencyEnum.options;
  if (options.includes(normalized as FactualConsistency)) {
    return normalized as FactualConsistency;
  }
  return fallback;
}
