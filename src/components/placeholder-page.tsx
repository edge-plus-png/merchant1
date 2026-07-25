export function PlaceholderPage({
  category,
  title,
}: {
  category: string;
  title: string;
}) {
  return (
    <div className="merchant-page placeholder-page">
      <section className="legacy-page-heading">
        <p>{category}</p>
        <h1>{title}</h1>
      </section>
      <section className="placeholder-panel">
        <span aria-hidden="true" />
        <h2>{title}</h2>
        <p>This page is a placeholder.</p>
      </section>
    </div>
  );
}
