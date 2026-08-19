import Link from 'next/link';

export default function ProspectNotFound() {
  return (
    <div className="main">
      <div className="page-panel">
        <div className="empty-state">
          This prospect doesn&apos;t exist or you don&apos;t have access to it.{' '}
          <Link href="/">Back to dashboard →</Link>
        </div>
      </div>
    </div>
  );
}
