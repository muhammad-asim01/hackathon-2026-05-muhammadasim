import Link from "next/link";
import { Zap } from "lucide-react";

const LINK_CLASSES =
  "text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm";

export default function FooterPublic() {
  return (
    <footer className="border-t border-border bg-card/20">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <div className="w-7 h-7 bg-lp-amber flex items-center justify-center rounded-sm">
                <Zap className="w-4 h-4 text-lp-charcoal" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-[15px] tracking-tight text-foreground">
                sift.ai
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[28ch]">
              AI lead engine for digital agencies. Finds the businesses your
              competitors haven't noticed yet.
            </p>
            <p className="text-xs text-muted-foreground/50">
              © {new Date().getFullYear()} sift.ai
            </p>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest">
              Product
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li><Link href="/#features" className={LINK_CLASSES}>Features</Link></li>
              <li><Link href="/#how-it-works" className={LINK_CLASSES}>How it works</Link></li>
              <li><Link href="/pricing" className={LINK_CLASSES}>Pricing</Link></li>
              <li><Link href="/compare" className={LINK_CLASSES}>Compare</Link></li>
              <li><Link href="/dashboard" className={LINK_CLASSES}>Dashboard</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest">
              Resources
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li><Link href="/contact" className={LINK_CLASSES}>Contact</Link></li>
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASSES}
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest">
              Legal
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li><Link href="/privacy" className={LINK_CLASSES}>Privacy policy</Link></li>
              <li><Link href="/terms" className={LINK_CLASSES}>Terms of service</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
