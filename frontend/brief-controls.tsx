"use client";

import { useMemo, useState } from "react";
import type { CompetitorEntry, LikedAspect } from "./lib/competitors/types.ts";
import { BRIEF_LIMITS } from "./lib/brief-options.ts";
import {
  canAddCompetitor,
  entryWebsite,
  isValidHttpUrl,
  nameKey,
  normalizeWebsite,
} from "./lib/competitors/index.ts";

const LIKED_ASPECTS: LikedAspect[] = [
  "logo",
  "typography",
  "color",
  "layout",
  "motion",
  "tone",
];

type CompetitorSectionKey = "direct" | "references";

type SectionConfig = {
  label: string;
  hint?: string;
  suggestions: CompetitorEntry[];
  value: CompetitorEntry[];
  onChange: (next: CompetitorEntry[]) => void;
  rejected: string[];
  onRejectedChange: (next: string[]) => void;
  onShowMore: () => void;
  showLikedAspects?: boolean;
  needsManualInput?: boolean;
};

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /\.[a-z]{2,}(\/|$)/i.test(value);
}

function brandNameFromHost(hostname: string): string {
  const host = hostname.replace(/^www\./i, "");
  const label = host.split(".")[0] ?? host;
  if (!label) return host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function displayName(entry: CompetitorEntry): string {
  const site = entryWebsite(entry);
  if (site) {
    try {
      const host = new URL(site).hostname.replace(/^www\./i, "");
      if (nameKey(entry.name) === nameKey(host) || looksLikeUrl(entry.name)) {
        return brandNameFromHost(host);
      }
    } catch {
      // keep stored name
    }
  }
  if (looksLikeUrl(entry.name) && !/\s/.test(entry.name)) {
    return brandNameFromHost(entry.name.replace(/^https?:\/\//i, ""));
  }
  return entry.name;
}

function brandMark(entry: CompetitorEntry): string {
  const name = displayName(entry).trim();
  const letter = [...name].find((ch) => /\p{L}/u.test(ch));
  return letter ? letter.toUpperCase() : "·";
}

type FieldLabels = {
  remove: string;
  showMore: string;
  emptyDirect: string;
  selectIndustry: string;
  tapToAdd: string;
  alreadySelected: string;
  limitReached: string;
  likedAspects: string;
  searchPlaceholder: string;
  add: string;
  invalidUrl: string;
  aspect: Record<LikedAspect, string>;
};

function entryFromManualInput(
  raw: string,
): CompetitorEntry | { error: "invalidUrl" } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (looksLikeUrl(trimmed)) {
    if (!isValidHttpUrl(trimmed)) return { error: "invalidUrl" };
    const website = normalizeWebsite(trimmed);
    if (!website) return { error: "invalidUrl" };
    let name = trimmed;
    try {
      name = brandNameFromHost(new URL(website).hostname);
    } catch {
      // keep trimmed input as name
    }
    return { name, website, url: website, source: "manual" };
  }
  return { name: trimmed, source: "manual" };
}

/** Pick competitors / references from the suggestion pool. */
export function CompetitorField({
  title,
  labels,
  direct,
  references,
  suggestionsReady = true,
}: {
  title: string;
  labels: FieldLabels;
  direct: SectionConfig;
  references: SectionConfig;
  suggestionsReady?: boolean;
}) {
  const [section, setSection] = useState<CompetitorSectionKey>("direct");
  const [status, setStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [visibleCount, setVisibleCount] = useState({
    direct: 8,
    references: 8,
  });

  const active = section === "direct" ? direct : references;

  const selectedKeys = useMemo(
    () => new Set(active.value.map((entry) => nameKey(entry.name))),
    [active.value],
  );
  const rejectedKeys = useMemo(
    () => new Set(active.rejected.map((name) => nameKey(name))),
    [active.rejected],
  );

  const availableSuggestions = useMemo(() => {
    if (!suggestionsReady) return [];
    return active.suggestions.filter((entry) => {
      if (rejectedKeys.has(nameKey(entry.name))) return false;
      if (selectedKeys.has(nameKey(entry.name))) return false;
      return true;
    });
  }, [
    active.suggestions,
    rejectedKeys,
    selectedKeys,
    suggestionsReady,
  ]);

  const visibleSuggestions = availableSuggestions.slice(
    0,
    visibleCount[section],
  );
  const hasMoreSuggestions =
    availableSuggestions.length > visibleCount[section];

  function flash(message: string) {
    setStatus(message);
  }

  function switchSection(next: CompetitorSectionKey) {
    if (next === section) return;
    setSection(next);
    setStatus(null);
  }

  function addManualEntry() {
    const parsed = entryFromManualInput(draft);
    if (!parsed) return;
    if ("error" in parsed) {
      flash(labels.invalidUrl);
      return;
    }
    const check = canAddCompetitor(active.value, parsed.name);
    if (!check.ok) {
      flash(
        check.reason === "limit"
          ? labels.limitReached
          : labels.alreadySelected,
      );
      return;
    }
    active.onChange([...active.value, parsed]);
    setDraft("");
    setStatus(null);
  }

  function toggleEntry(entry: CompetitorEntry) {
    const key = nameKey(entry.name);
    if (selectedKeys.has(key)) {
      active.onChange(active.value.filter((item) => nameKey(item.name) !== key));
      return;
    }
    const check = canAddCompetitor(active.value, entry.name);
    if (!check.ok) {
      flash(
        check.reason === "limit"
          ? labels.limitReached
          : labels.alreadySelected,
      );
      return;
    }
    active.onChange([
      ...active.value,
      {
        ...entry,
        source: entry.source ?? "industry",
      },
    ]);
  }

  function toggleLikedAspect(entry: CompetitorEntry, aspect: LikedAspect) {
    const key = nameKey(entry.name);
    active.onChange(
      active.value.map((item) => {
        if (nameKey(item.name) !== key) return item;
        const current = new Set(item.likedAspects ?? []);
        if (current.has(aspect)) current.delete(aspect);
        else current.add(aspect);
        return { ...item, likedAspects: [...current] };
      }),
    );
  }

  const emptyMessage =
    suggestionsReady &&
    active.needsManualInput &&
    active.value.length === 0 &&
    availableSuggestions.length === 0
      ? labels.emptyDirect
      : null;

  const atLimit = active.value.length >= BRIEF_LIMITS.competitorsMax;

  return (
    <div className="competitor-field">
      <div className="competitor-top">
        <span className="mini-label">{title}</span>
        <div className="competitor-switch" role="tablist" aria-label={title}>
          <button
            type="button"
            role="tab"
            className={
              section === "direct"
                ? "competitor-switch-btn is-active"
                : "competitor-switch-btn"
            }
            aria-selected={section === "direct"}
            onClick={() => switchSection("direct")}
          >
            {direct.label}
            {direct.value.length > 0 ? <em>{direct.value.length}</em> : null}
          </button>
          <button
            type="button"
            role="tab"
            className={
              section === "references"
                ? "competitor-switch-btn is-active"
                : "competitor-switch-btn"
            }
            aria-selected={section === "references"}
            onClick={() => switchSection("references")}
          >
            {references.label}
            {references.value.length > 0 ? (
              <em>{references.value.length}</em>
            ) : null}
          </button>
        </div>
      </div>

      {active.hint ? <p className="competitor-hint">{active.hint}</p> : null}

      <form
        className="competitor-compose"
        onSubmit={(event) => {
          event.preventDefault();
          addManualEntry();
        }}
      >
        <span className="competitor-compose-icon" aria-hidden="true">
          /
        </span>
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (status) setStatus(null);
          }}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
          disabled={atLimit}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="competitor-compose-count" aria-hidden="true">
          {active.value.length}/{BRIEF_LIMITS.competitorsMax}
        </span>
        <button
          type="submit"
          className="competitor-compose-go"
          disabled={atLimit || !draft.trim()}
        >
          {labels.add}
        </button>
      </form>

      {emptyMessage ? <p className="competitor-note">{emptyMessage}</p> : null}
      {status ? <p className="competitor-note">{status}</p> : null}

      {active.value.length > 0 ? (
        <div
          className={
            active.showLikedAspects
              ? "competitor-specimens"
              : "competitor-specimens competitor-specimens-compact"
          }
        >
          {active.value.map((entry, index) => {
            const key = nameKey(entry.name);
            const name = displayName(entry);
            const description = entry.reason?.trim() || entry.notes?.trim();
            return (
              <article
                key={`${section}-specimen-${key}`}
                className="competitor-specimen"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="competitor-specimen-top">
                  <span className="competitor-specimen-mark" aria-hidden="true">
                    {brandMark(entry)}
                  </span>
                  <button
                    type="button"
                    className="competitor-specimen-remove"
                    onClick={() => toggleEntry(entry)}
                    aria-label={`${labels.remove} ${name}`}
                  >
                    ×
                  </button>
                </div>
                <div className="competitor-specimen-body">
                  <h4 className="competitor-specimen-name">{name}</h4>
                  {description ? (
                    <p className="competitor-specimen-desc">{description}</p>
                  ) : null}
                </div>
                {active.showLikedAspects ? (
                  <div className="competitor-specimen-aspects">
                    <span className="competitor-specimen-like">
                      {labels.likedAspects}
                    </span>
                    {LIKED_ASPECTS.map((aspect) => {
                      const on = entry.likedAspects?.includes(aspect);
                      return (
                        <button
                          key={aspect}
                          type="button"
                          className={
                            on
                              ? "competitor-specimen-aspect is-on"
                              : "competitor-specimen-aspect"
                          }
                          aria-pressed={Boolean(on)}
                          onClick={() => toggleLikedAspect(entry, aspect)}
                        >
                          {labels.aspect[aspect]}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {visibleSuggestions.length > 0 ? (
        <div className="competitor-pool">
          <span className="competitor-pool-label">{labels.tapToAdd}</span>
          <div className="competitor-pool-grid">
            {visibleSuggestions.map((entry) => (
              <button
                key={`${section}-pool-${nameKey(entry.name)}`}
                type="button"
                className="competitor-pool-tile"
                title={entry.reason || labels.tapToAdd}
                onClick={() => toggleEntry(entry)}
              >
                <span className="competitor-pool-mark" aria-hidden="true">
                  {brandMark(entry)}
                </span>
                <span className="competitor-pool-name">
                  {displayName(entry)}
                </span>
                <span className="competitor-pool-plus" aria-hidden="true">
                  +
                </span>
              </button>
            ))}
            {hasMoreSuggestions ? (
              <button
                type="button"
                className="competitor-pool-more"
                onClick={() => {
                  setVisibleCount((current) => ({
                    ...current,
                    [section]: current[section] + 8,
                  }));
                  active.onShowMore();
                }}
              >
                {labels.showMore}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {atLimit ? <p className="competitor-note">{labels.limitReached}</p> : null}
    </div>
  );
}
