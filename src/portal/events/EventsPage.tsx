import { Screen } from '../ui/Screen';

/** Events will hold the tournaments; until then it says so. */
export function EventsPage() {
  return (
    <Screen nav="home">
      <section className="bd-soon">
        <div>
          <h1>Events</h1>
          <p>Tournaments are coming soon.</p>
        </div>
      </section>
    </Screen>
  );
}
