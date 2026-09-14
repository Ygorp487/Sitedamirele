import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Gift = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  stock: number;
  claimed_at: string | null;
  sort_order: number;
  image_url: string | null;
};

const BUCKET = "gift-images";
const credentials = z.object({ user: z.string().min(1), password: z.string().min(1) });

async function addImageUrls(rows: any[]): Promise<Gift[]> {
  const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = getSupabaseAdmin();
  const paths = rows.map((row) => row.image_path).filter(Boolean) as string[];
  const byPath = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 7);
    data?.forEach((entry, index) => {
      if (entry.signedUrl) byPath.set(paths[index]!, entry.signedUrl);
    });
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? null,
    stock: row.stock,
    claimed_at: row.claimed_at ?? null,
    sort_order: row.sort_order,
    image_url: row.image_path ? byPath.get(row.image_path) ?? null : null,
  }));
}

export const listGifts = createServerFn({ method: "GET" }).handler(async () => {
  const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gifts")
    .select("id,name,category,description,stock,claimed_at,sort_order,image_path")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return addImageUrls(data ?? []);
});

export const claimGift = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = getSupabaseAdmin();
    const { data: claimed, error } = await supabase
      .from("gifts")
      .update({ claimed_at: new Date().toISOString(), stock: 0 })
      .eq("id", data.id)
      .is("claimed_at", null)
      .gt("stock", 0)
      .select("id");
    if (error) throw new Error(error.message);
    return claimed?.length
      ? { ok: true as const }
      : { ok: false as const, reason: "Este presente acabou de ser escolhido por outra pessoa." };
  });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data) => credentials.parse(data))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin.server");
    assertAdmin(data.user, data.password);
    return { ok: true as const };
  });

export const adminListGifts = createServerFn({ method: "POST" })
  .inputValidator((data) => credentials.parse(data))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin.server");
    assertAdmin(data.user, data.password);
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("gifts")
      .select("id,name,category,description,stock,claimed_at,sort_order,image_path")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return addImageUrls(rows ?? []);
  });

export const adminSaveGift = createServerFn({ method: "POST" })
  .inputValidator((data) => credentials.extend({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    category: z.string().min(1),
    description: z.string().optional(),
    available: z.boolean(),
    imageBase64: z.string().optional(),
    imageName: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin.server");
    assertAdmin(data.user, data.password);
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = getSupabaseAdmin();

    let imagePath: string | undefined;
    if (data.imageBase64) {
      const raw = data.imageBase64.includes(",") ? data.imageBase64.split(",")[1]! : data.imageBase64;
      const bytes = Buffer.from(raw, "base64");
      const ext = (data.imageName?.split(".").pop() ?? "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
      imagePath = `${crypto.randomUUID()}.${ext}`;
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const { error } = await supabase.storage.from(BUCKET).upload(imagePath, bytes, { contentType });
      if (error) throw new Error(error.message);
    }

    const payload: Record<string, unknown> = {
      name: data.name,
      category: data.category,
      description: data.description || null,
      stock: data.available ? 1 : 0,
      claimed_at: data.available ? null : new Date().toISOString(),
    };
    if (imagePath) payload.image_path = imagePath;

    if (data.id) {
      const { error } = await supabase.from("gifts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: last } = await supabase.from("gifts").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { error } = await supabase.from("gifts").insert({ ...payload, sort_order: (last?.sort_order ?? 0) + 1 });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const adminDeleteGift = createServerFn({ method: "POST" })
  .inputValidator((data) => credentials.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin.server");
    assertAdmin(data.user, data.password);
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await getSupabaseAdmin().from("gifts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
