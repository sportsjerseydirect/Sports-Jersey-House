export type LogoConcept = {
  id: string;
  name: string;
  description: string;
  palette: string;
};

export const logoConcepts: LogoConcept[] = [
  {
    id: "shield-monogram",
    name: "Shield monogram",
    description: "Bold SJH monogram inside a shield silhouette — athletic, confident, premium.",
    palette: "charcoal + ember"
  },
  {
    id: "house-wordmark",
    name: "House wordmark",
    description: "Typographic HOUSE lockup with a subtle roof line — retail-first and clean.",
    palette: "ink + field"
  },
  {
    id: "circle-badge",
    name: "Circle badge",
    description: "Circular badge with jersey number energy — collectible, team-spirit without league marks.",
    palette: "field + gold"
  }
];

export function LogoConceptMark({ conceptId }: { conceptId: LogoConcept["id"] }) {
  if (conceptId === "shield-monogram") {
    return (
      <svg aria-hidden="true" className="logo-concept-svg" viewBox="0 0 120 120">
        <path d="M60 8 L104 28 V58 C104 84 84 98 60 112 C36 98 16 84 16 58 V28 Z" fill="var(--charcoal)" />
        <text fill="var(--white)" fontFamily="var(--font-sans)" fontSize="28" fontWeight="800" textAnchor="middle" x="60" y="72">
          SJH
        </text>
      </svg>
    );
  }

  if (conceptId === "house-wordmark") {
    return (
      <svg aria-hidden="true" className="logo-concept-svg" viewBox="0 0 160 80">
        <path d="M20 44 L80 12 L140 44 V68 H20 Z" fill="none" stroke="var(--field)" strokeWidth="3" />
        <text fill="var(--ink)" fontFamily="var(--font-sans)" fontSize="22" fontWeight="800" textAnchor="middle" x="80" y="58">
          HOUSE
        </text>
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="logo-concept-svg" viewBox="0 0 120 120">
      <circle cx="60" cy="60" fill="var(--field)" r="52" />
      <circle cx="60" cy="60" fill="none" r="42" stroke="var(--gold)" strokeWidth="3" />
      <text fill="var(--white)" fontFamily="var(--font-sans)" fontSize="34" fontWeight="900" textAnchor="middle" x="60" y="72">
        88
      </text>
    </svg>
  );
}

export function LogoConceptGallery() {
  return (
    <section className="logo-concepts" aria-label="Logo concept directions">
      <div className="section-heading">
        <p className="eyebrow">Brand system</p>
        <h2>Original logo directions</h2>
        <p className="lede">Three concepts for human review — none are final production marks.</p>
      </div>
      <div className="logo-concept-grid">
        {logoConcepts.map((concept) => (
          <article className="logo-concept-card" key={concept.id}>
            <LogoConceptMark conceptId={concept.id} />
            <h3>{concept.name}</h3>
            <p>{concept.description}</p>
            <p className="logo-concept-meta">{concept.palette}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
