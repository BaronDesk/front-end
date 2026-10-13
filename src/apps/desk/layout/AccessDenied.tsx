import { Link } from 'react-router';

export function AccessDenied() {
  return (
    <>
      <h1>Access denied</h1>
      <div className="msg msg-error">
        Your role is not allowed to open this page. Ask a branch admin if you need access.
      </div>
      <Link to="/">« Back to stations</Link>
    </>
  );
}
