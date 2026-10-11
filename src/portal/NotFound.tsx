import { Link } from 'react-router';

/** Any portal address without a page, in the design's style. */
export function NotFound() {
  return (
    <section className="bd-soon">
      <div>
        <h1>Lost ?</h1>
        <p>There is no page at this address.</p>
        <Link to="/" className="bd-auth-submit bd-btn-link">
          Back home
        </Link>
      </div>
    </section>
  );
}
