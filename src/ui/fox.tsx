import Image from "next/image";

export function Portrait({ src, size = 64 }: { src: string; size?: number }) {
  if (!src) return null;
  return <Image className="avatar" src={`/media/${src}`} alt="" width={size} height={size} unoptimized priority />;
}

export function Fox({ big = false }: { big?: boolean }) {
  const size = big ? 96 : 28;
  return (
    <svg className="fox" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path fill="#d4783a" d="M6 24 18 6l8 16 6-12 6 12 8-16 12 18-6 18c0 12-10 16-20 16S12 54 12 42Z" />
      <circle cx="24" cy="34" r="2.2" fill="#2a2824" />
      <circle cx="40" cy="34" r="2.2" fill="#2a2824" />
      <path d="M29 42h6l-3 4z" fill="#2a2824" />
    </svg>
  );
}
