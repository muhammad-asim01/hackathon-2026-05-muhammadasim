"use client";

import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormState {
  name: string;
  email: string;
  message: string;
}

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    message: "",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Server error");
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(
        "Message couldn't be sent right now. Email us directly at hello@sift.ai"
      );
    }
  }

  if (status === "success") {
    return (
      <div className="bg-card border border-border p-8 flex flex-col items-center text-center gap-5">
        <div className="w-12 h-12 bg-lp-green/15 border border-lp-green/30 flex items-center justify-center">
          <CheckCircle2
            className="w-6 h-6 text-lp-green"
            strokeWidth={1.5}
          />
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-2">
            Message received
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Thanks for reaching out. We&apos;ll get back to you at{" "}
            <span className="text-foreground">{form.email}</span> within one
            business day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border p-8 flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Your name"
          value={form.name}
          onChange={handleChange}
          required
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@agency.com"
          value={form.email}
          onChange={handleChange}
          required
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder="What's on your mind?"
          value={form.message}
          onChange={handleChange}
          required
          className="w-full rounded-none border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors resize-none"
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-lp-red">{errorMsg}</p>
      )}

      <Button
        type="submit"
        disabled={status === "submitting"}
        shape="sharp"
        className="w-full"
      >
        {status === "submitting" ? (
          "Sending…"
        ) : (
          <>
            Send message
            <Send className="w-4 h-4" />
          </>
        )}
      </Button>
    </form>
  );
}
