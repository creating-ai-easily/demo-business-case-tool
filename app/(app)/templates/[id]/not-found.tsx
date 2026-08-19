import Link from 'next/link';

export default function TemplateNotFound() {
  return (
    <div className="main">
      <div className="page-panel">
        <div className="empty-state">
          This template doesn&apos;t exist. <Link href="/templates">Back to templates →</Link>
        </div>
      </div>
    </div>
  );
}
