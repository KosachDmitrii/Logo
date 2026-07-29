"use client";

import { useMemo, useState } from "react";

type Concept = {
  id: string;
  index: string;
  name: string;
  thesis: string;
  score: number;
  className: string;
  accent: string;
};

const concepts: Concept[] = [
  {
    id: "continuous",
    index: "01",
    name: "Continuous Loop",
    thesis: "A single gesture. Movement without an endpoint.",
    score: 94,
    className: "mark-loop",
    accent: "acid",
  },
  {
    id: "portal",
    index: "02",
    name: "Open Portal",
    thesis: "A living frame that turns attention into motion.",
    score: 91,
    className: "mark-portal",
    accent: "cobalt",
  },
  {
    id: "signal",
    index: "03",
    name: "Loop Signal",
    thesis: "Two connected states, always exchanging energy.",
    score: 88,
    className: "mark-signal",
    accent: "coral",
  },
  {
    id: "fold",
    index: "04",
    name: "Soft Fold",
    thesis: "A precise system with a human, tactile edge.",
    score: 86,
    className: "mark-fold",
    accent: "lavender",
  },
];

const personalityOptions = [
  "Intelligent",
  "Playful",
  "Precise",
  "Warm",
  "Experimental",
  "Bold",
];

export default function Home() {
  const [selectedConcept, setSelectedConcept] = useState("continuous");
  const [personalities, setPersonalities] = useState([
    "Intelligent",
    "Experimental",
    "Bold",
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () => concepts.find((concept) => concept.id === selectedConcept)!,
    [selectedConcept],
  );

  function togglePersonality(item: string) {
    setPersonalities((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item],
    );
  }

  function generate() {
    setIsGenerating(true);
    setNotice("");
    window.setTimeout(() => {
      setIsGenerating(false);
      setNotice("4 distinct directions generated from your brief.");
      document
        .getElementById("concepts")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 900);
  }

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Loopen home">
          <span className="wordmark-glyph" aria-hidden="true">
            ∞
          </span>
          LOOPEN
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="#brief">Studio</a>
          <a href="#concepts">Method</a>
          <a href="#manifesto">About</a>
        </nav>
        <button className="project-pill" type="button">
          <span className="online-dot" />
          DK / 01
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span>AI creative direction</span>
          <span>Tel Aviv / 2026</span>
        </div>
        <h1>
          Brands with
          <span className="hero-line">
            <i className="loop-orbit" aria-hidden="true" />
            <em>memory.</em>
          </span>
        </h1>
        <div className="hero-footer">
          <p>
            Loopen turns a sharp brand brief into an original, scalable identity
            system — guided by strategy, refined by taste.
          </p>
          <a className="circle-cta" href="#brief" aria-label="Start a brand brief">
            <span>Start</span>
            <b>↘</b>
          </a>
        </div>
      </section>

      <section className="ticker" aria-label="Product capabilities">
        <div>
          <span>Strategy first</span>
          <i>✦</i>
          <span>Distinct directions</span>
          <i>✦</i>
          <span>Editable vectors</span>
          <i>✦</i>
          <span>Human selection</span>
          <i>✦</i>
        </div>
      </section>

      <section className="studio-section" id="brief">
        <div className="section-heading">
          <p className="eyebrow">01 / Brand signal</p>
          <h2>
            Define the feeling
            <br />
            before the form.
          </h2>
          <p className="section-note">
            A focused brief gives the system taste, boundaries and a reason for
            every visual decision.
          </p>
        </div>

        <div className="brief-panel">
          <div className="field-row">
            <label htmlFor="brand-name">Brand name</label>
            <span>01</span>
            <input id="brand-name" defaultValue="Loopen" />
          </div>
          <div className="field-row">
            <label htmlFor="brand-idea">Core idea</label>
            <span>02</span>
            <textarea
              id="brand-idea"
              rows={2}
              defaultValue="Turn repetition into progress. Make every cycle smarter."
            />
          </div>
          <div className="personality-row">
            <div className="field-label">
              <label>Personality</label>
              <span>03</span>
            </div>
            <div className="chips">
              {personalityOptions.map((item) => {
                const active = personalities.includes(item);
                return (
                  <button
                    key={item}
                    className={active ? "chip active" : "chip"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePersonality(item)}
                  >
                    {active && <span>●</span>}
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="direction-row">
            <div>
              <span className="mini-label">Avoid</span>
              <p>Generic infinity marks, gradients, tech clichés, literal loops.</p>
            </div>
            <div>
              <span className="mini-label">Audience</span>
              <p>Curious founders building modern, adaptable products.</p>
            </div>
          </div>
          <div className="generate-row">
            <p>
              <span>4</span> strategic directions
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={generate}
              disabled={isGenerating}
            >
              {isGenerating ? "Building directions…" : "Generate directions"}
              <span>{isGenerating ? "◌" : "↗"}</span>
            </button>
          </div>
          {notice && (
            <p className="inline-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      </section>

      <section className="concepts-section" id="concepts">
        <div className="concepts-header">
          <div>
            <p className="eyebrow light">02 / Concept territories</p>
            <h2>Different ideas. Not different seeds.</h2>
          </div>
          <p>
            Each route starts from a distinct strategic thought and survives at
            24 px before it earns the right to become a brand.
          </p>
        </div>

        <div className="concept-grid">
          {concepts.map((concept) => {
            const active = selectedConcept === concept.id;
            return (
              <button
                className={`concept-card ${active ? "selected" : ""}`}
                type="button"
                key={concept.id}
                onClick={() => setSelectedConcept(concept.id)}
                aria-pressed={active}
              >
                <div className="concept-meta">
                  <span>{concept.index}</span>
                  <span className={`score ${concept.accent}`}>
                    {concept.score}% fit
                  </span>
                </div>
                <div className={`concept-mark ${concept.className}`}>
                  <i />
                  <b />
                  <em />
                </div>
                <div className="concept-copy">
                  <h3>{concept.name}</h3>
                  <p>{concept.thesis}</p>
                </div>
                <span className="select-indicator">
                  {active ? "Selected" : "Explore"} <b>{active ? "●" : "↗"}</b>
                </span>
              </button>
            );
          })}
        </div>

        <div className="selected-bar">
          <div className={`selected-symbol ${selected.className}`} aria-hidden="true">
            <i />
            <b />
            <em />
          </div>
          <div>
            <span>Selected direction</span>
            <strong>{selected.name}</strong>
          </div>
          <div className="selected-actions">
            <button type="button" onClick={() => setNotice("Selection saved.")}>
              Save for later
            </button>
            <button
              className="approve-button"
              type="button"
              onClick={() =>
                setNotice(`${selected.name} is ready for refinement.`)
              }
            >
              Refine this route <span>→</span>
            </button>
          </div>
        </div>
      </section>

      <section className="system-section">
        <div className="system-left">
          <p className="eyebrow">03 / Brand system</p>
          <h2>
            One idea.
            <br />
            Every context.
          </h2>
          <div className="system-number">12</div>
          <p className="system-caption">Production-ready assets from one route.</p>
        </div>
        <div className="system-board">
          <article className="application-card acid-card">
            <span className="app-label">App icon / 01</span>
            <div className="app-loop" />
            <strong>Loop forward.</strong>
          </article>
          <article className="application-card black-card">
            <span className="app-label">Wordmark / 02</span>
            <div className="black-wordmark">LOO<span>∞</span>PEN</div>
            <p>Adaptive identity for adaptive brands.</p>
          </article>
          <article className="application-card white-card">
            <span className="app-label">Micro mark / 03</span>
            <div className="micro-grid">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <p>24 px → ∞</p>
          </article>
        </div>
      </section>

      <section className="manifesto" id="manifesto">
        <p className="eyebrow">Our point of view</p>
        <blockquote>
          AI should multiply
          <span>directions,</span> not multiply noise.
        </blockquote>
        <div className="manifesto-footer">
          <p>
            Strategy makes it relevant. Selection makes it distinct. Craft makes
            it last.
          </p>
          <button className="text-button" type="button">
            Read the Loopen method <span>↗</span>
          </button>
        </div>
      </section>

      <footer>
        <a className="footer-wordmark" href="#top">
          LOOPEN<span>®</span>
        </a>
        <div className="footer-meta">
          <p>Brand systems, not random logos.</p>
          <p>Made with intent in Tel Aviv.</p>
        </div>
        <a className="back-top" href="#top">
          Back to top ↑
        </a>
      </footer>
    </main>
  );
}
