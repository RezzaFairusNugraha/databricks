import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 max-w-md w-full space-y-4">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">404</h2>
        <p className="text-sm text-zinc-500">
          Halaman yang Anda cari tidak ditemukan.
        </p>
        <Button asChild className="w-full">
          <Link href="/">Kembali ke Impor</Link>
        </Button>
      </div>
    </div>
  );
}
