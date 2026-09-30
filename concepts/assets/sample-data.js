// Hand-written sample data for the lens previews.
// Titles are real Wikipedia articles, but kinds, view counts, link directions and totals
// are illustrative. The real app would read them from Wikidata, the Pageviews API and
// the MediaWiki links / linkshere APIs.
//
// Each linked article:
//   t     title
//   kind  bucket for the "kinds" lens (people | places | orgs | works | events | concepts)
//   p31   Wikidata "instance of" label that put it in that bucket
//   v     monthly page views (illustrative)
//   dir   "out"  = this article links to it only
//         "in"   = it links to this article only
//         "both" = links go both ways
//
// Each article also has "sections" in reading order (chapters, optional subchapters,
// and the links that appear in them), used by the Chapters and Metro lenses.
// Chapter names and link placement are simplified, not copied from the live articles.

window.WMM = {
  KINDS: [
    { id: "people",   label: "People",        color: "--b3", rule: "human, fictional character" },
    { id: "orgs",     label: "Organizations", color: "--b2", rule: "organization, university, company, broadcaster" },
    { id: "works",    label: "Works",         color: "--b4", rule: "book, software, film, TV series, artwork" },
    { id: "concepts", label: "Concepts",      color: "--b1", rule: "concept, method, field of study, diagram, anything else" },
    { id: "events",   label: "Events",        color: "--b6", rule: "event, competition, recurring event, war" },
    { id: "places",   label: "Places",        color: "--b5", rule: "city, country, region, building, anything with coordinates" }
  ],

  ARTICLES: {
    "Mind map": {
      lead: "A diagram that arranges ideas around one central concept, with related topics radiating outward as branches.",
      p31: "diagram",
      totals: { in: 1240, out: 212, both: 41 },
      links: [
        { t: "Tony Buzan", kind: "people", p31: "human", v: 14000, dir: "both" },
        { t: "Ramon Llull", kind: "people", p31: "human", v: 11000, dir: "out" },
        { t: "Porphyry of Tyre", kind: "people", p31: "human", v: 9000, dir: "out" },
        { t: "Joseph D. Novak", kind: "people", p31: "human", v: 1500, dir: "in" },
        { t: "BBC", kind: "orgs", p31: "public broadcaster", v: 250000, dir: "out" },
        { t: "FreeMind", kind: "works", p31: "software", v: 3000, dir: "both" },
        { t: "XMind", kind: "works", p31: "software", v: 4000, dir: "both" },
        { t: "Use Your Head", kind: "works", p31: "television series", v: 600, dir: "out" },
        { t: "The Mind Map Book", kind: "works", p31: "book", v: 400, dir: "in" },
        { t: "Mind Sports Olympiad", kind: "events", p31: "recurring event", v: 2000, dir: "in" },
        { t: "Memory", kind: "concepts", p31: "mental process", v: 60000, dir: "out" },
        { t: "Brainstorming", kind: "concepts", p31: "method", v: 30000, dir: "both" },
        { t: "Concept map", kind: "concepts", p31: "diagram", v: 20000, dir: "both" },
        { t: "Note-taking", kind: "concepts", p31: "method", v: 15000, dir: "both" },
        { t: "Semantic network", kind: "concepts", p31: "knowledge representation", v: 9000, dir: "out" },
        { t: "Graphic organizer", kind: "concepts", p31: "diagram", v: 5000, dir: "in" },
        { t: "Personal knowledge management", kind: "concepts", p31: "field of study", v: 4000, dir: "in" },
        { t: "Argument map", kind: "concepts", p31: "diagram", v: 3000, dir: "both" },
        { t: "Visual thinking", kind: "concepts", p31: "concept", v: 3000, dir: "in" },
        { t: "Tree structure", kind: "concepts", p31: "data structure", v: 7000, dir: "out" },
        { t: "Hierarchy", kind: "concepts", p31: "concept", v: 20000, dir: "out" },
        { t: "Learning", kind: "concepts", p31: "process", v: 40000, dir: "out" },
        { t: "Creativity", kind: "concepts", p31: "mental process", v: 30000, dir: "out" },
        { t: "Outliner", kind: "works", p31: "software genre", v: 2500, dir: "out" },
        { t: "Cognitive map", kind: "concepts", p31: "concept", v: 6000, dir: "out" }
      ],
      sections: [
        { t: "Characteristics", links: ["Tree structure", "Hierarchy", "Memory", "Brainstorming"] },
        { t: "Differences", links: ["Concept map", "Semantic network", "Argument map", "Tree structure"] },
        { t: "History", subs: [
          { t: "Origins", links: ["Porphyry of Tyre", "Ramon Llull", "Semantic network"] },
          { t: "Popularisation", links: ["Tony Buzan", "BBC", "Use Your Head", "Memory"] }
        ] },
        { t: "Research", subs: [
          { t: "Effectiveness", links: ["Learning", "Memory", "Note-taking"] },
          { t: "Criticism", links: ["Tony Buzan", "Learning"] }
        ] },
        { t: "Tools", links: ["FreeMind", "XMind", "Outliner", "Concept map"] },
        { t: "Uses", links: ["Note-taking", "Brainstorming", "Learning", "Creativity"] },
        { t: "See also", housekeeping: true, links: ["Cognitive map", "Argument map", "Concept map"] }
      ]
    },

    "Tony Buzan": {
      lead: "English author and educational consultant who popularised mind mapping from the 1970s onward.",
      p31: "human",
      totals: { in: 310, out: 96, both: 22 },
      links: [
        { t: "Raymond Keene", kind: "people", p31: "human", v: 3000, dir: "both" },
        { t: "Barry Buzan", kind: "people", p31: "human", v: 2500, dir: "both" },
        { t: "Dominic O'Brien", kind: "people", p31: "human", v: 1800, dir: "in" },
        { t: "London", kind: "places", p31: "city", v: 300000, dir: "out" },
        { t: "Vancouver", kind: "places", p31: "city", v: 90000, dir: "out" },
        { t: "University of British Columbia", kind: "orgs", p31: "university", v: 40000, dir: "out" },
        { t: "BBC", kind: "orgs", p31: "public broadcaster", v: 250000, dir: "out" },
        { t: "Use Your Head", kind: "works", p31: "television series", v: 600, dir: "both" },
        { t: "The Mind Map Book", kind: "works", p31: "book", v: 400, dir: "both" },
        { t: "World Memory Championships", kind: "events", p31: "recurring event", v: 6000, dir: "both" },
        { t: "Mind Sports Olympiad", kind: "events", p31: "recurring event", v: 2000, dir: "both" },
        { t: "Mind map", kind: "concepts", p31: "diagram", v: 35000, dir: "both" },
        { t: "Speed reading", kind: "concepts", p31: "method", v: 12000, dir: "both" },
        { t: "Mnemonic", kind: "concepts", p31: "method", v: 25000, dir: "out" },
        { t: "Psychology", kind: "concepts", p31: "field of study", v: 200000, dir: "out" },
        { t: "Memory sport", kind: "concepts", p31: "type of sport", v: 3000, dir: "in" },
        { t: "Method of loci", kind: "concepts", p31: "method", v: 15000, dir: "in" },
        { t: "Chess", kind: "concepts", p31: "board game", v: 150000, dir: "out" }
      ],
      sections: [
        { t: "Early life", links: ["London", "Barry Buzan", "University of British Columbia", "Psychology", "Vancouver"] },
        { t: "Career", subs: [
          { t: "Television and books", links: ["BBC", "Use Your Head", "The Mind Map Book", "Speed reading"] },
          { t: "Mind mapping", links: ["Mind map", "Mnemonic", "Psychology"] }
        ] },
        { t: "Mind sports", links: ["World Memory Championships", "Mind Sports Olympiad", "Raymond Keene", "Chess", "Mnemonic"] },
        { t: "Legacy", links: ["Mind map", "Raymond Keene", "Speed reading"] },
        { t: "See also", housekeeping: true, links: ["Mnemonic", "Speed reading"] }
      ]
    },

    "Concept map": {
      lead: "A diagram of concepts joined by labeled links that state how one idea relates to another.",
      p31: "diagram",
      totals: { in: 520, out: 88, both: 19 },
      links: [
        { t: "Joseph D. Novak", kind: "people", p31: "human", v: 1500, dir: "both" },
        { t: "David Ausubel", kind: "people", p31: "human", v: 4000, dir: "out" },
        { t: "Cornell University", kind: "orgs", p31: "university", v: 90000, dir: "out" },
        { t: "Institute for Human and Machine Cognition", kind: "orgs", p31: "research institute", v: 800, dir: "both" },
        { t: "CmapTools", kind: "works", p31: "software", v: 900, dir: "both" },
        { t: "Mind map", kind: "concepts", p31: "diagram", v: 35000, dir: "both" },
        { t: "Semantic network", kind: "concepts", p31: "knowledge representation", v: 9000, dir: "both" },
        { t: "Topic map", kind: "concepts", p31: "standard", v: 1500, dir: "both" },
        { t: "Conceptual graph", kind: "concepts", p31: "knowledge representation", v: 1200, dir: "both" },
        { t: "Ontology (information science)", kind: "concepts", p31: "field of study", v: 30000, dir: "out" },
        { t: "Knowledge management", kind: "concepts", p31: "field of study", v: 25000, dir: "out" },
        { t: "Graph theory", kind: "concepts", p31: "field of study", v: 60000, dir: "out" },
        { t: "Proposition", kind: "concepts", p31: "concept", v: 12000, dir: "out" },
        { t: "Argument map", kind: "concepts", p31: "diagram", v: 3000, dir: "in" },
        { t: "Graphic organizer", kind: "concepts", p31: "diagram", v: 5000, dir: "in" },
        { t: "Knowledge visualization", kind: "concepts", p31: "field of study", v: 1500, dir: "in" },
        { t: "Meaningful learning", kind: "concepts", p31: "concept", v: 1000, dir: "both" },
        { t: "Hierarchy", kind: "concepts", p31: "concept", v: 20000, dir: "out" }
      ],
      sections: [
        { t: "Overview", links: ["Proposition", "Graph theory", "Hierarchy", "Semantic network"] },
        { t: "History", links: ["Joseph D. Novak", "Cornell University", "David Ausubel", "Meaningful learning"] },
        { t: "Theory", subs: [
          { t: "Propositions", links: ["Proposition", "Semantic network", "Hierarchy"] },
          { t: "Learning", links: ["David Ausubel", "Meaningful learning"] }
        ] },
        { t: "Use", subs: [
          { t: "Education", links: ["Joseph D. Novak", "Meaningful learning"] },
          { t: "Knowledge work", links: ["Knowledge management", "Ontology (information science)", "CmapTools", "Institute for Human and Machine Cognition"] }
        ] },
        { t: "Related diagrams", links: ["Mind map", "Topic map", "Conceptual graph", "Semantic network"] },
        { t: "See also", housekeeping: true, links: ["Graph theory"] }
      ]
    }
  }
};
