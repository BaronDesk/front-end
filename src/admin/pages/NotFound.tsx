import { Link } from 'react-router';

export function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>There is no page at this address.</p>
      <Link to="/">« Back to stations</Link>
    </>
  );
}
