"use client";

import * as React from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  ArrowRight,
  Code2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { GUIDE_STEPS, GUIDE_FAQS } from "@/data/guide";

export default function GuidePage() {
  const [activeSection, setActiveSection] = React.useState<string>("langkah-1");
  const [copiedCodeId, setCopiedCodeId] = React.useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    toast.success("Perintah SQL disalin ke clipboard!");
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
    <div className="max-w-4xl mx-auto space-y-8 animate-page-in">
      <PageHeader
        title="Panduan Penggunaan"
        description="Langkah demi langkah menghubungkan dan mengimpor data ke Databricks Unity Catalog secara mudah dan aman."
      />

      <div className="lg:hidden rounded-lg border border-zinc-200 bg-white p-3">
        <span className="text-xs font-medium text-zinc-500 block mb-2">
          Lompat ke Langkah:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {GUIDE_STEPS.map((step) => (
            <a
              key={step.id}
              href={`#${step.id}`}
              className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-indigo-600 hover:text-indigo-600 transition-colors"
            >
              {step.stepNumber}. {step.title}
            </a>
          ))}
          <a
            href="#langkah-7"
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-indigo-600 hover:text-indigo-600 transition-colors"
          >
            7. Jika Ada Error
          </a>
        </div>
      </div>

      <div className="flex items-start gap-8">
        <aside className="hidden lg:block w-56 shrink-0 sticky top-8 space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2 px-2">
              Daftar Langkah
            </span>
            <nav className="space-y-0.5">
              {GUIDE_STEPS.map((step) => {
                const isActive = activeSection === step.id;
                return (
                  <a
                    key={step.id}
                    href={`#${step.id}`}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      isActive
                        ? "bg-zinc-100 font-semibold text-indigo-600"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-xs font-medium ${
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
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  activeSection === "langkah-7"
                    ? "bg-zinc-100 font-semibold text-indigo-600"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-xs font-medium ${
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

          <div className="rounded-lg border border-zinc-200 bg-white p-3.5 text-xs space-y-2 shadow-xs">
            <span className="font-semibold text-zinc-900 block">
              Siap Mengimpor?
            </span>
            <p className="text-zinc-500 leading-normal">
              Jika koneksi sudah teruji, Anda bisa langsung mulai mengunggah berkas data.
            </p>
            <Button asChild size="sm" className="w-full h-8 text-xs mt-1">
              <Link href="/">Buka Halaman Impor</Link>
            </Button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-10">
          {GUIDE_STEPS.map((step) => (
            <section
              key={step.id}
              id={step.id}
              className="scroll-mt-8 space-y-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 font-mono text-xs font-semibold text-white shrink-0">
                  {step.stepNumber}
                </span>
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                    {step.title}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {step.shortDescription}
                  </p>
                </div>
              </div>

              <Card>
                <CardContent className="p-5 space-y-4 text-xs text-zinc-600 leading-relaxed">
                  <div className="space-y-2">
                    {step.fullText.map((paragraph, pIdx) => (
                      <p key={pIdx} className="text-zinc-700 leading-relaxed text-sm">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {step.codeBlock && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
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
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>{copiedCodeId === step.id ? "Tersalin" : "Salin"}</span>
                        </Button>
                      </div>
                      <pre className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 font-mono text-xs text-zinc-800 leading-relaxed overflow-x-auto select-all">
                        {step.codeBlock.code}
                      </pre>
                    </div>
                  )}

                  {step.fieldExamples && (
                    <div className="space-y-2 pt-1">
                      <span className="font-semibold text-zinc-800 block text-xs">
                        Daftar Kolom & Contoh Pengisian:
                      </span>
                      <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-200 overflow-hidden bg-white">
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
                            <code className="shrink-0 font-mono text-xs bg-zinc-100 text-zinc-800 font-medium px-2 py-0.5 rounded self-start sm:self-center">
                              {fe.example}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.checklist && step.checklist.length > 0 && (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 space-y-2">
                      <span className="font-semibold text-zinc-900 block text-xs">
                        Daftar Periksa:
                      </span>
                      <ul className="space-y-2">
                        {step.checklist.map((item, cIdx) => (
                          <li key={cIdx} className="flex items-start gap-2 text-xs text-zinc-700">
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {step.actionButton && (
                    <div className="pt-1">
                      <Button asChild size="sm" className="gap-2">
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

          <section id="langkah-7" className="scroll-mt-8 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 font-mono text-xs font-semibold text-white shrink-0">
                7
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-zinc-900">
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
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-zinc-100 pb-2">
                      <h3 className="text-sm font-semibold text-zinc-900">
                        {faq.title}
                      </h3>
                      <code className="text-xs font-mono font-medium text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded self-start sm:self-center">
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

            <Card className="border-zinc-200 bg-zinc-50/50">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <h4 className="text-sm font-semibold text-zinc-900">
                    Masih Mengalami Kendala?
                  </h4>
                  <p className="text-zinc-500">
                    Gunakan fitur &quot;Tes Koneksi&quot; di halaman Pengaturan untuk mendiagnosis langkah koneksi yang gagal secara rinci.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
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
