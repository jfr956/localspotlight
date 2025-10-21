"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageUploadSection } from "./ImageUploadSection";
import { createManualPostAction } from "../actions";

interface PostComposeFormProps {
  locationId: string;
  defaultDate: string;
  defaultTime: string;
}

export function PostComposeForm({ locationId, defaultDate, defaultTime }: PostComposeFormProps) {
  const [postType, setPostType] = useState<"WHATS_NEW" | "EVENT" | "OFFER">("WHATS_NEW");

  const showHeadline = postType === "EVENT" || postType === "OFFER";

  return (
    <form action={createManualPostAction} className="space-y-8">
      <input type="hidden" name="locationId" value={locationId} />

      <section className="space-y-4">
        <div>
          <label htmlFor="postType" className="block text-sm font-medium text-slate-300">
            Post type
          </label>
          <p className="text-xs text-slate-500">
            Choose the Google post format that best matches your announcement.
          </p>
          <select
            id="postType"
            name="postType"
            value={postType}
            onChange={(e) => setPostType(e.target.value as "WHATS_NEW" | "EVENT" | "OFFER")}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="WHATS_NEW">What&apos;s New</option>
            <option value="EVENT">Event</option>
            <option value="OFFER">Offer</option>
          </select>
        </div>

        {showHeadline && (
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-300">
              {postType === "EVENT" ? "Event Title" : "Offer Title"}
            </label>
            <p className="text-xs text-slate-500">
              {postType === "EVENT"
                ? "Give your event a clear, catchy name (max 58 characters)."
                : "Name your special offer (max 58 characters)."}
            </p>
            <input
              id="title"
              name="title"
              type="text"
              required={showHeadline}
              maxLength={58}
              placeholder={postType === "EVENT" ? "e.g., Summer Sale Event" : "e.g., 20% Off This Week"}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        )}

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-300">
            {showHeadline ? "Description" : "Post Content"}
          </label>
          <p className="text-xs text-slate-500">
            {showHeadline
              ? "Provide details about your event or offer (up to 1500 characters)."
              : "Share your update with customers (up to 1500 characters)."}
          </p>
          <textarea
            id="description"
            name="description"
            required
            rows={6}
            maxLength={1500}
            placeholder={
              postType === "EVENT"
                ? "Describe the event details, what to expect, and why customers should attend..."
                : postType === "OFFER"
                ? "Explain the offer details, terms, and how customers can take advantage..."
                : "Share your news, announcement, or update with customers..."
            }
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <p className="mt-1 text-xs text-slate-500">
            {1500} characters maximum. First 100-150 characters are most visible on mobile.
          </p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label htmlFor="publishDate" className="block text-sm font-medium text-slate-300">
              {postType === "EVENT" || postType === "OFFER" ? "Start date" : "Publish date"}
            </label>
            {(postType === "EVENT" || postType === "OFFER") && (
              <p className="text-xs text-slate-500 mt-1">
                When does this {postType.toLowerCase()} begin?
              </p>
            )}
            <input
              id="publishDate"
              name="publishDate"
              type="date"
              defaultValue={defaultDate}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div>
            <label htmlFor="publishTime" className="block text-sm font-medium text-slate-300">
              {postType === "EVENT" || postType === "OFFER" ? "Start time" : "Publish time"}
            </label>
            <input
              id="publishTime"
              name="publishTime"
              type="time"
              defaultValue={defaultTime}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {(postType === "EVENT" || postType === "OFFER") && (
            <>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-slate-300">
                  End date
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  When does this {postType.toLowerCase()} end?
                </p>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-slate-300">
                  End time
                </label>
                <input
                  id="endTime"
                  name="endTime"
                  type="time"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </>
          )}

          {postType === "OFFER" && (
            <>
              <div>
                <label htmlFor="couponCode" className="block text-sm font-medium text-slate-300">
                  Coupon code (optional)
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Add a promo code customers can use
                </p>
                <input
                  id="couponCode"
                  name="couponCode"
                  type="text"
                  placeholder="e.g., SAVE20"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <label htmlFor="termsUrl" className="block text-sm font-medium text-slate-300">
                  Terms & conditions URL (optional)
                </label>
                <input
                  id="termsUrl"
                  name="termsUrl"
                  type="url"
                  placeholder="https://example.com/terms"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="ctaAction" className="block text-sm font-medium text-slate-300">
              Call to action
            </label>
            <select
              id="ctaAction"
              name="ctaAction"
              defaultValue=""
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="">No button</option>
              <option value="BOOK">Book</option>
              <option value="CALL">Call</option>
              <option value="LEARN_MORE">Learn more</option>
              <option value="ORDER">Order</option>
              <option value="SHOP">Shop</option>
              <option value="SIGN_UP">Sign up</option>
              <option value="VISIT_WEBSITE">Visit website</option>
            </select>
          </div>
          <div>
            <label htmlFor="ctaUrl" className="block text-sm font-medium text-slate-300">
              Call-to-action URL
            </label>
            <input
              id="ctaUrl"
              name="ctaUrl"
              type="url"
              placeholder="https://example.com/offer"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        </div>
      </section>

      <ImageUploadSection />

      <div className="flex items-center justify-end gap-3">
        <Link
          href={`/locations/${locationId}?tab=posts`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Save and schedule
        </button>
      </div>
    </form>
  );
}
