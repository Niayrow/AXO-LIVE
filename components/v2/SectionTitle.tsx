import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface SectionTitleProps {
  title: string;
  href?: string;
  linkLabel?: string;
}

export default function SectionTitle({ title, href, linkLabel }: SectionTitleProps) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <div className="w-8 h-1 bg-om-green rounded-full mb-2" />
        <h2 className="text-xl font-extrabold text-om-charcoal">{title}</h2>
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="flex items-center gap-1 text-sm font-bold text-om-coral hover:text-om-coral-dark transition-colors"
        >
          {linkLabel}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
