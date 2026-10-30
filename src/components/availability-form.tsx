"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";

type FormState = "idle" | "sending" | "success" | "error";

export default function AvailabilityForm() {
  const [state, setState] = useState<FormState>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.consent = formData.has("consent") ? "true" : "false";

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setState("error");
        return;
      }

      form.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <form className="availability-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <span>LET&apos;S GET TO KNOW YOUR NEIGHBOURHOOD</span>
        <p>Tell us a little about you.</p>
      </div>
      <div className="form-fields">
        <label>
          Your name
          <input autoComplete="name" name="name" placeholder="e.g. Alex Morgan" required minLength={2} maxLength={80} />
        </label>
        <label>
          Email address
          <input autoComplete="email" name="email" type="email" placeholder="you@example.com" required maxLength={254} />
        </label>
        <label>
          City
          <input autoComplete="address-level2" name="city" placeholder="Your city" required minLength={2} maxLength={80} />
        </label>
        <label>
          Community <span className="optional-label">OPTIONAL</span>
          <input name="community" placeholder="Apartment or community name" maxLength={120} />
        </label>
        <label className="form-message">
          Anything else we should know? <span className="optional-label">OPTIONAL</span>
          <textarea name="message" placeholder="A note for our team" rows={3} maxLength={1000} />
        </label>
      </div>
      <label className="consent-label">
        <input name="consent" type="checkbox" required />
        <span>I agree that RIVORA may contact me about availability in my area.</span>
      </label>
      <input className="website-field" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="button button-dark form-submit" type="submit" disabled={state === "sending"}>
        {state === "sending" ? <>Sending <LoaderCircle className="spin" size={16} /></> : <>Send an enquiry <ArrowRight size={16} /> </>}
      </button>
      <p className="form-disclaimer">This is an enquiry, not a confirmed service booking.</p>
      <div className="form-feedback" aria-live="polite" role={state === "error" ? "alert" : "status"}>
        {state === "success" && <><CheckCircle2 size={17} /> Thank you. Your enquiry is with our team.</>}
        {state === "error" && "We couldn’t send your enquiry just now. Please try again shortly."}
      </div>
    </form>
  );
}
