"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  HelpCircle,
  Code2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GUIDE_STEPS, GUIDE_FAQS } from "@/data/guide";

export default function GuidePage() {
  const [activeSection, setActiveSection] = React.useState<string>("langkah-1");
  const [copiedCodeId, setCopiedCodeId] = React.useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    toast.success("Perintah SQL berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  React.useEffect(() => {
    const handleScroll = () => {
      const sections = [...GUIDE_STEPS.map((s) => s.id), "langkah-7"];
      const scrollPos = window.scrollY + 120;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Panduan Penggunaan
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Langkah demi langkah menghubungkan dan mengimpor data ke Databricks Unity Catalog secara mudah dan aman.
        </p>
      </div>

      <div className="lg:hidden rounded-xl border border-zinc-200 bg-white p-3">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
          Lompat ke Langkah:
        </label>
        <div className="flex flex-wrap gap-1.5">
          {GUIDE_STEPS.map((step) => (
            <a
              key={step.id}
              href={`#${step.id}`}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-indigo-600 hover:text-indigo-600 transition-colors"
            >
              {step.stepNumber}. {step.title}
            </a>
          ))}
          <a
            href="#langkah-7"
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-indigo-600 hover:text-indigo-600 transition-colors"
          >
            7. Jika Ada Error
          </a>
        </div>
      </div>

      <div className="flex items-start gap-8">
        <aside className="hidden lg:block w-60 shrink-0 sticky top-8 space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-3">
              Daftar Langkah
            </span>
            <nav className="space-y-1">
              {GUIDE_STEPS.map((step) => {
                const isActive = activeSection === step.id;
                return (
                  <a
                    key={step.id}
                    href={`#${step.id}`}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      isActive
                        ? "bg-indigo-50 font-semibold text-indigo-600"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {step.stepNumber}
                    </span>
                    <span className="truncate">{step.title}</span>
                  </a>
                );
              })}

              <a
                href="#langkah-7"
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  activeSection === "langkah-7"
                    ? "bg-indigo-50 font-semibold text-indigo-600"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold ${
                    activeSection === "langkah-7"
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  7
                </span>
                <span className="truncate">Jika Ada Error</span>
              </a>
            </nav>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs space-y-2">
            <span className="font-semibold text-zinc-900 block flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              Siap Mengimpor?
            </span>
            <p className="text-zinc-500 leading-relaxed">
              Jika koneksi sudah teruji hijau, Anda bisa langsung mulai mengunggah berkas data.
            </p>
            <Button asChild size="sm" className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white mt-1">
              <Link href="/">Buka Halaman Impor</Link>
            </Button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-12">
          {GUIDE_STEPS.map((step) => (
            <section
              key={step.id}
              id={step.id}
              className="scroll-mt-8 space-y-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 font-mono text-sm font-bold text-white shadow-sm">
                  {step.stepNumber}
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                    {step.title}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {step.shortDescription}
                  </p>
                </div>
              </div>

              <Card>
                <CardContent className="p-6 space-y-4 text-xs text-zinc-600 leading-relaxed">
                  <div className="space-y-2">
                    {step.fullText.map((paragraph, pIdx) => (
                      <p key={pIdx} className="text-zinc-700 leading-relaxed text-sm">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {step.codeBlock && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                        <span className="flex items-center gap-1.5">
                          <Code2 className="h-3.5 w-3.5 text-indigo-600" />
                          {step.codeBlock.caption || "Perintah SQL"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => copyCode(step.codeBlock!.code, step.id)}
                        >
                          {copiedCodeId === step.id ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          <span>{copiedCodeId === step.id ? "Tersalin" : "Salin"}</span>
                        </Button>
                      </div>
                      <pre className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-800 leading-relaxed overflow-x-auto select-all">
                        {step.codeBlock.code}
                      </pre>
                    </div>
                  )}

                  {step.fieldExamples && (
                    <div className="space-y-2 pt-2">
                      <span className="font-semibold text-zinc-800 block">
                        Daftar Kolom & Contoh Pengisian:
                      </span>
                      <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-200 overflow-hidden bg-white">
                        {step.fieldExamples.map((fe, fIdx) => (
                          <div key={fIdx} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                            <div>
                              <span className="font-semibold text-zinc-900 block">
                                {fe.field}
                              </span>
                              <span className="text-zinc-500 block">
                                {fe.description}
                              </span>
                            </div>
                            <code className="shrink-0 font-mono text-[11px] bg-zinc-100 text-indigo-600 font-medium px-2 py-0.5 rounded-md self-start sm:self-center">
                              {fe.example}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.checklist && step.checklist.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-2 pt-3">
                      <span className="font-semibold text-zinc-900 block text-xs">
                        Daftar Periksa:
                      </span>
                      <ul className="space-y-2">
                        {step.checklist.map((item, cIdx) => (
                          <li key={cIdx} className="flex items-start gap-2.5 text-xs text-zinc-700">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {step.actionButton && (
                    <div className="pt-2">
                      <Button asChild size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Link href={step.actionButton.href}>
                          <span>{step.actionButton.label}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          ))}

          <section id="langkah-7" className="scroll-mt-8 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 font-mono text-sm font-bold text-white shadow-sm">
                7
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                  Jika Ada Error
                </h2>
                <p className="text-xs text-zinc-500">
                  Solusi cepat untuk pesan kesalahan umum yang dapat muncul di aplikasi.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {GUIDE_FAQS.map((faq) => (
                <Card key={faq.id} className="overflow-hidden">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-zinc-100 pb-2">
                      <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span>{faq.title}</span>
                      </h3>
                      <code className="text-[10px] font-mono font-medium text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md self-start sm:self-center">
                        {faq.errorCode}
                      </code>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="font-semibold text-zinc-700">Penyebab: </span>
                        <span className="text-zinc-600">{faq.cause}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-emerald-700">Solusi: </span>
                        <span className="text-zinc-700">{faq.solution}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-indigo-200 bg-indigo-50/30">
              <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <h4 className="text-sm font-semibold text-zinc-900">
                    Masih Mengalami Kendala?
                  </h4>
                  <p className="text-zinc-500">
                    Gunakan fitur &quot;Tes Koneksi&quot; di halaman Pengaturan untuk mendiagnosis langkah koneksi yang gagal secara rinci.
                  </p>
                </div>
                <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                  <Link href="/settings">Buka Pengaturan & Tes Koneksi</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
