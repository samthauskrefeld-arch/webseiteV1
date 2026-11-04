export const metadata = { title: "Offline" };
export default function Page() {
  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <h1>Du bist offline</h1>
      <p className="mt-3 text-[15px] text-muted">Sobald du wieder verbunden bist, kannst du weitersuchen. Bereits gesendete Bewerbungen sind sicher gespeichert.</p>
    </div>
  );
}
