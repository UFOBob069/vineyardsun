import type { Metadata } from "next";
import styles from "./custom.module.css";

const url = "https://www.vineyardsun.com/custom-vineyard-sunglasses";
const title = "Custom Sunglasses for Vineyards & Wineries | Vineyard Sun";
const description = "Bespoke sunglasses for your vineyard or winery. Working with vineyards worldwide since 2016. Discuss custom designs for tasting rooms, wine clubs and events.";
const enquiry = `mailto:info@vineyardsun.com?subject=${encodeURIComponent("Custom sunglasses for our vineyard")}&body=${encodeURIComponent("Hello Vineyard Sun,\n\nWe would like to discuss custom sunglasses for our vineyard or winery.\n\nWinery name and website:\nLocation / delivery destination:\nHow we plan to use the sunglasses:\nDesign or branding ideas:\nApproximate quantity:\nTarget date:\nBudget range:\n\nThank you!")}`;

export const metadata: Metadata = {
  title, description, alternates: { canonical: url },
  openGraph: { title, description, url, type: "website", images: [{ url: "https://www.vineyardsun.com/brand/syrah.jpg", alt: "Vineyard Sun Syrah cork sunglasses" }] },
  twitter: { card: "summary_large_image", title, description, images: ["https://www.vineyardsun.com/brand/syrah.jpg"] },
};

export default function CustomVineyardSunglasses() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Service", name: "Custom sunglasses for vineyards and wineries", serviceType: "Bespoke vineyard sunglasses", url, description,
        provider: { "@type": "Organization", name: "Vineyard Sun", url: "https://www.vineyardsun.com", email: "info@vineyardsun.com" } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.vineyardsun.com/" },
        { "@type": "ListItem", position: 2, name: "Custom vineyard sunglasses", item: url },
      ] },
    ],
  };
  return <div className={`site-shell ${styles.page}`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <header className={styles.header}>
      <a className="wordmark" href="/" aria-label="Vineyard Sun home">VINEYARD <span>SUN</span></a>
      <nav aria-label="Main navigation"><a href="/#catalog">Shop</a><a href="/#partners">Our partners</a><a href="#enquire">Enquire</a></nav>
    </header>
    <main>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">For the people behind the wine</p>
          <h1>Custom sunglasses for vineyards &amp; wineries.</h1>
          <p className={styles.lead}>Your vineyard has a story. Let your sunglasses tell it.</p>
          <p>We&apos;ve been working with vineyards across the world since 2016. From a tasting-room keepsake to a gift for your wine club, Vineyard Sun creates custom, bespoke sunglasses designed around your needs.</p>
          <a className="button button-dark" href={enquiry}>Discuss your custom sunglasses <span aria-hidden="true">↗</span></a>
          <a className={styles.secondary} href="#the-details">Explore the possibilities ↓</a>
        </div>
        <figure className={styles.heroImage}>
          <img src="/brand/syrah.jpg" alt="Vineyard Sun Syrah sunglasses with distinctive cork detailing" />
          <figcaption>Our original Syrah style. A little wine-country character.</figcaption>
        </figure>
      </section>

      <section className={styles.intro} id="the-details">
        <p className="eyebrow">Bespoke, by nature</p>
        <h2>Designed for your vineyard. Made for the occasion.</h2>
        <p>The best winery merchandise feels connected to the place it comes from. Custom sunglasses offer a practical way for visitors to take a little of that experience home: an afternoon among the vines, a favorite tasting, or a celebration worth remembering.</p>
        <p>Our cork eyewear draws its inspiration from wine country. For your bespoke project, we start with your brand, your audience, and how you want the sunglasses to be used. Bring a clear design brief or the beginnings of an idea; we&apos;ll discuss the options together.</p>
      </section>

      <section className={styles.uses} aria-label="Ideas for your winery">
        <article><span>01 / The tasting room</span><h2>A souvenir with a purpose.</h2><p>Explore custom winery sunglasses for your retail collection, vineyard tours, or outdoor tastings. Give guests something that feels at home among the vines and useful long after their visit.</p></article>
        <article><span>02 / The wine club</span><h2>A thoughtful thank-you.</h2><p>Discuss a bespoke gift for members, special releases, or a winery anniversary. Start with the occasion and the people you want to celebrate, then shape the design around them.</p></article>
        <article><span>03 / The gathering</span><h2>Bring your brand outdoors.</h2><p>Planning a harvest celebration, wine festival, or team event? Tell us about the setting, your guest list, and your date so we can discuss an appropriate custom order.</p></article>
      </section>

      <section className={styles.experience}>
        <div><p className="eyebrow light">Vineyard relationships since 2016</p><h2>Wine country has taken us around the world.</h2></div>
        <div><p>Working with vineyards worldwide has been part of Vineyard Sun&apos;s story since 2016. Our wider community of stockists and collaborators reaches from Texas and Washington to Ontario and France.</p><p>Each winery brings its own identity, setting, and ideas. We take that as the starting point for a conversation about sunglasses that belong to your brand.</p><a className={styles.lightLink} href="/#partners">Meet our stockists &amp; collaborators →</a></div>
      </section>

      <section className={styles.feedback}>
        <div><p className="eyebrow">Out in the sunshine</p><h2>Good words from the wine community.</h2><p>Published reviews of our original sunglasses highlight their distinctive character and everyday appeal. Here&apos;s what reviewers noticed when they took Vineyard Sun beyond the tasting room.</p></div>
        <div className={styles.quotes}>
          <figure><blockquote>“Well constructed, functional, certainly a conversation-starter”</blockquote><figcaption><a href="https://www.1winedude.com/the-shady-the-free-and-the-godforsaken-may-2018-wine-product-roundup/" target="_blank" rel="noreferrer">1WineDude · Syrah review, 2018 ↗</a></figcaption></figure>
          <figure><blockquote>“I have worn these non-stop since they arrived.”</blockquote><figcaption><a href="https://txwinelover.com/2019/01/vineyard-sun-sunglasses-the-wine-lovers-eyewear/" target="_blank" rel="noreferrer">Texas Wine Lover · Cabernet Sauvignon review, 2019 ↗</a></figcaption></figure>
          <p className={styles.reviewNote}>Review samples were provided to both publications.</p>
        </div>
      </section>

      <section className={styles.faq}>
        <p className="eyebrow">A few useful details</p>
        <h2>Planning your custom order.</h2>
        <details><summary>Can we discuss our winery&apos;s branding and design?</summary><p>Yes. Share your logo, brand guidelines, and the look you have in mind. We&apos;ll discuss the design and branding options available for your project before agreeing the final specification.</p></details>
        <details><summary>What quantity, budget, and lead time should we plan for?</summary><p>These details depend on the design and scope of your order. Include an approximate quantity, budget range, and target date in your enquiry so we can confirm what is possible for your vineyard.</p></details>
        <details><summary>Do you work with vineyards outside the United States?</summary><p>We&apos;ve worked with vineyards across the world since 2016. Tell us your location and delivery destination, and we&apos;ll confirm the options and arrangements for your project.</p></details>
        <details><summary>Can we see Vineyard Sun&apos;s original sunglasses?</summary><p>Explore our <a href="/products/syrah-cork-sunglasses">Syrah cork sunglasses</a> and <a href="/products/cabernet-sauvignon-cork-sunglasses">Cabernet Sauvignon cork sunglasses</a> for an introduction to our eyewear. Availability and specifications for custom orders are discussed separately.</p></details>
      </section>

      <section className={styles.enquire} id="enquire">
        <p className="eyebrow">Let&apos;s start with your vineyard</p>
        <h2>Something distinctly yours.</h2>
        <p>Tell us who you are, what you have in mind, and when you need it. We&apos;ll take it from there.</p>
        <a className="button button-dark" href={enquiry}>Enquire about custom sunglasses ↗</a>
        <a className={styles.email} href={enquiry}>info@vineyardsun.com</a>
      </section>
    </main>
    <footer className={styles.footer}><a className="wordmark" href="/">VINEYARD <span>SUN</span></a><a href="/#catalog">Shop the collection →</a></footer>
  </div>;
}
