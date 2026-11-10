// Koneksi ke Supabase. Isi dengan kunci PUBLIK saja.
// Jangan pernah menaruh kunci rahasia (service_role / secret) di file ini.
const SUPABASE_URL = "https://tmmlvpmnnhihndnvahdy.supabase.co";
const SUPABASE_KEY = "sb_publishable_KKz7YhDfjXigUomgNsk8NA_MxgSUWJN";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);