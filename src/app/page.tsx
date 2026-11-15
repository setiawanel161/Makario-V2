export default function Home(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-ink-secondary">Makario · Connected workspace</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">Your workspace starts here.</h1>
      <p className="mt-4 max-w-xl text-ink-secondary">
        A modular, local-first workspace for connected notes, workflows, and relational data.
      </p>
    </main>
  );
}
