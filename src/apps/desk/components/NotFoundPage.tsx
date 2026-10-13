import { Link } from 'react-router';

/** Any address the app has no page for. `back` names the start page the link goes to. */
export function NotFoundPage({ back }: { back: string }) {
  return (
    <>
      <h1>Page not found</h1>
      <p>There is no page at this address.</p>
      <p>
        <Link to="/">« Back to {back}</Link>
      </p>
    </>
  );
}
