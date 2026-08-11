import Link from 'next/link';

const socialLinks = [
  { label: 'Facebook', href: '#' },
  { label: 'Instagram', href: '#' },
  { label: 'LINE', href: '#' },
];

const supportLinks = [
  { label: '常見問題', href: '/faq' },
  { label: '線上文章', href: '/blog' },
  { label: '課程介紹', href: '/courses' },
];

export default function SiteFooter() {
  return (
    <footer className="w-full mt-auto bg-on-surface text-white">
      <div className="page-shell grid grid-cols-1 md:grid-cols-4 gap-8 py-12">
        <div className="md:col-span-2">
          <div className="font-display text-2xl font-extrabold tracking-tight mb-3">
            高中學習資源教育網 2.0
          </div>
          <p className="text-sm text-surface-variant leading-relaxed max-w-md">
            系統化課程、專業師資與學習資源，陪你掌握數學與升學關鍵。
          </p>
          <p className="mt-6 text-xs text-outline-variant">
            © {new Date().getFullYear()} 高中學習資源教育網. All rights reserved.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h4 className="font-bold text-base mb-1">探索</h4>
          {supportLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-surface-variant hover:text-secondary-container transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <h4 className="font-bold text-base mb-1">社群連結</h4>
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-surface-variant hover:text-secondary-container transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
