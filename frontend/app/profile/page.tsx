"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfilePage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [user, setUser] = useState<any>(null);
  const [me, setMe] = useState<any>(null);

  // profile edits
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0, active: 0, volumeUsd: 0 });


  // file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sessionResp } = await supabase.auth.getSession();
        const session = sessionResp?.session;
        const currentUser = session?.user ?? null;
        if (!currentUser || !session) {
          window.location.href = "/auth";
          return;
        }
        setUser(currentUser);
        await loadAll(currentUser.id, session.access_token);
      } catch (e: any) {
        setError(e?.message ?? String(e));
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async (userId: string, token: string) => {
    setLoading(true);
    setError("");
    try {
      // profile from backend
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/profile/me`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1' },
        cache: 'no-store',
      });
      if (!res.ok) {
        let body = {};
        try {
          body = await res.json();
        } catch {}
        throw new Error((body as any).error || `Failed to load profile (${res.status})`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Unexpected response from API (non-JSON). First bytes: ${text.slice(0, 60)}`);
      }
      const data = await res.json();
      setMe(data);
      setDisplayName(data.display_name ?? "");
      setBio(data.bio ?? "");
      setAvatarUrl(data.avatar_url ?? "");
      if (data.stats) {
        setStats({
          total: Number(data.stats.total || 0),
          completed: Number(data.stats.completed || 0),
          active: Number(data.stats.active || 0),
          volumeUsd: Number(data.stats.volume_usd || 0),
        });
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  // Reset image error when avatar changes
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl, localPreview]);

  const onAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError("");
      const file = e.target.files?.[0];
      if (!file || !user) return;

      // optional: simple file size guard (5MB)
      const maxBytes = 5 * 1024 * 1024;
      if (file.size > maxBytes) {
        throw new Error("Image too large — max 5MB");
      }

      // local preview
      const previewUrl = URL.createObjectURL(file);
      setLocalPreview(previewUrl);
      setUploading(true);

      // upload directly (no cropper)
      const safeName = file.name.replace(/\s+/g, "_");
      // storage object key must be relative to bucket root; RLS expects <uid>/...
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Failed to get public url");

      setAvatarUrl(data.publicUrl);
      // auto-save to profile row
      await autoSaveAvatar(data.publicUrl);
      setMsg("Avatar uploaded");
      setTimeout(() => setMsg(""), 2000);
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setTimeout(() => setError(""), 4000);
    } finally {
      setUploading(false);
      // cleanup local preview after a short delay so UX shows it briefly if upload succeeded
      setTimeout(() => {
        if (localPreview) {
          try {
            URL.revokeObjectURL(localPreview);
          } catch {}
          setLocalPreview(null);
        }
      }, 1000);
      // reset input so same-file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const autoSaveAvatar = async (publicUrl: string) => {
    try {
      const { data: sessionResp } = await supabase.auth.getSession();
      const token = sessionResp?.session?.access_token;
      if (!token) return;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
    } catch (e) {
      console.warn("autoSaveAvatar failed", e);
    }
  };

  const removeAvatar = async () => {
    if (!confirm("Remove avatar?")) return;
    try {
      setAvatarUrl("");
      await autoSaveAvatar("");
      setMsg("Avatar removed");
      setTimeout(() => setMsg(""), 2000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setTimeout(() => setError(""), 4000);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const { data: sessionResp } = await supabase.auth.getSession();
      const token = sessionResp?.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ display_name: displayName, bio, avatar_url: avatarUrl }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to save profile");
      setMsg("Profile saved");
      setTimeout(() => setMsg(""), 2000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setTimeout(() => setError(""), 4000);
    } finally {
      setSaving(false);
    }
  };

  const initials = useMemo(() => {
    const source = (displayName || me?.display_name || me?.username || "").trim();
    if (!source) return "";
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((p: string) => p[0]?.toUpperCase()).join("");
  }, [displayName, me]);

  const showImage = Boolean((localPreview || avatarUrl) && !imageError);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading profile…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Avatar and stats */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
            <p className="text-sm text-gray-400 mb-6">Update your avatar and personal details.</p>

            {/* Avatar + username */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-xl border border-white/10 shadow-sm">
                  {showImage ? (
                    <img
                      src={localPreview ?? (avatarUrl || "")}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center bg-gradient-to-br from-zinc-800 to-zinc-700 text-white/90">
                      <span>{initials || "👤"}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={openFilePicker}
                  className="absolute -bottom-1 -right-1 bg-black/70 text-white rounded-full p-2 shadow hover:bg-black/85 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  aria-label="Edit avatar"
                  title="Change avatar"
                  disabled={uploading}
                >
                  {uploading ? (
                    <span className="block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  )}
                </button>

                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarFileSelected} />
              </div>

              <div className="flex-1">
                <div className="text-lg font-semibold">{me?.display_name ?? "Unnamed"}</div>
                <div className="text-sm text-gray-400 mt-1">{me?.username ? `@${me.username}` : ""}</div>
                {avatarUrl && (
                  <button onClick={removeAvatar} className="mt-3 text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15">
                    Remove avatar
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6">
              <div className="text-sm text-gray-300 mb-2">Your stats</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-gray-400">Total deals</div>
                  <div className="mt-1 text-xl font-semibold">{stats.total}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-gray-400">Active</div>
                  <div className="mt-1 text-xl font-semibold">{stats.active}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-gray-400">Completed</div>
                  <div className="mt-1 text-xl font-semibold">{stats.completed}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-gray-400">Volume (USD)</div>
                  <div className="mt-1 text-xl font-semibold">${stats.volumeUsd.toLocaleString('en-US')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Editable fields */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            {/* Display name */}
            <div>
              <label className="text-sm text-gray-300 mb-1 block" htmlFor="display_name">Display name</label>
              <input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className="w-full rounded-xl bg-white/10 px-4 py-3 border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>

            {/* Bio */}
            <div className="mt-6">
              <label className="text-sm text-gray-300 mb-1 block" htmlFor="bio">Bio</label>
              <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={8} maxLength={500} className="w-full rounded-xl bg-white/10 px-4 py-3 border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              <div className="mt-1 text-xs text-gray-500">Up to 500 characters</div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-2 justify-end">
              <button onClick={saveProfile} disabled={saving} className="rounded-xl bg-[#FF7A00] hover:bg-[#FF7A00] px-6 py-3 font-semibold disabled:opacity-50 text-white">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

            {msg && <div className="mt-3 text-green-400 text-sm">{msg}</div>}
            {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
